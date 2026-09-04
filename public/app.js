// Wiring: screens, HUD, and the meta layer around js/loop.js.

import { Loop } from "./js/loop.js";
import { Meta } from "./js/meta.js";
import { STR } from "./strings.js";
import { MODES } from "./js/style.js";

const $ = (id) => document.getElementById(id);
const screens = { home: $("home"), tut: $("tut"), results: $("results"), board: $("board") };
let screen = "home";
let lastRun = null;
let posted = false;
let tutIndex = 0;
let tutMode = "onboard";   // "onboard" runs into a game; "review" returns home

function show(name) {
  screen = name;
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  $("hud").hidden = name !== "play";
}

/* ---------------- strings ---------------- */
$("titleText").textContent = STR.title;
$("tagText").textContent = STR.tagline;
$("statsTitle").textContent = STR.statsTitle;
$("kBest").textContent = STR.statBest;
$("kTaps").textContent = STR.statTaps;
$("kPerfects").textContent = STR.statPerfects;
$("modeLabel").textContent = STR.chooseMode;
$("howBtn").textContent = "❓ " + STR.howToPlay;
$("kScore").textContent = STR.score;
$("kCombo").textContent = STR.combo;
$("kLocks").textContent = STR.locks;
$("kPerf").textContent = STR.perfects;
$("runOverText").textContent = STR.runOver;
$("newBestText").textContent = STR.newBest;
$("againBtn").textContent = STR.again;
$("backBtn").textContent = STR.home.toUpperCase();
$("boardTitle").textContent = STR.lbTitle;
$("boardClose").textContent = STR.close;
$("tutSkip").textContent = STR.skip;
$("tapBar").firstChild.textContent = STR.tapToLock;
$("tapBar").querySelector(".hint").textContent = STR.tapHint;

/* ---------------- home ---------------- */
function paintHome() {
  const d = Meta.data;
  $("statBest").textContent = Meta.bestScore();
  $("statTaps").textContent = d.lastTaps;
  $("statPerfects").textContent = d.bestPerfects;

  for (const el of document.querySelectorAll(".mode")) {
    el.classList.toggle("on", el.dataset.mode === d.mode);
  }
  $("playBtn").style.background = MODES[d.mode].grad;
}

for (const el of document.querySelectorAll(".mode")) {
  el.addEventListener("click", () => { Meta.setMode(el.dataset.mode); paintHome(); });
}

/* ---------------- tutorial ---------------- */
function paintTut() {
  const host = $("tutDots");
  if (host.children.length !== STR.tutorial.length) {
    host.innerHTML = STR.tutorial.map(() => "<i></i>").join("");
  }
  const t = STR.tutorial[tutIndex];
  $("tutStep").textContent = `${tutIndex + 1} / ${STR.tutorial.length}`;
  $("tutTitle").textContent = t.title;
  $("tutBody").textContent = t.body;
  const last = tutIndex === STR.tutorial.length - 1;
  $("tutNext").textContent = last ? (tutMode === "review" ? STR.gotIt : STR.play) : STR.next;
  $("tutSkip").hidden = tutMode === "review";
  const dots = $("tutDots").children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i === tutIndex);
}
$("tutNext").addEventListener("click", () => {
  if (tutIndex < STR.tutorial.length - 1) { tutIndex++; paintTut(); }
  else if (tutMode === "review") { paintHome(); show("home"); }
  else { Meta.markTutorial(); beginRun(); }
});
$("tutSkip").addEventListener("click", () => { Meta.markTutorial(); beginRun(); });

function openTutorial(mode) {
  tutMode = mode; tutIndex = 0; paintTut(); show("tut");
}
$("howBtn").addEventListener("click", () => openTutorial("review"));

/* ---------------- run lifecycle ---------------- */
function beginRun() {
  posted = false;
  show("play");
  $("scoreVal").textContent = "0";
  $("comboVal").textContent = "x0";
  $("hudBest").textContent = `Best ${Meta.bestScore()}`;
  $("tapBar").style.display = "";
  Loop.start(Meta.data.mode);
}

$("playBtn").addEventListener("click", () => {
  if (!Meta.data.seenTutorial) openTutorial("onboard");
  else beginRun();
});
$("againBtn").addEventListener("click", beginRun);
$("backBtn").addEventListener("click", () => { paintHome(); show("home"); });
$("homeBtn").addEventListener("click", () => { Loop.state = "idle"; paintHome(); show("home"); });
$("boardBtn").addEventListener("click", () => { paintBoard(); show("board"); });
$("boardClose").addEventListener("click", () => { paintHome(); show("home"); });

$("muteBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  Loop.muted = !Loop.muted;
  Meta.setMuted(Loop.muted);
  $("muteBtn").textContent = Loop.muted ? "🔇" : "🔊";
});

/* ---------------- leaderboard ---------------- */
async function fetchBoard() {
  try {
    const r = await fetch("/api/scores", { cache: "no-store" });
    if (!r.ok) throw new Error("no api");
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) return rows;
  } catch (e) { /* local fallback below */ }
  return Meta.data.board;
}

