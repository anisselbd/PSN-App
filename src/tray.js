// src/tray.js
import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray = null;

export function setupTray(mainWindow) {
  // Sur macOS, utiliser une icône vide + titre texte (fiable et propre)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle("PS");
  tray.setToolTip("PSN App");

  updateTrayMenu(mainWindow, null);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });

  return tray;
}

export function updateTrayMenu(mainWindow, onlineCount) {
  if (!tray) return;

  const label = onlineCount !== null
    ? `${onlineCount} ami${onlineCount !== 1 ? "s" : ""} en ligne`
    : "PSN App";

  tray.setToolTip(label);

  const contextMenu = Menu.buildFromTemplate([
    { label, enabled: false },
    { type: "separator" },
    {
      label: "Ouvrir PSN App",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  if (onlineCount !== null && onlineCount > 0) {
    tray.setTitle(`PS  ${onlineCount}`);
  } else {
    tray.setTitle("PS");
  }
}
