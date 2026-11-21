// Drawing: the night manor, lamp pools and vision cones, the thief and the
// guards, the darkness overlay with its light holes, the slim HUD, and every
// screen panel. Nothing here changes the simulation — it only paints state.
import { GUARD, PALETTE, VIEW } from './config.js';
import { STATE_ALERTED, STATE_LOOK, STATE_PATROL, STATE_RETURN, STATE_SEARCH, STATE_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_OVER = 'over';

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function coneColor(state) {
  if (state === STATE_ALERTED) return PALETTE.coneAlerted;
  if (state === STATE_SUSPICIOUS || state === STATE_LOOK || state === STATE_SEARCH) return PALETTE.coneSuspicious;
  return PALETTE.conePatrol;
}

function stateIcon(state) {
  if (state === STATE_ALERTED) return { text: '!', color: '#ff5148' };
  if (state === STATE_SUSPICIOUS || state === STATE_LOOK || state === STATE_SEARCH) return { text: '?', color: '#ffd76a' };
  return { text: '•', color: 'rgba(232, 228, 216, 0.55)' };
}

export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = VIEW.width;
  dark.height = VIEW.height;
  const darkCtx = dark.getContext('2d');

  function drawFloor(level) {
    const tile = 64;
    for (let y = VIEW.hud; y < VIEW.height; y += tile) {
      for (let x = 0; x < VIEW.width; x += tile) {
        ctx.fillStyle = ((x / tile + y / tile) % 2 === 0) ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, tile, tile);
      }
    }
    // Moonlight shafts: cold diagonal bands across the floor.
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#9db8ff';
    for (let i = 0; i < 3; i += 1) {
      const x = 180 + i * 420;
      ctx.beginPath();
      ctx.moveTo(x, VIEW.hud);
      ctx.lineTo(x + 130, VIEW.hud);
      ctx.lineTo(x + 40, VIEW.height);
      ctx.lineTo(x - 90, VIEW.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    for (const rug of level.rugs) {
      ctx.fillStyle = PALETTE.rug;
      ctx.fillRect(rug.x, rug.y, rug.w, rug.h);
      ctx.strokeStyle = PALETTE.rugEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(rug.x + 5, rug.y + 5, rug.w - 10, rug.h - 10);
    }
  }

  function drawLampPools(level) {
    for (const lamp of level.lamps) {
      const gradient = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
      gradient.addColorStop(0, 'rgba(255, 179, 71, 0.28)');
      gradient.addColorStop(0.6, 'rgba(255, 179, 71, 0.12)');
      gradient.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
      ctx.fill();
      // The lamp itself: a warm post with a flame dot.
      ctx.fillStyle = '#2a2118';
      ctx.fillRect(lamp.x - 3, lamp.y - 3, 6, 6);
      ctx.fillStyle = PALETTE.lamp;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCone(guard) {
    const range = guard.lantern ? GUARD.lanternRange : GUARD.visionRange;
    const rgb = coneColor(guard.state);
    const gradient = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, range);
    gradient.addColorStop(0, `rgba(${rgb}, 0.42)`);
    gradient.addColorStop(0.7, `rgba(${rgb}, 0.2)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, range, guard.dir - GUARD.visionHalfAngle, guard.dir + GUARD.visionHalfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.dir - GUARD.visionHalfAngle) * range, guard.y + Math.sin(guard.dir - GUARD.visionHalfAngle) * range);
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.dir + GUARD.visionHalfAngle) * range, guard.y + Math.sin(guard.dir + GUARD.visionHalfAngle) * range);
    ctx.stroke();
  }

  function drawExit(level, relicTaken) {
    const e = level.exit;
    const open = relicTaken;
    ctx.save();
    ctx.shadowColor = open ? PALETTE.exit : '#000';
    ctx.shadowBlur = open ? 22 : 0;
    ctx.fillStyle = open ? '#1d7a33' : PALETTE.exitLocked;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.restore();
    ctx.strokeStyle = open ? PALETTE.exit : '#7a8494';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = open ? '#d8ffe0' : '#aab2c0';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2);
  }

  function drawRelic(level, time, relicTaken) {
    if (relicTaken) return;
    const r = level.relic;
    const pulse = 1 + 0.12 * Math.sin(time * 3);
    ctx.save();
    ctx.shadowColor = PALETTE.relic;
    ctx.shadowBlur = 26;
    ctx.translate(r.x, r.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.relic;
    const s = 13 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = '#dffffc';
    ctx.fillRect(-s / 5, -s / 5, (s * 2) / 5, (s * 2) / 5);
    ctx.restore();
    ctx.fillStyle = PALETTE.relic;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOON OPAL', r.x, r.y + 30);
  }

  function drawLoot(state) {
    for (const gem of state.loot) {
      if (gem.taken) continue;
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
    for (const key of state.keys) {
      if (key.taken) continue;
      ctx.save();
      ctx.translate(key.x, key.y);
      ctx.strokeStyle = PALETTE.key;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(16, 0);
      ctx.moveTo(12, 0);
      ctx.lineTo(12, 5);
      ctx.moveTo(16, 0);
      ctx.lineTo(16, 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawWalls(level) {
    for (const wall of level.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, Math.min(4, wall.h));
    }
    for (const door of level.doors) {
      if (door.open) continue;
      ctx.fillStyle = '#6b4a1f';
      ctx.fillRect(door.x, door.y, door.w, door.h);
      ctx.strokeStyle = PALETTE.key;
      ctx.lineWidth = 2;
      ctx.strokeRect(door.x + 2, door.y + 2, door.w - 4, door.h - 4);
      ctx.fillStyle = PALETTE.key;
      ctx.beginPath();
      ctx.arc(door.x + door.w / 2, door.y + door.h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const crate of level.crates) {
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(crate.x + 2, crate.y + 2, crate.w - 4, crate.h - 4);
      ctx.beginPath();
      ctx.moveTo(crate.x, crate.y);
      ctx.lineTo(crate.x + crate.w, crate.y + crate.h);
      ctx.moveTo(crate.x + crate.w, crate.y);
      ctx.lineTo(crate.x, crate.y + crate.h);
      ctx.stroke();
    }
  }

  function drawBush(bush, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const blobs = [
      [0, 0, 0.62], [-0.45, 0.2, 0.45], [0.45, 0.2, 0.45], [0, -0.42, 0.5], [-0.2, 0.38, 0.42], [0.25, -0.32, 0.42],
    ];
    for (const [ox, oy, k] of blobs) {
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(bush.x + ox * bush.r, bush.y + oy * bush.r, bush.r * k, 0, Math.PI * 2);
      ctx.fill();
    }
    // Leaf texture: lighter dots so the bush reads as cover at a glance.
    ctx.fillStyle = PALETTE.bushLeaf;
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2 + bush.x;
      const rr = bush.r * (0.25 + ((i * 37) % 10) / 18);
      ctx.beginPath();
      ctx.arc(bush.x + Math.cos(angle) * rr, bush.y + Math.sin(angle) * rr, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.bushBright;
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + bush.y * 0.7;
      ctx.beginPath();
      ctx.arc(bush.x + Math.cos(angle) * bush.r * 0.55, bush.y + Math.sin(angle) * bush.r * 0.55, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGuard(guard, time) {
    // Detection meter: an arc over the guard's head, yellow filling to red.
    if (guard.meter > 0.02) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 24, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = guard.meter > 0.7 ? '#ff5148' : '#ffd76a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 24, 15, -Math.PI / 2, -Math.PI / 2 + guard.meter * Math.PI * 2);
      ctx.stroke();
    }
    const icon = stateIcon(guard.state);
    ctx.font = guard.state === STATE_ALERTED ? 'bold 24px system-ui, sans-serif' : 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = icon.color;
    ctx.fillText(icon.text, guard.x, guard.y - 44);
    // Body: dark uniform, red trim, helmet; a lantern-bearer carries a glow.
    if (guard.lantern) {
      const glow = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 60);
      glow.addColorStop(0, 'rgba(255, 179, 71, 0.35)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.guardBody;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    // Helmet brim pointing where the guard looks.
    ctx.fillStyle = PALETTE.guardHelmet;
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.dir) * 5, guard.y + Math.sin(guard.dir) * 5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8dce8';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.dir) * 9, guard.y + Math.sin(guard.dir) * 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(player, time) {
    // A tiny lantern glow so the thief is never lost in the dark.
    const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 46);
    glow.addColorStop(0, 'rgba(255, 200, 110, 0.28)');
    glow.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 46, 0, Math.PI * 2);
    ctx.fill();
    // Cloak and hood, always outlined bright so the player reads in shadow.
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerHood;
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.dir) * 4, player.y + Math.sin(player.dir) * 4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d9a8';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.dir) * 8, player.y + Math.sin(player.dir) * 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (player.sneak) {
      ctx.fillStyle = 'rgba(232, 240, 255, 0.8)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneak', player.x, player.y - 22);
    }
  }

  function drawRipples(state) {
    for (const ripple of state.ripples) {
      ctx.strokeStyle = ripple.kind === 'coin'
        ? `rgba(245, 197, 66, ${ripple.alpha})`
        : `rgba(200, 220, 255, ${ripple.alpha * 0.8})`;
      ctx.lineWidth = ripple.kind === 'coin' ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const coin of state.coins) {
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawDarkness(state) {
    darkCtx.clearRect(0, 0, VIEW.width, VIEW.height);
    darkCtx.fillStyle = 'rgba(4, 7, 18, 0.5)';
    darkCtx.fillRect(0, 0, VIEW.width, VIEW.height);
    darkCtx.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, strength) {
      const gradient = darkCtx.createRadialGradient(x, y, 4, x, y, r);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      darkCtx.fillStyle = gradient;
      darkCtx.beginPath();
      darkCtx.arc(x, y, r, 0, Math.PI * 2);
      darkCtx.fill();
    }
    for (const lamp of state.level.lamps) hole(lamp.x, lamp.y, lamp.r * 1.1, 0.95);
    for (const guard of state.guards) hole(guard.x, guard.y, 80, 0.85);
    hole(state.player.x, state.player.y, 100, 0.95);
    hole(state.level.relic.x, state.level.relic.y, 65, 0.8);
    hole(state.level.exit.x + state.level.exit.w / 2, state.level.exit.y + state.level.exit.h / 2, 75, 0.8);
    darkCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0);
  }

  function drawHud(state, ui) {
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.hud);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.level.name, 16, 25);
    // Relic, loot, coins, nerves.
    ctx.font = '16px system-ui, sans-serif';
    const relicIcon = state.relicTaken ? '✦' : '✧';
    ctx.fillStyle = state.relicTaken ? PALETTE.relic : PALETTE.hudDim;
    ctx.fillText(`${relicIcon} Relic`, 250, 25);
    const lootTaken = state.loot.filter((g) => g.taken).length;
    ctx.fillStyle = PALETTE.loot;
    ctx.fillText(`◆ ${lootTaken}/${state.loot.length}`, 350, 25);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(`◉ ${state.player.coins}`, 440, 25);
    let hearts = '';
    for (let i = 0; i < 3; i += 1) hearts += i < state.nerves ? '♥' : '♡';
    ctx.fillStyle = '#ff6b64';
    ctx.fillText(hearts, 510, 25);
    // The eye: the worst detection meter among the guards.
    let worst = 0;
    for (const guard of state.guards) worst = Math.max(worst, guard.meter);
    const eyeX = 640;
    ctx.fillStyle = worst > 0.7 ? '#ff5148' : worst > 0.3 ? '#ffd76a' : PALETTE.hudDim;
    ctx.beginPath();
    ctx.ellipse(eyeX, 25, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d1526';
    ctx.beginPath();
    ctx.arc(eyeX, 25, 4 + worst * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${formatTime(state.levelTime)}`, 1000, 25);
    ctx.fillText(`Score ${state.score}`, 1264, 25);
    ctx.textAlign = 'left';
    if (ui.muted) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('muted (M)', 1030, 25);
    }
  }

  function wrapText(text, maxWidth, font) {
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function panel(title, lines, prompt, titleColor) {
    ctx.fillStyle = PALETTE.panelBg;
    const w = 760;
    const h = 130 + lines.length * 30;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = titleColor ?? PALETTE.titleGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = titleColor ?? PALETTE.titleGold;
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, VIEW.width / 2, y + 52);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = '17px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, y + 102 + i * 30);
    });
    if (prompt) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(prompt, VIEW.width / 2, y + h - 26);
    }
  }

  function draw(screen, state, ui) {
    const level = state.level;
    const time = state.time;
    drawFloor(level);
    drawLampPools(level);
    for (const guard of state.guards) drawCone(guard);
    drawExit(level, state.relicTaken);
    drawWalls(level);
    for (const bush of level.bushes) drawBush(bush, 1);
    // Relic and loot sit on top of cover: the goal must never hide behind a bush.
    drawRelic(level, time, state.relicTaken);
    drawLoot(state);
    for (const guard of state.guards) drawGuard(guard, time);
    drawPlayer(state.player, time);
    // Canopy over a hidden thief: the bush swallows them, the outline stays.
    if (state.player.hidden) {
      for (const bush of level.bushes) {
        if (Math.hypot(state.player.x - bush.x, state.player.y - bush.y) < bush.r) {
          drawBush(bush, 0.55);
        }
      }
      ctx.fillStyle = '#7ee2a0';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', state.player.x, state.player.y - 26);
    }
    drawRipples(state);
    drawDarkness(state);
    drawHud(state, ui);

    if (screen === SCREEN_TITLE) {
      const bestLines = ui.bestLines ?? [];
      panel('THE GILDED SHADOW', [
        'You are Wren, thief of the night. Steal the Moon Opal from Lord Ashford’s manor — unseen.',
        'WASD / arrows to move · Shift to sneak · Click or F to toss a coin · E to pocket loot · P to pause',
        'Stay out of the cones. Bushes and darkness hide you. Lamp light gives you away.',
        ...bestLines,
      ], 'Press SPACE or click to begin');
    } else if (screen === SCREEN_BRIEF) {
      const lines = wrapText(level.brief, 680, '17px system-ui, sans-serif');
      panel(`LEVEL ${state.levelIndex + 1} — ${level.name.toUpperCase()}`, lines, 'Press SPACE to start the heist');
    } else if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['The manor waits. The guards do not — not really.'], 'Press P or SPACE to keep sneaking');
    } else if (screen === SCREEN_LEVEL) {
      panel('LEVEL CLEAR', [
        `${level.name} — cleared in ${formatTime(state.levelTime)}.`,
        `Loot ${state.loot.filter((g) => g.taken).length}/${state.loot.length} · Score ${state.score}`,
        state.bestLine ?? '',
      ].filter(Boolean), state.levelIndex === 2 ? '' : 'Press SPACE for the next level');
    } else if (screen === SCREEN_CAUGHT) {
      panel('CAUGHT!', [
        'A guard laid hands on you in the dark.',
        `Nerves left: ${state.nerves} — slip back to the start and try quieter.`,
      ], 'Press SPACE to try again', '#ff5148');
    } else if (screen === SCREEN_COMPLETE) {
      panel('THE MOON OPAL IS YOURS', [
        `All three levels cleared in ${formatTime(state.time)}.`,
        `Final score ${state.score}. The manor never saw you coming.`,
        state.bestLine ?? '',
      ].filter(Boolean), 'Press SPACE to play again');
    } else if (screen === SCREEN_OVER) {
      panel('THE MANOR WINS… THIS TIME', [
        'Out of nerves. The guards change the locks and double the patrols.',
        'But a thief always comes back.',
      ], 'Press SPACE to try the level again', '#ff5148');
    }
  }

  return { draw, formatTime };
}
