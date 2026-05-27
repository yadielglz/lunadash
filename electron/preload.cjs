const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lunadashDesktop', {
  platform: process.platform,
  forceUpdateRestart: () => ipcRenderer.invoke('lunadash:force-update-restart'),
})
