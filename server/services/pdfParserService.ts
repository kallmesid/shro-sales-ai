import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GoogleGenAI } from '@google/genai';

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
 * Extract all text lines from PDF using pdfjsLib
 */
async function extractRawTextFromPdf(buffer: Buffer): Promise<{ fullText: string; lines: string[] }> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });
    
    const doc = await loadingTask.promise;
    const fullTextLines: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group items by vertical position (Y axis) to reconstruct rows
      const items = textContent.items as any[];
      const linesMap = new Map<number, string[]>();

      for (const item of items) {
        if (!item.str || item.str.trim() === '') continue;
        // Round Y position to bucket items on the same line (within 4px)
        const y = Math.round(item.transform[5] / 4) * 4;
        if (!linesMap.has(y)) {
          linesMap.set(y, []);
        }
        linesMap.get(y)!.push(item.str);
      }

      // Sort Y descending (top of page to bottom)
      const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
      for (const y of sortedY) {
        const line = linesMap.get(y)!.join(' ').trim();
        if (line) {
          fullTextLines.push(line);
        }
      }
    }

    return {
      fullText: fullTextLines.join('\n'),
      lines: fullTextLines,
    };
  } catch (err) {
    console.warn('extractRawTextFromPdf encountered an error:', err);
    return { fullText: '', lines: [] };
  }
}

/**
 * Dual-Engine PDF Cost Sheet Extractor:
 * 1. Uses Gemini Multimodal / Text API if GEMINI_API_KEY is configured.
 * 2. Falls back to deep deterministic regex extraction if Gemini is unavailable or errors.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedLineItem[]> {
  const fullResult = await parseCostSheetFromPdf(buffer);
  return fullResult.items;
}

export async function parseCostSheetFromPdf(buffer: Buffer): Promise<ParsedCostSheetData> {
  const { lines, fullText } = await extractRawTextFromPdf(buffer);

  // First attempt: Gemini AI Parsing
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `You are an expert procurement and cost sheet document parser for SHRO Systems Pvt. Ltd. (IT infrastructure and enterprise solutions provider).
Analyze this cost sheet / quotation document and extract ALL fields into a JSON object matching this schema:
{
  "cs_number": "Quotation No or Cost sheet number (e.g. SS/2026-27/1141, SS/2026-27/1158)",
  "quotation_date": "Quotation Date (DD/MM/YYYY or YYYY-MM-DD)",
  "valid_until": "Valid Until date",
  "customer_name": "Exact BILL TO company name (e.g. Bajaj Auto Limited, Automotive Stampings & Assemblies Ltd., Principal Global services, ADVIK HI-TECH PVT. LTD)",
  "customer_address": "Full billing / delivery address if given under Addr",
  "subject": "Concise deal summary subject based on products quoted (e.g. 'HP ScanJet & CarePack Commercials', 'Server AMC - HPE DL380 Gen10', 'HP LaserJet Enterprise MFP & Accessories')",
  "oem": "Primary OEM/Brand (HP, HPE, Cisco, Dell, Lenovo, Fortinet, Samsung, etc.)",
  "distributor": "Distributor name if given (Savex, HPE, Redington, Ingram Micro, etc.)",
  "business_unit": "Hardware, Services / AMC, Peripherals, Software, or Rental",
  "prepared_by_name": "Sales representative name under Prepared By (e.g. Raju Shinde, Chandan Khatri)",
  "prepared_by_phone": "Salesperson phone number",
  "prepared_by_email": "Salesperson email address",
  "terms_and_conditions": "All terms and conditions text, Deal IDs, notes",
  "payment_terms": "All payment terms, delivery period, taxes and freight notes",
  "purchase_total": number (total purchase price),
  "margin_total": number (total margin value),
  "tax_total": number (total tax amount),
  "grand_total": number (grand total value),
  "items": [
    {
      "sr_no": number (1, 2, 3...),
      "category": "Category if shown (e.g. Printer, CarePack, Accessories, Toner, AMC, Rental Charges, Server, Storage)",
      "description": "Full complete description including part numbers, model specifications, warranty terms",
      "unit_purchase": number (Purchase Price per unit),
      "quantity": number (Qty),
      "uom": "Unit of measurement like Box, Each, Pack",
      "margin_percentage": number (Margin % e.g. 9.68, 18, 40),
      "margin_value": number (Margin Value),
      "unit_sale": number (Sales Prices / unit sale price),
      "sub_total": number (Sub-Total),
      "tax_description": "e.g. CGST @9% + SGST @9% or IGST @18%",
      "tax_amount": number,
      "total": number (Total price including tax)
    }
  ]
}

Document Raw Text for reference:
"""
${fullText.slice(0, 15000)}
"""

Ensure all numeric amounts are pure numbers without currency symbols (₹) or commas.
Return strictly valid JSON only.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf',
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        // Normalize items
        const normalizedItems: ParsedLineItem[] = parsed.items.map((it: any, idx: number) => {
          const qty = Number(it.quantity) || 1;
          const unitPurchase = Number(it.unit_purchase) || 0;
          const unitSale = Number(it.unit_sale) || (unitPurchase > 0 ? unitPurchase : 0);
          const totalPurchase = unitPurchase * qty;
          const totalSale = Number(it.sub_total) || (unitSale * qty);
          const margin = it.margin_percentage !== undefined 
            ? Number(it.margin_percentage) 
            : (totalSale > 0 ? ((totalSale - totalPurchase) / totalSale) * 100 : 0);

          return {
            sr_no: it.sr_no || (idx + 1),
            category: it.category || '',
            description: it.description || `Item ${idx + 1}`,
            unit_purchase: unitPurchase,
            unit_sale: unitSale,
            quantity: qty,
            uom: it.uom || 'Box',
            total_purchase: totalPurchase,
            total_sale: totalSale,
            margin_percentage: parseFloat(margin.toFixed(2)),
            margin_value: it.margin_value ? Number(it.margin_value) : (totalSale - totalPurchase),
            tax_description: it.tax_description || '',
            tax_amount: it.tax_amount ? Number(it.tax_amount) : 0,
            total: it.total ? Number(it.total) : totalSale,
          };
        });

        return {
          cs_number: parsed.cs_number || '',
          quotation_date: parsed.quotation_date || '',
          valid_until: parsed.valid_until || '',
          customer_name: parsed.customer_name || '',
          customer_address: parsed.customer_address || '',
          subject: parsed.subject || `${parsed.customer_name || 'Quotation'} - Deal Proposal`,
          oem: parsed.oem || 'HP',
          distributor: parsed.distributor || 'Savex',
          business_unit: parsed.business_unit || 'Hardware',
          prepared_by_name: parsed.prepared_by_name || '',
          prepared_by_phone: parsed.prepared_by_phone || '',
          prepared_by_email: parsed.prepared_by_email || '',
          terms_and_conditions: parsed.terms_and_conditions || '',
          payment_terms: parsed.payment_terms || '',
          purchase_total: Number(parsed.purchase_total) || 0,
          margin_total: Number(parsed.margin_total) || 0,
          tax_total: Number(parsed.tax_total) || 0,
          grand_total: Number(parsed.grand_total) || 0,
          items: normalizedItems,
        };
      }
    } catch (geminiError) {
      console.warn('Gemini PDF parsing encountered an issue, falling back to deterministic parser:', geminiError);
    }
  }

  // Fallback: Deterministic Text & Regex Structure Extractor
  return parseDeterministicPdf(lines, fullText);
}

/**
 * Deterministic fallback parser analyzing PDF text lines
 */
