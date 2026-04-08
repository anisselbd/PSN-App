// renderer/views/compare.js

let compareState = null; // { accountId, onlineId, step: "games" | "detail" }
let commonGames = [];

function trophyDot(type) {
  return `<span class="trophy-dot ${type}"></span>`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renderCommonGameCard(game) {
  const myTotal = (game.myEarned.platinum ?? 0) + (game.myEarned.gold ?? 0) +
    (game.myEarned.silver ?? 0) + (game.myEarned.bronze ?? 0);
  const otherTotal = (game.otherEarned.platinum ?? 0) + (game.otherEarned.gold ?? 0) +
    (game.otherEarned.silver ?? 0) + (game.otherEarned.bronze ?? 0);

  return `
    <div class="compare-game-card" data-np-id="${game.npCommunicationId}" data-service="${game.npServiceName}">
      <div class="trophy-title-icon-wrap">
        ${game.iconUrl ? `<img class="trophy-title-icon" src="${game.iconUrl}" alt="" />` : `<div class="trophy-title-icon-empty"></div>`}
      </div>
      <div class="compare-game-info">
        <div class="trophy-title-name">${game.name}</div>
        <div class="compare-scores">
          <div class="compare-score">
            <span class="compare-label">Toi</span>
            <span class="compare-value">${game.myProgress}%</span>
            <span class="compare-count">${myTotal} trophees</span>
          </div>
          <div class="compare-vs">VS</div>
          <div class="compare-score">
            <span class="compare-label">${compareState.onlineId}</span>
            <span class="compare-value">${game.otherProgress}%</span>
            <span class="compare-count">${otherTotal} trophees</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderComparisonDetail(container, data, gameName) {
  const { trophies } = data;
  const myCount = trophies.filter((t) => t.meEarned).length;
  const otherCount = trophies.filter((t) => t.otherEarned).length;

  let html = `
    <div class="view-header">
      <button class="back-btn" id="backToGames">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Retour
      </button>
      <h1>${gameName}</h1>
      <p class="subtitle">Toi : ${myCount}/${trophies.length} — ${compareState.onlineId} : ${otherCount}/${trophies.length}</p>
    </div>
    <div class="compare-trophy-list">
  `;

  for (const t of trophies) {
    const name = t.hidden && !t.meEarned && !t.otherEarned ? "Trophee cache" : t.name;
    const detail = t.hidden && !t.meEarned && !t.otherEarned ? "" : (t.detail ?? "");

    html += `
      <div class="compare-trophy-item">
        <div class="trophy-icon-wrap">
          ${t.iconUrl ? `<img class="trophy-icon" src="${t.iconUrl}" alt="" />` : `<div class="trophy-icon-empty"></div>`}
          <div class="trophy-type-badge ${t.type}"></div>
        </div>
        <div class="compare-trophy-info">
          <div class="trophy-item-name">${name}</div>
          <div class="trophy-item-detail">${detail}</div>
        </div>
        <div class="compare-checks">
          <div class="compare-check ${t.meEarned ? "earned" : "not-earned"}" title="Toi">
            ${t.meEarned ? "&#10003;" : "&#10007;"}
          </div>
          <div class="compare-check ${t.otherEarned ? "earned" : "not-earned"}" title="${compareState.onlineId}">
            ${t.otherEarned ? "&#10003;" : "&#10007;"}
          </div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;

  container.querySelector("#backToGames").addEventListener("click", () => {
    compareState.step = "games";
    render(container);
  });
}

async function openGameComparison(container, npCommunicationId, npServiceName, gameName) {
  container.innerHTML = `
    <div class="view-header">
      <button class="back-btn" id="backToGames">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Retour
      </button>
      <h1>${gameName}</h1>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Comparaison en cours...</p></div>
  `;

  container.querySelector("#backToGames").addEventListener("click", () => {
    compareState.step = "games";
    render(container);
  });

  try {
    const res = await window.psnAPI.compareTrophies(
      npCommunicationId, npServiceName, compareState.accountId
    );
    if (!res.ok) {
      container.querySelector(".loading-state").innerHTML =
        `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }
    renderComparisonDetail(container, res.data, gameName);
  } catch (err) {
    container.querySelector(".loading-state").innerHTML =
      `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

async function loadCommonGames(container) {
  const list = container.querySelector(".compare-games-list");
  if (!list) return;

  list.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Recherche des jeux en commun...</p></div>`;

  try {
    const [myRes, otherRes] = await Promise.all([
      window.psnAPI.getTrophyTitles(0, 200),
      window.psnAPI.getPlayerTrophyTitles(compareState.accountId),
    ]);

    if (!myRes.ok || !otherRes.ok) {
      list.innerHTML = `<div class="error-state"><p>Erreur de chargement</p></div>`;
      return;
    }

    const myTitles = myRes.data.titles;
    const otherTitles = otherRes.data;

    // Trouver les jeux en commun par npCommunicationId
    const otherMap = new Map();
    for (const t of otherTitles) otherMap.set(t.npCommunicationId, t);

    commonGames = myTitles
      .filter((t) => otherMap.has(t.npCommunicationId))
      .map((t) => {
        const other = otherMap.get(t.npCommunicationId);
        return {
          npCommunicationId: t.npCommunicationId,
          npServiceName: t.npServiceName,
          name: t.name,
          iconUrl: t.iconUrl,
          myProgress: t.progress,
          myEarned: t.earned,
          otherProgress: other.progress,
          otherEarned: other.earned,
        };
      });

    if (commonGames.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>Aucun jeu en commun avec ${compareState.onlineId}</p></div>`;
      return;
    }

    list.innerHTML = `
      <div class="friends-stat" style="margin-bottom:12px"><strong>${commonGames.length}</strong> jeux en commun</div>
      ${commonGames.map(renderCommonGameCard).join("")}
    `;

    list.querySelectorAll(".compare-game-card").forEach((card) => {
      card.addEventListener("click", () => {
        compareState.step = "detail";
        const game = commonGames.find((g) => g.npCommunicationId === card.dataset.npId);
        openGameComparison(container, card.dataset.npId, card.dataset.service, game?.name ?? "");
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

export function startCompare(accountId, onlineId) {
  compareState = { accountId, onlineId, step: "games" };
}

export function render(container) {
  if (!compareState) {
    container.innerHTML = `<div class="empty-state"><p>Selectionne un ami pour comparer les trophees.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="view-header">
      <button class="back-btn" id="backToFriends">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Retour
      </button>
      <h1>Comparer avec ${compareState.onlineId}</h1>
      <p class="subtitle">Trophees en commun</p>
    </div>
    <div class="compare-games-list"></div>
  `;

  container.querySelector("#backToFriends").addEventListener("click", () => {
    compareState = null;
    // Navigate back to friends
    document.querySelector('[data-view="friends"]')?.click();
  });

  loadCommonGames(container);
}
