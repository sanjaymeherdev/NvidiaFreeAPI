import { generateXLSX } from '../../../lib/generators/xlsx.js';
import { generatePDF } from '../../../lib/generators/pdf.js';
import { generatePPTX } from '../../../lib/generators/pptx.js';
import { generateDOCX } from '../../../lib/generators/docx.js';
import { generateCSV } from '../../../lib/generators/csv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { mode, data } = req.body;
  
  try {
    let buffer;
    let mimeType;
    let extension;

    switch (mode) {
      case 'excel':
        buffer = await generateXLSX(data);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'pdf':
        buffer = await generatePDF(data);
        mimeType = 'application/pdf';
        extension = 'pdf';
        break;
      case 'ppt':
        buffer = await generatePPTX(data);
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        extension = 'pptx';
        break;
      case 'doc':
        buffer = await generateDOCX(data);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extension = 'docx';
        break;
      case 'csv':
        buffer = await generateCSV(data);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      default:
        return res.status(400).json({ error: 'Invalid mode' });
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="output.${extension}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
}
