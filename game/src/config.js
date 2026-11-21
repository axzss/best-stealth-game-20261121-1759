// Tuning numbers and palette for The Gilded Shadow.
// Every magic number the sim or the renderer needs lives here, so a balance
// change is one edit, never a hunt through the game code.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720, hud: 48 };
export const BOUNDS = { x: 16, y: 56, width: 1248, height: 656 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 102,
  // How far a footstep is heard (walk loud, sneak quiet).
  noiseWalk: 78,
  noiseSneak: 30,
  stepWalk: 0.36,
  stepSneak: 0.55,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  suspiciousSpeed: 98,
  chaseSpeed: 152,
  searchSpeed: 88,
  returnSpeed: 105,
  visionRange: 230,
  lanternRange: 305,
  // Half of the cone's total arc (70 degrees total).
  visionHalfAngle: (35 * Math.PI) / 180,
  hearingRadius: 170,
  // How close a guard must be, while ALERTED, to catch the thief.
  catchDistance: 27,
  // Suspicious at this meter, alerted at 1.0.
  suspiciousAt: 0.35,
  // Seconds a guard stares at the last-seen spot before sweeping it.
  lookSeconds: 1.5,
  // Seconds of lost sight before an alerted guard gives up the chase.
  lostSeconds: 2.5,
  searchSeconds: 4.5,
};

export const DETECT = {
  // Fill per second at point blank, before light / sneak multipliers.
  baseRate: 1.5,
  // Drain per second while the player is unseen.
  drainRate: 0.5,
  // Standing in a lamp pool multiplies the fill rate; darkness divides it.
  lampMultiplier: 1.6,
  darkMultiplier: 0.6,
  sneakMultiplier: 0.6,
  // A guard cannot spot a player hidden in a bush beyond this distance.
  bushBlindDistance: 40,
};

export const COIN = {
  perLevel: 3,
  throwTime: 0.38,
  pingRadius: 300,
  // Loot gems refund a coin when picked up.
  lootRefund: 1,
};

export const NERVES = 3;
export const LOOT_POINTS = 150;
export const BEST_KEY_PREFIX = 'gilded-shadow-best-';

export const PALETTE = {
  floorA: '#0d1526',
  floorB: '#0f1a30',
  rug: '#3a2333',
  rugEdge: '#6b3a4d',
  wall: '#232c42',
  wallTop: '#3a4767',
  crate: '#5a3d24',
  crateEdge: '#8a6238',
  bush: '#16351f',
  bushLeaf: '#2c5c33',
  bushBright: '#4d8a4f',
  lamp: '#ffb347',
  lampPool: 'rgba(255, 179, 71, 0.16)',
  playerCloak: '#4b3a6e',
  playerHood: '#2e2145',
  playerOutline: '#e8f0ff',
  guardBody: '#1c2438',
  guardTrim: '#c0392b',
  guardHelmet: '#39415c',
  relic: '#4de8e0',
  exit: '#39d353',
  exitLocked: '#5a6472',
  loot: '#f5c542',
  key: '#e8b64c',
  conePatrol: '255, 190, 90',
  coneSuspicious: '255, 230, 120',
  coneAlerted: '255, 60, 50',
  hudBg: 'rgba(6, 10, 22, 0.82)',
  hudText: '#e8e4d8',
  hudDim: '#8a93a8',
  panelBg: 'rgba(5, 8, 18, 0.88)',
  titleGold: '#f5c542',
};
