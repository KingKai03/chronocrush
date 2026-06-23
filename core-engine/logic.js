/* ============================================================
   CHRONOCRUSH — logic.js  (full rewrite, board + audio fixed)
   ============================================================ */

const BOARD_SIZE = 6;

// Canvas physical size — set at runtime to match wrapper
let CANVAS_PX  = 320;   // updated in resizeCanvas()
let TILE_PX    = CANVAS_PX / BOARD_SIZE;

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
  musicNodes: [],          // track active oscillator nodes so we can stop them
  currentTrackEra: null,
  musicSchedulerId: null,  // setInterval id
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
   ERA TIMELINE
   ============================================================ */
const eraTimeline = [
  { name: "1940s Noir",        startLvl: 1,  endLvl: 10, items: ['📻','🎩','✒️','🎷'] },
  { name: "1950s Rockabilly",  startLvl: 11, endLvl: 20, items: ['🥤','🎸','🕶️','🚗'] },
  { name: "1960s Psychedelic", startLvl: 21, endLvl: 30, items: ['☮️','🌸','🚌','🎨'] },
  { name: "1970s Disco",       startLvl: 31, endLvl: 40, items: ['🪩','✨','🛼','🕺'] },
  { name: "1980s Retro Synth", startLvl: 41, endLvl: 50, items: ['🎮','📼','🕹️','📟'] },
  { name: "1990s Grunge",      startLvl: 51, endLvl: 60, items: ['📀','☎️','🧥','🎧'] },
  { name: "2000s Y2K Pop",     startLvl: 61, endLvl: 70, items: ['💿','📱','👛','🌐'] }
];

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener("DOMContentLoaded", boot);

