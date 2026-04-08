// src/tray.js
import { Tray, Menu, nativeImage, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray = null;

// Crée une icône PS minimaliste 16x16 en template image pour macOS
function createTrayIcon() {
  // Base64 d'un petit PNG 16x16 transparent avec le symbole PS simplifié
  // On utilise un canvas via nativeImage - fallback sur une icône simple
  const size = 16;
  const icon = nativeImage.createEmpty();

  // Créer un buffer RGBA 16x16 avec un motif PS simplifié
  const buf = Buffer.alloc(size * size * 4, 0);

  // Dessiner un "P" stylisé simple (colonnes 4-12, lignes 2-14)
  const pixels = [
    // Barre verticale du P (col 5-6, lignes 2-14)
    ...[2,3,4,5,6,7,8,9,10,11,12,13,14].flatMap(r => [[r,5],[r,6]]),
    // Arrondi haut du P (lignes 2-3, col 7-10)
    [2,7],[2,8],[2,9],[2,10],
    [3,7],[3,8],[3,9],[3,10],[3,11],
    // Côté droit du P (lignes 4-6, col 11)
    [4,11],[5,11],[6,11],
    // Bas arrondi du P (lignes 7, col 7-10)
    [7,7],[7,8],[7,9],[7,10],
    // Bas du S - courbe (lignes 9-12, col 3-5)
    [10,3],[10,4],[11,2],[11,3],[12,2],[12,3],[12,4],
    [13,4],[13,5],[13,6],
  ];

  for (const [row, col] of pixels) {
    if (row >= 0 && row < size && col >= 0 && col < size) {
      const idx = (row * size + col) * 4;
      buf[idx] = 0;     // R
      buf[idx+1] = 0;   // G
      buf[idx+2] = 0;   // B
      buf[idx+3] = 255; // A
    }
  }

  return nativeImage.createFromBuffer(buf, {
    width: size,
    height: size,
    scaleFactor: 1.0,
  });
}

export function setupTray(mainWindow) {
  const icon = createTrayIcon();
  icon.setTemplateImage(true);

  tray = new Tray(icon);
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

  // Badge titre sur macOS
  if (onlineCount !== null && onlineCount > 0) {
    tray.setTitle(` ${onlineCount}`);
  } else {
    tray.setTitle("");
  }
}