function parseDeterministicPdf(lines: string[], fullText: string): ParsedCostSheetData {
  const result: ParsedCostSheetData = {
    items: [],
  };

  // 1. Quotation No (e.g. Quotation No : SS/2026-27/1141)
  const quoteNoMatch = fullText.match(/Quotation\s*(?:No|#|\.)?\s*:\s*([A-Za-z0-9\/-]+)/i) ||
                       fullText.match(/Cost\s*Sheet\s*(?:No|#|\.)?\s*:\s*([A-Za-z0-9\/-]+)/i) ||
                       fullText.match(/Ref\s*(?:No|#|\.)?\s*:\s*([A-Za-z0-9\/-]+)/i);
  if (quoteNoMatch) result.cs_number = quoteNoMatch[1].trim();

  // 2. Quotation Date (e.g. Quotation Date : 15/09/2026)
  const dateMatch = fullText.match(/Quotation\s*Date\s*:\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i) ||
                    fullText.match(/Date\s*:\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i);
  if (dateMatch) result.quotation_date = dateMatch[1].trim();

  // 3. Valid Until
  const validMatch = fullText.match(/Valid\s*Until\s*:\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i) ||
                     fullText.match(/Validity\s*:\s*([^\n\r]+)/i);
  if (validMatch) result.valid_until = validMatch[1].trim();

  // 4. BILL TO / Customer Name
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

  // 6. Prepared By
  const prepMatch = fullText.match(/Prepared\s*By,?\s*([^\n\r,]+)/i) ||
                    fullText.match(/Account\s*Manager\s*:\s*([^\n\r,]+)/i);
  if (prepMatch) result.prepared_by_name = prepMatch[1].trim();

  const phoneMatch = fullText.match(/(?:Prepared\s*By[\s\S]*?)(\b[6-9]\d{9}\b)/i) ||
                     fullText.match(/Mobile\s*:\s*(\+?91[\-\s]?[6-9]\d{9}|\b[6-9]\d{9}\b)/i);
  if (phoneMatch) result.prepared_by_phone = phoneMatch[1].trim();

  const emailMatch = fullText.match(/([a-zA-Z0-9._%+-]+@shrosystems\.com)/i) ||
                     fullText.match(/Email\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) result.prepared_by_email = emailMatch[1].trim();

  // 7. Terms & Payment Terms
  const termsMatch = fullText.match(/TERMS\s*AND\s*CONDITIONS\s*([^]+?)(?=PAYMENTS?\s*TERMS|Prepared\s*By|$)/i);
  if (termsMatch) result.terms_and_conditions = termsMatch[1].trim();

  const payTermsMatch = fullText.match(/PAYMENTS?\s*TERMS\s*([^]+?)(?=Prepared\s*By|$)/i) ||
                        fullText.match(/Payment\s*:\s*([^\n\r]+)/i);
  if (payTermsMatch) result.payment_terms = payTermsMatch[1].trim();

  // 8. Distributor and OEM detection
  const distrMatch = fullText.match(/Distr(?:ibutor)?\s*[=:\-]\s*([^\n\r]+)/i);
  if (distrMatch) result.distributor = distrMatch[1].trim();

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

  // 9. Totals
  const purchTotMatch = fullText.match(/Purchase\s*Total\s*₹?\s*([0-9,.]+)/i);
  if (purchTotMatch) result.purchase_total = parseFloat(purchTotMatch[1].replace(/,/g, ''));

  const marginTotMatch = fullText.match(/Margin\s*Total\s*₹?\s*([0-9,.]+)/i);
  if (marginTotMatch) result.margin_total = parseFloat(marginTotMatch[1].replace(/,/g, ''));

  const taxTotMatch = fullText.match(/Total\s*Tax\s*₹?\s*([0-9,.]+)/i);
  if (taxTotMatch) result.tax_total = parseFloat(taxTotMatch[1].replace(/,/g, ''));

  const grandTotMatch = fullText.match(/Grand\s*Total\s*₹?\s*([0-9,.]+)/i);
  if (grandTotMatch) result.grand_total = parseFloat(grandTotMatch[1].replace(/,/g, ''));

  // 10. Extract Items from lines
  const parsedItems: ParsedLineItem[] = [];
  let itemCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Look for lines that start with row number or table data
    if (/^[0-9]+\s+[A-Za-z]/.test(line) || (/₹/i.test(line) && /[0-9]+\.[0-9]{2}/.test(line))) {
      // Extract all numbers
      const numMatches = Array.from(line.matchAll(/₹?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*(%|Box|Each|Pack|Nos)?/gi));
      const numbers = numMatches
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(n => !isNaN(n));

      if (numbers.length >= 2) {
        // Clean description
        let desc = line
          .replace(/^[0-9]+\s+/, '')
          .replace(/₹?\s*[0-9,.]+\s*(?:%|Box|Each|Pack|Nos|CGST|SGST|IGST)?/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (desc.length > 3 && !/^(Purchase|Margin|Total|Grand|TERMS|PAYMENTS|BILL)/i.test(desc)) {
          let unitPurchase = numbers[0] || 0;
          let qty = 1;
          let unitSale = numbers.length > 2 ? numbers[numbers.length - 2] : unitPurchase * 1.15;

          // Check if one of the numbers is 1, 10, 15 (integer quantity)
          const qtyCandidate = numbers.find(n => n >= 1 && n <= 1000 && Number.isInteger(n) && n !== unitPurchase);
          if (qtyCandidate) qty = qtyCandidate;

          const totalPurchase = unitPurchase * qty;
          const totalSale = unitSale * qty;
          const margin = totalSale > 0 ? ((totalSale - totalPurchase) / totalSale) * 100 : 0;

          parsedItems.push({
            sr_no: itemCounter++,
            description: desc,
            unit_purchase: unitPurchase,
            unit_sale: unitSale,
            quantity: qty,
            uom: 'Box',
            total_purchase: totalPurchase,
            total_sale: totalSale,
            margin_percentage: parseFloat(margin.toFixed(2)),
          });
        }
      }
    }
  }

  result.items = parsedItems;
  if (!result.subject && result.customer_name) {
    result.subject = `${result.customer_name} - ${result.oem || 'Hardware'} Commercials`;
  }

  return result;
}
