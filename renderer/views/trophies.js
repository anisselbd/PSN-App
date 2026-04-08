// renderer/views/trophies.js

let allTitles = [];
let totalCount = 0;
let currentDetail = null; // { npCommunicationId, npServiceName, name }
let searchQuery = "";

const TROPHY_COLORS = {
  platinum: "#60a5fa",
  gold: "#eab308",
  silver: "#a1a1aa",
  bronze: "#c2803a",
};

function trophyDot(type) {
  return `<span class="trophy-dot ${type}"></span>`;
}

function earnedBadge(earned) {
  return `<span class="trophy-count">${trophyDot("platinum")}${earned.platinum ?? 0}</span>
    <span class="trophy-count">${trophyDot("gold")}${earned.gold ?? 0}</span>
    <span class="trophy-count">${trophyDot("silver")}${earned.silver ?? 0}</span>
    <span class="trophy-count">${trophyDot("bronze")}${earned.bronze ?? 0}</span>`;
}

function progressBar(percent) {
  return `<div class="progress-bar">
    <div class="progress-fill" style="width:${percent}%"></div>
  </div>`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function rarityLabel(rate) {
  if (!rate) return "";
  const num = parseFloat(rate);
  let label, cls;
  if (num <= 1) { label = "Ultra rare"; cls = "rarity-ultra"; }
  else if (num <= 5) { label = "Tres rare"; cls = "rarity-very"; }
  else if (num <= 20) { label = "Rare"; cls = "rarity-rare"; }
  else if (num <= 50) { label = "Peu commun"; cls = "rarity-uncommon"; }
  else { label = "Commun"; cls = "rarity-common"; }
  return `<span class="rarity-badge ${cls}">${num}% — ${label}</span>`;
}

// ===== TITLE LIST VIEW =====

function getFilteredTitles() {
  if (!searchQuery) return allTitles;
  const q = searchQuery.toLowerCase();
  return allTitles.filter((t) => t.name.toLowerCase().includes(q));
}

function renderTitleCard(title) {
  const earned = title.earned ?? {};
  const totalEarned =
    (earned.platinum ?? 0) + (earned.gold ?? 0) + (earned.silver ?? 0) + (earned.bronze ?? 0);
  const defined = title.defined ?? {};
  const totalDefined =
    (defined.platinum ?? 0) + (defined.gold ?? 0) + (defined.silver ?? 0) + (defined.bronze ?? 0);

  return `
    <div class="trophy-title-card" data-id="${title.npCommunicationId}" data-service="${title.npServiceName}">
      <div class="trophy-title-icon-wrap">
        ${title.iconUrl ? `<img class="trophy-title-icon" src="${title.iconUrl}" alt="" />` : `<div class="trophy-title-icon-empty"></div>`}
      </div>
      <div class="trophy-title-info">
        <div class="trophy-title-name">${title.name}</div>
        <div class="trophy-title-platform">${title.platform ?? ""}</div>
        <div class="trophy-title-progress">
          ${progressBar(title.progress ?? 0)}
          <span class="trophy-progress-label">${title.progress ?? 0}% — ${totalEarned}/${totalDefined}</span>
        </div>
        <div class="trophy-counts">${earnedBadge(earned)}</div>
      </div>
    </div>
  `;
}

function renderTitlesList(container) {
  const filtered = getFilteredTitles();
  const grid = container.querySelector(".trophies-list");
  const stats = container.querySelector(".trophies-stats");

  if (stats) {
    stats.innerHTML = `<span class="friends-stat"><strong>${totalCount}</strong> jeux avec trophees</span>
      ${searchQuery ? `<span class="friends-stat"><strong>${filtered.length}</strong> resultats</span>` : ""}`;
  }

  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>${
      searchQuery ? "Aucun jeu ne correspond." : "Aucun trophee trouve."
    }</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderTitleCard).join("");

  // Click handlers
  grid.querySelectorAll(".trophy-title-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const service = card.dataset.service;
      const title = allTitles.find((t) => t.npCommunicationId === id);
      openTitleDetail(container, id, service, title?.name ?? "");
    });
  });
}

// ===== TITLE DETAIL VIEW =====

