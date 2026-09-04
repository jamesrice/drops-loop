# Loop De Drop

**True Flower Gummies. One Loop. Tap and Vibe.**

A one-thumb timing arcade game: a gummy sweeps a circular track, a glowing
flower zone opens ahead of it, and you tap to lock the gummy inside the zone.
Every catch flips the loop's direction, speeds it up and narrows the zone.
One miss ends the run.

Gameplay is modelled on [rushloop.io](https://rushloop.io); everything you see
and hear is **Drops Adventure's** visual system — logo, Formiga + Work Sans,
the 11 Drops flavor colors, the day/night sky keyframes, and the same warm,
snack-forward voice. No code, art or copy from RushLoop was used.

**Stack:** static site, no build step, plain ES modules. One 2D canvas for the
game, DOM for all chrome, served by a Cloudflare **Worker** with an assets
binding (not Pages) that also hosts the leaderboard API.

```
public/    the entire served site — nothing outside it is public
worker/    index.js routes /api/*, everything else falls through to assets
scripts/   local dev server (never deployed)
```

## Play

```bash
npm run dev            # http://localhost:8798
```

- **Tap / click / Space** — lock the gummy
- **M** — mute · **⌂** — bail out to the home screen
- **How to Play** on the home screen replays the four-slide tutorial any time
- Two paces: **In Da Couch** (1.75 rad/s, wide zone) and **Full Send**
  (2.65 rad/s, tight zone)
- The sky runs a full day/night cycle every 22 catches

### Scoring

The number in the middle of the loop is your **combo** — consecutive
**perfects**. It doubles as your score multiplier, capped at **×10** (the combo
itself keeps climbing past that; only the multiplier stops).

| | |
|---|---|
| Catch anywhere in the zone | `10 × multiplier`, and the combo resets to 0 |
| PERFECT (bright core of the zone) | `10 × multiplier` plus `15 × multiplier`, and the combo goes up 1 |

So a first perfect is worth 25, and every perfect from the tenth consecutive one
onward is worth 250. A catch that lands in the zone but off-centre keeps the run
alive and scores 10, but drops you back to ×1 — only precision compounds.

Each catch names the flavor it caught — all 11 Drops flavors are in the bag
(Evergreen, Formula One, Beethoven, River Float, 100 Sheep, Looking Glass,
Bicycle Day, Rodeo Queen, Lullaby, Nightshade, Crickets), shuffled so none
repeats until the bag empties.

## Meta layer

`js/meta.js` keeps three numbers in localStorage, shown on the home screen:

- **Best score** — across both paces, so it doesn't jump when you switch pace
- **Total taps** — taps in your last completed run, hit or miss
- **Best perfects** — perfects landed during your best-scoring run

A run abandoned with the home button never reaches `record()`, so it doesn't
count toward any of them.

## Live board

`worker/scores.js` backs the board with Workers KV (binding `SCORES`, namespace
`LOOPDEDROP_SCORES`). `GET /api/scores` returns the all-time top 8; `POST` takes
`{n, s, m}` (3-char initials, score, pace).

The client falls back to a localStorage board whenever the API is unreachable,
which includes `npm run dev` — the python dev server is static-only, so
`/api/scores` 404s there. Use `npm run dev:worker` (`wrangler dev`) to exercise
the real API and KV locally.

## Deploy

Pushes to `main` deploy automatically via **Cloudflare Workers Builds** (the
dashboard's git integration). To deploy by hand:

```bash
npm run deploy      # wrangler deploy
```

Unlike Pages, the KV binding in `wrangler.jsonc` is authoritative for Worker
deploys — there's no separate dashboard binding to keep in sync.

## Debug / QA query params

Frame-accurate stepping matters here: the game is pure timing, so the harness
drives it deterministically rather than by wall clock.

- `?dev` — exposes the engine as `window.__loop`
- `?smoke` — autoplay bot that locks near the centre of every zone; results in
  `window.__SMOKE` and the document title
- `?smoke&sloppy` — bot aims *outside* the zone, so the miss / run-over path
  fires
- `?mode=expert` — pick the pace up front

For a headless check that doesn't depend on animation frames at all, step the
loop by hand:

```js
const L = window.__loop; L.start('casual');
let n = performance.now(); L.last = n;
for (let i = 0; i < 20000 && L.state === 'live'; i++) { n += 16; L.last = n - 16; L.frame(n); /* tap here */ }
```

## Notes

- **Audio:** normal catches play `assets/audio/sfx-pickup.mp3`; a PERFECT plays
  a WebAudio bell synthesized in `Loop.chime()` — sine partials (root, fifth,
  octave) through a lowpass, ~0.9 s decay at low gain. Its pitch climbs a
  pentatonic ladder with your combo and then holds, so it stays a reward
  rather than becoming an alert.
- The loop is driven by `requestAnimationFrame` with a `setTimeout` backstop,
  so it keeps running in hosts that starve animation frames (background tabs,
  some embedded webviews) instead of freezing mid-run.
- `js/style.js` holds every color, flavor, sky keyframe and difficulty curve —
  tuning the game is a data change.
- **Fonts:** `Formiga` is a licensed commercial face (TipoType), carried over
  from `drops-adventure`. If those files can't ship in this repo, delete them —
  Baloo 2 stands in automatically via the `@font-face` fallback.
- The project directory is still `drops-loop`; only the product name changed.
