/* ============================================================
   CHRONOCRUSH — logic.js  (DOM grid, no canvas for game board)
   ============================================================ */

const BOARD_SIZE = 6;

const gameState = {
  lives: 5,
  gold: 100,
  currentLevel: 1,
  highestUnlockedLevel: 1,
  totalLevels: 90,
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
  authProvider: 'Guest',
  authDisplayName: '',
  authEmail: '',
  boosters: { hammer: 3, bomb: 3, shuffle: 3 },
  activeBooster: null,
  challengeTarget: null,
  challengeProgress: 0,
  levelMode: 'score',
  lastSeenEraName: null
};

// Fireworks
let fxCanvas = null, fxCtx = null, fxParticles = [], fxAnimationId = null;

/* ============================================================
   ERA TIMELINE
   ============================================================ */
const eraTimeline = [
  { name: "1940s Noir",          startLvl: 1,  endLvl: 10, items: ['📻','🎩','✒️','🎷'] },
  { name: "1950s Rockabilly",    startLvl: 11, endLvl: 20, items: ['🥤','🎸','🕶️','🚗'] },
  { name: "1960s Psychedelic",   startLvl: 21, endLvl: 30, items: ['☮️','🌸','🚌','🎨'] },
  { name: "1970s Disco",         startLvl: 31, endLvl: 40, items: ['🪩','✨','🛼','🕺'] },
  { name: "1980s Retro Synth",   startLvl: 41, endLvl: 50, items: ['🎮','📼','🕹️','📟'] },
  { name: "1990s Grunge",        startLvl: 51, endLvl: 60, items: ['📀','☎️','🧥','🎧'] },
  { name: "2000s Y2K Pop",       startLvl: 61, endLvl: 70, items: ['💿','📱','👛','🌐'] },
  { name: "2001 Rise of the Web",startLvl: 71, endLvl: 80, items: ['💻','🖱️','📡','🔋'] },
  { name: "2002 Flip Phone Era", startLvl: 81, endLvl: 90, items: ['📲','🎵','🕹️','💾'] }
];

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener("DOMContentLoaded", boot);

function boot() {
  gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
  gameState.levelRecords  = JSON.parse(localStorage.getItem("chrono_level_records"))  || {};
  gameState.preferences   = JSON.parse(localStorage.getItem("chrono_preferences"))    || { sound: true, sfx: true, vibe: true };
  gameState.gold  = parseInt(localStorage.getItem("chrono_gold"))  || 100;
  gameState.lives = parseInt(localStorage.getItem("chrono_lives")) || 5;
  if (isNaN(gameState.gold))  gameState.gold  = 100;
  if (isNaN(gameState.lives)) gameState.lives = 5;
  gameState.lifeShield = localStorage.getItem("chrono_shield") === "1";
  gameState.lastSeenEraName  = localStorage.getItem("chrono_last_era") || eraTimeline[0].name;
  gameState.authProvider     = localStorage.getItem("chrono_auth_provider") || "Guest";

  syncSettingsUI();

  fxCanvas = document.getElementById("fireworksCanvas");
  if (fxCanvas) fxCtx = fxCanvas.getContext("2d");
  window.addEventListener("resize", resizeFireworksCanvas);

  switchView("loadingScreen");
  setTimeout(() => {
    switchView("authScreen");
    checkPaymentReturn();
  }, 900);

  // Start offline/online detection
  initOfflineDetection();
}

/* ============================================================
   OFFLINE / ONLINE DETECTION
   ============================================================ */
function initOfflineDetection() {
  function updateOnlineStatus() {
    const banner = document.getElementById('offlineBanner');
    const isOffline = !navigator.onLine;

    if (banner) banner.style.display = isOffline ? 'block' : 'none';

    // If offline, disable Google sign-in button and show message
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
      if (isOffline) {
        googleBtn.disabled = true;
        googleBtn.style.opacity = '0.4';
        googleBtn.title = 'Google sign-in requires internet connection';
      } else {
        // Only re-enable if terms checkbox is ticked
        const checked = document.getElementById('termsAgreeCheck')?.checked;
        googleBtn.disabled = !checked;
        googleBtn.style.opacity = checked ? '1' : '';
        googleBtn.title = '';
      }
    }

    if (isOffline) {
      console.log('[CHRONOCRUSH] Playing offline — all game features available');
    } else {
      console.log('[CHRONOCRUSH] Back online');
    }
  }

  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Check on load
  updateOnlineStatus();
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
    const dr = Math.abs(gameState.selectedTile.r - r);
    const dc = Math.abs(gameState.selectedTile.c - c);
    if (dr + dc === 1) {
      swapTiles(gameState.selectedTile.r, gameState.selectedTile.c, r, c);
    } else {
      gameState.selectedTile = { r, c };
      triggerVibration(25);
      renderBoard();
    }
  }
}

/* ── Swipe / drag handler ───────────────────────────────────────────────────
   Tracks touchstart / mousedown as the origin tile, then on touchend /
   mouseup works out the swipe direction and triggers the swap.
   A tap (no movement) still works for booster targeting.
──────────────────────────────────────────────────────────────────────────── */
function clearHighlight() {
  const board = document.getElementById('domBoard');
  if (board) board.querySelectorAll('.board-tile.selected').forEach(t => t.classList.remove('selected'));
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
  // Start MP3 music on first user interaction (browser autoplay policy)
  resumeMusicAfterInteraction();
}

function getCurrentEraForLevel(level) {
  return eraTimeline.find(e => level >= e.startLvl && level <= e.endLvl) || eraTimeline[0];
}

/* ============================================================
   BACKGROUND MUSIC — MP3 player
   Replaces the Web Audio synth engine.
   File: audio/background.mp3
   ============================================================ */

let _bgAudio       = null;
let _bgFadeTimer   = null;

function _getBgAudio() {
  if (_bgAudio) return _bgAudio;
  _bgAudio = new Audio('audio/background.mp3');
  _bgAudio.loop   = true;
  _bgAudio.volume = 0;   // start silent, fade in
  _bgAudio.preload = 'auto';
  // If the browser blocks autoplay, retry on next user interaction
  _bgAudio.addEventListener('error', (e) => {
    console.warn('Audio load error:', e);
  });
  return _bgAudio;
}

function startSpaceMusic() {
  if (!gameState.preferences.sound) return;
  const audio = _getBgAudio();

  // Already playing — nothing to do
  if (!audio.paused) return;

  // Resume AudioContext if needed (browser autoplay policy)
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — will start on next user tap (initAudio handles this)
    });
  }

  // Fade in from 0 to 0.45 over 2 seconds
  _fadeVolume(0, 0.45, 2000);
}

function stopSpaceMusic() {
  if (!_bgAudio || _bgAudio.paused) return;
  // Fade out then pause
  _fadeVolume(_bgAudio.volume, 0, 1000, () => {
    _bgAudio.pause();
    _bgAudio.currentTime = 0;
  });
  gameState.musicSchedulerId = null;
}

function _fadeVolume(from, to, durationMs, onDone) {
  if (_bgFadeTimer) clearInterval(_bgFadeTimer);
  const steps    = 40;
  const interval = durationMs / steps;
  const delta    = (to - from) / steps;
  let   current  = from;
  let   step     = 0;

  _bgFadeTimer = setInterval(() => {
    step++;
    current = Math.min(Math.max(current + delta, 0), 1);
    if (_bgAudio) _bgAudio.volume = current;
    if (step >= steps) {
      clearInterval(_bgFadeTimer);
      _bgFadeTimer = null;
      if (onDone) onDone();
    }
  }, interval);
}

