/* ============================================================
   CHRONOCRUSH — logic.js  (DOM grid, no canvas for game board)
   ============================================================ */

const BOARD_SIZE = 6;

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
  musicSchedulerId: null,
  boosters: { hammer: 3, bomb: 3, shuffle: 3 },
  activeBooster: null,
  challengeTarget: null,
  challengeProgress: 0,
  lastSeenEraName: null
};

// Fireworks
let fxCanvas = null, fxCtx = null, fxParticles = [], fxAnimationId = null;

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

  fxCanvas = document.getElementById("fireworksCanvas");
  if (fxCanvas) fxCtx = fxCanvas.getContext("2d");
  window.addEventListener("resize", resizeFireworksCanvas);

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
  if (fxCanvas) { fxCanvas.width = window.innerWidth; fxCanvas.height = window.innerHeight; }
}

/* ============================================================
   DOM BOARD — build, render, handle clicks
   ============================================================ */
function buildDomBoard() {
  const board = document.getElementById('domBoard');
  if (!board) return;
  board.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = document.createElement('div');
      tile.className = 'board-tile';
      tile.dataset.r = r;
      tile.dataset.c = c;
      tile.addEventListener('click', onTileClick);
      board.appendChild(tile);
    }
  }
  renderBoard();
}

function renderBoard() {
  const board = document.getElementById('domBoard');
  if (!board) return;
  const tiles = board.querySelectorAll('.board-tile');
  tiles.forEach(tile => {
    const r = parseInt(tile.dataset.r);
    const c = parseInt(tile.dataset.c);
    tile.textContent = (gameState.grid[r] && gameState.grid[r][c]) ? gameState.grid[r][c] : '';
    tile.classList.toggle('selected',
      gameState.selectedTile &&
      gameState.selectedTile.r === r &&
      gameState.selectedTile.c === c
    );
  });
}

function onTileClick(e) {
  if (!gameState.isGameActive) return;
  initAudio();

  const tile = e.currentTarget;
  const r = parseInt(tile.dataset.r);
  const c = parseInt(tile.dataset.c);

  if (gameState.activeBooster === 'hammer') { useHammerOnTile(r, c); return; }
  if (gameState.activeBooster === 'bomb')   { useBombOnTile(r, c);   return; }

  if (!gameState.selectedTile) {
    gameState.selectedTile = { r, c };
    triggerVibration(25);
    renderBoard();
  } else {
    const dist = Math.abs(gameState.selectedTile.r - r) + Math.abs(gameState.selectedTile.c - c);
    if (dist === 1) {
      swapTiles(gameState.selectedTile.r, gameState.selectedTile.c, r, c);
    } else {
      gameState.selectedTile = { r, c };
      triggerVibration(25);
      renderBoard();
    }
  }
}

function getTile(r, c) {
  const board = document.getElementById('domBoard');
  return board ? board.querySelector(`[data-r="${r}"][data-c="${c}"]`) : null;
}

function animateMatch(r, c) {
  const tile = getTile(r, c);
  if (!tile) return;
  tile.classList.remove('dropping','swapping');
  tile.classList.add('matched');
}

function animateDrop(r, c) {
  const tile = getTile(r, c);
  if (!tile) return;
  // Remove then re-add to restart animation
  tile.classList.remove('dropping');
  void tile.offsetWidth; // reflow
  tile.classList.add('dropping');
  // Clean up after done
  setTimeout(() => tile.classList.remove('dropping'), 360);
}

function animateSwap(r, c) {
  const tile = getTile(r, c);
  if (!tile) return;
  tile.classList.remove('swapping');
  void tile.offsetWidth;
  tile.classList.add('swapping');
  setTimeout(() => tile.classList.remove('swapping'), 160);
}

/* ============================================================
   SPACE AMBIENT MUSIC
   ============================================================ */
function initAudio() {
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (gameState.audioCtx.state === 'suspended') gameState.audioCtx.resume();
}

function getCurrentEraForLevel(level) {
  return eraTimeline.find(e => level >= e.startLvl && level <= e.endLvl) || eraTimeline[0];
}

