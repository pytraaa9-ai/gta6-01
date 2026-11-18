// Solmar City: a 6x6 block grid of roads, buildings, parks and a marina.
// The layout is deterministic from the seed so screenshots are reproducible.
import { WORLD_SIZE, PITCH, ROAD_W, BLOCK, PALETTE } from './config.js';
import { createRandom } from './random.js';

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return false;
  const mx = ((x % PITCH) + PITCH) % PITCH;
  const my = ((y % PITCH) + PITCH) % PITCH;
  return mx < ROAD_W || my < ROAD_W;
}

// Centre of the nearest road to a point (used to drop cars/peds on streets).
export function nearestRoadPoint(x, y) {
  const bx = Math.floor(x / PITCH) * PITCH;
  const by = Math.floor(y / PITCH) * PITCH;
  const mx = x - bx;
  const my = y - by;
  if (mx < ROAD_W && my < ROAD_W) return { x: bx + ROAD_W / 2, y: by + ROAD_W / 2 };
  if (mx < ROAD_W) return { x: bx + ROAD_W / 2, y };
  if (my < ROAD_W) return { x, y: by + ROAD_W / 2 };
  // Inside a block: walk to the closer road edge.
  if (mx - ROAD_W < my - ROAD_W) return { x: bx + ROAD_W / 2, y };
  return { x, y: by + ROAD_W / 2 };
}

export function createCity(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  // Named landmarks the missions and HUD refer to.
  const landmarks = {
    hideout: { x: 620, y: 620, name: 'Rosa\u2019s Hideout' },
    marina: { x: 2050, y: 300, name: 'Marina Bay' },
    bank: { x: 1420, y: 1020, name: 'Solmar Bank' },
    docks: { x: 2050, y: 2050, name: 'The Docks' },
    plaza: { x: 1020, y: 1420, name: 'Palm Plaza' },
    market: { x: 300, y: 1820, name: 'Night Market' },
  };

  for (let gx = 0; gx < 6; gx++) {
    for (let gy = 0; gy < 6; gy++) {
      const bx = gx * PITCH + ROAD_W;
      const by = gy * PITCH + ROAD_W;
      const roll = rng.next();
      if (roll < 0.14) {
        // Park block: grass + trees, no buildings.
        parks.push({ x: bx, y: by, w: BLOCK, h: BLOCK });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({ x: bx + rng.range(24, BLOCK - 24), y: by + rng.range(24, BLOCK - 24), r: rng.range(9, 15) });
        }
        continue;
      }
      // 1-4 buildings per block, with a margin from the road.
      const cols = rng.next() < 0.5 ? 1 : 2;
      const rows = rng.next() < 0.5 ? 1 : 2;
      const cw = BLOCK / cols;
      const ch = BLOCK / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const w = cw * rng.range(0.62, 0.86);
          const h = ch * rng.range(0.62, 0.86);
          const x = bx + cx * cw + (cw - w) / 2;
          const y = by + cy * ch + (ch - h) / 2;
          buildings.push({
            x, y, w, h,
            color: rng.pick(PALETTE.building),
            roof: rng.pick(['#5a4a3a', '#3f5a4a', '#6b5a7a', '#7a6a55']),
            height: rng.int(1, 3),
          });
        }
      }
      if (rng.next() < 0.6) {
        trees.push({ x: bx + rng.range(20, BLOCK - 20), y: by + rng.range(20, BLOCK - 20), r: rng.range(8, 13) });
      }
    }
  }

  // A random point on a road, for spawning traffic / parked cars.
  function randomRoadPoint() {
    const along = rng.range(0, WORLD_SIZE);
    const cross = rng.range(0, ROAD_W);
    if (rng.next() < 0.5) {
      // Vertical road: x inside the road strip, y anywhere.
      const lane = Math.floor(along / PITCH) * PITCH + cross;
      return { x: lane, y: rng.range(40, WORLD_SIZE - 40), horizontal: false };
    }
    const lane = Math.floor(along / PITCH) * PITCH + cross;
    return { x: rng.range(40, WORLD_SIZE - 40), y: lane, horizontal: true };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    // Sidewalk = just off the road edge, inside the block margin.
    return { x: Math.min(WORLD_SIZE - 20, Math.max(20, p.x + (p.horizontal ? 0 : 62))), y: Math.min(WORLD_SIZE - 20, Math.max(20, p.y + (p.horizontal ? 62 : 0))) };
  }

  return { buildings, parks, trees, landmarks, randomRoadPoint, randomSidewalkPoint };
}

// Point inside any building?
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
