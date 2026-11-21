// The thief, Wren: movement with wall sliding, sneak, and the coin throw.
// Footsteps are the game's sound language — each step leaves a ripple and a
// noise guards can hear, quiet when sneaking, loud when walking.
import { PLAYER } from './config.js';
import { circleBlocked, inBush } from './vision.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    dir: -Math.PI / 2,
    sneak: false,
    moving: false,
    hidden: false,
    inLamp: false,
    coins: 0,
    stepT: 0,
  };
}

/**
 * Move the player one step. Returns the noises made this step (footsteps)
 * so the world can hand them to the guards and draw their ripples.
 */
export function updatePlayer(player, input, dt, level) {
  const noises = [];
  const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const dx = input.x * speed * dt;
  const dy = input.y * speed * dt;
  player.sneak = input.sneak;
  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    player.dir = Math.atan2(input.y, input.x);
    // Slide along walls: try x, then y.
    if (!circleBlocked(player.x + dx, player.y, PLAYER.radius, level.obstacles, level.bounds)) {
      player.x += dx;
    }
    if (!circleBlocked(player.x, player.y + dy, PLAYER.radius, level.obstacles, level.bounds)) {
      player.y += dy;
    }
    // A step lands every step interval: a ripple, a sound, a chance to be heard.
    player.stepT += dt;
    const interval = input.sneak ? PLAYER.stepSneak : PLAYER.stepWalk;
    if (player.stepT >= interval) {
      player.stepT = 0;
      noises.push({
        x: player.x,
        y: player.y,
        radius: input.sneak ? PLAYER.noiseSneak : PLAYER.noiseWalk,
        kind: 'step',
        sneak: input.sneak,
      });
    }
  } else {
    player.stepT = 0;
  }

  player.hidden = inBush(player.x, player.y, level.bushes);
  return noises;
}

/** A thrown coin arcs toward the target, then lands with a loud ping. */
export function createCoinThrow(fromX, fromY, toX, toY) {
  return { x: fromX, y: fromY, fromX, fromY, toX, toY, t: 0, landed: false };
}

export function updateCoinThrow(coin, dt) {
  coin.t += dt;
  const k = Math.min(1, coin.t / 0.38);
  coin.x = coin.fromX + (coin.toX - coin.fromX) * k;
  coin.y = coin.fromY + (coin.toY - coin.fromY) * k;
  if (k >= 1 && !coin.landed) {
    coin.landed = true;
    return true;
  }
  return false;
}
