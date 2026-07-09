/* ============================================================
   CHRONOCRUSH — logic.js  (DOM grid, no canvas for game board)
   v35 — custom SVG icons, removed backdrop haze
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
  boosters:       { hammer: 0, bomb: 0, shuffle: 0 },
  activeBooster: null,
  challengeTarget: null,
  challengeProgress: 0,
  levelMode: 'score',
  lastSeenEraName: null
};

// Fireworks
let fxCanvas = null, fxCtx = null, fxParticles = [], fxAnimationId = null;

const eraTimeline = [
  { name: "1940s Noir",          startLvl: 1,  endLvl: 10, items: ['📻','🎩','✒️','🎷'], accent: '#d4af37', hue: 0   },
  { name: "1950s Rockabilly",    startLvl: 11, endLvl: 20, items: ['🥤','🎸','🕶️','🚗'], accent: '#ff5e62', hue: 320 },
  { name: "1960s Psychedelic",   startLvl: 21, endLvl: 30, items: ['☮️','🌸','🚌','🎨'], accent: '#b19ffb', hue: 260 },
  { name: "1970s Disco",         startLvl: 31, endLvl: 40, items: ['🪩','✨','🛼','🕺'], accent: '#ffd700', hue: 300 },
  { name: "1980s Retro Synth",   startLvl: 41, endLvl: 50, items: ['🎮','📼','🕹️','📟'], accent: '#00f2fe', hue: 190 },
  { name: "1990s Grunge",        startLvl: 51, endLvl: 60, items: ['📀','☎️','🧥','🎧'], accent: '#c17a4f', hue: 20  },
  { name: "2000s Y2K Pop",       startLvl: 61, endLvl: 70, items: ['💿','📱','👛','🌐'], accent: '#ff69b4', hue: 330 },
  { name: "2001 Rise of the Web",startLvl: 71, endLvl: 80, items: ['💻','🖱️','📡','🔋'], accent: '#4facfe', hue: 210 },
  { name: "2002 Flip Phone Era", startLvl: 81, endLvl: 90, items: ['📲','🎵','🕹️','💾'], accent: '#34a853', hue: 150 }
];

// Applies each era's accent color + backdrop hue-shift so eras feel distinct
function applyEraTheme(era) {
  document.documentElement.style.setProperty('--era-accent', era.accent);
  document.documentElement.style.setProperty('--era-hue', era.hue + 'deg');
}

// ══════════════════════════════════════════════════════════════
// ERA COLLECTIBLES
// Cosmetic "cool but earned" items — one signature object per era.
// Players receive ONE random item per week (from eras they've unlocked)
// as a free reward. These are NOT buyable and do NOT help you win —
// they're pure collectibles you view in the Collection room. This keeps
// them special and keeps gold as a purely gameplay currency.
// ══════════════════════════════════════════════════════════════
const ERA_COLLECTIBLES = [
  { era: "1940s Noir",           icon: "📻", name: "Vintage Radio",     blurb: "A walnut-cased wireless that crackled with big-band swing." },
  { era: "1950s Rockabilly",     icon: "🎸", name: "Electric Guitar",   blurb: "The sound that made a whole generation start to rock." },
  { era: "1960s Psychedelic",    icon: "🌸", name: "Flower Crown",      blurb: "Peace, love, and a little tie-dye for good measure." },
  { era: "1970s Disco",          icon: "🪩", name: "Mirror Ball",       blurb: "Spinning light across a thousand dance floors." },
  { era: "1980s Retro Synth",    icon: "🕹️", name: "Arcade Joystick",   blurb: "Insert coin. High score or bust." },
  { era: "1990s Grunge",         icon: "🎧", name: "Studio Headphones", blurb: "For blasting your favourite album on repeat." },
  { era: "2000s Y2K Pop",        icon: "💿", name: "Burned CD",         blurb: "Your ultimate mixtape — 700MB of pure nostalgia." },
  { era: "2001 Rise of the Web", icon: "💻", name: "Laptop",            blurb: "The world wide web, right on your desk." },
  { era: "2002 Flip Phone Era",  icon: "📲", name: "Flip Phone",        blurb: "Snap it shut to end the call. Peak drama." }
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Which eras has the player unlocked (reached at least level 1 of)?
function getUnlockedEraIndexes() {
  const unlocked = [];
  eraTimeline.forEach((era, idx) => {
    if (gameState.highestUnlockedLevel >= era.startLvl) unlocked.push(idx);
  });
  return unlocked.length ? unlocked : [0];
}

function getOwnedCollectibles() {
  return JSON.parse(localStorage.getItem('chrono_collection') || '[]');
}

function saveOwnedCollectibles(list) {
  localStorage.setItem('chrono_collection', JSON.stringify(list));
}

// Called after every win — grants a weekly free era item if 7 days have
// passed since the last drop (or on the very first eligible win).
function checkWeeklyEraItem() {
  const lastDrop = parseInt(localStorage.getItem('chrono_last_era_item_at'));
  const now = Date.now();

  if (lastDrop && !isNaN(lastDrop) && (now - lastDrop) < WEEK_MS) return;

  // Pick a random collectible from unlocked eras that the player doesn't
  // already own; if they own them all, allow a duplicate-free skip.
  const owned = getOwnedCollectibles();
  const unlockedIdx = getUnlockedEraIndexes();
  const candidates = unlockedIdx.filter(idx => !owned.includes(idx));

  if (candidates.length === 0) {
    // Player owns everything currently unlocked — reset the timer so they
    // become eligible again once they unlock a new era.
    localStorage.setItem('chrono_last_era_item_at', now);
    return;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  owned.push(pick);
  saveOwnedCollectibles(owned);
  localStorage.setItem('chrono_last_era_item_at', now);

  // Queue the reveal to show after the level-success modal
  gameState._pendingEraItem = pick;
}

function maybeShowEraItemReward() {
  if (gameState._pendingEraItem === undefined || gameState._pendingEraItem === null) return;
  const idx = gameState._pendingEraItem;
  gameState._pendingEraItem = null;
  const item = ERA_COLLECTIBLES[idx];
  if (!item) return;

  const modal = document.getElementById('eraItemModal');
  if (!modal) return;

  document.getElementById('eraItemIcon').textContent  = item.icon;
  document.getElementById('eraItemName').textContent  = item.name;
  document.getElementById('eraItemEra').textContent   = item.era;
  document.getElementById('eraItemBlurb').textContent = item.blurb;

  toggleModal('eraItemModal', true);
  triggerVibration([80, 40, 120, 40, 200]);
}

function closeEraItemReward() {
  toggleModal('eraItemModal', false);
  loadHomepage();
}

function openCollectionPage() {
  const body = document.getElementById('collectionBody');
  if (!body) return;

  const owned = getOwnedCollectibles();
  const unlockedIdx = getUnlockedEraIndexes();

  let html = `<p class="collection-intro">Earn one free era collectible each week.<br>Unlock more eras to widen your collection!</p>`;
  html += `<div class="collection-progress">${owned.length} / ${ERA_COLLECTIBLES.length} collected</div>`;
  html += `<div class="collection-grid">`;

  ERA_COLLECTIBLES.forEach((item, idx) => {
    const isOwned    = owned.includes(idx);
    const isUnlocked = unlockedIdx.includes(idx);
    let state = 'locked', display = '❓', sub = 'Locked';
    if (isOwned)          { state = 'owned';    display = item.icon; sub = 'Collected'; }
    else if (isUnlocked)  { state = 'unowned';  display = '🎁';      sub = 'Not yet earned'; }

    html += `
      <div class="collection-card collection-${state}">
        <div class="collection-icon">${display}</div>
        <div class="collection-name">${isOwned ? item.name : (isUnlocked ? '???' : 'Locked')}</div>
        <div class="collection-era">${item.era}</div>
        ${isOwned ? `<div class="collection-blurb">${item.blurb}</div>` : ''}
        <div class="collection-state-label">${sub}</div>
      </div>`;
  });

  html += `</div>`;
  body.innerHTML = html;
  switchView('collectionPage');
}

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

  // Restore purchased boosters from localStorage on boot
  const savedBoosters = JSON.parse(localStorage.getItem("chrono_boosters") || 'null');
  if (savedBoosters) gameState.boosters = savedBoosters;

  gameState.lastSeenEraName  = localStorage.getItem("chrono_last_era") || eraTimeline[0].name;
  gameState.authProvider     = localStorage.getItem("chrono_auth_provider") || "Guest";

  syncSettingsUI();

  fxCanvas = document.getElementById("fireworksCanvas");
  if (fxCanvas) fxCtx = fxCanvas.getContext("2d");
  window.addEventListener("resize", resizeFireworksCanvas);

  switchView("loadingScreen");
  setTimeout(() => {
    const savedProvider = localStorage.getItem("chrono_auth_provider");
    const savedTerms    = localStorage.getItem("chrono_terms_agreed_permanent");

    if (savedProvider && savedTerms) {
      afterAuthSuccess();
    } else {
      switchView("authScreen");
    }
    checkPaymentReturn();
  }, 900);

  initOfflineDetection();
}

function initOfflineDetection() {
  function updateOnlineStatus() {
    const banner = document.getElementById('offlineBanner');
    const isOffline = !navigator.onLine;

    if (banner) banner.style.display = isOffline ? 'block' : 'none';

    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
      if (isOffline) {
        googleBtn.disabled = true;
        googleBtn.style.opacity = '0.4';
        googleBtn.title = 'Google sign-in requires internet connection';
      } else {
        googleBtn.disabled = false;
        googleBtn.style.opacity = '1';
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
   GAME-FEEL POLISH HELPERS
   ============================================================ */

