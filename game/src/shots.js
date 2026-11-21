// Screenshot scenes behind ?shot=title|play|coin|win. Each one plays the real
// rules forward from a fresh world, steered by an autopilot that re-plans a
// grid path every half second and treats guard cones as expensive ground —
// so the frame is what a careful game really looks like, and the same seed
// always gives the same frame. The autopilot can genuinely win level 1:
// relic, then exit, while staying out of the cones.
import { STEP, VIEW } from './config.js';
import { EVENT_CAUGHT, EVENT_LEVEL } from './world.js';
import { pointInCone } from './vision.js';
import { SCREEN_LEVEL, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CELL = 32;
const COLS = Math.ceil(VIEW.width / CELL);
const ROWS = Math.ceil(VIEW.height / CELL);
const REPLAN_SECONDS = 0.5;
const MAX_WIN_SECONDS = 150;
const PLAY_SECONDS = 11;
const TITLE_SECONDS = 5;

function cellOf(x, y) {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
  };
}

function cellBlocked(state, col, row) {
  const x = col * CELL + CELL / 2;
  const y = row * CELL + CELL / 2;
  if (x < 24 || x > VIEW.width - 24 || y < 64 || y > VIEW.height - 24) return true;
  for (const rect of state.level.obstacles) {
    if (x > rect.x - 14 && x < rect.x + rect.w + 14 && y > rect.y - 14 && y < rect.y + rect.h + 14) return true;
  }
  return false;
}

/** Cheapest grid path from the player to the target, cones cost extra. */
function findPath(state, tx, ty) {
  const start = cellOf(state.player.x, state.player.y);
  const goal = cellOf(tx, ty);
  const startKey = start.row * COLS + start.col;
  const goalKey = goal.row * COLS + goal.col;
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = [startKey];
  const inOpen = new Set([startKey]);
  while (open.length > 0) {
    // Smallest-distance first (the grid is tiny; a linear scan is fine).
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) {
      if ((dist.get(open[i]) ?? Infinity) < (dist.get(open[bestIdx]) ?? Infinity)) bestIdx = i;
    }
    const key = open.splice(bestIdx, 1)[0];
    inOpen.delete(key);
    if (key === goalKey) break;
    const col = key % COLS;
    const row = Math.floor(key / COLS);
    const neighbours = [
      [col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1],
      [col + 1, row + 1], [col + 1, row - 1], [col - 1, row + 1], [col - 1, row - 1],
    ];
    for (const [ncol, nrow] of neighbours) {
      if (ncol < 0 || ncol >= COLS || nrow < 0 || nrow >= ROWS) continue;
      if (cellBlocked(state, ncol, nrow)) continue;
      const nx = ncol * CELL + CELL / 2;
      const ny = nrow * CELL + CELL / 2;
      let cost = 1;
      for (const guard of state.guards) {
        if (pointInCone(guard, nx, ny, state.level.obstacles)) cost += 40;
      }
      const nkey = nrow * COLS + ncol;
      const next = (dist.get(key) ?? Infinity) + cost;
      if (next < (dist.get(nkey) ?? Infinity)) {
        dist.set(nkey, next);
        prev.set(nkey, key);
        if (!inOpen.has(nkey)) {
          open.push(nkey);
          inOpen.add(nkey);
        }
      }
    }
  }
  if (!prev.has(goalKey) && goalKey !== startKey) return null;
  const path = [];
  let key = goalKey;
  while (key !== startKey) {
    path.push({ x: (key % COLS) * CELL + CELL / 2, y: Math.floor(key / COLS) * CELL + CELL / 2 });
    key = prev.get(key);
    if (key === undefined) return null;
  }
  path.reverse();
  return path;
}

