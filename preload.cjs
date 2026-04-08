// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("psnAPI", {
  getFriends: async (limit) => {
    return await ipcRenderer.invoke("psn:getFriends", limit);
  },
});
