// renderer/views/friends.js

let allFriends = [];
let currentFilter = "all";
let searchQuery = "";
let autoRefreshTimer = null;
let lastRefreshTime = null;
let lastRefreshTimerUI = null;

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

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

  const ago = timeAgo(presence.lastOnlineDate);
  if (ago) return { text: `Hors ligne — ${ago}`, isOnline: false };
  return { text: "Hors ligne", isOnline: false };
}

function getFilteredFriends() {
  let filtered = [...allFriends];

  if (currentFilter === "online") {
    filtered = filtered.filter((f) => f.presence?.isOnline);
  } else if (currentFilter === "offline") {
    filtered = filtered.filter((f) => !f.presence?.isOnline);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((f) =>
      f.onlineId.toLowerCase().includes(q) ||
      f.presence?.titleName?.toLowerCase().includes(q)
    );
  }

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
    <div class="friend-card ${isOnline ? "is-online" : ""} card-animate">
      <div class="friend-avatar-wrap">
        ${avatarHtml}
        ${onlineDot}
      </div>
      <div class="friend-info">
        <div class="friend-name">${friend.onlineId}</div>
        <div class="friend-status ${isOnline ? "online" : ""}">${text}</div>
        ${gameHtml}
      </div>
      <button class="compare-btn" data-account-id="${friend.accountId}" data-online-id="${friend.onlineId}" title="Comparer les trophees">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
      </button>
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
    const refreshAgo = lastRefreshTime ? timeAgo(new Date(lastRefreshTime).toISOString()) : null;
    const refreshLabel = refreshAgo ? `<span class="friends-stat refresh-hint">Mis a jour ${refreshAgo}</span>` : "";
    stats.innerHTML = `
      <span class="friends-stat"><strong>${allFriends.length}</strong> amis</span>
      <span class="friends-stat"><strong>${onlineCount}</strong> en ligne</span>
      ${searchQuery ? `<span class="friends-stat"><strong>${filtered.length}</strong> resultats</span>` : ""}
      ${refreshLabel}
    `;
  }

  if (grid) {
    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p>${
        searchQuery ? "Aucun ami ne correspond a ta recherche." : "Aucun ami dans cette categorie."
      }</p></div>`;
    } else {
      grid.innerHTML = filtered.map(renderFriendCard).join("");

      grid.querySelectorAll(".compare-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          window.__startCompare(btn.dataset.accountId, btn.dataset.onlineId);
        });
      });
    }
  }
}

function setupEvents(container, loadFn) {
  const searchInput = container.querySelector(".search-box input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderFriendsList(container);
    });
  }

  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderFriendsList(container);
    });
  });

  const refreshBtn = container.querySelector(".refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadFn(container));
  }
}

async function loadFriends(container, silent = false) {
  const refreshBtn = container.querySelector(".refresh-btn");
  const grid = container.querySelector(".friends-grid");

  if (!silent) {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.classList.add("loading");
    }
    if (!allFriends.length) {
      grid.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Chargement des amis...</p></div>`;
    }
  }

  try {
    const res = await window.psnAPI.getFriends(100);

    if (!res.ok) {
      if (!silent && !allFriends.length) {
        grid.innerHTML = `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      }
      return;
    }

    allFriends = res.data.friends;
    lastRefreshTime = Date.now();
    renderFriendsList(container);
  } catch (err) {
    if (!silent && !allFriends.length) {
      grid.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
    }
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("loading");
    }
  }
}

function startAutoRefresh(container) {
  stopAutoRefresh();
  // Refresh silencieux toutes les 5 minutes
  autoRefreshTimer = setInterval(() => {
    loadFriends(container, true);
  }, 5 * 60 * 1000);

  // Mettre à jour le label "Mis à jour il y a..." toutes les 30s
  lastRefreshTimerUI = setInterval(() => {
    const hint = container.querySelector(".refresh-hint");
    if (hint && lastRefreshTime) {
      hint.textContent = `Mis a jour ${timeAgo(new Date(lastRefreshTime).toISOString())}`;
    }
  }, 30_000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  if (lastRefreshTimerUI) { clearInterval(lastRefreshTimerUI); lastRefreshTimerUI = null; }
}

export function render(container) {
  currentFilter = "all";
  searchQuery = "";
  stopAutoRefresh();

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
  startAutoRefresh(container);
}