let reverbNode = null;
function getReverbNode(ac) {
  if (reverbNode) return reverbNode;
  const len = ac.sampleRate * 3.5;
  const impulse = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  }
  reverbNode = ac.createConvolver();
  reverbNode.buffer = impulse;
  reverbNode.connect(ac.destination);
  return reverbNode;
}

const SPACE_CHORDS = [
  [130.81, 196.00, 246.94, 329.63],
  [146.83, 220.00, 277.18, 369.99],
  [123.47, 185.00, 246.94, 311.13],
  [138.59, 207.65, 261.63, 349.23],
  [110.00, 164.81, 220.00, 293.66],
  [116.54, 174.61, 233.08, 311.13],
];
let chordIndex = 0;

function startSpaceMusic() {
  initAudio();
  if (!gameState.preferences.sound) return;
  if (gameState.musicSchedulerId) return;
  chordIndex = 0;
  scheduleNextChord();
}

function scheduleNextChord() {
  if (!gameState.preferences.sound) return;
  playSpaceChord(SPACE_CHORDS[chordIndex % SPACE_CHORDS.length]);
  chordIndex++;
  gameState.musicSchedulerId = setTimeout(scheduleNextChord, 7000 + Math.random() * 2000);
}

function playSpaceChord(freqs) {
  const ac = gameState.audioCtx;
  if (!ac || ac.state === 'suspended') return;
  const reverb = getReverbNode(ac);
  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(0.055, ac.currentTime + 2.5);
  master.gain.setValueAtTime(0.055, ac.currentTime + 4.5);
  master.gain.linearRampToValueAtTime(0, ac.currentTime + 7.5);
  master.connect(reverb);
  master.connect(ac.destination);
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator(), filt = ac.createBiquadFilter(), gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * (1 + i * 0.0008), ac.currentTime);
    filt.type = "lowpass"; filt.frequency.setValueAtTime(600 + i * 80, ac.currentTime); filt.Q.value = 0.4;
    gain.gain.setValueAtTime(0.18, ac.currentTime);
    osc.connect(filt); filt.connect(gain); gain.connect(master);
    osc.start(); osc.stop(ac.currentTime + 8);
    const osc2 = ac.createOscillator(), gain2 = ac.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * (1 - 0.0015), ac.currentTime);
    gain2.gain.setValueAtTime(0.06, ac.currentTime);
    osc2.connect(gain2); gain2.connect(master);
    osc2.start(); osc2.stop(ac.currentTime + 8);
  });
  const sub = ac.createOscillator(), subG = ac.createGain(), subF = ac.createBiquadFilter();
  sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] / 2, ac.currentTime);
  subF.type = "lowpass"; subF.frequency.setValueAtTime(120, ac.currentTime);
  subG.gain.setValueAtTime(0, ac.currentTime);
  subG.gain.linearRampToValueAtTime(0.08, ac.currentTime + 3);
  subG.gain.linearRampToValueAtTime(0, ac.currentTime + 7.5);
  sub.connect(subF); subF.connect(subG); subG.connect(ac.destination);
  sub.start(); sub.stop(ac.currentTime + 8);
  if (Math.random() < 0.45) {
    const shim = ac.createOscillator(), shimG = ac.createGain();
    shim.type = "sine"; shim.frequency.setValueAtTime(freqs[freqs.length-1]*2, ac.currentTime+1.5);
    shimG.gain.setValueAtTime(0, ac.currentTime+1.5);
    shimG.gain.linearRampToValueAtTime(0.022, ac.currentTime+2.2);
    shimG.gain.linearRampToValueAtTime(0, ac.currentTime+4.5);
    shim.connect(shimG); shimG.connect(reverb);
    shim.start(ac.currentTime+1.5); shim.stop(ac.currentTime+5);
  }
}

function stopSpaceMusic() {
  if (gameState.musicSchedulerId) { clearTimeout(gameState.musicSchedulerId); gameState.musicSchedulerId = null; }
}

function startEraMusic() { startSpaceMusic(); }
function stopEraMusic()  { stopSpaceMusic();  }

function triggerVibration(pattern) {
  if (gameState.preferences.vibe && navigator.vibrate) navigator.vibrate(pattern);
}

/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */
function switchView(id) {
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
}

