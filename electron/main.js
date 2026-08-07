// SMLAO POS — Windows desktop shell
// ເປັນປ່ອງເປີດຫາ server POS (Next.js) ທີ່ຕັ້ງ URL ໄດ້ — ຖານຂໍ້ມູນຍັງຢູ່ສູນກາງ
const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_URL = 'http://localhost:3000';
let win = null;       // ປ່ອງຫຼັກ (admin / ທົ່ວໄປ)
let posWin = null;    // ປ່ອງໜ້າຂາຍ (cashier) — ແຍກຕ່າງຫາກ
let settingsWin = null;

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}
function saveConfig(next) {
  try { fs.writeFileSync(configPath(), JSON.stringify(next, null, 2)); } catch {}
}
const getServerUrl = () => String(loadConfig().serverUrl || DEFAULT_URL);

const alive = (w) => !!w && !w.isDestroyed();

// ເສັ້ນທາງໃນ server: /admin = ຫຼັງບ້ານ, /customer = ໜ້າຈໍລູກຄ້າ
function pathOf(url) {
  try { return new URL(url).pathname; } catch { return ''; }
}
const isAdminUrl = (url) => pathOf(url).startsWith('/admin');
const isCustomerDisplay = (url) => pathOf(url) === '/customer';

function showOffline(target) {
  if (!alive(target)) return;
  target.loadFile(path.join(__dirname, 'offline.html'));
}

// ປ່ອງນີ້ຄ້າງຢູ່ໜ້າ offline ບໍ່ (offline.html ໂຫຼດຈາກໄຟລ໌ ບໍ່ແມ່ນ server)
const isOffline = (w) => alive(w) && w.webContents.getURL().startsWith('file://');

// ປ່ອງໃດເຄີຍໂຫຼດໜ້າ POS ສຳເລັດແລ້ວແດ່ — ໃຊ້ຕັດສິນວ່າຄວນສະແດງໜ້າ offline ບໍ
const posLoaded = new WeakMap();

// ໂຫຼດໜ້າ POS ຄືນທຸກປ່ອງທີ່ຊີ້ຫາ server (ໃຊ້ຫຼັງປ່ຽນ URL ຂອງ server)
function loadPos() {
  const server = getServerUrl();
  for (const w of [win, posWin]) {
    if (!alive(w)) continue;
    posLoaded.set(w, false); // ປ່ຽນ server ແລ້ວ — ນັບໃໝ່
    w.loadURL(server).catch(() => showOffline(w));
  }
}

