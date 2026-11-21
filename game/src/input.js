// Keyboard and mouse input: movement keys, edge-triggered actions, and the
// coin-throw target. The world reads this once per fixed step, never directly.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PICKUP = 4;
export const ACTION_MUTE = 8;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let queuedActions = 0;
  let queuedThrow = null;
  let queuedPickup = false;
  const mouse = { x: VIEW.width / 2, y: VIEW.height / 2 };

  function toGameCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIEW.width / rect.width;
    const scaleY = VIEW.height / rect.height;
    mouse.x = (event.clientX - rect.left) * scaleX;
    mouse.y = (event.clientY - rect.top) * scaleY;
    return { x: mouse.x, y: mouse.y };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      queuedActions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      queuedActions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      // Pickup rides its own queue: reading it in step() must never eat a
      // confirm or pause press queued in the same frame.
      queuedPickup = true;
    } else if (event.code === 'KeyM') {
      queuedActions |= ACTION_MUTE;
    } else if (event.code === 'KeyF') {
      queuedThrow = { x: mouse.x, y: mouse.y };
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('mousemove', toGameCoords);
  canvas.addEventListener('mousedown', (event) => {
    // A click is a coin throw: the thief tosses a coin at the clicked spot.
    queuedThrow = toGameCoords(event);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      const move = MOVE_KEYS[code];
      if (move) {
        x += move[0];
        y += move[1];
      }
    }
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y, sneak: held.has('ShiftLeft') || held.has('ShiftRight') };
  }

  function takeActions() {
    const actions = queuedActions;
    queuedActions = 0;
    return actions;
  }

  function takeThrow() {
    const target = queuedThrow;
    queuedThrow = null;
    return target;
  }

  function takePickup() {
    const pickup = queuedPickup;
    queuedPickup = false;
    return pickup;
  }

  return { direction, takeActions, takeThrow, takePickup };
}
