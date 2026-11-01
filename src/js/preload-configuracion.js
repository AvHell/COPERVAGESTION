const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    configurarConexion: datos => ipcRenderer.invoke('db-config:guardar', datos)
});
