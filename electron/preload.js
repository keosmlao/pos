const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posDesktop', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (next) => ipcRenderer.invoke('save-settings', next),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  retry: () => ipcRenderer.invoke('retry'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
});
