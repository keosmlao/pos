// SMLAO POS — Windows desktop shell
// ເປັນປ່ອງເປີດຫາ server POS (Next.js) ທີ່ຕັ້ງ URL ໄດ້ — ຖານຂໍ້ມູນຍັງຢູ່ສູນກາງ
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
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

// ໂຫຼດໜ້າ POS ຄືນທຸກປ່ອງທີ່ຊີ້ຫາ server (ໃຊ້ຫຼັງປ່ຽນ URL / ກົດໂຫຼດໃໝ່)
function loadPos() {
  const server = getServerUrl();
  for (const w of [win, posWin]) {
    if (alive(w)) w.loadURL(server).catch(() => showOffline(w));
  }
}

// ພຶດຕິກຳຮ່ວມຂອງທຸກປ່ອງທີ່ໂຫຼດ server: ໜ້າ offline, ເປີດລິ້ງ, ພິມບິນແບບໄວ
function wireServerWindow(w) {
  // ໂຫຼດບໍ່ສຳເລັດ (server ຍັງບໍ່ເປີດ / URL ຜິດ) → ໜ້າ offline + retry
  w.webContents.on('did-fail-load', (_e, code) => {
    if (code !== -3) showOffline(w); // -3 = ຍົກເລີກເອງ ບໍ່ແມ່ນ error
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

function createWindow() {
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
  win.loadURL(getServerUrl()).catch(() => showOffline(win));
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
  if (!alive(win)) createWindow();
  win.loadURL(url).catch(() => showOffline(win));
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

// ປ່ອງທີ່ກຳລັງໃຊ້ຢູ່ (ເມນູຕ້ອງມີຜົນກັບປ່ອງນັ້ນ ບໍ່ແມ່ນປ່ອງຫຼັກສະເໝີ)
const activeWindow = () => BrowserWindow.getFocusedWindow() || (alive(posWin) ? posWin : win);

function buildMenu() {
  const template = [
    {
      label: 'POS',
      submenu: [
        { label: 'ໂຫຼດໃໝ່', accelerator: 'CmdOrCtrl+R', click: () => loadPos() },
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
ipcMain.handle('retry', () => { loadPos(); return true; });
ipcMain.handle('open-settings', () => { openSettings(); return true; });
ipcMain.handle('open-pos-window', () => { openPosWindow(); return true; });
