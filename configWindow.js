const { BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let configWindow = null
let configHandlerRegistered = false;

function splitUrl(url) {
    try {
        if (!/^https?:\/\//.test(url)) url = 'https://' + url;
        const u = new URL(url);
        return {
            protocol: u.protocol.replace('://', ''),
            hostname: u.hostname + (u.port ? ':' + u.port : ''),
            path: (u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname) + (u.search ? u.search : '') + (u.hash ? u.hash : '')
        };
    } catch (e) {
        return { protocol: 'https', hostname: '', path: '' };
    }
}

function openConfigWindow(config, onSave, parentWindow) {
    if (configWindow) {
        configWindow.focus()
        return
    }
    ipcMain.removeHandler('get-config'); // Always remove previous handler
    ipcMain.handle('get-config', () => config);
    configWindow = new BrowserWindow({
        width: 880,
        height: 400,
        resizable: true,
        minimizable: false,
        maximizable: false,
        modal: true,
        parent: parentWindow,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    configWindow.setMenuBarVisibility(false)
    configWindow.loadFile(path.join(__dirname, 'config.html'))
    configWindow.on('closed', () => { configWindow = null })

    ipcMain.once('save-config', (event, data) => {
        let url = data.protocol + '://' + data.hostname + '/' + data.path.replace(/^\//, '')
        onSave({ startUrl: url })
        if (configWindow) configWindow.close()
    })
    ipcMain.once('config-closed', () => {
        if (configWindow) configWindow.close()
    })
}

module.exports = { openConfigWindow } 