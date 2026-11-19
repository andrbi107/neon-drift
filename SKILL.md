---
name: neon-drive
description: Neon Drift — a 3-lane endless synthwave dodging racer built as an installable, offline-first PWA using only vanilla HTML5 canvas, CSS and JS.
---

# Neon Drift

## What this skill gives the model

After reading this skill, the model understands:

- the genre and core loop of Neon Drift (3-lane endless neon dodging racer)
- the exact mechanics (player, obstacles, energy cells, scoring, boost, difficulty ramp)
- the controls (touch + keyboard + pointer)
- the PWA structure required (manifest, service worker, icon)
- the file layout and how to deploy on GitHub Pages
- the customization hooks (colors, speeds, spawn rates, ramp intervals)

## Game design

Neon Drift is a portrait-oriented endless dodging racer rendered entirely on an HTML5
`<canvas>`. The aesthetic is pure 1980s synthwave / outrun: a dark purple sky that melts
into a magenta-and-orange horizon, a setting sun sliced into horizontal slits, distant
neon mountains, and a perspective grid road that scrolls toward the camera with converging
lane lines. Every glowing element is drawn with canvas primitives and `shadowBlur` — no
images, no sprites, no external assets.

The player is a cyan glowing car triangle fixed near the bottom center of the screen,
occupying one of three lanes. Obstacles (magenta/red neon blocks and rival cars) spawn at
the horizon and grow as they rush toward the camera; the player switches lanes to dodge
them. Yellow diamond-shaped "energy cells" appear in the lanes and grant bonus points when
collected. Forward speed ramps up gradually over time (+10% every 15 seconds), the spawn
rate accelerates, and the world steadily becomes more hostile.

The objective is to survive as long as possible and bank distance. Score equals distance
traveled (1 point per ~10px of road scrolled), and each energy cell adds +50. The best
score persists across sessions in `localStorage` under the key `neonDrift.best`. One hit
ends the run — there are no lives, no shields, no continues. An optional boost (Space or
on-screen BOOST button) temporarily raises speed and score gain at the cost of a
recharging fuel meter.

The art direction favors a tight neon palette: cyan `#00f3ff` for the player and grid,
magenta `#ff00ea` and red `#ff2a6d` for obstacles, yellow `#ffe600` for energy cells,
over a deep purple-to-black sky. Scanlines, glow trails on the car, particle bursts on
pickup and crash, and a parallax horizon give the scene depth and motion. The whole thing
runs at 60fps with `requestAnimationFrame` and delta-time stepping.

## Mechanics in detail

- **Lanes.** The road is a perspective trapezoid: wide at the bottom, narrow at a
  vanishing point near 42% of canvas height. Three lanes are evenly spaced. The player
  occupies exactly one lane at a time; lane switches animate smoothly via a tween
  (fractional lane position) so the car glides rather than teleports.
- **Projection.** Every world object has a depth `z` in `[0, ~1.2]` where `0` is the
  horizon and `1` is the player's plane. Screen Y is `horizonY + (H - horizonY) * z`.
  Lane X at depth `z` interpolates the lane center between the narrow top and wide
  bottom. Object scale interpolates from ~0.1 at the horizon to ~1.0 at the player.
- **Scrolling grid.** Horizontal grid lines are placed at `z = (i + gridOffset) / N` and
  reprojected each frame; `gridOffset` advances with current speed, producing the
  converging-line scroll. Two vertical lane-divider lines run from the vanishing point to
  the bottom corners.
- **Spawning.** A spawn timer fires every `spawnInterval` seconds (starts ~1.1s, shrinks
  as difficulty rises). Each spawn picks a random lane and a random type (obstacle block,
  rival car, or energy cell with a smaller probability). Consecutive obstacles are
  prevented from fully walling off all three lanes so a dodge always exists.
- **Movement.** Obstacles and coins advance by `baseSpeed * speedMultiplier * dt` in
  z-units per second. `baseSpeed` starts at 0.40 and is multiplied by 1.10 every 15
  seconds of elapsed play. `speedMultiplier` is 1.0 normally and ~1.8 while boosting.
