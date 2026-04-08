// renderer/app.js
import { render as renderDashboard } from "./views/dashboard.js";
import { render as renderFriends } from "./views/friends.js";
import { render as renderTrophies } from "./views/trophies.js";
import { render as renderLibrary } from "./views/library.js";
import { render as renderSearch } from "./views/search.js";
import { render as renderCompare, startCompare } from "./views/compare.js";
import { render as renderStats } from "./views/stats.js";
import { render as renderActivity } from "./views/activity.js";
import { render as renderProfileCard } from "./views/profile-card.js";
import { render as renderSettings, applyTheme, getSetting } from "./views/settings.js";

const views = {
  dashboard: renderDashboard,
  friends: renderFriends,
  trophies: renderTrophies,
  library: renderLibrary,
  search: renderSearch,
  compare: renderCompare,
  stats: renderStats,
  activity: renderActivity,
  "profile-card": renderProfileCard,
  settings: renderSettings,
};

let currentView = "dashboard";

function navigate(viewName) {
  if (!views[viewName]) return;
  currentView = viewName;

  // Update active nav
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  // Render view with animation
  const content = document.getElementById("content");
  content.style.animation = "none";
  content.offsetHeight; // force reflow
  content.style.animation = "";
  views[viewName](content);
}

// Expose navigate globalement pour les vues
window.__navigate = navigate;
window.__startCompare = (accountId, onlineId) => {
  startCompare(accountId, onlineId);
  navigate("compare");
};

// Nav click handlers
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => navigate(btn.dataset.view));
});

// Les données fraîches du background ne déclenchent plus de re-render auto.
// Le cache est mis à jour silencieusement, les vues se rafraîchissent
// via l'auto-refresh timer ou le bouton Rafraîchir.

// Mettre à jour le compteur d'amis en ligne quand le monitor envoie des données
window.psnAPI.onPresenceUpdate(({ onlineCount }) => {
  const card = document.getElementById("friends-online-card");
  if (card) {
    card.querySelector(".value").textContent = onlineCount;
  }
});

// Appliquer le thème sauvegardé
applyTheme(getSetting("theme", "dark"));

// Initial load
navigate("dashboard");
