const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');

let overlayWindow = null;
let tray = null;
let clickThroughEnabled = true;

function createOverlayWindow() {
    overlayWindow = new BrowserWindow({
        width: 1000,
        height: 200,
        transparent: true,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        focusable: false,
        skipTaskbar: true,
        fullscreenable: false,
        type: 'toolbar',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true
        }
    });

    // Position bottom center by default
    const { width, height } = overlayWindow.getBounds();
    const { workAreaSize } = require('electron').screen.getPrimaryDisplay();
    overlayWindow.setBounds({
        x: Math.floor((workAreaSize.width - width) / 2),
        y: workAreaSize.height - height - 40,
        width,
        height
    });

    overlayWindow.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
    overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
}

function createTray() {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Toggle Click-Through', type: 'checkbox', checked: clickThroughEnabled, click: toggleClickThrough },
        { label: 'Increase Size', click: () => overlayWindow.webContents.send('overlay:scale', 1.1) },
        { label: 'Decrease Size', click: () => overlayWindow.webContents.send('overlay:scale', 0.9) },
        { type: 'separator' },
        { label: 'Show DevTools', click: () => overlayWindow.webContents.openDevTools({ mode: 'detach' }) },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('Subtitle Overlay');
    tray.setContextMenu(contextMenu);
}

function toggleClickThrough(menuItem) {
    clickThroughEnabled = !clickThroughEnabled;
    overlayWindow.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
    if (menuItem) menuItem.checked = clickThroughEnabled;
}

function registerShortcuts() {
    // Toggle click-through
    globalShortcut.register('CommandOrControl+Shift+T', () => toggleClickThrough());
    // Re-center bottom
    globalShortcut.register('CommandOrControl+Shift+C', () => {
        const { width, height } = overlayWindow.getBounds();
        const { workAreaSize } = require('electron').screen.getPrimaryDisplay();
        overlayWindow.setBounds({
            x: Math.floor((workAreaSize.width - width) / 2),
            y: workAreaSize.height - height - 40,
            width,
            height
        });
    });
}

app.whenReady().then(() => {
    createOverlayWindow();
    createTray();
    registerShortcuts();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
    });
});

app.on('window-all-closed', () => {
    // Keep running in tray
});

app.on('before-quit', () => {
    globalShortcut.unregisterAll();
});

// Allow renderer to toggle focusable when user hovers overlay borders
ipcMain.handle('overlay:setFocusable', (_e, value) => {
    if (!overlayWindow) return;
    overlayWindow.setFocusable(!!value);
    if (!value) overlayWindow.blur();
});




