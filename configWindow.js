const { BrowserWindow, ipcMain } = require('electron')

let configWindow = null

function openConfigWindow(config, onSave, parentWindow) {
    if (configWindow) {
        configWindow.focus()
        return
    }
    configWindow = new BrowserWindow({
        width: 400,
        height: 200,
        resizable: false,
        minimizable: false,
        maximizable: false,
        modal: true,
        parent: parentWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    configWindow.loadURL('data:text/html,' + encodeURIComponent(`
        <html>
        <body>
            <h2>Configuration</h2>
            <form id="configForm">
                <label>Start URL: <input type="text" id="startUrl" value="${config.startUrl}" style="width: 90%"></label><br><br>
                <button type="submit">Save</button>
                <button type="button" onclick="window.close()">Cancel</button>
            </form>
            <script>
                const { ipcRenderer } = require('electron')
                document.getElementById('configForm').onsubmit = (e) => {
                    e.preventDefault()
                    ipcRenderer.send('save-config', {
                        startUrl: document.getElementById('startUrl').value
                    })
                }
                window.onbeforeunload = () => {
                    ipcRenderer.send('config-closed')
                }
            </script>
        </body>
        </html>
    `))
    configWindow.on('closed', () => { configWindow = null })

    ipcMain.once('save-config', (event, newConfig) => {
        onSave(newConfig)
        if (configWindow) configWindow.close()
    })
    ipcMain.once('config-closed', () => {
        if (configWindow) configWindow.close()
    })
}

module.exports = { openConfigWindow } 