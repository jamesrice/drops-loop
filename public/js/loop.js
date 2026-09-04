// Drops Loop — the game itself.
//
// One gummy sweeps a circular track. A glowing sugar zone opens somewhere ahead
// of it. Tap to lock the gummy inside the zone: the loop reverses, speeds up,
// and the zone narrows. Land in the middle for a PERFECT. Let one slip past and
// the run is over.
//
// Rendering is a single 2D canvas; all chrome lives in the DOM overlay. The
// module owns no UI — it emits events and index.html decides what to show.

import { PAL, SKY_KEYS, GUMMY_FLAVORS, DROPS_BRAND, MODES, SCORE } from "./style.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

// signed shortest angular distance from b to a, in (-PI, PI]
function angDelta(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

// Sky keyframe interpolation — the run's own day/night cycle.
function skyAt(p) {
  p = ((p % 1) + 1) % 1;
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    if (p >= a.p && p <= b.p) {
      const t = (p - a.p) / (b.p - a.p || 1);
      return { top: mixHex(a.top, b.top, t), bot: mixHex(a.bot, b.bot, t), stars: lerp(a.stars, b.stars, t) };
    }
  }
  const k = SKY_KEYS[0];
  return { top: k.top, bot: k.bot, stars: k.stars };
}

// A shuffled bag so all 11 flavors show up before any repeats.
function makeBag() {
  const bag = GUMMY_FLAVORS.map((_, i) => i);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export const Loop = {
  canvas: null, ctx: null,
  w: 0, h: 0, cx: 0, cy: 0, R: 0,
  state: "idle",          // idle | live | over
  mode: MODES.casual,
  handlers: {},

  // run state
  ang: 0, dir: 1, spin: 0, zoneC: 0, zoneW: 0,
  score: 0, combo: 0, maxCombo: 0, locks: 0, perfects: 0, runTaps: 0,
  wasInside: false,
  flavor: GUMMY_FLAVORS[0], bag: [],

  // fx
  parts: [], trail: [], shake: 0, flash: 0, pulse: 0, ringPop: 0,
  stars: [], last: 0, t: 0, muted: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    addEventListener("resize", () => this.resize());
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random(), y: Math.random() * 0.85, r: rand(0.6, 1.9), tw: Math.random() * TAU });
    }
    this.sfxLock = new Audio("./assets/audio/sfx-pickup.mp3");
    this.sfxOver = new Audio("./assets/audio/sfx-gameover.mp3");
    this.sfxLock.volume = 0.55; this.sfxOver.volume = 0.5;
    this.last = performance.now();
    this.schedule();
    return this;
  },

  // Drive the loop from rAF, with a timer backstop for hosts that starve
  // animation frames (background tabs, some embedded webviews). Whichever
  // fires first wins; the other is cancelled on entry to frame().
  schedule() {
    this.rafId = requestAnimationFrame((t) => this.frame(t));
    this.timerId = setTimeout(() => this.frame(performance.now()), 60);
  },

  // Several listeners per event — the UI and the QA harness both subscribe.
  on(name, fn) { (this.handlers[name] ||= []).push(fn); return this; },
  emit(name, payload) { for (const f of this.handlers[name] || []) f(payload); },

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = this.w / 2;
    this.cy = this.h * (this.w < 620 ? 0.42 : 0.46);
    this.R = Math.min(this.w * 0.34, this.h * 0.30, 210);
  },

  nextFlavor() {
    if (!this.bag.length) this.bag = makeBag();
    this.flavor = GUMMY_FLAVORS[this.bag.pop()];
    return this.flavor;
  },

  // Drop a fresh zone ahead of the gummy, far enough to be reactable at the
  // current spin speed but never so far it stalls the run.
  placeZone() {
    const lead = clamp(this.spin * 0.46, 1.05, 2.55) + rand(0, 0.75);
    this.zoneC = this.ang + this.dir * (lead + this.zoneW / 2);
    this.wasInside = false;
  },

  start(modeKey) {
    this.mode = MODES[modeKey] || MODES.casual;
    this.state = "live";
    this.ang = -Math.PI / 2;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.spin = this.mode.spin;
    this.zoneW = this.mode.zone;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.locks = 0; this.perfects = 0;
    this.runTaps = 0;
    this.parts.length = 0; this.trail.length = 0;
    this.shake = 0; this.flash = 0; this.pulse = 0; this.ringPop = 0;
    this.bag = makeBag();
    this.nextFlavor();
    this.placeZone();
    this.emit("score", this);
  },

  play(a, rate = 1) {
    if (this.muted) return;
    try { a.currentTime = 0; a.playbackRate = rate; a.play(); } catch (e) { /* autoplay gate */ }
  },

  // A soft bell for perfects — sine partials through a lowpass, quiet and
  // short so it reads as a reward rather than an alert. Synthesized rather
  // than sampled so the pitch can follow the streak.
  chime() {
    if (this.muted) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.actx ||= new Ctx();
      const ctx = this.actx;
      if (ctx.state === "suspended") ctx.resume();

      // Climb a pentatonic ladder with the streak, then hold — a bell that
      // keeps rising forever gets shrill and distracting.
      const PENT = [0, 2, 4, 7, 9];
      const step = PENT[Math.min(Math.max(this.combo - 1, 0), PENT.length - 1)];
      const root = 880 * Math.pow(2, step / 12);   // A5 upward

      const now = ctx.currentTime;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 4200;

      const out = ctx.createGain();
      out.gain.value = 1;
      lp.connect(out).connect(ctx.destination);

      // Fundamental plus a fifth and an octave, each quieter than the last.
      [[1, 0.09, 0.9], [1.5, 0.035, 0.7], [2, 0.028, 0.55]].forEach(([mult, peak, dur]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = root * mult;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(peak, now + 0.008);   // soft attack
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);   // bell-like tail
        osc.connect(g).connect(lp);
        osc.start(now);
        osc.stop(now + dur + 0.05);
      });
    } catch (e) { /* no audio available — the run carries on regardless */ }
  },

  // The single verb: lock the gummy where it stands.
  tap() {
    if (this.state !== "live") return;
    this.runTaps++;
    this.emit("tap");
    const d = Math.abs(angDelta(this.ang, this.zoneC));
    const half = this.zoneW / 2;
    if (d > half) { this.miss("early"); return; }

    const perfect = d <= half * SCORE.perfectBand;

    // The combo is a streak of perfects — a catch anywhere else in the zone
    // keeps the run alive but drops the multiplier back to 1.
    if (perfect) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.perfects++;
    } else {
      this.combo = 0;
    }

    const mult = Math.max(1, Math.min(this.combo, SCORE.comboCap));
    const gained = SCORE.base * mult + (perfect ? SCORE.perfectBonus * mult : 0);

    this.score += gained;
    this.locks++;

    const captured = this.flavor;
    this.burst(perfect ? 34 : 16, captured.color, perfect);
    if (perfect) this.chime(); else this.play(this.sfxLock);
    this.pulse = 1; this.ringPop = 1;
    if (perfect) this.flash = 0.55;

    // Escalate: reverse, quicken, narrow.
    this.dir *= -1;
    this.spin = Math.min(this.spin * this.mode.spinStep, this.mode.spinMax);
    this.zoneW = Math.max(this.zoneW * this.mode.zoneStep, this.mode.zoneMin);
    this.nextFlavor();
    this.placeZone();

    this.emit("lock", { perfect, gained, mult, flavor: captured, combo: this.combo, score: this.score });
    this.emit("score", this);
  },

  miss(reason) {
    if (this.state !== "live") return;
    this.state = "over";
    this.shake = 1;
    this.burst(46, "#ef4b5d", true);
    this.play(this.sfxOver);
    this.emit("over", {
      reason, score: this.score, maxCombo: this.maxCombo, taps: this.runTaps,
      locks: this.locks, perfects: this.perfects, mode: this.mode.key,
    });
  },

  burst(n, color, big) {
    const x = this.cx + Math.cos(this.ang) * this.R;
    const y = this.cy + Math.sin(this.ang) * this.R;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = rand(big ? 90 : 55, big ? 320 : 190);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: rand(0.5, 1.15), age: 0, rot: Math.random() * TAU, vr: rand(-9, 9),
        w: rand(3.5, 8), h: rand(6, 13),
        c: Math.random() < 0.55 ? color : DROPS_BRAND[(Math.random() * DROPS_BRAND.length) | 0],
      });
    }
  },

  frame(now) {
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.timerId);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.t += dt;

    if (this.state === "live") {
      this.ang += this.dir * this.spin * dt;
      this.trail.push({ a: this.ang, age: 0 });

      // Pass-through miss: once the gummy has been inside the zone and leaves
      // it un-locked, the run is over.
      const inside = Math.abs(angDelta(this.ang, this.zoneC)) <= this.zoneW / 2;
      if (inside) this.wasInside = true;
      else if (this.wasInside) this.miss("late");
    }

    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age += dt;
      if (this.trail[i].age > 0.32) this.trail.splice(i, 1);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 620 * dt;
      p.vx *= 0.99; p.rot += p.vr * dt;
    }
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 2.0);
    this.pulse = Math.max(0, this.pulse - dt * 2.6);
    this.ringPop = Math.max(0, this.ringPop - dt * 3.2);

    this.draw();
    this.schedule();
  },

  draw() {
    const c = this.ctx, w = this.w, h = this.h;
    // The sky darkens as the loop tightens — one full cycle every 22 locks.
    const sky = skyAt(this.state === "idle" ? 0.20 : (this.locks % 22) / 22);

    c.save();
    if (this.shake > 0) {
      const s = this.shake * 13;
      c.translate(rand(-s, s), rand(-s, s));
    }

    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bot);
    c.fillStyle = g;
    c.fillRect(-40, -40, w + 80, h + 80);

    if (sky.stars > 0.02) {
      for (const st of this.stars) {
        const tw = 0.55 + 0.45 * Math.sin(this.t * 2.2 + st.tw);
        c.globalAlpha = sky.stars * tw;
        c.fillStyle = "#fff8e6";
        c.beginPath(); c.arc(st.x * w, st.y * h, st.r, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }

    // Ground haze so the ring sits in a world rather than on a flat wash.
    const haze = c.createLinearGradient(0, h * 0.62, 0, h);
    haze.addColorStop(0, "rgba(26,16,48,0)");
    haze.addColorStop(1, `rgba(26,16,48,${0.16 + sky.stars * 0.26})`);
    c.fillStyle = haze; c.fillRect(0, h * 0.6, w, h * 0.4);

    const R = this.R * (1 + this.ringPop * 0.02);
    const lw = Math.max(13, R * 0.115);

    // Matte track
    c.lineCap = "butt";
    c.strokeStyle = "rgba(26,16,48,0.30)";
    c.lineWidth = lw + 8;
    c.beginPath(); c.arc(this.cx, this.cy, R, 0, TAU); c.stroke();
    c.strokeStyle = PAL.ring;
    c.lineWidth = lw;
    c.beginPath(); c.arc(this.cx, this.cy, R, 0, TAU); c.stroke();

    // Dashed guide rim
    c.save();
    c.setLineDash([4, 9]);
    c.strokeStyle = "rgba(245,231,200,0.28)";
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(this.cx, this.cy, R + lw * 0.95, 0, TAU); c.stroke();
    c.restore();

    if (this.state !== "idle") {
      const half = this.zoneW / 2;
      const col = this.flavor.color;

      // Sugar zone — glowing, flavored, with a brighter perfect core.
      c.save();
      c.lineCap = "round";
      c.shadowColor = col; c.shadowBlur = 26 + this.pulse * 26;
      c.strokeStyle = col; c.lineWidth = lw * 0.9;
      c.beginPath(); c.arc(this.cx, this.cy, R, this.zoneC - half, this.zoneC + half); c.stroke();
      const pHalf = half * SCORE.perfectBand;
      c.shadowBlur = 34;
      c.strokeStyle = "rgba(255,255,255,0.92)";
      c.lineWidth = lw * 0.34;
      c.beginPath(); c.arc(this.cx, this.cy, R, this.zoneC - pHalf, this.zoneC + pHalf); c.stroke();
      c.restore();

      // Gummy trail
      for (const tr of this.trail) {
        const a = 1 - tr.age / 0.32;
        c.globalAlpha = a * 0.30;
        c.fillStyle = PAL.cream;
        const x = this.cx + Math.cos(tr.a) * R, y = this.cy + Math.sin(tr.a) * R;
        c.beginPath(); c.arc(x, y, lw * 0.30 * a, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;

      // The gummy itself — a glossy capsule riding the track tangentially.
      const gx = this.cx + Math.cos(this.ang) * R;
      const gy = this.cy + Math.sin(this.ang) * R;
      const gr = lw * 0.52 * (1 + this.pulse * 0.28);
      c.save();
      c.translate(gx, gy);
      c.rotate(this.ang + Math.PI / 2);
      c.shadowColor = this.flavor.color; c.shadowBlur = 18;
      c.fillStyle = this.flavor.color;
      const gw = gr * 1.05, gh = gr * 1.55, rr = gr * 0.62;
      c.beginPath();
      if (c.roundRect) c.roundRect(-gw, -gh, gw * 2, gh * 2, rr);
      else c.arc(0, 0, gr, 0, TAU);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.beginPath(); c.ellipse(-gw * 0.32, -gh * 0.42, gw * 0.3, gh * 0.26, 0, 0, TAU); c.fill();
      c.restore();

      // Combo readout in the hub
      if (this.combo > 1) {
        c.save();
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillStyle = "rgba(245,231,200,0.92)";
        c.font = `700 ${Math.round(R * 0.42)}px Formiga, "Baloo 2", system-ui, sans-serif`;
        c.shadowColor = "rgba(26,16,48,0.55)"; c.shadowBlur = 14;
        c.fillText(`x${this.combo}`, this.cx, this.cy);
        c.restore();
      }
    } else {
      // Attract mode: a slow demo gummy drifting the track.
      const a = this.t * 0.7;
      const x = this.cx + Math.cos(a) * R, y = this.cy + Math.sin(a) * R;
      c.save();
      c.lineCap = "round";
      c.shadowColor = PAL.crystal; c.shadowBlur = 22;
      c.strokeStyle = PAL.crystal; c.lineWidth = lw * 0.9;
      c.beginPath(); c.arc(this.cx, this.cy, R, a + 1.5, a + 2.5); c.stroke();
      c.shadowBlur = 14; c.fillStyle = PAL.cream;
      c.beginPath(); c.arc(x, y, lw * 0.5, 0, TAU); c.fill();
      c.restore();
    }

    // Confetti
    for (const p of this.parts) {
      const a = 1 - p.age / p.life;
      c.save();
      c.globalAlpha = a;
      c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = p.c;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    c.globalAlpha = 1;

    if (this.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.30})`;
      c.fillRect(0, 0, w, h);
    }
    c.restore();
  },
};
