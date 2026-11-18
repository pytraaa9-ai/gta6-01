// World renderer: paints Solmar City from the camera, then entities,
// particles and the day/night lighting. All art is drawn shapes — no assets.
import { WORLD_SIZE, PITCH, ROAD_W, PALETTE } from './config.js';
import { missionMarker } from './missions.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

// Daylight factor 0..1 from the in-game clock (0-24h). 1 = noon, 0 = midnight.
export function daylight(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 6 && h < 9) return 0.35 + ((h - 6) / 3) * 0.55;
  if (h >= 9 && h < 17) return 1;
  if (h >= 17 && h < 20) return 1 - ((h - 17) / 3) * 0.8;
  if (h >= 20 || h < 5) return 0.12;
  return 0.12 + ((h - 5) / 1) * 0.23;
}

function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-40, -22, 82, 48);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -39, -21, 78, 42, 10);
  ctx.fill();
  // Cabin + windows.
  ctx.fillStyle = 'rgba(20,30,45,0.9)';
  roundRect(ctx, -12, -17, 26, 34, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.75)';
  ctx.fillRect(-8, -15, 8, 30);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(36, -18, 4, 8);
  ctx.fillRect(36, 10, 4, 8);
  // Police livery.
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-30, -21, 14, 42);
    ctx.fillStyle = '#d21f2b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', 8, 3);
    // Flashing light bar.
    const on = Math.floor(t * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-6, -24, 12, 6);
    ctx.fillStyle = on ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(-6, 18, 12, 6);
  }
  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-28, -25, 14, 6);
  ctx.fillRect(-28, 19, 14, 6);
  ctx.fillRect(14, -25, 14, 6);
  ctx.fillRect(14, 19, 14, 6);
  ctx.restore();
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

function drawPed(ctx, ped, t) {
  if (ped.down) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(1.2);
    ctx.fillStyle = ped.color;
    ctx.fillRect(-13, -6, 26, 12);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(16, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 - 2, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Direction tick.
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle) * 13, Math.sin(ped.angle) * 13);
  ctx.stroke();
  if (ped.target) {
    // The debtor: red ring + $ sign.
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff2d78';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, -22);
  }
  ctx.restore();
}