/* ============================================================
   LEVEL TRANSITION
   ============================================================ */
function playLevelTransition(callback) {
  const screen = document.getElementById('levelTransitionScreen');
  if (!screen) { if (callback) callback(); return; }
  screen.classList.remove('panels-closed','show-content');
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
  requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('panels-closed')));
  setTimeout(() => screen.classList.add('show-content'), 620);
  setTimeout(() => {
    screen.classList.remove('show-content');
    setTimeout(() => screen.classList.remove('panels-closed'), 120);
    setTimeout(() => { screen.classList.remove('active'); if (callback) callback(); }, 700);
  }, 1350);
}

/* ============================================================
   HOME / MAP
   ============================================================ */
function loadHomepage() {
  switchView("homePage");
  document.getElementById("livesCounter").innerText = gameState.lives;
  document.getElementById("profileGold").innerText  = gameState.gold;
  const cd = document.getElementById("mapCornerLevelDisk");
  const cl = document.getElementById("mapCornerLives");
  if (cd) cd.innerText = gameState.highestUnlockedLevel;
  if (cl) cl.innerText = gameState.lives;

  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = "";
  const align = ["mid","left","mid","right"];

  eraTimeline.forEach(era => {
    const banner = document.createElement("div");
    banner.className = "era-header-banner";
    banner.innerHTML = `${era.name.toUpperCase()}<span class="era-sub">Levels ${era.startLvl}–${era.endLvl}</span>`;
    mapLayer.appendChild(banner);
    for (let i = era.startLvl; i <= era.endLvl; i++) {
      const row = document.createElement("div");
      row.className = `map-row ${align[i % 4]}`;
      const btn = document.createElement("button");
      let sc = '';
      if (i === gameState.highestUnlockedLevel) sc = 'active';
      else if (i < gameState.highestUnlockedLevel) sc = 'unlocked';
      btn.className = `level-node ${sc}`;
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
    const an = mapLayer.querySelector('.level-node.active');
    if (an) an.scrollIntoView({ block: 'center', behavior: 'auto' });
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
    if (id === 'levelSuccessModal') { resizeFireworksCanvas(); spawnFireworksBurst(); runFireworksLoop(); }
  } else {
    m.classList.remove('visible');
    if (id === 'levelSuccessModal') { cancelAnimationFrame(fxAnimationId); fxParticles = []; }
  }
}

function confirmAndStartLevel() {
  toggleModal('levelReadyModal', false);
  if (gameState.lives <= 0) { alert("You're out of lives! Visit the shop to refill."); return; }
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
  } else { loadHomepage(); }
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
  gameState.targetScore     = 400 + lvl * 60;
  gameState.boosters        = { hammer: 3, bomb: 3, shuffle: 3 };

  const era = getCurrentEraForLevel(lvl);
  const levelInEra = lvl - era.startLvl + 1;
  const challengeItem  = era.items[(lvl - 1) % era.items.length];
  const challengeCount = 8 + Math.floor(levelInEra * 1.2);
  gameState.challengeTarget   = { item: challengeItem, count: challengeCount };
  gameState.challengeProgress = 0;

  document.getElementById("activeEraName").innerText = `Level ${lvl}`;
  document.getElementById("movesDisplay").innerText  = gameState.moves;
  document.getElementById("targetDisplay").innerText = gameState.targetScore;
  document.getElementById("scoreDisplay").innerText  = 0;
  const banner = document.getElementById("challengeBanner");
  if (banner) banner.innerText = `Clear ${challengeCount} ${challengeItem} to pass!`;

  updateBoosterUI();
  switchView("gamePlayScreen");
  generateBoard(era.items);
  buildDomBoard();

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
  triggerVibration([60,30,60]);
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
    resolveSilentMatches(itemSet); guard++;
  }
}

function randomItem(itemSet) {
  const items = itemSet || getCurrentEraForLevel(gameState.currentLevel).items;
  return items[Math.floor(Math.random() * items.length)];
}

function resolveSilentMatches(itemSet) {
  findBoardMatches().forEach(pos => { gameState.grid[pos.r][pos.c] = randomItem(itemSet); });
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
    if (btn) { btn.classList.toggle('selected', gameState.activeBooster === t); btn.disabled = gameState.boosters[t] <= 0; }
  });
}

