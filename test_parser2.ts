import fs from 'fs';
import { parseCostSheetFromPdf } from './server/services/pdfParserService.ts';

async function test() {
  const buf = fs.readFileSync('uploads/SHRO_2026-27_001/Cisco_Quote.pdf');
  const res = await parseCostSheetFromPdf(buf);
  console.log(JSON.stringify(res.items, null, 2));
}
test().catch(console.error);
