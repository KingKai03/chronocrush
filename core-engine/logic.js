/* ============================================================
   CHRONOCRUSH — logic.js
   ============================================================ */

const BOARD_SIZE = 6;
const TILE_PX = 320 / BOARD_SIZE; // 53.33px per tile

const gameState = {
  lives: 5,
  gold: 150,
  currentLevel: 1,
  highestUnlockedLevel: 1,
  totalLevels: 70,
  isGameActive: false,
  levelPendingStart: null,
  levelRecords: {},
  grid: [],
  score: 0,
  targetScore: 500,
  moves: 20,
  selectedTile: null,
  preferences: { sound: true, sfx: true, vibe: true },
  audioCtx: null,
  musicInterval: null,
  currentTrackEra: null,
  matchExplosions: [],
  boosters: { hammer: 3, bomb: 3, shuffle: 3 },
  activeBooster: null,
  challengeTarget: null,
  challengeProgress: 0,
  lastSeenEraName: null
};

// Fireworks engine
let fxCanvas = null;
let fxCtx = null;
let fxParticles = [];
let fxAnimationId = null;

// Cached DOM refs
let canvas, ctx;

/* ============================================================
   ERA TIMELINE — 7 eras, 10 levels each (1-70)
   ============================================================ */
const eraTimeline = [
  { name: "1940s Noir",         startLvl: 1,  endLvl: 10, tempo: 62, melody: [196, 220, 246, 220, 196, 174], items: ['📻','🎩','✒️','🎷'] },
  { name: "1950s Rockabilly",   startLvl: 11, endLvl: 20, tempo: 64, melody: [220, 261, 329, 261, 220, 196], items: ['🥤','🎸','🕶️','🚗'] },
  { name: "1960s Psychedelic",  startLvl: 21, endLvl: 30, tempo: 60, melody: [293, 329, 392, 329, 293, 261], items: ['☮️','🌸','🚌','🎨'] },
  { name: "1970s Disco",        startLvl: 31, endLvl: 40, tempo: 66, melody: [220, 329, 293, 220, 246, 196], items: ['🪩','✨','🛼','🕺'] },
  { name: "1980s Retro Synth",  startLvl: 41, endLvl: 50, tempo: 68, melody: [329, 392, 440, 392, 349, 311], items: ['🎮','📼','🕹️','📟'] },
  { name: "1990s Grunge",       startLvl: 51, endLvl: 60, tempo: 60, melody: [196, 220, 196, 174, 164, 174], items: ['📀','☎️','🧥','🎧'] },
  { name: "2000s Y2K Pop",      startLvl: 61, endLvl: 70, tempo: 70, melody: [261, 329, 392, 329, 293, 349], items: ['💿','📱','👛','🌐'] }
];

/* ============================================================
   INITIALISATION
   ============================================================ */
document.addEventListener("DOMContentLoaded", boot);

function boot() {
  gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
  gameState.levelRecords = JSON.parse(localStorage.getItem("chrono_level_records")) || {};
  gameState.preferences = JSON.parse(localStorage.getItem("chrono_preferences")) || { sound: true, sfx: true, vibe: true };
  gameState.gold = parseInt(localStorage.getItem("chrono_gold"));
  if (isNaN(gameState.gold)) gameState.gold = 150;
  gameState.lives = parseInt(localStorage.getItem("chrono_lives"));
  if (isNaN(gameState.lives)) gameState.lives = 5;
  gameState.lastSeenEraName = localStorage.getItem("chrono_last_era") || eraTimeline[0].name;

  syncSettingsUI();

  canvas = document.getElementById("gameCanvas");
  ctx = canvas ? canvas.getContext("2d") : null;
  if (canvas) {
    canvas.addEventListener("mousedown", handleCanvasClick);
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (e.touches.length > 0) handleCanvasClick(e.touches[0]);
    }, { passive: false });
  }

  fxCanvas = document.getElementById("fireworksCanvas");
  if (fxCanvas) fxCtx = fxCanvas.getContext("2d");
  window.addEventListener("resize", resizeFireworksCanvas);

  setInterval(updateAndDrawBoard, 30);

  switchView("loadingScreen");
  setTimeout(() => switchView("authScreen"), 900);
}