async function paintBoard(highlight) {
  const rows = await fetchBoard();
  const host = $("boardRows");
  host.innerHTML = "";
  if (!rows.length) {
    const p = document.createElement("div");
    p.className = "empty"; p.textContent = STR.lbEmpty;
    host.appendChild(p);
    return;
  }
  rows.forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "row" + (highlight && r.n === highlight.n && r.s === highlight.s ? " hl" : "");
    el.innerHTML = `<span>${i + 1}</span><b>${r.n}</b>` +
      `<span class="m">${(MODES[r.m] || MODES.casual).label}</span><span>${r.s}</span>`;
    host.appendChild(el);
  });
}

$("postBtn").addEventListener("click", async () => {
  if (posted || !lastRun) return;
  posted = true;
  const name = ($("initials").value || "YOU").slice(0, 3).toUpperCase();
  const row = { n: name, s: lastRun.score, m: lastRun.mode };
  Meta.submit(name, lastRun);
  try {
    await fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row),
    });
  } catch (e) { /* offline: the local board already has it */ }
  await paintBoard(row);
  show("board");
});

/* ---------------- loop events ---------------- */
Loop.on("score", (s) => {
  $("scoreVal").textContent = s.score;
  $("comboVal").textContent = "x" + s.combo;
});

Loop.on("lock", (info) => {
  $("tapBar").style.display = "none";
  const t = $("toast");
  $("toastName").textContent = info.perfect ? STR.perfect : info.flavor.name;
  $("toastName").style.color = info.perfect ? "#fff45e" : info.flavor.color;
  $("toastFx").textContent = info.perfect ? info.flavor.name : info.flavor.effect;
  $("toastPts").textContent = `+${info.gained}${info.mult > 1 ? `  ×${info.mult}` : ""}`;
  t.classList.remove("pop");
  void t.offsetWidth; // restart the animation
  t.classList.add("pop");
});

Loop.on("over", (run) => {
  lastRun = run;
  const res = Meta.record(run);
  $("finalScore").textContent = run.score;
  $("tLocks").textContent = run.taps;
  $("tPerf").textContent = run.perfects;
  $("newBestText").hidden = !res.isBest;
  $("initials").value = "";
  $("postBtn").disabled = false;
  setTimeout(() => show("results"), 750); // let the confetti land first
});

/* ---------------- input ---------------- */
function onTap(e) {
  if (screen !== "play") return;
  if (e.target.closest(".iconBtn")) return;
  e.preventDefault();
  Loop.tap();
}
addEventListener("pointerdown", onTap, { passive: false });
addEventListener("keydown", (e) => {
  // While typing initials, game shortcuts must stay out of the way: Enter used
  // to restart the run (throwing the score away before it was ever posted) and
  // typing an "M" toggled mute. In a text field, Enter submits the score.
  if (e.target.closest("input, textarea")) {
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      $("postBtn").click();
    }
    return;
  }
  if (e.code === "Space" || e.code === "Enter") {
    if (screen === "play") { e.preventDefault(); Loop.tap(); }
    else if (screen === "results") { e.preventDefault(); beginRun(); }
  }
  if (e.key === "m" || e.key === "M") $("muteBtn").click();
});

/* ---------------- boot ---------------- */
Loop.init($("stage"));
Loop.muted = Meta.data.muted;
$("muteBtn").textContent = Loop.muted ? "🔇" : "🔊";
paintHome();
show("home");

/* ---------------- QA harness ----------------
   Mirrors Drops Adventure's debug params.
     ?smoke        autoplay bot — locks near the centre of every zone
     ?smoke&sloppy bot aims off-centre, so misses (and the run-over path) fire
     ?mode=expert  pick the pace up front
   Results land in window.__SMOKE and the document title.               */
const qs = new URLSearchParams(location.search);
if (qs.has("dev") || qs.has("smoke")) window.__loop = Loop;

if (qs.has("mode")) { Meta.setMode(qs.get("mode") === "expert" ? "expert" : "casual"); paintHome(); }

if (qs.has("smoke")) {
  const sloppy = qs.has("sloppy");
  Meta.markTutorial();
  window.__SMOKE = { started: false, locks: 0, perfects: 0, score: 0, over: false };
  Loop.on("lock", (i) => {
    window.__SMOKE.locks++;
    if (i.perfect) window.__SMOKE.perfects++;
    window.__SMOKE.score = i.score;
  });
  Loop.on("over", (r) => {
    Object.assign(window.__SMOKE, { over: true, score: r.score, maxCombo: r.maxCombo, reason: r.reason });
    document.title = `SMOKE score=${r.score} locks=${r.locks} perfect=${r.perfects} reason=${r.reason}`;
  });
  setTimeout(() => { beginRun(); window.__SMOKE.started = true; }, 300);
  // The bot watches the same signed offset the player eyeballs.
  setInterval(() => {
    if (Loop.state !== "live") return;
    let d = (Loop.ang - Loop.zoneC) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d <= -Math.PI) d += Math.PI * 2;
    const aim = sloppy ? Loop.zoneW * 0.62 : 0;   // sloppy aims outside the zone
    if (Math.abs(d - Loop.dir * aim) < Math.max(0.02, Loop.spin * 0.006)) Loop.tap();
  }, 4);
}
