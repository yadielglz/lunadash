const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('lunadashDesktop', {
  platform: process.platform,
})
