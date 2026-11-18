// HUD: health, money, wanted stars, ammo, clock, district, objective,
// messages, and the live minimap (canvas-drawn, bottom right).
import { WORLD_SIZE, PITCH, ROAD_W, districtAt } from './config.js';
import { missionMarker } from './missions.js';

const MM = 176; // minimap size in px
const MM_PAD = 14;

function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'AM' : 'PM';
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function drawHUD(ctx, canvas, state) {
  const w = canvas.width;
  const h = canvas.height;
  const p = state.player;
  ctx.textBaseline = 'alphabetic';

  // --- Top left: money + health -------------------------------------------
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 240, 78, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 26, 44);
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 56, 180, 12);
  ctx.fillStyle = p.health > 50 ? '#4ade80' : p.health > 25 ? '#facc15' : '#ef4444';
  ctx.fillRect(26, 56, Math.max(0, 180 * (p.health / 100)), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`HEALTH ${Math.ceil(p.health)}`, 26, 82 - 2 + 2);

  // --- Top right: wanted stars + clock + district -------------------------
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w - 252, 12, 240, 78, 10);
  ctx.fill();
  // Stars.
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 238 + i * 30, 46);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(fmtClock(state.clockHours), w - 238, 70);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText(districtAt(p.x, p.y) + '  ·  Solmar City', w - 238, 86 - 2);

  // --- Ammo (on foot) / speed (driving), bottom centre --------------------
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.32);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, w / 2 - 90, h - 58, 180, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${kmh} km/h`, w / 2, h - 28);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, w / 2 - 110, h - 58, 220, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`PISTOL  ${p.ammo} / ${p.reserve}`, w / 2, h - 30);
  }

  // --- Objective banner, top centre ---------------------------------------
  const obj = state.objective || 'Free roam — press M for the next job.';
  ctx.font = 'bold 15px sans-serif';
  const ow = Math.min(w - 560, ctx.measureText(obj).width + 36);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, w / 2 - ow / 2, 12, ow, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.textAlign = 'center';
  ctx.fillText(obj.length > 90 ? obj.slice(0, 87) + '…' : obj, w / 2, 35);

  // --- Transient message ---------------------------------------------------
  if (state.hudMessage && state.hudMessageTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const mw = ctx.measureText(state.hudMessage).width + 30;
    roundRect(ctx, w / 2 - mw / 2, 54, mw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(state.hudMessage, w / 2, 74);
  }

  // --- Controls hint, bottom left ------------------------------------------
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, h - 58, 330, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive · E enter car · Click shoot · Space punch', 24, h - 40);
  ctx.fillText('R reload · Shift run · M next mission · P pause', 24, h - 24);

  // --- Minimap --------------------------------------------------------------
  drawMinimap(ctx, w, h, state);

  // --- Crosshair (on foot) --------------------------------------------------
  if (!p.inCar) {
    const m = state.mouse || { x: w / 2, y: h / 2 };
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.x - 13, m.y);
    ctx.lineTo(m.x - 5, m.y);
    ctx.moveTo(m.x + 5, m.y);
    ctx.lineTo(m.x + 13, m.y);
    ctx.moveTo(m.x, m.y - 13);
    ctx.lineTo(m.x, m.y - 5);
    ctx.moveTo(m.x, m.y + 5);
    ctx.lineTo(m.x, m.y + 13);
    ctx.stroke();
  }
}

function drawMinimap(ctx, w, h, state) {
  const x0 = w - MM - MM_PAD;
  const y0 = h - MM - MM_PAD;
  const s = MM / WORLD_SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, x0 - 6, y0 - 6, MM + 12, MM + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, MM, MM);
  ctx.clip();
  // Ground.
  ctx.fillStyle = '#5d8a4e';
  ctx.fillRect(x0, y0, MM, MM);
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (let i = 0; i <= 6; i++) {
    const c = i * PITCH * s;
    ctx.fillRect(x0 + c, y0, ROAD_W * s, MM);
    ctx.fillRect(x0, y0 + c, MM, ROAD_W * s);
  }
  // Parks.
  ctx.fillStyle = '#3e7a34';
  for (const park of state.city.parks) {
    ctx.fillRect(x0 + park.x * s, y0 + park.y * s, park.w * s, park.h * s);
  }
  // Cars (yellow), police (flashing blue/red), peds (grey dots).
  ctx.fillStyle = '#ffd23d';
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    ctx.fillRect(x0 + car.x * s - 2, y0 + car.y * s - 2, 4, 4);
  }
  const flash = Math.floor(state.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x0 + car.x * s, y0 + car.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1e2a4a';
  for (const cop of state.cops) {
    if (cop.down) continue;
    ctx.beginPath();
    ctx.arc(x0 + cop.x * s, y0 + cop.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker: pulsing gold star.
  const marker = missionMarker(state);
  if (marker) {
    const r = 5 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * s, y0 + marker.y * s, r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5200';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', x0 + marker.x * s, y0 + marker.y * s + 3.5);
  }
  // Player: white dot with dark ring, always on top.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * s, y0 + state.player.y * s, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // North label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + MM / 2, y0 - 10);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawTitle(ctx, canvas, save) {
  const w = canvas.width;
  const h = canvas.height;
  // Sunset gradient sky over a stylised skyline.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2b1055');
  grad.addColorStop(0.45, '#7597de');
  grad.addColorStop(0.7, '#ff7e5f');
  grad.addColorStop(1, '#feb47b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun.
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.42, 64, 0, Math.PI * 2);
  ctx.fill();
  // Skyline.
  ctx.fillStyle = '#1a1033';
  let x = 0;
  const heights = [0.42, 0.55, 0.38, 0.6, 0.48, 0.58, 0.4, 0.52, 0.62, 0.45, 0.56, 0.4];
  for (let i = 0; x < w; i++) {
    const bw = 90 + (i % 3) * 30;
    const bh = h * heights[i % heights.length];
    ctx.fillRect(x, h - bh - 90, bw, bh + 90);
    x += bw + 8;
  }
  // Palm silhouettes.
  ctx.strokeStyle = '#120a24';
  ctx.lineWidth = 6;
  for (const px of [w * 0.12, w * 0.88]) {
    ctx.beginPath();
    ctx.moveTo(px, h - 90);
    ctx.quadraticCurveTo(px + 20, h - 190, px - 10, h - 230);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLMAR', w / 2, h * 0.3);
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillStyle = '#ffd23d';
  ctx.fillText('NIGHTS', w / 2, h * 0.3 + 88);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in Solmar City', w / 2, h * 0.3 + 130);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('Steal cars · Outrun the SPD · Run jobs for Rosa · Own the night', w / 2, h * 0.3 + 158);
  if (save) {
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Saved game found — $${save.money} · ${save.completed.length}/5 jobs done · press Enter to Continue`, w / 2, h * 0.62);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w / 2 - 330, h * 0.66, 660, 92, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move / drive   ·   E enter & steal cars   ·   Mouse aim, Click shoot', w / 2, h * 0.66 + 32);
  ctx.fillText('Space punch   ·   R reload   ·   Shift run   ·   M next mission   ·   P pause', w / 2, h * 0.66 + 58);
  ctx.fillText('N sound on/off', w / 2, h * 0.66 + 80);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('—  Press ENTER or CLICK to start  —', w / 2, h * 0.84);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('An original game. Solmar City, its people and its story are invented — no real city, gang or game is depicted.', w / 2, h - 18);
}

export function drawOverlay(ctx, canvas, title, lines, accent) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = 'rgba(5,8,20,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd23d';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText(title, w / 2, h / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + 10 + i * 30));
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to continue', w / 2, h / 2 + 10 + lines.length * 30 + 30);
}