function boot() {
  gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
  gameState.levelRecords  = JSON.parse(localStorage.getItem("chrono_level_records"))  || {};
  gameState.preferences   = JSON.parse(localStorage.getItem("chrono_preferences"))    || { sound: true, sfx: true, vibe: true };
  gameState.gold  = parseInt(localStorage.getItem("chrono_gold"))  || 150;
  gameState.lives = parseInt(localStorage.getItem("chrono_lives")) || 5;
  if (isNaN(gameState.gold))  gameState.gold  = 150;
  if (isNaN(gameState.lives)) gameState.lives = 5;
  gameState.lastSeenEraName = localStorage.getItem("chrono_last_era") || eraTimeline[0].name;

  syncSettingsUI();

  canvas = document.getElementById("gameCanvas");
  ctx    = canvas ? canvas.getContext("2d") : null;

  if (canvas) {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
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

/* ============================================================
   CANVAS RESIZE
   Fixed 360x360 logical buffer. CSS stretches it to fill the
   wrapper. No DPR scaling — it stacks on repeated calls and
   shrinks emojis into invisibility.
   ============================================================ */
function resizeCanvas() {
  if (!canvas) return;
  CANVAS_PX    = 360;
  TILE_PX      = CANVAS_PX / BOARD_SIZE;  // 60px per tile
  canvas.width  = CANVAS_PX;
  canvas.height = CANVAS_PX;
  // Re-acquire context — resizing the buffer resets it
  ctx = canvas.getContext("2d");
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
    fxCanvas.width  = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
}

/* ============================================================
   SPACE MUSIC ENGINE
   Gentle, slow, ambient — pads + soft sub-bass + occasional
   shimmer. Sounds like floating through a nebula, not a jazz bar.
   ============================================================ */
function initAudio() {
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (gameState.audioCtx.state === 'suspended') {
    gameState.audioCtx.resume();
  }
}

function getCurrentEraForLevel(level) {
  return eraTimeline.find(e => level >= e.startLvl && level <= e.endLvl) || eraTimeline[0];
}

// Global reverb convolver (created once, reused)
let reverbNode = null;
function getReverbNode(ac) {
  if (reverbNode) return reverbNode;

  // Build a simple impulse-response reverb
  const len     = ac.sampleRate * 3.5;
  const impulse = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
  }
  reverbNode = ac.createConvolver();
  reverbNode.buffer = impulse;
  reverbNode.connect(ac.destination);
  return reverbNode;
}

// Space chord set — slow, modal, dreamy intervals
const SPACE_CHORDS = [
  [130.81, 196.00, 246.94, 329.63],   // C3 G3 B3 E4  — open fifth + major 7
  [146.83, 220.00, 277.18, 369.99],   // D3 A3 C#4 F#4
  [123.47, 185.00, 246.94, 311.13],   // B2 F#3 B3 Eb4
  [138.59, 207.65, 261.63, 349.23],   // C#3 G#3 C4 F4
  [110.00, 164.81, 220.00, 293.66],   // A2 E3 A3 D4   — suspended
  [116.54, 174.61, 233.08, 311.13],   // Bb2 F3 Bb3 Eb4
];

let chordIndex = 0;
let spaceScheduleTimer = null;

function startSpaceMusic() {
  initAudio();
  if (!gameState.preferences.sound) return;
  if (gameState.musicSchedulerId) return;  // already running

  chordIndex = 0;
  scheduleNextChord();
}

function scheduleNextChord() {
  if (!gameState.preferences.sound) return;

  playSpaceChord(SPACE_CHORDS[chordIndex % SPACE_CHORDS.length]);
  chordIndex++;

  // Each chord lasts 7–9 seconds — very slow, hypnotic
  const delay = 7000 + Math.random() * 2000;
  gameState.musicSchedulerId = setTimeout(scheduleNextChord, delay);
}

function playSpaceChord(freqs) {
  const ac = gameState.audioCtx;
  if (!ac || ac.state === 'suspended') return;

  const reverb   = getReverbNode(ac);
  const masterGain = ac.createGain();
  masterGain.gain.setValueAtTime(0, ac.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.055, ac.currentTime + 2.5);   // slow fade in
  masterGain.gain.setValueAtTime(0.055, ac.currentTime + 4.5);
  masterGain.gain.linearRampToValueAtTime(0, ac.currentTime + 7.5);       // slow fade out

  masterGain.connect(reverb);
  masterGain.connect(ac.destination);  // dry signal too

  freqs.forEach((freq, i) => {
    // Pad voice — sine through soft lowpass
    const osc  = ac.createOscillator();
    const filt = ac.createBiquadFilter();
    const gain = ac.createGain();

    osc.type = "sine";
    // Slight detune per voice for that shimmer/chorus feel
    osc.frequency.setValueAtTime(freq * (1 + (i * 0.0008)), ac.currentTime);

    filt.type = "lowpass";
    filt.frequency.setValueAtTime(600 + i * 80, ac.currentTime);
    filt.Q.value = 0.4;

    gain.gain.setValueAtTime(0.18, ac.currentTime);

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(masterGain);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 8);

    // Second oscillator slightly detuned — creates gentle beating
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * (1 - 0.0015), ac.currentTime);
    gain2.gain.setValueAtTime(0.06, ac.currentTime);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(ac.currentTime);
    osc2.stop(ac.currentTime + 8);
  });

  // Sub bass — just the root, very quiet and deep
  const subOsc  = ac.createOscillator();
  const subGain = ac.createGain();
  const subFilt = ac.createBiquadFilter();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(freqs[0] / 2, ac.currentTime);
  subFilt.type = "lowpass";
  subFilt.frequency.setValueAtTime(120, ac.currentTime);
  subGain.gain.setValueAtTime(0, ac.currentTime);
  subGain.gain.linearRampToValueAtTime(0.08, ac.currentTime + 3);
  subGain.gain.linearRampToValueAtTime(0, ac.currentTime + 7.5);
  subOsc.connect(subFilt);
  subFilt.connect(subGain);
  subGain.connect(ac.destination);
  subOsc.start(ac.currentTime);
  subOsc.stop(ac.currentTime + 8);

  // Occasional high shimmer (like stars twinkling)
  if (Math.random() < 0.45) {
    const shimFreq = freqs[freqs.length - 1] * 2;
    const shim     = ac.createOscillator();
    const shimGain = ac.createGain();
    shim.type = "sine";
    shim.frequency.setValueAtTime(shimFreq, ac.currentTime + 1.5);
    shimGain.gain.setValueAtTime(0, ac.currentTime + 1.5);
    shimGain.gain.linearRampToValueAtTime(0.022, ac.currentTime + 2.2);
    shimGain.gain.linearRampToValueAtTime(0, ac.currentTime + 4.5);
    shim.connect(shimGain);
    shimGain.connect(reverb);
    shim.start(ac.currentTime + 1.5);
    shim.stop(ac.currentTime + 5);
  }
}

