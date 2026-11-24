// Bridge for the hidden clip recorder page: it can only hand a finished clip
// back to Moony to be saved, and report its status.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("clipper", {
  save: (bytes, ext) => ipcRenderer.invoke("clipper:save", { bytes, ext }),
  status: (s) => ipcRenderer.send("clipper:status", s),
});
