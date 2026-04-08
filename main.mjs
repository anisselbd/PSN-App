// main.mjs
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFriends } from "./src/psn.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
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

// IPC pour récupérer les amis PSN depuis le front
ipcMain.handle("psn:getFriends", async (_event, limit = 50) => {
  try {
    const result = await fetchFriends(limit);
    return { ok: true, data: result };
  } catch (err) {
    console.error("Erreur PSN dans main:", err);
    return { ok: false, error: err.message || "Erreur inconnue" };
  }
});
