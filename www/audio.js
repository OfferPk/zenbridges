/**
 * ZenBridges - Procedural Web Audio Synthesizer
 * Pure procedural synthesis using Web Audio API:
 * - Serene water droplet & singing stone resonance
 * - Pentatonic harmonic frequencies
 * - Zero external audio files/assets
 */

class ZenAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.isInitialized = false;

    // Load sound preference from localStorage
    try {
      const saved = localStorage.getItem('zenbridges_sound_enabled');
      if (saved !== null) {
        this.muted = saved === 'false';
      }
    } catch (e) {
      this.muted = false;
    }
  }

  init() {
    if (this.isInitialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.isInitialized = true;
      }
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleSound() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('zenbridges_sound_enabled', String(!this.muted));
    } catch (e) {}
    return !this.muted;
  }

  isSoundEnabled() {
    return !this.muted;
  }

  /**
   * Serene water droplet / stone tap sound for bridge creation
   */
  playBridgeTap(count = 1) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Pentatonic scale based frequencies
    const baseFreq = count === 1 ? 523.25 : 659.25; // C5 or E5

    osc.type = 'sine';
    // Gentle downward pitch sweep mimicking a droplet
    osc.frequency.setValueAtTime(baseFreq * 1.2, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.08);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * Soft splash/dissolve sound when bridge is removed (count back to 0)
   */
  playBridgeRemove() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(392.00, t); // G4
    osc.frequency.exponentialRampToValueAtTime(220.00, t + 0.12);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * Resonant singing stone chime when an island reaches exact satisfaction
   */
  playIslandSatisfied() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [783.99, 1046.50]; // G5, C6 harmonic

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const delay = idx * 0.03;
      gain.gain.setValueAtTime(0.001, t + delay);
      gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + delay);
      osc.stop(t + delay + 0.65);
    });
  }

  /**
   * Harmonious victory cascade chord on level completion
   */
  playVictory() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Pentatonic chord: C5, E5, G5, A5, C6
    const chord = [523.25, 659.25, 783.99, 880.00, 1046.50];

    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = t + i * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 1.25);
    });
  }

  /**
   * Soft subtle chime for hints or general UI clicks
   */
  playUiClick() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZenAudio };
}
