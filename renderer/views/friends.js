// renderer/views/friends.js

let allFriends = [];
let currentFilter = "all"; // "all" | "online" | "offline"
let searchQuery = "";

function formatStatus(presence) {
  if (!presence) return { text: "Statut indisponible", isOnline: false };

  if (presence.isOnline) {
    const platform = presence.platform?.toUpperCase();
    const game = presence.titleName;

    if (game && platform) return { text: `En ligne — ${game} (${platform})`, isOnline: true };
    if (game) return { text: `En ligne — ${game}`, isOnline: true };
    if (platform) return { text: `En ligne sur ${platform}`, isOnline: true };
    return { text: "En ligne", isOnline: true };
  }

  return { text: "Hors ligne", isOnline: false };
}

function getFilteredFriends() {
  let filtered = [...allFriends];

  // Filtre en ligne / hors ligne
  if (currentFilter === "online") {
    filtered = filtered.filter((f) => f.presence?.isOnline);
  } else if (currentFilter === "offline") {
    filtered = filtered.filter((f) => !f.presence?.isOnline);
  }

  // Recherche
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((f) =>
      f.onlineId.toLowerCase().includes(q) ||
      f.presence?.titleName?.toLowerCase().includes(q)
    );
  }

  // Tri : en ligne d'abord, puis alphabétique
  filtered.sort((a, b) => {
    const aOnline = a.presence?.isOnline ? 1 : 0;
    const bOnline = b.presence?.isOnline ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;
    return a.onlineId.localeCompare(b.onlineId);
  });

  return filtered;
}

function renderFriendCard(friend) {
  const { text, isOnline } = formatStatus(friend.presence);

  const avatarHtml = friend.avatarUrl
    ? `<img class="friend-avatar" src="${friend.avatarUrl}" alt="" />`
    : `<div class="friend-avatar-empty"></div>`;

  const onlineDot = isOnline ? `<div class="online-dot"></div>` : "";

  const platform = friend.presence?.platform;
  const platformHtml = platform
    ? `<span class="friend-platform">${platform.toUpperCase()}</span>`
    : "";

  const game = friend.presence?.titleName;
  const gameIcon = friend.presence?.titleIconUrl;
  const gameHtml = game
    ? `<div class="friend-game">
        ${gameIcon ? `<img class="friend-game-icon" src="${gameIcon}" alt="" />` : ""}
        <span class="friend-game-name">${game}</span>
      </div>`
    : "";

  return `
    <div class="friend-card ${isOnline ? "is-online" : ""}">
      <div class="friend-avatar-wrap">
        ${avatarHtml}
        ${onlineDot}
      </div>
      <div class="friend-info">
        <div class="friend-name">${friend.onlineId}</div>
        <div class="friend-status ${isOnline ? "online" : ""}">${text}</div>
        ${gameHtml}
      </div>
      ${platformHtml}
    </div>
  `;
}

function renderFriendsList(container) {
  const filtered = getFilteredFriends();
  const onlineCount = allFriends.filter((f) => f.presence?.isOnline).length;

  const grid = container.querySelector(".friends-grid");
  const stats = container.querySelector(".friends-stats");

  if (stats) {
    stats.innerHTML = `
      <span class="friends-stat"><strong>${allFriends.length}</strong> amis</span>
      <span class="friends-stat"><strong>${onlineCount}</strong> en ligne</span>
      ${searchQuery ? `<span class="friends-stat"><strong>${filtered.length}</strong> résultats</span>` : ""}
    `;
  }

  if (grid) {
    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p>${
        searchQuery ? "Aucun ami ne correspond à ta recherche." : "Aucun ami dans cette catégorie."
      }</p></div>`;
    } else {
      grid.innerHTML = filtered.map(renderFriendCard).join("");
    }
  }
}

function setupEvents(container, loadFn) {
  // Search
  const searchInput = container.querySelector(".search-box input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderFriendsList(container);
    });
  }

  // Filters
  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderFriendsList(container);
    });
  });

  // Refresh
  const refreshBtn = container.querySelector(".refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadFn(container));
  }
}

async function loadFriends(container) {
  const refreshBtn = container.querySelector(".refresh-btn");
  const grid = container.querySelector(".friends-grid");

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("loading");
  }

  grid.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Chargement des amis...</p></div>`;

  try {
    const res = await window.psnAPI.getFriends(100);

    if (!res.ok) {
      grid.innerHTML = `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }

    allFriends = res.data.friends;
    renderFriendsList(container);
  } catch (err) {
    grid.innerHTML = `<div class="error-state"><p>Erreur inattendue : ${err.message}</p></div>`;
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("loading");
    }
  }
}

export function render(container) {
  currentFilter = "all";
  searchQuery = "";

  container.innerHTML = `
    <div class="view-header">
      <h1>Amis</h1>
      <p class="subtitle">Ta liste d'amis PlayStation Network</p>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Rechercher un ami ou un jeu..." />
      </div>

      <button class="filter-btn active" data-filter="all">Tous</button>
      <button class="filter-btn" data-filter="online">En ligne</button>
      <button class="filter-btn" data-filter="offline">Hors ligne</button>

      <button class="refresh-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        Rafraichir
      </button>
    </div>

    <div class="friends-stats"></div>
    <div class="friends-grid"></div>
  `;

  setupEvents(container, loadFriends);
  loadFriends(container);
}
