// Visual tokens for Drops Loop — inherited wholesale from Drops Adventure so
// the two games read as one product family. The 3D formula is retained here as
// documentation; the 2D renderer derives its palette from the same constants.

export const FORMULA =
  "Bright candy-pop arcade loop, flat vector shapes with soft glow. Chunky rounded " +
  "silhouettes, no outlines. Sky that breathes through a full day-night cycle behind " +
  "a matte track ring; gummies rendered as glossy rounded capsules in the Drops flavor " +
  "colors; the live target zone carries an acid-cyan glow. Cozy, playful, high " +
  "readability: glowing targets contrast strongly against the matte ring.";

export const PAL = {
  ring: "#3c2a58",        // matte track
  crystal: "#2ee8d4",     // acid-cyan signal hue (attract-mode target)
  cream: "#f5e7c8",       // warm coral-cream (gummy trail, hub type)
};

// Day/night keyframes — same 8 beats as the island's 120 s cycle, retimed to a
// run's difficulty ramp so the sky darkens as the loop speeds up.
export const SKY_KEYS = [
  { p: 0.00, top: "#f7d9a8", bot: "#f2b28c", stars: 0.0 }, // dawn
  { p: 0.10, top: "#aadfee", bot: "#d9f0e4", stars: 0.0 }, // morning
  { p: 0.34, top: "#a8dcf0", bot: "#cfeafc", stars: 0.0 }, // day
  { p: 0.50, top: "#f2b28c", bot: "#e8788c", stars: 0.05 }, // dusk
  { p: 0.64, top: "#2a3358", bot: "#5b3a6e", stars: 0.9 }, // nightfall
  { p: 0.84, top: "#1c2440", bot: "#2e1f45", stars: 1.0 }, // deep night
  { p: 0.95, top: "#51467a", bot: "#8a5a86", stars: 0.4 }, // pre-dawn
  { p: 1.00, top: "#f7d9a8", bot: "#f2b28c", stars: 0.0 },
];

// The 11 Drops flavors — names, effects, and pack colors from the product line.
// Every lock captures the next flavor in a shuffled bag.
export const GUMMY_FLAVORS = [
  { name: "Evergreen",     effect: "Hybrid",       color: "#8cc63e" }, // lime
  { name: "Formula One",   effect: "Sativa",       color: "#f7c51e" }, // lemon
  { name: "Beethoven",     effect: "Sativa",       color: "#f7941d" }, // orange
  { name: "River Float",   effect: "Indica",       color: "#f2606e" }, // watermelon
  { name: "100 Sheep",     effect: "Indica",       color: "#e8125c" }, // cherry
  { name: "Looking Glass", effect: "Super Sativa", color: "#a3282e" }, // cranberry
  { name: "Bicycle Day",   effect: "Hybrid",       color: "#d9256f" }, // raspberry
  { name: "Rodeo Queen",   effect: "Super Sativa", color: "#f25c12" }, // strawberry
  { name: "Lullaby",       effect: "Micro Dose",   color: "#2f6fb0" }, // blueberry
  { name: "Nightshade",    effect: "Super Indica", color: "#2b3480" }, // dark berry
  { name: "Crickets",      effect: "Super Indica", color: "#7b2d8b" }, // blackberry
];

// Drops brand logo colors (5-color logo) — UI gradients & confetti.
export const DROPS_BRAND = ["#8dc63f", "#fbb040", "#f7941d", "#ef4b5d", "#c2185b"];

// Difficulty tuning. `spin` is rad/s at the start of a run; `zone` is the target
// arc width in radians. Each lock speeds the loop and narrows the zone until the
// floor/ceiling constants bite.
export const MODES = {
  casual: {
    key: "casual", label: "In Da Couch", emoji: "🌙", sub: "Slower & sweeter",
    spin: 1.75, spinStep: 1.035, spinMax: 6.0,
    zone: 1.05, zoneStep: 0.968, zoneMin: 0.30,
    grad: "linear-gradient(160deg,#3e6b4f,#8dc63f 60%,#fbb040)",
  },
  expert: {
    key: "expert", label: "Full Send", emoji: "⚡", sub: "Fast & Sunny",
    spin: 2.65, spinStep: 1.048, spinMax: 8.5,
    zone: 0.78, zoneStep: 0.958, zoneMin: 0.21,
    grad: "linear-gradient(160deg,#ff4f9e,#ef4b5d 55%,#9452ff)",
  },
};

// Scoring
export const SCORE = {
  base: 10,          // per lock, before combo
  perfectBonus: 15,  // landing in the sweet centre of the zone
  perfectBand: 0.24, // fraction of the zone half-width that counts as perfect
  comboCap: 10,      // multiplier ceiling
};
