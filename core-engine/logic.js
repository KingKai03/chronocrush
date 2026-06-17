// ─────────────────────────────────────────────────────────────────────────────
//  GAME ENGINE
// ─────────────────────────────────────────────────────────────────────────────
let canvas, ctx;

const ROWS = 4, COLS = 4;
let TILE_SIZE = 100;
let grid = [];
let firstSel = null;
let score = 0, movesLeft = 20, gameActive = true;
let currentEra = '1940s';
let eraIndex = 0;

const inventory = { coat: false, jacket: false, vest: false, jumpsuit: false };

const ERAS = ['1940s', '1950s', '1960s', '1970s'];

const ERA_CFG = {
  '1940s': {
    pieces: ['📻','✒️','🎩','🎷'],
    target: 500,
    boardBg: '#1a1410',
    gridLine: '#3a2a18',
    badge: '1940s Noir',
    borderColor: '#5a3a20',
  },
  '1950s': {
    pieces: ['🥤','🎸','🕶️','🚗'],
    target: 750,
    boardBg: '#101820',
    gridLine: '#1c3050',
    badge: '1950s Rock & Roll',
    borderColor: '#2a5080',
  },
  '1960s': {
    pieces: ['☮️','🌸','🚌','🎨'],
    target: 1000,
    boardBg: '#1a1028',
    gridLine: '#3a2050',
    badge: '1960s Peace & Love',
    borderColor: '#6a3090',
  },
  '1970s': {
    pieces: ['🪩','✨','🛼','🕺'],
    target: 1250,
    boardBg: '#200c10',
    gridLine: '#501828',
    badge: '1970s Disco Funk',
    borderColor: '#901040',
  },
};

// DOM refs
let scoreText, movesText, targetText, eraBadge, moodBubble, avatarSVG, portalFlash, overlayScreen, overlayTitle, overlayBody;

// ── RESIZE ───────────────────────────────────────────────────────────────────
function resizeGame() {
  const w = window.innerWidth;
  if (w <= 700) {
    const avail = Math.min(w - 32, 380);
    TILE_SIZE = Math.floor(avail / COLS);
  } else {
    TILE_SIZE = 100;
  }
  canvas.width  = TILE_SIZE * COLS;
  canvas.height = TILE_SIZE * ROWS;
  drawGrid();
}
window.addEventListener('resize', resizeGame);

