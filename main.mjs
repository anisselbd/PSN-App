// main.mjs
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFriends } from "./src/psn-friends.js";
import { fetchMyProfile } from "./src/psn-profile.js";
import {
  fetchTrophyTitles,
  fetchTrophiesForTitle,
} from "./src/psn-trophies.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#06080f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// === IPC Handlers ===

ipcMain.handle("psn:getFriends", async (_event, limit = 50) => {
  try {
    const result = await fetchFriends(limit);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:getFriends error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getMyProfile", async () => {
  try {
    const result = await fetchMyProfile();
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:getMyProfile error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getTrophyTitles", async (_event, offset = 0, limit = 50) => {
  try {
    const result = await fetchTrophyTitles(offset, limit);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:getTrophyTitles error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getTrophiesForTitle", async (_event, npCommunicationId, npServiceName) => {
  try {
    const result = await fetchTrophiesForTitle(npCommunicationId, npServiceName);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:getTrophiesForTitle error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});
