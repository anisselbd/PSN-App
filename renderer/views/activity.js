// renderer/views/activity.js

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (min < 1) return "a l'instant";
  if (min < 60) return `il y a ${min}min`;
  if (hrs < 24) return `il y a ${hrs}h`;
  if (days < 7) return `il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function eventIcon(type) {
  if (type === "online") return `<div class="activity-icon activity-icon-online">&#9650;</div>`;
  if (type === "offline") return `<div class="activity-icon activity-icon-offline">&#9660;</div>`;
  if (type === "game") return `<div class="activity-icon activity-icon-game">&#9654;</div>`;
  return `<div class="activity-icon">&#8226;</div>`;
}

function eventText(ev) {
  if (ev.type === "online") {
    return ev.detail
      ? `<strong>${ev.onlineId}</strong> est en ligne — ${ev.detail}`
      : `<strong>${ev.onlineId}</strong> est en ligne`;
  }
  if (ev.type === "offline") {
    return `<strong>${ev.onlineId}</strong> s'est deconnecte`;
  }
  if (ev.type === "game") {
    return `<strong>${ev.onlineId}</strong> joue a <strong>${ev.detail}</strong>`;
  }
  return `<strong>${ev.onlineId}</strong> — ${ev.detail ?? "activite"}`;
}

function renderEvent(ev) {
  const avatarHtml = ev.avatarUrl
    ? `<img class="activity-avatar" src="${ev.avatarUrl}" alt="" />`
    : `<div class="activity-avatar-empty"></div>`;

  return `
    <div class="activity-item card-animate">
      ${eventIcon(ev.type)}
      ${avatarHtml}
      <div class="activity-content">
        <div class="activity-text">${eventText(ev)}</div>
        <div class="activity-time">${timeAgo(ev.timestamp)}</div>
      </div>
    </div>
  `;
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>Activite</h1>
      <p class="subtitle">Historique de connexion de tes amis</p>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Chargement...</p></div>
  `;

  try {
    const res = await window.psnAPI.getActivityHistory();
    const events = res.ok ? res.data : [];

    if (events.length === 0) {
      container.innerHTML = `
        <div class="view-header">
          <h1>Activite</h1>
          <p class="subtitle">Historique de connexion de tes amis</p>
        </div>
        <div class="empty-state">
          <p>Aucune activite enregistree pour l'instant.</p>
          <p style="margin-top:8px;font-size:12px;color:var(--text-muted)">L'historique se remplit automatiquement quand tes amis se connectent ou lancent un jeu.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="view-header">
        <h1>Activite</h1>
        <p class="subtitle">${events.length} evenements enregistres</p>
      </div>
      <div class="activity-list">
        ${events.map(renderEvent).join("")}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}