function syncSettingsUI() {
  const map = { sound: 'toggleSoundBtn', sfx: 'toggleSfxBtn', vibe: 'toggleVibeBtn' };
  Object.keys(map).forEach(key => {
    const btn = document.getElementById(map[key]);
    if (!btn) return;
    btn.classList.toggle('active', gameState.preferences[key]);
    btn.innerText = gameState.preferences[key] ? 'ON' : 'OFF';
  });
}

function resizeFireworksCanvas() {
  if (fxCanvas) {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
}

/* ============================================================
   AUDIO ENGINE
   ============================================================ */
function initAudio() {
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (gameState.audioCtx && gameState.audioCtx.state === 'suspended') {
    gameState.audioCtx.resume();
  }
}

function getCurrentEraForLevel(level) {
  return eraTimeline.find(e => level >= e.startLvl && level <= e.endLvl) || eraTimeline[0];
}

function startEraMusic(eraName) {
  initAudio();
  if (!gameState.preferences.sound) return;
  if (gameState.currentTrackEra === eraName && gameState.musicInterval) return;

  stopEraMusic();
  gameState.currentTrackEra = eraName;
  const era = eraTimeline.find(e => e.name === eraName);
  if (!era) return;

  let step = 0;
  const noteLen = 60 / era.tempo;

  gameState.musicInterval = setInterval(() => {
    if (!gameState.preferences.sound || !gameState.audioCtx || gameState.audioCtx.state === 'suspended') return;

    const ac = gameState.audioCtx;
    const freq = era.melody[step % era.melody.length];

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ac.currentTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, ac.currentTime);
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.018, ac.currentTime + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + noteLen * 1.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start();
    osc.stop(ac.currentTime + noteLen * 1.4);

    if (step % 2 === 0) {
      const subOsc = ac.createOscillator();
      const subGain = ac.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(freq / 2, ac.currentTime);
      subGain.gain.setValueAtTime(0.0001, ac.currentTime);
      subGain.gain.linearRampToValueAtTime(0.01, ac.currentTime + 0.5);
      subGain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + noteLen * 1.6);
      subOsc.connect(subGain);
      subGain.connect(ac.destination);
      subOsc.start();
      subOsc.stop(ac.currentTime + noteLen * 1.6);
    }

    step++;
  }, noteLen * 1000);
}

function stopEraMusic() {
  if (gameState.musicInterval) {
    clearInterval(gameState.musicInterval);
    gameState.musicInterval = null;
  }
  gameState.currentTrackEra = null;
}

function triggerVibration(pattern) {
  if (gameState.preferences.vibe && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/* ============================================================
   SCREEN / VIEW MANAGEMENT
   ============================================================ */
function switchView(id) {
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

/* ============================================================
   LEVEL TRANSITION ANIMATION
   Panels slide in from top + bottom, record spins, then level loads.
   ============================================================ */
function playLevelTransition(callback) {
  const screen   = document.getElementById('levelTransitionScreen');
  const panelTop = document.getElementById('transitionPanelTop');
  const panelBot = document.getElementById('transitionPanelBottom');
  const center   = document.getElementById('transitionCenter');

  // Reset state
  screen.classList.remove('panels-closed', 'show-content');
  panelTop.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
  panelBot.style.transition = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';

  // Show the transition screen on top of everything
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');

  // Step 1: slide panels in (0ms → 550ms)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      screen.classList.add('panels-closed');
    });
  });

  // Step 2: panels have met — show spinning record + text (600ms)
  setTimeout(() => {
    screen.classList.add('show-content');
  }, 620);

  // Step 3: hold the loading moment, then fire callback (1350ms total)
  setTimeout(() => {
    // Hide centre content before opening
    screen.classList.remove('show-content');

    // Slide panels back out
    setTimeout(() => {
      screen.classList.remove('panels-closed');
    }, 120);

    // After panels have retracted, show the actual gameplay
    setTimeout(() => {
      screen.classList.remove('active');
      if (callback) callback();
    }, 700);

  }, 1350);
}

/* ============================================================
   HOME / MAP PAGE
   ============================================================ */
