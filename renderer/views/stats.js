// renderer/views/stats.js

function parseDuration(iso) {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
}

function formatHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function renderStats(container, games, trophies) {
  // Calculs
  const totalPlaytime = games.reduce((sum, g) => sum + parseDuration(g.playDuration), 0);
  const totalSessions = games.reduce((sum, g) => sum + (g.playCount || 0), 0);
  const totalGames = games.length;

  // Top 5 jeux par temps de jeu
  const sorted = [...games]
    .map((g) => ({ ...g, seconds: parseDuration(g.playDuration) }))
    .sort((a, b) => b.seconds - a.seconds);
  const top5 = sorted.slice(0, 5);
  const maxTime = top5[0]?.seconds || 1;

  // Trophées
  let totalTrophies = 0;
  let platinums = 0;
  let totalProgress = 0;
  if (trophies?.titles) {
    for (const t of trophies.titles) {
      const e = t.earned || {};
      totalTrophies += (e.platinum ?? 0) + (e.gold ?? 0) + (e.silver ?? 0) + (e.bronze ?? 0);
      platinums += e.platinum ?? 0;
      totalProgress += t.progress ?? 0;
    }
  }
  const avgProgress = trophies?.titles?.length
    ? Math.round(totalProgress / trophies.titles.length)
    : 0;

  // Plateformes
  const platformCount = {};
  for (const g of games) {
    const p = (g.platform ?? "").includes("ps5") ? "PS5" : (g.platform ?? "").includes("ps4") ? "PS4" : "Autre";
    platformCount[p] = (platformCount[p] || 0) + 1;
  }

  container.innerHTML = `
    <div class="view-header">
      <h1>Statistiques</h1>
      <p class="subtitle">Tes stats gaming PlayStation</p>
    </div>

    <div class="dashboard-grid">
      <div class="stat-card">
        <div class="label">Temps de jeu total</div>
        <div class="value">${formatHours(totalPlaytime)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Sessions totales</div>
        <div class="value">${totalSessions.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="label">Jeux joues</div>
        <div class="value">${totalGames}</div>
      </div>
      <div class="stat-card">
        <div class="label">Trophees gagnes</div>
        <div class="value">${totalTrophies}</div>
      </div>
      <div class="stat-card">
        <div class="label">Platines</div>
        <div class="value" style="color:var(--platinum)">${platinums}</div>
      </div>
      <div class="stat-card">
        <div class="label">Progression moyenne</div>
        <div class="value">${avgProgress}%</div>
      </div>
    </div>

    <div class="section-title" style="margin-top:8px">Top 5 — Temps de jeu</div>
    <div class="stats-top-list">
      ${top5.map((g, i) => {
        const pct = Math.round((g.seconds / maxTime) * 100);
        return `
          <div class="stats-top-item card-animate">
            <span class="stats-top-rank">#${i + 1}</span>
            ${g.imageUrl ? `<img class="stats-top-img" src="${g.imageUrl}" alt="" />` : `<div class="stats-top-img-empty"></div>`}
            <div class="stats-top-info">
              <div class="stats-top-name">${g.name}</div>
              <div class="stats-top-bar-wrap">
                <div class="stats-top-bar" style="width:${pct}%"></div>
              </div>
            </div>
            <span class="stats-top-time">${formatHours(g.seconds)}</span>
          </div>
        `;
      }).join("")}
    </div>

    <div class="section-title" style="margin-top:24px">Repartition par plateforme</div>
    <div class="stats-platforms">
      ${Object.entries(platformCount).map(([p, count]) => `
        <div class="stats-platform-chip">
          <strong>${p}</strong>
          <span>${count} jeux</span>
        </div>
      `).join("")}
    </div>
  `;
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>Statistiques</h1>
      <p class="subtitle">Tes stats gaming PlayStation</p>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Calcul des statistiques...</p></div>
  `;

  try {
    const [gamesRes, trophiesRes] = await Promise.all([
      window.psnAPI.getPlayedGames(0, 200),
      window.psnAPI.getTrophyTitles(0, 200),
    ]);

    const games = gamesRes.ok ? gamesRes.data.titles : [];
    const trophies = trophiesRes.ok ? trophiesRes.data : null;

    renderStats(container, games, trophies);
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}