// Called by initAudio() on first user tap — starts music if not already playing
function resumeMusicAfterInteraction() {
  if (gameState.preferences.sound && _bgAudio && _bgAudio.paused) {
    startSpaceMusic();
  }
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
  checkAwardsBadge();
  checkQuizBadge();
  updateLivesDisplay();
  startLifeRefillTimer();
  maybeShowDailyReward();
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
/* ── Difficulty curve ──────────────────────────────────────────────────────
   All levels: 20 moves, no exceptions.
   Score target and challenge count scale up across levels.
   Easy (1–9), Easy-Medium (10–49), Hard (50–70).
──────────────────────────────────────────────────────────────────────────── */
/* ── Difficulty curve ──────────────────────────────────────────────────────
   ALL levels: exactly 20 moves.
   Win requires BOTH: clear X specific tiles AND reach score target.
   Score per match: 50pts (lvl 1-9), 100pts (10-29), 150pts (30-49),
                    200pts (50-59), 250pts (60-70), 300pts (71-90)
   
   With 20 moves, best case ~4 matches per move = 80 matches max.
   At 150pts per match from level 30: max possible = 80 × 150 = 12,000pts
   Targets are set CLOSE to this maximum so bad play = fail.
────────────────────────────────────────────────────────────────────────── */
function getDifficulty(lvl) {

  // Tutorial (1-9): learn the game, generous
  if (lvl <= 9) {
    return {
      moves:          20,
      targetScore:    200 + lvl * 60,              // 260 – 740
      challengeCount: 4 + Math.floor(lvl * 0.5),  // 4 – 8
      boosters:       { hammer: 5, bomb: 4, shuffle: 4 }
    };
  }

  // Easy (10-29): getting real — need consistent chains
  if (lvl <= 29) {
    const t = (lvl - 10) / 19;
    return {
      moves:          20,
      targetScore:    Math.round(1500 + t * 3000),  // 1500 → 4500
      challengeCount: Math.round(10  + t * 8),      // 10 → 18
      boosters:       { hammer: 3, bomb: 3, shuffle: 3 }
    };
  }

  // Hard from level 30 — BOTH conditions are very tough
  // Score max at 150pts/match × 80 matches = 12,000. Target is 8,000-11,500
  if (lvl <= 49) {
    const t = (lvl - 30) / 19;
    return {
      moves:          20,
      targetScore:    Math.round(8000 + t * 3500),  // 8000 → 11500
      challengeCount: Math.round(22  + t * 8),      // 22 → 30
      boosters:       { hammer: 3, bomb: 2, shuffle: 2 }
    };
  }

  // Very Hard (50-59): 35 moves so players can reach the high targets
  if (lvl <= 59) {
    const t = (lvl - 50) / 9;
    return {
      moves:          35,
      targetScore:    Math.round(12000 + t * 3000), // 12000 → 15000
      challengeCount: Math.round(31   + t * 7),     // 31 → 38
      boosters:       { hammer: 2, bomb: 2, shuffle: 1 }
    };
  }

  // Brutal (60-70): 35 moves
  if (lvl <= 70) {
    const t = (lvl - 60) / 10;
    return {
      moves:          35,
      targetScore:    Math.round(16000 + t * 3500), // 16000 → 19500
      challengeCount: Math.round(39   + t * 9),     // 39 → 48
      boosters:       { hammer: 2, bomb: 1, shuffle: 1 }
    };
  }

  // Extreme (71-80): 35 moves
  if (lvl <= 80) {
    const t = (lvl - 71) / 9;
    return {
      moves:          35,
      targetScore:    Math.round(20000 + t * 3000), // 20000 → 23000
      challengeCount: Math.round(49   + t * 8),     // 49 → 57
      boosters:       { hammer: 2, bomb: 1, shuffle: 1 }
    };
  }

  // Legendary (81-90): max ~24,000. Target 23,500-24,000 — near perfect play needed
  const t = (lvl - 81) / 9;
  return {
    moves:          20,
    targetScore:    Math.round(23500 + t * 500),   // 23500 → 24000
    challengeCount: Math.round(58   + t * 10),     // 58 → 68
    boosters:       { hammer: 1, bomb: 1, shuffle: 1 }
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

  // ── Win condition depends on level range ──────────────────────
  // Levels  1-20: clear a specific tile count (tile-clear mode)
  // Levels 21-29: transition — score target only
  // Levels 30-90: score target only
  if (lvl <= 20) {
    // Tile-clear mode: clear 8 of one specific tile type
    const challengeItem = era.items[(lvl - 1) % era.items.length];
    const clearCount    = 6 + Math.floor(lvl * 0.4); // 6 → 13 tiles to clear
    gameState.challengeTarget   = { item: challengeItem, count: clearCount };
    gameState.challengeProgress = 0;
    gameState.levelMode         = 'tile';

    document.getElementById("activeEraName").innerText = `Level ${lvl}`;
    document.getElementById("movesDisplay").innerText  = gameState.moves;
    document.getElementById("targetDisplay").innerText = `0/${clearCount}`;
    document.getElementById("scoreDisplay").innerText  = 0;
    const banner = document.getElementById("challengeBanner");
    if (banner) banner.innerText = `Clear ${clearCount} ${challengeItem} to pass this level!`;
  } else {
    // Score-target mode: hit the score before moves run out
    gameState.challengeTarget   = null;
    gameState.challengeProgress = 0;
    gameState.levelMode         = 'score';

    document.getElementById("activeEraName").innerText = `Level ${lvl}`;
    document.getElementById("movesDisplay").innerText  = gameState.moves;
    document.getElementById("targetDisplay").innerText = diff.targetScore.toLocaleString();
    document.getElementById("scoreDisplay").innerText  = 0;
    const banner = document.getElementById("challengeBanner");
    if (banner) banner.innerText = `Score ${diff.targetScore.toLocaleString()} pts before moves run out!`;
  }

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
  if (gameState.challengeTarget && gameState.grid[r][c] === gameState.challengeTarget.item) {
    gameState.challengeProgress++;
  }
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
  // Wait for swap animation before checking matches (300ms)
  setTimeout(checkChallengeAndScore, 300);
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
  document.getElementById("scoreDisplay").innerText = gameState.score.toLocaleString();
  triggerVibration([60, 40, 60]);

  matchedPositions.forEach(pos => {
    if (gameState.challengeTarget && gameState.grid[pos.r][pos.c] === gameState.challengeTarget.item)
      gameState.challengeProgress++;
    // Flash + shrink just those tiles
    animateMatch(pos.r, pos.c);
  });

  updateChallengeBanner();

  // After vanish animation: refill only the matched cells in place
  // Longer vanish pause (500ms) so player can see what was cleared
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
    // Wait for drop animation to complete before checking chains (600ms)
    setTimeout(checkChallengeAndScore, 600);
  }, 500);
}

function afterMatch() {
  document.getElementById("scoreDisplay").innerText = gameState.score.toLocaleString();
  setTimeout(checkChallengeAndScore, 250);
}

function updateChallengeBanner() {
  const banner   = document.getElementById("challengeBanner");
  const targetEl = document.getElementById("targetDisplay");
  if (!banner) return;

  if (gameState.levelMode === 'tile' && gameState.challengeTarget) {
    // Tile-clear mode: show live tile progress
    const done      = gameState.challengeProgress;
    const total     = gameState.challengeTarget.count;
    const remaining = Math.max(0, total - done);
    if (targetEl) targetEl.innerText = `${done}/${total}`;
    banner.innerText = remaining > 0
      ? `Clear ${remaining} more ${gameState.challengeTarget.item} to pass!`
      : `Level complete! 🎉`;
  } else {
    // Score-target mode: show remaining points needed
    const remaining = Math.max(0, gameState.targetScore - gameState.score);
    if (remaining > 0) {
      banner.innerText = `${remaining.toLocaleString()} points to go! ${gameState.moves} moves left`;
    } else {
      banner.innerText = `Target reached! 🎉`;
    }
  }
}

