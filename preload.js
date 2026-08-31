const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  startDrag: () => ipcRenderer.send("start-drag"),
  dragMove: (x, y) => ipcRenderer.send("drag-move", { mouseScreenX: x, mouseScreenY: y }),
  togglePanel: (expand) => ipcRenderer.send("toggle-panel", expand),
  closeApp: () => ipcRenderer.send("close-app"),
  selectFile: () => ipcRenderer.invoke("select-file"),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  openExternal: (data) => ipcRenderer.send("open-external", data)
});