import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ParsedLineItem {
  sr_no?: number;
  category?: string;
  description: string;
  unit_purchase: number;
  unit_sale: number;
  quantity: number;
  uom?: string;
  total_purchase: number;
  total_sale: number;
  sub_total?: number;
  margin_percentage: number;
  margin_value?: number;
  tax_description?: string;
  tax_amount?: number;
  total?: number;
}

export interface ParsedCostSheetData {
  cs_number?: string;
  quotation_date?: string;
  valid_until?: string;
  customer_name?: string;
  customer_address?: string;
  subject?: string;
  oem?: string;
  distributor?: string;
  business_unit?: string;
  prepared_by_name?: string;
  prepared_by_phone?: string;
  prepared_by_email?: string;
  terms_and_conditions?: string;
  payment_terms?: string;
  purchase_total?: number;
  margin_total?: number;
  tax_total?: number;
  grand_total?: number;
  items: ParsedLineItem[];
}

/**
 * 100% On-Device / Local PDF Parser for SHRO Systems Cost Sheets.
 * Uses pdfjs-dist directly without any LLM or external API calls.
 * Based on the reference MVP positional clustering engine.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedLineItem[]> {
  const fullResult = await parseCostSheetFromPdf(buffer);
  return fullResult.items;
}

export async function parseCostSheetFromPdf(buffer: Buffer): Promise<ParsedCostSheetData> {
  const num = (s: any) => parseFloat(String(s || '').replace(/[₹$,\s]/g, '')) || 0;

  try {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;

    const parsedRows: any[] = [];
    const allPageTextLines: string[] = [];
    let fullText = '';
    let stopped = false;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const rawItems = (content.items as any[])
        .map(it => ({
          str: it.str || '',
          x: it.transform ? it.transform[4] : 0,
          x1: (it.transform ? it.transform[4] : 0) + (it.width || 0),
          y: it.transform ? it.transform[5] : 0,
        }))
        .filter(it => it.str.trim() !== '');

      // Sort items top-to-bottom (Y descending), then left-to-right (X ascending)
      rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

      const pageText = rawItems.map(it => it.str.trim()).join(' ');
      allPageTextLines.push(pageText);
      fullText += pageText + '\n';

      // Positional row grouping if table hasn't ended
      if (!stopped) {
        let currentRow: { firstLineY: number; srItem: any; items: any[] } | null = null;

        for (const it of rawItems) {
          const trimmed = it.str.trim();
          // Sr No column: typically at the left margin (X <= 60), bare integer or integer with dot
          const inSrCol = it.x >= 0 && it.x <= 60;
          const isFooterLabel = /^(Purchase Total|Margin Total|Grand Total|Terms and Conditions|Commercial Terms)$/i.test(trimmed);

          if (isFooterLabel) {
            if (currentRow) {
              parsedRows.push(currentRow);
              currentRow = null;
            }
            stopped = true;
            break;
          }

          if (inSrCol && /^\d{1,3}\.?$/.test(trimmed)) {
            if (currentRow) parsedRows.push(currentRow);
            currentRow = { firstLineY: it.y, srItem: it, items: [] };
          }

          if (currentRow) {
            currentRow.items.push(it);
          }
        }

        if (currentRow && !stopped) {
          parsedRows.push(currentRow);
        }
      }
    }

    // Now extract line items using the MVP positional clustering algorithm
    const lineItems: ParsedLineItem[] = [];
    let itemIndex = 1;

    for (const row of parsedRows) {
      // Find first line items by Y position
      const firstLine = row.items.filter((it: any) => Math.abs(it.y - row.firstLineY) < 1.5);
      const firstLineSorted = firstLine.slice().sort((a: any, b: any) => a.x - b.x).filter((it: any) => it !== row.srItem);
      if (!firstLineSorted.length) continue;

      const descAnchorX = firstLineSorted[0].x;

      // Description: left-aligned text fragments sharing anchor X (within 4px)
      const descPositionalItems = row.items.filter((it: any) => it !== row.srItem && Math.abs(it.x - descAnchorX) < 4);
      const desc = descPositionalItems
        .filter((it: any) => it.str.trim() !== '.')
        .map((it: any) => it.str.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Everything else is a right-aligned numeric / spec column. Cluster by shared right edge (x1)
      const others = row.items.filter((it: any) => it !== row.srItem && !descPositionalItems.includes(it));
      others.sort((a: any, b: any) => a.x1 - b.x1);

      const clusters: { x1: number; parts: any[] }[] = [];
      others.forEach((it: any) => {
        const last = clusters[clusters.length - 1];
        if (last && Math.abs(it.x1 - last.x1) < 6) {
          last.parts.push(it);
          last.x1 = it.x1;
        } else {
          clusters.push({ x1: it.x1, parts: [it] });
        }
      });

      if (clusters.length >= 3) {
        const clusterText = (c: any) => c.parts.slice().sort((a: any, b: any) => b.y - a.y).map((it: any) => it.str.trim()).join(' ');
        
        const up = num(clusterText(clusters[0]));
        const qty = num(clusterText(clusters[1])) || 1;
        const total = num(clusterText(clusters[clusters.length - 1]));

        if (desc || up || total) {
          const us = qty > 0 ? total / qty : total;
          const tp = up * qty;
          const ts = total;
          const margin = ts > 0 ? ((ts - tp) / ts) * 100 : 0;

          // Check if intermediate clusters contain UOM, Margin %, or Tax info
          let detectedUom = 'Box';
          let detectedTax = '';

          for (let cIdx = 2; cIdx < clusters.length - 1; cIdx++) {
            const txt = clusterText(clusters[cIdx]);
            if (/^(Box|Each|Nos|Pack|Set|Unit|Lot)$/i.test(txt)) {
              detectedUom = txt;
            } else if (/@\d+%/i.test(txt) || /(?:CGST|SGST|IGST|GST)/i.test(txt)) {
              detectedTax = txt;
            }
          }

          lineItems.push({
            sr_no: itemIndex++,
            description: desc || `Item ${itemIndex}`,
            unit_purchase: parseFloat(up.toFixed(2)),
            unit_sale: parseFloat(us.toFixed(2)),
            quantity: qty,
            uom: detectedUom,
            total_purchase: parseFloat(tp.toFixed(2)),
            total_sale: parseFloat(ts.toFixed(2)),
            margin_percentage: parseFloat(margin.toFixed(2)),
            margin_value: parseFloat((ts - tp).toFixed(2)),
            sub_total: parseFloat(ts.toFixed(2)),
            tax_description: detectedTax,
            total: parseFloat(ts.toFixed(2)),
          });
        }
      }
    }

    // Fallback: If positional clustering didn't extract items (e.g. layout variation), use deterministic regex
    if (lineItems.length === 0) {
      const tailRegex = /₹?\s*([\d,]+\.\d{2})\s+(\d+)\s+([A-Za-z]+)\s+([\d\.]+)\s*%\s*₹?\s*([\d,]+\.\d{2})\s*₹?\s*([\d,]+\.\d{2})\s*₹?\s*([\d,]+\.\d{2})\s*(.*?)\s*₹?\s*([\d,]+\.\d{2})/g;
      let match;
      let lastIdx = 0;
      const headerMatch = fullText.match(/Sr\.?\s*No[\s\S]*?Total/i);
      if (headerMatch && headerMatch.index !== undefined) {
        lastIdx = headerMatch.index + headerMatch[0].length;
      }
      tailRegex.lastIndex = lastIdx;

      while ((match = tailRegex.exec(fullText)) !== null) {
        const tailStart = match.index;
        let rawDesc = fullText.substring(lastIdx, tailStart).trim();
        const descMatch = rawDesc.match(/^\d+\s*(?:\.\s*)?(.*)$/is);
        const description = descMatch ? descMatch[1].trim() : rawDesc;

        const up = parseFloat(match[1].replace(/,/g, ''));
        const qty = parseInt(match[2], 10) || 1;
        const uom = match[3] || 'Box';
        const marginPct = parseFloat(match[4]) || 0;
        const marginVal = parseFloat(match[5].replace(/,/g, '')) || 0;
        const us = parseFloat(match[6].replace(/,/g, '')) || 0;
        const subTotal = parseFloat(match[7].replace(/,/g, '')) || (us * qty);
        const taxDesc = match[8].trim();
        const tot = parseFloat(match[9].replace(/,/g, '')) || subTotal;

        lineItems.push({
          sr_no: itemIndex++,
          description: description || `Item ${itemIndex}`,
          unit_purchase: up,
          unit_sale: us > 0 ? us : (qty > 0 ? subTotal / qty : subTotal),
          quantity: qty,
          uom,
          total_purchase: up * qty,
          total_sale: subTotal,
          margin_percentage: marginPct,
          margin_value: marginVal,
          sub_total: subTotal,
          tax_description: taxDesc,
          total: tot,
        });

        lastIdx = tailRegex.lastIndex;
      }
    }

    // Document-level Metadata Extraction using deterministic patterns
    const result: ParsedCostSheetData = {
      items: lineItems,
    };

    // 1. Quotation No (e.g. Quotation No : SS/2026-27/1141)
    const quoteNoMatch = fullText.match(/Quotation\s*(?:No|#|\.)?\s*:\s*([A-Za-z0-9\/-]+)/i) ||
                         fullText.match(/Cost\s*Sheet\s*(?:No|#|\.)?\s*:\s*([A-Za-z0-9\/-]+)/i) ||
                         fullText.match(/Ref\s*(?:No|#|\.)?\s*:\s*([A-Za-z0-9\/-]+)/i);
    if (quoteNoMatch) result.cs_number = quoteNoMatch[1].trim();

    // 2. Quotation Date
    const dateMatch = fullText.match(/Quotation\s*Date\s*:\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i) ||
                      fullText.match(/Date\s*:\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i);
    if (dateMatch) result.quotation_date = dateMatch[1].trim();

    // 3. Valid Until
    const validMatch = fullText.match(/Valid\s*Until\s*:\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i) ||
                       fullText.match(/Validity\s*:\s*([^\n\r]+)/i);
    if (validMatch) result.valid_until = validMatch[1].trim();

    // 4. Customer Name
    const billToMatch = fullText.match(/BILL\s*TO:?\s*(?:BlankTD\s*)?([^\n\r,]+(?:Limited|Ltd|Pvt|Services|PVT\.?\s*LTD)?)/i) ||
                        fullText.match(/Customer\s*(?:Name)?\s*:\s*([^\n\r,]+)/i) ||
                        fullText.match(/M\/s\.?\s+([^\n\r,]+(?:Limited|Ltd|Pvt|Services|PVT\.?\s*LTD)?)/i);
    if (billToMatch) {
      result.customer_name = billToMatch[1].replace(/BlankTD/i, '').trim();
    }

    // 5. Customer Address
    const addrMatch = fullText.match(/Addr:\s*([^]+?)(?=Quotation\s*Date|Dear\s*Customer|Sr\.)/i) ||
                      fullText.match(/Address:\s*([^]+?)(?=Quotation\s*Date|Dear\s*Customer|Sr\.)/i);
    if (addrMatch) {
      result.customer_address = addrMatch[1].replace(/\s+/g, ' ').trim();
    }

    // 6. Prepared By (Salesperson)
    const prepMatch = fullText.match(/Prepared\s*By,?\s*([^\n\r,]+)/i) ||
                      fullText.match(/Account\s*Manager\s*:\s*([^\n\r,]+)/i);
    if (prepMatch) result.prepared_by_name = prepMatch[1].trim();

    const phoneMatch = fullText.match(/(?:Prepared\s*By[\s\S]*?)(\b[6-9]\d{9}\b)/i) ||
                       fullText.match(/Mobile\s*:\s*(\+?91[\-\s]?[6-9]\d{9}|\b[6-9]\d{9}\b)/i);
    if (phoneMatch) result.prepared_by_phone = phoneMatch[1].trim();

    const emailMatch = fullText.match(/([a-zA-Z0-9._%+-]+@shrosystems\.com)/i) ||
                       fullText.match(/Email\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch) result.prepared_by_email = emailMatch[1].trim();

    // 7. Terms & Conditions
    const termsMatch = fullText.match(/TERMS\s*AND\s*CONDITIONS\s*([^]+?)(?=PAYMENTS?\s*TERMS|Prepared\s*By|$)/i);
    if (termsMatch) result.terms_and_conditions = termsMatch[1].trim();

    const payTermsMatch = fullText.match(/PAYMENTS?\s*TERMS\s*([^]+?)(?=Prepared\s*By|$)/i) ||
                          fullText.match(/Payment\s*:\s*([^\n\r]+)/i);
    if (payTermsMatch) result.payment_terms = payTermsMatch[1].trim();

    // 8. OEM and BU Detection
    if (/HPE|ProLiant|DL380|MSA\s*2050/i.test(fullText)) {
      result.oem = 'HPE';
      result.business_unit = 'Hardware';
    } else if (/HP|ScanJet|LaserJet|CarePack/i.test(fullText)) {
      result.oem = 'HP';
      result.business_unit = 'Hardware';
    } else if (/Cisco|Catalyst/i.test(fullText)) {
      result.oem = 'Cisco';
      result.business_unit = 'Hardware';
    } else if (/Dell|PowerEdge/i.test(fullText)) {
      result.oem = 'Dell';
      result.business_unit = 'Hardware';
    } else if (/Lenovo|ThinkSystem/i.test(fullText)) {
      result.oem = 'Lenovo';
      result.business_unit = 'Hardware';
    } else if (/Fortinet|FortiGate/i.test(fullText)) {
      result.oem = 'Fortinet';
      result.business_unit = 'Hardware';
    }

    const distrMatch = fullText.match(/Distr(?:ibutor)?\s*[=:\-]\s*([^\n\r]+)/i);
    if (distrMatch) result.distributor = distrMatch[1].trim();

    // 9. Totals
    const purchTotMatch = fullText.match(/Purchase\s*Total\s*₹?\s*([0-9,.]+)/i);
    if (purchTotMatch) result.purchase_total = parseFloat(purchTotMatch[1].replace(/,/g, ''));

    const marginTotMatch = fullText.match(/Margin\s*Total\s*₹?\s*([0-9,.]+)/i);
    if (marginTotMatch) result.margin_total = parseFloat(marginTotMatch[1].replace(/,/g, ''));

    const taxTotMatch = fullText.match(/Total\s*Tax\s*₹?\s*([0-9,.]+)/i);
    if (taxTotMatch) result.tax_total = parseFloat(taxTotMatch[1].replace(/,/g, ''));

    const grandTotMatch = fullText.match(/Grand\s*Total\s*₹?\s*([0-9,.]+)/i);
    if (grandTotMatch) result.grand_total = parseFloat(grandTotMatch[1].replace(/,/g, ''));

    if (result.customer_name && !result.subject) {
      result.subject = `${result.customer_name} - ${result.oem || 'Quotation'} Commercials`;
    }

    return result;
  } catch (err) {
    console.error('Local PDF parsing failed:', err);
    return { items: [] };
  }
}
