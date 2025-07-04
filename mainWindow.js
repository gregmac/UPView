const { BrowserWindow, screen } = require('electron')

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

function validateWindowBounds(bounds) {
    const displays = screen.getAllDisplays()
    console.log("Validating bounds:", bounds, "against displays:", displays.map(d => d.bounds))
    
    // Check if the window bounds are mostly within any display
    for (const display of displays) {
        const displayBounds = display.bounds
        
        // Calculate how much of the window is within this display
        const overlapX = Math.max(0, Math.min(bounds.x + bounds.width, displayBounds.x + displayBounds.width) - Math.max(bounds.x, displayBounds.x))
        const overlapY = Math.max(0, Math.min(bounds.y + bounds.height, displayBounds.y + displayBounds.height) - Math.max(bounds.y, displayBounds.y))
        const overlapArea = overlapX * overlapY
        const windowArea = bounds.width * bounds.height
        const overlapPercentage = overlapArea / windowArea
        
        console.log(`Display ${displayBounds.x},${displayBounds.y}: overlap ${overlapX}x${overlapY} = ${overlapArea}, window area = ${windowArea}, percentage = ${(overlapPercentage * 100).toFixed(1)}%`)
        
        // Consider valid if at least 50% of the window is within the display
        if (overlapPercentage >= 0.5) {
            console.log("Bounds valid for display:", displayBounds, `(${(overlapPercentage * 100).toFixed(1)}% overlap)`)
            return true
        }
    }
    
    console.log("Bounds invalid for all displays")
    return false
}

function launchMainWindow(startUrl, modifyUserAgent, windowState, onWindowStateChange) {
    console.log("Launching main window", startUrl, windowState)
    
    // Validate window bounds if we have saved state
    let useSavedBounds = false
    let initialBounds = { width: 800, height: 600 }
    
    if (windowState && windowState.x !== undefined && windowState.y !== undefined) {
        const bounds = {
            x: windowState.x,
            y: windowState.y,
            width: windowState.width || 800,
            height: windowState.height || 600
        }
        
        if (validateWindowBounds(bounds)) {
            useSavedBounds = true
            initialBounds = bounds
            console.log("Using saved window bounds:", bounds)
        } else {
            console.log("Saved window bounds invalid, using default positioning")
        }
    }
    
    const mainWindow = new BrowserWindow({
        width: initialBounds.width,
        height: initialBounds.height,
        center: false,
        show: false,
        useContentSize: false,
        resizable: true,
        movable: true
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

    // Set position after window is ready but before showing
    if (useSavedBounds) {
        mainWindow.once('ready-to-show', () => {
            console.log("Window ready, setting bounds to:", initialBounds)
            mainWindow.setBounds(initialBounds)
            mainWindow.setPosition(initialBounds.x, initialBounds.y)
            
            // Show window after position is set
            mainWindow.show()
            
            // Debug: Check final position
            setTimeout(() => {
                const finalBounds = mainWindow.getBounds()
                console.log("Final window bounds after show:", finalBounds)
            }, 100)
        })
    } else {
        // Show window immediately if no saved bounds
        mainWindow.show()
        
        // Debug: Check final position
        setTimeout(() => {
            const finalBounds = mainWindow.getBounds()
            console.log("Final window bounds after show:", finalBounds)
        }, 100)
    }

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