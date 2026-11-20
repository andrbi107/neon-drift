/* =====================================================================
   NEON DRIFT — 3-lane endless synthwave dodging racer
   Vanilla JS, no dependencies. Renders to a single <canvas>.
   ===================================================================== */
(() => {
  'use strict';

  /* ----------------------------- tunables ----------------------------- */
  const LANES = 3;
  const BEST_KEY = 'neonDrift.best';

  const INITIAL_BASE_SPEED = 0.40;     // z-units per second at run start
  const SPEED_RAMP_INTERVAL_S = 15;   // every N seconds multiply base speed
  const SPEED_RAMP_FACTOR = 1.10;     // by this factor
  const BOOST_MULT = 1.8;             // speed multiplier while boosting
  const BOOST_DURATION_S = 2.5;       // seconds a full tank lasts while held
  const BOOST_COOLDOWN_S = 2.0;       // seconds before tank recharges after empty
  const BOOST_RECHARGE_RATE = 0.45;   // tank fraction recharged per second

  const SPAWN_INTERVAL_START_S = 1.10;
  const SPAWN_INTERVAL_MIN_S = 0.45;
  const SPAWN_INTERVAL_DECAY = 0.0045; // per second of elapsed time

  const COIN_VALUE = 50;
  const SCORE_PX_PER_POINT = 10;      // 1 point per ~10px of road scrolled
  const LANE_TWEEN_S = 0.12;          // lane switch animation duration

  const COLLISION_Z_MIN = 0.95;
  const COLLISION_Z_MAX = 1.06;
  const COIN_Z_MIN = 0.88;
  const COIN_Z_MAX = 1.12;
  const LANE_HIT_THRESH = 0.5;        // |fracLane - obstacleLane| < this => overlap

  const COLORS = {
    skyTop: '#1a0033',
    skyMid: '#3a0044',
    skyHorizon: '#ff006e',
    skyLow: '#ff8c00',
    sunA: '#ffe600',
    sunB: '#ff8c00',
    sunC: '#ff2a6d',
    ground: '#06000f',
    grid: '#00f3ff',
    gridDim: 'rgba(0, 243, 255, 0.25)',
    roadEdge: '#ff00ea',
    laneDiv: 'rgba(0, 243, 255, 0.55)',
    player: '#00f3ff',
    playerCore: '#bff7ff',
    obstacle: '#ff2a6d',
    obstacleEdge: '#ff00ea',
    rival: '#ff00ea',
    coin: '#ffe600',
    shield: '#3affa0',
    mountain: '#1a0033',
    mountainEdge: '#7a00cc',
    star: '#ffffff'
  };

  /* ------------------------------ DOM -------------------------------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const elScore = document.getElementById('scoreVal');
  const elBest = document.getElementById('bestVal');
  const elSpeed = document.getElementById('speedVal');
  const elBoostFill = document.getElementById('boostFill');
  const elBoostMeter = document.getElementById('boostMeter');
  const elHud = document.getElementById('hud');
  const elTouch = document.getElementById('touchControls');
  const elPauseBtn = document.getElementById('pauseBtn');

  const elStartScreen = document.getElementById('startScreen');
  const elPauseScreen = document.getElementById('pauseScreen');
  const elOverScreen = document.getElementById('overScreen');
  const elStartBest = document.getElementById('startBest');
  const elFinalScore = document.getElementById('finalScore');
  const elFinalBest = document.getElementById('finalBest');
  const elNewRecord = document.getElementById('newRecord');

  const btnPlay = document.getElementById('playBtn');
  const btnRetry = document.getElementById('retryBtn');
  const btnHome = document.getElementById('homeBtn');
  const btnResume = document.getElementById('resumeBtn');
  const btnQuit = document.getElementById('quitBtn');
  const btnLeft = document.getElementById('leftBtn');
  const btnRight = document.getElementById('rightBtn');
  const btnBoost = document.getElementById('boostBtn');

  /* ----------------------------- state ------------------------------- */
  let W = 0, H = 0, DPR = 1;
  let horizonY = 0, roadCenterX = 0, roadBottomHalf = 0, roadTopHalf = 0;
  let sunRadius = 0;

  let state = 'start';      // start | playing | paused | over
  let rafId = 0;
  let lastTime = 0;

  let score = 0;
  let distance = 0;
  let best = 0;
  let elapsed = 0;
  let baseSpeed = INITIAL_BASE_SPEED;
  let speedMultiplier = 1;
  let spawnTimer = 0;
  let rampTimer = 0;

  let boostHeld = false;
  let boostActive = false;
  let boostFuel = 1;
  let boostCooldown = 0;

  let gridPhase = 0;

  const player = {
    lane: 1,            // integer target lane 0..LANES-1
    fracLane: 1,        // animated fractional lane position
    fromFrac: 1,        // tween start
    tweenT: 1,          // 0..1 tween progress
    y: 0,               // screen y (set in resize)
    width: 0,           // base width in px (set in resize)
    height: 0
  };

  let obstacles = [];
  let coins = [];
  let shieldCount = 0;            // v0.0.2 — shield pickups held (absorb a crash)
  let particles = [];
  let stars = [];
  let mountains = [];

  /* --------------------------- geometry ------------------------------ */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    horizonY = Math.floor(H * 0.42);
    roadCenterX = W / 2;
    roadBottomHalf = Math.min(W * 0.46, 230);
    roadTopHalf = Math.max(6, Math.min(W * 0.035, 16));
    sunRadius = Math.min(W * 0.20, H * 0.13, 110);

    player.y = H - Math.max(96, H * 0.16);
    player.width = Math.max(26, roadBottomHalf * 0.30);
    player.height = Math.max(34, roadBottomHalf * 0.40);

    rebuildStars();
    rebuildMountains();
  }

  function rebuildStars() {
    stars = [];
    const n = 46;
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (horizonY * 0.9),
        s: Math.random() * 1.6 + 0.4,
        a: Math.random() * 0.7 + 0.3,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  function rebuildMountains() {
    mountains = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const cx = (i + 0.5) * (W / count) + (Math.random() - 0.5) * W * 0.1;
      const peak = horizonY - (Math.random() * 0.10 + 0.04) * H;
      const halfW = (W / count) * (0.55 + Math.random() * 0.25);
      mountains.push({ cx, peak, halfW });
    }
    mountains.sort((a, b) => a.peak - b.peak);
  }

  /* ------------------------- projection ------------------------------ */
  function projY(z) { return horizonY + (H - horizonY) * z; }
  function roadHalfAtZ(z) {
    const zc = Math.max(0, z);
    return roadTopHalf + (roadBottomHalf - roadTopHalf) * zc;
  }
  // laneFrac: -1 = lane 0, 0 = lane 1, +1 = lane 2 (for 3 lanes)
  function laneToX(laneFrac, z) {
    return roadCenterX + laneFrac * (2 / LANES) * roadHalfAtZ(z);
  }
  function laneFracFromIndex(i) { return (i - (LANES - 1) / 2); } // 0->-1, 1->0, 2->+1
  function scaleAtZ(z) {
    const zc = Math.max(0, Math.min(1.2, z));
    return roadHalfAtZ(zc) / roadBottomHalf;
  }

  /* --------------------------- storage ------------------------------- */
  function loadBest() {
    const raw = localStorage.getItem(BEST_KEY);
    best = raw ? parseInt(raw, 10) || 0 : 0;
    elBest.textContent = best;
    elStartBest.textContent = best;
  }
  function saveBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      elBest.textContent = best;
      elStartBest.textContent = best;
      return true;
    }
    return false;
  }

  /* ------------------------- state flow ------------------------------ */
  function showScreen(name) {
    elStartScreen.classList.toggle('active', name === 'start');
    elPauseScreen.classList.toggle('active', name === 'paused');
    elOverScreen.classList.toggle('active', name === 'over');
  }

  function setHudVisible(on) {
    elHud.classList.toggle('show', on);
    elBoostMeter.classList.toggle('show', on);
    elTouch.classList.toggle('show', on);
  }

  function startGame() {
    score = 0;
    distance = 0;
    elapsed = 0;
    baseSpeed = INITIAL_BASE_SPEED;
    speedMultiplier = 1;
    spawnTimer = 0.6;
    rampTimer = 0;
    boostHeld = false;
    boostActive = false;
    boostFuel = 1;
    boostCooldown = 0;
    obstacles = [];
    coins = [];
    shieldCount = 0;            // v0.0.2 — reset shield count
    particles = [];
    gridPhase = 0;
    player.lane = 1;
    player.fracLane = 1;
    player.fromFrac = 1;
    player.tweenT = 1;
    elScore.textContent = '0';
    elSpeed.textContent = '1.0x';
    updateBoostMeterUI();
    showScreen(null);
    setHudVisible(true);
    state = 'playing';
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      showScreen('paused');
    } else if (state === 'paused') {
      state = 'playing';
      showScreen(null);
    }
  }

  function gameOver() {
    if (state !== 'playing') return;
    state = 'over';
    burst(playerScreenX(), player.y, COLORS.player, 30, 220);
    burst(playerScreenX(), player.y, COLORS.obstacle, 18, 160);
    const isRecord = saveBest();
    elFinalScore.textContent = score.toLocaleString();
    elFinalBest.textContent = best.toLocaleString();
    elNewRecord.classList.toggle('show', isRecord);
    setHudVisible(false);
    shieldCount = 0;
    if (window.MUX) MUX.over();
    // brief delay so the explosion is visible before the panel
    setTimeout(() => { if (state === 'over') showScreen('over'); }, 520);
  }

  function retry() {
    startGame();
  }

  function goHome() {
    state = 'start';
    obstacles = [];
    coins = [];
    shieldCount = 0;            // v0.0.2 — reset shield count
    particles = [];
    setHudVisible(false);
    showScreen('start');
  }

  /* ----------------------------- input ------------------------------- */
  function moveLane(dir) {
    if (state !== 'playing') return;
    const next = Math.max(0, Math.min(LANES - 1, player.lane + dir));
    if (next === player.lane) return;
    player.fromFrac = player.fracLane;
    player.lane = next;
    player.tweenT = 0;
  }

  function setBoostHeld(on) {
    boostHeld = on;
    btnBoost.classList.toggle('held', on);
  }

  // keyboard
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': moveLane(-1); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': moveLane(1); e.preventDefault(); break;
      case ' ':
        if (state === 'playing') { setBoostHeld(true); e.preventDefault(); }
        else if (state === 'over') { retry(); e.preventDefault(); }
        else if (state === 'start') { startGame(); e.preventDefault(); }
        break;
      case 'p': case 'P': case 'Escape':
        togglePause(); e.preventDefault(); break;
      case 'Enter':
        if (state === 'start') startGame();
        else if (state === 'over') retry();
        break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') setBoostHeld(false);
  });

  // on-screen buttons
  btnLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); moveLane(-1); });
  btnRight.addEventListener('pointerdown', (e) => { e.preventDefault(); moveLane(1); });
  btnBoost.addEventListener('pointerdown', (e) => { e.preventDefault(); setBoostHeld(true); });
  const boostRelease = (e) => { if (e) e.preventDefault(); setBoostHeld(false); };
  btnBoost.addEventListener('pointerup', boostRelease);
  btnBoost.addEventListener('pointerleave', boostRelease);
  btnBoost.addEventListener('pointercancel', boostRelease);

  btnPlay.addEventListener('click', startGame);
  btnRetry.addEventListener('click', retry);
  btnHome.addEventListener('click', goHome);
  btnResume.addEventListener('click', togglePause);
  btnQuit.addEventListener('click', goHome);
  elPauseBtn.addEventListener('click', togglePause);

  // canvas: tap halves (mouse/pointer) + swipe (touch)
  let touchStartX = 0, touchStartY = 0, touchStartT = 0, touchActive = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    if (e.pointerType === 'touch') {
      touchStartX = e.clientX; touchStartY = e.clientY;
      touchStartT = performance.now(); touchActive = true;
    } else {
      // mouse/pen: tap left/right half of canvas to switch lane
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      moveLane(x < rect.width / 2 ? -1 : 1);
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const dx = e.clientX - touchStartX;
    const dy = e.clientY - touchStartY;
    const dt = performance.now() - touchStartT;
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 600) {
      moveLane(dx < 0 ? -1 : 1);
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 300) {
      // treat as tap on canvas half
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      moveLane(x < rect.width / 2 ? -1 : 1);
    }
  });
  canvas.addEventListener('pointercancel', () => { touchActive = false; });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });

  /* ----------------------------- spawn ------------------------------- */
  function currentSpawnInterval() {
    return Math.max(SPAWN_INTERVAL_MIN_S,
      SPAWN_INTERVAL_START_S - elapsed * SPAWN_INTERVAL_DECAY);
  }

  function lanesBlockedNear() {
    // count distinct lanes with an obstacle at z < 0.55
    const set = new Set();
    for (const o of obstacles) if (o.z < 0.55 && o.kind !== 'coin') set.add(o.lane);
    return set;
  }

  function spawnEntity() {
    const r = Math.random();
    const wantObstacle = r < 0.66;
    const wantRival = r >= 0.66 && r < 0.78;

    if (wantObstacle || wantRival) {
      const blocked = lanesBlockedNear();
      let lane;
      if (blocked.size >= LANES - 1) {
        // force the open lane so a dodge always exists
        const open = [];
        for (let i = 0; i < LANES; i++) if (!blocked.has(i)) open.push(i);
        lane = open.length ? open[Math.floor(Math.random() * open.length)] : Math.floor(Math.random() * LANES);
      } else {
        lane = Math.floor(Math.random() * LANES);
        // avoid stacking two obstacles in the same lane back-to-back at similar depth
        let tries = 0;
        while (tries < 3 && obstacles.some(o => o.lane === lane && o.z < 0.35)) {
          lane = Math.floor(Math.random() * LANES); tries++;
        }
      }
      obstacles.push({
        lane,
        z: 0.02,
        kind: wantRival ? 'rival' : 'block',
        rot: 0
      });
    } else {
      // coin (or rare shield pickup — v0.0.2: absorbs one crash)
      const lane = Math.floor(Math.random() * LANES);
      const isShield = Math.random() < 0.10;
      coins.push({ lane, z: 0.02, spin: Math.random() * Math.PI * 2, shield: isShield });
    }
  }

  /* --------------------------- particles ----------------------------- */
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = Math.random() * speed * 0.04 + speed * 0.01;
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 20,
        life: 1,
        decay: Math.random() * 1.4 + 1.0,
        color,
        size: Math.random() * 3 + 1.5
      });
    }
  }

  function exhaustParticle() {
    if (state !== 'playing') return;
    const x = playerScreenX();
    particles.push({
      x: x + (Math.random() - 0.5) * player.width * 0.4,
      y: player.y + 8,
      vx: (Math.random() - 0.5) * 18,
      vy: 60 + Math.random() * 40,
      life: 1,
      decay: 2.6,
      color: boostActive ? COLORS.coin : COLORS.player,
      size: Math.random() * 2.4 + 1.2
    });
  }

  /* ----------------------------- update ------------------------------ */
  function playerScreenX() { return laneToX(laneFracFromIndex(player.fracLane), 1); }

  function update(dt) {
    elapsed += dt;

    // difficulty ramp
    rampTimer += dt;
    if (rampTimer >= SPEED_RAMP_INTERVAL_S) {
      rampTimer -= SPEED_RAMP_INTERVAL_S;
      baseSpeed *= SPEED_RAMP_FACTOR;
    }

    // boost economy
    if (boostHeld && boostFuel > 0.02 && boostCooldown <= 0) {
      boostActive = true;
      boostFuel -= dt / BOOST_DURATION_S;
      if (boostFuel <= 0) {
        boostFuel = 0;
        boostActive = false;
        boostCooldown = BOOST_COOLDOWN_S;
      }
    } else {
      boostActive = false;
      if (boostCooldown > 0) {
        boostCooldown -= dt;
        if (boostCooldown < 0) boostCooldown = 0;
      } else {
        boostFuel = Math.min(1, boostFuel + dt * BOOST_RECHARGE_RATE);
      }
    }
    speedMultiplier = boostActive ? BOOST_MULT : 1;
    const curSpeed = baseSpeed * speedMultiplier;

    // player lane tween
    if (player.tweenT < 1) {
      player.tweenT = Math.min(1, player.tweenT + dt / LANE_TWEEN_S);
      const t = player.tweenT;
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      player.fracLane = player.fromFrac + (player.lane - player.fromFrac) * eased;
    } else {
      player.fracLane = player.lane;
    }

    // spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEntity();
      spawnTimer = currentSpawnInterval();
    }

    // advance obstacles
    for (let i = 0; i < obstacles.length; i++) {
      obstacles[i].z += curSpeed * dt;
      if (obstacles[i].kind === 'rival') obstacles[i].rot += dt * 2;
    }
    // advance coins
    for (let i = 0; i < coins.length; i++) {
      coins[i].z += curSpeed * dt;
      coins[i].spin += dt * 4;
    }

    // collision: obstacle vs player
    const pFrac = laneFracFromIndex(player.fracLane);
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (o.z >= COLLISION_Z_MIN && o.z <= COLLISION_Z_MAX) {
        const oFrac = laneFracFromIndex(o.lane);
        if (Math.abs(pFrac - oFrac) < LANE_HIT_THRESH) {
          if (shieldCount > 0) {            // v0.0.2 — shield absorbs one crash
            shieldCount--;
            obstacles.splice(i, 1);
            burst(laneToX(oFrac, o.z), projY(o.z), COLORS.shield, 20, 150);
            if (window.MUX) MUX.hit();
            elScore.textContent = score.toLocaleString() + (shieldCount > 0 ? ' 🛡' + shieldCount : '');
            return;
          }
          gameOver();
          return;
        }
      }
    }
    // coin pickup
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.z >= COIN_Z_MIN && c.z <= COIN_Z_MAX) {
        const cFrac = laneFracFromIndex(c.lane);
        if (Math.abs(pFrac - cFrac) < LANE_HIT_THRESH) {
          if (c.shield) { shieldCount = Math.min(shieldCount + 1, 2); if (window.MUX) MUX.bump(); }
          else { score += COIN_VALUE; }
          const cx = laneToX(cFrac, c.z);
          burst(cx, projY(c.z), c.shield ? COLORS.shield : COLORS.coin, 14, 120);
          coins.splice(i, 1);
          continue;
        }
      }
    }

    // cull
    obstacles = obstacles.filter(o => o.z < 1.18);
    coins = coins.filter(c => c.z < 1.18 && c.z > -0.05);

    // distance & score
    const pxPerZ = (H - horizonY);
    distance += curSpeed * pxPerZ * dt;
    const newScore = Math.floor(distance / SCORE_PX_PER_POINT);
    if (newScore !== score && newScore > score) score = newScore;

    // particles
    exhaustParticle();
    if (Math.random() < 0.5) exhaustParticle();
    updateParticles(dt);

    // grid scroll
    gridPhase = (gridPhase + curSpeed * 3 * dt) % 1;

    // HUD
    elScore.textContent = score.toLocaleString() + (shieldCount > 0 ? ' 🛡' + shieldCount : '');
    const totalMult = (baseSpeed / INITIAL_BASE_SPEED) * speedMultiplier;
    elSpeed.textContent = totalMult.toFixed(1) + 'x';
    updateBoostMeterUI();
  }

  function updateOver(dt) {
    // keep particles flying after crash
    updateParticles(dt);
    gridPhase = (gridPhase + 0.2 * dt) % 1;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateBoostMeterUI() {
    const pct = Math.round(boostFuel * 100);
    elBoostFill.style.width = pct + '%';
    elBoostFill.classList.toggle('cooling', boostCooldown > 0);
    btnBoost.disabled = boostFuel <= 0.02 && boostCooldown > 0;
  }

  /* ----------------------------- render ------------------------------ */
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawStars();
    drawSun();
    drawMountains();
    drawGround();
    drawGrid();
    drawRoadLines();

    // entities, far to near
    const drawables = [];
    for (const o of obstacles) drawables.push({ z: o.z, type: 'obs', ref: o });
    for (const c of coins) drawables.push({ z: c.z, type: 'coin', ref: c });
    drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) {
      if (d.type === 'obs') drawObstacle(d.ref);
      else drawCoin(d.ref);
    }

    if (state === 'playing' || state === 'paused' || state === 'over') {
      drawPlayer();
    }
    drawParticles();

    if (boostActive) drawBoostOverlay();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY + (H - horizonY) * 0.05);
    g.addColorStop(0, COLORS.skyTop);
    g.addColorStop(0.55, COLORS.skyMid);
    g.addColorStop(0.88, COLORS.skyHorizon);
    g.addColorStop(1, COLORS.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizonY + 4);
  }

  function drawStars() {
    ctx.save();
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(performance.now() * 0.002 + s.tw);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = COLORS.star;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.restore();
  }

  function drawSun() {
    const cx = roadCenterX;
    const cy = horizonY + sunRadius * 0.15; // slightly below horizon line so lower half is hidden by ground
    const r = sunRadius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, COLORS.sunA);
    g.addColorStop(0.45, COLORS.sunB);
    g.addColorStop(1, COLORS.sunC);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // horizontal slits, thin at top, thick toward bottom (classic outrun)
    ctx.fillStyle = COLORS.skyHorizon;
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const t = i / (stripes - 1);              // 0..1
      const y = cy - r + t * r * 2;
      const thick = 1.2 + Math.pow(t, 2) * 11;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(cx - r, y, r * 2, thick);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // outer glow ring
    ctx.save();
    ctx.shadowBlur = 26;
    ctx.shadowColor = COLORS.sunB;
    ctx.strokeStyle = 'rgba(255, 140, 0, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawMountains() {
    for (const m of mountains) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.mountainEdge;
      ctx.fillStyle = COLORS.mountain;
      ctx.beginPath();
      ctx.moveTo(m.cx - m.halfW, horizonY);
      ctx.lineTo(m.cx, m.peak);
      ctx.lineTo(m.cx + m.halfW, horizonY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.mountainEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGround() {
    // fill below horizon
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, '#0a0220');
    g.addColorStop(1, COLORS.ground);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, W, H - horizonY);
  }

  function drawGrid() {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = COLORS.grid;
    ctx.strokeStyle = COLORS.grid;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const z = (i + gridPhase) / N;
      if (z <= 0.001 || z > 1.05) continue;
      const y = projY(z);
      const halfW = roadHalfAtZ(z);
      // full-width ground line (synthwave grid beyond road)
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      // brighter road segment
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(roadCenterX - halfW, y);
      ctx.lineTo(roadCenterX + halfW, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoadLines() {
    // converging road edges at frac = ±1.5, lane dividers at frac = ±0.5
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.roadEdge;
    ctx.strokeStyle = COLORS.roadEdge;
    ctx.lineWidth = 2;
    drawFracLine(-1.5);
    drawFracLine(1.5);
    ctx.shadowColor = COLORS.grid;
    ctx.strokeStyle = COLORS.laneDiv;
    ctx.lineWidth = 1.5;
    drawFracLine(-0.5);
    drawFracLine(0.5);
    ctx.restore();
  }
  function drawFracLine(frac) {
    const xTop = laneToX(frac, 0);
    const yTop = projY(0);
    const xBot = laneToX(frac, 1);
    const yBot = projY(1);
    ctx.beginPath();
    ctx.moveTo(xTop, yTop);
    ctx.lineTo(xBot, yBot);
    ctx.stroke();
  }

  function drawObstacle(o) {
    if (o.z <= 0) return;
    const z = o.z;
    const s = scaleAtZ(z);
    const cx = laneToX(laneFracFromIndex(o.lane), z);
    const cy = projY(z);
    const w = player.width * 0.95 * s;
    const h = player.height * 0.7 * s;
    if (w < 1) return;

    ctx.save();
    if (o.kind === 'rival') {
      // rival car: triangle pointing down (toward player), magenta
      ctx.shadowBlur = 16 * s + 4;
      ctx.shadowColor = COLORS.rival;
      ctx.fillStyle = COLORS.rival;
      ctx.beginPath();
      ctx.moveTo(cx, cy + h / 2);
      ctx.lineTo(cx - w / 2, cy - h / 2);
      ctx.lineTo(cx + w / 2, cy - h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy + h / 4);
      ctx.lineTo(cx - w / 4, cy - h / 4);
      ctx.lineTo(cx + w / 4, cy - h / 4);
      ctx.closePath();
      ctx.fill();
    } else {
      // block: neon-edged rectangle
      ctx.shadowBlur = 14 * s + 4;
      ctx.shadowColor = COLORS.obstacleEdge;
      ctx.fillStyle = '#1a0010';
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.obstacleEdge;
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
      // inner glow stripe
      ctx.strokeStyle = COLORS.obstacle;
      ctx.lineWidth = Math.max(1, 1 * s);
      ctx.strokeRect(cx - w / 2 + 3 * s, cy - h / 2 + 3 * s, w - 6 * s, h - 6 * s);
    }
    ctx.restore();
  }

  function drawCoin(c) {
    if (c.z <= 0) return;
    const z = c.z;
    const s = scaleAtZ(z);
    const cx = laneToX(laneFracFromIndex(c.lane), z);
    const cy = projY(z);
    const r = player.width * 0.32 * s;
    if (r < 1) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(c.spin);
    ctx.shadowBlur = 14 * s + 4;
    ctx.shadowColor = c.shield ? COLORS.shield : COLORS.coin;
    ctx.fillStyle = c.shield ? COLORS.shield : COLORS.coin;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1, 1.4 * s);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(r * 0.55, 0);
    ctx.lineTo(0, r * 0.55);
    ctx.lineTo(-r * 0.55, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const cx = playerScreenX();
    const cy = player.y;
    const w = player.width;
    const h = player.height;
    // glow trail (faded ghosts)
    ctx.save();
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.10 * i;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.5 + i * 6);
      ctx.lineTo(cx - w * 0.5, cy + h * 0.5 + i * 6);
      ctx.lineTo(cx + w * 0.5, cy + h * 0.5 + i * 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // body — v0.0.3 detailed rear-view car (spoiler, window, taillights, bumper, wheels)
    ctx.save();
    // rear spoiler (top bar) + supports
    ctx.shadowBlur = boostActive ? 30 : 18;
    ctx.shadowColor = COLORS.player;
    ctx.fillStyle = COLORS.playerCore;
    ctx.fillRect(cx - w * 0.46, cy - h * 0.5, w * 0.92, Math.max(3, h * 0.1));
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(cx - w * 0.34, cy - h * 0.42, Math.max(2, w * 0.06), h * 0.1);
    ctx.fillRect(cx + w * 0.28, cy - h * 0.42, Math.max(2, w * 0.06), h * 0.1);
    // rear window (dark glass)
    ctx.fillStyle = '#0a1a2a';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy - h * 0.34);
    ctx.lineTo(cx + w * 0.3, cy - h * 0.34);
    ctx.lineTo(cx + w * 0.2, cy - h * 0.08);
    ctx.lineTo(cx - w * 0.2, cy - h * 0.08);
    ctx.closePath();
    ctx.fill();
    // main body (cyan gradient)
    ctx.shadowBlur = boostActive ? 26 : 14;
    ctx.shadowColor = COLORS.player;
    const bodyGrad = ctx.createLinearGradient(0, cy - h * 0.25, 0, cy + h * 0.45);
    bodyGrad.addColorStop(0, COLORS.playerCore);
    bodyGrad.addColorStop(0.5, COLORS.player);
    bodyGrad.addColorStop(1, '#0a8a9a');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(cx - w * 0.46, cy - h * 0.25, w * 0.92, h * 0.7);
    ctx.shadowBlur = 0;
    // cabin highlight stripe
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(cx - w * 0.3, cy - h * 0.22, w * 0.6, Math.max(2, h * 0.05));
    // taillights (red, glowing)
    ctx.fillStyle = '#ff2a4a';
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff2a4a';
    ctx.fillRect(cx - w * 0.38, cy - h * 0.1, w * 0.2, Math.max(2, h * 0.09));
    ctx.fillRect(cx + w * 0.18, cy - h * 0.1, w * 0.2, Math.max(2, h * 0.09));
    ctx.shadowBlur = 0;
    // bumper (dark)
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(cx - w * 0.46, cy + h * 0.28, w * 0.92, Math.max(3, h * 0.12));
    // wheels (peeking at bottom sides)
    ctx.fillStyle = '#10141c';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.46, cy + h * 0.32, w * 0.1, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.46, cy + h * 0.32, w * 0.1, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    // rear underglow
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = boostActive ? COLORS.coin : COLORS.player;
    ctx.fillRect(cx - w * 0.4, cy + h * 0.5, w * 0.8, Math.max(2, h * 0.08));
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(0.3, p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBoostOverlay() {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = COLORS.coin;
    ctx.fillRect(0, 0, W, H);
    // speed lines
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 1.5;
    const t = performance.now() * 0.02;
    for (let i = 0; i < 8; i++) {
      const x = (i * W / 8 + (t * 80) % (W / 8)) % W;
      const y1 = horizonY + ((t * 30 + i * 50) % (H - horizonY));
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y1 + 22);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------ loop ------------------------------- */
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dtRaw = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(0.05, Math.max(0, dtRaw)) || 0;

    if (state === 'playing') update(dt);
    else if (state === 'over') updateOver(dt);
    else {
      // idle background scroll on start screen
      gridPhase = (gridPhase + 0.25 * dt) % 1;
    }

    render();
  }

  /* ------------------------------ init ------------------------------- */
  function init() {
    loadBest();
    resize();
    // ensure first layout settled
    setTimeout(resize, 60);
    showScreen('start');
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  init();
})();
