// All sound is synthesised with WebAudio: no audio files, no network. Footsteps
// are short filtered noise bursts, pickups and alarms are small oscillator phrases,
// and a quiet low pad hums under the title screen. The context is created lazily
// on the first user gesture, so browsers never block it.

export function createAudio() {
  let context = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, duration, type, gainValue, when = 0, slideTo = null) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noiseBurst(duration, gainValue, filterFrequency) {
    if (!context || muted) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    /** Call from any user gesture so the browser unlocks sound. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() {
      return muted;
    },
    /** A footstep: loud and low when running, a soft tick when sneaking. */
    footstep(sneaking) {
      if (sneaking) noiseBurst(0.05, 0.05, 700);
      else noiseBurst(0.07, 0.16, 500);
    },
    /** A pebble skittering across stone. */
    pebble() {
      noiseBurst(0.09, 0.22, 2400);
      tone(1900, 0.06, 'sine', 0.08, 0.05);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.22);
      tone(1318, 0.18, 'sine', 0.2, 0.09);
    },
    /** A guard grows suspicious: one low questioning note. */
    noticed() {
      tone(392, 0.22, 'triangle', 0.2, 0, 330);
    },
    /** The alarm: a rising sawtooth sting. */
    alarm() {
      tone(220, 0.5, 'sawtooth', 0.16, 0, 440);
      tone(330, 0.5, 'sawtooth', 0.12, 0.08, 494);
    },
    caught() {
      tone(196, 0.7, 'sawtooth', 0.2, 0, 98);
      tone(147, 0.9, 'square', 0.1, 0.15, 73);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone(frequency, 0.22, 'sine', 0.2, index * 0.11);
      });
    },
    victory() {
      [523, 659, 784, 1047, 1319, 1568].forEach((frequency, index) => {
        tone(frequency, 0.35, 'sine', 0.18, index * 0.13);
      });
    },
    /** A quiet two-note pad under the title screen; stops when play starts. */
    startPad() {
      if (!ensure() || padNodes || muted) return;
      const gain = context.createGain();
      gain.gain.value = 0.05;
      gain.connect(master);
      const oscillators = [110, 164.8].map((frequency) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start();
        return oscillator;
      });
      padNodes = { gain, oscillators };
    },
    stopPad() {
      if (!padNodes) return;
      const { gain, oscillators } = padNodes;
      padNodes = null;
      gain.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.4);
      oscillators.forEach((oscillator) => oscillator.stop(context.currentTime + 0.5));
    },
  };
}
