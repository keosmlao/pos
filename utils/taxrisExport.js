'use client';

// ສ້າງໄຟລ໌ Excel "ລາຍງານ TAXRIS" ຕາມ template ຂອງກົມສ່ວຍສາອາກອນ
//
// ໂຄງສ້າງ (15 ຄໍລຳ A..O):
//   A  ລຳດັບ No.
//   B  TIN            ← ວ່າງ/NULL ໃຫ້ໃສ່ 999999999999
//   C  ຊື່ Name
//   D  ເລກທີ No.      ← ຕັດຂີດອອກ (INV20260800007)
//   E  ວັນທີ Dated    ← DDMMYYYY ເປັນຂໍ້ຄວາມ
//   F  ເນື້ອໃນລາຍການ Description.
//   G..K  ລາຍຮັບທີ່ຍົກເວັ້ນ / ບໍ່ຫັກເກັບ / ອັດຕາ 0%  (ຮ້ານຂາຍໃນ ອມພ 10% ຈຶ່ງວ່າງ)
//   L  ຫັກ ອັດຕາ 10% · ພາຍໃນ         ← ມູນຄ່າກ່ອນ ອມພ
//   M  ຫັກ ອັດຕາ 10% · ຂາເຂົ້າ/ຂາອອກ  (ວ່າງ)
//   N  ລວມ            = L + M
//   O  ອມພ ທີ່ເກັບໄດ້ທັງໝົດ = N × 10%
//
// ສີ: ເຫຼືອງ = ຊ່ອງທີ່ຕ້ອງປ້ອນ · ຂຽວ = ຊ່ອງທີ່ຄິດໄລ່ອອກມາເອງ

import ExcelJS from 'exceljs';

const YELLOW = 'FFFFFF00';
const GREEN = 'FF92D050';
const COLS = 15;                       // A..O
const LAST_COL = 'O';

const NOTE = '※ ຄໍລຳສີເຫຼືອງ ແມ່ນ ຂໍ້ມູນຈຳເປັນທີ່ຕ້ອງປ້ອນຕາມທີ່ລະບົບຕ້ອງການ, ສ່ວນຄໍລຳສີຂຽວແມ່ນລະບົບຈະຄິດໄລ່ໃຫ້ເອງ.';

const thin = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

function fill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function styleHeader(sheet, ref, { text, color = YELLOW, merge = false } = {}) {
  if (merge) sheet.mergeCells(ref);
  const cell = sheet.getCell(merge ? ref.split(':')[0] : ref);
  cell.value = text;
  cell.font = { bold: true, size: 10 };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = BORDER;
  fill(cell, color);
  return cell;
}

/**
 * ສ້າງ workbook ຕາມ template — ແຍກອອກມາຕ່າງຫາກ ຈຶ່ງທົດສອບໄດ້ໂດຍບໍ່ຕ້ອງມີ browser
 * @param {Array} rows [{ tin, name, billNumber, date, description, beforeVat, vatAmount }]
 */