function loadHomepage() {
  switchView("homePage");

  document.getElementById("livesCounter").innerText = gameState.lives;
  document.getElementById("profileGold").innerText = gameState.gold;

  const cornerDisk = document.getElementById("mapCornerLevelDisk");
  if (cornerDisk) cornerDisk.innerText = gameState.highestUnlockedLevel;
  const cornerLives = document.getElementById("mapCornerLives");
  if (cornerLives) cornerLives.innerText = gameState.lives;

  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = "";
  const align = ["mid", "left", "mid", "right"];

  eraTimeline.forEach(era => {
    const banner = document.createElement("div");
    banner.className = "era-header-banner";
    banner.innerHTML = `${era.name.toUpperCase()}<span class="era-sub">Levels ${era.startLvl}–${era.endLvl}</span>`;
    mapLayer.appendChild(banner);

    for (let i = era.startLvl; i <= era.endLvl; i++) {
      const row = document.createElement("div");
      row.className = `map-row ${align[i % 4]}`;
      const btn = document.createElement("button");

      let stateClass = '';
      if (i === gameState.highestUnlockedLevel) stateClass = 'active';
      else if (i < gameState.highestUnlockedLevel) stateClass = 'unlocked';

      btn.className = `level-node ${stateClass}`;
      if (i > gameState.highestUnlockedLevel) btn.disabled = true;

      btn.onclick = () => {
        initAudio();
        gameState.levelPendingStart = i;
        document.getElementById("modalLevelTitle").innerText = `LEVEL ${i}`;
        toggleModal('levelReadyModal', true);
      };

      const recs = gameState.levelRecords[i]
        ? "📀".repeat(gameState.levelRecords[i])
        : (i <= gameState.highestUnlockedLevel ? "⚪⚪⚪" : "🔒");

      btn.innerHTML = `<div class="node-circle">${i}</div><div class="node-records">${recs}</div>`;
      row.appendChild(btn);
      mapLayer.appendChild(row);
    }
  });

  const currentEra = getCurrentEraForLevel(gameState.highestUnlockedLevel);
  if (currentEra) startEraMusic(currentEra.name);

  requestAnimationFrame(() => {
    const activeNode = mapLayer.querySelector('.level-node.active');
    if (activeNode) activeNode.scrollIntoView({ block: 'center', behavior: 'auto' });
  });
}

/* ============================================================
   MODALS
   ============================================================ */
function toggleModal(id, open) {
  const m = document.getElementById(id);
  if (!m) return;
  if (open) {
    m.classList.add('visible');
    if (id === 'levelSuccessModal') {
      resizeFireworksCanvas();
      spawnFireworksBurst();
      runFireworksLoop();
    }
  } else {
    m.classList.remove('visible');
    if (id === 'levelSuccessModal') {
      cancelAnimationFrame(fxAnimationId);
      fxParticles = [];
    }
  }
}

function confirmAndStartLevel() {
  toggleModal('levelReadyModal', false);

  if (gameState.lives <= 0) {
    alert("You're out of lives! Visit the shop to refill, or wait for them to regenerate.");
    return;
  }

  // Play transition animation THEN start the level
  playLevelTransition(() => {
    startLevelLogic(gameState.levelPendingStart);
  });
}

function retryCurrentLevel() {
  toggleModal('levelSuccessModal', false);
  playLevelTransition(() => {
    startLevelLogic(gameState.currentLevel);
  });
}

function advanceToNextLevel() {
  toggleModal('levelSuccessModal', false);
  let next = gameState.currentLevel + 1;
  if (next <= gameState.totalLevels && next <= gameState.highestUnlockedLevel) {
    playLevelTransition(() => {
      startLevelLogic(next);
    });
  } else {
    loadHomepage();
  }
}

/* ============================================================
   LEVEL SETUP — progressive difficulty
   ============================================================ */
function startLevelLogic(lvl) {
  gameState.currentLevel = lvl;
  gameState.isGameActive = true;
  gameState.score = 0;
  gameState.moves = 20;
  gameState.selectedTile = null;
  gameState.activeBooster = null;
  gameState.matchExplosions = [];

  gameState.targetScore = 400 + (lvl * 60);
  gameState.boosters = { hammer: 3, bomb: 3, shuffle: 3 };

  const era = getCurrentEraForLevel(lvl);

  const levelInEra = lvl - era.startLvl + 1;
  const challengeItem = era.items[(lvl - 1) % era.items.length];
  const challengeCount = 8 + Math.floor(levelInEra * 1.2);

  gameState.challengeTarget = { item: challengeItem, count: challengeCount };
  gameState.challengeProgress = 0;

  document.getElementById("activeEraName").innerText = `Level ${lvl}`;
  document.getElementById("movesDisplay").innerText = gameState.moves;
  document.getElementById("targetDisplay").innerText = gameState.targetScore;
  document.getElementById("scoreDisplay").innerText = 0;

  const banner = document.getElementById("challengeBanner");
  if (banner) banner.innerText = `Clear ${challengeCount} ${challengeItem} to pass!`;

  updateBoosterUI();

  switchView("gamePlayScreen");
  generateBoard(era.items);

  maybeShowEraUnlockToast(era);
}

