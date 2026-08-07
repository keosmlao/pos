# SMLAO POS — ແອັບ Windows (.NET + WebView2)

ແອັບໜ້າຂາຍສຳລັບເຄື່ອງຈຸດຂາຍ Windows. **ມີແຕ່ໜ້າ POS** — ຫຼັງບ້ານ (`/admin`)
ເປີດຈາກແອັບນີ້ບໍ່ໄດ້ ໃຫ້ໄປໃຊ້ browser ແທນ.

ຕ່າງຈາກ `electron/` ຢູ່ 3 ຢ່າງ: **build ຈາກ Mac ໄດ້**, ໄຟລ໌ນ້ອຍກວ່າ,
ແລະ ມີ **ຖານຂໍ້ມູນ SQLite ໃນເຄື່ອງ** ສຳລັບພັກບິນຕອນເນັດຫຼຸດ.

## Build

```bash
bash windows-app/build.sh standalone   # ໄຟລ໌ດຽວ ~67MB ບໍ່ຕ້ອງຕິດຕັ້ງຫຍັງເພີ່ມ
bash windows-app/build.sh              # ~4MB ແຕ່ເຄື່ອງປາຍທາງຕ້ອງມີ .NET 8 Desktop Runtime
```

ແລ່ນໄດ້ຈາກ **macOS / Linux / Windows** ຄືກັນ (ບໍ່ຕ້ອງໃຊ້ wine ຄື Electron).
ຖ້າຍັງບໍ່ມີ .NET SDK:

```bash
curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0
```

ໄດ້ໄຟລ໌ `windows-app/out-standalone/SMLAO POS.exe` → ເອົາໄປວາງເຄື່ອງ Windows
ແລ້ວເປີດໄດ້ເລີຍ (ຫຼືອັບຂຶ້ນໜ້າ `/admin/download` ໃຫ້ເຄື່ອງອື່ນດາວໂຫຼດ).

> ເຄື່ອງປາຍທາງຕ້ອງມີ **WebView2 Runtime** ເຊິ່ງມີມາໃນ Windows 10/11 ຢູ່ແລ້ວ.
> ຖ້າເປັນ Windows ເກົ່າ ໃຫ້ຕິດຕັ້ງຈາກ https://go.microsoft.com/fwlink/p/?LinkId=2124703

## ຄຸນສົມບັດ

| | |
|---|---|
| ໜ້າຂາຍເຕັມຈໍ | F11 · ຈື່ຂະໜາດ/ຕຳແໜ່ງ/ສະຖານະເຕັມຈໍ |
| ຕັ້ງຄ່າ | `Ctrl+,` — URL server, printer, COM port ຂອງລີ້ນຊັກ |
| ພິມບິນອັດຕະໂນມັດ | WebView2 `PrintAsync` ໄປ printer ທີ່ເລືອກ ບໍ່ຖາມ |
| ໜ້າຈໍລູກຄ້າ | ເປີດເປັນປ່ອງປົກກະຕິ (ບໍ່ຖືກສັ່ງພິມ) |
| ລີ້ນຊັກເງິນ | ຜ່ານ COM port ໂດຍກົງ ບໍ່ຕ້ອງຂໍສິດຄື Web Serial |
| ຫຼັງບ້ານ | ບລັອກ — ແອັບນີ້ເປັນໜ້າຂາຍຢ່າງດຽວ |
| ເນັດຫຼຸດ | ຫ້າມໂຫຼດໜ້າໃໝ່ (ຈະເຕືອນ) ຈຶ່ງຂາຍຕໍ່ໄດ້; ໜ້າ offline ມີປຸ່ມລອງໃໝ່ |
| ບິນຄ້າງ | ເກັບລົງ SQLite ທຸກ 5 ວິ + ເຕືອນຕອນປິດແອັບຖ້າຍັງມີຄ້າງ |

## ຖານຂໍ້ມູນໃນເຄື່ອງ

`%APPDATA%\SMLAO POS\pos-local.db` (SQLite)

| ຕາຕະລາງ | ໃຊ້ເຮັດຫຍັງ |
|---|---|
| `offline_orders` | ບິນທີ່ຂາຍຕອນເນັດຫຼຸດ — `status` = `pending` / `synced` |
| `parked_carts` | ກະຕ່າທີ່ພັກໄວ້ຊົ່ວຄາວ |

ໜ້າ POS ຍັງໃຊ້ localStorage ຄືເກົ່າ (ຈຶ່ງໃຊ້ໄດ້ທັງໃນ browser) — ແອັບນີ້
**ສຳເນົາຄິວລົງຖານຂໍ້ມູນທຸກ 5 ວິນາທີ** ແລະ **ກູ້ຄືນໃສ່ localStorage ຕອນເປີດແອັບ**
ຖ້າໂປຣໄຟລ໌ WebView2 ຖືກລ້າງ ຫຼື ເຄື່ອງດັບກະທັນຫັນ. ບິນຈຶ່ງບໍ່ຫາຍ.

ຄ່າຕັ້ງຢູ່ `%APPDATA%\SMLAO POS\config.json` (ຮູບແບບດຽວກັນກັບແອັບ Electron).

## ໂຄງສ້າງ code

| ໄຟລ໌ | ໜ້າທີ່ |
|---|---|
| `App.xaml.cs` | ເປີດແອັບ, single instance, WebView2 environment |
| `ShellWindow.xaml.cs` | ປ່ອງໜ້າຂາຍ, ບລັອກ /admin, ໜ້າ offline, ສຳເນົາຄິວລົງ DB |
| `PopupWindow.xaml.cs` | ປ່ອງລູກ: ບິນ (ພິມທັນທີ) / ໜ້າຈໍລູກຄ້າ |
| `SettingsWindow.xaml.cs` | ໜ້າຕັ້ງຄ່າ |
| `LocalStore.cs` | SQLite: ບິນ offline + ກະຕ່າພັກ |
| `DrawerBridge.cs` | ລີ້ນຊັກຜ່ານ serial (ໜ້າເວັບເອີ້ນ `hostObjects.drawer.Kick()`) |
| `OfflinePage.cs` | HTML ໜ້າ offline ທີ່ຝັງໃນ .exe |
