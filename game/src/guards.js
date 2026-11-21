// Guard AI: patrol waypoints, then PATROL -> SUSPICIOUS -> ALERTED -> SEARCH
// -> RETURN. A suspicious guard walks to the thing it noticed, then STOPS,
// turns its cone onto the last-seen spot and stares for ~1.5 s — the recovery
// window where breaking line of sight resets the hunt. An alerted guard
// chases, raises the alarm for nearby guards, and catches on touch.
import { DETECT, GUARD } from './config.js';
import { circleBlocked, guardSeesPlayer, lightAt } from './vision.js';

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_LOOK = 'look';
export const STATE_ALERTED = 'alerted';
export const STATE_SEARCH = 'search';
export const STATE_RETURN = 'return';

export function createGuard(def) {
  const start = def.waypoints[0];
  return {
    x: start[0],
    y: start[1],
    dir: 0,
    waypoints: def.waypoints,
    wpIndex: 1 % def.waypoints.length,
    speed: def.speed,
    lantern: def.lantern,
    state: STATE_PATROL,
    meter: 0,
    stateT: 0,
    inv: { x: start[0], y: start[1] },
    lastSeen: { x: start[0], y: start[1] },
    lookDir: 0,
    lostT: 0,
    searchPts: [],
    searchIdx: 0,
  };
}

function turnToward(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

function moveToward(guard, tx, ty, speed, dt, obstacles, bounds) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const targetDir = Math.atan2(dy, dx);
  guard.dir = turnToward(guard.dir, targetDir, 7 * dt);
  // Slide along walls: try x, then y, so a guard never wedges on a corner.
  if (!circleBlocked(nx, guard.y, GUARD.radius, obstacles, bounds)) guard.x = nx;
  if (!circleBlocked(guard.x, ny, GUARD.radius, obstacles, bounds)) guard.y = ny;
  return Math.hypot(tx - guard.x, ty - guard.y) < 10;
}