function maybeShowEraUnlockToast(era) {
  if (gameState.lastSeenEraName !== era.name) {
    gameState.lastSeenEraName = era.name;
    localStorage.setItem("chrono_last_era", era.name);
    showEraUnlockToast(era.name);
  }
  startEraMusic(era.name);
}

function showEraUnlockToast(eraName) {
  const toast = document.getElementById("eraUnlockToast");
  const nameEl = document.getElementById("eraToastName");
  if (!toast || !nameEl) return;
  nameEl.innerText = eraName;
  toast.classList.add('show');
  triggerVibration([60, 30, 60]);
  setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ============================================================
   BOARD GENERATION
   ============================================================ */
function generateBoard(itemSet) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    gameState.grid[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      gameState.grid[r][c] = randomItem(itemSet);
    }
  }
  let guard = 0;
  while (findBoardMatches().length > 0 && guard < 50) {
    resolveSilentMatches(itemSet);
    guard++;
  }
}

function randomItem(itemSet) {
  const era = getCurrentEraForLevel(gameState.currentLevel);
  const items = itemSet || era.items;
  return items[Math.floor(Math.random() * items.length)];
}

function resolveSilentMatches(itemSet) {
  const matches = findBoardMatches();
  matches.forEach(pos => {
    gameState.grid[pos.r][pos.c] = randomItem(itemSet);
  });
}

/* ============================================================
   RENDER LOOP — bright tile backgrounds so emojis are visible
   ============================================================ */
