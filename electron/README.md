# SMLAO POS — Windows Desktop App

ແອັບ Windows (Electron) ທີ່ເປີດ POS ເປັນປ່ອງແອັບແທ້ ບໍ່ມີແຖບ browser.
ຖານຂໍ້ມູນ ແລະ server ຍັງແມ່ນສູນກາງເດີມ — ແອັບນີ້ເປັນປະຕູເຊື່ອມຕໍ່ຫາ server.

## ຄວາມສາມາດ

- ເປີດ POS ເຕັມປ່ອງ ມີ icon ໃນ Desktop / Start Menu
- ຕັ້ງ URL ຂອງ server ໄດ້ (ເມນູ POS → ຕັ້ງຄ່າ Server... ຫຼື Ctrl+,)
- Server ດັບ/ຫຼຸດເຄືອຂ່າຍ → ໜ້າແຈ້ງເຕືອນ + ລອງໃໝ່ອັດຕະໂນມັດທຸກ 10 ວິນາທີ
- F11 ເຕັມຈໍ (ເໝາະໜ້າຮ້ານ), Ctrl+/− ຂະຫຍາຍ-ຫຍໍ້, ຈື່ຂະໜາດປ່ອງ
- ເປີດຊ້ອນບໍ່ໄດ້ (single instance) — ກົດ icon ຊ້ຳຈະ focus ປ່ອງເດີມ

## Build installer (.exe) — ເຮັດໃນເຄື່ອງ Windows

> ⚠️ Build .exe ຈາກ Mac Apple Silicon ບໍ່ໄດ້ (electron-builder ຕ້ອງໃຊ້ wine
> ເວີຊັນ Intel ທີ່ບໍ່ຮອງຮັບ) — ໃຫ້ build ໃນເຄື່ອງ Windows ໂດຍກົງ ງ່າຍກວ່າ:

1. ຕິດຕັ້ງ Node.js (LTS) ໃນເຄື່ອງ Windows: https://nodejs.org
2. Copy ໂຟນເດີ `electron/` ນີ້ໄປເຄື່ອງ Windows (ຫຼື clone ທັງ repo)
3. ເປີດ Command Prompt ໃນໂຟນເດີນັ້ນ:

```cmd
npm install
npm run dist          :: ໄດ້ dist\SMLAO POS Setup 1.0.0.exe (installer)
npm run dist:portable :: ຫຼື portable .exe ບໍ່ຕ້ອງຕິດຕັ້ງ
```

ໄຟລ໌ຢູ່ `electron\dist\`. ເອົາ Setup.exe ໄປລົງເຄື່ອງ Windows ແຕ່ລະຈຸດຂາຍ,
ຕິດຕັ້ງແລ້ວເປີດ → ຕັ້ງ URL server ຄັ້ງດຽວ (Ctrl+,) → ໃຊ້ໄດ້ເລີຍ.

ທາງເລືອກ: build ຈາກ Mac ໄດ້ ຖ້າຕິດຕັ້ງ Rosetta ກ່ອນ
(`softwareupdate --install-rosetta`) ແລ້ວແລ່ນ `npm run dist` ຄືນ.

## ທົດສອບໃນເຄື່ອງ dev

```bash
cd electron
npm start   # ເປີດແອັບຊີ້ຫາ http://localhost:3000 (ຄ່າເລີ່ມຕົ້ນ)
```

ຂໍ້ຄວນຮູ້ເມື່ອທົດສອບໃນ Mac ເຄື່ອງນີ້:
- ຖ້າແລ່ນຈາກ terminal ຂອງ VS Code ແລ້ວ error `app.requestSingleInstanceLock` —
  ຕົວແປ `ELECTRON_RUN_AS_NODE` ຕິດມາຈາກ VS Code. ແລ່ນແບບນີ້ແທນ:
  `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`
- ຖ້າ error `Electron failed to install correctly` — binary ຍັງບໍ່ຖືກ extract:
  `cd node_modules/electron && node install.js` (ຫຼື unzip ໄຟລ໌ໃນ ~/Library/Caches/electron ໃສ່ dist/)

## ໝາຍເຫດ

- ຍັງບໍ່ໄດ້ໃສ່ icon ສະເພາະ (ໃຊ້ icon Electron ມາດຕະຖານ) — ຢາກໃສ່ໂລໂກ້ຮ້ານ
  ໃຫ້ເອົາໄຟລ໌ `icon.ico` (256x256) ວາງໃນ `electron/build/` ແລ້ວ build ຄືນ
- ບໍ່ໄດ້ເຊັນ code signing — Windows SmartScreen ອາດເຕືອນຄັ້ງທຳອິດ
  (ກົດ More info → Run anyway)
- ຕັ້ງຄ່າຖືກເກັບທີ່ `%APPDATA%/smlao-pos-desktop/config.json`
