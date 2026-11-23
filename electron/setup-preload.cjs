const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setup", {
  install: (opts) => ipcRenderer.invoke("setup:install", opts),
  onProgress: (cb) => ipcRenderer.on("setup:progress", (_e, p) => cb(p)),
  launch: (link) => ipcRenderer.send("setup:launch", !!link),
  close: () => ipcRenderer.send("setup:close"),
  minimize: () => ipcRenderer.send("setup:minimize"),
});
