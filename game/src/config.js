// Solmar Nights — shared constants for the open-world crime game.
// Original city "Solmar City", original story, original art. No external assets.
export const WORLD_SIZE = 2400; // city is WORLD_SIZE x WORLD_SIZE px
export const PITCH = 400; // block + road pitch
export const ROAD_W = 96; // road width
export const BLOCK = PITCH - ROAD_W; // building block size
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-nights-save-v1';
export const START_MONEY = 150;
export const MAX_WANTED = 5;

// Player on foot
export const PLAYER_RADIUS = 13;
export const WALK_SPEED = 215;
export const RUN_SPEED = 300;
export const PLAYER_MAX_HEALTH = 100;

// Cars
export const CAR_W = 46;
export const CAR_L = 78;
export const CAR_MAX_SPEED = 430;
export const CAR_ACCEL = 320;
export const CAR_REVERSE = 170;

// Combat
export const PISTOL_MAG = 12;
export const BULLET_SPEED = 780;
export const PUNCH_RANGE = 34;
export const PUNCH_DAMAGE = 25;
export const BULLET_DAMAGE = 34;

// Wanted
export const WANTED_DECAY_SECONDS = 18; // lay low this long to drop one star

// Colours of the city palette (sun-soaked coastal city)
export const PALETTE = {
  grass: '#7fae5a',
  grassAlt: '#76a653',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  building: ['#e8a87c', '#d4846a', '#f2c14e', '#7fb3d5', '#c39bd3', '#f1948a', '#82c9a5', '#e59866'],
  water: '#3d8fb5',
  sand: '#e8d9a0',
};

export const CAR_COLORS = ['#d64545', '#3d7bd6', '#e8b93d', '#7ac74f', '#e8e8e8', '#2b2b33', '#c77dff', '#ff8c42', '#4dd0c4'];

// District names shown on the HUD as you cross the city.
export function districtAt(x, y) {
  const cx = x < WORLD_SIZE / 2 ? 0 : 1;
  const cy = y < WORLD_SIZE / 2 ? 0 : 1;
  return [
    ['Marina Bay', 'Old Town'],
    ['Palm Heights', 'The Docks'],
  ][cy][cx];
}
