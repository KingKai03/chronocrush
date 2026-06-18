// ─────────────────────────────────────────────────────────────────────────────
//  GAME STATE ARCHITECTURE (7 ERAS x 10 LEVELS = 70 LEVELS TOTAL)
// ─────────────────────────────────────────────────────────────────────────────
const ROWS = 8, COLS = 4;
let TILE_SIZE = 75;
let grid = [];
let firstSel = null;
let gameActive = false;

let profileName = "TimeTraveler#0000";
let currentLevel = 1;
let unlockedLevel = 1; 
let scoresDatabase = {}; // Format: { levelId: { score: X, records: Y } }

let score = 0;
let movesLeft = 20;
let currentEra = '1940s';

const ERAS = ['1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s'];

const ERA_CFG = {
  '1940s': { pieces: ['📻','✒️','🎩','🎷'], baseTarget: 500,  inc: 60,  boardBg: '#1a1410', gridLine: '#3a2a18', badge: '1940s Noir', border: '#5a3a20' },
  '1950s': { pieces: ['🥤','🎸','🕶️','🚗'], baseTarget: 1000, inc: 80,  boardBg: '#101820', gridLine: '#1c3050', badge: '1950s Rock', border: '#2a5080' },
  '1960s': { pieces: ['☮️','🌸','🚌','🎨'], baseTarget: 1600, inc: 100, boardBg: '#1a1028', gridLine: '#3a2050', badge: '1960s Peace', border: '#6a3090' },
  '1970s': { pieces: ['🪩','✨','🛼','🕺'], baseTarget: 2200, inc: 120, boardBg: '#200c10', gridLine: '#501828', badge: '1970s Disco', border: '#901040' },
  '1980s': { pieces: ['🕹️','📼','🕶️','⚡'], baseTarget: 3000, inc: 150, boardBg: '#091a1e', gridLine: '#123d45', badge: '1980s Synth', border: '#1bb5cc' },
  '1990s': { pieces: ['💾','🧃','🛹','🎤'], baseTarget: 4000, inc: 200, boardBg: '#1c1c1c', gridLine: '#383838', badge: '1990s Grunge', border: '#666666' },
  '2000s': { pieces: ['📱','💿','🎧','🌐'], baseTarget: 5500, inc: 250, boardBg: '#0b132b', gridLine: '#1c2541', badge: '2000s Digital', border: '#48cae4' }
};

// DOM Elements Linkage
let canvas, ctx, scoreText, movesText, targetText, eraBadge, overlayScreen, overlayTitle, overlayBody, modalControls, recordsAwardContainer, campaignMap, profileNameTxt, totalRecordsText, portalFlash;

// ── AUTHENTICATION & AUTOMATED USER ENGINE ──────────────────────────────────
window.loginUser = function(type) {
  if (type === 'guest') {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    profileName = `TimeTraveler#${randomDigits}`;
    unlockedLevel = 1;
    scoresDatabase = {};
  } else {
    profileName = localStorage.getItem('cc_name') || "TimeTraveler#1940";
    unlockedLevel = parseInt(localStorage.getItem('cc_level')) || 1;
    try {
      scoresDatabase = JSON.parse(localStorage.getItem('cc_scores')) || {};
    } catch(e) { scoresDatabase = {}; }
  }
  
  // Persist guest data or loaded state
  saveStateToStorage();
  
  document.getElementById('authScreen').classList.remove('visible');
  syncProfileData();
  buildCampaignMap();
  loadLevel(unlockedLevel);
};

function saveStateToStorage() {
  localStorage.setItem('cc_name', profileName);
  localStorage.setItem('cc_level', unlockedLevel);
  localStorage.setItem('cc_scores', JSON.stringify(scoresDatabase));
}

function syncProfileData() {
  if (profileNameTxt) profileNameTxt.textContent = profileName;
  let tally = 0;
  Object.keys(scoresDatabase).forEach(k => { tally += (scoresDatabase[k].records || 0); });
  if (totalRecordsText) totalRecordsText.textContent = tally;
}

