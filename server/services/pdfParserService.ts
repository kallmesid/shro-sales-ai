import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ParsedLineItem {
  description: string;
  unit_purchase: number;
  unit_sale: number;
  quantity: number;
  total_purchase: number;
  total_sale: number;
  margin_percentage: number;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedLineItem[]> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });
    
    const doc = await loadingTask.promise;
    let fullTextLines: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group items by vertical position (Y axis) to reconstruct rows
      const items = textContent.items as any[];
      const linesMap = new Map<number, string[]>();

      for (const item of items) {
        if (!item.str || item.str.trim() === '') continue;
        // round Y position to bucket items on the same line
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

    const parsedItems: ParsedLineItem[] = [];

    // Parse each line looking for patterns like:
    // "Cisco Catalyst 9200 48-Port Switch   2   45000.00   90000.00"
    // or "Dell PowerEdge Server Qty: 1 Price: 150000"
    for (const line of fullTextLines) {
      // Clean excessive whitespace
      const cleanLine = line.replace(/\s+/g, ' ').trim();
      
      // Look for numbers at the end of the line or separated by spaces
      // Pattern: Text description followed by numbers (quantity, price)
      const tokens = cleanLine.split(' ');
      if (tokens.length < 2) continue;

      // Extract numeric candidates from the end of tokens
      const numericIndices: { index: number; val: number }[] = [];
      for (let j = 0; j < tokens.length; j++) {
        // Strip currency symbols and commas like $50,000 or ₹1,20,000 or 15000.00
        const cleanNum = tokens[j].replace(/[^0-9.]/g, '');
        if (cleanNum && !isNaN(Number(cleanNum)) && cleanNum.length > 0) {
          numericIndices.push({ index: j, val: parseFloat(cleanNum) });
        }
      }

      if (numericIndices.length >= 2) {
        // We have at least two numbers (could be qty and price, or price and total)
        // Usually, description is everything before the first numeric token or the non-numeric part
        const firstNumIndex = numericIndices[0].index;
        const description = tokens.slice(0, firstNumIndex).join(' ').trim();

        if (description.length >= 3 && !/^(total|subtotal|tax|gst|vat|grand|date|invoice|page)/i.test(description)) {
          let qty = 1;
          let unitPurchase = 0;

          // Detect which is quantity and which is price
          // Typically quantity is smaller (e.g. 1 to 500) and price is larger
          const num1 = numericIndices[0].val;
          const num2 = numericIndices[1].val;

          if (num1 <= 500 && Number.isInteger(num1) && num2 > num1) {
            qty = num1;
            unitPurchase = num2;
          } else if (num2 <= 500 && Number.isInteger(num2) && num1 > num2) {
            qty = num2;
            unitPurchase = num1;
          } else {
            qty = 1;
            unitPurchase = Math.max(num1, num2);
          }

          if (unitPurchase > 0) {
            // Default target markup (e.g. 20% markup on purchase price for sale price estimate)
            const unitSale = Math.round(unitPurchase * 1.25);
            const totalPurchase = unitPurchase * qty;
            const totalSale = unitSale * qty;
            const margin = totalSale > 0 ? ((totalSale - totalPurchase) / totalSale) * 100 : 0;

            parsedItems.push({
              description,
              unit_purchase: unitPurchase,
              unit_sale: unitSale,
              quantity: qty,
              total_purchase: totalPurchase,
              total_sale: totalSale,
              margin_percentage: parseFloat(margin.toFixed(2)),
            });
          }
        }
      }
    }

    return parsedItems;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF document for line items.');
  }
}