export function buildTaxrisWorkbook(rows = []) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('TAXRIS');

  const widths = [6, 18, 28, 20, 12, 34, 11, 13, 11, 11, 13, 13, 13, 14, 16];
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  // ── ແຖວໝາຍເຫດ ─────────────────────────────────────────────────
  sheet.mergeCells(`A1:${LAST_COL}1`);
  const note = sheet.getCell('A1');
  note.value = NOTE;
  note.font = { bold: true, size: 10 };
  note.alignment = { vertical: 'middle', horizontal: 'left' };

  // ── ຫົວຕາຕະລາງ 3 ຊັ້ນ (ແຖວ 2-4) ─────────────────────────────────
  styleHeader(sheet, 'A2:A4', { text: 'ລຳດັບ\nNo.', merge: true });
  styleHeader(sheet, 'B2:C2', { text: 'ຂໍ້ມູນຜູ້ຊື້ ການສະໜອງ', merge: true });
  styleHeader(sheet, 'B3:B4', { text: 'TIN (max: 12)', merge: true });
  styleHeader(sheet, 'C3:C4', { text: 'ຊື່ Name (max: 500 byte)', merge: true });
  styleHeader(sheet, 'D2:E2', { text: 'ໃບເກັບເງິນ', merge: true });
  styleHeader(sheet, 'D3:D4', { text: 'ເລກທີ\nNo.', merge: true });
  styleHeader(sheet, 'E3:E4', { text: 'ວັນທີ\nDated', merge: true });
  styleHeader(sheet, 'F2:F4', { text: 'ເນື້ອໃນລາຍການ\nDescription.', merge: true });
  styleHeader(sheet, 'G2:N2', { text: 'ລາຍຮັບ', merge: true });
  styleHeader(sheet, 'G3:H3', { text: 'ຫັກຍົກເວັ້ນ', merge: true });
  styleHeader(sheet, 'I3:I4', { text: 'ບໍ່ຫັກເກັບ\nອມພ', merge: true });
  styleHeader(sheet, 'J3:K3', { text: 'ຫັກ ອັດຕາ 0%', merge: true });
  styleHeader(sheet, 'L3:N3', { text: 'ຫັກ ອັດຕາ 10%', merge: true });
  styleHeader(sheet, 'G4', { text: 'ພາຍໃນ' });
  styleHeader(sheet, 'H4', { text: 'ຂາເຂົ້າ/ຂາອອກ' });
  styleHeader(sheet, 'J4', { text: 'ພາຍໃນ' });
  styleHeader(sheet, 'K4', { text: 'ຂາເຂົ້າ/ຂາອອກ' });
  styleHeader(sheet, 'L4', { text: 'ພາຍໃນ' });
  styleHeader(sheet, 'M4', { text: 'ຂາເຂົ້າ/ຂາອອກ' });
  styleHeader(sheet, 'N4', { text: 'ລວມ', color: GREEN });
  styleHeader(sheet, 'O2:O4', { text: 'ອມພ ທີ່ເກັບໄດ້\nທັງໝົດ', merge: true, color: GREEN });

  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 28;

  // ── ແຖວເລກຄໍລຳ (ແຖວ 5) ────────────────────────────────────────
  styleHeader(sheet, 'A5', { text: '' });
  styleHeader(sheet, 'B5:C5', { text: '1', merge: true });
  ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].forEach((label, i) => {
    styleHeader(sheet, `${String.fromCharCode(68 + i)}5`, { text: label });   // D..M
  });
  styleHeader(sheet, 'N5', { text: '12=10+11', color: GREEN });
  styleHeader(sheet, 'O5', { text: '13=12*10', color: GREEN });

  // ── ຂໍ້ມູນ (ເລີ່ມແຖວ 6) ─────────────────────────────────────────
  const FIRST_DATA_ROW = 6;
  rows.forEach((r, i) => {
    const rowIndex = FIRST_DATA_ROW + i;
    const row = sheet.getRow(rowIndex);
    row.values = [
      i + 1,
      r.tin,                 // ຂໍ້ຄວາມ — ຮັກສາເລກ 0 ຂ້າງໜ້າ
      r.name,
      r.billNumber,
      r.date,                // DDMMYYYY ເປັນຂໍ້ຄວາມ
      r.description,
      '', '', '', '', '',    // G..K
      Math.round(Number(r.beforeVat) || 0),   // L
      '',                                      // M
      Math.round(Number(r.beforeVat) || 0),   // N = L + M
      Math.round(Number(r.vatAmount) || 0),   // O
    ];
    for (let c = 1; c <= COLS; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER;
      cell.font = { size: 10 };
      if (c === 1) cell.alignment = { horizontal: 'center' };
      if (c === 2 || c === 4 || c === 5) cell.alignment = { horizontal: 'left' };
      if (c >= 7) cell.numFmt = '#,##0';
    }
    // ບັງຄັບໃຫ້ TIN / ເລກທີ / ວັນທີ ເປັນຂໍ້ຄວາມ ບໍ່ໃຫ້ Excel ແປງເປັນຕົວເລກ
    [2, 4, 5].forEach(c => { row.getCell(c).numFmt = '@'; });
  });

  sheet.views = [{ state: 'frozen', ySplit: 5 }];
  return workbook;
}

/**
 * @param {object} opts
 * @param {string} opts.fileName
 * @param {Array}  opts.rows
 */
export async function downloadTaxrisWorkbook({ fileName, rows = [] }) {
  const workbook = buildTaxrisWorkbook(rows);
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
