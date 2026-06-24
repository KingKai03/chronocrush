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
      board.appendChild(tile);
    }
  }
  // Attach swipe handler to the board container (one handler, not 36)
  attachSwipeHandler(board);
  renderBoard();
}

/* ── Swipe / drag handler ───────────────────────────────────────────────────
   Tracks touchstart / mousedown as the origin tile, then on touchend /
   mouseup works out the swipe direction and triggers the swap.
   A tap (no movement) still works for booster targeting.
──────────────────────────────────────────────────────────────────────────── */
let swipeOrigin = null;   // { r, c, x, y }

function attachSwipeHandler(board) {
  // ── Touch ────────────────────────────────────────────────────────────────
  board.addEventListener('touchstart', (e) => {
    if (!gameState.isGameActive) return;
    const touch = e.touches[0];
    const tile  = tileFromPoint(touch.clientX, touch.clientY);
    if (!tile) return;
    swipeOrigin = { r: tile.r, c: tile.c, x: touch.clientX, y: touch.clientY };
    // Highlight origin tile immediately
    highlightTile(tile.r, tile.c);
  }, { passive: true });

  board.addEventListener('touchend', (e) => {
    if (!gameState.isGameActive || !swipeOrigin) return;
    const touch = e.changedTouches[0];
    handleSwipeEnd(touch.clientX, touch.clientY);
  }, { passive: true });

  board.addEventListener('touchcancel', () => { swipeOrigin = null; clearHighlight(); });

  // ── Mouse (desktop) ──────────────────────────────────────────────────────
  board.addEventListener('mousedown', (e) => {
    if (!gameState.isGameActive) return;
    const tile = tileFromPoint(e.clientX, e.clientY);
    if (!tile) return;
    swipeOrigin = { r: tile.r, c: tile.c, x: e.clientX, y: e.clientY };
    highlightTile(tile.r, tile.c);
  });

  window.addEventListener('mouseup', (e) => {
    if (!swipeOrigin) return;
    handleSwipeEnd(e.clientX, e.clientY);
  });
}

function tileFromPoint(clientX, clientY) {
  const board = document.getElementById('domBoard');
  if (!board) return null;
  const rect  = board.getBoundingClientRect();
  const gap   = 3; // matches CSS gap
  const cellW = (rect.width  - 16 - gap * (BOARD_SIZE - 1)) / BOARD_SIZE;
  const cellH = (rect.height - 16 - gap * (BOARD_SIZE - 1)) / BOARD_SIZE;
  const relX  = clientX - rect.left - 8;
  const relY  = clientY - rect.top  - 8;
  const c = Math.floor(relX / (cellW + gap));
  const r = Math.floor(relY / (cellH + gap));
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
  return { r, c };
}

function highlightTile(r, c) {
  clearHighlight();
  const tile = getTile(r, c);
  if (tile) tile.classList.add('selected');
}

function clearHighlight() {
  document.querySelectorAll('.board-tile.selected').forEach(t => t.classList.remove('selected'));
}

function handleSwipeEnd(endX, endY) {
  if (!swipeOrigin) return;
  initAudio();

  const { r, c, x: startX, y: startY } = swipeOrigin;
  swipeOrigin = null;
  clearHighlight();

  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const SWIPE_THRESHOLD = 18; // px — minimum movement to count as a swipe

  // Booster tap (no meaningful movement)
  if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
    if (gameState.activeBooster === 'hammer') { useHammerOnTile(r, c); return; }
    if (gameState.activeBooster === 'bomb')   { useBombOnTile(r, c);   return; }
    return; // plain tap — no action without a booster
  }

  // Determine swipe direction
  let tr = r, tc = c;
  if (absDx > absDy) {
    tc = dx > 0 ? c + 1 : c - 1; // horizontal
  } else {
    tr = dy > 0 ? r + 1 : r - 1; // vertical
  }

  // Bounds check
  if (tr < 0 || tr >= BOARD_SIZE || tc < 0 || tc >= BOARD_SIZE) return;

  swapTiles(r, c, tr, tc);
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

