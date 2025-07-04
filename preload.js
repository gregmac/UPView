const { contextBridge, ipcRenderer } = require('electron');
// The main process will set global.sharedConfig before window creation
window.config = global.sharedConfig;
window.ipcRenderer = ipcRenderer;

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    send: ipcRenderer.send.bind(ipcRenderer),
    on: ipcRenderer.on.bind(ipcRenderer)
}); 