async function openTitleDetail(container, npCommunicationId, npServiceName, titleName) {
  currentDetail = { npCommunicationId, npServiceName, name: titleName };

  container.innerHTML = `
    <div class="view-header">
      <button class="back-btn" id="backBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Retour
      </button>
      <h1>${titleName}</h1>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Chargement des trophees...</p></div>
  `;

  container.querySelector("#backBtn").addEventListener("click", () => {
    currentDetail = null;
    render(container);
  });

  try {
    const res = await window.psnAPI.getTrophiesForTitle(npCommunicationId, npServiceName);
    if (!res.ok) {
      container.querySelector(".loading-state").innerHTML =
        `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }

    renderTrophyDetail(container, res.data, titleName);
  } catch (err) {
    container.querySelector(".loading-state").innerHTML =
      `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

function renderTrophyDetail(container, data, titleName) {
  const { trophies, groups } = data;

  const earnedCount = trophies.filter((t) => t.earned).length;
  const totalCount = trophies.length;
  const percent = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // Group trophies by groupId
  const grouped = new Map();
  for (const t of trophies) {
    const gid = t.groupId ?? "default";
    if (!grouped.has(gid)) grouped.set(gid, []);
    grouped.get(gid).push(t);
  }

  // Sort: earned first within each type, then by type priority
  const typePriority = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  for (const [, arr] of grouped) {
    arr.sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      return (typePriority[a.type] ?? 4) - (typePriority[b.type] ?? 4);
    });
  }

  let html = `
    <div class="view-header">
      <button class="back-btn" id="backBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Retour
      </button>
      <h1>${titleName}</h1>
      <p class="subtitle">${earnedCount}/${totalCount} trophees — ${percent}%</p>
    </div>
    <div class="trophy-detail-progress">${progressBar(percent)}</div>
  `;

  for (const [gid, groupTrophies] of grouped) {
    const group = groups.find((g) => g.id === gid);
    const groupName = group?.name ?? (gid === "default" ? "Jeu de base" : `DLC ${gid}`);

    html += `<div class="trophy-group">
      <div class="trophy-group-header">${groupName}</div>
      <div class="trophy-detail-list">
        ${groupTrophies.map(renderSingleTrophy).join("")}
      </div>
    </div>`;
  }

  container.innerHTML = html;

  container.querySelector("#backBtn").addEventListener("click", () => {
    currentDetail = null;
    render(container);
  });
}

function renderSingleTrophy(trophy) {
  const typeClass = trophy.type ?? "bronze";
  const earnedClass = trophy.earned ? "is-earned" : "not-earned";

  const name = trophy.hidden && !trophy.earned ? "Trophee cache" : trophy.name;
  const detail = trophy.hidden && !trophy.earned ? "Continue de jouer pour debloquer ce trophee." : (trophy.detail ?? "");

  const earnedDate = trophy.earned && trophy.earnedDateTime
    ? `<span class="trophy-earned-date">Obtenu le ${formatDate(trophy.earnedDateTime)}</span>`
    : "";

  return `
    <div class="trophy-item ${earnedClass}">
      <div class="trophy-icon-wrap">
        ${trophy.iconUrl ? `<img class="trophy-icon" src="${trophy.iconUrl}" alt="" />` : `<div class="trophy-icon-empty"></div>`}
        <div class="trophy-type-badge ${typeClass}"></div>
      </div>
      <div class="trophy-item-info">
        <div class="trophy-item-name">${name}</div>
        <div class="trophy-item-detail">${detail}</div>
        <div class="trophy-item-meta">
          ${rarityLabel(trophy.earnedRate)}
          ${earnedDate}
        </div>
      </div>
      ${trophy.earned ? `<div class="trophy-check">&#10003;</div>` : ""}
    </div>
  `;
}

// ===== MAIN RENDER =====

async function loadTitles(container) {
  const list = container.querySelector(".trophies-list");
  if (list) {
    list.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Chargement des trophees...</p></div>`;
  }

  try {
    const res = await window.psnAPI.getTrophyTitles(0, 200);
    if (!res.ok) {
      if (list) list.innerHTML = `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }

    allTitles = res.data.titles;
    totalCount = res.data.totalItemCount;
    renderTitlesList(container);
  } catch (err) {
    if (list) list.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

export function render(container) {
  if (currentDetail) {
    openTitleDetail(container, currentDetail.npCommunicationId, currentDetail.npServiceName, currentDetail.name);
    return;
  }

  searchQuery = "";

  container.innerHTML = `
    <div class="view-header">
      <h1>Trophees</h1>
      <p class="subtitle">Ta collection de trophees PlayStation</p>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Rechercher un jeu..." />
      </div>
    </div>

    <div class="trophies-stats"></div>
    <div class="trophies-list"></div>
  `;

  // Search
  const searchInput = container.querySelector(".search-box input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderTitlesList(container);
    });
  }

  loadTitles(container);
}