function useShuffleBooster() {
  if (gameState.boosters.shuffle <= 0) return;
  gameState.boosters.shuffle--;
  generateBoard(getCurrentEraForLevel(gameState.currentLevel).items);
  gameState.activeBooster = null;
  triggerVibration(50);
  updateBoosterUI();
  renderBoard();
}

function useHammerOnTile(r, c) {
  if (gameState.boosters.hammer <= 0) return;
  gameState.boosters.hammer--;
  const era = getCurrentEraForLevel(gameState.currentLevel);
  destroyTile(r, c, era.items);
  gameState.activeBooster = null;
  triggerVibration(60);
  updateBoosterUI();
  setTimeout(() => cascadeColumns(era.items), 270);
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
  setTimeout(() => cascadeColumns(era.items), 270);
}

function destroyTile(r, c, itemSet) {
  if (gameState.grid[r][c] === gameState.challengeTarget?.item) gameState.challengeProgress++;
  animateMatch(r, c);
  gameState.grid[r][c] = null;
}

/* ============================================================
   SWAP + MATCH
   ============================================================ */
function swapTiles(r1, c1, r2, c2) {
  const tmp = gameState.grid[r1][c1];
  gameState.grid[r1][c1] = gameState.grid[r2][c2];
  gameState.grid[r2][c2] = tmp;
  gameState.moves--;
  document.getElementById("movesDisplay").innerText = gameState.moves;
  triggerVibration(40);
  gameState.selectedTile = null;
  renderBoard();
  animateSwap(r1, c1);
  animateSwap(r2, c2);
  setTimeout(checkChallengeAndScore, 180);
}

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

/* ── Core cascade loop ────────────────────────────────────────────────────
   1. Find matches → flash them gold → shrink to nothing  (250ms)
   2. Drop existing tiles down to fill gaps               (320ms)
   3. Drop new tiles in from above                        (320ms)
   4. Check for new matches (chain reaction)              (loop)
   ──────────────────────────────────────────────────────────────────── */
function checkChallengeAndScore() {
  const matches = findBoardMatches();
  if (matches.length === 0) { evaluateLevelEndConditions(); return; }

  // Score + challenge tracking
  gameState.score += matches.length * 50;
  document.getElementById("scoreDisplay").innerText = gameState.score;
  triggerVibration([60, 40, 60]);

  const era = getCurrentEraForLevel(gameState.currentLevel);
  const matchedSet = new Set();

  matches.forEach(pos => {
    const key = `${pos.r},${pos.c}`;
    if (matchedSet.has(key)) return;
    matchedSet.add(key);
    if (gameState.challengeTarget && gameState.grid[pos.r][pos.c] === gameState.challengeTarget.item)
      gameState.challengeProgress++;
    // 1. Flash + shrink animation
    animateMatch(pos.r, pos.c);
    // Mark grid cell as empty
    gameState.grid[pos.r][pos.c] = null;
  });

  updateChallengeBanner();

  // 2. After match animation: cascade columns down, then refill from top
  setTimeout(() => {
    cascadeColumns(era.items);
  }, 270);
}

function cascadeColumns(itemSet) {
  // For each column, compact non-null tiles to the bottom, fill top with new
  for (let c = 0; c < BOARD_SIZE; c++) {
    // Collect surviving tiles bottom-up
    const surviving = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      if (gameState.grid[r][c] !== null) surviving.push(gameState.grid[r][c]);
    }
    // How many new tiles needed
    const needed = BOARD_SIZE - surviving.length;
    // Fill from bottom: surviving first, then new items on top
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const idx = BOARD_SIZE - 1 - r; // 0 = bottom row
      if (idx < surviving.length) {
        gameState.grid[r][c] = surviving[idx];
      } else {
        gameState.grid[r][c] = randomItem(itemSet);
      }
    }
  }

  // Render the new grid state, then play drop animations on changed tiles
  renderBoard();

  // Animate every tile with a staggered drop — feels like they fall from above
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = getTile(r, c);
      if (!tile) continue;
      // Stagger by row (top rows fall furthest, slight delay per row)
      const delay = r * 28;
      setTimeout(() => animateDrop(r, c), delay);
    }
  }

  // Check for chain matches after tiles have settled
  setTimeout(checkChallengeAndScore, 420);
}

