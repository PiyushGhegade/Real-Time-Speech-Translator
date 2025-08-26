const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
    setFocusable: (focusable) => ipcRenderer.invoke('overlay:setFocusable', focusable),
    onScale: (handler) => ipcRenderer.on('overlay:scale', (_e, factor) => handler(factor))
});