// ── DYNAMIC LEVEL RESOLUTION MATH ──────────────────────────────────────────
function getLevelTargets(lvl) {
  const eraIndex = Math.min(6, Math.floor((lvl - 1) / 10));
  const eraKey = ERAS[eraIndex];
  const cfg = ERA_CFG[eraKey];
  const relativeLvl = ((lvl - 1) % 10); // 0 to 9 inside era
  
  const target1 = cfg.baseTarget + (relativeLvl * cfg.inc);
  const target2 = Math.floor(target1 * 1.4);
  const target3 = Math.floor(target1 * 1.8);
  return { eraKey, target1, target2, target3 };
}

// ── ZIG-ZAG MAP REGENERATION ─────────────────────────────────────────────────
function buildCampaignMap() {
  if (!campaignMap) return;
  campaignMap.innerHTML = '';

  for (let l = 1; l <= 70; l++) {
    const rowWrap = document.createElement('div');
    rowWrap.classList.add('map-row');
    
    // Alternating grid positions to yield a fluid vertical zig-zag track
    const placement = l % 4;
    if (placement === 1) rowWrap.classList.add('left');
    else if (placement === 3) rowWrap.classList.add('right');
    else rowWrap.classList.add('mid');

    const btn = document.createElement('button');
    btn.className = 'level-node';
    if (l < unlockedLevel) btn.classList.add('unlocked');
    if (l === currentLevel) btn.classList.add('active');
    if (l > unlockedLevel) btn.disabled = true;

    btn.onclick = () => { currentLevel = l; buildCampaignMap(); loadLevel(l); };

    // Star replacement: Evaluate performance indicators
    let recordsString = '🔘🔘🔘';
    if (scoresDatabase[l] && scoresDatabase[l].records) {
      const amt = scoresDatabase[l].records;
      if (amt === 1) recordsString = '💿🔘🔘';
      else if (amt === 2) recordsString = '💿💿🔘';
      else if (amt === 3) recordsString = '📀📀📀';
    }

    btn.innerHTML = `
      <div class="node-circle">${l}</div>
      <div class="node-records">${btn.disabled ? '🔒' : recordsString}</div>
    `;
    
    rowWrap.appendChild(btn);
    campaignMap.appendChild(rowWrap);
  }
}

// ── ENGINE INITIALIZATION AND RUNTIME ────────────────────────────────────────
function loadLevel(lvl) {
  const { eraKey, target1 } = getLevelTargets(lvl);
  currentEra = eraKey;
  score = 0;
  movesLeft = 22 - Math.min(5, Math.floor(((lvl - 1) % 10) / 2)); // Dynamic difficulty step-down
  firstSel = null;
  gameActive = true;

  if (eraBadge) eraBadge.textContent = ERA_CFG[currentEra].badge;
  updateUI();

  // Populate board arrays
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) grid[r][c] = randomPiece();
  }
  while (findMatches().length > 0) resolveMatches(false);
  
  resizeGame();
}

function randomPiece() {
  const p = ERA_CFG[currentEra].pieces;
  return p[Math.floor(Math.random() * p.length)];
}

function resizeGame() {
  if (!canvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w <= 850) {
    const availW = Math.min(w - 48, 340);
    let calculatedTile = Math.floor(availW / COLS);
    if (calculatedTile * ROWS > h * 0.55) {
      calculatedTile = Math.floor((h * 0.55) / ROWS);
    }
    TILE_SIZE = calculatedTile;
  } else {
    TILE_SIZE = 58; // Balanced desktop rendering next to overview container
  }

  canvas.width = TILE_SIZE * COLS;
  canvas.height = TILE_SIZE * ROWS;
  drawGrid();
}

