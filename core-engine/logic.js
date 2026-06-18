// ==========================================================================
// 1. STATE CONFIGURATION SYSTEM WITH AUDIO CONTEXT
// ==========================================================================
const gameState = {
  lives: 5,
  gold: 150,
  currentLevel: 1,
  highestUnlockedLevel: 1,
  totalLevels: 70, 
  isGameActive: false,
  levelPendingStart: null,
  
  // Track individual earned Gold Records per level
  levelRecords: {}, 

  // Match-3 Grid Settings
  boardSize: 6,
  grid: [],
  score: 0,
  targetScore: 500,
  moves: 22,
  selectedTile: null,

  // User Configurations
  preferences: {
    sound: true,
    sfx: true,
    vibe: true
  },

  // Audio Engine Runtime Variables
  audioCtx: null,
  musicInterval: null,
  currentTrackEra: null
};

// Complete List of Eras (10 Levels each)
const eraTimeline = [
  { name: "1940s Noir", startLvl: 1, endLvl: 10, tempo: 110 },
  { name: "1950s Rockabilly", startLvl: 11, endLvl: 20, tempo: 140 },
  { name: "1960s Psychedelic", startLvl: 21, endLvl: 30, tempo: 95 },
  { name: "1970s Disco", startLvl: 31, endLvl: 40, tempo: 120 },
  { name: "1980s Retro Synth", startLvl: 41, endLvl: 50, tempo: 125 },
  { name: "1990s Grunge", startLvl: 51, endLvl: 60, tempo: 105 },
  { name: "2000s Y2K Pop", startLvl: 61, endLvl: 70, tempo: 130 }
];

const gameItems = [
  { id: 1, char: '📻' },
  { id: 2, char: '🎩' },
  { id: 3, char: '✒️' },
  { id: 4, char: '🎷' }
];

function getEraForLevel(lvl) {
  return eraTimeline.find(e => lvl >= e.startLvl && lvl <= e.endLvl) || eraTimeline[0];
}

// INITIALIZATION SEQUENCER
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
    
    const savedRecords = localStorage.getItem("chrono_level_records");
    if (savedRecords) {
      gameState.levelRecords = JSON.parse(savedRecords);
    }

    const savedPrefs = localStorage.getItem("chrono_preferences");
    if (savedPrefs) {
      gameState.preferences = JSON.parse(savedPrefs);
    }
    
    switchView("welcomeScreen");
  }, 2500); 
  
  const canvas = document.getElementById("gameCanvas");
  if (canvas) {
    canvas.addEventListener("mousedown", handleCanvasClick);
  }
});

