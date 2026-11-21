// Sight, light and cover: line-of-sight against walls and crates, the guard
// vision cone, lamp pools versus darkness, and bushes as hiding spots.
// Pure geometry — no drawing, no state — so guards, the autopilot and the
// renderer all ask the same questions and get the same answers.
import { DETECT, GUARD } from './config.js';

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const slabs = [
    [dx, x1 - rect.x, rect.x + rect.w - x1],
    [dy, y1 - rect.y, rect.y + rect.h - y1],
  ];
  for (const [d, low, high] of slabs) {
    if (Math.abs(d) < 1e-9) {
      if (low > 0 || high < 0) return false;
    } else {
      let t1 = low / d;
      let t2 = high / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/** True when any obstacle blocks the line between two points. */
export function lineBlocked(x1, y1, x2, y2, obstacles) {
  for (let i = 0; i < obstacles.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, obstacles[i])) return true;
  }
  return false;
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/** Is the point (x,y) inside this guard's vision cone, with clear sight? */
export function pointInCone(guard, x, y, obstacles) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const distance = Math.hypot(dx, dy);
  const range = guard.lantern ? GUARD.lanternRange : GUARD.visionRange;
  if (distance > range) return false;
  if (distance < 1e-6) return true;
  const angle = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angle, guard.dir)) > GUARD.visionHalfAngle) return false;
  return !lineBlocked(guard.x, guard.y, x, y, obstacles);
}

/** Can this guard see the player right now? Bushes hide beyond arm's reach. */
export function guardSeesPlayer(guard, player, level) {
  if (player.hidden && Math.hypot(player.x - guard.x, player.y - guard.y) > DETECT.bushBlindDistance) {
    return false;
  }
  return pointInCone(guard, player.x, player.y, level.obstacles);
}

/** Light multiplier at a point: lamp pools are dangerous, darkness is cover. */
export function lightAt(x, y, lamps) {
  for (let i = 0; i < lamps.length; i += 1) {
    const lamp = lamps[i];
    if (Math.hypot(x - lamp.x, y - lamp.y) < lamp.r) return DETECT.lampMultiplier;
  }
  return DETECT.darkMultiplier;
}

/** True when the point is inside any bush circle. */
export function inBush(x, y, bushes) {
  for (let i = 0; i < bushes.length; i += 1) {
    const bush = bushes[i];
    if (Math.hypot(x - bush.x, y - bush.y) < bush.r) return true;
  }
  return false;
}

/** Circle-vs-rectangle overlap, for movement collision. */
export function circleHitsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** True when a circle at (x,y) touches any obstacle or leaves the bounds. */
export function circleBlocked(x, y, radius, obstacles, bounds) {
  if (x - radius < bounds.x || x + radius > bounds.x + bounds.width) return true;
  if (y - radius < bounds.y || y + radius > bounds.y + bounds.height) return true;
  for (let i = 0; i < obstacles.length; i += 1) {
    if (circleHitsRect(x, y, radius, obstacles[i])) return true;
  }
  return false;
}
