// renderer/views/settings.js

const SETTINGS_KEY = "psn-app-settings";

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch { return {}; }
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getSetting(key, defaultVal) {
  return getSettings()[key] ?? defaultVal;
}

export function render(container) {
  const settings = getSettings();
  const notifs = settings.notifications ?? true;
  const theme = settings.theme ?? "dark";

  container.innerHTML = `
    <div class="view-header">
      <h1>Parametres</h1>
      <p class="subtitle">Configuration de PSN App</p>
    </div>

    <div class="settings-list">
      <div class="settings-section">
        <div class="settings-section-title">Notifications</div>
        <label class="settings-toggle">
          <span class="settings-label">Alertes quand un ami se connecte</span>
          <input type="checkbox" id="settingNotifs" ${notifs ? "checked" : ""} />
          <div class="toggle-switch"></div>
        </label>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Apparence</div>
        <div class="settings-theme-picker">
          <button class="theme-btn ${theme === "dark" ? "active" : ""}" data-theme="dark">
            <div class="theme-preview theme-preview-dark"></div>
            <span>Sombre</span>
          </button>
          <button class="theme-btn ${theme === "midnight" ? "active" : ""}" data-theme="midnight">
            <div class="theme-preview theme-preview-midnight"></div>
            <span>Midnight</span>
          </button>
          <button class="theme-btn ${theme === "amoled" ? "active" : ""}" data-theme="amoled">
            <div class="theme-preview theme-preview-amoled"></div>
            <span>AMOLED</span>
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">A propos</div>
        <div class="settings-about">
          <p><strong>PSN App</strong> v1.0.0</p>
          <p style="color:var(--text-muted);margin-top:4px">Application tierce non affiliee a Sony Interactive Entertainment.</p>
        </div>
      </div>
    </div>
  `;

  // Notifications toggle
  container.querySelector("#settingNotifs").addEventListener("change", (e) => {
    saveSetting("notifications", e.target.checked);
  });

  // Theme picker
  container.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".theme-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.dataset.theme;
      saveSetting("theme", t);
      applyTheme(t);
    });
  });
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "midnight") {
    root.style.setProperty("--bg-deep", "#020617");
    root.style.setProperty("--bg-base", "#0a0f1e");
    root.style.setProperty("--bg-card", "#0f172a");
    root.style.setProperty("--bg-card-hover", "#162033");
    root.style.setProperty("--bg-sidebar", "#040a14");
  } else if (theme === "amoled") {
    root.style.setProperty("--bg-deep", "#000000");
    root.style.setProperty("--bg-base", "#000000");
    root.style.setProperty("--bg-card", "#0a0a0a");
    root.style.setProperty("--bg-card-hover", "#141414");
    root.style.setProperty("--bg-sidebar", "#000000");
  } else {
    root.style.setProperty("--bg-deep", "#06080f");
    root.style.setProperty("--bg-base", "#0c1018");
    root.style.setProperty("--bg-card", "#111827");
    root.style.setProperty("--bg-card-hover", "#1a2332");
    root.style.setProperty("--bg-sidebar", "#090d16");
  }
}