// ==========================================================================
// 2. PROCEDURAL MUSIC SYNTHESIZER ENGINE (PURE WEB AUDIO API)
// ==========================================================================
function initAudioContext() {
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function startEraMusic(eraName) {
  initAudioContext();
  if (!gameState.preferences.sound) return;
  if (gameState.currentTrackEra === eraName) return; // Prevent restarting if already playing
  
  stopEraMusic();
  gameState.currentTrackEra = eraName;

  const era = eraTimeline.find(e => e.name === eraName) || eraTimeline[0];
  let step = 0;
  const noteDuration = 60 / era.tempo; // Calculate duration based on tempo

  // Rhythmic composition matrices matching each unique era profile
  const melodies = {
    "1940s Noir":        [55, 65, 58, 62, 55, 69, 58, 60], // Low dark walking bass
    "1950s Rockabilly":  [110, 130, 165, 130, 110, 130, 165, 196], // Fast jumping swing triads
    "1960s Psychedelic": [146, 146, 165, 165, 196, 196, 146, 220], // Continuous smooth drone shapes
    "1970s Disco":       [82, 164, 82, 164, 98, 196, 82, 164], // Octave-jumping alternate bass lines
    "1980s Retro Synth": [110, 165, 220, 165, 130, 196, 261, 196], // Sharp cybernetic synthesizer patterns
    "1990s Grunge":      [73, 73, 110, 98, 73, 73, 87, 82], // Heavy raw power-chord simulations
    "2000s Y2K Pop":     [261, 329, 392, 329, 293, 349, 440, 392] // Bright geometric crystal lead lines
  };

  const currentMelody = melodies[eraName] || melodies["1940s Noir"];
  const waveTypes = {
    "1940s Noir": "sine",
    "1950s Rockabilly": "triangle",
    "1960s Psychedelic": "sine",
    "1970s Disco": "triangle",
    "1980s Retro Synth": "sawtooth",
    "1990s Grunge": "sawtooth",
    "2000s Y2K Pop": "sine"
  };

  gameState.musicInterval = setInterval(() => {
    if (!gameState.preferences.sound || gameState.audioCtx.state === 'suspended') return;

    const osc = gameState.audioCtx.createOscillator();
    const gainNode = gameState.audioCtx.createGain();

    osc.type = waveTypes[eraName] || "sine";
    osc.frequency.setValueAtTime(currentMelody[step % currentMelody.length], gameState.audioCtx.currentTime);

    // Apply soft compression filters depending on the style
    if (eraName === "1990s Grunge" || eraName === "1980s Retro Synth") {
      gainNode.gain.setValueAtTime(0.08, gameState.audioCtx.currentTime); // Soften loud sawtooth waves
    } else {
      gainNode.gain.setValueAtTime(0.12, gameState.audioCtx.currentTime);
    }
    
    gainNode.gain.exponentialRampToValueAtTime(0.001, gameState.audioCtx.currentTime + noteDuration - 0.02);

    osc.connect(gainNode);
    gainNode.connect(gameState.audioCtx.destination);

    osc.start();
    osc.stop(gameState.audioCtx.currentTime + noteDuration);

    step++;
  }, noteDuration * 1000);
}

function stopEraMusic() {
  if (gameState.musicInterval) {
    clearInterval(gameState.musicInterval);
    gameState.musicInterval = null;
  }
  gameState.currentTrackEra = null;
}

function playSfx(freq, type = "sine", duration = 0.15) {
  if (!gameState.preferences.sfx || !gameState.audioCtx) return;
  
  const osc = gameState.audioCtx.createOscillator();
  const gainNode = gameState.audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, gameState.audioCtx.currentTime);
  
  gainNode.gain.setValueAtTime(0.1, gameState.audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, gameState.audioCtx.currentTime + duration);
  
  osc.connect(gainNode);
  gainNode.connect(gameState.audioCtx.destination);
  
  osc.start();
  osc.stop(gameState.audioCtx.currentTime + duration);
}

// ==========================================================================
// 3. NAV ROUTER HOOKS
// ==========================================================================
function transitionToMap() {
  triggerFlashAnimation();
  loadHomepage();
}

function switchView(targetScreenId) {
  document.querySelectorAll('.full-screen-view').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(targetScreenId).classList.add('active');
}

function loadHomepage() {
  switchView("homePage");
  document.getElementById("livesCounter").innerText = gameState.lives;
  document.getElementById("profileGold").innerText = gameState.gold;
  renderMapPathway();

  // Track and start background music for current active era boundary block
  const activeEra = getEraForLevel(gameState.highestUnlockedLevel);
  startEraMusic(activeEra.name);
}

function renderMapPathway() {
  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = ""; 

  const alignments = ["mid", "left", "mid", "right", "mid", "left"];

  eraTimeline.forEach(era => {
    const banner = document.createElement("div");
    banner.className = "era-header-banner";
    banner.innerText = era.name.toUpperCase();
    mapLayer.appendChild(banner);

    for (let i = era.startLvl; i <= era.endLvl; i++) {
      const row = document.createElement("div");
      const alignment = alignments[(i - 1) % alignments.length];
      row.className = `map-row ${alignment}`;

      const button = document.createElement("button");
      button.className = "level-node";
      
      if (i === gameState.highestUnlockedLevel) {
        button.classList.add("active");
      } else if (i < gameState.highestUnlockedLevel) {
        button.classList.add("unlocked");
      } else {
        button.disabled = true;
      }

      button.onclick = () => launchLevelPrePopup(i);

      let recordDisplayStr = "🔒";
      if (i <= gameState.highestUnlockedLevel) {
        const recordsEarned = gameState.levelRecords[i] || 0;
        if (recordsEarned === 0) {
          recordDisplayStr = "⚪ ⚪ ⚪"; 
        } else {
          recordDisplayStr = "📀".repeat(recordsEarned); 
        }
      }

      button.innerHTML = `
        <div class="node-circle">${i}</div>
        <div class="node-records">${recordDisplayStr}</div>
      `;

      row.appendChild(button);
      mapLayer.appendChild(row);
    }
  });
}