function stopSpaceMusic() {
  if (gameState.musicSchedulerId) {
    clearTimeout(gameState.musicSchedulerId);
    gameState.musicSchedulerId = null;
  }
  gameState.currentTrackEra = null;
}

// Legacy name kept so nothing breaks
function startEraMusic()  { startSpaceMusic(); }
function stopEraMusic()   { stopSpaceMusic();  }

function triggerVibration(pattern) {
  if (gameState.preferences.vibe && navigator.vibrate) navigator.vibrate(pattern);
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
   ============================================================ */
function playLevelTransition(callback) {
  const screen = document.getElementById('levelTransitionScreen');
  if (!screen) { if (callback) callback(); return; }

  screen.classList.remove('panels-closed', 'show-content');

  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');

  // Panels slide in
  requestAnimationFrame(() => requestAnimationFrame(() => {
    screen.classList.add('panels-closed');
  }));

  // Show spinner
  setTimeout(() => screen.classList.add('show-content'), 620);

  // Open and launch
  setTimeout(() => {
    screen.classList.remove('show-content');
    setTimeout(() => screen.classList.remove('panels-closed'), 120);
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
  document.getElementById("livesCounter").innerText  = gameState.lives;
  document.getElementById("profileGold").innerText   = gameState.gold;

  const cornerDisk  = document.getElementById("mapCornerLevelDisk");
  const cornerLives = document.getElementById("mapCornerLives");
  if (cornerDisk)  cornerDisk.innerText  = gameState.highestUnlockedLevel;
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

  startSpaceMusic();

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
    alert("You're out of lives! Visit the shop to refill.");
    return;
  }
  playLevelTransition(() => startLevelLogic(gameState.levelPendingStart));
}

function retryCurrentLevel() {
  toggleModal('levelSuccessModal', false);
  playLevelTransition(() => startLevelLogic(gameState.currentLevel));
}

function advanceToNextLevel() {
  toggleModal('levelSuccessModal', false);
  const next = gameState.currentLevel + 1;
  if (next <= gameState.totalLevels && next <= gameState.highestUnlockedLevel) {
    playLevelTransition(() => startLevelLogic(next));
  } else {
    loadHomepage();
  }
}

/* ============================================================
   LEVEL SETUP
   ============================================================ */
function startLevelLogic(lvl) {
  gameState.currentLevel    = lvl;
  gameState.isGameActive    = true;
  gameState.score           = 0;
  gameState.moves           = 20;
  gameState.selectedTile    = null;
  gameState.activeBooster   = null;
  gameState.matchExplosions = [];
  gameState.targetScore     = 400 + (lvl * 60);
  gameState.boosters        = { hammer: 3, bomb: 3, shuffle: 3 };

  const era          = getCurrentEraForLevel(lvl);
  const levelInEra   = lvl - era.startLvl + 1;
  const challengeItem  = era.items[(lvl - 1) % era.items.length];
  const challengeCount = 8 + Math.floor(levelInEra * 1.2);

  gameState.challengeTarget   = { item: challengeItem, count: challengeCount };
  gameState.challengeProgress = 0;

  document.getElementById("activeEraName").innerText   = `Level ${lvl}`;
  document.getElementById("movesDisplay").innerText    = gameState.moves;
  document.getElementById("targetDisplay").innerText   = gameState.targetScore;
  document.getElementById("scoreDisplay").innerText    = 0;

  const banner = document.getElementById("challengeBanner");
  if (banner) banner.innerText = `Clear ${challengeCount} ${challengeItem} to pass!`;

  updateBoosterUI();

  switchView("gamePlayScreen");

  // Resize canvas AFTER the gameplay screen is visible so dimensions are correct
  setTimeout(() => {
    resizeCanvas();
    generateBoard(era.items);
  }, 30);

  maybeShowEraUnlockToast(era);
  startSpaceMusic();
}

function maybeShowEraUnlockToast(era) {
  if (gameState.lastSeenEraName !== era.name) {
    gameState.lastSeenEraName = era.name;
    localStorage.setItem("chrono_last_era", era.name);
    showEraUnlockToast(era.name);
  }
}

function showEraUnlockToast(eraName) {
  const toast  = document.getElementById("eraUnlockToast");
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
  const items = itemSet || getCurrentEraForLevel(gameState.currentLevel).items;
  return items[Math.floor(Math.random() * items.length)];
}

function resolveSilentMatches(itemSet) {
  findBoardMatches().forEach(pos => {
    gameState.grid[pos.r][pos.c] = randomItem(itemSet);
  });
}

/* ============================================================
   RENDER LOOP
   ============================================================ */
function updateAndDrawBoard() {
  if (!canvas || !ctx || !gameState.isGameActive) return;

  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const x = Math.round(c * TILE_PX);
      const y = Math.round(r * TILE_PX);
      const w = Math.round(TILE_PX);

      // Tile background — solid, bright enough to see emojis
      const isEven = (r + c) % 2 === 0;
      ctx.fillStyle = isEven ? '#2e4f65' : '#284758';
      ctx.fillRect(x, y, w, w);

      // Subtle top-left highlight edge
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, w);

      // Grid line
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, w - 1);

      // Selected tile glow
      if (gameState.selectedTile &&
          gameState.selectedTile.r === r &&
          gameState.selectedTile.c === c) {
        ctx.fillStyle = 'rgba(212,175,55,0.40)';
        ctx.fillRect(x, y, w, w);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth   = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, w - 3);
      }

      // Emoji — large, centred, with no extra transforms
      if (gameState.grid[r] && gameState.grid[r][c]) {
        const fontSize = Math.floor(w * 0.56);
        ctx.font          = `${fontSize}px serif`;
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.shadowColor   = 'rgba(0,0,0,0)';  // no shadow — keep crisp
        ctx.shadowBlur    = 0;
        ctx.fillText(
          gameState.grid[r][c],
          x + w / 2,
          y + w / 2 + 1
        );
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
    p.y    += p.vy;
    p.size *= 0.94;
    p.alpha -= 0.04;
    if (p.alpha <= 0) gameState.matchExplosions.splice(i, 1);
  }
}

