const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setup", {
  install: (opts) => ipcRenderer.invoke("setup:install", opts),
  onProgress: (cb) => ipcRenderer.on("setup:progress", (_e, p) => cb(p)),
  launch: () => ipcRenderer.send("setup:launch"),
  close: () => ipcRenderer.send("setup:close"),
  minimize: () => ipcRenderer.send("setup:minimize"),
});
