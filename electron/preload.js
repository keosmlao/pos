const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posDesktop', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  retry: () => ipcRenderer.invoke('retry'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
});