function evaluateLevelEndConditions() {
  if (gameState.levelMode === 'tile') {
    // Tile-clear mode (levels 1-20): clear required tiles to win
    const challengeMet = gameState.challengeTarget &&
                         gameState.challengeProgress >= gameState.challengeTarget.count;
    if (challengeMet) { setTimeout(win, 400); return; }
  } else {
    // Score-target mode (levels 21+): hit score target to win
    if (gameState.score >= gameState.targetScore) { setTimeout(win, 400); return; }
  }
  if (gameState.moves <= 0) {
    setTimeout(() => {
      gameState.isGameActive = false;

      if (gameState.lifeShield) {
        // Shield absorbs the fail — no life lost
        gameState.lifeShield = false;
        localStorage.removeItem("chrono_shield");
        showShopToast("🛡️ Life Shield saved you!");
        showFailModal(true);
      } else {
        // Silently deduct a life — no alert, just update the counter
        gameState.lives = Math.max(0, gameState.lives - 1);
        localStorage.setItem("chrono_lives", gameState.lives);
        // Update lives display silently
        updateLivesDisplay();
        // Start 12-hour refill timer ONLY when all 5 lives are gone
        if (gameState.lives === 0) {
          if (!localStorage.getItem('chrono_life_refill_at')) {
            localStorage.setItem('chrono_life_refill_at', Date.now() + LIFE_REFILL_MS);
          }
          // Show the countdown bar immediately
          startLifeRefillTimer();
        }
        showFailModal(false);
      }
    }, 500);
  }
}

/* ============================================================
   LEVEL FAIL MODAL
   ============================================================ */
function showFailModal(shieldSaved) {
  const needed   = gameState.targetScore - gameState.score;
  const pct      = Math.round((gameState.score / gameState.targetScore) * 100);

  // Pick a fun fail message based on how close they were
  let title, subtext;
  if (shieldSaved) {
    title   = "SHIELD SAVED YOU!";
    subtext = "LIFE SHIELD ACTIVATED";
  } else if (pct >= 90) {
    title   = "SO CLOSE!";
    subtext = "OUT OF MOVES";
  } else if (pct >= 70) {
    title   = "ALMOST THERE!";
    subtext = "KEEP PRACTICING";
  } else if (pct >= 50) {
    title   = "NOT QUITE!";
    subtext = "YOU CAN DO BETTER";
  } else {
    title   = "KEEP TRYING!";
    subtext = "PRACTICE MAKES PERFECT";
  }

  document.getElementById("failTitle").textContent   = title;
  document.getElementById("failSubtext").textContent = subtext;
  document.getElementById("failScoreDisplay").textContent =
    `${gameState.score.toLocaleString()} / ${gameState.targetScore.toLocaleString()} pts`;

  triggerVibration([80, 40, 80]);
  switchView("homePage");
  toggleModal("levelFailModal", true);
}

function retryAfterFail() {
  toggleModal("levelFailModal", false);
  if (gameState.lives <= 0) {
    showShopToast("No lives left! Visit the Shop to refill ❤️", "error");
    loadHomepage();
    return;
  }
  playLevelTransition(() => startLevelLogic(gameState.currentLevel));
}

function backToMapAfterFail() {
  toggleModal("levelFailModal", false);
  loadHomepage();
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
  checkAwardsBadge();

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
/* ============================================================
   AUTH + NOTIFICATION FLOW
   ============================================================ */

// Called by Firebase module (index.html) once sign-in succeeds
window.afterFirebaseAuth = function(user) {
  if (!user) return;
  gameState.authProvider = user.providerData[0]
    ? 'Google'
    : 'Social';
  gameState.authDisplayName  = user.displayName  || '';
  gameState.authEmail        = user.email        || '';
  gameState.authPhotoURL     = user.photoURL     || '';
  localStorage.setItem('chrono_auth_provider',     gameState.authProvider);
  localStorage.setItem('chrono_auth_display_name', gameState.authDisplayName);
  localStorage.setItem('chrono_auth_email',        gameState.authEmail);
  afterAuthSuccess();
};

function setAuthBtnLoading(btnId, loading, originalHTML) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<span class="auth-social-icon">⏳</span> Signing in…';
    btn.style.opacity = '0.7';
  } else {
    btn.innerHTML = originalHTML || btn.dataset.original || btn.innerHTML;
    btn.style.opacity = '';
  }
}

async function handleSocialAuth(provider) {
  initAudio();

  // ── Firebase is configured — do real OAuth ───────────────────
  if (window._firebaseReady) {
    const btnId = 'googleSignInBtn';
    setAuthBtnLoading(btnId, true);

    try {
      let user = null;
      if (provider === 'google') {
        user = await window.firebaseSignInGoogle();
      }

      setAuthBtnLoading(btnId, false);

      if (user) {
        window.afterFirebaseAuth(user);
      } else {
        // Popup closed or cancelled — show friendly message
        showAuthError('Sign-in was cancelled. Please try again.');
      }
    } catch(err) {
      setAuthBtnLoading(btnId, false);
      showAuthError('Something went wrong. Please try again.');
    }
    return;
  }

  showAuthSetupNotice(provider);
}

function showAuthError(msg) {
  let el = document.getElementById('authErrorMsg');
  if (!el) {
    el = document.createElement('p');
    el.id = 'authErrorMsg';
    el.style.cssText = 'color:#ff6b81;font-size:0.75rem;text-align:center;margin-top:-4px;';
    const card = document.querySelector('.auth-card');
    const guestBtn = document.querySelector('.auth-guest-btn');
    if (card && guestBtn) card.insertBefore(el, guestBtn.parentNode || guestBtn);
  }
  el.textContent = msg;
  setTimeout(() => { if (el) el.textContent = ''; }, 4000);
}

function showAuthSetupNotice(provider) {
  // Firebase not configured — show a modal explaining what's needed
  const providerName = 'Google';
  let el = document.getElementById('authErrorMsg');
  if (!el) {
    el = document.createElement('p');
    el.id = 'authErrorMsg';
    el.style.cssText = 'color:var(--gold-bright);font-size:0.72rem;text-align:center;margin-top:-4px;line-height:1.5;';
    const card = document.querySelector('.auth-card');
    const orDiv = document.querySelector('.auth-or-divider');
    if (card && orDiv) card.insertBefore(el, orDiv);
  }
  el.textContent = 'Google sign-in requires Firebase setup. Use Play as Guest for now.';
  setTimeout(() => { if (el) el.textContent = ''; }, 5000);
}

function handleAuth(mode) {
  initAudio();
  _pendingAuthProvider = 'guest';
  showTermsAgreePopup();
}

function _doGuestAuth() {
  gameState.authProvider    = 'Guest';
  gameState.authDisplayName = 'Guest';
  gameState.authEmail       = '';
  localStorage.setItem('chrono_auth_provider', 'Guest');
  afterAuthSuccess();
}

/* Terms agree popup functions */
function showTermsAgreePopup() {
  // Reset checkbox
  const chk = document.getElementById('termsAgreeModalCheck');
  const btn = document.getElementById('termsAgreeConfirmBtn');
  if (chk) chk.checked = false;
  if (btn) btn.disabled = true;
  toggleModal('termsAgreeModal', true);
}

function toggleTermsAgreeBtn() {
  const chk = document.getElementById('termsAgreeModalCheck');
  const btn = document.getElementById('termsAgreeConfirmBtn');
  if (btn) btn.disabled = !chk?.checked;
}

function confirmTermsAndProceed() {
  toggleModal('termsAgreeModal', false);
  if (_pendingAuthProvider === 'guest') {
    _doGuestAuth();
  } else if (_pendingAuthProvider) {
    _doSocialAuth(_pendingAuthProvider);
  }
  _pendingAuthProvider = null;
}

function openTermsFromModal() {
  toggleModal('termsAgreeModal', false);
  _termsCalledFrom = 'authScreen';
  switchView('termsPage');
}

function openPrivacyFromModal() {
  toggleModal('termsAgreeModal', false);
  _termsCalledFrom = 'authScreen';
  switchView('privacyPage');
}

function afterAuthSuccess() {
  const askedBefore = localStorage.getItem('chrono_notif_asked');
  if (askedBefore) {
    triggerFlashAnimation();
    switchView('welcomeScreen');
  } else {
    toggleModal('notifModal', true);
  }
}

function handleNotifPermission(allow) {
  toggleModal('notifModal', false);
  localStorage.setItem('chrono_notif_asked', '1');

  if (allow && 'Notification' in window) {
    Notification.requestPermission().then(perm => {
      localStorage.setItem('chrono_notif_perm', perm);
      if (perm === 'granted') {
        scheduleWelcomeNotification();
      }
    });
  } else {
    localStorage.setItem('chrono_notif_perm', 'denied');
  }

  triggerFlashAnimation();
  switchView('welcomeScreen');
}