// onTileClick replaced by swipe handler — see attachSwipeHandler()

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
  checkDailyBadge();
  checkNewsBadge();
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
/* ── Difficulty curve ────────────────────────────────────────────────────────
   Levels  1–9  : Tutorial-easy.  Generous moves, low targets, tiny challenge.
   Levels 10–49 : Easy→Medium.    Gradually tighten moves & raise score target.
   Levels 50–70 : Medium→Hard.    Fewer moves, much higher targets, bigger challenge.
──────────────────────────────────────────────────────────────────────────── */
function getDifficulty(lvl) {
  if (lvl <= 9) {
    return {
      moves:          28,
      targetScore:    300 + lvl * 30,          // 330 – 570
      challengeCount: 5 + Math.floor(lvl * 0.5), // 5 – 9
      boosters:       { hammer: 5, bomb: 4, shuffle: 4 }
    };
  }
  if (lvl <= 49) {
    // Linear ramp: moves 25→18, target 600→2400, challenge 10→18
    const t = (lvl - 10) / 39; // 0→1
    return {
      moves:          Math.round(25 - t * 7),
      targetScore:    Math.round(600  + t * 1800),
      challengeCount: Math.round(10   + t * 8),
      boosters:       { hammer: 3, bomb: 3, shuffle: 3 }
    };
  }
  // Hard (50–70): moves 17→12, target 2600→5000, challenge 19→28
  const t = (lvl - 50) / 20; // 0→1
  return {
    moves:          Math.round(17 - t * 5),
    targetScore:    Math.round(2600 + t * 2400),
    challengeCount: Math.round(19   + t * 9),
    boosters:       { hammer: 2, bomb: 2, shuffle: 2 }
  };
}

function startLevelLogic(lvl) {
  gameState.currentLevel    = lvl;
  gameState.isGameActive    = true;
  gameState.score           = 0;
  gameState.selectedTile    = null;
  gameState.activeBooster   = null;

  const diff = getDifficulty(lvl);
  gameState.moves       = diff.moves;
  gameState.targetScore = diff.targetScore;
  gameState.boosters    = { ...diff.boosters };

  const era = getCurrentEraForLevel(lvl);
  const challengeItem  = era.items[(lvl - 1) % era.items.length];
  gameState.challengeTarget   = { item: challengeItem, count: diff.challengeCount };
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
  setTimeout(() => refillDestroyedTiles([{r, c}], era.items), 280);
}

function useBombOnTile(r, c) {
  if (gameState.boosters.bomb <= 0) return;
  gameState.boosters.bomb--;
  const era = getCurrentEraForLevel(gameState.currentLevel);
  const destroyed = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r+dr, nc = c+dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        destroyTile(nr, nc, era.items);
        destroyed.push({r: nr, c: nc});
      }
    }
  gameState.activeBooster = null;
  triggerVibration([80,40,80]);
  updateBoosterUI();
  setTimeout(() => refillDestroyedTiles(destroyed, era.items), 280);
}

