const { BrowserWindow } = require('electron')

function getWindowState(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return null
    }
    
    const bounds = mainWindow.getBounds()
    const isMaximized = mainWindow.isMaximized()
    const isFullScreen = mainWindow.isFullScreen()
    const isDevToolsOpen = mainWindow.webContents.isDevToolsOpened()
    
    return {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: isMaximized,
        fullscreen: isFullScreen,
        devToolsOpen: isDevToolsOpen
    }
}

function launchMainWindow(startUrl, modifyUserAgent, windowState, onWindowStateChange) {
    console.log("Launching main window", startUrl, windowState)
    const mainWindow = new BrowserWindow({
        width: windowState ? windowState.width : 800,
        height: windowState ? windowState.height : 600,
        x: windowState && windowState.x !== undefined ? windowState.x : undefined,
        y: windowState && windowState.y !== undefined ? windowState.y : undefined,
        show: false // Don't show until we've set up the state
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

    // Restore window state
    if (windowState) {
        if (windowState.maximized) {
            mainWindow.maximize()
        }
        
        if (windowState.fullscreen) {
            mainWindow.setFullScreen(true)
        }
        
        if (windowState.devToolsOpen) {
            mainWindow.webContents.openDevTools()
        }
    } else {
        // Open dev tools initially if no state saved
        mainWindow.webContents.openDevTools()
    }

    // Show window after state is restored
    mainWindow.show()

    // Add event listeners to save window state with debouncing
    if (onWindowStateChange) {
        let saveTimeout = null
        
        const saveState = () => {
            const state = getWindowState(mainWindow)
            if (state) {
                // Clear existing timeout
                if (saveTimeout) {
                    clearTimeout(saveTimeout)
                }
                
                // Set new timeout for 1 second
                saveTimeout = setTimeout(() => {
                    onWindowStateChange(state)
                }, 1000)
            }
        }
        
        mainWindow.on('resize', () => {
            if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
                saveState()
            }
        })
        
        mainWindow.on('move', () => {
            if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
                saveState()
            }
        })
        
        mainWindow.on('maximize', saveState)
        mainWindow.on('unmaximize', saveState)
        mainWindow.on('enter-full-screen', saveState)
        mainWindow.on('leave-full-screen', saveState)
        
        mainWindow.webContents.on('devtools-opened', saveState)
        mainWindow.webContents.on('devtools-closed', saveState)
    }
    
    return mainWindow
}

module.exports = { launchMainWindow, getWindowState } 