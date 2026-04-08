// renderer/app.js
import { render as renderDashboard } from "./views/dashboard.js";
import { render as renderFriends } from "./views/friends.js";
import { render as renderTrophies } from "./views/trophies.js";
import { render as renderLibrary } from "./views/library.js";
import { render as renderSearch } from "./views/search.js";
import { render as renderCompare, startCompare } from "./views/compare.js";

const views = {
  dashboard: renderDashboard,
  friends: renderFriends,
  trophies: renderTrophies,
  library: renderLibrary,
  search: renderSearch,
  compare: renderCompare,
};

let currentView = "dashboard";

function navigate(viewName) {
  if (!views[viewName]) return;
  currentView = viewName;

  // Update active nav
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  // Render view
  const content = document.getElementById("content");
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

// Quand des données fraîches arrivent du background, re-render une seule fois
const refreshMap = {
  profile: "dashboard",
  friends: "friends",
  trophyTitles: "trophies",
  playedGames: "library",
};

const recentRefreshes = new Set();

window.psnAPI.onFreshData(({ key }) => {
  const targetView = refreshMap[key];
  if (!targetView || currentView !== targetView) return;

  // Anti-boucle : ignorer si on a déjà refresh cette clé récemment
  if (recentRefreshes.has(key)) return;
  recentRefreshes.add(key);
  setTimeout(() => recentRefreshes.delete(key), 10_000);

  const content = document.getElementById("content");
  views[currentView](content);
});

// Initial load
navigate("dashboard");