function nearestWaypointIndex(guard) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < guard.waypoints.length; i += 1) {
    const d = Math.hypot(guard.waypoints[i][0] - guard.x, guard.waypoints[i][1] - guard.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function raiseAlarm(guards, source, player) {
  for (const other of guards) {
    if (other === source) continue;
    if (Math.hypot(other.x - source.x, other.y - source.y) > 260) continue;
    if (other.state === STATE_ALERTED) continue;
    other.state = STATE_SUSPICIOUS;
    other.stateT = 0;
    other.inv = { x: player.x, y: player.y };
    other.lastSeen = { x: player.x, y: player.y };
    other.meter = Math.max(other.meter, 0.5);
  }
}

/**
 * Advance every guard one step. `ctx` carries the player, the level
 * (obstacles, bushes, lamps, bounds), this step's noises, the seeded rng,
 * and an `events` array to push 'suspicious' / 'alerted' into.
 */
export function updateGuards(guards, dt, ctx) {
  const { player, level, noises, rng, events } = ctx;
  const range = (g) => (g.lantern ? GUARD.lanternRange : GUARD.visionRange);

  for (const guard of guards) {
    guard.stateT += dt;
    const sees = guardSeesPlayer(guard, player, level);

    if (sees) {
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      const light = lightAt(player.x, player.y, level.lamps);
      const sneak = player.sneak ? DETECT.sneakMultiplier : 1;
      const fill = Math.max(0.15, 1.15 - dist / range(guard)) * DETECT.baseRate * light * sneak;
      guard.meter = Math.min(1, guard.meter + fill * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      guard.lostT = 0;
      if (guard.meter >= 1 && guard.state !== STATE_ALERTED) {
        guard.state = STATE_ALERTED;
        guard.stateT = 0;
        events.push('alerted');
        raiseAlarm(guards, guard, player);
      } else if (
        guard.meter >= GUARD.suspiciousAt &&
        (guard.state === STATE_PATROL || guard.state === STATE_RETURN)
      ) {
        guard.state = STATE_SUSPICIOUS;
        guard.stateT = 0;
        guard.inv = { x: player.x, y: player.y };
        events.push('suspicious');
      }
    } else {
      guard.meter = Math.max(0, guard.meter - DETECT.drainRate * dt);
      if (guard.state === STATE_ALERTED) {
        guard.lostT += dt;
        if (guard.lostT > GUARD.lostSeconds) {
          guard.state = STATE_SEARCH;
          guard.stateT = 0;
          guard.searchIdx = 0;
          guard.searchPts = [];
          for (let i = 0; i < 3; i += 1) {
            guard.searchPts.push({
              x: guard.lastSeen.x + (rng() - 0.5) * 180,
              y: guard.lastSeen.y + (rng() - 0.5) * 180,
            });
          }
        }
      }
    }

    // Hearing: a noise inside earshot pulls a calm guard to investigate it.
    for (const noise of noises) {
      const d = Math.hypot(noise.x - guard.x, noise.y - guard.y);
      if (d > noise.radius) continue;
      if (
        guard.state === STATE_PATROL ||
        guard.state === STATE_RETURN ||
        guard.state === STATE_SEARCH ||
        guard.state === STATE_LOOK
      ) {
        guard.state = STATE_SUSPICIOUS;
        guard.stateT = 0;
        guard.inv = { x: noise.x, y: noise.y };
        guard.meter = Math.max(guard.meter, 0.4);
        events.push('suspicious');
      }
    }

    switch (guard.state) {
      case STATE_PATROL: {
        const wp = guard.waypoints[guard.wpIndex];
        if (moveToward(guard, wp[0], wp[1], guard.speed, dt, level.obstacles, level.bounds)) {
          guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
        }
        break;
      }
      case STATE_SUSPICIOUS: {
        if (moveToward(guard, guard.inv.x, guard.inv.y, GUARD.suspiciousSpeed, dt, level.obstacles, level.bounds)) {
          guard.state = STATE_LOOK;
          guard.stateT = 0;
          guard.lookDir = Math.atan2(guard.inv.y - guard.y, guard.inv.x - guard.x);
        }
        break;
      }
      case STATE_LOOK: {
        // Stopped, cone sweeping onto the last-seen spot: the recovery window.
        guard.dir = turnToward(guard.dir, guard.lookDir, 2.4 * dt);
        if (guard.stateT > GUARD.lookSeconds) {
          guard.state = STATE_SEARCH;
          guard.stateT = 0;
          guard.searchIdx = 0;
          guard.searchPts = [];
          for (let i = 0; i < 3; i += 1) {
            guard.searchPts.push({
              x: guard.inv.x + (rng() - 0.5) * 180,
              y: guard.inv.y + (rng() - 0.5) * 180,
            });
          }
        }
        break;
      }
      case STATE_ALERTED: {
        moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt, level.obstacles, level.bounds);
        break;
      }
      case STATE_SEARCH: {
        if (guard.searchPts.length === 0 || guard.stateT > GUARD.searchSeconds) {
          guard.state = STATE_RETURN;
          guard.stateT = 0;
          break;
        }
        const pt = guard.searchPts[guard.searchIdx];
        if (moveToward(guard, pt.x, pt.y, GUARD.searchSpeed, dt, level.obstacles, level.bounds)) {
          guard.searchIdx += 1;
          if (guard.searchIdx >= guard.searchPts.length) {
            guard.state = STATE_RETURN;
            guard.stateT = 0;
          }
        }
        break;
      }
      case STATE_RETURN: {
        const idx = nearestWaypointIndex(guard);
        const wp = guard.waypoints[idx];
        if (moveToward(guard, wp[0], wp[1], GUARD.returnSpeed, dt, level.obstacles, level.bounds)) {
          guard.wpIndex = (idx + 1) % guard.waypoints.length;
          guard.state = STATE_PATROL;
          guard.stateT = 0;
        }
        break;
      }
      default:
        break;
    }
  }
}