export function drawWorld(renderer, state, camera) {
  const { ctx, canvas } = renderer;
  const w = canvas.width;
  const h = canvas.height;
  const t = state.time;
  ctx.clearRect(0, 0, w, h);
  // Sky-tinted background outside the city.
  ctx.fillStyle = '#6fae6a';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-camera.x + w / 2, -camera.y + h / 2);

  const vx0 = camera.x - w / 2 - 60;
  const vy0 = camera.y - h / 2 - 60;
  const vx1 = camera.x + w / 2 + 60;
  const vy1 = camera.y + h / 2 + 60;

  // Ground: grass with a subtle checker of mowed strips.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.fillStyle = PALETTE.grassAlt;
  const gs = 200;
  for (let gx = Math.floor(vx0 / gs) * gs; gx < vx1; gx += gs) {
    for (let gy = Math.floor(vy0 / gs) * gs; gy < vy1; gy += gs) {
      if (((gx + gy) / gs) % 2 === 0) ctx.fillRect(gx, gy, gs, gs);
    }
  }
  // Marina water + sand along the north edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(vx0, -80, vx1 - vx0, 80);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(vx0, 0, vx1 - vx0, 14);

  // Parks.
  for (const park of state.city.parks) {
    ctx.fillStyle = '#5da24a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }

  // Roads: asphalt strips + centre dashes.
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i <= 6; i++) {
    const c = i * PITCH;
    ctx.fillRect(c, 0, ROAD_W, WORLD_SIZE); // vertical
    ctx.fillRect(0, c, WORLD_SIZE, ROAD_W); // horizontal
  }
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const c = i * PITCH + ROAD_W / 2;
    ctx.moveTo(c, 0);
    ctx.lineTo(c, WORLD_SIZE);
    ctx.moveTo(0, c);
    ctx.lineTo(WORLD_SIZE, c);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalks: pale border around each block.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 10;
  for (let gx = 0; gx < 6; gx++) {
    for (let gy = 0; gy < 6; gy++) {
      ctx.strokeRect(gx * PITCH + ROAD_W + 4, gy * PITCH + ROAD_W + 4, PITCH - ROAD_W - 8, PITCH - ROAD_W - 8);
    }
  }

  // Buildings with drop shadows and roof detail.
  for (const b of state.city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
    // Windows on the roof edge.
    ctx.fillStyle = 'rgba(30,40,60,0.55)';
    const nx = Math.max(1, Math.floor(b.w / 34));
    for (let i = 0; i < nx; i++) ctx.fillRect(b.x + 12 + i * 34, b.y + 18, 14, 10);
  }
  // Trees.
  for (const tree of state.city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(tree.x + 4, tree.y + 5, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e8f3a';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57ab4e';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups: cash sparkles, health kits, ammo boxes.
  for (const pk of state.pickups) {
    const pulse = 1 + Math.sin(t * 6) * 0.15;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      roundRect(ctx, -13, -9, 26, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#e33';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else {
      ctx.fillStyle = '#8a6d2b';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#ffd23d';
      ctx.fillRect(-7, -4, 4, 8);
      ctx.fillRect(0, -4, 4, 8);
      ctx.fillRect(7, -4, 4, 8);
    }
    ctx.restore();
  }

  // Mission marker: pulsing beacon + ground ring.
  const marker = missionMarker(state);
  if (marker) {
    const pulse = 1 + Math.sin(t * 4) * 0.2;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,61,0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Beacon column.
    const grad = ctx.createLinearGradient(0, -160, 0, 0);
    grad.addColorStop(0, 'rgba(255,210,61,0)');
    grad.addColorStop(1, 'rgba(255,210,61,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(-8, -160, 16, 160);
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, -44);
    ctx.restore();
  }

  // Cars (parked/traffic/police/player), sorted by y for a little depth.
  const cars = [...state.cars].sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(ctx, car, t);

  // Peds, then cops, then the player.
  for (const ped of state.peds) drawPed(ctx, ped, t);
  for (const cop of state.cops) {
    if (cop.down) {
      drawPed(ctx, { ...cop, color: '#1e2a4a' }, t);
      continue;
    }
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e2a4a';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(cop.angle) * 3, Math.sin(cop.angle) * 3 - 2, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d21f2b';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', 0, 4);
    ctx.restore();
  }

  // Player on foot (or the driver's head inside the car is the car itself).
  const p = state.player;
  if (!p.inCar) {
    const bob = p.speed > 10 ? Math.sin(t * 14) * 2 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bob * 0.3);
    if (p.hurtFlash > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(t * 30) * 0.3;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 11, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Jacket + jeans, facing the aim/move direction.
    ctx.fillStyle = '#f5f0e6';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b6cb0';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 1, 7, 0, Math.PI * 2);
    ctx.fill();
    // Pistol in hand when aiming.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.aimAngle) * 20, Math.sin(p.aimAngle) * 20);
    ctx.stroke();
    ctx.restore();
  }

  // Bullets.
  ctx.fillStyle = '#ffe27a';
  for (const b of state.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillRect(-6, -1.5, 12, 3);
    ctx.restore();
  }

  // Particles.
  for (const pt of state.particles) {
    const a = 1 - pt.life / pt.maxLife;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.5, pt.size * (pt.shrink ? a : 1)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Day / night lighting overlay.
  const dl = daylight(state.clockHours);
  if (dl < 0.95) {
    ctx.fillStyle = `rgba(8,12,40,${(0.95 - dl) * 0.55})`;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    if (dl < 0.4) {
      // Sunset tint.
      if (dl > 0.15) {
        ctx.fillStyle = `rgba(255,120,40,${(0.4 - dl) * 0.25})`;
        ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
      }
      // Night: a pool of light around the player (headlights / street glow).
      const grad = ctx.createRadialGradient(p.x, p.y, 60, p.x, p.y, 340);
      grad.addColorStop(0, 'rgba(255,240,180,0.20)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 340, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Hurt vignette.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${p.hurtFlash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }
}
