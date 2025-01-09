// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const startUrl = new URL('https://192.168.10.1/protect/dashboard')
const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
    })

    // and load the index.html of the app.
    mainWindow.loadURL(startUrl.href);

    // Open the DevTools.
    mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    var hostname = new URL(url).hostname
    if (hostname === startUrl.hostname) {
        // bypass SSL errors
        event.preventDefault()
        callback(true)
    } else {
        console.log(`cert error: ${url} ${error}`)
        callback(false)
    }
})