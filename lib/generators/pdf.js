import { PDFDocument, rgb } from 'pdf-lib';

export async function generatePDF(data) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  
  const { title, content } = data;
  
  let y = 350;
  
  if (title) {
    page.drawText(title, { x: 50, y, size: 20 });
    y -= 30;
  }
  
  if (content && Array.isArray(content)) {
    content.forEach(line => {
      page.drawText(line, { x: 50, y, size: 12 });
      y -= 18;
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
