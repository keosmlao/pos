// ກວດວ່າໂປຣເຈັກ build ຜ່ານບໍ່ ໂດຍບໍ່ໄປລົບກວນ `next dev` ທີ່ກຳລັງແລ່ນຢູ່
//
// `next build` ທຳມະດາຂຽນທັບໂຟນເດີ .next ອັນດຽວກັບທີ່ dev server ໃຊ້ຢູ່
// ພໍຂຽນທັບແລ້ວ manifest ຂອງ dev ຈະເພ້ຍ ບາງ route ກາຍເປັນ 404 ສົ່ງ HTML ກັບມາ
// ແລ້ວຝັ່ງໜ້າຈໍທີ່ເອີ້ນ res.json() ຈະຟ້ອງ: Unexpected token '<', "<!DOCTYPE "...
//
// ສະນັ້ນສະຄຣິບນີ້ບັງຄັບໃຫ້ build ລົງ .next-verify ແທນ (ອ່ານໂດຍ next.config.js)

import { spawn } from 'node:child_process';

const distDir = process.env.NEXT_DIST_DIR || '.next-verify';
const child = spawn('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: distDir },
});

child.on('exit', (code) => process.exit(code ?? 1));
