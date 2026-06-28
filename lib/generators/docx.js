import mammoth from 'mammoth';

export async function generateDOCX(data) {
  // For DOCX, we create a simple HTML and convert to DOCX
  const { title, content } = data;
  
  let html = '<html><body>';
  if (title) {
    html += `<h1>${title}</h1>`;
  }
  if (content && Array.isArray(content)) {
    content.forEach(para => {
      html += `<p>${para}</p>`;
    });
  }
  html += '</body></html>';
  
  // Since mammoth is for reading DOCX, we'll return the structure
  // For actual DOCX generation in a real app, you'd use docx package
  // Here we return a buffer with basic info
  return Buffer.from(JSON.stringify({ type: 'docx', title, content }));
}

// Function to extract text from uploaded DOCX
export async function extractTextFromDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
