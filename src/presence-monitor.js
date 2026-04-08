// src/presence-monitor.js
import { Notification } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFriends } from "./psn-friends.js";
import { updateTrayMenu } from "./tray.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, "..", ".cache", "activity-history.json");
const POLL_INTERVAL = 5 * 60 * 1000;
const MAX_HISTORY = 200;

let previousState = new Map();
let intervalId = null;
let mainWindow = null;
let activityHistory = [];

// Charger l'historique depuis le disque
try {
  if (fs.existsSync(HISTORY_FILE)) {
    activityHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  }
} catch {}

function saveHistory() {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(activityHistory));
  } catch {}
}

function addEvent(type, friend, detail) {
  activityHistory.unshift({
    type,
    onlineId: friend.onlineId,
    avatarUrl: friend.avatarUrl,
    detail,
    timestamp: new Date().toISOString(),
  });
  if (activityHistory.length > MAX_HISTORY) {
    activityHistory = activityHistory.slice(0, MAX_HISTORY);
  }
  saveHistory();
}

export function getActivityHistory() {
  return activityHistory;
}

function notify(title, body) {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body, silent: false });
    notif.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
  }
}

function detectChanges(friends) {
  if (previousState.size === 0) return;

  for (const friend of friends) {
    const prev = previousState.get(friend.accountId);
    const isOnline = friend.presence?.isOnline ?? false;
    const titleName = friend.presence?.titleName ?? null;

    if (!prev) continue;

    if (isOnline && !prev.isOnline) {
      const gameText = titleName ? ` — joue a ${titleName}` : "";
      notify(`${friend.onlineId} est en ligne`, `Ton ami vient de se connecter${gameText}`);
      addEvent("online", friend, titleName);
    } else if (!isOnline && prev.isOnline) {
      addEvent("offline", friend, null);
    } else if (isOnline && prev.isOnline && titleName && titleName !== prev.titleName) {
      notify(`${friend.onlineId}`, `Joue maintenant a ${titleName}`);
      addEvent("game", friend, titleName);
    }
  }
}

async function poll() {
  try {
    const result = await fetchFriends(100);
    const friends = result.friends;
    const onlineCount = friends.filter((f) => f.presence?.isOnline).length;

    updateTrayMenu(mainWindow, onlineCount);
    detectChanges(friends);

    previousState.clear();
    for (const f of friends) {
      previousState.set(f.accountId, {
        isOnline: f.presence?.isOnline ?? false,
        titleName: f.presence?.titleName ?? null,
      });
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("psn:presenceUpdate", { onlineCount, friends });
    }
  } catch (err) {
    console.warn("[monitor] Erreur polling:", err.message);
  }
}

export function startMonitor(win) {
  mainWindow = win;
  setTimeout(() => {
    poll();
    intervalId = setInterval(poll, POLL_INTERVAL);
  }, 30_000);
}

export function stopMonitor() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
