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

// ຫຼາຍແຜ່ນໃນໄຟລ໌ດຽວ — ໃຊ້ກັບລາຍງານທີ່ມີສະຫຼຸບ + ລາຍລະອຽດຫຼາຍມຸມ
export async function downloadWorkbookMulti({ fileName, sheets }) {
  const workbook = new ExcelJS.Workbook();
  for (const { name, columns, rows, title } of sheets) {
    const sheet = workbook.addWorksheet(name);
    if (title) {
      sheet.mergeCells(1, 1, 1, Math.max(1, columns.length));
      const cell = sheet.getCell(1, 1);
      cell.value = title;
      cell.font = { bold: true, size: 13 };
      sheet.getRow(2).height = 4;
    }
    const headerRowIndex = title ? 3 : 1;
    sheet.getRow(headerRowIndex).values = columns.map(c => c.header);
    sheet.getRow(headerRowIndex).font = { bold: true };
    columns.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width || 16; });
    rows.forEach((row) => {
      sheet.addRow(columns.map(c => row[c.key] ?? ''));
    });
    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      columns.forEach((c, i) => {
        if (c.numFmt) sheet.getCell(r, i + 1).numFmt = c.numFmt;
      });
    }
    sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
  }
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
