// renderer/views/profile-card.js

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateCard(profile) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 340;
  const ctx = canvas.getContext("2d");

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 340);
  grad.addColorStop(0, "#0a0f1e");
  grad.addColorStop(1, "#0f172a");
  drawRoundRect(ctx, 0, 0, 600, 340, 20);
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  drawRoundRect(ctx, 0, 0, 600, 340, 20);
  ctx.strokeStyle = "rgba(59, 158, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar
  try {
    if (profile.avatarUrl) {
      const avatar = await loadImage(profile.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(80, 80, 40, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 40, 40, 80, 80);
      ctx.restore();

      // Avatar border
      ctx.beginPath();
      ctx.arc(80, 80, 42, 0, Math.PI * 2);
      ctx.strokeStyle = "#3b9eff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  } catch {}

  // Username
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 24px -apple-system, system-ui, sans-serif";
  ctx.fillText(profile.onlineId, 140, 72);

  // PS Plus badge
  if (profile.isPlus) {
    ctx.fillStyle = "#eab308";
    ctx.font = "bold 12px -apple-system, system-ui, sans-serif";
    const nameWidth = ctx.measureText(profile.onlineId).width;
    ctx.fillText("PS+", 140 + 24 + 8, 72);
  }

  // Trophy level
  if (profile.trophySummary) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px -apple-system, system-ui, sans-serif";
    ctx.fillText(`Niveau trophee ${profile.trophySummary.level}`, 140, 98);
  }

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 145);
  ctx.lineTo(560, 145);
  ctx.stroke();

  // Trophy stats
  if (profile.trophySummary?.earned) {
    const e = profile.trophySummary.earned;
    const trophies = [
      { label: "Platine", count: e.platinum ?? 0, color: "#60a5fa" },
      { label: "Or", count: e.gold ?? 0, color: "#eab308" },
      { label: "Argent", count: e.silver ?? 0, color: "#a1a1aa" },
      { label: "Bronze", count: e.bronze ?? 0, color: "#c2803a" },
    ];

    let x = 40;
    for (const t of trophies) {
      // Dot
      ctx.beginPath();
      ctx.arc(x + 8, 178, 8, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();

      // Count
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 20px -apple-system, system-ui, sans-serif";
      ctx.fillText(t.count.toString(), x + 24, 185);

      // Label
      ctx.fillStyle = "#64748b";
      ctx.font = "11px -apple-system, system-ui, sans-serif";
      ctx.fillText(t.label, x + 24, 202);

      x += 130;
    }
  }

  // Recent games
  if (profile.recentGames?.length > 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    ctx.fillText("JEUX RECENTS", 40, 245);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px -apple-system, system-ui, sans-serif";
    const gameNames = profile.recentGames.slice(0, 3).map((g) => g.name).join("  •  ");
    ctx.fillText(gameNames, 40, 268);
  }

  // Footer
  ctx.fillStyle = "#1e293b";
  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillText("PSN App", 40, 320);

  ctx.fillStyle = "#3b9eff";
  ctx.fillText("PlayStation Network", 95, 320);

  return canvas;
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>Profil Card</h1>
      <p class="subtitle">Genere une carte de ton profil a partager</p>
    </div>
    <div class="loading-state"><div class="loading-spinner"></div><p>Generation de la carte...</p></div>
  `;

  try {
    const res = await window.psnAPI.getMyProfile();
    if (!res.ok) {
      container.innerHTML += `<div class="error-state"><p>Erreur : ${res.error}</p></div>`;
      return;
    }

    const profile = res.data;
    const canvas = await generateCard(profile);

    container.innerHTML = `
      <div class="view-header">
        <h1>Profil Card</h1>
        <p class="subtitle">Ta carte PlayStation personnalisee</p>
      </div>
      <div class="card-preview-wrap">
        <div class="card-preview" id="cardPreview"></div>
        <div class="card-actions">
          <button class="refresh-btn" id="downloadCard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Telecharger PNG
          </button>
        </div>
      </div>
    `;

    container.querySelector("#cardPreview").appendChild(canvas);

    container.querySelector("#downloadCard").addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = `psn-card-${profile.onlineId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>Erreur : ${err.message}</p></div>`;
  }
}
