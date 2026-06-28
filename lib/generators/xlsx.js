import ExcelJS from 'exceljs';

export async function generateXLSX(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  if (data.headers && Array.isArray(data.headers)) {
    worksheet.addRow(data.headers);
  }

  if (data.rows && Array.isArray(data.rows)) {
    data.rows.forEach(row => {
      worksheet.addRow(row);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
