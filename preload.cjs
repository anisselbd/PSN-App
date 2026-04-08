// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("psnAPI", {
  getFriends: (limit) => ipcRenderer.invoke("psn:getFriends", limit),
  getMyProfile: () => ipcRenderer.invoke("psn:getMyProfile"),
  getTrophyTitles: (offset, limit) =>
    ipcRenderer.invoke("psn:getTrophyTitles", offset, limit),
  getTrophiesForTitle: (npCommunicationId, npServiceName) =>
    ipcRenderer.invoke("psn:getTrophiesForTitle", npCommunicationId, npServiceName),
});