// ── RENDERING ───────────────────────────────────────────────────────────────
function drawGrid() {
  if (!ctx || !canvas) return;
  const cfg = ERA_CFG[currentEra];

  ctx.fillStyle = cfg.boardBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE_SIZE, y = r * TILE_SIZE;

      if (firstSel && firstSel.r === r && firstSel.c === c) {
        ctx.fillStyle = 'rgba(214,175,55,0.25)';
        ctx.fillRect(x+2, y+2, TILE_SIZE-4, TILE_SIZE-4);
        ctx.strokeStyle = varColor('--gold');
        ctx.lineWidth = 2;
        ctx.strokeRect(x+2, y+2, TILE_SIZE-4, TILE_SIZE-4);
      } else {
        ctx.strokeStyle = cfg.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }

      if (grid[r] && grid[r][c]) {
        ctx.font = `${Math.floor(TILE_SIZE * 0.5)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(grid[r][c], x + TILE_SIZE/2, y + TILE_SIZE/2);
      }
    }
  }
  canvas.style.borderColor = cfg.border;
}

function varColor(variable) {
  return getComputedStyle(document.body).getPropertyValue(variable).trim();
}

// ── CORE GAME MECHANICS INTERACTION LOOP ─────────────────────────────────────
function attachInputListeners() {
  canvas.addEventListener('mousedown', onInput);
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length > 0) { e.preventDefault(); onInput(e.touches[0]); }
  }, { passive: false });
}

function onInput(e) {
  if (!gameActive || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const col = Math.floor((e.clientX - rect.left)  * scaleX / TILE_SIZE);
  const row = Math.floor((e.clientY - rect.top)   * scaleY / TILE_SIZE);
  if (row >= 0 && row < ROWS && col >= 0 && col < COLS) selectTile(row, col);
}

function selectTile(row, col) {
  if (!firstSel) {
    firstSel = { r: row, c: col };
    drawGrid();
    return;
  }
  const dr = Math.abs(row - firstSel.r);
  const dc = Math.abs(col - firstSel.c);
  if (dr + dc === 1) {
    const pR = firstSel.r, pC = firstSel.c;
    swapTiles(pR, pC, row, col);
    if (findMatches().length > 0) {
      movesLeft--;
      resolveMatches(true);
      updateUI();
      checkEvaluationStatus();
    } else {
      swapTiles(pR, pC, row, col);
    }
  }
  firstSel = null;
  drawGrid();
}

function swapTiles(r1, c1, r2, c2) {
  if (grid[r1] && grid[r2]) {
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
  }
}

function findMatches() {
  const hits = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS-2; c++) {
      if (grid[r] && grid[r][c] && grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) {
        hits.add(`${r},${c}`); hits.add(`${r},${c+1}`); hits.add(`${r},${c+2}`);
      }
    }
  }
  for (let r = 0; r < ROWS-2; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r] && grid[r+1] && grid[r+2] && grid[r][c] && grid[r][c] === grid[r+1][c] && grid[r][c] === grid[r+2][c]) {
        hits.add(`${r},${c}`); hits.add(`${r+1},${c}`); hits.add(`${r+2},${c}`);
      }
    }
  }
  return [...hits].map(k => { const [r,c] = k.split(','); return {r:+r,c:+c}; });
}

function resolveMatches(awardPoints) {
  const matches = findMatches();
  if (!matches.length) return;

  if (awardPoints) score += matches.length * 65;

  for (const m of matches) { if (grid[m.r]) grid[m.r][m.c] = ''; }
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS-1; r >= 0; r--) {
      if (grid[r] && grid[r][c] === '') {
        for (let l = r-1; l >= 0; l--) {
          if (grid[l] && grid[l][c] !== '') { grid[r][c] = grid[l][c]; grid[l][c] = ''; break; }
        }
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r] && grid[r][c] === '') grid[r][c] = randomPiece();
    }
  }
  if (findMatches().length > 0) resolveMatches(awardPoints);
}

// ── EVAL ENGINE (WIN / LOSE OPTION POPUPS) ──────────────────────────────
function checkEvaluationStatus() {
  const { target1, target2, target3 } = getLevelTargets(currentLevel);

  if (score >= target1) {
    gameActive = false;
    let recordsEarned = 1;
    let recordIcons = '💿🔘🔘';
    if (score >= target3) { recordsEarned = 3; recordIcons = '📀📀📀'; }
    else if (score >= target2) { recordsEarned = 2; recordIcons = '💿💿🔘'; }

    // Update state tracking
    if (!scoresDatabase[currentLevel] || scoresDatabase[currentLevel].records < recordsEarned) {
      scoresDatabase[currentLevel] = { score: score, records: recordsEarned };
    }
    
    let originalEraIndex = Math.floor((currentLevel - 1) / 10);
    if (currentLevel === unlockedLevel && unlockedLevel < 70) {
      unlockedLevel++;
    }
    let newEraIndex = Math.floor((unlockedLevel - 1) / 10);

    saveStateToStorage();
    syncProfileData();

    // Trigger visual warp if crossing historical borders
    if (newEraIndex > originalEraIndex && portalFlash) {
      portalFlash.classList.add('active');
      setTimeout(() => portalFlash.classList.remove('active'), 600);
    }

    setTimeout(() => showEndModal(true, recordIcons), 500);
  } else if (movesLeft <= 0) {
    gameActive = false;
    setTimeout(() => showEndModal(false, '🔘🔘🔘'), 500);
  }
}

function showEndModal(isWin, recordIcons) {
  if (!overlayScreen) return;
  recordsAwardContainer.textContent = recordIcons;

  if (isWin) {
    overlayTitle.textContent = `Level ${currentLevel} Complete!`;
    overlayBody.textContent = `Excellent work! You scored ${score} points and secured alternative chronological data.`;
    
    let nextBtnHtml = currentLevel < 70 
      ? `<button class="menu-btn" onclick="triggerModalAction('next')">Next Level</button>`
      : `<button class="menu-btn" disabled>Saga Grand Finale Complete!</button>`;

    modalControls.innerHTML = `
      ${nextBtnHtml}
      <button class="menu-btn" onclick="triggerModalAction('retry')">Replay Level</button>
      <button class="menu-btn" onclick="triggerModalAction('map')">Back to Map</button>
    `;
  } else {
    overlayTitle.textContent = `Timeline Desynchronized`;
    overlayBody.textContent = `You ran out of structural moves before hitting the localized threshold.`;
    modalControls.innerHTML = `
      <button class="menu-btn" onclick="triggerModalAction('retry')">Retry Level</button>
      <button class="menu-btn" onclick="triggerModalAction('map')">Back to Map</button>
    `;
  }
  overlayScreen.classList.add('visible');
}

window.triggerModalAction = function(type) {
  overlayScreen.classList.remove('visible');
  if (type === 'next') {
    currentLevel++;
    buildCampaignMap();
    loadLevel(currentLevel);
  } else if (type === 'retry') {
    loadLevel(currentLevel);
  } else if (type === 'map') {
    buildCampaignMap();
    // Leave grid empty and frozen until a map selection is made
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0, canvas.width, canvas.height);
    ctx.font = "14px Arial";
    ctx.fillStyle = "#aaa";
    ctx.textAlign = "center";
    ctx.fillText("Select a Level from Map", canvas.width/2, canvas.height/2);
  }
};

function updateUI() {
  const { target1 } = getLevelTargets(currentLevel);
  if (scoreText) scoreText.textContent = score;
  if (movesText) movesText.textContent = movesLeft;
  if (targetText) targetText.textContent = target1;
}

// ── BOOT SYSTEM ──────────────────────────────────────────────────────────────
function boot() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  scoreText = document.getElementById('scoreText');
  movesText = document.getElementById('movesText');
  targetText = document.getElementById('targetText');
  eraBadge = document.getElementById('eraBadge');
  overlayScreen = document.getElementById('overlayScreen');
  overlayTitle = document.getElementById('overlayTitle');
  overlayBody = document.getElementById('overlayBody');
  modalControls = document.getElementById('modalControls');
  recordsAwardContainer = document.getElementById('recordsAwardContainer');
  campaignMap = document.getElementById('campaignMap');
  profileNameTxt = document.getElementById('profileName');
  totalRecordsText = document.getElementById('totalRecordsText');
  portalFlash = document.getElementById('portalFlash');

  attachInputListeners();
  window.addEventListener('resize', resizeGame);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } 
else { boot(); }