// Floating score / praise popups
function spawnScorePopup(text, x, y, praise) {
  const el = document.createElement('div');
  el.className = 'score-popup' + (praise ? ' praise' : '');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// Get screen-centre of a group of matched tiles
function getMatchCentroid(matches) {
  let sx = 0, sy = 0, n = 0;
  matches.forEach(p => {
    const tile = getTile(p.r, p.c);
    if (!tile) return;
    const rect = tile.getBoundingClientRect();
    sx += rect.left + rect.width / 2;
    sy += rect.top  + rect.height / 2;
    n++;
  });
  if (n === 0) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return { x: sx / n, y: sy / n };
}

// Bump animation on a stat value (score / moves / gold)
function bumpStat(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove('stat-bump');
  void el.offsetWidth;
  el.classList.add('stat-bump');
}

function bumpGoldPill() {
  document.querySelectorAll('.gold-pill, .shop-balance-amount').forEach(el => {
    el.classList.remove('gold-bump');
    void el.offsetWidth;
    el.classList.add('gold-bump');
  });
}

function buildDomBoard() {
  const board = document.getElementById('domBoard');
  if (!board) return;
  board.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = document.createElement('div');
      tile.className = 'board-tile tile-enter';
      // Staggered entrance: diagonal wave from top-left
      tile.style.animationDelay = ((r + c) * 42) + 'ms';
      tile.dataset.r = r;
      tile.dataset.c = c;
      tile.addEventListener('click', onTileClick);
      board.appendChild(tile);
    }
  }
  renderBoard();
  // Clean up entrance classes once the wave completes
  setTimeout(() => {
    board.querySelectorAll('.board-tile').forEach(t => {
      t.classList.remove('tile-enter');
      t.style.animationDelay = '';
    });
  }, (BOARD_SIZE * 2) * 42 + 450);
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
    const sr = gameState.selectedTile.r;
    const sc = gameState.selectedTile.c;
    const dr = Math.abs(sr - r);
    const dc = Math.abs(sc - c);

    if (dr === 0 && dc === 0) {
      gameState.selectedTile = null;
      renderBoard();
      return;
    }

    const selectedVal = gameState.grid[sr][sc];
    const targetVal   = gameState.grid[r][c];

    if (selectedVal === DISCO_BALL || targetVal === DISCO_BALL) {
      swapTiles(sr, sc, r, c);
      return;
    }

    if (dr + dc === 1) {
      swapTiles(sr, sc, r, c);
    } else {
      gameState.selectedTile = { r, c };
      triggerVibration(25);
      renderBoard();
    }
  }
}

function clearHighlight() {
  const board = document.getElementById('domBoard');
  if (board) board.querySelectorAll('.board-tile.selected').forEach(t => t.classList.remove('selected'));
}

// Clears all animation classes before rendering so refilled tiles never appear blank
function renderBoard() {
  const board = document.getElementById('domBoard');
  if (!board) return;
  const tiles = board.querySelectorAll('.board-tile');
  tiles.forEach(tile => {
    const r = parseInt(tile.dataset.r);
    const c = parseInt(tile.dataset.c);
    const v = gameState.grid[r] ? gameState.grid[r][c] : null;
    tile.classList.remove('matched', 'dropping', 'swapping', 'disco-ball-explode');
    if (v === DISCO_BALL) {
      tile.textContent = '✦';
      tile.classList.add('disco-ball-tile');
      tile.title = 'DISCO BALL — swap with any tile!';
    } else {
      tile.textContent = v || '';
      tile.classList.remove('disco-ball-tile');
      tile.title = '';
    }
    tile.classList.toggle('selected',
      !!(gameState.selectedTile &&
         gameState.selectedTile.r === r &&
         gameState.selectedTile.c === c)
    );
  });
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

  if (gameState.grid[r] && gameState.grid[r][c] === DISCO_BALL) return;
  tile.classList.remove('dropping');
  void tile.offsetWidth;
  tile.classList.add('dropping');

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

function initAudio() {
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (gameState.audioCtx.state === 'suspended') gameState.audioCtx.resume();

  resumeMusicAfterInteraction();
}

function getCurrentEraForLevel(level) {
  return eraTimeline.find(e => level >= e.startLvl && level <= e.endLvl) || eraTimeline[0];
}

let _bgAudio       = null;
let _bgFadeTimer   = null;

function _getBgAudio() {
  if (_bgAudio) return _bgAudio;
  _bgAudio = new Audio('audio/background.mp3');
  _bgAudio.loop   = true;
  _bgAudio.volume = 0;
  _bgAudio.preload = 'auto';

  _bgAudio.addEventListener('error', (e) => {
    console.warn('Audio load error:', e);
  });
  return _bgAudio;
}

function startSpaceMusic() {
  if (!gameState.preferences.sound) return;
  const audio = _getBgAudio();

  if (!audio.paused) return;

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {});
  }

  _fadeVolume(0, 0.45, 2000);
}

