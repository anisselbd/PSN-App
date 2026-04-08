// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("psnAPI", {
  getFriends: (limit) => ipcRenderer.invoke("psn:getFriends", limit),
  getMyProfile: () => ipcRenderer.invoke("psn:getMyProfile"),
  getTrophyTitles: (offset, limit) =>
    ipcRenderer.invoke("psn:getTrophyTitles", offset, limit),
  getTrophiesForTitle: (npCommunicationId, npServiceName) =>
    ipcRenderer.invoke("psn:getTrophiesForTitle", npCommunicationId, npServiceName),
  getPlayedGames: (offset, limit) =>
    ipcRenderer.invoke("psn:getPlayedGames", offset, limit),
  searchPlayers: (query) =>
    ipcRenderer.invoke("psn:searchPlayers", query),
  getPlayerProfile: (accountId) =>
    ipcRenderer.invoke("psn:getPlayerProfile", accountId),
  getPlayerTrophyTitles: (accountId) =>
    ipcRenderer.invoke("psn:getPlayerTrophyTitles", accountId),
  compareTrophies: (npCommunicationId, npServiceName, otherAccountId) =>
    ipcRenderer.invoke("psn:compareTrophies", npCommunicationId, npServiceName, otherAccountId),
  onPresenceUpdate: (callback) => {
    ipcRenderer.on("psn:presenceUpdate", (_event, data) => callback(data));
  },
  getActivityHistory: () => ipcRenderer.invoke("psn:getActivityHistory"),
  onFreshData: (callback) => {
    ipcRenderer.on("psn:freshData", (_event, data) => callback(data));
  },
});
