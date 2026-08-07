# ເປີດ POS ເປັນແອັບໃນ Windows ໂດຍບໍ່ຕ້ອງ build

ທາງເລືອກນອກຈາກແອັບ Electron (`electron/`) — ໃຊ້ browser ທີ່ມີໃນເຄື່ອງຢູ່ແລ້ວ
ເປີດແບບ `--app=` ຈຶ່ງບໍ່ມີແຖບ browser ແລະ ບໍ່ມີ address bar (ຄືແອັບແທ້).

## ວິທີໃຊ້

double-click `create-pos-shortcut.cmd` → ປ້ອນ URL ຂອງ server → ໄດ້ icon
"SMLAO POS" ຢູ່ Desktop.

## ໄດ້ຫຍັງ / ບໍ່ໄດ້ຫຍັງ (ທຽບກັບແອັບ Electron)

| | shortcut ນີ້ | ແອັບ Electron |
|---|---|---|
| ຕ້ອງ build | ❌ ບໍ່ຕ້ອງ | ✅ ຕ້ອງມີເຄື່ອງ Windows |
| ປ່ອງແອັບ ບໍ່ມີແຖບ browser | ✅ | ✅ |
| ພິມບິນບໍ່ຖາມ | ✅ `--kiosk-printing` (ໄປ printer ຄ່າເລີ່ມຕົ້ນ) | ✅ ເລືອກ printer ໄດ້ໃນແອັບ |
| ລີ້ນຊັກ serial | ✅ ແຕ່ຕ້ອງເລືອກ port ຄັ້ງທຳອິດ | ✅ ຈື່ port ໃຫ້ອັດຕະໂນມັດ |
| ຕັ້ງ URL server ໃນແອັບ | ❌ ຢູ່ໃນ shortcut | ✅ Ctrl+, |
| ໜ້າແຈ້ງເຕືອນຕອນເນັດຫຼຸດ | ❌ ໜ້າ error ຂອງ browser | ✅ ໜ້າ offline + retry ເອງ |
| ກັນໂຫຼດໜ້າໃໝ່ຕອນ offline | ❌ ກົດ F5 ແລ້ວໜ້າ POS ຫາຍ | ✅ ເຕືອນກ່ອນ |
| ປ່ອງໜ້າຂາຍແຍກ / ລັອກບໍ່ໃຫ້ເຂົ້າ admin | ❌ | ✅ |

## ໝາຍເຫດ

- `--kiosk-printing` ພິມໄປ **printer ຄ່າເລີ່ມຕົ້ນ** ຂອງ Windows ສະເໝີ —
  ຕັ້ງ printer ບິນ 80mm ເປັນຄ່າເລີ່ມຕົ້ນກ່ອນໃຊ້
- ໃຊ້ໂປຣໄຟລ໌ແຍກ (`%LOCALAPPDATA%\SMLAO-POS-Profile`) ຈຶ່ງບໍ່ປົນກັບ browser
  ທີ່ພະນັກງານໃຊ້ທົ່ວໄປ ແລະ ສິດ printer/serial ຄ້າງຢູ່ຖາວອນ
- ຢາກປ່ຽນ URL server → ຄລິກຂວາທີ່ shortcut → Properties → ແກ້ໃນຊ່ອງ Target
  (ຫຼືແລ່ນ `create-pos-shortcut.cmd` ໃໝ່)