function scheduleWelcomeNotification() {
  // Show a welcome notification after 3 seconds if permission granted
  if (Notification.permission === 'granted') {
    setTimeout(() => {
      try {
        new Notification('CHRONOCRUSH: The Era Odyssey 🎵', {
          body: 'Your adventure through time begins now. Good luck, time traveller!',
          icon: '/favicon.ico'
        });
      } catch(e) {}
    }, 3000);
  }
}
function triggerFlashAnimation() {
  const f = document.getElementById("portalFlash");
  if (!f) return;
  f.classList.add('active');
  setTimeout(() => f.classList.remove('active'), 300);
}
function openSettingsModal() { toggleModal('settingsModal', true); }

function openHowToPlay() {
  toggleModal('settingsModal', false);   // close settings first
  toggleModal('howToPlayModal', true);
}

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
function openShopPage() {
  // Sync gold display when opening shop
  const disp = document.getElementById('shopGoldDisplay');
  if (disp) disp.textContent = gameState.gold.toLocaleString();
  switchView('shopPage');
}

function buyItem(type, cost) {
  if (gameState.gold < cost) {
    showShopToast("Not enough gold! 🪙 Buy more below.", 'error');
    return;
  }
  gameState.gold -= cost;

  switch(type) {
    case 'lives':
      gameState.lives = Math.min(99, gameState.lives + 5);
      localStorage.setItem("chrono_lives", gameState.lives);
      showShopToast("❤️ +5 Lives added!");
      break;
    case 'hammer':
      gameState.boosters.hammer += 3;
      showShopToast("🔨 Hammer ×3 added!");
      break;
    case 'bomb':
      gameState.boosters.bomb += 3;
      showShopToast("💣 Time Bomb ×3 added!");
      break;
    case 'shuffle':
      gameState.boosters.shuffle += 3;
      showShopToast("🔀 Shuffle ×3 added!");
      break;
    case 'moves':
      if (gameState.isGameActive) {
        gameState.moves += 5;
        document.getElementById("movesDisplay").innerText = gameState.moves;
      }
      showShopToast("➕ +5 Moves added!");
      break;
    case 'shield':
      gameState.lifeShield = true;
      localStorage.setItem("chrono_shield", "1");
      showShopToast("🛡️ Life Shield active!");
      break;
    case 'gold': {
      // Free daily claim — once per day only
      const todayKey = 'chrono_free_gold_' + new Date().toDateString();
      if (localStorage.getItem(todayKey)) {
        showShopToast('Already claimed today! Come back tomorrow.', 'error');
        gameState.gold += cost; // refund since we deducted 0 but just in case
      } else {
        gameState.gold += 50;
        localStorage.setItem(todayKey, '1');
        showShopToast('🪙 +50 Free Gold claimed! Come back tomorrow.');
      }
      break;
    }
  }

  localStorage.setItem("chrono_gold", gameState.gold);
  const profileGold = document.getElementById("profileGold");
  if (profileGold) profileGold.innerText = gameState.gold;
  const shopDisp = document.getElementById("shopGoldDisplay");
  if (shopDisp) shopDisp.textContent = gameState.gold.toLocaleString();
  updateBoosterUI();
  triggerVibration(40);
}