// ==========================================================================
// 4. SYSTEM MODAL HANDLERS
// ==========================================================================
function toggleModal(modalId, shouldOpen) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (shouldOpen) {
    modal.classList.add("visible");
    playSfx(440, "sine", 0.08);
  } else {
    modal.classList.remove("visible");
    playSfx(330, "sine", 0.08);
  }
}

function launchLevelPrePopup(levelNumber) {
  if (gameState.lives <= 0) {
    alert("Out of lives! Visit the Time Shop to top up or wait for generation.");
    return;
  }
  gameState.levelPendingStart = levelNumber;
  document.getElementById("modalLevelTitle").innerText = `LEVEL ${levelNumber}`;
  toggleModal('levelReadyModal', true);
}

function confirmAndStartLevel() {
  const targetLvl = gameState.levelPendingStart;
  toggleModal('levelReadyModal', false);
  
  if (!targetLvl) return;
  
  gameState.currentLevel = targetLvl;
  gameState.isGameActive = true;
  gameState.score = 0;
  gameState.moves = 22;
  gameState.targetScore = 400 + (targetLvl * 15); 
  gameState.selectedTile = null;
  
  const currentEra = getEraForLevel(targetLvl);
  document.getElementById("activeEraName").innerText = `Level ${targetLvl} - ${currentEra.name}`;
  document.getElementById("movesDisplay").innerText = gameState.moves;
  document.getElementById("targetDisplay").innerText = gameState.targetScore;
  document.getElementById("scoreDisplay").innerText = gameState.score;
  
  switchView("gamePlayScreen");
  startEraMusic(currentEra.name); // Adapt background audio track to target level era context
  generateRandomBoard();
  drawMatch3Board();
}

// ==========================================================================
// 5. INTERACTIVE CANVAS MATRIX ENGINE
// ==========================================================================
function generateRandomBoard() {
  gameState.grid = [];
  for (let r = 0; r < gameState.boardSize; r++) {
    gameState.grid[r] = [];
    for (let c = 0; c < gameState.boardSize; c++) {
      let validItems = [...gameItems];
      if (c >= 2 && gameState.grid[r][c-1] === gameState.grid[r][c-2]) {
        validItems = validItems.filter(item => item.char !== gameState.grid[r][c-1]);
      }
      if (r >= 2 && gameState.grid[r-1][c] === gameState.grid[r-2][c]) {
        validItems = validItems.filter(item => item.char !== gameState.grid[r-1][c]);
      }
      const randomChoice = validItems[Math.floor(Math.random() * validItems.length)];
      gameState.grid[r][c] = randomChoice.char;
    }
  }
}

