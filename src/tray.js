// src/tray.js
import { Tray, Menu, nativeImage, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray = null;

function createTrayIcon() {
  // Logo PlayStation en SVG encodé en data URL
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="black" d="M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z"/></svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  try {
    const icon = nativeImage.createFromDataURL(dataUrl);
    if (!icon.isEmpty()) {
      const resized = icon.resize({ width: 18, height: 18 });
      resized.setTemplateImage(true);
      return resized;
    }
  } catch {}

  // Fallback vide
  return nativeImage.createEmpty();
}

export function setupTray(mainWindow) {
  const icon = createTrayIcon();

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