/* ============================================================
   FIREWORKS
   ============================================================ */
function spawnFireworksBurst() {
  const colors  = ['#ffd700','#ff5e62','#ff9966','#00f2fe','#4facfe','#b19ffb'];
  const centerX = window.innerWidth  / 2;
  const centerY = window.innerHeight / 2;
  for (let b = 0; b < 2; b++) {
    const ox = centerX + (Math.random() * 200 - 100);
    const oy = centerY - (Math.random() * 120);
    for (let i = 0; i < 35; i++) {
      const angle = (Math.PI * 2 / 35) * i + Math.random() * 0.4;
      const speed = 2 + Math.random() * 5;
      fxParticles.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size:  2 + Math.random() * 2,
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
    p.x  += p.vx; p.y += p.vy; p.vy += 0.04; p.alpha -= p.decay;
    if (p.alpha <= 0) { fxParticles.splice(i, 1); continue; }
    fxCtx.save();
    fxCtx.globalAlpha = p.alpha;
    fxCtx.fillStyle   = p.color;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    fxCtx.fill();
    fxCtx.restore();
  }
  if (Math.random() < 0.015 && fxParticles.length < 40) spawnFireworksBurst();
  fxAnimationId = requestAnimationFrame(runFireworksLoop);
}

/* ============================================================
   BOOSTERS
   ============================================================ */
function selectBooster(type) {
  if (!gameState.isGameActive || gameState.boosters[type] <= 0) return;
  gameState.activeBooster = (gameState.activeBooster === type) ? null : type;
  updateBoosterUI();
  if (gameState.activeBooster === 'shuffle') useShuffleBooster();
}

function updateBoosterUI() {
  ['hammer','bomb','shuffle'].forEach(t => {
    const btn = document.getElementById(`booster${t.charAt(0).toUpperCase()+t.slice(1)}Btn`);
    const cnt = document.getElementById(`${t}Count`);
    if (cnt) cnt.innerText = gameState.boosters[t];
    if (btn) {
      btn.classList.toggle('selected', gameState.activeBooster === t);
      btn.disabled = gameState.boosters[t] <= 0;
    }
  });
}

function useShuffleBooster() {
  if (gameState.boosters.shuffle <= 0) return;
  gameState.boosters.shuffle--;
  generateBoard(getCurrentEraForLevel(gameState.currentLevel).items);
  gameState.activeBooster = null;
  triggerVibration(50);
  updateBoosterUI();
}

function useHammerOnTile(r, c) {
  if (gameState.boosters.hammer <= 0) return;
  gameState.boosters.hammer--;
  destroyTile(r, c, getCurrentEraForLevel(gameState.currentLevel).items);
  gameState.activeBooster = null;
  triggerVibration(60);
  updateBoosterUI();
  evaluateBoardAfterAction();
}

function useBombOnTile(r, c) {
  if (gameState.boosters.bomb <= 0) return;
  gameState.boosters.bomb--;
  const era = getCurrentEraForLevel(gameState.currentLevel);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r+dr, nc = c+dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE)
        destroyTile(nr, nc, era.items);
    }
  gameState.activeBooster = null;
  triggerVibration([80,40,80]);
  updateBoosterUI();
  evaluateBoardAfterAction();
}