function afterMatch() {
  document.getElementById("scoreDisplay").innerText = gameState.score;
  setTimeout(checkChallengeAndScore, 250);
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
  if (challengeMet && scoreMet) { setTimeout(win, 400); return; }
  if (gameState.moves <= 0) {
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
   FIREWORKS
   ============================================================ */
function spawnFireworksBurst() {
  const colors = ['#ffd700','#ff5e62','#ff9966','#00f2fe','#4facfe','#b19ffb'];
  const cx = window.innerWidth/2, cy = window.innerHeight/2;
  for (let b = 0; b < 2; b++) {
    const ox = cx+(Math.random()*200-100), oy = cy-(Math.random()*120);
    for (let i = 0; i < 35; i++) {
      const angle = (Math.PI*2/35)*i+Math.random()*0.4, speed = 2+Math.random()*5;
      fxParticles.push({ x:ox,y:oy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        size:2+Math.random()*2, color:colors[Math.floor(Math.random()*colors.length)], alpha:1, decay:0.015+Math.random()*0.015 });
    }
  }
}

function runFireworksLoop() {
  if (!fxCtx) return;
  fxCtx.clearRect(0,0,fxCanvas.width,fxCanvas.height);
  for (let i = fxParticles.length-1; i >= 0; i--) {
    const p = fxParticles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.04; p.alpha-=p.decay;
    if (p.alpha<=0) { fxParticles.splice(i,1); continue; }
    fxCtx.save(); fxCtx.globalAlpha=p.alpha; fxCtx.fillStyle=p.color;
    fxCtx.beginPath(); fxCtx.arc(p.x,p.y,p.size,0,Math.PI*2); fxCtx.fill(); fxCtx.restore();
  }
  if (Math.random()<0.015 && fxParticles.length<40) spawnFireworksBurst();
  fxAnimationId = requestAnimationFrame(runFireworksLoop);
}

/* ============================================================
   NAV
   ============================================================ */
function exitToHome() { gameState.isGameActive=false; gameState.activeBooster=null; loadHomepage(); }
function transitionToMap() { initAudio(); triggerFlashAnimation(); loadHomepage(); }
function handleAuth() { initAudio(); triggerFlashAnimation(); switchView("welcomeScreen"); }
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
  if (btn) { btn.classList.toggle('active', gameState.preferences[p]); btn.innerText = gameState.preferences[p] ? "ON" : "OFF"; }
  if (p === 'sound') { if (!gameState.preferences.sound) stopSpaceMusic(); else startSpaceMusic(); }
}

function resetGameProgress() {
  if (confirm("This will erase all progress, gold, and lives. Continue?")) { localStorage.clear(); location.reload(); }
}

/* ============================================================
   SHOP
   ============================================================ */
function buyItem(type, cost) {
  if (gameState.gold < cost) { alert("Not enough gold!"); return; }
  gameState.gold -= cost;
  switch(type) {
    case 'lives':   gameState.lives=Math.min(99,gameState.lives+5); localStorage.setItem("chrono_lives",gameState.lives); break;
    case 'hammer':  gameState.boosters.hammer+=3; break;
    case 'bomb':    gameState.boosters.bomb+=3; break;
    case 'shuffle': gameState.boosters.shuffle+=3; break;
    case 'moves':   if(gameState.isGameActive){gameState.moves+=5;document.getElementById("movesDisplay").innerText=gameState.moves;} break;
    case 'gold':    gameState.gold+=500; break;
  }
  localStorage.setItem("chrono_gold",gameState.gold);
  document.getElementById("profileGold").innerText=gameState.gold;
  updateBoosterUI(); triggerVibration(40);
}

/* ============================================================
   FRIENDS
   ============================================================ */
function copyInviteLink() {
  const link = window.location.href.split('?')[0];
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(()=>alert("Copied!")).catch(()=>alert("Link: "+link));
  else alert("Link: "+link);
}
function shareToFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href.split('?')[0])}`, '_blank', 'width=600,height=400');
}
