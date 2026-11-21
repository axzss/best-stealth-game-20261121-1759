// The rules, with no drawing and no browser in them: levels, the fixed-step
// simulation, pickups, locked doors, nerves, and what happened as bit flags
// so the caller can play sounds and change screens without the world knowing.
import { BOUNDS, COIN, GUARD, LOOT_POINTS, NERVES } from './config.js';
import { createRandom } from './random.js';
import { buildObstacles, LEVELS } from './levels.js';
import { createGuard, STATE_ALERTED, updateGuards } from './guards.js';
import { createCoinThrow, createPlayer, updateCoinThrow, updatePlayer } from './player.js';
import { lightAt } from './vision.js';

export const EVENT_COIN = 1;
export const EVENT_PICKUP = 2;
export const EVENT_RELIC = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_LEVEL = 16;
export const EVENT_ALERT = 32;
export const EVENT_SUSPICIOUS = 64;
export const EVENT_KEY = 128;
export const EVENT_GAMEOVER = 256;
export const EVENT_GAME_COMPLETE = 512;

const DUMMY_PLAYER = { x: -5000, y: -5000, sneak: false, hidden: false };

export function createWorld(random) {
  const rng = random ?? createRandom(1);
  const state = {
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    coins: [],
    ripples: [],
    loot: [],
    keys: [],
    openDoors: new Set(),
    relicTaken: false,
    nerves: NERVES,
    score: 0,
    time: 0,
    levelTime: 0,
    status: 'play',
  };

  function loadLevel(index) {
    const def = LEVELS[index];
    state.levelIndex = index;
    state.openDoors = new Set();
    state.level = {
      def,
      name: def.name,
      brief: def.brief,
      bounds: BOUNDS,
      walls: def.walls,
      crates: def.crates,
      bushes: def.bushes,
      lamps: def.lamps,
      rugs: def.rugs,
      obstacles: buildObstacles(def, state.openDoors),
      doors: def.doors.map((d) => ({ ...d, open: false })),
      exit: def.exit,
      relic: def.relic,
      spawn: def.spawn,
    };
    state.player = createPlayer(def.spawn);
    state.player.coins = COIN.perLevel;
    state.guards = def.guards.map((g) => createGuard(g));
    state.coins = [];
    state.ripples = [];
    state.loot = def.loot.map((l) => ({ ...l, taken: false }));
    state.keys = def.keys.map((k) => ({ ...k, taken: false }));
    state.relicTaken = false;
    state.nerves = NERVES;
    state.levelTime = 0;
    state.status = 'play';
  }

  function resetRun() {
    state.score = 0;
    state.time = 0;
    loadLevel(0);
  }

  function rebuildObstacles() {
    state.level.obstacles = buildObstacles(state.level.def, state.openDoors);
    for (const door of state.level.doors) door.open = state.openDoors.has(door.keyId);
  }

  function respawnAfterCaught() {
    const def = state.level.def;
    state.player.x = def.spawn.x;
    state.player.y = def.spawn.y;
    state.player.hidden = false;
    state.guards = def.guards.map((g) => createGuard(g));
    state.coins = [];
    state.ripples = [];
  }

  /** Throw a coin at a point (used by the player and by the screenshot scenes). */
  function throwCoinAt(x, y) {
    if (state.status !== 'play' || state.player.coins <= 0) return false;
    state.player.coins -= 1;
    state.coins.push(createCoinThrow(state.player.x, state.player.y, x, y));
    return true;
  }

  function step(dt, input, harmless) {
    let events = 0;
    if (state.status !== 'play') return events;
    state.time += dt;
    state.levelTime += dt;
    const player = state.player;
    const level = state.level;

    // Footsteps: the noises this step, handed to the guards below.
    let noises = [];
    if (!harmless) {
      noises = updatePlayer(player, input, dt, level);
      for (const noise of noises) {
        state.ripples.push({
          x: noise.x,
          y: noise.y,
          r: 4,
          maxR: noise.radius,
          alpha: 0.55,
          kind: 'step',
          sneak: noise.sneak,
        });
      }
      player.inLamp = lightAt(player.x, player.y, level.lamps) > 1;
    }

    // A coin throw starts its arc; a landed coin pings and draws every guard.
    if (!harmless && input.throwAt) throwCoinAt(input.throwAt.x, input.throwAt.y);
    for (let i = state.coins.length - 1; i >= 0; i -= 1) {
      const coin = state.coins[i];
      if (updateCoinThrow(coin, dt)) {
        state.coins.splice(i, 1);
        noises.push({ x: coin.toX, y: coin.toY, radius: COIN.pingRadius, kind: 'coin' });
        state.ripples.push({ x: coin.toX, y: coin.toY, r: 6, maxR: COIN.pingRadius, alpha: 0.8, kind: 'coin' });
        events |= EVENT_COIN;
      }
    }

    // Guards: on the title backdrop they patrol a dummy, never spotting anyone.
    const guardEvents = [];
    updateGuards(state.guards, dt, {
      player: harmless ? DUMMY_PLAYER : player,
      level,
      noises,
      rng,
      events: guardEvents,
    });
    if (guardEvents.includes('alerted')) events |= EVENT_ALERT;
    if (guardEvents.includes('suspicious')) events |= EVENT_SUSPICIOUS;

    if (!harmless) {
      // Loot: press E near a gem to pocket it (and earn a coin back).
      if (input.pickup) {
        for (const gem of state.loot) {
          if (!gem.taken && Math.hypot(gem.x - player.x, gem.y - player.y) < 32) {
            gem.taken = true;
            state.score += LOOT_POINTS;
            player.coins += COIN.lootRefund;
            events |= EVENT_PICKUP;
          }
        }
      }
      // Keys open their doors on touch.
      for (const key of state.keys) {
        if (!key.taken && Math.hypot(key.x - player.x, key.y - player.y) < 30) {
          key.taken = true;
          state.openDoors.add(key.keyId);
          rebuildObstacles();
          events |= EVENT_KEY;
        }
      }
      // The relic: touch it and the exit turns green.
      if (!state.relicTaken && Math.hypot(level.relic.x - player.x, level.relic.y - player.y) < 30) {
        state.relicTaken = true;
        state.score += 500;
        events |= EVENT_RELIC;
      }
      // The exit, once the relic is taken, ends the level.
      if (state.relicTaken) {
        const e = level.exit;
        if (player.x > e.x - 6 && player.x < e.x + e.w + 6 && player.y > e.y - 6 && player.y < e.y + e.h + 6) {
          state.status = state.levelIndex === LEVELS.length - 1 ? 'game-complete' : 'level-complete';
          events |= EVENT_LEVEL;
          if (state.status === 'game-complete') events |= EVENT_GAME_COMPLETE;
        }
      }
      // Caught: an alerted guard touches the thief.
      for (const guard of state.guards) {
        if (guard.state !== STATE_ALERTED) continue;
        if (Math.hypot(guard.x - player.x, guard.y - player.y) < GUARD.catchDistance) {
          state.nerves -= 1;
          events |= EVENT_CAUGHT;
          if (state.nerves <= 0) {
            state.status = 'game-over';
            events |= EVENT_GAMEOVER;
          } else {
            respawnAfterCaught();
          }
          break;
        }
      }
    }

    // Ripples expand and fade; dead ones leave the pool.
    for (let i = state.ripples.length - 1; i >= 0; i -= 1) {
      const ripple = state.ripples[i];
      ripple.r += (ripple.maxR - ripple.r) * dt * 2.2 + 26 * dt;
      ripple.alpha -= dt * 0.9;
      if (ripple.alpha <= 0 || ripple.r >= ripple.maxR) state.ripples.splice(i, 1);
    }
    return events;
  }

  loadLevel(0);
  return { state, loadLevel, resetRun, step, throwCoinAt };
}
