// src/presence-monitor.js
import { Notification } from "electron";
import { fetchFriends } from "./psn-friends.js";
import { updateTrayMenu } from "./tray.js";

const POLL_INTERVAL = 3 * 60 * 1000; // 3 minutes

let previousState = new Map(); // accountId -> { isOnline, titleName }
let intervalId = null;
let mainWindow = null;

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
  // Pas de comparaison au premier poll
  if (previousState.size === 0) return;

  for (const friend of friends) {
    const prev = previousState.get(friend.accountId);
    const isOnline = friend.presence?.isOnline ?? false;
    const titleName = friend.presence?.titleName ?? null;

    if (!prev) continue;

    // Ami vient de se connecter
    if (isOnline && !prev.isOnline) {
      const gameText = titleName ? ` — joue a ${titleName}` : "";
      notify(
        `${friend.onlineId} est en ligne`,
        `Ton ami vient de se connecter${gameText}`
      );
    }
    // Ami a lancé un nouveau jeu (était déjà en ligne)
    else if (isOnline && prev.isOnline && titleName && titleName !== prev.titleName) {
      notify(
        `${friend.onlineId}`,
        `Joue maintenant a ${titleName}`
      );
    }
  }
}

async function poll() {
  try {
    const result = await fetchFriends(100);
    const friends = result.friends;

    const onlineCount = friends.filter((f) => f.presence?.isOnline).length;

    // Mettre à jour le tray
    updateTrayMenu(mainWindow, onlineCount);

    // Détecter les changements
    detectChanges(friends);

    // Sauvegarder l'état
    previousState.clear();
    for (const f of friends) {
      previousState.set(f.accountId, {
        isOnline: f.presence?.isOnline ?? false,
        titleName: f.presence?.titleName ?? null,
      });
    }

    // Envoyer au renderer pour mise à jour live
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("psn:presenceUpdate", {
        onlineCount,
        friends,
      });
    }
  } catch (err) {
    console.warn("[monitor] Erreur polling:", err.message);
  }
}

export function startMonitor(win) {
  mainWindow = win;

  // Premier poll après 10s (laisser le temps à l'auth)
  setTimeout(() => {
    poll();
    intervalId = setInterval(poll, POLL_INTERVAL);
  }, 10_000);
}

export function stopMonitor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