function refillDestroyedTiles(positions, itemSet) {
  positions.forEach(pos => {
    gameState.grid[pos.r][pos.c] = randomItem(itemSet);
    const tile = getTile(pos.r, pos.c);
    if (tile) {
      tile.classList.remove('matched');
      tile.textContent = gameState.grid[pos.r][pos.c];
      animateDrop(pos.r, pos.c);
    }
  });
  setTimeout(checkChallengeAndScore, 360);
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

  const era = getCurrentEraForLevel(gameState.currentLevel);

  // De-dupe matched positions
  const matchedSet = new Set();
  const matchedPositions = [];
  matches.forEach(pos => {
    const key = `${pos.r},${pos.c}`;
    if (matchedSet.has(key)) return;
    matchedSet.add(key);
    matchedPositions.push(pos);
  });

  // Score + challenge tracking
  gameState.score += matchedPositions.length * 50;
  document.getElementById("scoreDisplay").innerText = gameState.score;
  triggerVibration([60, 40, 60]);

  matchedPositions.forEach(pos => {
    if (gameState.challengeTarget && gameState.grid[pos.r][pos.c] === gameState.challengeTarget.item)
      gameState.challengeProgress++;
    // Flash + shrink just those tiles
    animateMatch(pos.r, pos.c);
  });

  updateChallengeBanner();

  // After vanish animation: refill only the matched cells in place
  setTimeout(() => {
    matchedPositions.forEach(pos => {
      gameState.grid[pos.r][pos.c] = randomItem(era.items);
      const tile = getTile(pos.r, pos.c);
      if (tile) {
        tile.classList.remove('matched');
        tile.textContent = gameState.grid[pos.r][pos.c];
        animateDrop(pos.r, pos.c);
      }
    });
    // Check for new matches after refill settles
    setTimeout(checkChallengeAndScore, 360);
  }, 280);
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
  trackDailyWin();

  // Check if this win just completed an entire era — show trophy modal after success
  const justCompletedEra = checkEraCompletion(gameState.currentLevel);

  switchView("homePage");
  toggleModal('levelSuccessModal', true);

  // If era completed, queue the trophy reveal after a short delay so success modal shows first
  if (justCompletedEra) {
    setTimeout(() => {
      toggleModal('levelSuccessModal', false);
      showEraTrophyModal(justCompletedEra);
    }, 2200);
  }
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


/* ============================================================
   AWARDS PAGE
   ============================================================ */

// Trophy tier based on average stars across all levels in an era
function getEraTrophy(era) {
  const levelRecords = gameState.levelRecords;
  let totalStars = 0;
  let completedLevels = 0;

  for (let lvl = era.startLvl; lvl <= era.endLvl; lvl++) {
    if (levelRecords[lvl]) {
      totalStars += levelRecords[lvl];
      completedLevels++;
    }
  }

  const totalLevels = era.endLvl - era.startLvl + 1;
  if (completedLevels < totalLevels) return { tier: 'locked', completedLevels, totalLevels, totalStars };

  const avgStars = totalStars / totalLevels;
  if (avgStars >= 2.5) return { tier: 'gold',   completedLevels, totalLevels, totalStars };
  if (avgStars >= 1.8) return { tier: 'silver', completedLevels, totalLevels, totalStars };
  return                      { tier: 'bronze', completedLevels, totalLevels, totalStars };
}

const ERA_ICONS = ['🎷','🎸','☮️','🪩','🎮','📀','💿'];
const TROPHY_ICONS = { gold: '🥇', silver: '🥈', bronze: '🥉', locked: '🔒' };
const TROPHY_LABELS = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', locked: 'LOCKED' };

function openAwardsPage() {
  const body = document.getElementById('awardsBody');
  if (!body) return;

  let html = `<p class="awards-intro">Complete all 10 levels of an era to earn a trophy.<br>Higher average stars = better trophy.</p>`;
  html += `<div class="era-trophy-grid">`;

  eraTimeline.forEach((era, idx) => {
    const result = getEraTrophy(era);
    const { tier, completedLevels, totalLevels, totalStars } = result;
    const pct = Math.round((completedLevels / totalLevels) * 100);

    // Star display
    const maxStars = totalLevels * 3;
    const starPct = tier !== 'locked' ? Math.round((totalStars / maxStars) * 100) : Math.round((completedLevels / totalLevels) * 100);

    let starsHtml = '';
    if (tier !== 'locked') {
      const avg = totalStars / totalLevels;
      const fullStars = Math.floor(avg);
      starsHtml = '📀'.repeat(fullStars) + (avg % 1 >= 0.5 ? '⭐' : '') ;
    }

    html += `
      <div class="era-trophy-card trophy-${tier}">
        <div class="trophy-icon-wrap">${ERA_ICONS[idx]}</div>
        <div class="trophy-info">
          <h3>${era.name}</h3>
          <div class="trophy-sub">Levels ${era.startLvl}–${era.endLvl}</div>
          ${tier !== 'locked'
            ? `<div class="trophy-stars">${starsHtml} &nbsp;<span style="font-size:0.68rem;color:var(--text-dim)">${totalStars}/${maxStars} stars</span></div>`
            : `<div class="trophy-level-progress">
                <span style="font-size:0.68rem;color:var(--text-dim)">${completedLevels}/${totalLevels} levels complete</span>
                <div class="trophy-level-bar-wrap"><div class="trophy-level-bar-fill" style="width:${pct}%"></div></div>
               </div>`
          }
        </div>
        <div>
          <div style="font-size:1.6rem;text-align:center">${TROPHY_ICONS[tier]}</div>
          <div class="trophy-badge-label">${TROPHY_LABELS[tier]}</div>
        </div>
      </div>`;
  });

  html += `</div>`;
  body.innerHTML = html;
  switchView('awardsPage');
}

/* ============================================================
   DAILY CHALLENGE PAGE
   ============================================================ */

// Seed daily challenges from the date so everyone gets the same ones each day
function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRand(seed, n) {
  // Simple LCG
  const val = ((seed * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  return val % n;
}

function getDailyTasks() {
  const seed = getDailySeed();
  const currentEra = getCurrentEraForLevel(gameState.highestUnlockedLevel);
  const eraIdx = eraTimeline.indexOf(currentEra);

  // Task 1: Complete current era (big challenge)
  const eraResult = getEraTrophy(currentEra);
  const eraComplete = eraResult.tier !== 'locked';

  // Task 2: Win any 3 levels today
  const dailyWinsKey = `chrono_daily_wins_${getDailySeed()}`;
  const dailyWins = parseInt(localStorage.getItem(dailyWinsKey)) || 0;

  // Task 3: Get a 3-star on a specific level (seeded to today)
  const targetLvl = currentEra.startLvl + seededRand(seed, 10);
  const has3Star  = (gameState.levelRecords[targetLvl] || 0) >= 3;

  return [
    {
      id: 'complete_era',
      icon: ERA_ICONS[eraIdx] || '🎯',
      title: `Complete: ${currentEra.name}`,
      desc: `Finish all 10 levels of the ${currentEra.name} era`,
      reward: '🥇 Gold Trophy',
      rewardKey: 'trophy',
      done: eraComplete,
      progress: eraResult.completedLevels,
      total: 10
    },
    {
      id: 'win_3_levels',
      icon: '🎮',
      title: 'Win 3 Levels Today',
      desc: 'Complete any 3 levels before midnight',
      reward: '🪙 +60 Gold',
      rewardKey: 'gold_60',
      done: dailyWins >= 3,
      progress: Math.min(dailyWins, 3),
      total: 3
    },
    {
      id: 'three_star',
      icon: '📀',
      title: `3-Star Level ${targetLvl}`,
      desc: `Score high enough to earn 3 stars on Level ${targetLvl}`,
      reward: '🪙 +40 Gold',
      rewardKey: 'gold_40',
      done: has3Star,
      progress: has3Star ? 1 : 0,
      total: 1
    }
  ];
}

function msUntilMidnight() {
  const now  = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

function formatTimeLeft(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function openDailyChallenge() {
  const body  = document.getElementById('dailyChallengeBody');
  if (!body) return;

  const tasks   = getDailyTasks();
  const timeLeft = msUntilMidnight();
  const currentEra = getCurrentEraForLevel(gameState.highestUnlockedLevel);

  let html = `
    <div class="daily-hero">
      <div class="daily-era-icon">${ERA_ICONS[eraTimeline.indexOf(currentEra)]}</div>
      <div class="daily-title">Today's Challenge</div>
      <div class="daily-era-name">${currentEra.name}</div>
      <div class="daily-desc">Complete today's missions to earn trophies and gold.<br>Challenges reset daily.</div>
    </div>
    <div class="daily-reset-timer">Resets in <span>${formatTimeLeft(timeLeft)}</span></div>
    <div class="daily-tasks-list">`;

  tasks.forEach(task => {
    const pct = Math.round((task.progress / task.total) * 100);
    html += `
      <div class="daily-task-card ${task.done ? 'task-done' : ''}">
        <div class="task-icon">${task.icon}</div>
        <div class="task-info">
          <h3>${task.title}</h3>
          <p>${task.desc}</p>
          <div class="daily-progress-bar-wrap">
            <div class="daily-progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <p style="font-size:0.65rem;margin-top:4px;color:var(--text-dim)">${task.progress} / ${task.total}</p>
        </div>
        <div class="task-reward">${task.reward}</div>
      </div>`;
  });

  html += `</div>`;
  body.innerHTML = html;

  // Show/hide red dot badge on footer
  const allDone = tasks.every(t => t.done);
  const badge   = document.getElementById('dailyBadge');
  if (badge) badge.style.display = allDone ? 'none' : 'block';

  switchView('dailyPage');
}

// Call this after every level win to track daily wins
function trackDailyWin() {
  const key = `chrono_daily_wins_${getDailySeed()}`;
  const wins = (parseInt(localStorage.getItem(key)) || 0) + 1;
  localStorage.setItem(key, wins);

  // Auto-reward gold for daily win task completion
  if (wins === 3) {
    gameState.gold += 60;
    localStorage.setItem("chrono_gold", gameState.gold);
  }
}

// Check if daily badge should show on load
function checkDailyBadge() {
  const tasks  = getDailyTasks();
  const allDone = tasks.every(t => t.done);
  const badge  = document.getElementById('dailyBadge');
  if (badge) badge.style.display = allDone ? 'none' : 'block';
}

/* ============================================================
   ERA TROPHY MODAL
   ============================================================ */

// Returns the era object if completing `level` just finished that era, else null
function checkEraCompletion(level) {
  const era = getCurrentEraForLevel(level);
  if (!era) return null;
  // Only fires when the player just completed the LAST level of the era
  if (level !== era.endLvl) return null;
  // Verify all levels in era now have a record
  for (let lvl = era.startLvl; lvl <= era.endLvl; lvl++) {
    if (!gameState.levelRecords[lvl]) return null;
  }
  return era;
}

let trophyFxCanvas = null, trophyFxCtx = null, trophyFxId = null, trophyFxParticles = [];

function showEraTrophyModal(era) {
  const result = getEraTrophy(era);
  const { tier, totalStars } = result;
  const maxStars = (era.endLvl - era.startLvl + 1) * 3;
  const eraIdx   = eraTimeline.indexOf(era);

  const trophyIcon = { gold: '🥇', silver: '🥈', bronze: '🥉' }[tier] || '🏆';
  const tierLabel  = { gold: 'GOLD TROPHY', silver: 'SILVER TROPHY', bronze: 'BRONZE TROPHY' }[tier] || 'TROPHY';
  const tierMsg    = {
    gold:   'Incredible! A flawless run through the era — you\'ve earned gold!',
    silver: 'Well played! A solid performance across the entire era earns you silver!',
    bronze: 'You did it! Every level conquered earns you the bronze trophy!'
  }[tier] || 'Era complete!';

  const starDisplay = '📀'.repeat(Math.floor(totalStars / (era.endLvl - era.startLvl + 1)));

  // Update modal content
  const card = document.getElementById('eraTrophyCard');
  card.className = `era-trophy-modal-card card-${tier}`;
  document.getElementById('eraTrophyIcon').textContent  = trophyIcon;
  document.getElementById('eraTrophyTier').textContent  = tierLabel;
  document.getElementById('eraTrophyEra').textContent   = era.name;
  document.getElementById('eraTrophyMsg').textContent   = tierMsg;
  document.getElementById('eraTrophyStars').textContent = `${starDisplay}  ${totalStars}/${maxStars} stars`;

  // Setup fireworks canvas
  trophyFxCanvas = document.getElementById('trophyFireworksCanvas');
  if (trophyFxCanvas) {
    trophyFxCanvas.width  = window.innerWidth;
    trophyFxCanvas.height = window.innerHeight;
    trophyFxCtx = trophyFxCanvas.getContext('2d');
  }

  toggleModal('eraTrophyModal', true);
  triggerVibration([150, 60, 150, 60, 400]);

  // Start trophy fireworks
  trophyFxParticles = [];
  spawnTrophyBurst(tier);
  runTrophyFireworks();
}

function closeTrophyModal() {
  toggleModal('eraTrophyModal', false);
  cancelAnimationFrame(trophyFxId);
  trophyFxParticles = [];
  loadHomepage();
}

function spawnTrophyBurst(tier) {
  const colorMap = {
    gold:   ['#ffd700','#ffe066','#fff0a0','#d4af37','#ffec6e'],
    silver: ['#b8c0cc','#d8e0e8','#8a9da8','#ffffff','#c0d0dc'],
    bronze: ['#cd7f32','#e8a060','#a05828','#f0b878','#d09050']
  };
  const colors = colorMap[tier] || colorMap.gold;
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.4;

  for (let b = 0; b < 4; b++) {
    const ox = cx + (Math.random() * 260 - 130);
    const oy = cy + (Math.random() * 120 - 60);
    for (let i = 0; i < 45; i++) {
      const angle = (Math.PI * 2 / 45) * i + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 6;
      trophyFxParticles.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size:  1.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.012 + Math.random() * 0.012
      });
    }
  }
}

function runTrophyFireworks() {
  if (!trophyFxCtx) return;
  trophyFxCtx.clearRect(0, 0, trophyFxCanvas.width, trophyFxCanvas.height);
  for (let i = trophyFxParticles.length - 1; i >= 0; i--) {
    const p = trophyFxParticles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.alpha -= p.decay;
    if (p.alpha <= 0) { trophyFxParticles.splice(i, 1); continue; }
    trophyFxCtx.save();
    trophyFxCtx.globalAlpha = p.alpha;
    trophyFxCtx.fillStyle   = p.color;
    trophyFxCtx.beginPath();
    trophyFxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    trophyFxCtx.fill();
    trophyFxCtx.restore();
  }
  // Respawn bursts periodically while modal is open
  if (Math.random() < 0.025 && trophyFxParticles.length < 80) {
    const modal = document.getElementById('eraTrophyModal');
    if (modal && modal.classList.contains('visible')) {
      const tier = document.getElementById('eraTrophyCard').className.includes('gold') ? 'gold'
                 : document.getElementById('eraTrophyCard').className.includes('silver') ? 'silver' : 'bronze';
      spawnTrophyBurst(tier);
    }
  }
  trophyFxId = requestAnimationFrame(runTrophyFireworks);
}

/* ============================================================
   ANNOUNCEMENTS PAGE
   ============================================================ */

// Hardcoded announcements — update this array as the game evolves
const ANNOUNCEMENTS = [
  {
    id: 'ann_001',
    tag: 'feature',
    tagLabel: 'NEW FEATURE',
    title: '🏆 Era Trophies Are Live!',
    body: 'Complete all 10 levels of any era to earn a Gold, Silver, or Bronze trophy. The higher your average stars, the shinier your reward. Check your trophy cabinet in the Awards tab.',
    date: 'June 2025',
    isNew: true
  },
  {
    id: 'ann_002',
    tag: 'feature',
    tagLabel: 'NEW FEATURE',
    title: '⚡ Daily Challenges Added',
    body: 'A fresh set of 3 daily missions resets every midnight. Complete them to earn gold and special trophies. Find them in the Daily tab at the bottom of the screen.',
    date: 'June 2025',
    isNew: true
  },
  {
    id: 'ann_003',
    tag: 'tip',
    tagLabel: 'TIP',
    title: '💣 Booster Combos',
    body: 'Use a Time Bomb first to clear a 3×3 area, then follow up with a Hammer to take out a stubborn tile. Boosters refill when you win levels — the more stars, the more you earn back.',
    date: 'June 2025',
    isNew: false
  },
  {
    id: 'ann_004',
    tag: 'update',
    tagLabel: 'UPDATE',
    title: '🌌 Space Music Update',
    body: 'We replaced the background music with a soft ambient space soundtrack — gentle pads and deep bass that won\'t drive you crazy during long sessions. Toggle it off in Settings if you prefer silence.',
    date: 'June 2025',
    isNew: false
  },
  {
    id: 'ann_005',
    tag: 'event',
    tagLabel: 'COMING SOON',
    title: '🌍 7 Eras, 70 Levels Await',
    body: 'Travel from the smoky 1940s Noir all the way to the chaotic 2000s Y2K Pop. Each era has unique gadget tiles and its own soundtrack vibe. How far through the timeline can you go?',
    date: 'June 2025',
    isNew: false
  }
];

function openAnnouncementsPage() {
  const body = document.getElementById('announcementsBody');
  if (!body) return;

  // Track which announcements the player has seen
  const seenKey  = 'chrono_seen_announcements';
  const seen     = JSON.parse(localStorage.getItem(seenKey) || '[]');
  const newIds   = ANNOUNCEMENTS.filter(a => a.isNew && !seen.includes(a.id)).map(a => a.id);

  // Mark all as seen now that player opened the page
  const allSeen  = [...new Set([...seen, ...ANNOUNCEMENTS.map(a => a.id)])];
  localStorage.setItem(seenKey, JSON.stringify(allSeen));

  // Hide news badge
  const badge = document.getElementById('newsBadge');
  if (badge) badge.style.display = 'none';

  const tagClass = { update: 'ann-tag-update', feature: 'ann-tag-feature', event: 'ann-tag-event', tip: 'ann-tag-tip' };

  let html = '';
  ANNOUNCEMENTS.forEach(ann => {
    const isUnseen = newIds.includes(ann.id);
    html += `
      <div class="announcement-card ${isUnseen ? 'ann-new' : ''}">
        <div class="ann-tag ${tagClass[ann.tag] || 'ann-tag-update'}">${ann.tagLabel}</div>
        <div class="ann-title">${ann.title}</div>
        <div class="ann-body">${ann.body}</div>
        <div class="ann-date">${ann.date}</div>
      </div>`;
  });

  body.innerHTML = html;
  switchView('announcementsPage');
}

// Show red dot on News tab if there are unread announcements
function checkNewsBadge() {
  const seenKey = 'chrono_seen_announcements';
  const seen    = JSON.parse(localStorage.getItem(seenKey) || '[]');
  const hasNew  = ANNOUNCEMENTS.some(a => a.isNew && !seen.includes(a.id));
  const badge   = document.getElementById('newsBadge');
  if (badge) badge.style.display = hasNew ? 'block' : 'none';
}