function destroyTile(r, c, itemSet) {
  if (gameState.grid[r][c] === gameState.challengeTarget?.item) gameState.challengeProgress++;
  spawnExplosionAt(r, c);
  gameState.grid[r][c] = randomItem(itemSet);
}

function spawnExplosionAt(r, c) {
  for (let k = 0; k < 6; k++) {
    gameState.matchExplosions.push({
      x: (c * TILE_PX) + TILE_PX / 2,
      y: (r * TILE_PX) + TILE_PX / 2,
      size: 7, alpha: 1,
      vy: -1 - Math.random() * 2
    });
  }
}

function evaluateBoardAfterAction() {
  document.getElementById("scoreDisplay").innerText = gameState.score;
  checkChallengeAndScore();
}

/* ============================================================
   INPUT
   ============================================================ */
function handleCanvasClick(e) {
  if (!gameState.isGameActive || !canvas) return;
  initAudio();

  const rect   = canvas.getBoundingClientRect();
  const x      = e.clientX - rect.left;
  const y      = e.clientY - rect.top;

  // Scale click from CSS pixels to logical CANVAS_PX space
  const scaleX = CANVAS_PX / rect.width;
  const scaleY = CANVAS_PX / rect.height;

  const c = Math.floor(x * scaleX / TILE_PX);
  const r = Math.floor(y * scaleY / TILE_PX);
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

  if (gameState.activeBooster === 'hammer') { useHammerOnTile(r, c); return; }
  if (gameState.activeBooster === 'bomb')   { useBombOnTile(r, c);   return; }

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
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const v = gameState.grid[r][c];
      if (v && v === gameState.grid[r][c+1] && v === gameState.grid[r][c+2])
        matches.push({r,c},{r,c:c+1},{r,c:c+2});
    }
  for (let c = 0; c < BOARD_SIZE; c++)
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const v = gameState.grid[r][c];
      if (v && v === gameState.grid[r+1][c] && v === gameState.grid[r+2][c])
        matches.push({r,c},{r:r+1,c},{r:r+2,c});
    }
  const seen = new Set();
  return matches.filter(m => {
    const key = `${m.r},${m.c}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function checkChallengeAndScore() {
  const matches = findBoardMatches();
  if (matches.length > 0) {
    gameState.score += matches.length * 50;
    document.getElementById("scoreDisplay").innerText = gameState.score;
    triggerVibration([60,40,60]);
    const era = getCurrentEraForLevel(gameState.currentLevel);
    matches.forEach(pos => {
      const item = gameState.grid[pos.r][pos.c];
      if (gameState.challengeTarget && item === gameState.challengeTarget.item) gameState.challengeProgress++;
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
  banner.innerText = remaining > 0
    ? `Clear ${remaining} more ${gameState.challengeTarget.item} to pass!`
    : `Challenge complete! ${gameState.challengeTarget.item} cleared ✓`;
}

function evaluateLevelEndConditions() {
  const challengeMet = !gameState.challengeTarget || gameState.challengeProgress >= gameState.challengeTarget.count;
  const scoreMet     = gameState.score >= gameState.targetScore;
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
   WIN
   ============================================================ */
function win() {
  gameState.isGameActive = false;
  triggerVibration([100,40,100,40,300]);

  const stars = gameState.score > gameState.targetScore * 1.4 ? 3
              : gameState.score > gameState.targetScore * 1.1 ? 2 : 1;

  gameState.levelRecords[gameState.currentLevel] = stars;
  localStorage.setItem("chrono_level_records", JSON.stringify(gameState.levelRecords));

  gameState.boosters.hammer  += 1;
  gameState.boosters.bomb    += (stars >= 2 ? 1 : 0);
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
   NAV HELPERS
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

function openSettingsModal() { toggleModal('settingsModal', true); }

/* ============================================================
   SETTINGS
   ============================================================ */
function togglePreference(p) {
  gameState.preferences[p] = !gameState.preferences[p];
  localStorage.setItem("chrono_preferences", JSON.stringify(gameState.preferences));
  const btn = document.getElementById(`toggle${p.charAt(0).toUpperCase()+p.slice(1)}Btn`);
  if (btn) {
    btn.classList.toggle('active', gameState.preferences[p]);
    btn.innerText = gameState.preferences[p] ? "ON" : "OFF";
  }
  if (p === 'sound') {
    if (!gameState.preferences.sound) stopSpaceMusic();
    else startSpaceMusic();
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
  if (gameState.gold < cost) { alert("Not enough gold!"); return; }
  gameState.gold -= cost;
  switch (type) {
    case 'lives':   gameState.lives = Math.min(99, gameState.lives + 5); localStorage.setItem("chrono_lives", gameState.lives); break;
    case 'hammer':  gameState.boosters.hammer  += 3; break;
    case 'bomb':    gameState.boosters.bomb    += 3; break;
    case 'shuffle': gameState.boosters.shuffle += 3; break;
    case 'moves':   if (gameState.isGameActive) { gameState.moves += 5; document.getElementById("movesDisplay").innerText = gameState.moves; } break;
    case 'gold':    gameState.gold += 500; break;
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
    navigator.clipboard.writeText(link).then(() => alert("Invite link copied!")).catch(() => alert("Link: " + link));
  } else { alert("Link: " + link); }
}

function shareToFacebook() {
  const link = encodeURIComponent(window.location.href.split('?')[0]);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`, '_blank', 'width=600,height=400');
}
