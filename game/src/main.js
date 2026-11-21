// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, brief, play, paused, level clear, caught, game complete and
// game over screens; best times live in localStorage.
//
// ?seed=N fixes the guard jitter. ?shot=title|play|coin|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady (plus window.__shotResult) for a screenshot.
import { BEST_KEY_PREFIX, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_COIN, EVENT_GAME_COMPLETE, EVENT_GAMEOVER, EVENT_KEY, EVENT_LEVEL, EVENT_PICKUP, EVENT_RELIC, EVENT_SUSPICIOUS } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_CAUGHT, SCREEN_COMPLETE, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function bestKey(levelIndex) {
  return `${BEST_KEY_PREFIX}${levelIndex}`;
}

function readBest(levelIndex) {
  try {
    return Number.parseFloat(window.localStorage.getItem(bestKey(levelIndex)) ?? '') || null;
  } catch {
    return null;
  }
}

function saveBest(levelIndex, seconds) {
  try {
    const current = readBest(levelIndex);
    if (current === null || seconds < current) {
      window.localStorage.setItem(bestKey(levelIndex), String(seconds));
      return true;
    }
  } catch {
    // Storage can be off (private windows): bests then last this visit only.
  }
  return false;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const best = readBest(world.state.levelIndex);
  let painted = 0;
  function paint() {
    renderer.draw(scene.screen, world.state, {
      best,
      muted: audio.isMuted(),
      bestLines: [],
      bestLine: best === null ? '' : `Best time: ${renderer.formatTime(best)}`,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotResult = scene.result;
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let bestLine = '';

  function announce(message) {
    status.textContent = message;
  }

  function bestLines() {
    const lines = [];
    for (let i = 0; i < 3; i += 1) {
      const best = readBest(i);
      if (best !== null) lines.push(`Level ${i + 1} best: ${renderer.formatTime(best)}`);
    }
    return lines;
  }

  function startLevel(index) {
    world.loadLevel(index);
    accumulator = 0;
    screen = SCREEN_BRIEF;
    announce(`${world.state.level.name}. ${world.state.level.brief}`);
  }

  function startRun() {
    world.resetRun();
    audio.unlock();
    audio.startDrone();
    startLevel(0);
  }

  function handleEvents(events) {
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_KEY) audio.key();
    if (events & EVENT_RELIC) {
      audio.relic();
      announce('Relic taken. Reach the green exit.');
    }
    if (events & EVENT_SUSPICIOUS) audio.huh();
    if (events & EVENT_ALERT) {
      audio.alarm();
      announce('Spotted! Break line of sight!');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      if (world.state.status === 'game-over') {
        screen = SCREEN_OVER;
        announce('Game over. Out of nerves.');
      } else {
        screen = SCREEN_CAUGHT;
        announce(`Caught. ${world.state.nerves} nerves left.`);
      }
    }
    if (events & EVENT_LEVEL) {
      if (events & EVENT_GAME_COMPLETE) {
        audio.success();
        const improved = saveBest(2, world.state.levelTime);
        bestLine = improved ? 'New best time for the Vault!' : '';
        screen = SCREEN_COMPLETE;
        announce(`The Moon Opal is yours. Total time ${renderer.formatTime(world.state.time)}.`);
      } else {
        audio.success();
        const improved = saveBest(world.state.levelIndex, world.state.levelTime);
        bestLine = improved ? 'New best time!' : '';
        screen = SCREEN_LEVEL;
        announce(`${world.state.level.name} cleared in ${renderer.formatTime(world.state.levelTime)}.`);
      }
    }
    if (events & EVENT_GAMEOVER) {
      screen = SCREEN_OVER;
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startRun();
      else if (screen === SCREEN_BRIEF) {
        screen = SCREEN_PLAY;
        announce('Playing. Stay unseen.');
      } else if (screen === SCREEN_LEVEL) {
        startLevel(world.state.levelIndex + 1);
      } else if (screen === SCREEN_CAUGHT) {
        screen = SCREEN_PLAY;
        announce('Playing. Stay unseen.');
      } else if (screen === SCREEN_COMPLETE || screen === SCREEN_OVER) {
        if (screen === SCREEN_OVER) startLevel(world.state.levelIndex);
        else startRun();
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sneak: false, throwAt: null, pickup: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.direction();
    const events = world.step(STEP, {
      x: move.x,
      y: move.y,
      sneak: move.sneak,
      throwAt: input.takeThrow(),
      pickup: input.takePickup(),
    }, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(screen, world.state, {
      muted: audio.isMuted(),
      bestLines: screen === SCREEN_TITLE ? bestLines() : [],
      bestLine,
    });
  }

  // Leaving the tab pauses a running game rather than letting guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Shadow. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
