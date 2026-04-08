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
  const W = 700;
  const H = 400;
  const dpr = window.devicePixelRatio || 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // === Background ===
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#06080f");
  grad.addColorStop(0.5, "#0c1424");
  grad.addColorStop(1, "#0a1020");
  drawRoundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle glow top-right
  const glow = ctx.createRadialGradient(W - 80, 60, 0, W - 80, 60, 250);
  glow.addColorStop(0, "rgba(0, 111, 205, 0.08)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Border
  drawRoundRect(ctx, 0, 0, W, H, 24);
  ctx.strokeStyle = "rgba(59, 158, 255, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // === Avatar ===
  const avatarSize = 80;
  const avatarX = 48;
  const avatarY = 48;
  try {
    if (profile.avatarUrl) {
      const avatar = await loadImage(profile.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Ring
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
      ctx.strokeStyle = "#006FCD";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  } catch {}

  // === Username ===
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 28px -apple-system, 'SF Pro Display', system-ui, sans-serif";
  ctx.fillText(profile.onlineId, avatarX + avatarSize + 24, avatarY + 36);

  // Badges
  let badgeX = avatarX + avatarSize + 24;
  const badgeY = avatarY + 60;
  ctx.font = "600 13px -apple-system, system-ui, sans-serif";

  if (profile.isPlus) {
    drawRoundRect(ctx, badgeX, badgeY - 13, 50, 22, 11);
    ctx.fillStyle = "rgba(234, 179, 8, 0.15)";
    ctx.fill();
    ctx.fillStyle = "#eab308";
    ctx.fillText("PS Plus", badgeX + 6, badgeY + 3);
    badgeX += 60;
  }

  if (profile.trophySummary) {
    drawRoundRect(ctx, badgeX, badgeY - 13, 90, 22, 11);
    ctx.fillStyle = "rgba(59, 158, 255, 0.12)";
    ctx.fill();
    ctx.fillStyle = "#3b9eff";
    ctx.fillText(`Niveau ${profile.trophySummary.level}`, badgeX + 8, badgeY + 3);
  }

  // === Divider ===
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 155);
  ctx.lineTo(W - 48, 155);
  ctx.stroke();

  // === Trophy Stats ===
  if (profile.trophySummary?.earned) {
    const e = profile.trophySummary.earned;
    const trophies = [
      { label: "Platine", count: e.platinum ?? 0, color: "#60a5fa" },
      { label: "Or", count: e.gold ?? 0, color: "#eab308" },
      { label: "Argent", count: e.silver ?? 0, color: "#a1a1aa" },
      { label: "Bronze", count: e.bronze ?? 0, color: "#c2803a" },
    ];

    const startX = 48;
    const spacing = 155;

    for (let i = 0; i < trophies.length; i++) {
      const t = trophies[i];
      const x = startX + i * spacing;

      // Trophy circle
      ctx.beginPath();
      ctx.arc(x + 12, 195, 10, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();

      // Count
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 24px -apple-system, system-ui, sans-serif";
      ctx.fillText(t.count.toString(), x + 32, 203);

      // Label
      ctx.fillStyle = "#64748b";
      ctx.font = "12px -apple-system, system-ui, sans-serif";
      ctx.fillText(t.label, x + 32, 222);
    }
  }

  // === Divider 2 ===
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.moveTo(48, 250);
  ctx.lineTo(W - 48, 250);
  ctx.stroke();

  // === Recent Games ===
  if (profile.recentGames?.length > 0) {
    ctx.fillStyle = "#475569";
    ctx.font = "600 11px -apple-system, system-ui, sans-serif";
    ctx.letterSpacing = "0.5px";
    ctx.fillText("JEUX RECENTS", 48, 280);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "15px -apple-system, system-ui, sans-serif";
    const gameNames = profile.recentGames.slice(0, 3).map((g) => g.name).join("  ·  ");
    ctx.fillText(gameNames, 48, 306);
  }

  // === Footer ===
  // PS logo text
  ctx.fillStyle = "#1e293b";
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  ctx.fillText("PSN App", 48, H - 30);

  ctx.fillStyle = "rgba(59, 158, 255, 0.6)";
  ctx.font = "12px -apple-system, system-ui, sans-serif";
  ctx.fillText("PlayStation Network", 110, H - 30);

  // Total trophies on the right
  if (profile.trophySummary?.earned) {
    const e = profile.trophySummary.earned;
    const total = (e.platinum ?? 0) + (e.gold ?? 0) + (e.silver ?? 0) + (e.bronze ?? 0);
    ctx.fillStyle = "#475569";
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${total} trophees au total`, W - 48, H - 30);
    ctx.textAlign = "left";
  }

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
