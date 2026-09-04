// Between-run persistence: best score, the last run's taps, the perfects from
// your best run, and a local Loop Legends board. All localStorage — the
// Cloudflare KV board in functions/api/scores.js takes over when deployed.

const KEY = "dropsloop.v1";
const DEFAULTS = {
  best: { casual: 0, expert: 0 },
  lastTaps: 0,         // taps in the most recent completed run, hit or miss
  bestPerfects: 0,     // perfects landed during the best-scoring run
  board: [],           // [{n, s, m, t}]
  seenTutorial: false,
  mode: "casual",
  muted: false,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...raw, best: { ...DEFAULTS.best, ...(raw.best || {}) } };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export const Meta = {
  data: load(),

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
  },

  // Best across both paces — the headline number shouldn't move when you
  // switch between In Da Couch and Full Send.
  bestScore() {
    return Math.max(this.data.best.casual || 0, this.data.best.expert || 0);
  },

  // Fold a finished run into the profile. Returns what changed, for the UI.
  // A run abandoned with the home button never lands here, so it doesn't count.
  record(run) {
    const d = this.data;
    const prevBest = this.bestScore();
    const isBest = run.score > prevBest;
    if (isBest) d.bestPerfects = run.perfects;
    if (run.score > (d.best[run.mode] || 0)) d.best[run.mode] = run.score;
    d.lastTaps = run.taps;
    this.save();
    return { isBest, prevBest };
  },

  submit(name, run) {
    const row = { n: (name || "YOU").slice(0, 3).toUpperCase(), s: run.score, m: run.mode, t: Date.now() };
    this.data.board = [...this.data.board, row].sort((a, b) => b.s - a.s).slice(0, 8);
    this.save();
    return this.data.board;
  },

  setMode(m) { this.data.mode = m; this.save(); },
  setMuted(v) { this.data.muted = v; this.save(); },
  markTutorial() { this.data.seenTutorial = true; this.save(); },
};
