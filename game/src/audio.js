// Synthesized sound with WebAudio: no audio files, no network. Every effect
// is a few oscillators or a burst of filtered noise, and every call is safe
// to make before the player has interacted (the context simply stays quiet).
export function createAudio() {
  let context = null;
  let droneNodes = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, duration, type, volume, slideTo) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // A headless run or a blocked context must never break the game.
    }
  }

  function noiseBurst(duration, volume, cutoff) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
    } catch {
      // See tone(): sound is garnish, never load-bearing.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    // Soft filtered tick; sneaking is quieter and lower.
    footstep(sneak) {
      noiseBurst(0.07, sneak ? 0.05 : 0.11, sneak ? 500 : 900);
    },
    // A guard's puzzled "huh?": a short rising blip.
    huh() {
      tone(520, 0.16, 'sine', 0.12, 760);
    },
    // Alarm sting when a guard spots the thief: two dissonant stabs.
    alarm() {
      tone(220, 0.28, 'sawtooth', 0.14, 208);
      tone(233, 0.28, 'sawtooth', 0.14, 220);
      setTimeout(() => tone(220, 0.3, 'sawtooth', 0.14, 196), 160);
    },
    // Bright coin ping that rings where the coin lands.
    coin() {
      tone(1567, 0.5, 'sine', 0.16, 1567);
      tone(2093, 0.35, 'sine', 0.08, 2093);
    },
    // Loot pickup chime.
    pickup() {
      tone(880, 0.12, 'triangle', 0.14);
      setTimeout(() => tone(1318, 0.18, 'triangle', 0.14), 80);
    },
    // Brass key clink.
    key() {
      tone(660, 0.1, 'square', 0.07);
      setTimeout(() => tone(990, 0.14, 'square', 0.07), 70);
    },
    // Relic fanfare: a rising arpeggio.
    relic() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.3, 'triangle', 0.16), i * 95);
      });
    },
    // Level-clear jingle.
    success() {
      [523, 659, 784, 1046, 1318].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.32, 'triangle', 0.15), i * 110);
      });
    },
    // Caught thud.
    caught() {
      noiseBurst(0.25, 0.22, 300);
      tone(110, 0.4, 'sawtooth', 0.16, 55);
    },
    // Low ambient drone that starts with the first level and never stops.
    startDrone() {
      const ctx = ensure();
      if (!ctx || droneNodes) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 55;
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 55.7;
        const gain = ctx.createGain();
        gain.gain.value = 0.035;
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc2.start();
        droneNodes = { osc, osc2, gain };
      } catch {
        droneNodes = null;
      }
    },
  };
}
