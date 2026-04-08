// main.mjs
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFriends } from "./src/psn-friends.js";
import { fetchMyProfile } from "./src/psn-profile.js";
import {
  fetchTrophyTitles,
  fetchTrophiesForTitle,
  compareTrophies,
  fetchPlayerTrophyTitles,
} from "./src/psn-trophies.js";
import { fetchPlayedGames } from "./src/psn-games.js";
import { searchPlayers, fetchPlayerProfile } from "./src/psn-search.js";
import { setupTray } from "./src/tray.js";
import { startMonitor, stopMonitor, getActivityHistory } from "./src/presence-monitor.js";
import { staleWhileRevalidate } from "./src/cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile("index.html");

  mainWindow.on("close", (e) => {
    if (process.platform === "darwin" && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupTray(mainWindow);
  startMonitor(mainWindow);

  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopMonitor();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// === IPC Handlers avec cache stale-while-revalidate ===

ipcMain.handle("psn:getFriends", async (_event, limit = 50) => {
  try {
    const { data, fromCache } = await staleWhileRevalidate(
      `friends-${limit}`,
      () => fetchFriends(limit),
      null // pas de callback — le cache se met à jour silencieusement
    );
    return { ok: true, data, fromCache };
  } catch (err) {
    console.error("[ipc] psn:getFriends error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getMyProfile", async () => {
  try {
    const { data, fromCache } = await staleWhileRevalidate(
      "my-profile",
      () => fetchMyProfile(),
      (fresh) => sendToRenderer("psn:freshData", { key: "profile", data: fresh })
    );
    return { ok: true, data, fromCache };
  } catch (err) {
    console.error("[ipc] psn:getMyProfile error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getTrophyTitles", async (_event, offset = 0, limit = 50) => {
  try {
    const { data, fromCache } = await staleWhileRevalidate(
      `trophy-titles-${offset}-${limit}`,
      () => fetchTrophyTitles(offset, limit),
      (fresh) => sendToRenderer("psn:freshData", { key: "trophyTitles", data: fresh })
    );
    return { ok: true, data, fromCache };
  } catch (err) {
    console.error("[ipc] psn:getTrophyTitles error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getTrophiesForTitle", async (_event, npCommunicationId, npServiceName) => {
  try {
    const { data, fromCache } = await staleWhileRevalidate(
      `trophies-${npCommunicationId}`,
      () => fetchTrophiesForTitle(npCommunicationId, npServiceName),
      (fresh) => sendToRenderer("psn:freshData", { key: `trophies-${npCommunicationId}`, data: fresh })
    );
    return { ok: true, data, fromCache };
  } catch (err) {
    console.error("[ipc] psn:getTrophiesForTitle error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getPlayedGames", async (_event, offset = 0, limit = 50) => {
  try {
    const { data, fromCache } = await staleWhileRevalidate(
      `played-games-${offset}-${limit}`,
      () => fetchPlayedGames(offset, limit),
      (fresh) => sendToRenderer("psn:freshData", { key: "playedGames", data: fresh })
    );
    return { ok: true, data, fromCache };
  } catch (err) {
    console.error("[ipc] psn:getPlayedGames error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

// Pas de cache pour la recherche (requêtes dynamiques)
ipcMain.handle("psn:searchPlayers", async (_event, query) => {
  try {
    const result = await searchPlayers(query);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:searchPlayers error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getPlayerProfile", async (_event, accountId) => {
  try {
    const { data, fromCache } = await staleWhileRevalidate(
      `player-${accountId}`,
      () => fetchPlayerProfile(accountId),
      (fresh) => sendToRenderer("psn:freshData", { key: `player-${accountId}`, data: fresh })
    );
    return { ok: true, data, fromCache };
  } catch (err) {
    console.error("[ipc] psn:getPlayerProfile error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getPlayerTrophyTitles", async (_event, accountId) => {
  try {
    const result = await fetchPlayerTrophyTitles(accountId);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:getPlayerTrophyTitles error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:compareTrophies", async (_event, npCommunicationId, npServiceName, otherAccountId) => {
  try {
    const result = await compareTrophies(npCommunicationId, npServiceName, otherAccountId);
    return { ok: true, data: result };
  } catch (err) {
    console.error("[ipc] psn:compareTrophies error:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});

ipcMain.handle("psn:getActivityHistory", () => {
  return { ok: true, data: getActivityHistory() };
});