// ── INIT ─────────────────────────────────────────────────────────────────────
function initGrid(resetScore) {
  if (resetScore !== false) score = 0;
  movesLeft  = 20;
  gameActive = true;
  firstSel   = null;
  updateUI();
  setMood('ready');

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

// ── DRAW ─────────────────────────────────────────────────────────────────────
function drawGrid() {
  if (!ctx) return;
  const cfg = ERA_CFG[currentEra];

  ctx.fillStyle = cfg.boardBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // subtle vignette
  const grad = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, canvas.width*0.2,
    canvas.width/2, canvas.height/2, canvas.width*0.75
  );
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE_SIZE, y = r * TILE_SIZE;

      // selected highlight
      if (firstSel && firstSel.r === r && firstSel.c === c) {
        ctx.fillStyle = 'rgba(212,175,55,0.22)';
        roundRect(ctx, x+2, y+2, TILE_SIZE-4, TILE_SIZE-4, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212,175,55,0.8)';
        ctx.lineWidth = 2;
        roundRect(ctx, x+2, y+2, TILE_SIZE-4, TILE_SIZE-4, 6);
        ctx.stroke();
      } else {
        ctx.strokeStyle = cfg.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }

      // tile emoji
      if (grid[r] && grid[r][c]) {
        ctx.font = `${Math.floor(TILE_SIZE * 0.44)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(grid[r][c], x + TILE_SIZE/2, y + TILE_SIZE/2);
      }
    }
  }

  canvas.style.borderColor = cfg.borderColor;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// ── INPUT ────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', onInput);
canvas.addEventListener('touchstart', function(e) {
  if (e.touches.length > 0) { e.preventDefault(); onInput(e.touches[0]); }
}, { passive: false });

function onInput(e) {
  if (!gameActive) return;
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
    swapTiles(firstSel.r, firstSel.c, row, col);
    if (findMatches().length > 0) {
      movesLeft--;
      resolveMatches(true);
      updateUI();
      checkStatus();
    } else {
      // revert
      swapTiles(firstSel.r, firstSel.c, row, col);
    }
  }
  firstSel = null;
  drawGrid();
}

function swapTiles(r1, c1, r2, c2) {
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;
}

// ── MATCH LOGIC ───────────────────────────────────────────────────────────────
function findMatches() {
  const hits = new Set();
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS-2; c++) {
      if (grid[r][c] && grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) {
        hits.add(`${r},${c}`); hits.add(`${r},${c+1}`); hits.add(`${r},${c+2}`);
      }
    }
  }
  // vertical
  for (let r = 0; r < ROWS-2; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] && grid[r][c] === grid[r+1][c] && grid[r][c] === grid[r+2][c]) {
        hits.add(`${r},${c}`); hits.add(`${r+1},${c}`); hits.add(`${r+2},${c}`);
      }
    }
  }
  return [...hits].map(k => { const [r,c] = k.split(','); return {r:+r,c:+c}; });
}

function resolveMatches(award) {
  const matches = findMatches();
  if (!matches.length) return;

  if (award) {
    score += matches.length * 50;
    triggerAvatarJump();
  }

  for (const m of matches) grid[m.r][m.c] = '';

  // gravity
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS-1; r >= 0; r--) {
      if (grid[r][c] === '') {
        for (let l = r-1; l >= 0; l--) {
          if (grid[l][c] !== '') { grid[r][c] = grid[l][c]; grid[l][c] = ''; break; }
        }
      }
    }
  }
  // refill top
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === '') grid[r][c] = randomPiece();

  // cascade
  if (findMatches().length > 0) resolveMatches(award);
}

// ── STATUS ───────────────────────────────────────────────────────────────────
function checkStatus() {
  const cfg = ERA_CFG[currentEra];
  if (score >= cfg.target) {
    gameActive = false;
    setMood('happy');
    setTimeout(() => advanceEra(), 700);
  } else if (movesLeft <= 0) {
    gameActive = false;
    setMood('sad');
    setTimeout(() => {
      overlayTitle.textContent = 'Timeline Collapsed!';
      overlayBody.textContent  = 'The timeline unraveled. The ' + currentEra + ' era slipped away. Regroup and try again.';
      overlayScreen.classList.add('visible');
    }, 500);
  }
}

function dismissOverlay() {
  overlayScreen.classList.remove('visible');
  score = 0;
  initGrid(false);
}

function advanceEra() {
  // unlock outfit for current era
  if (currentEra === '1940s') { inventory.coat = true; }
  else if (currentEra === '1950s') { inventory.jacket = true; }
  else if (currentEra === '1960s') { inventory.vest = true; }
  else if (currentEra === '1970s') { inventory.jumpsuit = true; }

  eraIndex = (eraIndex + 1) % ERAS.length;
  const nextEra = ERAS[eraIndex];

  // Flash portal
  portalFlash.classList.remove('active');
  void portalFlash.offsetWidth;
  portalFlash.classList.add('active');

  // Warp avatar
  avatarSVG.className = '';
  void avatarSVG.offsetWidth;
  avatarSVG.className = 'warping';
  setTimeout(() => { avatarSVG.className = 'breathing'; }, 600);

  currentEra = nextEra;
  updateInventoryUI();
  initGrid(false); // keep score reset for new era
  score = 0;
  updateUI();
}

// ── UI UPDATE ────────────────────────────────────────────────────────────────
function updateUI() {
  scoreText.textContent  = score;
  movesText.textContent  = movesLeft;
  targetText.textContent = ERA_CFG[currentEra].target;
  eraBadge.textContent   = ERA_CFG[currentEra].badge;

  // era pips
  ERAS.forEach((e, i) => {
    const pip = document.getElementById('pip' + i);
    if (!pip) return;
    pip.classList.remove('done', 'active');
    if (i < eraIndex) pip.classList.add('done');
    else if (i === eraIndex) pip.classList.add('active');
  });
}

function updateInventoryUI() {
  const unlock = (id, lockId) => {
    const btn = document.getElementById(id);
    const lck = document.getElementById(lockId);
    if (btn) { btn.disabled = false; }
    if (lck) { lck.textContent = '✨'; }
  };
  if (inventory.coat)     unlock('btn_coat',     'lock_coat');
  if (inventory.jacket)   unlock('btn_jacket',   'lock_jacket');
  if (inventory.vest)     unlock('btn_vest',      'lock_vest');
  if (inventory.jumpsuit) unlock('btn_jumpsuit', 'lock_jumpsuit');
}

// ── AVATAR MOOD ───────────────────────────────────────────────────────────────
function setMood(mood) {
  const mouth = document.getElementById('mouthPath');
  if (mood === 'ready') {
    moodBubble.textContent = 'READY';
    moodBubble.style.background = '#d4af37';
    moodBubble.style.color = '#0e0c09';
    if (mouth) mouth.setAttribute('d', 'M63,90 Q70,95 77,90');
  } else if (mood === 'happy') {
    moodBubble.textContent = 'GROOVY! ✨';
    moodBubble.style.background = '#27ae60';
    moodBubble.style.color = '#fff';
    if (mouth) mouth.setAttribute('d', 'M61,88 Q70,97 79,88');
  } else if (mood === 'sad') {
    moodBubble.textContent = 'OH NO!';
    moodBubble.style.background = '#c0392b';
    moodBubble.style.color = '#fff';
    if (mouth) mouth.setAttribute('d', 'M63,93 Q70,87 77,93');
  }
}

function triggerAvatarJump() {
  avatarSVG.classList.remove('jumping', 'breathing');
  void avatarSVG.offsetWidth;
  avatarSVG.className = 'jumping';
  setTimeout(() => {
    if (gameActive) avatarSVG.className = 'breathing';
  }, 550);
}

// ─────────────────────────────────────────────────────────────────────────────
//  AVATAR CUSTOMIZATION
// ─────────────────────────────────────────────────────────────────────────────
let avatarState = {
  identity: 'neutral',
  skin: '#c8a882',
  hair: 'default',
  outfit: 'base',
};

const SKIN_PARTS = ['faceBase','svgNeck','handL','handR'];

function setSkinColor(color) {
  SKIN_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('fill', color);
  });
  // ears (no id, so grab by index in head group)
  document.querySelectorAll('#svgHead ellipse').forEach((el, i) => {
    if (i === 1 || i === 2) el.setAttribute('fill', color); // ear L, ear R
  });
}

const HAIR_DEFS = {
  default: { color: '#2a1a0a', style: 'medium' },
  blonde:  { color: '#d4a830', style: 'medium' },
  red:     { color: '#8b2500', style: 'medium' },
  afro:    { color: '#1a0a00', style: 'afro'   },
  bun:     { color: '#2a1a0a', style: 'bun'    },
  bald:    { color: null,      style: 'bald'   },
};

function applyHair(hairKey) {
  const def = HAIR_DEFS[hairKey] || HAIR_DEFS.default;
  const group = document.getElementById('svgHair');
  group.innerHTML = '';

  if (def.style === 'bald') return;

  if (def.style === 'afro') {
    const c = def.color;
    group.innerHTML = `
      <circle cx="70" cy="46" r="36" fill="${c}" opacity="0.95"/>
      <ellipse cx="46" cy="60" rx="14" ry="20" fill="${c}"/>
      <ellipse cx="94" cy="60" rx="14" ry="20" fill="${c}"/>
    `;
  } else if (def.style === 'bun') {
    const c = def.color;
    group.innerHTML = `
      <ellipse cx="70" cy="52" rx="28" ry="16" fill="${c}"/>
      <rect x="42" y="48" width="8" height="20" rx="4" fill="${c}"/>
      <rect x="90" y="48" width="8" height="20" rx="4" fill="${c}"/>
      <circle cx="70" cy="36" r="14" fill="${c}"/>
    `;
  } else {
    // medium
    const c = def.color;
    group.innerHTML = `
      <ellipse cx="70" cy="52" rx="30" ry="22" fill="${c}"/>
      <rect x="40" y="48" width="9" height="26" rx="4" fill="${c}"/>
      <rect x="91" y="48" width="9" height="26" rx="4" fill="${c}"/>
    `;
  }
}

// outfit overlay SVG snippets
const OUTFIT_DEFS = {
  base: { shirt: '#4a5568', pants: '#3a4a5c', shoes: '#1a1a1a', overlay: '' },
  coat: {
    shirt: '#2c2416',
    pants: '#1e1a12',
    shoes: '#111',
    overlay: `
      <!-- Trench coat lapels -->
      <polygon points="55,108 42,160 58,168 70,130 82,168 98,160 85,108 70,120" fill="#4a3820" opacity="0.95"/>
      <line x1="70" y1="120" x2="70" y2="168" stroke="#3a2a14" stroke-width="1.5"/>
      <!-- Belt -->
      <rect x="38" y="148" width="64" height="7" rx="3" fill="#2a1e0a"/>
      <rect x="64" y="147" width="12" height="9" rx="2" fill="#c8a840"/>
      <!-- Collar flips -->
      <polygon points="58,108 50,128 62,120" fill="#3a2814"/>
      <polygon points="82,108 90,128 78,120" fill="#3a2814"/>
    `,
  },
  jacket: {
    shirt: '#1a1a1a',
    pants: '#1a1a2a',
    shoes: '#0a0a0a',
    overlay: `
      <!-- Leather jacket -->
      <rect x="38" y="108" width="64" height="68" rx="10" fill="#1a1a1a" opacity="0.85"/>
      <!-- Lapels -->
      <polygon points="58,108 48,140 62,136 70,116 78,136 92,140 82,108" fill="#111"/>
      <!-- Zipper -->
      <line x1="70" y1="116" x2="70" y2="172" stroke="#888" stroke-width="2"/>
      <!-- Pockets -->
      <rect x="42" y="148" width="18" height="14" rx="3" fill="#0d0d0d" stroke="#333" stroke-width="1"/>
      <rect x="80" y="148" width="18" height="14" rx="3" fill="#0d0d0d" stroke="#333" stroke-width="1"/>
      <!-- Arm stripes -->
      <rect x="18" y="118" width="22" height="5" rx="2" fill="#e74c3c"/>
      <rect x="100" y="118" width="22" height="5" rx="2" fill="#e74c3c"/>
    `,
  },
  vest: {
    shirt: '#e8d4f0',
    pants: '#4a3060',
    shoes: '#2a1a40',
    overlay: `
      <!-- Fringe vest -->
      <rect x="40" y="108" width="60" height="64" rx="8" fill="rgba(180,120,200,0.3)"/>
      <!-- Fringe strips -->
      ${Array.from({length:10},(_,i)=>`<rect x="${40+i*6}" y="168" width="3" height="${12+i%3*4}" rx="1" fill="#a060c0" opacity="0.7"/>`).join('')}
      <!-- Peace patches -->
      <circle cx="56" cy="130" r="9" fill="none" stroke="#e040c0" stroke-width="2"/>
      <line x1="56" y1="121" x2="56" y2="139" stroke="#e040c0" stroke-width="1.5"/>
      <line x1="50" y1="133" x2="62" y2="133" stroke="#e040c0" stroke-width="1.5"/>
      <!-- Psychedelic center -->
      <circle cx="70" cy="135" r="8" fill="rgba(255,200,0,0.4)" stroke="#ffc000" stroke-width="1"/>
      <circle cx="70" cy="135" r="4" fill="rgba(255,100,200,0.6)"/>
    `,
  },
  jumpsuit: {
    shirt: '#1a1a3a',
    pants: '#1a1a3a',
    shoes: '#1a0020',
    overlay: `
      <!-- Disco jumpsuit -->
      <rect x="35" y="106" width="70" height="128" rx="12" fill="#1a0a3a" opacity="0.9"/>
      <!-- Wide collar -->
      <polygon points="52,108 70,130 88,108 80,108 70,122 60,108" fill="#2a1a5a"/>
      <!-- Sequin shimmer dots -->
      <circle cx="42" cy="120" r="2" fill="#ffd700" opacity="0.9"/><circle cx="58" cy="125" r="1.5" fill="#ff69b4" opacity="0.8"/><circle cx="74" cy="118" r="2" fill="#00ffff" opacity="0.7"/><circle cx="90" cy="122" r="1" fill="#ffffff" opacity="0.9"/><circle cx="48" cy="134" r="1.5" fill="#ffd700" opacity="0.7"/><circle cx="64" cy="140" r="2" fill="#ff69b4" opacity="0.8"/><circle cx="80" cy="132" r="1" fill="#00ffff" opacity="0.9"/><circle cx="95" cy="138" r="2" fill="#ffffff" opacity="0.7"/><circle cx="44" cy="152" r="2" fill="#ffd700" opacity="0.8"/><circle cx="60" cy="158" r="1" fill="#ff69b4" opacity="0.9"/><circle cx="76" cy="148" r="2" fill="#00ffff" opacity="0.7"/><circle cx="92" cy="154" r="1.5" fill="#ffffff" opacity="0.8"/><circle cx="50" cy="166" r="1" fill="#ffd700" opacity="0.9"/><circle cx="68" cy="172" r="2" fill="#ff69b4" opacity="0.7"/><circle cx="84" cy="162" r="1.5" fill="#00ffff" opacity="0.8"/><circle cx="55" cy="180" r="2" fill="#ffffff" opacity="0.9"/><circle cx="71" cy="188" r="1" fill="#ffd700" opacity="0.8"/><circle cx="87" cy="176" r="2" fill="#ff69b4" opacity="0.7"/><circle cx="43" cy="194" r="1.5" fill="#00ffff" opacity="0.9"/><circle cx="97" cy="186" r="1" fill="#ffffff" opacity="0.8"/>
      <!-- Bell bottoms flare -->
      <polygon points="44,196 28,250 56,250 56,196" fill="#1a0a3a"/>
      <polygon points="96,196 112,250 84,250 84,196" fill="#1a0a3a"/>
      <!-- Platform shoes -->
      <rect x="26" y="244" width="32" height="12" rx="4" fill="#4a0a6a"/>
      <rect x="82" y="244" width="32" height="12" rx="4" fill="#4a0a6a"/>
    `,
  },
};

function applyOutfit(outfitKey) {
  const def = OUTFIT_DEFS[outfitKey] || OUTFIT_DEFS.base;

  document.getElementById('shirtBody').setAttribute('fill', def.shirt);
  document.getElementById('armL').setAttribute('fill', def.shirt);
  document.getElementById('armR').setAttribute('fill', def.shirt);
  document.getElementById('shirtCollar').setAttribute('fill', adjustHex(def.shirt, 20));

  document.getElementById('legL').setAttribute('fill', def.pants);
  document.getElementById('legR').setAttribute('fill', def.pants);
  document.getElementById('shoeL').setAttribute('fill', def.shoes);
  document.getElementById('shoeR').setAttribute('fill', def.shoes);

  document.getElementById('svgOutfitOverlay').innerHTML = def.overlay;
}

function adjustHex(hex, amount) {
  // lighten a hex color slightly for collar
  try {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + amount);
    const g = Math.min(255, ((num >>  8) & 0xff) + amount);
    const b = Math.min(255, ((num      ) & 0xff) + amount);
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  } catch(e) { return hex; }
}

// Public handlers called by buttons
window.setIdentity = function(type, btn) {
  avatarState.identity = type;
  document.querySelectorAll('#identityBtns .chip-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.setSkin = function(color, btn) {
  avatarState.skin = color;
  document.querySelectorAll('#skinBtns .chip-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  setSkinColor(color);
};

window.setHair = function(key, btn) {
  avatarState.hair = key;
  document.querySelectorAll('#hairBtns .chip-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyHair(key);
};

window.setOutfit = function(key) {
  avatarState.outfit = key;
  document.querySelectorAll('.outfit-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn_' + key);
  if (btn) btn.classList.add('active');
  applyOutfit(key);
};

// ─────────────────────────────────────────────────────────────────────────────
//  BOOT — wait for DOM then initialise
// ─────────────────────────────────────────────────────────────────────────────
function boot() {
  canvas      = document.getElementById('gameCanvas');
  ctx         = canvas.getContext('2d');
  scoreText   = document.getElementById('scoreText');
  movesText   = document.getElementById('movesText');
  targetText  = document.getElementById('targetText');
  eraBadge    = document.getElementById('eraBadge');
  moodBubble  = document.getElementById('moodBubble');
  avatarSVG   = document.getElementById('avatarSVG');
  portalFlash = document.getElementById('portalFlash');
  overlayScreen = document.getElementById('overlayScreen');
  overlayTitle  = document.getElementById('overlayTitle');
  overlayBody   = document.getElementById('overlayBody');
  applyOutfit('base');
  initGrid();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
