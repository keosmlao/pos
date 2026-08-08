// ແປງຄ່າທີ່ເກັບໄວ້ໃນຖານຂໍ້ມູນໃຫ້ເປັນ URL ທີ່ເປີດໄດ້
//
// ຂໍ້ມູນເກົ່າເກັບໄວ້ 2 ແບບປົນກັນ:
//   'invoice_1776421701617.jpg'   ← ຊື່ໄຟລ໌ລ້າໆ (ເປີດບໍ່ໄດ້ ເພາະ browser ຄິດວ່າເປັນ path ຍ່ອຍ)
//   '/uploads/invoice_....jpg'    ← path ເຕັມ (ຖືກຕ້ອງ)
// ຟັງຊັນນີ້ຮັບໄດ້ທັງສອງແບບ ຈຶ່ງເປີດເອກະສານເກົ່າໄດ້ໂດຍບໍ່ຕ້ອງແກ້ຂໍ້ມູນ

export function fileUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw)) return raw;   // URL ພາຍນອກ
  if (raw.startsWith('/')) return raw;            // path ເຕັມຢູ່ແລ້ວ
  return `/uploads/${raw}`;                       // ຊື່ໄຟລ໌ລ້າໆ
}

export function isImageFile(value) {
  return /\.(png|jpe?g|gif|webp|bmp|heic|avif)(\?|#|$)/i.test(String(value || ''));
}

export function isPdfFile(value) {
  return /\.pdf(\?|#|$)/i.test(String(value || ''));
}