function drawMatch3Board() {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const tileSize = canvas.width / gameState.boardSize;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a2429";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < gameState.boardSize; r++) {
    for (let c = 0; c < gameState.boardSize; c++) {
      const x = c * tileSize;
      const y = r * tileSize;

      ctx.strokeStyle = "#3d4f59";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, tileSize, tileSize);

      if (gameState.selectedTile && gameState.selectedTile.r === r && gameState.selectedTile.c === c) {
        ctx.fillStyle = "rgba(212, 175, 55, 0.35)";
        ctx.fillRect(x, y, tileSize, tileSize);
      }

      ctx.font = `${tileSize * 0.55}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(gameState.grid[r][c], x + tileSize / 2, y + tileSize / 2);
    }
  }
}

function handleCanvasClick(event) {
  if (!gameState.isGameActive || gameState.moves <= 0) return;

  // Audio Context unlock catch line for mobile browsers
  if (gameState.audioCtx && gameState.audioCtx.state === 'suspended') {
    gameState.audioCtx.resume();
  }

  const canvas = document.getElementById("gameCanvas");
  const rect = canvas.getBoundingClientRect();
  
  const clickX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const clickY = ((event.clientY - rect.top) / rect.height) * canvas.height;

  const tileSize = canvas.width / gameState.boardSize;
  const c = Math.floor(clickX / tileSize);
  const r = Math.floor(clickY / tileSize);

  if (r >= 0 && r < gameState.boardSize && c >= 0 && c < gameState.boardSize) {
    if (!gameState.selectedTile) {
      gameState.selectedTile = { r, c };
      playSfx(523, "sine", 0.05); // High-pitched tap tone
    } else {
      const dist = Math.abs(gameState.selectedTile.r - r) + Math.abs(gameState.selectedTile.c - c);
      if (dist === 1) {
        swapTiles(gameState.selectedTile.r, gameState.selectedTile.c, r, c);
      } else {
        playSfx(220, "sine", 0.08); // De-selection warning buzz
      }
      gameState.selectedTile = null;
    }
    drawMatch3Board();
  }
}

function swapTiles(r1, c1, r2, c2) {
  let temp = gameState.grid[r1][c1];
  gameState.grid[r1][c1] = gameState.grid[r2][c2];
  gameState.grid[r2][c2] = temp;

  let hasMatches = checkAndClearMatches();

  if (!hasMatches) {
    let tempRevert = gameState.grid[r1][c1];
    gameState.grid[r1][c1] = gameState.grid[r2][c2];
    gameState.grid[r2][c2] = tempRevert;
    playSfx(180, "sawtooth", 0.12);
  } else {
    gameState.moves--;
    document.getElementById("movesDisplay").innerText = gameState.moves;
    playSfx(587, "triangle", 0.1); // Dynamic match confirmation noise
    processBoardGravity();
    checkGameEndCondition();
  }
}

function checkAndClearMatches() {
  let matchGrid = Array(gameState.boardSize).fill(null).map(() => Array(gameState.boardSize).fill(false));
  let matchFound = false;

  for (let r = 0; r < gameState.boardSize; r++) {
    for (let c = 0; c < gameState.boardSize - 2; c++) {
      let matchVal = gameState.grid[r][c];
      if (matchVal && gameState.grid[r][c+1] === matchVal && gameState.grid[r][c+2] === matchVal) {
        matchGrid[r][c] = matchGrid[r][c+1] = matchGrid[r][c+2] = true;
        matchFound = true;
      }
    }
  }

  for (let c = 0; c < gameState.boardSize; c++) {
    for (let r = 0; r < gameState.boardSize - 2; r++) {
      let matchVal = gameState.grid[r][c];
      if (matchVal && gameState.grid[r+1][c] === matchVal && gameState.grid[r+2][c] === matchVal) {
        matchGrid[r][c] = matchGrid[r+1][c] = matchGrid[r+2][c] = true;
        matchFound = true;
      }
    }
  }

  if (matchFound) {
    let tilesCleared = 0;
    for (let r = 0; r < gameState.boardSize; r++) {
      for (let c = 0; c < gameState.boardSize; c++) {
        if (matchGrid[r][c]) {
          gameState.grid[r][c] = null;
          tilesCleared++;
        }
      }
    }
    gameState.score += tilesCleared * 60;
    document.getElementById("scoreDisplay").innerText = gameState.score;
  }

  return matchFound;
}

function processBoardGravity() {
  for (let c = 0; c < gameState.boardSize; c++) {
    let emptyRow = gameState.boardSize - 1;
    for (let r = gameState.boardSize - 1; r >= 0; r--) {
      if (gameState.grid[r][c] !== null) {
        gameState.grid[emptyRow][c] = gameState.grid[r][c];
        if (emptyRow !== r) gameState.grid[r][c] = null;
        emptyRow--;
      }
    }
    for (let r = emptyRow; r >= 0; r--) {
      const randomChoice = gameItems[Math.floor(Math.random() * gameItems.length)];
      gameState.grid[r][c] = randomChoice.char;
    }
  }
  
  drawMatch3Board();
  setTimeout(() => {
    if (checkAndClearMatches()) {
      playSfx(659, "triangle", 0.08); // Cascade sound pitch up
      processBoardGravity();
    }
  }, 250);
}

function checkGameEndCondition() {
  if (gameState.score >= gameState.targetScore) {
    let finalRecords = 1;
    const performanceRatio = gameState.score / gameState.targetScore;
    
    if (performanceRatio >= 1.5) {
      finalRecords = 3; 
    } else if (performanceRatio >= 1.2) {
      finalRecords = 2; 
    }

    // High celebration musical flourish
    playSfx(523, "sine", 0.1);
    setTimeout(() => playSfx(659, "sine", 0.1), 100);
    setTimeout(() => playSfx(784, "sine", 0.1), 200);
    setTimeout(() => playSfx(1046, "sine", 0.3), 300);

    const recordsDisplay = document.getElementById("modalRecordsDisplay");
    recordsDisplay.innerHTML = "📀".repeat(finalRecords);
    toggleModal('levelSuccessModal', true);
    
    const currentStoredRecords = gameState.levelRecords[gameState.currentLevel] || 0;
    if (finalRecords > currentStoredRecords) {
      gameState.levelRecords[gameState.currentLevel] = finalRecords;
      localStorage.setItem("chrono_level_records", JSON.stringify(gameState.levelRecords));
    }

    if (gameState.currentLevel === gameState.highestUnlockedLevel && gameState.highestUnlockedLevel < gameState.totalLevels) {
      gameState.highestUnlockedLevel++;
      localStorage.setItem("chrono_highest_level", gameState.highestUnlockedLevel);
    }
    exitToHome();
  } else if (gameState.moves <= 0) {
    playSfx(150, "sawtooth", 0.5); // Melancholy tone on failure
    alert("Out of Moves! The sequence collapsed.");
    if (gameState.lives > 0) {
      gameState.lives--;
    }
    exitToHome();
  }
}

// ==========================================================================
// 6. PREFERENCES CONTROL PANEL HOOKS
// ==========================================================================
function openSettingsModal() {
  document.getElementById("toggleSoundBtn").className = `setting-toggle-btn ${gameState.preferences.sound ? 'active' : ''}`;
  document.getElementById("toggleSoundBtn").innerText = gameState.preferences.sound ? 'ON' : 'OFF';
  document.getElementById("toggleSfxBtn").className = `setting-toggle-btn ${gameState.preferences.sfx ? 'active' : ''}`;
  document.getElementById("toggleSfxBtn").innerText = gameState.preferences.sfx ? 'ON' : 'OFF';
  document.getElementById("toggleVibeBtn").className = `setting-toggle-btn ${gameState.preferences.vibe ? 'active' : ''}`;
  document.getElementById("toggleVibeBtn").innerText = gameState.preferences.vibe ? 'ON' : 'OFF';
  toggleModal('settingsModal', true);
}

function togglePreference(type) {
  gameState.preferences[type] = !gameState.preferences[type];
  localStorage.setItem("chrono_preferences", JSON.stringify(gameState.preferences));
  
  const btnId = type === 'sound' ? 'toggleSoundBtn' : (type === 'sfx' ? 'toggleSfxBtn' : 'toggleVibeBtn');
  const targetBtn = document.getElementById(btnId);
  targetBtn.className = `setting-toggle-btn ${gameState.preferences[type] ? 'active' : ''}`;
  targetBtn.innerText = gameState.preferences[type] ? 'ON' : 'OFF';

  if (type === 'sound') {
    if (gameState.preferences.sound) {
      const activeEra = getEraForLevel(gameState.currentLevel);
      startEraMusic(activeEra.name);
    } else {
      stopEraMusic();
    }
  }
}

function openHelpPanel() {
  alert("CHRONOCRUSH GUIDE:\n\nMatch 3 vintage artifacts in lines to secure points. Hit the era target score before your moves dry out to accumulate custom Gold Records!");
}

function buyItem(type, cost) {
  if (gameState.gold >= cost) {
    gameState.gold -= cost;
    document.getElementById("profileGold").innerText = gameState.gold;
    playSfx(880, "sine", 0.15); // Successful checkout sound
    alert(`Booster asset purchased successfully!`);
  } else {
    playSfx(180, "sine", 0.2);
    alert("Insolvent coin parameters. Play more timeline eras to accumulate gold!");
  }
}

function exitToHome() {
  gameState.isGameActive = false;
  loadHomepage();
}

function resetGameProgress() {
  if (confirm("Reset timeline milestones?")) {
    gameState.highestUnlockedLevel = 1;
    gameState.levelRecords = {};
    localStorage.setItem("chrono_highest_level", 1);
    localStorage.removeItem("chrono_level_records");
    toggleModal('settingsModal', false);
    loadHomepage();
  }
}

function triggerFlashAnimation() {
  const flash = document.getElementById("portalFlash");
  if (flash) {
    flash.classList.add("active");
    setTimeout(() => flash.classList.remove("active"), 400);
  }
}
