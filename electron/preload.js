// Puente mínimo entre la interfaz y el sistema: solo estas cuatro funciones.
// La interfaz no tiene acceso a Node.js ni al resto del disco.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('esoDesktop', {
  saveFile: (name, data) => ipcRenderer.invoke('eso:saveFile', name, data),
  getOutputFolder: () => ipcRenderer.invoke('eso:getOutputFolder'),
  chooseOutputFolder: () => ipcRenderer.invoke('eso:chooseOutputFolder'),
  openOutputFolder: () => ipcRenderer.invoke('eso:openOutputFolder'),
});