function makeAutopilot() {
  let path = null;
  let pathT = 0;
  let target = null;
  return function autopilot(world, dt) {
    const state = world.state;
    const player = state.player;
    // Flee: an alerted guard close by outranks the plan.
    for (const guard of state.guards) {
      if (guard.state !== 'alerted') continue;
      const d = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (d < 200) {
        const away = Math.atan2(player.y - guard.y, player.x - guard.x);
        return { x: Math.cos(away), y: Math.sin(away), sneak: false, throwAt: null, pickup: false };
      }
    }
    // Pick the goal: a key first when a door still locks the way, then the
    // relic, then the exit.
    let goal = null;
    const closedDoor = state.level.doors.find((d) => !d.open);
    const key = closedDoor && state.keys.find((k) => !k.taken && k.keyId === closedDoor.keyId);
    if (key) goal = { x: key.x, y: key.y };
    else if (!state.relicTaken) goal = { x: state.level.relic.x, y: state.level.relic.y };
    else goal = { x: state.level.exit.x + state.level.exit.w / 2, y: state.level.exit.y + state.level.exit.h / 2 };
    pathT += dt;
    if (!path || pathT > REPLAN_SECONDS || !target || Math.hypot(target.x - goal.x, target.y - goal.y) > 1) {
      path = findPath(state, goal.x, goal.y);
      pathT = 0;
      target = goal;
    }
    if (!path || path.length === 0) return { x: 0, y: 0, sneak: true, throwAt: null, pickup: false };
    const next = path[0];
    if (Math.hypot(next.x - player.x, next.y - player.y) < 14) path.shift();
    if (path.length === 0) return { x: 0, y: 0, sneak: true, throwAt: null, pickup: false };
    const step = path[0];
    // Patience is the stealth skill: if the next cell is inside a cone right
    // now, wait in place — the patrol sweeps past and the way clears.
    for (const guard of state.guards) {
      if (pointInCone(guard, step.x, step.y, state.level.obstacles)) {
        return { x: 0, y: 0, sneak: true, throwAt: null, pickup: false };
      }
    }
    const dx = step.x - player.x;
    const dy = step.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    const pickup = state.loot.some((g) => !g.taken && Math.hypot(g.x - player.x, g.y - player.y) < 32);
    return { x: dx / length, y: dy / length, sneak: true, throwAt: null, pickup };
  };
}

/** Run the autopilot until the level ends, a catch happens, or time runs out. */
export function autopilotRun(world, maxSeconds) {
  const pilot = makeAutopilot();
  let events = 0;
  let caught = 0;
  for (let i = 0; i < maxSeconds / STEP; i += 1) {
    events = world.step(STEP, pilot(world, STEP), false);
    if (events & EVENT_CAUGHT) caught += 1;
    if (events & EVENT_LEVEL) break;
    if (world.state.status !== 'play') break;
  }
  return { events, caught, time: world.state.levelTime };
}

/**
 * Set `world` to the named scene and return the screen to draw over it plus
 * a result object the page exposes for verification.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // The cover: level 2 mid-play, guards on patrol, the thief in the dark.
    world.loadLevel(1);
    const run = autopilotRun(world, PLAY_SECONDS);
    return {
      screen: SCREEN_PLAY,
      result: { scene: 'play', level: 2, seconds: PLAY_SECONDS, caught: run.caught, time: run.time },
    };
  }
  if (name === 'coin') {
    // The distraction: the thief hidden in a bush, a coin just landed, a
    // guard turning "?" toward the ping while ripples still spread.
    world.loadLevel(0);
    const state = world.state;
    state.player.x = 240;
    state.player.y = 540;
    state.player.hidden = true;
    // Land the coin on the garden guard's patrol line, close enough that the
    // ping (300 px) reaches him the moment it lands.
    world.throwCoinAt(300, 300);
    let suspicious = false;
    for (let i = 0; i < 4 / STEP; i += 1) {
      const events = world.step(STEP, { x: 0, y: 0, sneak: true, throwAt: null, pickup: false }, false);
      if (state.guards.some((g) => g.state === 'suspicious' || g.state === 'look')) {
        suspicious = true;
        break;
      }
      if (events & EVENT_CAUGHT) break;
    }
    // Fresh ripples so the frame shows the sound, not just its aftermath.
    state.ripples.push({ x: 300, y: 300, r: 40, maxR: 300, alpha: 0.7, kind: 'coin' });
    state.ripples.push({ x: 240, y: 540, r: 10, maxR: 30, alpha: 0.5, kind: 'step', sneak: true });
    return {
      screen: SCREEN_PLAY,
      result: { scene: 'coin', level: 1, suspicious, guardStates: state.guards.map((g) => g.state) },
    };
  }
  if (name === 'win') {
    // A real win: the autopilot steals the relic and reaches the exit.
    world.loadLevel(0);
    const run = autopilotRun(world, MAX_WIN_SECONDS);
    const won = world.state.status === 'level-complete';
    return {
      screen: won ? SCREEN_LEVEL : SCREEN_PLAY,
      result: { scene: 'win', level: 1, won, caught: run.caught, time: run.time, levelTime: world.state.levelTime },
    };
  }
  // Title: the garden idling behind the title panel.
  world.loadLevel(0);
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
    world.step(STEP, { x: 0, y: 0, sneak: false, throwAt: null, pickup: false }, true);
  }
  return { screen: SCREEN_TITLE, result: { scene: 'title', level: 1 } };
}
