// Modules to control application life and create native browser window
const { app, BrowserWindow, session, Menu, dialog } = require('electron')
const path = require('node:path')
const fs = require('fs')
const { openConfigWindow } = require('./configWindow')
const { launchMainWindow } = require('./mainWindow')

let CONFIG_PATH
let config;
let defaultConfig = { startUrl: 'https://192.168.10.1/protect/dashboard' }

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log("Config file not found ", CONFIG_PATH)
            return defaultConfig
        }
        console.log("Loading config from", CONFIG_PATH)
        return JSON.parse(fs.readFileSync(CONFIG_PATH))
    } catch (e) {
        console.error('Failed to load config:', e)
        throw e
    }
}

function saveConfig(config) {
    try {
        console.log("Saving config to", CONFIG_PATH)
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    } catch (e) {
        console.error('Failed to save config:', e)
    }
}

function handleOpenConfig() {
    openConfigWindow(config, (newConfig) => {
        if (!newConfig.startUrl) return // Don't save if empty
        config = { ...config, ...newConfig }
        saveConfig(config)
        // Reload main window with new startUrl
        const mainWindow = BrowserWindow.getAllWindows()[0]
        if (mainWindow && config.startUrl) {
            mainWindow.loadURL(config.startUrl)
        }
    }, BrowserWindow.getAllWindows()[0])
}

const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Configuration',
                click: handleOpenConfig
            },
            { type: 'separator' },
            { role: 'quit' }
        ]
    }
]
Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')
    config = loadConfig()

    function showConfigAndLaunch() {
        openConfigWindow(config || defaultConfig, (newConfig) => {
            if (!newConfig.startUrl) {
                showConfigAndLaunch()
                return
            }
            config = { ...config, ...newConfig }
            saveConfig(config)
            launchMainWindow(new URL(config.startUrl), modifyUserAgent)
        }, null)
    }

    if (!config || !config.startUrl) {
        showConfigAndLaunch()
    } else {
        launchMainWindow(new URL(config.startUrl), modifyUserAgent)
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (!config || !config.startUrl) {
                showConfigAndLaunch()
            } else {
                launchMainWindow(new URL(config.startUrl), modifyUserAgent)
            }
        }
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    var reqHostname = new URL(url).hostname
    var configHostname = new URL(config.startUrl).hostname
    if (reqHostname === configHostname) {
        // bypass SSL errors
        //console.log(`cert error ignored: ${url} ${error}`)
        event.preventDefault()
        callback(true)
    } else {
        console.log(`cert error: ${url} ${error}`)
        callback(false)
    }
})

// Make sure agent ends with Chrome/xxx
function modifyUserAgent(userAgent) {
    return userAgent.replace(/^(.*\(.*\).*Chrome\/[^ ]+).*$/, '$1');
}