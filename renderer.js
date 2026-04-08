// renderer.js
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("friendsList");

function formatStatus(presence) {
  if (!presence) return "Statut indisponible";

  if (presence.isOnline) {
    const platform = presence.platform
      ? presence.platform.toUpperCase()
      : null;
    const game = presence.titleName;

    if (game && platform) {
      return `🟢 En ligne — ${game} (${platform})`;
    }
    if (game) {
      return `🟢 En ligne — ${game}`;
    }
    if (platform) {
      return `🟢 En ligne sur ${platform}`;
    }
    return "🟢 En ligne";
  }

  return "⚫ Hors ligne";
}



async function loadFriends() {
  refreshBtn.disabled = true;
  statusEl.textContent = "Chargement des amis PSN...";
  listEl.innerHTML = "";

  try {
    const res = await window.psnAPI.getFriends(50);

    if (!res.ok) {
      statusEl.textContent = "Erreur : " + (res.error || "inconnue");
      refreshBtn.disabled = false;
      return;
    }

    const { total, friends } = res.data;
    statusEl.textContent = `✅ ${total} amis PSN (affichage de ${friends.length})`;

    friends.forEach((f) => {
      const li = document.createElement("li");

      const avatarHtml = f.avatarUrl
        ? `<div class="friend-avatar">
             <img src="${f.avatarUrl}" alt="Avatar de ${f.onlineId}" />
           </div>`
        : `<div class="friend-avatar"></div>`;

      const statusText = formatStatus(f.presence);

      li.innerHTML = `
        ${avatarHtml}
        <div class="friend-text">
          <div class="friend-name">${f.onlineId}</div>
          <div class="friend-status">${statusText}</div>
          <div class="friend-id">${f.accountId}</div>
        </div>
      `;

      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Erreur inattendue : " + err.message;
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener("click", loadFriends);
