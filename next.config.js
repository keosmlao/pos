/** @type {import('next').NextConfig} */
const nextConfig = {
  // ບ່ອນເກັບຜົນ build — ຕັ້ງ NEXT_DIST_DIR ເພື່ອ build ໃສ່ບ່ອນອື່ນ.
  // ສຳຄັນ: `next build` ທຳມະດາຈະຂຽນທັບ .next ຂອງ `next dev` ທີ່ກຳລັງແລ່ນຢູ່
  // ເຮັດໃຫ້ບາງ route ກາຍເປັນ 404 (ຝັ່ງໜ້າຈໍຈະເຫັນ "Unexpected token '<'")
  // ຈຶ່ງໃຫ້ໃຊ້ `npm run build:check` ຕອນຢາກກວດ build ໂດຍທີ່ dev ຍັງແລ່ນຢູ່
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  allowedDevOrigins: ['10.0.20.180'],
  serverExternalPackages: ['pg'],
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },
};

module.exports = nextConfig;
