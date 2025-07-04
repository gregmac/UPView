const { BrowserWindow, ipcMain } = require('electron')

let configWindow = null

function splitUrl(url) {
    try {
        if (!/^https?:\/\//.test(url)) url = 'https://' + url;
        const u = new URL(url);
        return {
            protocol: u.protocol + '//',
            hostname: u.hostname + (u.port ? ':' + u.port : ''),
            path: (u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname) + (u.search ? u.search : '') + (u.hash ? u.hash : '')
        };
    } catch (e) {
        return { protocol: 'https://', hostname: '', path: '' };
    }
}

function openConfigWindow(config, onSave, parentWindow) {
    if (configWindow) {
        configWindow.focus()
        return
    }
    const urlParts = splitUrl(config.startUrl)
    // Extract scheme only (without ://) for dropdown
    const scheme = urlParts.protocol.replace('://', '')
    configWindow = new BrowserWindow({
        width: 880,
        height: 400,
        resizable: true,
        minimizable: false,
        maximizable: false,
        modal: true,
        parent: parentWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    configWindow.setMenuBarVisibility(false)
    configWindow.loadURL('data:text/html,' + encodeURIComponent(`
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { background: #f7f8fa; font-family: 'Segoe UI', 'Arial', sans-serif; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
                .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 32px 28px 24px 28px; width: 100%; min-width: 340px; }
                h2 { margin-top: 0; margin-bottom: 18px; font-size: 1.25rem; font-weight: 600; text-align: center; }
                .form-group { margin-bottom: 18px; }
                label { display: block; font-size: 0.98rem; font-weight: 500; margin-bottom: 6px; }
                .url-row { display: flex; align-items: center; gap: 6px; width: 100%; }
                select { padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; background: #f9fafb; transition: border 0.2s; flex: 1 1 0; min-width: 0; max-width: 90px; }
                input[type="text"] { padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; background: #f9fafb; transition: border 0.2s; min-width: 0; }
                #hostname { flex: 1 1 0; }
                #path { flex: 2 1 0; }
                select:focus, input[type="text"]:focus { border: 1.5px solid #2684ff; outline: none; background: #fff; }
                select { flex: 1 1 0; }
                .scheme-separator { font-size: 1.2rem; font-weight: 600; color: #888; margin: 0 2px; user-select: none; flex: 0 0 auto; }
                .slash { font-size: 1.2rem; font-weight: 600; color: #888; margin: 0 2px; user-select: none; flex: 0 0 auto; }
                .button-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
                button { padding: 8px 18px; border: none; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s; }
                button[type="submit"] { background: #2563eb; color: #fff; }
                button[type="submit"]:hover { background: #1749b1; }
                button[type="button"] { background: #e5e7eb; color: #222; }
                button[type="button"]:hover { background: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Configuration</h2>
                <form id="configForm">
                    <div class="form-group">
                        <label for="protocol">Start URL</label>
                        <div class="url-row">
                            <select id="protocol">
                                <option value="https"${scheme === 'https' ? ' selected' : ''}>https</option>
                                <option value="http"${scheme === 'http' ? ' selected' : ''}>http</option>
                            </select>
                            <span class="scheme-separator">://</span>
                            <input type="text" id="hostname" placeholder="hostname or IP" autocomplete="off" value="${urlParts.hostname.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />
                            <span class="slash">/</span>
                            <input type="text" id="path" placeholder="path" autocomplete="off" value="${urlParts.path.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />
                        </div>
                    </div>
                    <div class="button-row">
                        <button type="button" onclick="window.close()">Cancel</button>
                        <button type="submit">Save</button>
                    </div>
                </form>
            </div>
            <script>
                const { ipcRenderer } = require('electron')
                document.getElementById('configForm').onsubmit = (e) => {
                    e.preventDefault()
                    ipcRenderer.send('save-config', {
                        protocol: document.getElementById('protocol').value,
                        hostname: document.getElementById('hostname').value.trim(),
                        path: document.getElementById('path').value.trim()
                    })
                }
                document.getElementById('hostname').addEventListener('keydown', e => {
                    if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        e.preventDefault()
                        document.getElementById('path').focus()
                        document.getElementById('path').select()
                    }
                })
                window.onbeforeunload = () => {
                    ipcRenderer.send('config-closed')
                }
            </script>
        </body>
        </html>
    `))
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