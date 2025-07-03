const { BrowserWindow } = require('electron')

function launchMainWindow(startUrl, modifyUserAgent) {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
    })

    // make sure useragent is detected as compatible
    mainWindow.webContents.userAgent = modifyUserAgent(mainWindow.webContents.userAgent)

    mainWindow.webContents.on('will-navigate', (event) => {
        console.log('will-navigate', event)
    })
    mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
        console.log('did-navigate', event, url, httpResponseCode, httpStatusText)
    })
    mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
        console.log('did-navigate-in-page', event, url, isMainFrame)
    })
    mainWindow.webContents.on('render-process-gone', () => {
        console.log('render-process-gone')
        // not sure what causes this, but it goes to a blank screen.
        // Refresh back to starting URL
        mainWindow.loadURL(startUrl.href)
    })
    mainWindow.webContents.on('unresponsive', () => {
        console.log('unresponsive')
    })

    // Load main page
    mainWindow.loadURL(startUrl.href)

    // Open dev tools initially
    mainWindow.webContents.openDevTools()
    
    return mainWindow
}

module.exports = { launchMainWindow } 