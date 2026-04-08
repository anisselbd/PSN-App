// renderer/app.js
import { render as renderDashboard } from "./views/dashboard.js";
import { render as renderFriends } from "./views/friends.js";
import { render as renderTrophies } from "./views/trophies.js";
import { render as renderLibrary } from "./views/library.js";
import { render as renderSearch } from "./views/search.js";

const views = {
  dashboard: renderDashboard,
  friends: renderFriends,
  trophies: renderTrophies,
  library: renderLibrary,
  search: renderSearch,
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

// Nav click handlers
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => navigate(btn.dataset.view));
});

// Initial load
navigate("dashboard");
