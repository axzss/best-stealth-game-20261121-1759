// The three heists: Garden Gate (tutorial), Grand Hall (locked door + key)
// and the Vault (two locked doors, a lantern-bearer, tight corridors).
// A level is plain data: walls and crates block movement and sight, bushes
// hide, lamps make light pools, guards patrol waypoints, and the relic and
// exit are the goal. Doors open when their key is picked up.
import { VIEW } from './config.js';

function borders() {
  return [
    { x: 0, y: VIEW.hud, w: VIEW.width, h: 8 },
    { x: 0, y: VIEW.height - 8, w: VIEW.width, h: 8 },
    { x: 0, y: VIEW.hud, w: 8, h: VIEW.height - VIEW.hud },
    { x: VIEW.width - 8, y: VIEW.hud, w: 8, h: VIEW.height - VIEW.hud },
  ];
}

function guard(waypoints, speed, lantern) {
  return { waypoints, speed: speed ?? 72, lantern: lantern ?? false };
}

export const LEVELS = [
  {
    name: 'The Garden Gate',
    brief: 'Slip past the garden patrols, steal the Moon Opal shard, and leave through the green gate. Bushes hide you — lamp light does not.',
    spawn: { x: 640, y: 668 },
    relic: { x: 1192, y: 108 },
    exit: { x: 48, y: 92, w: 64, h: 40 },
    walls: [
      ...borders(),
      // Hedge across the middle, with a gap to sneak through.
      { x: 8, y: 360, w: 512, h: 20 },
      { x: 760, y: 360, w: 512, h: 20 },
      // Garden walls that break up sightlines.
      { x: 320, y: 56, w: 20, h: 150 },
      { x: 940, y: 206, w: 20, h: 154 },
    ],
    crates: [
      { x: 560, y: 180, w: 44, h: 44 },
      { x: 700, y: 500, w: 44, h: 44 },
      { x: 1120, y: 300, w: 44, h: 44 },
    ],
    bushes: [
      { x: 240, y: 240, r: 58 },
      { x: 1020, y: 240, r: 58 },
      { x: 240, y: 540, r: 62 },
      { x: 1020, y: 540, r: 58 },
      { x: 640, y: 620, r: 52 },
      { x: 640, y: 140, r: 48 },
    ],
    lamps: [
      { x: 640, y: 180, r: 150 },
      { x: 180, y: 470, r: 140 },
      { x: 1100, y: 470, r: 140 },
    ],
    rugs: [{ x: 560, y: 420, w: 160, h: 110 }],
    guards: [
      guard([[180, 300], [1100, 300]], 72),
      guard([[280, 640], [1000, 640]], 66),
    ],
    loot: [
      { x: 150, y: 140 },
      { x: 1140, y: 650 },
    ],
    keys: [],
    doors: [],
  },
  {
    name: 'The Grand Hall',
    brief: 'The hall door is locked. Find the brass key downstairs, cross the hall unseen, and take the Opal from the far gallery.',
    spawn: { x: 640, y: 668 },
    relic: { x: 1150, y: 110 },
    exit: { x: 560, y: 76, w: 80, h: 36 },
    walls: [
      ...borders(),
      // The hall divider: one locked door in the middle.
      { x: 8, y: 320, w: 592, h: 20 },
      { x: 680, y: 320, w: 592, h: 20 },
      // Side walls that make the rooms read as rooms.
      { x: 420, y: 56, w: 20, h: 264 },
      { x: 860, y: 340, w: 20, h: 372 },
    ],
    crates: [
      { x: 700, y: 120, w: 44, h: 44 },
      { x: 300, y: 500, w: 44, h: 44 },
      { x: 1000, y: 600, w: 44, h: 44 },
    ],
    bushes: [
      { x: 150, y: 150, r: 50 },
      { x: 1130, y: 150, r: 50 },
      { x: 150, y: 620, r: 50 },
      { x: 1130, y: 620, r: 50 },
      { x: 640, y: 200, r: 44 },
    ],
    lamps: [
      { x: 320, y: 180, r: 150 },
      { x: 960, y: 180, r: 150 },
      { x: 320, y: 520, r: 150 },
      { x: 960, y: 520, r: 150 },
    ],
    rugs: [
      { x: 480, y: 140, w: 320, h: 120 },
      { x: 480, y: 460, w: 320, h: 120 },
    ],
    guards: [
      guard([[200, 220], [1080, 220]], 78),
      guard([[1080, 130], [180, 130]], 78),
      guard([[200, 560], [1080, 560]], 72),
      guard([[1080, 660], [200, 660]], 72),
    ],
    loot: [
      { x: 1130, y: 660 },
      { x: 640, y: 120 },
      { x: 150, y: 120 },
    ],
    keys: [{ x: 150, y: 660, keyId: 0 }],
    doors: [{ x: 600, y: 320, w: 80, h: 20, keyId: 0 }],
  },
  {
    name: 'The Vault',
    brief: 'Two locked doors, five guards and a lantern-bearer who sees far. Two keys, one vault, no mistakes — the Moon Opal waits at the top.',
    spawn: { x: 120, y: 668 },
    relic: { x: 640, y: 130 },
    exit: { x: 560, y: 660, w: 80, h: 36 },
    walls: [
      ...borders(),
      // Upper corridor wall with the first locked door.
      { x: 8, y: 240, w: 472, h: 20 },
      { x: 560, y: 240, w: 712, h: 20 },
      // Lower corridor wall with the second locked door.
      { x: 8, y: 470, w: 712, h: 20 },
      { x: 800, y: 470, w: 472, h: 20 },
      // Pillars that force the corridors to bend.
      { x: 300, y: 56, w: 20, h: 184 },
      { x: 980, y: 470, w: 20, h: 242 },
      { x: 640, y: 260, w: 20, h: 210 },
      { x: 300, y: 470, w: 20, h: 242 },
    ],
    crates: [
      { x: 480, y: 120, w: 44, h: 44 },
      { x: 820, y: 350, w: 44, h: 44 },
      { x: 420, y: 580, w: 44, h: 44 },
    ],
    bushes: [
      { x: 150, y: 150, r: 48 },
      { x: 1130, y: 600, r: 48 },
      { x: 640, y: 350, r: 44 },
      { x: 150, y: 420, r: 44 },
      { x: 1130, y: 420, r: 44 },
    ],
    lamps: [
      { x: 640, y: 120, r: 140 },
      { x: 200, y: 350, r: 140 },
      { x: 1080, y: 350, r: 140 },
      { x: 640, y: 600, r: 140 },
    ],
    rugs: [{ x: 560, y: 100, w: 160, h: 110 }],
    guards: [
      guard([[200, 150], [1100, 150]], 80),
      guard([[200, 350], [1100, 350]], 82),
      guard([[200, 600], [1100, 600]], 78),
      guard([[520, 300], [520, 430]], 75),
      guard([[800, 80], [800, 210]], 75),
      // The lantern-bearer: a wide cone, a fast walk, no hiding in the open.
      guard([[150, 540], [1130, 540]], 95, true),
    ],
    loot: [
      { x: 150, y: 110 },
      { x: 1150, y: 180 },
      { x: 640, y: 360 },
      { x: 150, y: 680 },
      { x: 1150, y: 680 },
    ],
    keys: [
      { x: 150, y: 600, keyId: 0 },
      { x: 1130, y: 140, keyId: 1 },
    ],
    doors: [
      { x: 480, y: 240, w: 80, h: 20, keyId: 0 },
      { x: 720, y: 470, w: 80, h: 20, keyId: 1 },
    ],
  },
];

/** Walls + crates + still-locked doors: everything that blocks movement and sight. */
export function buildObstacles(level, openDoors) {
  const obstacles = [...level.walls, ...level.crates];
  for (const door of level.doors) {
    if (!openDoors.has(door.keyId)) obstacles.push(door);
  }
  return obstacles;
}
