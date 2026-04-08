// renderer/views/dashboard.js

let profileCache = null;

function renderTrophyCounts(earned) {
  if (!earned) return "";
  return `
    <div class="trophy-counts">
      <div class="trophy-count"><span class="trophy-dot platinum"></span>${earned.platinum ?? 0}</div>
      <div class="trophy-count"><span class="trophy-dot gold"></span>${earned.gold ?? 0}</div>
      <div class="trophy-count"><span class="trophy-dot silver"></span>${earned.silver ?? 0}</div>
      <div class="trophy-count"><span class="trophy-dot bronze"></span>${earned.bronze ?? 0}</div>
    </div>
  `;
}

function renderProfile(container, profile, friendsOnline = null) {
  const avatarHtml = profile.avatarUrl
    ? `<img class="profile-avatar" src="${profile.avatarUrl}" alt="" />`
    : `<div class="profile-avatar-empty"></div>`;

  const badges = [];
  if (profile.isPlus) badges.push(`<span class="badge plus">PS Plus</span>`);
  if (profile.trophySummary) {
    badges.push(`<span class="badge">Niveau ${profile.trophySummary.level}</span>`);
  }

  const totalTrophies = profile.trophySummary?.earned
    ? (profile.trophySummary.earned.platinum ?? 0) +
      (profile.trophySummary.earned.gold ?? 0) +
      (profile.trophySummary.earned.silver ?? 0) +
      (profile.trophySummary.earned.bronze ?? 0)
    : 0;

  const recentGamesHtml = profile.recentGames.length > 0
    ? `
      <div class="section-title">Jeux récents</div>
      <div class="recent-games-grid">
        ${profile.recentGames.map((g) => `
          <div class="game-card">
            ${g.imageUrl ? `<img class="game-card-img" src="${g.imageUrl}" alt="" />` : `<div class="game-card-img"></div>`}
            <div class="game-card-body">
              <div class="game-card-title">${g.name}</div>
              <div class="game-card-meta">${g.platform ?? ""} ${g.lastPlayed ? "— " + new Date(g.lastPlayed).toLocaleDateString("fr-FR") : ""}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `
    : "";

  container.innerHTML = `
    <div class="profile-header">
      ${avatarHtml}
      <div class="profile-info">
        <h2>${profile.onlineId}</h2>
        <div class="profile-badges">${badges.join("")}</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="stat-card">
        <div class="label">Niveau Trophée</div>
        <div class="value">${profile.trophySummary?.level ?? "—"}</div>
        ${profile.trophySummary ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Progression : ${profile.trophySummary.progress}%</div>` : ""}
      </div>
      <div class="stat-card">
        <div class="label">Total Trophées</div>
        <div class="value">${totalTrophies}</div>
        ${renderTrophyCounts(profile.trophySummary?.earned)}
      </div>
      <div class="stat-card">
        <div class="label">Jeux récents</div>
        <div class="value">${profile.recentGames.length}</div>
      </div>
      <div class="stat-card" id="friends-online-card">
        <div class="label">Amis en ligne</div>
        <div class="value">${friendsOnline !== null ? friendsOnline : `<span class="loading-inline"></span>`}</div>
      </div>
    </div>

    ${recentGamesHtml}
  `;

  // Mettre à jour la sidebar
  updateSidebarProfile(profile);
}

function updateSidebarProfile(profile) {
  const sidebarProfile = document.getElementById("sidebar-profile");
  if (!sidebarProfile) return;

  const avatarHtml = profile.avatarUrl
    ? `<img class="sidebar-avatar" src="${profile.avatarUrl}" alt="" />`
    : `<div class="sidebar-avatar-placeholder"></div>`;

  sidebarProfile.innerHTML = `
    ${avatarHtml}
    <span class="sidebar-username">${profile.onlineId}</span>
  `;
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>Dashboard</h1>
      <p class="subtitle">Ton profil PlayStation Network</p>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Chargement du profil...</p></div>
  `;

  try {
    if (!profileCache) {
      const res = await window.psnAPI.getMyProfile();
      if (!res.ok) {
        container.innerHTML += `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
        return;
      }
      profileCache = res.data;
    }
    renderProfile(container, profileCache);

    // Charger le compteur d'amis en ligne en arrière-plan
    window.psnAPI.getFriends(100).then((res) => {
      if (!res.ok) return;
      const onlineCount = res.data.friends.filter((f) => f.presence?.isOnline).length;
      const card = document.getElementById("friends-online-card");
      if (card) {
        card.querySelector(".value").textContent = onlineCount;
      }
    }).catch(() => {});
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

export function getCachedProfile() {
  return profileCache;
}