- **Scoring.** Score accrues as `distance += currentSpeed * pxPerZ * dt; score =
  floor(distance / 10)`. Each energy cell collected adds `+50`. Best score is saved to
  `localStorage` key `neonDrift.best` on game over if beaten.
- **Collision.** When an obstacle's `z` enters the player plane window `[0.92, 1.08]`,
  its projected screen rectangle is tested against the player's projected rectangle. If
  they overlap, the run ends with a particle explosion. Energy cells in the same window
  are collected if they overlap the player.
- **Boost.** Holding boost drains `boostFuel` (1.0 → 0 over ~2.5s of held use) and raises
  `speedMultiplier` to ~1.8 and score gain by the same factor. When fuel hits 0, boost
  cuts out and a cooldown of ~2.0s must elapse before fuel begins recharging. Fuel also
  slowly recharges when not boosting.
- **Difficulty ramp.** Besides the 15s speed multiplier, `spawnInterval` shrinks from
  1.1s toward a floor of ~0.45s as elapsed time grows, and the chance of two obstacles
  spawning in adjacent lanes rises.
- **States.** `start` → `playing` → (`paused`) → `over` → `start` or `playing`. The loop
  uses delta time so the simulation is frame-rate independent.

## Controls

- **Touch:** tap/swipe left or right to switch lanes; on-screen ◀ ▶ buttons (always
  visible on touch); on-screen BOOST button hold; on-screen Pause button.
- **Keyboard:** Left/Right arrows or A/D to switch lanes; Space to hold boost; P or Esc
  to pause/resume; Enter to start or retry from the start/game-over screens.
- **Mouse / pointer:** the on-screen buttons and Pause button are pointer-driven; clicking
  the canvas left/right half also switches lanes.

## File layout

- `index.html` — entry point, viewport meta, links `styles.css` + `main.js`, registers
  `sw.js`, hosts the canvas, HUD and all overlay screens.
- `styles.css` — responsive neon layout, clamp-based typography, safe-area insets,
  on-screen control buttons, screen overlays; no fixed root width.
- `main.js` — the entire game: state machine, perspective renderer, spawn/collision/
  scoring/boost/difficulty, input handling for touch+keyboard+pointer, localStorage best.
- `manifest.json` — PWA manifest, `start_url: "./"`, `scope: "./"`,
  `orientation: "portrait"`, icon entry pointing at `icon.svg`.
- `sw.js` — service worker that precaches the full shell (`./`, `index.html`,
  `styles.css`, `main.js`, `manifest.json`, `icon.svg`) and serves them offline.
- `icon.svg` — neon car triangle on a dark grid, used as the app icon.

## How to run / deploy

1. Open `index.html` directly in a modern browser (Chrome/Edge/Safari/Firefox), or
2. Push the `neon-drive/` folder to a GitHub repo and enable Pages — all paths are
   relative so it works from the repo root or any subfolder.

## PWA install

The manifest + service worker make the game installable on Android, iOS and desktop.
After the first load the service worker precaches the shell, so the game runs fully
offline with no network access.

## Customization hooks

All tunables live near the top of `main.js` as named constants:

- `LANES` (3) — number of lanes.
- `SPEED_RAMP_INTERVAL_S` (15) and `SPEED_RAMP_FACTOR` (1.10) — difficulty cadence.
- `BASE_SPEED` (0.40), `BOOST_MULT` (1.8) — z-units per second baseline and boost.
- `SPAWN_INTERVAL_START_S` (1.1), `SPAWN_INTERVAL_MIN_S` (0.45) — spawn cadence range.
- `COIN_VALUE` (50), `SCORE_PX_PER_POINT` (10) — scoring constants.
- `BOOST_DURATION_S` (2.5), `BOOST_COOLDOWN_S` (2.0) — boost economy.
- Color constants in the `COLORS` object (`sky`, `sun`, `player`, `obstacle`,
  `rival`, `coin`, `grid`) — retheme the whole game in one place.

To retheme, edit the `COLORS` object. To rebalance difficulty, tweak the speed and spawn
constants above.
