// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("psnAPI", {
  getFriends: (limit) => ipcRenderer.invoke("psn:getFriends", limit),
  getMyProfile: () => ipcRenderer.invoke("psn:getMyProfile"),
});
