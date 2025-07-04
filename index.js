// Modules to control application life and create native browser window
const { app, BrowserWindow, session, Menu, dialog } = require('electron')
const path = require('node:path')
const fs = require('fs')
const { openConfigWindow } = require('./configWindow')
const { launchMainWindow, getWindowState } = require('./mainWindow')

let CONFIG_PATH
let config;
let mainWindow = null;
let defaultConfig = { 
    startUrl: 'https://192.168.10.1/protect/dashboard',
    windowState: {
        width: 800,
        height: 600,
        x: undefined,
        y: undefined,
        maximized: false,
        fullscreen: false,
        devToolsOpen: true,
        alwaysOnTop: false
    }
}

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log("Config file not found ", CONFIG_PATH)
            return null
        }
        console.log("Loading config from", CONFIG_PATH)
        return JSON.parse(fs.readFileSync(CONFIG_PATH))
    } catch (e) {
        console.error('Failed to load config:', e)
        throw e
    }
}

function modifyConfig(callback) {
    try {
        const newConfig = callback(config)
        if (newConfig) {
            config = newConfig
            console.log("Saving config to", CONFIG_PATH)
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
        }
    } catch (e) {
        console.error('Failed to save config:', e)
    }
}

function handleOpenConfig() {
    openConfigWindow(config || defaultConfig, (newConfig) => {
        if (!newConfig.startUrl) return // Don't save if empty
        modifyConfig((oldConfig) => ({ ...oldConfig, ...newConfig }))
        // Check if main window exists and is not destroyed
        if (mainWindow && !mainWindow.isDestroyed() && config.startUrl) {
            console.log("Reloading main window to", config.startUrl)
            mainWindow.loadURL(config.startUrl)
        } else if (config.startUrl) {
            console.log("Launching main window to", config.startUrl)
            mainWindow = launchMainWindow(new URL(config.startUrl), modifyUserAgent, config.windowState, modifyConfig)
        }
    }, BrowserWindow.getAllWindows()[0])
}

const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Load Main Page',
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed() && config && config.startUrl) {
                        console.log("Loading main page:", config.startUrl)
                        mainWindow.loadURL(config.startUrl)
                    }
                }
            },
            {
                label: 'Configuration',
                click: handleOpenConfig
            },
            { type: 'separator' },
            { role: 'quit' }
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
            {
                label: 'Always on Top',
                type: 'checkbox',
                checked: config && config.windowState ? config.windowState.alwaysOnTop : false,
                click: (menuItem) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        const isAlwaysOnTop = menuItem.checked
                        mainWindow.setAlwaysOnTop(isAlwaysOnTop)
                        console.log('Always on top:', isAlwaysOnTop ? 'enabled' : 'disabled')
                        // Save to config
                        if (config && config.windowState) {
                            modifyConfig((oldConfig) => ({
                                ...oldConfig,
                                windowState: { ...oldConfig.windowState, alwaysOnTop: isAlwaysOnTop }
                            }))
                        }
                    }
                }
            }
        ]
    },
    {
        label: 'Help',
        submenu: [
            {
                label: 'About',
                click: () => {
                    const packageJson = require('./package.json')
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'About',
                        message: `UnifiProtect Live View`,
                        detail: `Version: ${packageJson.version}\n\nDesktop viewer for Unifi Protect`
                    })
                }
            }
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

    if (!config || !config.startUrl) {
        handleOpenConfig()
    } else {
        mainWindow = launchMainWindow(new URL(config.startUrl), modifyUserAgent, config.windowState, modifyConfig)
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (!config || !config.startUrl) {
                handleOpenConfig()
            } else {
                mainWindow = launchMainWindow(new URL(config.startUrl), modifyUserAgent, config.windowState, modifyConfig)
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

