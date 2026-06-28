import Papa from 'papaparse';

export async function generateCSV(data) {
  const { headers, rows } = data;
  
  const csvData = [];
  if (headers && Array.isArray(headers)) {
    csvData.push(headers);
  }
  if (rows && Array.isArray(rows)) {
    rows.forEach(row => {
      csvData.push(row);
    });
  }
  
  const csv = Papa.unparse(csvData);
  return Buffer.from(csv, 'utf-8');
}

// Function to parse uploaded CSV
export async function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  const result = Papa.parse(text, { header: true });
  return result.data;
}