function updateAndDrawBoard() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, 320, 320);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const x = c * TILE_PX;
      const y = r * TILE_PX;

      // Checkerboard-style alternating tile colours — both visibly bright
      const isEven = (r + c) % 2 === 0;
      ctx.fillStyle = isEven ? '#243545' : '#1e2e3c';
      ctx.fillRect(x, y, TILE_PX, TILE_PX);

      // Subtle inner highlight along top + left edges
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, y, TILE_PX, 2);        // top highlight
      ctx.fillRect(x, y, 2, TILE_PX);        // left highlight

      // Grid line
      ctx.strokeStyle = '#1a2530';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, TILE_PX - 1.5, TILE_PX - 1.5);

      // Selected tile glow overlay
      if (gameState.selectedTile && gameState.selectedTile.r === r && gameState.selectedTile.c === c) {
        ctx.fillStyle = 'rgba(212,175,55,0.35)';
        ctx.fillRect(x, y, TILE_PX, TILE_PX);
        // Gold border highlight
        ctx.strokeStyle = 'rgba(255,215,0,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      }

      // Emoji — drawn large and centred
      if (gameState.grid[r] && gameState.grid[r][c]) {
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameState.grid[r][c], x + TILE_PX / 2, y + TILE_PX / 2 + 1);
      }
    }
  }

  // Match explosion particles
  for (let i = gameState.matchExplosions.length - 1; i >= 0; i--) {
    const p = gameState.matchExplosions[i];
    ctx.fillStyle = `rgba(212,175,55,${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    p.y += p.vy;
    p.size *= 0.94;
    p.alpha -= 0.04;
    if (p.alpha <= 0) gameState.matchExplosions.splice(i, 1);
  }
}

/* ============================================================
   FIREWORKS (level success modal)
   ============================================================ */
function spawnFireworksBurst() {
  const colors = ['#ffd700', '#ff5e62', '#ff9966', '#00f2fe', '#4facfe', '#b19ffb'];
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  for (let b = 0; b < 2; b++) {
    const originX = centerX + (Math.random() * 200 - 100);
    const originY = centerY - (Math.random() * 120);
    const particlesCount = 35;

    for (let i = 0; i < particlesCount; i++) {
      const angle = (Math.PI * 2 / particlesCount) * i + Math.random() * 0.4;
      const speed = 2 + Math.random() * 5;
      fxParticles.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.015
      });
    }
  }
}

function runFireworksLoop() {
  if (!fxCtx) return;
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

  for (let i = fxParticles.length - 1; i >= 0; i--) {
    const p = fxParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    p.alpha -= p.decay;

    if (p.alpha <= 0) { fxParticles.splice(i, 1); continue; }

    fxCtx.save();
    fxCtx.globalAlpha = p.alpha;
    fxCtx.fillStyle = p.color;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    fxCtx.fill();
    fxCtx.restore();
  }

  if (Math.random() < 0.015 && fxParticles.length < 40) {
    spawnFireworksBurst();
  }

  fxAnimationId = requestAnimationFrame(runFireworksLoop);
}

/* ============================================================
   BOOSTERS
   ============================================================ */
function selectBooster(type) {
  if (!gameState.isGameActive) return;
  if (gameState.boosters[type] <= 0) return;

  if (gameState.activeBooster === type) {
    gameState.activeBooster = null;
  } else {
    gameState.activeBooster = type;
  }
  updateBoosterUI();

  if (gameState.activeBooster === 'shuffle') {
    useShuffleBooster();
  }
}

function updateBoosterUI() {
  const hammerBtn  = document.getElementById('boosterHammerBtn');
  const bombBtn    = document.getElementById('boosterBombBtn');
  const shuffleBtn = document.getElementById('boosterShuffleBtn');
  const hammerCount  = document.getElementById('hammerCount');
  const bombCount    = document.getElementById('bombCount');
  const shuffleCount = document.getElementById('shuffleCount');

  if (hammerCount)  hammerCount.innerText  = gameState.boosters.hammer;
  if (bombCount)    bombCount.innerText    = gameState.boosters.bomb;
  if (shuffleCount) shuffleCount.innerText = gameState.boosters.shuffle;

  [hammerBtn, bombBtn, shuffleBtn].forEach(btn => btn && btn.classList.remove('selected'));

  if (gameState.activeBooster === 'hammer' && hammerBtn)  hammerBtn.classList.add('selected');
  if (gameState.activeBooster === 'bomb'   && bombBtn)    bombBtn.classList.add('selected');

  if (hammerBtn)  hammerBtn.disabled  = gameState.boosters.hammer  <= 0;
  if (bombBtn)    bombBtn.disabled    = gameState.boosters.bomb    <= 0;
  if (shuffleBtn) shuffleBtn.disabled = gameState.boosters.shuffle <= 0;
}

function useShuffleBooster() {
  if (gameState.boosters.shuffle <= 0) return;
  gameState.boosters.shuffle--;
  const era = getCurrentEraForLevel(gameState.currentLevel);
  generateBoard(era.items);
  gameState.activeBooster = null;
  triggerVibration(50);
  updateBoosterUI();
}

function useHammerOnTile(r, c) {
  if (gameState.boosters.hammer <= 0) return;
  gameState.boosters.hammer--;
  const era = getCurrentEraForLevel(gameState.currentLevel);
  destroyTile(r, c, era.items);
  gameState.activeBooster = null;
  triggerVibration(60);
  updateBoosterUI();
  evaluateBoardAfterAction();
}

function useBombOnTile(r, c) {
  if (gameState.boosters.bomb <= 0) return;
  gameState.boosters.bomb--;
  const era = getCurrentEraForLevel(gameState.currentLevel);

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        destroyTile(nr, nc, era.items);
      }
    }
  }
  gameState.activeBooster = null;
  triggerVibration([80, 40, 80]);
  updateBoosterUI();
  evaluateBoardAfterAction();
}

function destroyTile(r, c, itemSet) {
  const destroyedItem = gameState.grid[r][c];
  if (destroyedItem === gameState.challengeTarget?.item) {
    gameState.challengeProgress++;
  }
  spawnExplosionAt(r, c);
  gameState.grid[r][c] = randomItem(itemSet);
}

function spawnExplosionAt(r, c) {
  for (let k = 0; k < 6; k++) {
    gameState.matchExplosions.push({
      x: (c * TILE_PX) + TILE_PX / 2,
      y: (r * TILE_PX) + TILE_PX / 2,
      size: 7,
      alpha: 1,
      vy: -1 - Math.random() * 2
    });
  }
}

function evaluateBoardAfterAction() {
  document.getElementById("scoreDisplay").innerText = gameState.score;
  checkChallengeAndScore();
}

/* ============================================================
   INPUT HANDLING
   ============================================================ */
function handleCanvasClick(e) {
  if (!gameState.isGameActive || !canvas) return;
  initAudio();

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const c = Math.floor(x / TILE_PX);
  const r = Math.floor(y / TILE_PX);
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

  if (gameState.activeBooster === 'hammer') {
    useHammerOnTile(r, c);
    return;
  }
  if (gameState.activeBooster === 'bomb') {
    useBombOnTile(r, c);
    return;
  }

  if (!gameState.selectedTile) {
    gameState.selectedTile = { r, c };
    triggerVibration(25);
  } else {
    const dist = Math.abs(gameState.selectedTile.r - r) + Math.abs(gameState.selectedTile.c - c);
    if (dist === 1) {
      swapTiles(gameState.selectedTile.r, gameState.selectedTile.c, r, c);
    } else {
      gameState.selectedTile = { r, c };
      triggerVibration(25);
    }
  }
}

function swapTiles(r1, c1, r2, c2) {
  const tmp = gameState.grid[r1][c1];
  gameState.grid[r1][c1] = gameState.grid[r2][c2];
  gameState.grid[r2][c2] = tmp;

  gameState.moves--;
  document.getElementById("movesDisplay").innerText = gameState.moves;

  triggerVibration(40);
  gameState.selectedTile = null;
  checkChallengeAndScore();
}

/* ============================================================
   MATCH DETECTION
   ============================================================ */
function findBoardMatches() {
  const matches = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const v = gameState.grid[r][c];
      if (v && v === gameState.grid[r][c+1] && v === gameState.grid[r][c+2]) {
        matches.push({ r, c }, { r, c: c+1 }, { r, c: c+2 });
      }
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const v = gameState.grid[r][c];
      if (v && v === gameState.grid[r+1][c] && v === gameState.grid[r+2][c]) {
        matches.push({ r, c }, { r: r+1, c }, { r: r+2, c });
      }
    }
  }

  const seen = new Set();
  return matches.filter(m => {
    const key = `${m.r},${m.c}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checkChallengeAndScore() {
  const matches = findBoardMatches();

  if (matches.length > 0) {
    gameState.score += matches.length * 50;
    document.getElementById("scoreDisplay").innerText = gameState.score;
    triggerVibration([60, 40, 60]);

    const era = getCurrentEraForLevel(gameState.currentLevel);

    matches.forEach(pos => {
      const clearedItem = gameState.grid[pos.r][pos.c];
      if (gameState.challengeTarget && clearedItem === gameState.challengeTarget.item) {
        gameState.challengeProgress++;
      }
      spawnExplosionAt(pos.r, pos.c);
      gameState.grid[pos.r][pos.c] = randomItem(era.items);
    });

    updateChallengeBanner();
    setTimeout(checkChallengeAndScore, 200);
    return;
  }

  evaluateLevelEndConditions();
}

function updateChallengeBanner() {
  const banner = document.getElementById("challengeBanner");
  if (!banner || !gameState.challengeTarget) return;
  const remaining = Math.max(0, gameState.challengeTarget.count - gameState.challengeProgress);
  if (remaining > 0) {
    banner.innerText = `Clear ${remaining} more ${gameState.challengeTarget.item} to pass!`;
  } else {
    banner.innerText = `Challenge complete! ${gameState.challengeTarget.item} cleared ✓`;
  }
}

function evaluateLevelEndConditions() {
  const challengeMet = gameState.challengeTarget
    ? gameState.challengeProgress >= gameState.challengeTarget.count
    : true;
  const scoreMet = gameState.score >= gameState.targetScore;

  if (challengeMet && scoreMet) {
    setTimeout(win, 400);
  } else if (gameState.moves <= 0) {
    setTimeout(() => {
      gameState.isGameActive = false;
      gameState.lives = Math.max(0, gameState.lives - 1);
      localStorage.setItem("chrono_lives", gameState.lives);
      alert("Out of moves! You lost a life.");
      loadHomepage();
    }, 500);
  }
}

/* ============================================================
   WIN HANDLING
   ============================================================ */
function win() {
  gameState.isGameActive = false;
  triggerVibration([100, 40, 100, 40, 300]);

  const stars = gameState.score > gameState.targetScore * 1.4 ? 3
              : gameState.score > gameState.targetScore * 1.1 ? 2 : 1;

  gameState.levelRecords[gameState.currentLevel] = stars;
  localStorage.setItem("chrono_level_records", JSON.stringify(gameState.levelRecords));

  gameState.boosters.hammer += 1;
  gameState.boosters.bomb += (stars >= 2 ? 1 : 0);
  gameState.boosters.shuffle += (stars >= 3 ? 1 : 0);

  gameState.gold += 10 * stars;
  localStorage.setItem("chrono_gold", gameState.gold);

  if (gameState.currentLevel === gameState.highestUnlockedLevel && gameState.highestUnlockedLevel < gameState.totalLevels) {
    gameState.highestUnlockedLevel++;
    localStorage.setItem("chrono_highest_level", gameState.highestUnlockedLevel);
  }

  document.getElementById("modalRecordsDisplay").innerHTML = "📀".repeat(stars);
  switchView("homePage");
  toggleModal('levelSuccessModal', true);
}

/* ============================================================
   NAVIGATION HELPERS
   ============================================================ */
function exitToHome() {
  gameState.isGameActive = false;
  gameState.activeBooster = null;
  loadHomepage();
}

function transitionToMap() {
  initAudio();
  triggerFlashAnimation();
  loadHomepage();
}

function handleAuth() {
  initAudio();
  triggerFlashAnimation();
  switchView("welcomeScreen");
}

function triggerFlashAnimation() {
  const f = document.getElementById("portalFlash");
  if (!f) return;
  f.classList.add('active');
  setTimeout(() => f.classList.remove('active'), 300);
}

function openSettingsModal() {
  toggleModal('settingsModal', true);
}

/* ============================================================
   SETTINGS
   ============================================================ */
function togglePreference(p) {
  gameState.preferences[p] = !gameState.preferences[p];
  localStorage.setItem("chrono_preferences", JSON.stringify(gameState.preferences));

  const btn = document.getElementById(`toggle${p.charAt(0).toUpperCase() + p.slice(1)}Btn`);
  if (btn) {
    btn.classList.toggle('active', gameState.preferences[p]);
    btn.innerText = gameState.preferences[p] ? "ON" : "OFF";
  }

  if (p === 'sound') {
    if (!gameState.preferences.sound) {
      stopEraMusic();
    } else {
      gameState.currentTrackEra = null;
      const era = getCurrentEraForLevel(gameState.isGameActive ? gameState.currentLevel : gameState.highestUnlockedLevel);
      startEraMusic(era.name);
    }
  }
}

function resetGameProgress() {
  if (confirm("This will erase all progress, gold, and lives. Continue?")) {
    localStorage.clear();
    location.reload();
  }
}

/* ============================================================
   SHOP
   ============================================================ */
function buyItem(type, cost) {
  if (gameState.gold < cost) {
    alert("Not enough gold! Win levels or claim free gold to earn more.");
    return;
  }

  gameState.gold -= cost;

  switch (type) {
    case 'lives':
      gameState.lives = Math.min(99, gameState.lives + 5);
      localStorage.setItem("chrono_lives", gameState.lives);
      break;
    case 'hammer':
      gameState.boosters.hammer += 3;
      break;
    case 'bomb':
      gameState.boosters.bomb += 3;
      break;
    case 'shuffle':
      gameState.boosters.shuffle += 3;
      break;
    case 'moves':
      if (gameState.isGameActive) {
        gameState.moves += 5;
        document.getElementById("movesDisplay").innerText = gameState.moves;
      }
      break;
    case 'gold':
      gameState.gold += 500;
      break;
  }

  localStorage.setItem("chrono_gold", gameState.gold);
  document.getElementById("profileGold").innerText = gameState.gold;
  updateBoosterUI();
  triggerVibration(40);
}

/* ============================================================
   FRIENDS / SHARING
   ============================================================ */
function copyInviteLink() {
  const link = window.location.href.split('?')[0];
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => {
      alert("Invite link copied! Share it with your friends.");
    }).catch(() => {
      alert("Couldn't copy automatically. Link: " + link);
    });
  } else {
    alert("Link: " + link);
  }
}

function shareToFacebook() {
  const link = encodeURIComponent(window.location.href.split('?')[0]);
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${link}`;
  window.open(shareUrl, '_blank', 'width=600,height=400');
}
