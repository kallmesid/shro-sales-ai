import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function test() {
  const buf = fs.readFileSync('uploads/SHRO_2026-27_001/Cisco_Quote.pdf');
  const data = new Uint8Array(buf);
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  console.log("Pages:", doc.numPages);
  
  let fullText = "";
  for(let i=1; i<=doc.numPages; i++){
     const page = await doc.getPage(i);
     const textContent = await page.getTextContent();
     const items = textContent.items;
     
     // Top to bottom, left to right
     items.sort((a, b) => {
        if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
          return b.transform[5] - a.transform[5]; // Top to bottom
        }
        return a.transform[4] - b.transform[4]; // Left to right
     });
     fullText += items.map(item => item.str.trim()).filter(s => s).join(' ') + "\n";
  }
  console.log("-----TEXT-----");
  console.log(fullText.substring(0, 2000));
}
test();
