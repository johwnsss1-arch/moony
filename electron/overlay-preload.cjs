const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moonyOverlay", {
  onState: (cb) => ipcRenderer.on("overlay:state", (_e, s) => cb(s)),
});