/* ── Shop toast notification ────────────────────────────────── */
function showShopToast(msg, type) {
  let toast = document.getElementById('shopToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shopToast';
    toast.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
      background:rgba(17,23,26,0.97); border:1px solid rgba(212,175,55,0.4);
      color:#eef1f2; padding:12px 22px; border-radius:30px;
      font-size:0.85rem; font-weight:700; z-index:999;
      transition:opacity 0.3s; pointer-events:none; white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.style.borderColor = type === 'error' ? 'rgba(163,42,42,0.7)' : 'rgba(212,175,55,0.4)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

/* ============================================================
   PAYFAST PAYMENT FLOW
   ============================================================ */
// ⚠️  SETUP REQUIRED: Replace these with your real PayFast credentials
// Get them at https://www.payfast.co.za after creating a merchant account
// PayFast config — update merchant_id and merchant_key before going live
// Sign up at https://www.payfast.co.za to get your credentials
const PAYFAST_CONFIG = {
  merchant_id:  'YOUR_MERCHANT_ID',
  merchant_key: 'YOUR_MERCHANT_KEY',
  sandbox:      true,
  notify_url:   ''
};
// return/cancel URLs built at runtime to always match current domain
function getPayfastUrls() {
  const base = window.location.origin + window.location.pathname;
  return {
    return_url: base + '?payment=success',
    cancel_url: base + '?payment=cancel'
  };
}

let pendingPayment = null; // { packageId, amountZAR, goldCoins }

function initiatePayment(packageId, amountZAR, goldCoins) {
  pendingPayment = { packageId, amountZAR, goldCoins };

  const labels = {
    '500gold':  'Starter Pouch — 500 Gold',
    '1000gold': 'Gold Pouch — 1,000 Gold',
    '2500gold': 'Gold Chest — 2,500 Gold',
    '6000gold': 'Gold Vault — 6,000 Gold',
  };

  document.getElementById('paymentModalTitle').textContent = labels[packageId] || 'Buy Gold';
  document.getElementById('paymentGoldAmt').textContent    = goldCoins.toLocaleString();
  document.getElementById('paymentModalPrice').textContent = `R ${amountZAR}`;

  toggleModal('paymentModal', true);
}

function confirmPayment() {
  if (!pendingPayment) return;

  const { packageId, amountZAR, goldCoins } = pendingPayment;

  // No credentials yet — dev mode: add gold directly for testing
  if (PAYFAST_CONFIG.merchant_id === 'YOUR_MERCHANT_ID') {
    const msg = 'PayFast not configured yet. Gold added in test mode.';
    gameState.gold += goldCoins;
    localStorage.setItem('chrono_gold', gameState.gold);
    const pg = document.getElementById('profileGold');
    if (pg) pg.innerText = gameState.gold;
    const sd = document.getElementById('shopGoldDisplay');
    if (sd) sd.textContent = gameState.gold.toLocaleString();
    showShopToast('🪙 +' + goldCoins.toLocaleString() + ' Gold added! (Test mode)');
    toggleModal('paymentModal', false);
    pendingPayment = null;
    return;
  }

  // Build PayFast hosted payment form and submit
  const host = PAYFAST_CONFIG.sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';

  const urls   = getPayfastUrls();
  const params = {
    merchant_id:      PAYFAST_CONFIG.merchant_id,
    merchant_key:     PAYFAST_CONFIG.merchant_key,
    return_url:       urls.return_url,
    cancel_url:       urls.cancel_url,
    amount:           amountZAR.toFixed(2),
    item_name:        'CHRONOCRUSH ' + goldCoins.toLocaleString() + ' Gold Coins',
    item_description: goldCoins + ' gold coins for CHRONOCRUSH',
    custom_str1:      packageId,
    custom_str2:      String(goldCoins)
  };
  if (PAYFAST_CONFIG.notify_url) params.notify_url = PAYFAST_CONFIG.notify_url;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = host;
  Object.entries(params).forEach(function(entry) {
    var inp = document.createElement('input');
    inp.type  = 'hidden';
    inp.name  = entry[0];
    inp.value = entry[1];
    form.appendChild(inp);
  });
  document.body.appendChild(form);
  form.submit();
}


// Check for payment return from PayFast
function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('payment');
  if (result === 'success') {
    // PayFast returned — in production, rely on ITN webhook for gold credit.
    // For now show a friendly message.
    setTimeout(() => {
      showShopToast('✅ Payment received! Your gold will arrive shortly.');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }, 800);
  } else if (result === 'cancel') {
    setTimeout(() => {
      showShopToast('Payment cancelled.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }, 800);
  }
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

const ERA_ICONS = ['🎷','🎸','☮️','🪩','🎮','📀','💿','💻','📲'];
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
    title: '🌍 9 Eras, 90 Levels Await',
    body: 'Travel from the smoky 1940s Noir all the way to the 2002 Flip Phone Era — 9 eras, 90 levels of match-3 madness. Each era has unique tiles and increasing difficulty. How far through the timeline can you go?',
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

/* ============================================================
   DAILY REWARD SYSTEM
   ============================================================ */

// 7-day reward cycle — loops back after day 7
const DAILY_REWARDS = [
  { day: 1, icon: '🪙', label: 'Gold',       desc: 'Day 1 reward',  type: 'gold',    amount: 100  },
  { day: 2, icon: '❤️', label: '+3 Lives',   desc: 'Day 2 reward',  type: 'lives',   amount: 3    },
  { day: 3, icon: '🪙', label: 'Gold',        desc: 'Day 3 reward',  type: 'gold',    amount: 150  },
  { day: 4, icon: '🔨', label: 'Hammer ×2',  desc: 'Day 4 reward',  type: 'hammer',  amount: 2    },
  { day: 5, icon: '🪙', label: 'Gold',        desc: 'Day 5 reward',  type: 'gold',    amount: 200  },
  { day: 6, icon: '💣', label: 'Bomb ×2',    desc: 'Day 6 reward',  type: 'bomb',    amount: 2    },
  { day: 7, icon: '🎁', label: '500 Gold',   desc: 'Weekly jackpot!',type: 'gold',   amount: 500  },
];

function getDayKey(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.toDateString();
}

function getDailyRewardState() {
  const lastClaim  = localStorage.getItem('chrono_daily_reward_date');
  const streak     = parseInt(localStorage.getItem('chrono_daily_reward_streak')) || 0;
  const todayKey   = getDayKey(0);
  const alreadyClaimedToday = lastClaim === todayKey;
  // Which day of the 7-cycle are we on (0-indexed)
  const dayIndex = streak % 7;
  return { alreadyClaimedToday, streak, dayIndex, todayKey };
}

function maybeShowDailyReward() {
  const { alreadyClaimedToday } = getDailyRewardState();
  if (alreadyClaimedToday) return; // already claimed today — don't show
  // Small delay so the map loads first, then popup slides up
  setTimeout(showDailyRewardModal, 800);
}

function showDailyRewardModal() {
  const { streak, dayIndex } = getDailyRewardState();
  const reward = DAILY_REWARDS[dayIndex];

  // Update reward showcase
  document.getElementById('dailyRewardIcon').textContent   = reward.icon;
  document.getElementById('dailyRewardAmount').textContent = '+' + (reward.amount > 1 ? reward.amount + ' ' : '') + reward.label;
  document.getElementById('dailyRewardDesc').textContent   = reward.desc;

  // Build the 7-day streak strip
  const strip = document.getElementById('dailyStreakStrip');
  if (strip) {
    strip.innerHTML = '';
    const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    DAILY_REWARDS.forEach((r, i) => {
      const div = document.createElement('div');
      let cls = 'streak-day';
      if (i < dayIndex)      cls += ' claimed';
      else if (i === dayIndex) cls += ' today';
      else                    cls += ' locked';
      div.className = cls;
      div.innerHTML = `<span class="streak-day-icon">${r.icon}</span><span>Day ${r.day}</span>`;
      strip.appendChild(div);
    });
  }

  toggleModal('dailyRewardModal', true);
}

function claimDailyReward() {
  const { streak, dayIndex, todayKey } = getDailyRewardState();
  const reward = DAILY_REWARDS[dayIndex];

  // Apply the reward
  switch (reward.type) {
    case 'gold':
      gameState.gold += reward.amount;
      localStorage.setItem('chrono_gold', gameState.gold);
      const pg = document.getElementById('profileGold');
      if (pg) pg.innerText = gameState.gold;
      break;
    case 'lives':
      gameState.lives = Math.min(99, gameState.lives + reward.amount);
      localStorage.setItem('chrono_lives', gameState.lives);
      const lc = document.getElementById('livesCounter');
      if (lc) lc.innerText = gameState.lives;
      break;
    case 'hammer':
      gameState.boosters.hammer += reward.amount;
      break;
    case 'bomb':
      gameState.boosters.bomb += reward.amount;
      break;
    case 'shuffle':
      gameState.boosters.shuffle += reward.amount;
      break;
  }

  // Save claim date and increment streak
  localStorage.setItem('chrono_daily_reward_date',   todayKey);
  localStorage.setItem('chrono_daily_reward_streak', streak + 1);

  toggleModal('dailyRewardModal', false);
  showShopToast('🎁 ' + reward.icon + ' ' + reward.label + ' claimed! Come back tomorrow.');
  triggerVibration([80, 40, 120]);
}

/* ============================================================
   AWARDS BADGE — shows gold coin when a new trophy is earnable
   ============================================================ */
function checkAwardsBadge() {
  const badge = document.getElementById('awardsBadge');
  if (!badge) return;

  // Show badge if any era is newly completed (trophy not yet viewed)
  const viewedKey = 'chrono_viewed_trophies';
  const viewed    = JSON.parse(localStorage.getItem(viewedKey) || '[]');

  const hasNewTrophy = eraTimeline.some(era => {
    const result = getEraTrophy(era);
    if (result.tier === 'locked') return false;         // not complete
    const trophyId = era.name + '_' + result.tier;
    return !viewed.includes(trophyId);                  // not yet seen
  });

  badge.style.display = hasNewTrophy ? 'inline' : 'none';
}

// Mark trophies as viewed when player opens awards page
const _origOpenAwards = openAwardsPage;
openAwardsPage = function() {
  _origOpenAwards();
  // Mark all current trophies as viewed
  const viewedKey = 'chrono_viewed_trophies';
  const viewed    = JSON.parse(localStorage.getItem(viewedKey) || '[]');
  eraTimeline.forEach(era => {
    const result  = getEraTrophy(era);
    if (result.tier === 'locked') return;
    const trophyId = era.name + '_' + result.tier;
    if (!viewed.includes(trophyId)) viewed.push(trophyId);
  });
  localStorage.setItem(viewedKey, JSON.stringify(viewed));
  // Hide badge
  const badge = document.getElementById('awardsBadge');
  if (badge) badge.style.display = 'none';
};

// Also check daily badge with gold logic — show if not all done today
const _origCheckDailyBadge = checkDailyBadge;
checkDailyBadge = function() {
  const tasks   = getDailyTasks();
  const allDone = tasks.every(t => t.done);
  const badge   = document.getElementById('dailyBadge');
  if (badge) badge.style.display = allDone ? 'none' : 'inline';
};

/* ============================================================
   TERMS, PRIVACY & ACCOUNT DEACTIVATION
   ============================================================ */

let _termsCalledFrom = 'settings'; // track where to go back to

function openTermsPage() {
  _termsCalledFrom = document.querySelector('.full-screen-view.active')?.id || 'homePage';
  toggleModal('settingsModal', false);
  switchView('termsPage');
}

function openPrivacyPage() {
  _termsCalledFrom = document.querySelector('.full-screen-view.active')?.id || 'homePage';
  toggleModal('settingsModal', false);
  switchView('privacyPage');
}

function closeTermsOrPrivacy() {
  // Go back to wherever they came from
  if (_termsCalledFrom && _termsCalledFrom !== 'termsPage' && _termsCalledFrom !== 'privacyPage') {
    switchView(_termsCalledFrom);
  } else {
    loadHomepage();
  }
}

function confirmDeactivateAccount() {
  toggleModal('settingsModal', false);
  // Reset checkbox state each time
  const chk = document.getElementById('deactivateConfirmCheck');
  if (chk) chk.checked = false;
  const btn = document.getElementById('deactivateConfirmBtn');
  if (btn) btn.disabled = true;
  toggleModal('deactivateModal', true);
}

function toggleDeactivateBtn() {
  const chk = document.getElementById('deactivateConfirmCheck');
  const btn = document.getElementById('deactivateConfirmBtn');
  if (btn) btn.disabled = !chk?.checked;
}

async function executeDeactivation() {
  const btn = document.getElementById('deactivateConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

  try {
    // ── Step 1: Delete from Firebase Auth (also removes Google sign-in) ──────
    // Firebase requires re-authentication before deletion for security.
    // We attempt deletion — if it fails due to needing re-auth, we catch it.
    if (window._firebaseReady && window.firebaseDeleteAccount) {
      await window.firebaseDeleteAccount();
    }
  } catch(err) {
    console.warn('Firebase deletion:', err.message);
    // If re-auth required, Firebase will throw — we still clear local data
  }

  // ── Step 2: Wipe all localStorage ─────────────────────────────────────────
  localStorage.clear();

  // ── Step 3: Reset in-memory gameState ─────────────────────────────────────
  gameState.gold                = 100;
  gameState.lives               = 5;
  gameState.highestUnlockedLevel = 1;
  gameState.levelRecords        = {};
  gameState.currentLevel        = 1;
  gameState.authProvider        = 'Guest';
  gameState.authDisplayName     = '';
  gameState.authEmail           = '';
  gameState.boosters            = { hammer: 3, bomb: 3, shuffle: 3 };

  toggleModal('deactivateModal', false);

  // ── Step 4: Show confirmation and restart ─────────────────────────────────
  setTimeout(() => {
    alert('Your account has been permanently deleted. Thank you for playing CHRONOCRUSH.');
    location.reload();
  }, 400);
}

/* ============================================================
   ERA QUIZ SYSTEM
   Daily trivia question — one per day, era-themed.
   Correct = reward. Wrong = try again tomorrow.
   ============================================================ */

const QUIZ_QUESTIONS = [
  // ── 1940s Noir ───────────────────────────────────────────────
  {
    era: "1940s Noir", icon: "🎷",
    question: "Which famous jazz musician was known as the 'King of Swing' in the 1940s?",
    options: ["Benny Goodman", "Miles Davis", "Louis Armstrong"],
    correct: 0,
    fact: "Benny Goodman was crowned the King of Swing and played to packed crowds at Carnegie Hall in 1938 — a landmark moment for jazz."
  },
  {
    era: "1940s Noir", icon: "🎷",
    question: "What year did World War II end?",
    options: ["1943", "1945", "1947"],
    correct: 1,
    fact: "World War II ended in 1945 — VE Day (Victory in Europe) on 8 May, and VJ Day (Victory over Japan) on 15 August."
  },
  {
    era: "1940s Noir", icon: "🎷",
    question: "What iconic film noir starred Humphrey Bogart as detective Sam Spade?",
    options: ["Casablanca", "The Maltese Falcon", "Double Indemnity"],
    correct: 1,
    fact: "The Maltese Falcon (1941) defined the film noir genre and made Humphrey Bogart a Hollywood legend."
  },

  // ── 1950s Rockabilly ─────────────────────────────────────────
  {
    era: "1950s Rockabilly", icon: "🎸",
    question: "Which artist recorded 'Rock Around the Clock' in 1954, helping launch rock and roll?",
    options: ["Chuck Berry", "Bill Haley", "Elvis Presley"],
    correct: 1,
    fact: "Bill Haley & His Comets recorded 'Rock Around the Clock' in 1954. When it featured in the film Blackboard Jungle, it sparked a rock and roll craze worldwide."
  },
  {
    era: "1950s Rockabilly", icon: "🎸",
    question: "What was the name of Elvis Presley's first hit single in 1954?",
    options: ["Hound Dog", "That's All Right", "Heartbreak Hotel"],
    correct: 1,
    fact: "'That's All Right' was recorded at Sun Studio in Memphis in 1954 — Elvis was 19 years old and the world would never be the same."
  },
  {
    era: "1950s Rockabilly", icon: "🎸",
    question: "Which car brand became a symbol of 1950s American cool?",
    options: ["Ford Thunderbird", "Chevrolet Corvette", "Cadillac Eldorado"],
    correct: 1,
    fact: "The Chevrolet Corvette launched in 1953 and became the definitive American sports car — a symbol of post-war optimism and freedom."
  },

  // ── 1960s Psychedelic ─────────────────────────────────────────
  {
    era: "1960s Psychedelic", icon: "☮️",
    question: "What famous music festival took place in August 1969?",
    options: ["Glastonbury", "Woodstock", "Isle of Wight"],
    correct: 1,
    fact: "Woodstock drew over 400,000 people to a farm in New York state. Performances by Jimi Hendrix, Janis Joplin and The Who defined a generation."
  },
  {
    era: "1960s Psychedelic", icon: "☮️",
    question: "Which Beatles album featured the song 'Lucy in the Sky with Diamonds'?",
    options: ["Abbey Road", "Let It Be", "Sgt. Pepper's Lonely Hearts Club Band"],
    correct: 2,
    fact: "Sgt. Pepper's Lonely Hearts Club Band (1967) is widely considered one of the greatest albums ever made and defined the psychedelic era."
  },
  {
    era: "1960s Psychedelic", icon: "☮️",
    question: "In what year did man first land on the Moon?",
    options: ["1967", "1969", "1971"],
    correct: 1,
    fact: "On 20 July 1969, Neil Armstrong became the first human to walk on the Moon, watched live by 600 million people worldwide."
  },

  // ── 1970s Disco ───────────────────────────────────────────────
  {
    era: "1970s Disco", icon: "🪩",
    question: "Which New York nightclub was the epicentre of the 1970s disco scene?",
    options: ["The Roxy", "Studio 54", "CBGB"],
    correct: 1,
    fact: "Studio 54 opened in 1977 and became the most famous nightclub in the world — celebrities, models and musicians danced under its iconic mirror ball."
  },
  {
    era: "1970s Disco", icon: "🪩",
    question: "Which artist released 'Stayin' Alive' in 1977, one of the biggest disco hits ever?",
    options: ["Donna Summer", "Bee Gees", "Gloria Gaynor"],
    correct: 1,
    fact: "The Bee Gees recorded 'Stayin' Alive' for the Saturday Night Fever soundtrack. It became one of the best-selling soundtracks in history."
  },
  {
    era: "1970s Disco", icon: "🪩",
    question: "What dance craze swept discotheques worldwide in the late 1970s?",
    options: ["The Hustle", "The Twist", "The Moonwalk"],
    correct: 0,
    fact: "The Hustle became the signature dance of the disco era. Van McCoy's 1975 hit 'Do The Hustle' sparked a line-dancing revolution worldwide."
  },

  // ── Extra Bee Gees questions ─────────────────────────────────
  {
    era: "1970s Disco", icon: "🪩",
    question: "Where were the Bee Gees originally from before becoming international superstars?",
    options: ["United States", "Australia", "United Kingdom"],
    correct: 1,
    fact: "The Bee Gees — Barry, Robin and Maurice Gibb — were born on the Isle of Man but grew up in Brisbane, Australia, before conquering the world from the UK."
  },
  {
    era: "1970s Disco", icon: "🪩",
    question: "How many Grammy Awards did the Saturday Night Fever soundtrack win in 1979?",
    options: ["2", "4", "6"],
    correct: 1,
    fact: "The Saturday Night Fever soundtrack won 4 Grammy Awards in 1979 including Album of the Year. It sold over 40 million copies and remains one of the best-selling soundtracks of all time."
  },
  {
    era: "2000s Y2K Pop", icon: "💿",
    question: "Which Bee Gees member continued performing as a solo artist into the 2000s after the group disbanded?",
    options: ["Robin Gibb", "Barry Gibb", "Andy Gibb"],
    correct: 1,
    fact: "Barry Gibb is the last surviving Bee Gee. After the group disbanded following Maurice's passing in 2003, Barry continued touring and recording, keeping the Bee Gees legacy alive."
  },

  // ── 1980s Retro Synth ─────────────────────────────────────────
  {
    era: "1980s Retro Synth", icon: "🎮",
    question: "Which video game console launched in 1983 and revolutionised home gaming?",
    options: ["Atari 2600", "Nintendo Entertainment System", "Sega Genesis"],
    correct: 1,
    fact: "The Nintendo Entertainment System (NES) launched in 1983 in Japan and 1985 in North America, saving the video game industry after the crash of 1983."
  },
  {
    era: "1980s Retro Synth", icon: "🎮",
    question: "Michael Jackson's 'Thriller' music video was released in what year?",
    options: ["1982", "1983", "1984"],
    correct: 1,
    fact: "The Thriller music video debuted in December 1983. At 14 minutes long, it's the most influential music video ever made and set a new standard for the art form."
  },
  {
    era: "1980s Retro Synth", icon: "🎮",
    question: "Which synth band released 'Don't You Want Me' in 1981?",
    options: ["Depeche Mode", "Human League", "Duran Duran"],
    correct: 1,
    fact: "The Human League's 'Don't You Want Me' was the Christmas number one in the UK in 1981 and became one of the defining songs of the synth-pop era."
  },

  // ── 1990s Grunge ──────────────────────────────────────────────
  {
    era: "1990s Grunge", icon: "📀",
    question: "Which Nirvana album is considered the defining record of the grunge movement?",
    options: ["Bleach", "Nevermind", "In Utero"],
    correct: 1,
    fact: "Nevermind (1991) knocked Michael Jackson off the number one spot with its raw, distorted sound. 'Smells Like Teen Spirit' became the anthem of a generation."
  },
  {
    era: "1990s Grunge", icon: "📀",
    question: "The Spice Girls dominated 1990s pop culture — what was their debut single?",
    options: ["Say You'll Be There", "Wannabe", "2 Become 1"],
    correct: 1,
    fact: "'Wannabe' was released in July 1996 and reached number one in 37 countries. The Spice Girls went on to sell over 100 million records worldwide."
  },
  {
    era: "1990s Grunge", icon: "📀",
    question: "What internet browser dominated the 1990s?",
    options: ["Internet Explorer", "Netscape Navigator", "Mozilla Firefox"],
    correct: 1,
    fact: "Netscape Navigator launched in 1994 and at its peak controlled 90% of the web browser market, making the internet accessible to everyday people for the first time."
  },

  // ── 2000s Y2K Pop ─────────────────────────────────────────────
  {
    era: "2000s Y2K Pop", icon: "💿",
    question: "The Y2K bug caused worldwide panic in 1999. What was it?",
    options: ["A computer virus", "A fear that computers would fail at the year 2000", "A power grid failure"],
    correct: 1,
    fact: "The Y2K bug was a fear that computers storing years as two digits would interpret 2000 as 1900. Billions were spent fixing it — and midnight passed without disaster."
  },
  {
    era: "2000s Y2K Pop", icon: "💿",
    question: "Which artist released 'Crazy in Love' in 2003, featuring Jay-Z?",
    options: ["Rihanna", "Beyoncé", "Mariah Carey"],
    correct: 1,
    fact: "'Crazy in Love' launched Beyoncé's solo career and became one of the best-selling singles of the 2000s, winning two Grammy Awards."
  },
  {
    era: "2000s Y2K Pop", icon: "💿",
    question: "What social media platform launched in 2004 and changed the world?",
    options: ["MySpace", "Facebook", "Twitter"],
    correct: 1,
    fact: "Facebook launched on 4 February 2004 from Mark Zuckerberg's Harvard dorm room. It now has over 3 billion monthly users worldwide."
  },

  // ── 2001: Rise of the Web ─────────────────────────────────────
  {
    era: "2001: Rise of the Web", icon: "💻",
    question: "Which online encyclopedia launched in January 2001 and transformed how we access knowledge?",
    options: ["Encyclopedia Britannica Online", "Wikipedia", "Ask Jeeves"],
    correct: 1,
    fact: "Wikipedia launched on 15 January 2001 with the radical idea that anyone could edit it. It now has over 60 million articles in 300+ languages."
  },
  {
    era: "2001: Rise of the Web", icon: "💻",
    question: "What Apple product released in 2001 changed how we listen to music forever?",
    options: ["iMac G4", "iPod", "iTunes"],
    correct: 1,
    fact: "The original iPod launched on 23 October 2001. Steve Jobs introduced it as '1,000 songs in your pocket' — the music industry was never the same."
  },
  {
    era: "2001: Rise of the Web", icon: "💻",
    question: "Which popular messaging service had over 100 million users by 2001?",
    options: ["AOL Instant Messenger", "MSN Messenger", "ICQ"],
    correct: 1,
    fact: "MSN Messenger (later Windows Live Messenger) became the dominant chat platform for teenagers in the early 2000s before smartphones changed everything."
  },

  // ── 2002: Flip Phone Era ──────────────────────────────────────
  {
    era: "2002: Flip Phone Era", icon: "📲",
    question: "Which iconic flip phone, released around 2004, became a fashion symbol worldwide?",
    options: ["Nokia 3310", "Motorola RAZR", "Sony Ericsson T68"],
    correct: 1,
    fact: "The Motorola RAZR V3 launched in 2004 and sold over 130 million units. Its wafer-thin design and metallic finish made it the most stylish phone of its era."
  },
  {
    era: "2002: Flip Phone Era", icon: "📲",
    question: "What mobile phone manufacturer dominated the early 2000s with phones like the 3310?",
    options: ["Samsung", "Nokia", "Motorola"],
    correct: 1,
    fact: "Nokia held over 40% of the global mobile phone market in the early 2000s. The Nokia 3310 became legendary for its durability — it still memes today."
  },
  {
    era: "2002: Flip Phone Era", icon: "📲",
    question: "Snake, the addictive game pre-installed on Nokia phones, first appeared in which year?",
    options: ["1995", "1997", "2000"],
    correct: 1,
    fact: "Snake was pre-installed on the Nokia 6110 in 1997. It's estimated to have been played by over 350 million people — making it one of the most played games ever."
  }
];

// Daily quiz state
function getQuizDayKey() {
  return 'chrono_quiz_' + new Date().toDateString();
}
function getQuizAnsweredKey() {
  return 'chrono_quiz_answered_' + new Date().toDateString();
}

function getTodaysQuestion() {
  // Seed question to today's date so everyone gets same question
  const seed = new Date().getFullYear() * 10000 +
               (new Date().getMonth() + 1) * 100 +
               new Date().getDate();
  const idx = seed % QUIZ_QUESTIONS.length;
  return { question: QUIZ_QUESTIONS[idx], idx };
}

function openQuizPage() {
  const body = document.getElementById('quizBody');
  if (!body) return;

  const { question, idx } = getTodaysQuestion();
  const alreadyAnswered = localStorage.getItem(getQuizAnsweredKey());
  const wasCorrect      = localStorage.getItem(getQuizDayKey()) === 'correct';

  // Hide quiz badge
  const badge = document.getElementById('quizBadge');
  if (badge) badge.style.display = 'none';

  let html = `
    <div class="quiz-era-header">
      <div class="quiz-era-badge">${question.era}</div>
      <div class="quiz-era-icon">${question.icon}</div>
      <div class="quiz-title">Daily Era Quiz</div>
      <div class="quiz-subtitle">One question per day. Get it right to earn a reward!<br>Come back tomorrow for a new question.</div>
    </div>`;

  if (alreadyAnswered) {
    // Already answered today
    if (wasCorrect) {
      html += `
        <div class="quiz-already-done">
          <div class="done-icon">✅</div>
          <h3>Already Claimed!</h3>
          <p>You answered today's question correctly and claimed your reward. Come back tomorrow for a new question!</p>
          <div class="quiz-timer">Next question in: <strong>${formatTimeLeft(msUntilMidnight())}</strong></div>
        </div>`;
    } else {
      html += `
        <div class="quiz-already-done">
          <div class="done-icon">😅</div>
          <h3>Better Luck Tomorrow!</h3>
          <p>You already attempted today's question. The correct answer was:<br><br>
          <strong style="color:var(--gold-bright)">${question.options[question.correct]}</strong></p>
          <p style="margin-top:8px;font-style:italic;font-size:0.75rem">${question.fact}</p>
          <div class="quiz-timer">New question in: <strong>${formatTimeLeft(msUntilMidnight())}</strong></div>
        </div>`;
    }
  } else {
    // Show the question
    const letters = ['A', 'B', 'C'];
    // Pick today's reward
    const rewards = [
      { icon: '❤️', label: '+1 Life',    type: 'life'    },
      { icon: '💣', label: 'Bomb ×1',    type: 'bomb'    },
      { icon: '🔨', label: 'Hammer ×1',  type: 'hammer'  },
      { icon: '🪙', label: '+75 Gold',   type: 'gold'    },
      { icon: '🔀', label: 'Shuffle ×1', type: 'shuffle' },
    ];
    const rewardSeed = Math.floor(new Date().getDate() + new Date().getMonth() * 31);
    const todayReward = rewards[rewardSeed % rewards.length];

    html += `
      <div class="quiz-reward-preview">
        <div class="reward-icon">${todayReward.icon}</div>
        <div class="reward-text">
          <strong>Today's Reward: ${todayReward.label}</strong>
          Answer correctly to claim it!
        </div>
      </div>
      <div class="quiz-question-card">
        <div class="quiz-question-num">Question of the Day</div>
        <div class="quiz-question-text">${question.question}</div>
      </div>
      <div class="quiz-options">`;

    question.options.forEach((opt, i) => {
      html += `
        <button class="quiz-option-btn" onclick="answerQuiz(${i}, ${question.correct}, '${todayReward.type}', '${todayReward.label}', '${todayReward.icon}')">
          <div class="quiz-option-letter">${letters[i]}</div>
          <div class="quiz-option-text">${opt}</div>
        </button>`;
    });

    html += `</div>`;
  }

  body.innerHTML = html;
  switchView('quizPage');
}

function answerQuiz(chosen, correct, rewardType, rewardLabel, rewardIcon) {
  // Disable all buttons immediately
  document.querySelectorAll('.quiz-option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('correct');
    else if (i === chosen && chosen !== correct) btn.classList.add('wrong');
  });

  const isCorrect = chosen === correct;
  const { question } = getTodaysQuestion();

  // Save result
  localStorage.setItem(getQuizAnsweredKey(), '1');
  localStorage.setItem(getQuizDayKey(), isCorrect ? 'correct' : 'wrong');

  setTimeout(() => {
    if (isCorrect) {
      // Apply reward
      switch(rewardType) {
        case 'life':
          gameState.lives = Math.min(99, gameState.lives + 1);
          localStorage.setItem('chrono_lives', gameState.lives);
          break;
        case 'bomb':
          gameState.boosters.bomb += 1;
          break;
        case 'hammer':
          gameState.boosters.hammer += 1;
          break;
        case 'shuffle':
          gameState.boosters.shuffle += 1;
          break;
        case 'gold':
          gameState.gold += 75;
          localStorage.setItem('chrono_gold', gameState.gold);
          const pg = document.getElementById('profileGold');
          if (pg) pg.innerText = gameState.gold;
          break;
      }
      showQuizResult(true, rewardIcon, rewardLabel, question.fact);
    } else {
      showQuizResult(false, null, null, question.fact);
    }
  }, 700);
}

function showQuizResult(correct, rewardIcon, rewardLabel, fact) {
  const card = document.getElementById('quizResultCard');
  card.className = 'quiz-result-card ' + (correct ? 'result-correct' : 'result-wrong');

  document.getElementById('quizResultIcon').textContent  = correct ? '🎉' : '😅';
  document.getElementById('quizResultTitle').textContent = correct ? 'Correct!' : 'Oops! Wrong Answer';
  document.getElementById('quizResultMsg').textContent   = correct
    ? 'Impressive! You really know your eras!'
    : 'Better luck tomorrow! A new question awaits.';

  const rewardEl = document.getElementById('quizResultReward');
  rewardEl.style.display = correct ? 'block' : 'none';
  if (correct) rewardEl.textContent = rewardIcon + ' ' + rewardLabel + ' added to your game!';

  document.getElementById('quizResultFact').textContent = '📚 ' + fact;

  toggleModal('quizResultModal', true);
  triggerVibration(correct ? [100, 40, 100] : [80]);
}

function closeQuizResult() {
  toggleModal('quizResultModal', false);
  openQuizPage(); // Refresh to show "already answered" state
}

function checkQuizBadge() {
  const answered = localStorage.getItem(getQuizAnsweredKey());
  const badge    = document.getElementById('quizBadge');
  if (badge) badge.style.display = answered ? 'none' : 'block';
}

/* ============================================================
   LIFE REFILL SYSTEM
   When lives hit 0, start a 12-hour countdown.
   When timer completes, refill to 5 lives automatically.
   Shows a progress bar and live countdown under the header.
   ============================================================ */

const LIFE_REFILL_MS    = 12 * 60 * 60 * 1000; // 12 hours in ms
const MAX_LIVES         = 5;
let   _lifeRefillTicker = null;

function updateLivesDisplay() {
  // Sync lives counter in header
  const lc = document.getElementById('livesCounter');
  if (lc) lc.innerText = gameState.lives;
  const cl = document.getElementById('mapCornerLives');
  if (cl) cl.innerText = gameState.lives;
}

function startLifeRefillTimer() {
  // Clear any existing ticker
  if (_lifeRefillTicker) { clearInterval(_lifeRefillTicker); _lifeRefillTicker = null; }

  const bar = document.getElementById('lifeRefillBar');
  if (!bar) return;

  // Only show timer when lives are exactly 0
  if (gameState.lives > 0) {
    bar.style.display = 'none';
    // Clear any stale timer if they have lives again (e.g. bought from shop)
    if (gameState.lives >= MAX_LIVES) {
      localStorage.removeItem('chrono_life_refill_at');
    }
    return;
  }

  // Lives = 0 — check if a refill timer is already running
  const refillAt = parseInt(localStorage.getItem('chrono_life_refill_at'));
  const now      = Date.now();

  if (!refillAt || isNaN(refillAt)) {
    // Start a fresh 12-hour timer from now
    const newRefillAt = now + LIFE_REFILL_MS;
    localStorage.setItem('chrono_life_refill_at', newRefillAt);
    tickLifeRefill(newRefillAt);
  } else if (now >= refillAt) {
    // Timer already expired — refill now
    grantLifeRefill();
  } else {
    // Timer still running — resume countdown
    tickLifeRefill(refillAt);
  }
}

function tickLifeRefill(refillAt) {
  const bar      = document.getElementById('lifeRefillBar');
  const timerEl  = document.getElementById('lifeRefillTimer');
  const fillEl   = document.getElementById('lifeRefillFill');

  if (!bar) return;
  bar.style.display = 'block';

  function update() {
    const now       = Date.now();
    const remaining = Math.max(0, refillAt - now);
    const elapsed   = LIFE_REFILL_MS - remaining;
    const pct       = Math.min(100, (elapsed / LIFE_REFILL_MS) * 100);

    // Format HH:MM:SS
    const h  = Math.floor(remaining / 3600000);
    const m  = Math.floor((remaining % 3600000) / 60000);
    const s  = Math.floor((remaining % 60000) / 1000);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');

    if (timerEl) timerEl.textContent = `${hh}:${mm}:${ss}`;
    if (fillEl)  fillEl.style.width  = pct + '%';

    if (remaining <= 0) {
      clearInterval(_lifeRefillTicker);
      _lifeRefillTicker = null;
      grantLifeRefill();
    }
  }

  update(); // Run immediately
  _lifeRefillTicker = setInterval(update, 1000);
}

function grantLifeRefill() {
  // Award 5 lives
  gameState.lives = MAX_LIVES;
  localStorage.setItem('chrono_lives', MAX_LIVES);
  localStorage.removeItem('chrono_life_refill_at');

  // Update UI
  updateLivesDisplay();

  const bar = document.getElementById('lifeRefillBar');
  if (bar) bar.style.display = 'none';

  // Show a toast so player knows
  showShopToast('❤️ Your 5 lives have been refilled!');
  triggerVibration([60, 30, 60]);
}
