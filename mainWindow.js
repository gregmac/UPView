const { BrowserWindow, screen, safeStorage } = require('electron')

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
        // Try auto-login on navigation
        try { attemptAutoLogin(url) } catch (e) { console.warn('[AutoLogin] did-navigate error', e) }
    })
    mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
        console.log('did-navigate-in-page', event, url, isMainFrame)
        try {
            if (isIdleExemptUrl(url)) {
                console.log('did-navigate-in-page idle-exempt URL detected');
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
            // Try auto-login on in-page navigation
            try { attemptAutoLogin(url) } catch (e) { console.warn('[AutoLogin] did-navigate-in-page error', e) }
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
    let idleResumeTimer = null;
    let lastIdleUrl = null;
    let isEnlargedView = false;
    let idleTimeoutExpiryMs = null;
    function clearIdleTimeout() {
        if (idleTimeout) {
            clearTimeout(idleTimeout);
            idleTimeout = null;
        }
        if (idleResumeTimer) {
            clearTimeout(idleResumeTimer);
            idleResumeTimer = null;
        }
        idleTimeoutExpiryMs = null;
        hideIdleOverlay();
    }
    function startIdleTimeout(url) {
        clearIdleTimeout();
        const config = getConfig();
        if (!config.idleTimeoutSeconds || config.idleTimeoutSeconds <= 0) return;
        lastIdleUrl = url;
        console.log(`[IdleTimeout] Started: ${config.idleTimeoutSeconds}s for URL: ${url}`);
        idleTimeoutExpiryMs = Date.now() + (config.idleTimeoutSeconds * 1000);
        showIdleOverlay(idleTimeoutExpiryMs);
        idleTimeout = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                const currentUrl = mainWindow.webContents.getURL();
                if (isEnlargedView && isIdleExemptUrl(currentUrl)) {
                    console.log('[IdleTimeout] Timeout reached while enlarged on dashboard, exiting enlarged view');
                    exitEnlargedView();
                } else {
                    console.log('[IdleTimeout] Timeout reached, returning to main page:', getConfig().startUrl);
                    mainWindow.loadURL(getConfig().startUrl);
                }
            }
        }, config.idleTimeoutSeconds * 1000);
    }
    function showIdleOverlay(deadlineMs) {
        const script = `(() => {
            (function(deadline){
                try {
                    const id = 'uplv-idle-overlay';
                    let el = document.getElementById(id);
                    if (!el) {
                        el = document.createElement('div');
                        el.id = id;
                        el.style.position = 'fixed';
                        el.style.right = '12px';
                        el.style.bottom = '12px';
                        el.style.zIndex = '2147483647';
                        el.style.background = 'rgba(0,0,0,0.7)';
                        el.style.color = '#fff';
                        el.style.padding = '8px 10px';
                        el.style.borderRadius = '8px';
                        el.style.fontFamily = 'Segoe UI, Arial, sans-serif';
                        el.style.fontSize = '12px';
                        el.style.lineHeight = '1.2';
                        el.style.pointerEvents = 'none';
                        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                        el.textContent = 'Returning in …';
                        document.documentElement.appendChild(el);
                    }
                    if (!window.__uplvIdle) window.__uplvIdle = {};
                    window.__uplvIdle.deadline = deadline;
                    if (window.__uplvIdle.timer) clearInterval(window.__uplvIdle.timer);
                    function update() {
                        const now = Date.now();
                        const remainMs = Math.max(0, (window.__uplvIdle.deadline || 0) - now);
                        const secs = Math.ceil(remainMs / 1000);
                        const text = secs > 0 ? ('Returning in ' + secs + 's') : 'Returning…';
                        const n = document.getElementById(id);
                        if (n) n.textContent = text;
                        if (remainMs <= 0) {
                            clearInterval(window.__uplvIdle.timer);
                            window.__uplvIdle.timer = null;
                        }
                    }
                    update();
                    window.__uplvIdle.timer = setInterval(update, 1000);
                } catch(e) { /* ignore */ }
            })(${deadlineMs});
        })();`;
        try { mainWindow.webContents.executeJavaScript(script); } catch (_) {}
    }
    function hideIdleOverlay() {
        const script = `(() => {
            try {
                if (window.__uplvIdle && window.__uplvIdle.timer) { clearInterval(window.__uplvIdle.timer); window.__uplvIdle.timer = null; }
                const el = document.getElementById('uplv-idle-overlay');
                if (el && el.parentNode) el.parentNode.removeChild(el);
            } catch(_) {}
        })();`;
        try { mainWindow.webContents.executeJavaScript(script); } catch (_) {}
    }
    
    function exitEnlargedView() {
        const script = `(() => {
            try {
                // Find the enlarged viewport element
                const enlargedElement = document.querySelector('div[style*="position: absolute"][style*="inset: 0px"][style*="width: 100%"][style*="height: 100%"]');
                if (enlargedElement) {
                    // Look for video elements within the enlarged viewport
                    const videos = enlargedElement.querySelectorAll('video');
                    if (videos.length > 0) {
                        console.log('[ExitEnlarged] Clicking video to exit enlarged view');
                        videos[0].click();
                        return true;
                    }
                }
                console.log('[ExitEnlarged] No enlarged view found to exit');
                return false;
            } catch(e) {
                console.log('[ExitEnlarged] Error:', e);
                return false;
            }
        })();`;
        try { 
            mainWindow.webContents.executeJavaScript(script).then((result) => {
                if (result) {
                    console.log('[ExitEnlarged] Successfully exited enlarged view');
                }
            });
        } catch (_) {}
    }
    function isIdleExemptUrl(url) {
        try {
            const parsedUrl = new URL(url);
            const pathname = parsedUrl.pathname;
            return pathname.startsWith('/protect/dashboard') || pathname.startsWith('/login');
        } catch (e) {
            return false;
        }
    }

    function isLoginPath(url) {
        try {
            const parsed = new URL(url);
            return parsed.pathname.startsWith('/login');
        } catch (e) { return false }
    }

    function isSameHost(urlA, urlB) {
        try {
            const a = new URL(urlA);
            const b = new URL(urlB);
            const portA = a.port || (a.protocol === 'https:' ? '443' : '80');
            const portB = b.port || (b.protocol === 'https:' ? '443' : '80');
            return (a.hostname.toLowerCase() === b.hostname.toLowerCase()) && (portA === portB);
        } catch (e) { return false }
    }

    let lastAutoLoginUrl = null;
    let lastAutoLoginTimestamp = 0;
    function attemptAutoLogin(navigateUrl) {
        try {
            if (!isLoginPath(navigateUrl)) return;
            const cfg = getConfig();
            if (!cfg || !cfg.startUrl) return;
            if (!isSameHost(navigateUrl, cfg.startUrl)) return;
            if (!cfg.username || !cfg.passwordEnc) return;
            if (!safeStorage.isEncryptionAvailable()) return;

            if (lastAutoLoginUrl === navigateUrl && Date.now() - lastAutoLoginTimestamp < 5000) return;
            lastAutoLoginUrl = navigateUrl;
            lastAutoLoginTimestamp = Date.now();

            let passwordPlain = '';
            try {
                passwordPlain = safeStorage.decryptString(Buffer.from(cfg.passwordEnc, 'base64'));
            } catch (e) {
                console.warn('[AutoLogin] Decrypt failed', e);
                return;
            }

            const usernameJson = JSON.stringify(cfg.username);
            const passwordJson = JSON.stringify(passwordPlain);
            const script = `(() => {
                const username = ${usernameJson};
                const password = ${passwordJson};
                function setValue(el, val) {
                    if (!el) return;
                    try {
                        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
                        d && d.set && d.set.call(el, val);
                    } catch (_) { el.value = val; }
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                function findInputs() {
                    const pass = document.querySelector('input[type="password"]');
                    if (!pass) return null;
                    let user = document.querySelector('input[name*="user" i], input[name*="email" i], input[type="email"], input[type="text"]');
                    if (user === pass) {
                        const cands = Array.from(document.querySelectorAll('input[type="text"], input[type="email"]')).filter(i => i !== pass);
                        user = cands[0] || null;
                    }
                    return { user, pass };
                }
                function findSubmit(form) {
                    const scope = form || document;
                    let btn = scope.querySelector('button[type="submit"], input[type="submit"]');
                    if (!btn) btn = scope.querySelector('button');
                    return btn;
                }
                function tryFill() {
                    const found = findInputs();
                    if (!found) return false;
                    const { user, pass } = found;
                    if (user) setValue(user, username);
                    if (pass) setValue(pass, password);
                    // Ensure "Remember my credentials" is checked if present
                    const remember = document.querySelector('input#rememberMe, input[name="rememberMe"], input[data-id="rememberMe"], [role="checkbox"]#rememberMe, [role="checkbox"][name="rememberMe"], [role="checkbox"][data-id="rememberMe"]');
                    if (remember && !remember.checked) {
                        try { remember.click(); } catch(_) {}
                    }
                    const form = (pass && pass.form) || (user && user.form) || document.querySelector('form');
                    const btn = findSubmit(form);
                    if (btn) btn.click();
                    else if (form) form.submit();
                    return true;
                }
                return new Promise((resolve) => {
                    const start = Date.now();
                    (function loop() {
                        if (tryFill()) { console.log('[AutoLogin] Filled and submitted'); resolve(true); return; }
                        if (Date.now() - start > 10000) { console.warn('[AutoLogin] Timed out waiting for login form'); resolve(false); return; }
                        requestAnimationFrame(loop);
                    })();
                });
            })();`;

            mainWindow.webContents.executeJavaScript(script).catch((e) => {
                console.warn('[AutoLogin] Injection error', e);
            });
        } catch (e) {
            console.warn('[AutoLogin] attempt error', e);
        }
    }
    mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
        if (!isIdleExemptUrl(url)) {
            startIdleTimeout(url);
        } else {
            clearIdleTimeout();
        }
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!isIdleExemptUrl(url)) {
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
                    console.log('reset-idle-timer');
                }
                window.addEventListener('mousemove', resetIdle);
                window.addEventListener('mousedown', resetIdle);
                window.addEventListener('keydown', resetIdle);
            })();
        `);
        // Watch for enlarge/shrink by observing style/class mutations on live-view containers
        mainWindow.webContents.executeJavaScript(`
            (function() {
                if (window.__uplvEnlargeWatchInstalled) return; 
                window.__uplvEnlargeWatchInstalled = true;
                
                function isCandidate(el) {
                    if (!el || !el.className) return false;
                    const s = el.className.toString();
                    return /ZoomableViewport|liveview__Viewport|ViewportLiveStreamPlayer|LiveStreamPlayerClickCaptureOverlay/i.test(s);
                }
                
                function hasEnlargedStyle(el) {
                    if (!el) return false;
                    
                    // Check inline style first
                    const styleAttr = (el.getAttribute && el.getAttribute('style')) || '';
                    if (styleAttr) {
                        const hasPosition = /position\\s*:\\s*absolute/i.test(styleAttr);
                        const hasInset = /inset\\s*:\\s*0(px)?/i.test(styleAttr);
                        const hasFullSize = /width\\s*:\\s*100%/i.test(styleAttr) && /height\\s*:\\s*100%/i.test(styleAttr);
                        
                        if (hasPosition && hasInset && hasFullSize) {
                            console.log('[EnlargeWatch] Found enlarged element:', el.className, styleAttr);
                            return true;
                        }
                    }
                    
                    // Fallback to computed style
                    try {
                        const cs = getComputedStyle(el);
                        const pos = cs.position;
                        const width = cs.width;
                        const height = cs.height;
                        
                        if (pos === 'absolute' && width === '100%' && height === '100%') {
                            console.log('[EnlargeWatch] Found enlarged element (computed):', el.className, pos, width, height);
                            return true;
                        }
                    } catch(e) {
                        console.log('[EnlargeWatch] Error checking computed style:', e);
                    }
                    
                    return false;
                }
                
                function detect() {
                    const nodes = Array.from(document.querySelectorAll('div'));
                    let found = false;
                    
                    for (const el of nodes) {
                        if (!isCandidate(el)) continue;
                        if (hasEnlargedStyle(el)) {
                            found = true;
                            break;
                        }
                    }
                    
                    if (document.fullscreenElement) {
                        console.log('[EnlargeWatch] Fullscreen element found');
                        found = true;
                    }
                    
                    console.log('[EnlargeWatch] Detection result:', found);
                    return found;
                }
                
                function setState(on) {
                    if (!window.__uplvEnlargedState || window.__uplvEnlargedState !== !!on) {
                        window.__uplvEnlargedState = !!on;
                        console.log(on ? 'uplv-enlarged-on' : 'uplv-enlarged-off');
                    }
                }
                
                const observer = new MutationObserver((muts) => {
                    let relevant = false;
                    for (const m of muts) {
                        if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                            const t = m.target;
                            if (t && t.nodeType === 1 && isCandidate(t)) {
                                console.log('[EnlargeWatch] Relevant mutation:', m.attributeName, t.className);
                                relevant = true;
                                break;
                            }
                        }
                    }
                    if (relevant) {
                        console.log('[EnlargeWatch] Checking state after mutation');
                        setState(detect());
                    }
                });
                
                observer.observe(document.documentElement, { 
                    subtree: true, 
                    childList: true, 
                    attributes: true, 
                    attributeFilter: ['style','class'] 
                });
                
                window.addEventListener('fullscreenchange', () => {
                    console.log('[EnlargeWatch] Fullscreen change event');
                    setState(detect());
                }, true);
                
                // Initial detection
                console.log('[EnlargeWatch] Initial detection');
                setState(detect());
            })();
        `);
        try { attemptAutoLogin(mainWindow.webContents.getURL()) } catch (e) { console.warn('[AutoLogin] dom-ready error', e) }
        // Re-show overlay after navigations if timeout is active
        if (idleTimeoutExpiryMs && idleTimeoutExpiryMs > Date.now()) {
            try { showIdleOverlay(idleTimeoutExpiryMs); } catch(_) {}
        }
    });
    mainWindow.webContents.on('console-message', (event, level, message) => {
        if (message === 'reset-idle-timer') {
            clearIdleTimeout();
            if (idleResumeTimer) clearTimeout(idleResumeTimer);
            idleResumeTimer = setTimeout(() => {
                try {
                    const currentUrl = mainWindow.webContents.getURL();
                    // Start timer if not on exempt URL, OR if we're in an enlarged view (even on dashboard)
                    if (!isIdleExemptUrl(currentUrl) || isEnlargedView) {
                        startIdleTimeout(currentUrl);
                    }
                } catch(_) {}
            }, 1000);
        } else if (message === 'uplv-enlarged-on') {
            isEnlargedView = true;
            try {
                const currentUrl = mainWindow.webContents.getURL();
                // Start timer even on dashboard when enlarged
                startIdleTimeout(currentUrl);
            } catch(_) {}
        } else if (message === 'uplv-enlarged-off') {
            isEnlargedView = false;
            // If on exempt URL (dashboard/login), clear the timer when shrink back
            try {
                const currentUrl = mainWindow.webContents.getURL();
                if (isIdleExemptUrl(currentUrl)) {
                    clearIdleTimeout();
                }
            } catch(_) {}
        }
    });
    mainWindow.webContents.on('ipc-message', (event, channel) => {
        if (channel === 'reset-idle-timer') {
            clearIdleTimeout();
            if (idleResumeTimer) clearTimeout(idleResumeTimer);
            idleResumeTimer = setTimeout(() => {
                try {
                    const currentUrl = mainWindow.webContents.getURL();
                    // Start timer if not on exempt URL, OR if we're in an enlarged view (even on dashboard)
                    if (!isIdleExemptUrl(currentUrl) || isEnlargedView) {
                        startIdleTimeout(currentUrl);
                    }
                } catch(_) {}
            }, 1000);
        }
    });
    
    return mainWindow
}

module.exports = { launchMainWindow, getWindowState } 