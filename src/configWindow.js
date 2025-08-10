const { BrowserWindow, ipcMain, safeStorage } = require('electron')
const path = require('path')

let configWindow = null

function openConfigWindow(config, onSave, parentWindow) {
    if (configWindow) {
        configWindow.focus()
        return
    }
    ipcMain.removeHandler('get-config');
    ipcMain.handle('get-config', () => {
        const { passwordEnc, ...rest } = config || {};
        return { ...rest, hasPassword: !!passwordEnc };
    });
    configWindow = new BrowserWindow({
        width: 880,
        height: 620,
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
        const url = data.protocol + '://' + data.hostname + '/' + data.path.replace(/^\//, '')
        const updated = {
            startUrl: url,
            validateSSL: !!data.validateSSL,
            idleTimeoutSeconds: Number(data.idleTimeoutSeconds) || 0,
            username: (data.username || '').trim()
        }

        // Only update password if a new one is provided
        if (typeof data.password === 'string' && data.password.length > 0) {
            try {
                if (safeStorage.isEncryptionAvailable()) {
                    const enc = safeStorage.encryptString(data.password)
                    updated.passwordEnc = enc.toString('base64')
                } else {
                    console.warn('[config] Password provided but encryption is not available on this system; not saving password')
                }
            } catch (e) {
                console.error('[config] Failed to encrypt password:', e)
            }
        }

        onSave(updated)
        if (configWindow) configWindow.close()
    })
    ipcMain.once('config-closed', () => {
        if (configWindow) configWindow.close()
    })
}

module.exports = { openConfigWindow } 