const { BrowserWindow, screen } = require('electron')

function getWindowState(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return null
    }
    
    const bounds = mainWindow.getBounds()
    const isMaximized = mainWindow.isMaximized()
    const isFullScreen = mainWindow.isFullScreen()
    const isDevToolsOpen = mainWindow.webContents.isDevToolsOpened()
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    
    return {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: isMaximized,
        fullscreen: isFullScreen,
        devToolsOpen: isDevToolsOpen,
        alwaysOnTop: isAlwaysOnTop
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

function launchMainWindow(startUrl, modifyUserAgent, windowState, getConfig, modifyConfig) {
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
        try {
            if (isDashboardUrl(url)) {
                console.log('did-navigate-in-page dashboard URL detected');
                clearIdleTimeout();
                modifyConfig((oldConfig) => {
                    if (oldConfig.startUrl !== url) {
                        console.log('Updated config.startUrl to', url)
                        return { ...oldConfig, startUrl: url }
                    }
                    return oldConfig
                })
            } else {
                startIdleTimeout(url);
            }
        } catch (e) {
            console.log("did-navigate-in-page error", e);
        }
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

    // Set window open handler - this is the modern way to handle window.open
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
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
            
            // Add keyboard shortcut for Ctrl+= (zoom in) in addition to default Ctrl++
            mainWindow.webContents.on('before-input-event', (event, input) => {
                if (input.control && input.key === '=' && !input.shift) {
                    event.preventDefault()
                    const currentZoom = mainWindow.webContents.getZoomLevel()
                    mainWindow.webContents.setZoomLevel(currentZoom + 1)
                }
            })
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
        
        if (windowState.alwaysOnTop) {
            mainWindow.setAlwaysOnTop(true)
        }
    } else {
        // Open dev tools initially if no state saved
        mainWindow.webContents.openDevTools()
    }

    // For window state changes, use modifyConfig
    if (modifyConfig) {
        let saveTimeout = null
        const saveState = () => {
            const state = getWindowState(mainWindow)
            if (state) {
                if (saveTimeout) clearTimeout(saveTimeout)
                saveTimeout = setTimeout(() => {
                    modifyConfig((oldConfig) => ({ ...oldConfig, windowState: state }))
                }, 1000)
            }
        }
        mainWindow.on('resize', () => {
            if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) saveState()
        })
        mainWindow.on('move', () => {
            if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) saveState()
        })
        mainWindow.on('maximize', saveState)
        mainWindow.on('unmaximize', saveState)
        mainWindow.on('enter-full-screen', saveState)
        mainWindow.on('leave-full-screen', saveState)
        mainWindow.webContents.on('devtools-opened', saveState)
        mainWindow.webContents.on('devtools-closed', saveState)
    }
    
    // Place after mainWindow is created
    let idleTimeout = null;
    let lastIdleUrl = null;
    function clearIdleTimeout() {
        if (idleTimeout) {
            clearTimeout(idleTimeout);
            idleTimeout = null;
        }
    }
    function startIdleTimeout(url) {
        clearIdleTimeout();
        const config = getConfig();
        if (!config.idleTimeoutSeconds || config.idleTimeoutSeconds <= 0) return;
        lastIdleUrl = url;
        console.log(`[IdleTimeout] Started: ${config.idleTimeoutSeconds}s for URL: ${url}`);
        idleTimeout = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                console.log('[IdleTimeout] Timeout reached, returning to main page:', getConfig().startUrl);
                mainWindow.loadURL(getConfig().startUrl);
            }
        }, config.idleTimeoutSeconds * 1000);
    }
    function isDashboardUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.pathname.startsWith('/protect/dashboard');
        } catch (e) {
            return false;
        }
    }
    mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
        if (!isDashboardUrl(url)) {
            startIdleTimeout(url);
        } else {
            clearIdleTimeout();
        }
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!isDashboardUrl(url)) {
            startIdleTimeout(url);
        } else {
            clearIdleTimeout();
        }
    });
    mainWindow.webContents.on('dom-ready', () => {
        mainWindow.webContents.executeJavaScript(`
            (function() {
                let lastActivity = Date.now();
                function resetIdle() {
                    window.postMessage('reset-idle-timer', '*');
                }
                window.addEventListener('mousemove', resetIdle);
                window.addEventListener('mousedown', resetIdle);
                window.addEventListener('keydown', resetIdle);
            })();
        `);
    });
    mainWindow.webContents.on('console-message', (event, level, message) => {
        if (message === 'reset-idle-timer') {
            clearIdleTimeout();
            if (lastIdleUrl && !isDashboardUrl(lastIdleUrl)) {
                startIdleTimeout(lastIdleUrl);
            }
        }
    });
    mainWindow.webContents.on('ipc-message', (event, channel) => {
        if (channel === 'reset-idle-timer') {
            clearIdleTimeout();
            if (lastIdleUrl && !isDashboardUrl(lastIdleUrl)) {
                startIdleTimeout(lastIdleUrl);
            }
        }
    });
    
    return mainWindow
}

module.exports = { launchMainWindow, getWindowState } 