function stopSpaceMusic() {
  if (!_bgAudio || _bgAudio.paused) return;

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

function switchView(id) {
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
}

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

function loadHomepage() {
  switchView("homePage");
  applyEraTheme(getCurrentEraForLevel(gameState.highestUnlockedLevel));
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

function toggleModal(id, open) {
  const m = document.getElementById(id);
  if (!m) return;
  if (open) {
    m.style.display = '';
    m.classList.add('visible');
    if (id === 'levelSuccessModal') { resizeFireworksCanvas(); spawnFireworksBurst(); runFireworksLoop(); }
  } else {
    m.classList.remove('visible');
    m.style.display = 'none';
    if (id === 'levelSuccessModal') { cancelAnimationFrame(fxAnimationId); fxParticles = []; }

    requestAnimationFrame(() => { if (!m.classList.contains('visible')) m.style.display = ''; });
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

function getDifficulty(lvl) {
  const base = _getBaseDifficulty(lvl);

  // ── MID-ERA PRESSURE RAMP ──
  // Each era is 10 levels. In the FIRST half of an era, targets are as
  // tuned. From the midpoint onward, we gently raise the score target
  // (up to +18% by the last level of the era) and trim one move on the
  // final two levels. This makes the back half of every era noticeably
  // tougher, so players burn through boosters and gradually feel a real
  // reason to top up gold — without an abrupt difficulty wall.
  const posInEra = (lvl - 1) % 10; // 0..9
  if (posInEra >= 5) {
    const rampT = (posInEra - 5) / 4;              // 0 at level 6, 1 at level 10 of the era
    const scoreMult = 1 + rampT * 0.18;            // up to +18%
    base.targetScore = Math.round(base.targetScore * scoreMult);
    if (posInEra >= 8 && base.moves > 15) {
      base.moves -= 1;                             // last two levels: one fewer move
    }
  }

  return base;
}

function _getBaseDifficulty(lvl) {
  if (lvl <= 9) {
    return {
      moves:          20,
      targetScore:    200 + lvl * 60,
      challengeCount: 4 + Math.floor(lvl * 0.5),
      boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
    };
  }

  if (lvl <= 29) {
    const t = (lvl - 10) / 19;
    return {
      moves:          20,
      targetScore:    Math.round(1500 + t * 3000),
      challengeCount: Math.round(10  + t * 8),
      boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
    };
  }

  if (lvl <= 49) {
    const t = (lvl - 30) / 19;
    return {
      moves:          20,
      targetScore:    Math.round(8000 + t * 3500),
      challengeCount: Math.round(22  + t * 8),
      boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
    };
  }

  if (lvl <= 59) {
    const t = (lvl - 50) / 9;
    return {
      moves:          35,
      targetScore:    Math.round(12000 + t * 3000),
      challengeCount: Math.round(31   + t * 7),
      boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
    };
  }

  if (lvl <= 70) {
    const t = (lvl - 60) / 10;
    return {
      moves:          35,
      targetScore:    Math.round(16000 + t * 3500),
      challengeCount: Math.round(39   + t * 9),
      boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
    };
  }

  if (lvl <= 80) {
    const t = (lvl - 71) / 9;
    return {
      moves:          35,
      targetScore:    Math.round(20000 + t * 3000),
      challengeCount: Math.round(49   + t * 8),
      boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
    };
  }

  const t = (lvl - 81) / 9;
  return {
    moves:          20,
    targetScore:    Math.round(23500 + t * 500),
    challengeCount: Math.round(58   + t * 10),
    boosters:       { hammer: 0, bomb: 0, shuffle: 0 }
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

  // ADD difficulty boosters on top of existing ones — preserves shop purchases
  gameState.boosters.hammer  += diff.boosters.hammer;
  gameState.boosters.bomb    += diff.boosters.bomb;
  gameState.boosters.shuffle += diff.boosters.shuffle;

  const era = getCurrentEraForLevel(lvl);

  if (lvl <= 20) {
    // IMPORTANT: challenge item must come from the same reduced 3-item pool
    // the board actually spawns (generateBoard only ever uses the first 3
    // items of an era). Picking from all 4 era.items caused levels to ask
    // for a tile that could never appear on the board.
    const boardPool     = era.items.slice(0, 3);
    const challengeItem = boardPool[(lvl - 1) % boardPool.length];
    const clearCount    = 6 + Math.floor(lvl * 0.4);
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

  applyEraTheme(era);
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

function generateBoard(itemSet) {
  const reduced = itemSet.slice(0, 3);

  for (let r = 0; r < BOARD_SIZE; r++) {
    gameState.grid[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      gameState.grid[r][c] = randomItem(reduced);
    }
  }

  let guard = 0;
  while (findBoardMatches().matches.length > 0 && guard < 50) {
    resolveSilentMatches(reduced); guard++;
  }
}

function randomItem(itemSet) {
  const items = itemSet || getCurrentEraForLevel(gameState.currentLevel).items;
  return items[Math.floor(Math.random() * items.length)];
}

function resolveSilentMatches(itemSet) {
  findBoardMatches().matches.forEach(pos => { gameState.grid[pos.r][pos.c] = randomItem(itemSet); });
}

function selectBooster(type) {
  if (!gameState.isGameActive || gameState.boosters[type] <= 0) return;
  gameState.activeBooster = (gameState.activeBooster === type) ? null : type;
  updateBoosterUI();
  if (gameState.activeBooster === 'shuffle') useShuffleBooster();
}

function updateBoosterUI() {
  ['hammer','bomb','shuffle'].forEach(t => {
    const btn  = document.getElementById(`booster${t.charAt(0).toUpperCase()+t.slice(1)}Btn`);
    const cnt  = document.getElementById(`${t}Count`);
    const have = gameState.boosters[t];

    if (cnt) cnt.innerText = have;

    // The booster slot shows the inventory count when you own at least one,
    // and swaps to the "+" (buy) button only once you hit zero.
    const slot = btn ? btn.closest('.booster-slot') : null;
    if (slot) {
      const plus = slot.querySelector('.booster-plus-btn');
      if (have > 0) {
        if (cnt)  cnt.style.display  = '';
        if (plus) plus.style.display = 'none';
      } else {
        if (cnt)  cnt.style.display  = 'none';
        if (plus) plus.style.display = '';
      }
    }

    if (btn) {
      btn.classList.toggle('selected', gameState.activeBooster === t);
      btn.disabled = have <= 0;
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
  renderBoard();
  localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
}

function useHammerOnTile(r, c) {
  if (gameState.boosters.hammer <= 0) return;
  gameState.boosters.hammer--;
  const era = getCurrentEraForLevel(gameState.currentLevel);
  destroyTile(r, c, era.items);
  gameState.activeBooster = null;
  triggerVibration(60);
  updateBoosterUI();
  localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
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
  localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
  setTimeout(() => refillDestroyedTiles(destroyed, era.items), 280);
}

function applyGravityAndRefill(items) {
  const era  = getCurrentEraForLevel(gameState.currentLevel);
  const pool = (items || era.items).slice(0, 3);

  for (let c = 0; c < BOARD_SIZE; c++) {
    const survive = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const v = gameState.grid[r][c];
      if (v !== null && v !== undefined && v !== '') survive.push(v);
    }

    while (survive.length < BOARD_SIZE) survive.push(randomItem(pool));

    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      gameState.grid[r][c] = survive[BOARD_SIZE - 1 - r];
    }
  }

  let guard = 0;
  while (findBoardMatches().matches.length > 0 && guard++ < 20) {
    const pool3 = pool;
    findBoardMatches().matches.forEach(p => {
      gameState.grid[p.r][p.c] = randomItem(pool3);
    });
  }

  renderBoard();

  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (gameState.grid[r][c] !== DISCO_BALL) animateDrop(r, c);
}

function refillDestroyedTiles(positions, itemSet) {
  positions.forEach(pos => { gameState.grid[pos.r][pos.c] = null; });
  applyGravityAndRefill(itemSet);
  setTimeout(checkChallengeAndScore, 700);
}

function destroyTile(r, c, itemSet) {
  if (gameState.challengeTarget && gameState.grid[r][c] === gameState.challengeTarget.item) {
    gameState.challengeProgress++;
  }
  animateMatch(r, c);
  gameState.grid[r][c] = null;
}

function activateDiscoBall(r, c, targetItem) {
  const era   = getCurrentEraForLevel(gameState.currentLevel);
  const items = era.items.slice(0, 3);

  if (!targetItem || targetItem === DISCO_BALL) {
    const counts = {};
    items.forEach(item => counts[item] = 0);
    for (let row = 0; row < BOARD_SIZE; row++)
      for (let col = 0; col < BOARD_SIZE; col++) {
        const t = gameState.grid[row][col];
        if (t && t !== DISCO_BALL && counts[t] !== undefined) counts[t]++;
      }
    targetItem = Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0];
  }

  const ballTile = getTile(r, c);
  if (ballTile) {
    ballTile.classList.add('disco-ball-explode');
    const rect = ballTile.getBoundingClientRect();
    spawnScorePopup('✦ DISCO! ✦', rect.left + rect.width / 2, rect.top, true);
  }

  gameState.grid[r][c] = null;

  for (let row = 0; row < BOARD_SIZE; row++)
    for (let col = 0; col < BOARD_SIZE; col++)
      if (gameState.grid[row][col] === targetItem) {
        animateMatch(row, col);
        gameState.grid[row][col] = null;
      }

  gameState.score += 10;
  document.getElementById("scoreDisplay").innerText = gameState.score.toLocaleString();
  bumpStat('scoreDisplay');
  triggerVibration([80, 30, 80, 30, 120]);

  setTimeout(() => {
    applyGravityAndRefill(items);
    updateChallengeBanner();
  }, 500);
}

function swapTiles(r1, c1, r2, c2) {
  const v1 = gameState.grid[r1][c1];
  const v2 = gameState.grid[r2][c2];

  if (v1 === DISCO_BALL || v2 === DISCO_BALL) {
    const discoR  = v1 === DISCO_BALL ? r1 : r2;
    const discoC  = v1 === DISCO_BALL ? c1 : c2;
    const target  = v1 === DISCO_BALL ? v2 : v1;
    gameState.moves--;
    document.getElementById("movesDisplay").innerText = gameState.moves;
    gameState.selectedTile = null;
    renderBoard();
    activateDiscoBall(discoR, discoC, target);
    return;
  }

  gameState.grid[r1][c1] = v2;
  gameState.grid[r2][c2] = v1;
  gameState.moves--;
  document.getElementById("movesDisplay").innerText = gameState.moves;
  triggerVibration(40);
  gameState.selectedTile = null;
  renderBoard();
  animateSwap(r1, c1);
  animateSwap(r2, c2);
  setTimeout(checkChallengeAndScore, 300);
}

const DISCO_BALL = '__DISCO__';

function findBoardMatches() {
  const matches = [];
  const match5s = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    let c = 0;
    while (c < BOARD_SIZE) {
      const v = gameState.grid[r][c];
      if (!v || v === DISCO_BALL) { c++; continue; }
      let len = 1;
      while (c + len < BOARD_SIZE && gameState.grid[r][c + len] === v) len++;
      if (len >= 3) {
        const grp = [];
        for (let k = 0; k < len; k++) grp.push({ r, c: c + k });
        if (len >= 5) match5s.push({ positions: grp, item: v });
        matches.push(...grp);
      }
      c += len;
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let r = 0;
    while (r < BOARD_SIZE) {
      const v = gameState.grid[r][c];
      if (!v || v === DISCO_BALL) { r++; continue; }
      let len = 1;
      while (r + len < BOARD_SIZE && gameState.grid[r + len][c] === v) len++;
      if (len >= 3) {
        const grp = [];
        for (let k = 0; k < len; k++) grp.push({ r: r + k, c });
        if (len >= 5) match5s.push({ positions: grp, item: v });
        matches.push(...grp);
      }
      r += len;
    }
  }

  const seen = new Set();
  const unique = matches.filter(m => {
    const k = `${m.r},${m.c}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  return { matches: unique, match5s };
}

function checkChallengeAndScore() {
  const era  = getCurrentEraForLevel(gameState.currentLevel);
  const pool = era.items.slice(0, 3);
  const { matches, match5s } = findBoardMatches();

  if (matches.length === 0) {
    evaluateLevelEndConditions();
    return;
  }

  const pts = gameState.currentLevel <= 9  ? 50  :
              gameState.currentLevel <= 29 ? 100 :
              gameState.currentLevel <= 49 ? 150 :
              gameState.currentLevel <= 59 ? 200 :
              gameState.currentLevel <= 70 ? 250 : 300;

  const gained = matches.length * pts;
  const prevScore = gameState.score;
  gameState.score += gained;
  document.getElementById('scoreDisplay').innerText = gameState.score.toLocaleString();
  bumpStat('scoreDisplay');
  triggerVibration([60, 40, 60]);

  // ── Floating score popup at the centre of the match ──
  const centroid = getMatchCentroid(matches);
  spawnScorePopup('+' + gained.toLocaleString(), centroid.x, centroid.y, false);

  // ── Praise text for big matches ──
  if (matches.length >= 4) {
    const praise = matches.length >= 7 ? 'AMAZING!'
                 : matches.length >= 5 ? 'GREAT!'
                 : 'NICE!';
    setTimeout(() => {
      spawnScorePopup(praise, centroid.x, centroid.y - 34, true);
    }, 140);
    triggerVibration([40, 30, 40, 30, 90]);
  }

  // ── Celebrate the moment the target is crossed ──
  if (gameState.levelMode === 'score' &&
      prevScore < gameState.targetScore &&
      gameState.score >= gameState.targetScore) {
    const banner = document.getElementById('challengeBanner');
    if (banner) {
      banner.classList.remove('banner-party');
      void banner.offsetWidth;
      banner.classList.add('banner-party');
    }
  }

  matches.forEach(p => {
    if (gameState.challengeTarget && gameState.grid[p.r][p.c] === gameState.challengeTarget.item)
      gameState.challengeProgress++;
  });
  updateChallengeBanner();

  const discoBallPos = [];
  match5s.forEach(m5 => {
    if (Math.random() < 0.7) {
      const mid = Math.floor(m5.positions.length / 2);
      discoBallPos.push(m5.positions[mid]);
    }
  });

  matches.forEach(p => animateMatch(p.r, p.c));
  matches.forEach(p => { gameState.grid[p.r][p.c] = null; });

  setTimeout(() => {
    applyGravityAndRefill(pool);

    discoBallPos.forEach(p => {
      gameState.grid[p.r][p.c] = DISCO_BALL;
    });
    if (discoBallPos.length > 0) renderBoard();

    setTimeout(evaluateLevelEndConditions, 300);
  }, 420);
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
    const done      = gameState.challengeProgress;
    const total     = gameState.challengeTarget.count;
    const remaining = Math.max(0, total - done);
    if (targetEl) targetEl.innerText = `${done}/${total}`;
    banner.innerText = remaining > 0
      ? `Clear ${remaining} more ${gameState.challengeTarget.item} to pass!`
      : `Level complete! 🎉`;
  } else {
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
    const challengeMet = gameState.challengeTarget &&
                         gameState.challengeProgress >= gameState.challengeTarget.count;
    if (challengeMet) { setTimeout(win, 400); return; }
  } else {
    if (gameState.score >= gameState.targetScore) { setTimeout(win, 400); return; }
  }
  if (gameState.moves <= 0) {
    setTimeout(() => {
      gameState.isGameActive = false;

      if (gameState.lifeShield) {
        gameState.lifeShield = false;
        localStorage.removeItem("chrono_shield");
        showShopToast("🛡️ Life Shield saved you!");
        showFailModal(true);
      } else {
        gameState.lives = Math.max(0, gameState.lives - 1);
        localStorage.setItem("chrono_lives", gameState.lives);
        updateLivesDisplay();

        if (gameState.lives === 0) {
          if (!localStorage.getItem('chrono_life_refill_at')) {
            localStorage.setItem('chrono_life_refill_at', Date.now() + LIFE_REFILL_MS);
          }
          startLifeRefillTimer();
        }
        showFailModal(false);
      }
    }, 500);
  }
}

function showFailModal(shieldSaved) {
  const pct = Math.round((gameState.score / gameState.targetScore) * 100);

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

function win() {
  gameState.isGameActive = false;
  triggerVibration([100,40,100,40,300]);
  const stars = gameState.score > gameState.targetScore * 1.4 ? 3
              : gameState.score > gameState.targetScore * 1.1 ? 2 : 1;
  gameState.levelRecords[gameState.currentLevel] = stars;
  localStorage.setItem("chrono_level_records", JSON.stringify(gameState.levelRecords));

  // ── SCARCE COIN ECONOMY ──
  // Base 5 coins per level + a modest star bonus (5 / 7 / 9 for 1/2/3 stars).
  // Across a 10-level era that's ~50-90 coins — enough to feel earned,
  // never enough to make gold purchases pointless. Free boosters on win
  // were REMOVED entirely: boosters are now something you spend coins on
  // or earn sparingly, which is what gives the shop a reason to exist.
  const coinReward = 5 + (stars >= 3 ? 4 : stars >= 2 ? 2 : 0);
  gameState.gold += coinReward;
  localStorage.setItem("chrono_gold", gameState.gold);

  if (gameState.currentLevel === gameState.highestUnlockedLevel && gameState.highestUnlockedLevel < gameState.totalLevels) {
    gameState.highestUnlockedLevel++;
    localStorage.setItem("chrono_highest_level", gameState.highestUnlockedLevel);
  }
  document.getElementById("modalRecordsDisplay").innerHTML = "📀".repeat(stars);
  trackDailyWin();
  checkAwardsBadge();
  checkWeeklyEraItem();

  const justCompletedEra = checkEraCompletion(gameState.currentLevel);

  switchView("homePage");
  toggleModal('levelSuccessModal', true);

  if (justCompletedEra) {
    setTimeout(() => {
      toggleModal('levelSuccessModal', false);
      showEraTrophyModal(justCompletedEra);
      // If a weekly item also dropped this win, show it after the trophy
      if (gameState._pendingEraItem !== null && gameState._pendingEraItem !== undefined) {
        gameState._eraItemAfterTrophy = true;
      }
    }, 2200);
  } else if (gameState._pendingEraItem !== null && gameState._pendingEraItem !== undefined) {
    // No era completion — reveal the weekly item shortly after success modal
    setTimeout(() => {
      toggleModal('levelSuccessModal', false);
      maybeShowEraItemReward();
    }, 2400);
  }
}

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

function exitToHome() { gameState.isGameActive=false; gameState.activeBooster=null; loadHomepage(); }
function transitionToMap() { initAudio(); triggerFlashAnimation(); loadHomepage(); }

/* ── Shop navigation that remembers where you came from ── */
let _shopReturnView = null;

function openShopFromGame() {
  // Opened via the "+" buttons next to boosters mid-level
  _shopReturnView = 'gamePlayScreen';
  const disp = document.getElementById('shopGoldDisplay');
  if (disp) disp.textContent = gameState.gold.toLocaleString();
  switchView('shopPage');
}

function closeShop() {
  if (_shopReturnView === 'gamePlayScreen' && gameState.isGameActive) {
    _shopReturnView = null;
    switchView('gamePlayScreen');
    updateBoosterUI();
  } else {
    _shopReturnView = null;
    loadHomepage();
  }
}

window.afterFirebaseAuth = function(user) {
  if (!user) return;
  gameState.authProvider = user.providerData[0] ? 'Google' : 'Social';
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
  localStorage.setItem('chrono_terms_agreed_permanent', '1');
  afterAuthSuccess();
}

function showTermsAgreePopup() {
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
  const modal = document.getElementById('termsAgreeModal');
  if (modal) {
    modal.classList.remove('visible');
    modal.style.display = 'none';
  }

  const provider = _pendingAuthProvider;
  _pendingAuthProvider = null;

  setTimeout(() => {
    if (provider === 'guest') {
      _doGuestAuth();
    } else if (provider === 'google_redirect_complete') {
      afterAuthSuccess();
    } else if (provider) {
      localStorage.setItem('chrono_terms_agreed', '1');
      _doSocialAuth(provider);
    }
  }, 80);
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
  toggleModal('settingsModal', false);
  toggleModal('howToPlayModal', true);
}

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

function openShopPage() {
  _shopReturnView = null; // opened from home footer
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
      gameState.lives = MAX_LIVES;
      localStorage.setItem("chrono_lives", gameState.lives);
      showShopToast("❤️ Lives refilled!");
      break;
    case 'hammer':
      gameState.boosters.hammer += 1;
      showShopToast("🔨 Hammer added!");
      break;
    case 'bomb':
      gameState.boosters.bomb += 1;
      showShopToast("💣 Time Bomb added!");
      break;
    case 'shuffle':
      gameState.boosters.shuffle += 1;
      showShopToast("🔀 Shuffle added!");
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
      const todayKey = 'chrono_free_gold_' + new Date().toDateString();
      if (localStorage.getItem(todayKey)) {
        showShopToast('Already claimed today! Come back tomorrow.', 'error');
        gameState.gold += cost;
      } else {
        gameState.gold += 10;
        localStorage.setItem(todayKey, '1');
        showShopToast('🪙 +10 Free Gold claimed! Come back tomorrow.');
      }
      break;
    }
  }

  // Persist boosters + gold immediately after every purchase
  localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
  localStorage.setItem("chrono_gold", gameState.gold);

  const profileGold = document.getElementById("profileGold");
  if (profileGold) profileGold.innerText = gameState.gold;
  const shopDisp = document.getElementById("shopGoldDisplay");
  if (shopDisp) shopDisp.textContent = gameState.gold.toLocaleString();
  bumpGoldPill();
  updateBoosterUI();
  triggerVibration(40);
}

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

// ══════════════════════════════════════════════════════════════
// GOOGLE PLAY BILLING — placeholder scaffold
//
// SETUP (once closed testing passes and you're ready to sell gold):
// 1. In Play Console → Monetize → Products → In-app products, create
//    one managed product per packageId below with matching Product ID.
// 2. Set PLAY_BILLING_ENABLED = true.
// 3. This uses the Digital Goods API + PaymentRequest, the standard
//    path for a TWA/PWA wrapped via PWABuilder and published on Play.
// 4. Purchase tokens should be verified server-side (Cloud Function +
//    Play Developer API) before granting gold in production — this
//    client-side grant is fine for testing but not for launch.
// ══════════════════════════════════════════════════════════════
const PLAY_BILLING_ENABLED = false; // flip to true once Play Console products exist

const PLAY_BILLING_PRODUCT_IDS = {
  '1000gold': 'gold_1000',
  '2000gold': 'gold_2000'
};

let _digitalGoodsService = null;
async function getDigitalGoodsService() {
  if (_digitalGoodsService) return _digitalGoodsService;
  if ('getDigitalGoodsService' in window) {
    try {
      _digitalGoodsService = await window.getDigitalGoodsService('https://play.google.com/billing');
      return _digitalGoodsService;
    } catch (e) {
      console.warn('Digital Goods Service unavailable:', e);
    }
  }
  return null;
}

let pendingPayment = null;

function initiatePayment(packageId, displayPrice, goldCoins) {
  pendingPayment = { packageId, displayPrice, goldCoins };

  const labels = {
    '1000gold': 'Gold Pouch — 1,000 Gold',
    '2000gold': 'Gold Chest — 2,000 Gold',
  };

  document.getElementById('paymentModalTitle').textContent = labels[packageId] || 'Buy Gold';
  document.getElementById('paymentGoldAmt').textContent    = goldCoins.toLocaleString();
  document.getElementById('paymentModalPrice').textContent = displayPrice;

  toggleModal('paymentModal', true);
}

function _grantGoldTestMode(goldCoins, note) {
  gameState.gold += goldCoins;
  localStorage.setItem('chrono_gold', gameState.gold);
  const pg = document.getElementById('profileGold');
  if (pg) pg.innerText = gameState.gold;
  const sd = document.getElementById('shopGoldDisplay');
  if (sd) sd.textContent = gameState.gold.toLocaleString();
  bumpGoldPill();
  showShopToast('🪙 +' + goldCoins.toLocaleString() + ' Gold added!' + (note ? ' (' + note + ')' : ''));
  toggleModal('paymentModal', false);
  pendingPayment = null;
}

async function confirmPayment() {
  if (!pendingPayment) return;
  const { packageId, goldCoins } = pendingPayment;

  // Not yet configured in Play Console — grant in test mode so the
  // shop flow is fully testable before billing goes live.
  if (!PLAY_BILLING_ENABLED) {
    _grantGoldTestMode(goldCoins, 'Test mode — Play Billing not yet configured');
    return;
  }

  const productId = PLAY_BILLING_PRODUCT_IDS[packageId];
  if (!productId) {
    showShopToast('Product not configured.', 'error');
    return;
  }

  try {
    const paymentMethodData = [{
      supportedMethods: 'https://play.google.com/billing',
      data: { sku: productId }
    }];
    const paymentDetails = {
      total: {
        label: 'CHRONOCRUSH Gold',
        amount: { currency: 'USD', value: '0' } // actual price set in Play Console
      }
    };

    const request = new PaymentRequest(paymentMethodData, paymentDetails);
    const paymentResponse = await request.show();

    // ── In production: send paymentResponse.details.purchaseToken to your
    //    backend, verify with the Play Developer API, THEN grant gold and
    //    call acknowledge()/consume() on the Digital Goods Service. ──
    await paymentResponse.complete('success');

    _grantGoldTestMode(goldCoins, null);
  } catch (err) {
    console.warn('Play Billing purchase failed or cancelled:', err);
    showShopToast('Purchase cancelled or unavailable.', 'error');
    toggleModal('paymentModal', false);
    pendingPayment = null;
  }
}

function checkPaymentReturn() {
  // Play Billing purchases resolve via PaymentRequest directly (no
  // redirect round-trip needed), so this is kept only for backward
  // compatibility with any old ?payment= links already shared.
  const params = new URLSearchParams(window.location.search);
  const result = params.get('payment');
  if (result === 'success') {
    setTimeout(() => {
      showShopToast('✅ Payment received! Your gold will arrive shortly.');
      window.history.replaceState({}, '', window.location.pathname);
    }, 800);
  } else if (result === 'cancel') {
    setTimeout(() => {
      showShopToast('Payment cancelled.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }, 800);
  }
}

function copyInviteLink() {
  const link = window.location.href.split('?')[0];
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(()=>alert("Copied!")).catch(()=>alert("Link: "+link));
  else alert("Link: "+link);
}

function shareToFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href.split('?')[0])}`, '_blank', 'width=600,height=400');
}

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
    const maxStars = totalLevels * 3;

    let starsHtml = '';
    if (tier !== 'locked') {
      const avg = totalStars / totalLevels;
      const fullStars = Math.floor(avg);
      starsHtml = '📀'.repeat(fullStars) + (avg % 1 >= 0.5 ? '⭐' : '');
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

function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRand(seed, n) {
  const val = ((seed * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  return val % n;
}

function getDailyTasks() {
  const seed = getDailySeed();
  const currentEra = getCurrentEraForLevel(gameState.highestUnlockedLevel);
  const eraIdx = eraTimeline.indexOf(currentEra);

  const eraResult = getEraTrophy(currentEra);
  const eraComplete = eraResult.tier !== 'locked';

  const dailyWinsKey = `chrono_daily_wins_${getDailySeed()}`;
  const dailyWins = parseInt(localStorage.getItem(dailyWinsKey)) || 0;

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
      reward: '🪙 +15 Gold',
      rewardKey: 'gold_15',
      done: dailyWins >= 3,
      progress: Math.min(dailyWins, 3),
      total: 3
    },
    {
      id: 'three_star',
      icon: '📀',
      title: `3-Star Level ${targetLvl}`,
      desc: `Score high enough to earn 3 stars on Level ${targetLvl}`,
      reward: '🪙 +20 Gold',
      rewardKey: 'gold_20',
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

  const tasks    = getDailyTasks();
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

  const allDone = tasks.every(t => t.done);
  const badge   = document.getElementById('dailyBadge');
  if (badge) badge.style.display = allDone ? 'none' : 'block';

  switchView('dailyPage');
}

function trackDailyWin() {
  const key = `chrono_daily_wins_${getDailySeed()}`;
  const wins = (parseInt(localStorage.getItem(key)) || 0) + 1;
  localStorage.setItem(key, wins);

  if (wins === 3) {
    gameState.gold += 15; // modest daily "win 3 levels" bonus
    localStorage.setItem("chrono_gold", gameState.gold);
  }
}

function checkDailyBadge() {
  const tasks   = getDailyTasks();
  const allDone = tasks.every(t => t.done);
  const badge   = document.getElementById('dailyBadge');
  if (badge) badge.style.display = allDone ? 'none' : 'block';
}

function checkEraCompletion(level) {
  const era = getCurrentEraForLevel(level);
  if (!era) return null;
  if (level !== era.endLvl) return null;
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

  const trophyIcon = { gold: '🥇', silver: '🥈', bronze: '🥉' }[tier] || '🏆';
  const tierLabel  = { gold: 'GOLD TROPHY', silver: 'SILVER TROPHY', bronze: 'BRONZE TROPHY' }[tier] || 'TROPHY';
  const tierMsg    = {
    gold:   'Incredible! A flawless run through the era — you\'ve earned gold!',
    silver: 'Well played! A solid performance across the entire era earns you silver!',
    bronze: 'You did it! Every level conquered earns you the bronze trophy!'
  }[tier] || 'Era complete!';

  const starDisplay = '📀'.repeat(Math.floor(totalStars / (era.endLvl - era.startLvl + 1)));

  const card = document.getElementById('eraTrophyCard');
  card.className = `era-trophy-modal-card card-${tier}`;
  document.getElementById('eraTrophyIcon').textContent  = trophyIcon;
  document.getElementById('eraTrophyTier').textContent  = tierLabel;
  document.getElementById('eraTrophyEra').textContent   = era.name;
  document.getElementById('eraTrophyMsg').textContent   = tierMsg;
  document.getElementById('eraTrophyStars').textContent = `${starDisplay}  ${totalStars}/${maxStars} stars`;

  trophyFxCanvas = document.getElementById('trophyFireworksCanvas');
  if (trophyFxCanvas) {
    trophyFxCanvas.width  = window.innerWidth;
    trophyFxCanvas.height = window.innerHeight;
    trophyFxCtx = trophyFxCanvas.getContext('2d');
  }

  toggleModal('eraTrophyModal', true);
  triggerVibration([150, 60, 150, 60, 400]);

  trophyFxParticles = [];
  spawnTrophyBurst(tier);
  runTrophyFireworks();
}

function closeTrophyModal() {
  toggleModal('eraTrophyModal', false);
  cancelAnimationFrame(trophyFxId);
  trophyFxParticles = [];

  // If a weekly era item also dropped on this win, reveal it now
  if (gameState._eraItemAfterTrophy) {
    gameState._eraItemAfterTrophy = false;
    setTimeout(() => maybeShowEraItemReward(), 350);
    return;
  }
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

  const seenKey  = 'chrono_seen_announcements';
  const seen     = JSON.parse(localStorage.getItem(seenKey) || '[]');
  const newIds   = ANNOUNCEMENTS.filter(a => a.isNew && !seen.includes(a.id)).map(a => a.id);
  const allSeen  = [...new Set([...seen, ...ANNOUNCEMENTS.map(a => a.id)])];
  localStorage.setItem(seenKey, JSON.stringify(allSeen));

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

function checkNewsBadge() {
  const seenKey = 'chrono_seen_announcements';
  const seen    = JSON.parse(localStorage.getItem(seenKey) || '[]');
  const hasNew  = ANNOUNCEMENTS.some(a => a.isNew && !seen.includes(a.id));
  const badge   = document.getElementById('newsBadge');
  if (badge) badge.style.display = hasNew ? 'block' : 'none';
}

// ── DAILY REWARDS — deliberately modest ──
// These give small helpful nudges, NEVER the 3-packs the shop sells.
// Coin amounts are small (10-25) so daily logins don't flood the economy.
// Boosters are single items, occasional — enough to be a nice surprise,
// not enough to make buying pointless. No big gold jackpot.
const DAILY_REWARDS = [
  { day: 1, icon: '🪙', label: '10 Gold',   desc: 'Day 1 reward',    type: 'gold',    amount: 10 },
  { day: 2, icon: '❤️', label: '+1 Life',   desc: 'Day 2 reward',    type: 'lives',   amount: 1  },
  { day: 3, icon: '🪙', label: '15 Gold',   desc: 'Day 3 reward',    type: 'gold',    amount: 15 },
  { day: 4, icon: '🔨', label: 'Hammer ×1', desc: 'Day 4 reward',    type: 'hammer',  amount: 1  },
  { day: 5, icon: '🪙', label: '20 Gold',   desc: 'Day 5 reward',    type: 'gold',    amount: 20 },
  { day: 6, icon: '💣', label: 'Bomb ×1',   desc: 'Day 6 reward',    type: 'bomb',    amount: 1  },
  { day: 7, icon: '🪙', label: '25 Gold',   desc: 'Weekly bonus!',   type: 'gold',    amount: 25 },
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
  const dayIndex = streak % 7;
  return { alreadyClaimedToday, streak, dayIndex, todayKey };
}

function maybeShowDailyReward() {
  const { alreadyClaimedToday } = getDailyRewardState();
  if (alreadyClaimedToday) return;
  setTimeout(showDailyRewardModal, 800);
}

function showDailyRewardModal() {
  const { streak, dayIndex } = getDailyRewardState();
  const reward = DAILY_REWARDS[dayIndex];

  document.getElementById('dailyRewardIcon').textContent   = reward.icon;
  document.getElementById('dailyRewardAmount').textContent = '+' + (reward.amount > 1 ? reward.amount + ' ' : '') + reward.label;
  document.getElementById('dailyRewardDesc').textContent   = reward.desc;

  const strip = document.getElementById('dailyStreakStrip');
  if (strip) {
    strip.innerHTML = '';
    DAILY_REWARDS.forEach((r, i) => {
      const div = document.createElement('div');
      let cls = 'streak-day';
      if (i < dayIndex)        cls += ' claimed';
      else if (i === dayIndex) cls += ' today';
      else                     cls += ' locked';
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

  switch (reward.type) {
    case 'gold':
      gameState.gold += reward.amount;
      localStorage.setItem('chrono_gold', gameState.gold);
      const pg = document.getElementById('profileGold');
      if (pg) pg.innerText = gameState.gold;
      bumpGoldPill();
      break;
    case 'lives':
      gameState.lives = Math.min(99, gameState.lives + reward.amount);
      localStorage.setItem('chrono_lives', gameState.lives);
      const lc = document.getElementById('livesCounter');
      if (lc) lc.innerText = gameState.lives;
      break;
    case 'hammer':
      gameState.boosters.hammer += reward.amount;
      localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
      break;
    case 'bomb':
      gameState.boosters.bomb += reward.amount;
      localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
      break;
    case 'shuffle':
      gameState.boosters.shuffle += reward.amount;
      localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
      break;
  }

  localStorage.setItem('chrono_daily_reward_date',   todayKey);
  localStorage.setItem('chrono_daily_reward_streak', streak + 1);

  toggleModal('dailyRewardModal', false);
  showShopToast('🎁 ' + reward.icon + ' ' + reward.label + ' claimed! Come back tomorrow.');
  triggerVibration([80, 40, 120]);
}

function checkAwardsBadge() {
  const badge = document.getElementById('awardsBadge');
  if (!badge) return;

  const viewedKey = 'chrono_viewed_trophies';
  const viewed    = JSON.parse(localStorage.getItem(viewedKey) || '[]');

  const hasNewTrophy = eraTimeline.some(era => {
    const result = getEraTrophy(era);
    if (result.tier === 'locked') return false;
    const trophyId = era.name + '_' + result.tier;
    return !viewed.includes(trophyId);
  });

  badge.style.display = hasNewTrophy ? 'inline' : 'none';
}

const _origOpenAwards = openAwardsPage;
openAwardsPage = function() {
  _origOpenAwards();

  const viewedKey = 'chrono_viewed_trophies';
  const viewed    = JSON.parse(localStorage.getItem(viewedKey) || '[]');
  eraTimeline.forEach(era => {
    const result  = getEraTrophy(era);
    if (result.tier === 'locked') return;
    const trophyId = era.name + '_' + result.tier;
    if (!viewed.includes(trophyId)) viewed.push(trophyId);
  });
  localStorage.setItem(viewedKey, JSON.stringify(viewed));

  const badge = document.getElementById('awardsBadge');
  if (badge) badge.style.display = 'none';
};

const _origCheckDailyBadge = checkDailyBadge;
checkDailyBadge = function() {
  const tasks   = getDailyTasks();
  const allDone = tasks.every(t => t.done);
  const badge   = document.getElementById('dailyBadge');
  if (badge) badge.style.display = allDone ? 'none' : 'inline';
};

let _termsCalledFrom = 'settings';

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
  if (_termsCalledFrom && _termsCalledFrom !== 'termsPage' && _termsCalledFrom !== 'privacyPage') {
    switchView(_termsCalledFrom);
  } else {
    loadHomepage();
  }
}

function confirmDeactivateAccount() {
  toggleModal('settingsModal', false);
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
    if (window._firebaseReady && window.firebaseDeleteAccount) {
      await window.firebaseDeleteAccount();
    }
  } catch(err) {
    console.warn('Firebase deletion:', err.message);
  }

  localStorage.clear();

  gameState.gold                 = 100;
  gameState.lives                = 5;
  gameState.highestUnlockedLevel = 1;
  gameState.levelRecords         = {};
  gameState.currentLevel         = 1;
  gameState.authProvider         = 'Guest';
  gameState.authDisplayName      = '';
  gameState.authEmail            = '';
  gameState.boosters             = { hammer: 1, bomb: 1, shuffle: 1 };

  toggleModal('deactivateModal', false);

  setTimeout(() => {
    alert('Your account has been permanently deleted. Thank you for playing CHRONOCRUSH.');
    location.reload();
  }, 400);
}

const QUIZ_QUESTIONS = [
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

function getQuizDayKey() {
  return 'chrono_quiz_' + new Date().toDateString();
}
function getQuizAnsweredKey() {
  return 'chrono_quiz_answered_' + new Date().toDateString();
}

function getTodaysQuestion() {
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
    const letters = ['A', 'B', 'C'];
    const rewards = [
      { icon: '❤️', label: '+1 Life',    type: 'life'    },
      { icon: '💣', label: 'Bomb ×1',    type: 'bomb'    },
      { icon: '🔨', label: 'Hammer ×1',  type: 'hammer'  },
      { icon: '🪙', label: '+20 Gold',   type: 'gold'    },
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
  document.querySelectorAll('.quiz-option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('correct');
    else if (i === chosen && chosen !== correct) btn.classList.add('wrong');
  });

  const isCorrect = chosen === correct;
  const { question } = getTodaysQuestion();

  localStorage.setItem(getQuizAnsweredKey(), '1');
  localStorage.setItem(getQuizDayKey(), isCorrect ? 'correct' : 'wrong');

  setTimeout(() => {
    if (isCorrect) {
      switch(rewardType) {
        case 'life':
          gameState.lives = Math.min(99, gameState.lives + 1);
          localStorage.setItem('chrono_lives', gameState.lives);
          break;
        case 'bomb':
          gameState.boosters.bomb += 1;
          localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
          break;
        case 'hammer':
          gameState.boosters.hammer += 1;
          localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
          break;
        case 'shuffle':
          gameState.boosters.shuffle += 1;
          localStorage.setItem("chrono_boosters", JSON.stringify(gameState.boosters));
          break;
        case 'gold':
          gameState.gold += 20;
          localStorage.setItem('chrono_gold', gameState.gold);
          const pg = document.getElementById('profileGold');
          if (pg) pg.innerText = gameState.gold;
          bumpGoldPill();
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
  openQuizPage();
}

function checkQuizBadge() {
  const answered = localStorage.getItem(getQuizAnsweredKey());
  const badge    = document.getElementById('quizBadge');
  if (badge) badge.style.display = answered ? 'none' : 'block';
}

const LIFE_REFILL_MS    = 12 * 60 * 60 * 1000;
const MAX_LIVES         = 5;
let   _lifeRefillTicker = null;

function updateLivesDisplay() {
  const lc = document.getElementById('livesCounter');
  if (lc) lc.innerText = gameState.lives;
  const cl = document.getElementById('mapCornerLives');
  if (cl) cl.innerText = gameState.lives;
}

function startLifeRefillTimer() {
  if (_lifeRefillTicker) { clearInterval(_lifeRefillTicker); _lifeRefillTicker = null; }

  const bar = document.getElementById('lifeRefillBar');
  if (!bar) return;

  if (gameState.lives > 0) {
    bar.style.display = 'none';
    if (gameState.lives >= MAX_LIVES) {
      localStorage.removeItem('chrono_life_refill_at');
    }
    return;
  }

  const refillAt = parseInt(localStorage.getItem('chrono_life_refill_at'));
  const now      = Date.now();

  if (!refillAt || isNaN(refillAt)) {
    const newRefillAt = now + LIFE_REFILL_MS;
    localStorage.setItem('chrono_life_refill_at', newRefillAt);
    tickLifeRefill(newRefillAt);
  } else if (now >= refillAt) {
    grantLifeRefill();
  } else {
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

  update();
  _lifeRefillTicker = setInterval(update, 1000);
}

function grantLifeRefill() {
  gameState.lives = MAX_LIVES;
  localStorage.setItem('chrono_lives', MAX_LIVES);
  localStorage.removeItem('chrono_life_refill_at');

  updateLivesDisplay();

  const bar = document.getElementById('lifeRefillBar');
  if (bar) bar.style.display = 'none';

  showShopToast('❤️ Your 5 lives have been refilled!');
  triggerVibration([60, 30, 60]);
}
