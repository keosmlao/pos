'use client';

import ExcelJS from 'exceljs';

export async function readFirstWorksheet(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values.slice(1).map((value) => {
      if (value == null) return '';
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      if (typeof value === 'object') return value.text ?? value.result ?? String(value);
      return value;
    }));
  });
  return rows;
}

export function rowsToObjects(rows) {
  const headers = (rows[0] || []).map((value) => String(value || ''));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

export async function downloadWorkbook({ sheetName, fileName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