// ພຶດຕິກຳຮ່ວມຂອງທຸກປ່ອງທີ່ໂຫຼດ server: ໜ້າ offline, ເປີດລິ້ງ, ພິມບິນແບບໄວ
function wireServerWindow(w) {
  w.webContents.on('did-finish-load', () => {
    if (!isOffline(w)) posLoaded.set(w, true);
  });

  // ໂຫຼດບໍ່ສຳເລັດ (server ຍັງບໍ່ເປີດ / URL ຜິດ / ເນັດຫຼຸດ) → ໜ້າ offline + retry
  // ໝາຍເຫດ: ເມື່ອ navigation ຂອງ main frame ລົ້ມ Chromium ໄດ້ຖີ້ມໜ້າເກົ່າໄປແລ້ວ
  // ຈຶ່ງເອົາໜ້າ offline ຂອງເຮົາມາໃສ່ແທນໜ້າ error ຂອງ Chromium
  w.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (code === -3 || !isMainFrame) return; // -3 = ຍົກເລີກເອງ ບໍ່ແມ່ນ error
    if (isOffline(w)) return;                // ຢູ່ໜ້າ offline ຢູ່ແລ້ວ (retry ທຸກ 10 ວິ)
    showOffline(w);
  });

  // ປ່ອງພິມບິນ (window.open ເປັນ about:blank) ແລະ ໜ້າຂອງ server ເປີດໄດ້;
  // ລິ້ງພາຍນອກເປີດໃນ browser ປົກກະຕິ
  w.webContents.setWindowOpenHandler(({ url }) => {
    const server = getServerUrl();
    if (url === 'about:blank' || url.startsWith(server)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ໂໝດພິມໄວ: ປ່ອງບິນທີ່ເປີດມາ ຖືກສັ່ງພິມຫາ printer ທີ່ຕັ້ງໄວ້ທັນທີ ບໍ່ຖາມ
  w.webContents.on('did-create-window', (child, details) => {
    const cfg = loadConfig();
    // ໜ້າຈໍລູກຄ້າກໍເປີດດ້ວຍ window.open ຄືກັນ ແຕ່ບໍ່ແມ່ນບິນ — ຢ່າສັ່ງພິມ
    if (!cfg.silentPrint || isCustomerDisplay(details?.url || '')) return;
    // ກັນໜ້າບິນເອີ້ນ window.print() ເອງ (ຈະເປີດກ່ອງຖາມຊ້ຳ)
    child.webContents.on('dom-ready', () => {
      child.webContents.executeJavaScript('window.print = () => {}; true').catch(() => {});
    });
    child.webContents.on('did-finish-load', () => {
      // ຖ້າໜ້າບິນມີ delay ກ່ອນພິມ ໃຫ້ຮູບ/ຟອນໂຫຼດຄົບກ່ອນ
      setTimeout(() => {
        child.webContents.print(
          {
            silent: true,
            deviceName: cfg.printerName || undefined,
            margins: { marginType: 'none' },
          },
          () => { try { child.close(); } catch {} }
        );
      }, 350);
    });
  });
}

function createWindow(startUrl) {
  const cfg = loadConfig();
  win = new BrowserWindow({
    width: cfg.width || 1366,
    height: cfg.height || 800,
    minWidth: 900,
    minHeight: 600,
    title: 'SMLAO POS',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ຈື່ຂະໜາດປ່ອງ
  win.on('close', () => {
    try {
      const { width, height } = win.getNormalBounds();
      saveConfig({ ...loadConfig(), width, height });
    } catch {}
  });
  win.on('closed', () => { win = null; });

  wireServerWindow(win);
  win.loadURL(startUrl || getServerUrl()).catch(() => showOffline(win));
}

// ປ່ອງໜ້າຂາຍ (cashier) — ແຍກຈາກປ່ອງຫຼັກ, ບໍ່ມີແຖບເມນູ, ຈື່ຂະໜາດ/ຕຳແໜ່ງ/ເຕັມຈໍຂອງມັນເອງ
function openPosWindow() {
  if (alive(posWin)) {
    if (posWin.isMinimized()) posWin.restore();
    posWin.focus();
    return posWin;
  }

  const cfg = loadConfig();
  posWin = new BrowserWindow({
    width: cfg.posWidth || 1366,
    height: cfg.posHeight || 800,
    x: Number.isInteger(cfg.posX) ? cfg.posX : undefined,
    y: Number.isInteger(cfg.posY) ? cfg.posY : undefined,
    minWidth: 900,
    minHeight: 600,
    title: 'SMLAO POS — ໜ້າຂາຍ',
    backgroundColor: '#0f172a',
    fullscreen: !!cfg.posFullScreen,
    autoHideMenuBar: true, // ກົດ Alt ຈຶ່ງເຫັນເມນູ
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  wireServerWindow(posWin);

  // ປ່ອງນີ້ລັອກຢູ່ໜ້າຂາຍ — ລິ້ງໄປຫຼັງບ້ານໃຫ້ໄປເປີດໃນປ່ອງຫຼັກແທນ
  posWin.webContents.on('will-navigate', (e, url) => {
    if (!isAdminUrl(url)) return;
    e.preventDefault();
    openInMainWindow(url);
  });

  // Next.js ຍ້າຍໜ້າຝັ່ງ client (router.push) ບໍ່ຜ່ານ will-navigate —
  // ດຶງກັບຄືນໜ້າຂາຍ ແລ້ວເປີດໃນປ່ອງຫຼັກແທນ
  posWin.webContents.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (!isMainFrame || !isAdminUrl(url)) return;
    posWin.webContents.executeJavaScript('history.back(); true').catch(() => {});
    openInMainWindow(url);
  });

  posWin.on('close', () => {
    try {
      const { width, height, x, y } = posWin.getNormalBounds();
      saveConfig({
        ...loadConfig(),
        posWidth: width, posHeight: height, posX: x, posY: y,
        posFullScreen: posWin.isFullScreen(),
      });
    } catch {}
  });
  posWin.on('closed', () => { posWin = null; });

  posWin.loadURL(getServerUrl()).catch(() => showOffline(posWin));
  return posWin;
}

// ເປີດ URL ໃນປ່ອງຫຼັກ (ສ້າງໃໝ່ຖ້າຖືກປິດໄປແລ້ວ)
function openInMainWindow(url) {
  if (!alive(win)) createWindow(url);
  else win.loadURL(url).catch(() => showOffline(win));
  if (win.isMinimized()) win.restore();
  win.focus();
}

function openSettings() {
  if (settingsWin) { settingsWin.focus(); return; }
  const parent = alive(win) ? win : (alive(posWin) ? posWin : undefined);
  settingsWin = new BrowserWindow({
    width: 460,
    height: 470,
    resizable: false,
    parent,
    modal: !!parent,
    title: 'ຕັ້ງຄ່າ Server',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ປ່ອງທີ່ກຳລັງໃຊ້ຢູ່ (ເມນູຕ້ອງມີຜົນກັບປ່ອງນັ້ນ ບໍ່ແມ່ນປ່ອງຫຼັກສະເໝີ) — ບໍ່ນັບປ່ອງຕັ້ງຄ່າ
function activeWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && focused !== settingsWin) return focused;
  return alive(posWin) ? posWin : win;
}

// ໂຫຼດໃໝ່: ຄ້າງຢູ່ໜ້າ offline ໃຫ້ກັບໄປ server, ບໍ່ດັ່ງນັ້ນ reload ໜ້າເດີມ
// (ບໍ່ດຶງໜ້າຫຼັງບ້ານທີ່ເປີດຢູ່ກັບຄືນໜ້າຂາຍ)
async function reloadActive() {
  const w = activeWindow();
  if (!alive(w)) return;
  if (isOffline(w)) { w.loadURL(getServerUrl()).catch(() => showOffline(w)); return; }

  // ⚠️ ເນັດຫຼຸດ: ຫ້າມໂຫຼດໃໝ່ — ໜ້າ POS ຈະຫາຍ ແລະ ໂຫຼດຄືນບໍ່ໄດ້ຈົນກວ່າເນັດຈະມາ.
  // ປ່ອຍໃຫ້ໜ້າເດີມແລ່ນຕໍ່ ຈຶ່ງຂາຍ-ຮັບເງິນ-ເບິ່ງສະຕັອກ offline ໄດ້ ແລ້ວ sync ເອງເມື່ອເນັດກັບມາ
  const online = await w.webContents.executeJavaScript('navigator.onLine').catch(() => true);
  if (!online) {
    dialog.showMessageBox(w, {
      type: 'warning',
      title: 'ເນັດຫຼຸດ',
      message: 'ຕອນນີ້ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ — ຍັງບໍ່ໂຫຼດໃໝ່',
      detail: 'ໜ້າ POS ທີ່ເປີດຢູ່ຍັງຂາຍໄດ້ປົກກະຕິ ແລະ ບິນຈະຖືກສົ່ງຂຶ້ນ server ໃຫ້ອັດຕະໂນມັດເມື່ອເນັດກັບມາ.\nຖ້າໂຫຼດໃໝ່ຕອນນີ້ ໜ້າ POS ຈະຫາຍ ແລະ ເປີດຄືນບໍ່ໄດ້ຈົນກວ່າເນັດຈະມາ.',
      buttons: ['ຕົກລົງ'],
      noLink: true,
    });
    return;
  }
  w.webContents.reload();
}

function buildMenu() {
  const template = [
    {
      label: 'POS',
      submenu: [
        { label: 'ໂຫຼດໃໝ່', accelerator: 'CmdOrCtrl+R', click: () => reloadActive() },
        { label: 'ເປີດປ່ອງໜ້າຂາຍ', accelerator: 'F9', click: () => openPosWindow() },
        { label: 'ຕັ້ງຄ່າ Server...', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        {
          label: 'ເຕັມຈໍ',
          accelerator: 'F11',
          click: () => { const w = activeWindow(); if (alive(w)) w.setFullScreen(!w.isFullScreen()); },
        },
        { role: 'zoomIn', label: 'ຂະຫຍາຍ' },
        { role: 'zoomOut', label: 'ຫຍໍ້' },
        { role: 'resetZoom', label: 'ຂະໜາດປົກກະຕິ' },
        { type: 'separator' },
        { role: 'quit', label: 'ອອກຈາກໂປຣແກຣມ' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ລີ້ນຊັກເງິນ (cash drawer) ຕໍ່ຜ່ານ serial — ໜ້າ POS ເອີ້ນ navigator.serial.
// ໃນ Electron ຕ້ອງເລືອກ port ໃຫ້ຈາກ main process ບໍ່ດັ່ງນັ້ນຈະຄ້າງບໍ່ມີຫຍັງເກີດຂຶ້ນ
// (ຢູ່ browser ຜູ້ໃຊ້ຕ້ອງເລືອກ port ເອງທຸກເທື່ອທີ່ເປີດໃໝ່ — ນີ້ຄືເຫດຜົນທີ່ແອັບສະດວກກວ່າ)
function setupSerialAccess() {
  const ses = session.defaultSession;

  ses.on('select-serial-port', (event, portList, _webContents, callback) => {
    event.preventDefault();
    const cfg = loadConfig();
    const saved = portList.find(p => p.portId === cfg.serialPortId);
    const chosen = saved || portList[0];
    if (chosen && chosen.portId !== cfg.serialPortId) {
      saveConfig({ ...loadConfig(), serialPortId: chosen.portId });
    }
    callback(chosen ? chosen.portId : '');
  });

  // ອະນຸຍາດ serial ໃຫ້ໜ້າຂອງ server ເຮົາເອງ ບໍ່ຕ້ອງຖາມທຸກເທື່ອ
  const fromOurServer = (origin) => {
    try { return !origin || origin === new URL(getServerUrl()).origin; } catch { return false; }
  };
  ses.setPermissionCheckHandler((_wc, permission, origin) => (
    permission === 'serial' ? fromOurServer(origin) : true
  ));
  ses.setDevicePermissionHandler((details) => details.deviceType === 'serial');
}

// ບໍ່ໃຫ້ເປີດຊ້ອນຫຼາຍປ່ອງ
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = alive(posWin) ? posWin : win;
    if (alive(w)) { if (w.isMinimized()) w.restore(); w.focus(); }
  });

  app.whenReady().then(() => {
    setupSerialAccess();
    buildMenu();
    // ເຄື່ອງຈຸດຂາຍ: ຕັ້ງໄວ້ໃຫ້ເປີດຂຶ້ນມາເປັນປ່ອງໜ້າຂາຍເລີຍ ບໍ່ຕ້ອງຜ່ານປ່ອງຫຼັກ
    if (loadConfig().openPosOnStart) openPosWindow();
    else createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        if (loadConfig().openPosOnStart) openPosWindow();
        else createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC ຈາກໜ້າ settings / offline
ipcMain.handle('get-server-url', () => getServerUrl());
ipcMain.handle('get-settings', () => {
  const cfg = loadConfig();
  return {
    serverUrl: getServerUrl(),
    silentPrint: !!cfg.silentPrint,
    printerName: cfg.printerName || '',
    openPosOnStart: !!cfg.openPosOnStart,
  };
});
ipcMain.handle('get-printers', async () => {
  const w = alive(win) ? win : posWin;
  try { return alive(w) ? await w.webContents.getPrintersAsync() : []; } catch { return []; }
});
ipcMain.handle('save-settings', (_e, next) => {
  const clean = String(next?.serverUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/.test(clean)) return { ok: false, error: 'URL ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ http:// ຫຼື https://' };
  saveConfig({
    ...loadConfig(),
    serverUrl: clean,
    silentPrint: !!next?.silentPrint,
    printerName: String(next?.printerName || ''),
    openPosOnStart: !!next?.openPosOnStart,
  });
  if (settingsWin) settingsWin.close();
  loadPos();
  return { ok: true };
});
ipcMain.handle('set-server-url', (_e, url) => {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/.test(clean)) return { ok: false, error: 'URL ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ http:// ຫຼື https://' };
  saveConfig({ ...loadConfig(), serverUrl: clean });
  if (settingsWin) settingsWin.close();
  loadPos();
  return { ok: true };
});
// ໜ້າ offline ກົດ/ລອງໃໝ່ອັດຕະໂນມັດທຸກ 10 ວິ — ໃຫ້ມີຜົນສະເພາະປ່ອງທີ່ຄ້າງຢູ່ໜ້າ offline
// (ບໍ່ດັ່ງນັ້ນປ່ອງອື່ນທີ່ໃຊ້ງານປົກກະຕິຈະຖືກໂຫຼດຄືນທຸກ 10 ວິນາທີ)
ipcMain.handle('retry', () => {
  const server = getServerUrl();
  for (const w of [win, posWin]) {
    if (isOffline(w)) w.loadURL(server).catch(() => showOffline(w));
  }
  return true;
});
ipcMain.handle('open-settings', () => { openSettings(); return true; });
ipcMain.handle('open-pos-window', () => { openPosWindow(); return true; });
