// SMLAO POS — Windows desktop shell
// ເປັນປ່ອງເປີດຫາ server POS (Next.js) ທີ່ຕັ້ງ URL ໄດ້ — ຖານຂໍ້ມູນຍັງຢູ່ສູນກາງ
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_URL = 'http://localhost:3000';
let win = null;
let settingsWin = null;

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}
function saveConfig(next) {
  try { fs.writeFileSync(configPath(), JSON.stringify(next, null, 2)); } catch {}
}
const getServerUrl = () => String(loadConfig().serverUrl || DEFAULT_URL);

function loadPos() {
  if (!win) return;
  win.loadURL(getServerUrl()).catch(() => showOffline());
}

function showOffline() {
  if (!win) return;
  win.loadFile(path.join(__dirname, 'offline.html'));
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
      const [width, height] = win.getSize();
      saveConfig({ ...loadConfig(), width, height });
    } catch {}
  });

  // ໂຫຼດບໍ່ສຳເລັດ (server ຍັງບໍ່ເປີດ / URL ຜິດ) → ໜ້າ offline + retry
  win.webContents.on('did-fail-load', (_e, code) => {
    if (code !== -3) showOffline(); // -3 = ຍົກເລີກເອງ ບໍ່ແມ່ນ error
  });

  // ລິ້ງພາຍນອກເປີດໃນ browser ປົກກະຕິ
  win.webContents.setWindowOpenHandler(({ url }) => {
    const server = getServerUrl();
    if (url.startsWith(server)) return { action: 'allow' }; // ປ່ອງພິມບິນ
    shell.openExternal(url);
    return { action: 'deny' };
  });

  loadPos();
}

function openSettings() {
  if (settingsWin) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 460,
    height: 260,
    resizable: false,
    parent: win || undefined,
    modal: !!win,
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

function buildMenu() {
  const template = [
    {
      label: 'POS',
      submenu: [
        { label: 'ໂຫຼດໃໝ່', accelerator: 'CmdOrCtrl+R', click: () => loadPos() },
        { label: 'ຕັ້ງຄ່າ Server...', accelerator: 'CmdOrCtrl+,', click: () => openSettings() },
        { type: 'separator' },
        { label: 'ເຕັມຈໍ', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
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
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC ຈາກໜ້າ settings / offline
ipcMain.handle('get-server-url', () => getServerUrl());
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
