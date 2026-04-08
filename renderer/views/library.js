// renderer/views/library.js

let allGames = [];
let totalCount = 0;
let searchQuery = "";
let currentFilter = "all"; // "all" | "ps5" | "ps4"

function formatDuration(iso) {
  if (!iso) return null;
  // PT format: PT1234H56M78S or similar
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function platformLabel(category) {
  if (!category) return "";
  if (category.includes("ps5")) return "PS5";
  if (category.includes("ps4")) return "PS4";
  if (category.includes("pspc")) return "PC";
  return category.toUpperCase();
}

function getFilteredGames() {
  let filtered = [...allGames];

  if (currentFilter !== "all") {
    filtered = filtered.filter((g) => {
      const p = (g.platform ?? "").toLowerCase();
      if (currentFilter === "ps5") return p.includes("ps5");
      if (currentFilter === "ps4") return p.includes("ps4");
      return true;
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((g) => g.name.toLowerCase().includes(q));
  }

  return filtered;
}

function renderGameCard(game) {
  const platform = platformLabel(game.platform);
  const duration = formatDuration(game.playDuration);
  const lastPlayed = formatDate(game.lastPlayed);

  return `
    <div class="library-card">
      <div class="library-card-img-wrap">
        ${game.imageUrl ? `<img class="library-card-img" src="${game.imageUrl}" alt="" />` : `<div class="library-card-img-empty"></div>`}
        ${platform ? `<span class="library-platform-badge">${platform}</span>` : ""}
      </div>
      <div class="library-card-body">
        <div class="library-card-title">${game.name}</div>
        <div class="library-card-meta">
          ${duration ? `<span class="library-meta-item">${duration}</span>` : ""}
          ${game.playCount > 0 ? `<span class="library-meta-item">${game.playCount} session${game.playCount > 1 ? "s" : ""}</span>` : ""}
        </div>
        ${lastPlayed ? `<div class="library-card-date">Derniere session : ${lastPlayed}</div>` : ""}
      </div>
    </div>
  `;
}

function renderGamesList(container) {
  const filtered = getFilteredGames();
  const grid = container.querySelector(".library-grid");
  const stats = container.querySelector(".library-stats");

  if (stats) {
    stats.innerHTML = `
      <span class="friends-stat"><strong>${totalCount}</strong> jeux</span>
      ${searchQuery ? `<span class="friends-stat"><strong>${filtered.length}</strong> resultats</span>` : ""}
    `;
  }

  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>${
      searchQuery ? "Aucun jeu ne correspond." : "Aucun jeu trouve."
    }</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderGameCard).join("");
}

async function loadGames(container) {
  const grid = container.querySelector(".library-grid");
  if (grid) {
    grid.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Chargement de la bibliotheque...</p></div>`;
  }

  try {
    const res = await window.psnAPI.getPlayedGames(0, 200);
    if (!res.ok) {
      if (grid) grid.innerHTML = `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }

    allGames = res.data.titles;
    totalCount = res.data.totalItemCount;
    renderGamesList(container);
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

export function render(container) {
  searchQuery = "";
  currentFilter = "all";

  container.innerHTML = `
    <div class="view-header">
      <h1>Bibliotheque</h1>
      <p class="subtitle">Tous tes jeux PlayStation</p>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Rechercher un jeu..." />
      </div>

      <button class="filter-btn active" data-filter="all">Tous</button>
      <button class="filter-btn" data-filter="ps5">PS5</button>
      <button class="filter-btn" data-filter="ps4">PS4</button>
    </div>

    <div class="library-stats"></div>
    <div class="library-grid"></div>
  `;

  // Search
  const searchInput = container.querySelector(".search-box input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderGamesList(container);
    });
  }

  // Filters
  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderGamesList(container);
    });
  });

  loadGames(container);
}
