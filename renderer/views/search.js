// renderer/views/search.js

let searchTimeout = null;
let currentProfile = null;

const TROPHY_COLORS = {
  platinum: "#60a5fa",
  gold: "#eab308",
  silver: "#a1a1aa",
  bronze: "#c2803a",
};

function trophyDot(type) {
  return `<span class="trophy-dot ${type}"></span>`;
}

function renderSearchResult(player) {
  const plusBadge = player.isPsPlus
    ? `<span class="badge plus">PS+</span>`
    : "";
  const verifiedBadge = player.isVerified
    ? `<span class="badge">Verifie</span>`
    : "";

  return `
    <div class="search-result-card" data-account-id="${player.accountId}">
      <div class="friend-avatar-wrap">
        ${player.avatarUrl ? `<img class="friend-avatar" src="${player.avatarUrl}" alt="" />` : `<div class="friend-avatar-empty"></div>`}
      </div>
      <div class="friend-info">
        <div class="friend-name">${player.onlineId}</div>
        <div class="search-result-badges">${plusBadge}${verifiedBadge}</div>
      </div>
      <svg class="search-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `;
}

function renderPlayerProfile(container, profile) {
  const avatarHtml = profile.avatarUrl
    ? `<img class="profile-avatar" src="${profile.avatarUrl}" alt="" />`
    : `<div class="profile-avatar-empty"></div>`;

  const badges = [];
  if (profile.isPlus) badges.push(`<span class="badge plus">PS Plus</span>`);
  if (profile.trophySummary) {
    badges.push(`<span class="badge">Niveau ${profile.trophySummary.level}</span>`);
  }

  const presenceHtml = profile.presence?.isOnline
    ? `<div class="search-profile-presence online">
        En ligne${profile.presence.platform ? ` sur ${profile.presence.platform.toUpperCase()}` : ""}
        ${profile.presence.titleName ? ` — ${profile.presence.titleName}` : ""}
      </div>`
    : `<div class="search-profile-presence offline">Hors ligne</div>`;

  const totalTrophies = profile.trophySummary?.earned
    ? (profile.trophySummary.earned.platinum ?? 0) +
      (profile.trophySummary.earned.gold ?? 0) +
      (profile.trophySummary.earned.silver ?? 0) +
      (profile.trophySummary.earned.bronze ?? 0)
    : 0;

  const trophyHtml = profile.trophySummary
    ? `
      <div class="search-profile-section">
        <div class="section-title">Trophees</div>
        <div class="dashboard-grid">
          <div class="stat-card">
            <div class="label">Niveau</div>
            <div class="value">${profile.trophySummary.level}</div>
          </div>
          <div class="stat-card">
            <div class="label">Total</div>
            <div class="value">${totalTrophies}</div>
            <div class="trophy-counts">
              <span class="trophy-count">${trophyDot("platinum")}${profile.trophySummary.earned.platinum ?? 0}</span>
              <span class="trophy-count">${trophyDot("gold")}${profile.trophySummary.earned.gold ?? 0}</span>
              <span class="trophy-count">${trophyDot("silver")}${profile.trophySummary.earned.silver ?? 0}</span>
              <span class="trophy-count">${trophyDot("bronze")}${profile.trophySummary.earned.bronze ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    `
    : "";

  container.innerHTML = `
    <div class="view-header">
      <button class="back-btn" id="backToSearch">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Recherche
      </button>
      <h1>${profile.onlineId}</h1>
    </div>

    <div class="profile-header">
      ${avatarHtml}
      <div class="profile-info">
        <h2>${profile.onlineId}</h2>
        <div class="profile-badges">${badges.join("")}</div>
        ${presenceHtml}
        ${profile.aboutMe ? `<div class="search-profile-about">${profile.aboutMe}</div>` : ""}
      </div>
    </div>

    ${trophyHtml}
  `;

  container.querySelector("#backToSearch").addEventListener("click", () => {
    currentProfile = null;
    render(container);
  });
}

async function openPlayerProfile(container, accountId) {
  container.innerHTML = `
    <div class="view-header">
      <button class="back-btn" id="backToSearch">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Recherche
      </button>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Chargement du profil...</p></div>
  `;

  container.querySelector("#backToSearch").addEventListener("click", () => {
    currentProfile = null;
    render(container);
  });

  try {
    const res = await window.psnAPI.getPlayerProfile(accountId);
    if (!res.ok) {
      container.querySelector(".loading-state").innerHTML =
        `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }
    currentProfile = res.data;
    renderPlayerProfile(container, res.data);
  } catch (err) {
    container.querySelector(".loading-state").innerHTML =
      `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

async function performSearch(container, query) {
  const resultsList = container.querySelector(".search-results");
  const hint = container.querySelector(".search-hint");
  if (!resultsList) return;

  if (!query || query.length < 2) {
    resultsList.innerHTML = "";
    if (hint) hint.style.display = "";
    return;
  }

  if (hint) hint.style.display = "none";
  resultsList.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Recherche...</p></div>`;

  try {
    const res = await window.psnAPI.searchPlayers(query);
    if (!res.ok) {
      resultsList.innerHTML = `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }

    const players = res.data;
    if (players.length === 0) {
      resultsList.innerHTML = `<div class="empty-state"><p>Aucun joueur trouve pour "${query}"</p></div>`;
      return;
    }

    resultsList.innerHTML = players.map(renderSearchResult).join("");

    // Click handlers
    resultsList.querySelectorAll(".search-result-card").forEach((card) => {
      card.addEventListener("click", () => {
        openPlayerProfile(container, card.dataset.accountId);
      });
    });
  } catch (err) {
    resultsList.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

export function render(container) {
  if (currentProfile) {
    renderPlayerProfile(container, currentProfile);
    return;
  }

  container.innerHTML = `
    <div class="view-header">
      <h1>Recherche</h1>
      <p class="subtitle">Trouve n'importe quel joueur PlayStation</p>
    </div>

    <div class="search-page-box">
      <div class="search-box search-box-large">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Rechercher un pseudo PSN..." autofocus />
      </div>
    </div>

    <div class="search-hint">
      <p>Tape au moins 2 caracteres pour lancer la recherche.</p>
    </div>

    <div class="search-results"></div>
  `;

  const searchInput = container.querySelector(".search-box input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => performSearch(container, query), 400);
    });
  }
}
