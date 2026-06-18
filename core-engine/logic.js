// ==========================================================================
// 1. STATE SYSTEM MANAGEMENT CONFIGURATION
// ==========================================================================
const gameState = {
  currentUser: null,
  lives: 5,
  gold: 150,
  currentLevel: 1,
  highestUnlockedLevel: 1,
  totalLevels: 6,
  isGameActive: false,
  levelPendingStart: null,
  
  // Track individual earned Gold Records per level
  levelRecords: {}, 

  // Match-3 Core Grid Matrix Variables
  boardSize: 6,
  grid: [],
  score: 0,
  targetScore: 500,
  moves: 22,
  selectedTile: null
};

const gameItems = [
  { id: 1, char: '📻' },
  { id: 2, char: '🎩' },
  { id: 3, char: '✒️' },
  { id: 4, char: '🎷' }
];

// INITIALIZATION BOOT STRAP
document.addEventListener("DOMContentLoaded", () => {
  // 2.5 Second Spinning Record Loading Sequencer
  setTimeout(() => {
    const savedUser = localStorage.getItem("chrono_user");
    if (savedUser) {
      gameState.currentUser = savedUser;
      gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
      
      const savedRecords = localStorage.getItem("chrono_level_records");
      if (savedRecords) {
        gameState.levelRecords = JSON.parse(savedRecords);
      }
      switchView("welcomeScreen");
    } else {
      switchView("authScreen");
    }
  }, 2500); 
  
  const canvas = document.getElementById("gameCanvas");
  if (canvas) {
    canvas.addEventListener("mousedown", handleCanvasClick);
  }
});

// ==========================================================================
// 2. INTERACTION NAVIGATION HANDLERS
// ==========================================================================
function handleAuth(method) {
  if (method === 'email') {
    const emailInput = prompt("Enter your email address to sign in:");
    if (!emailInput || emailInput.trim() === "") return;
    gameState.currentUser = emailInput.split('@')[0];
  } else {
    gameState.currentUser = "TimeTraveler#" + Math.floor(1000 + Math.random() * 9000);
  }
  
  localStorage.setItem("chrono_user", gameState.currentUser);
  triggerFlashAnimation();
  switchView("welcomeScreen");
}

function transitionToMap() {
  triggerFlashAnimation();
  loadHomepage();
}

function handleSignOut() {
  localStorage.clear();
  gameState.currentUser = null;
  gameState.highestUnlockedLevel = 1;
  gameState.levelRecords = {};
  toggleModal('settingsModal', false);
  switchView("authScreen");
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
}

function renderMapPathway() {
  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = ""; 

  const alignments = ["mid", "left", "mid", "right", "mid", "left"];

  for (let i = 1; i <= gameState.totalLevels; i++) {
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

    // GOLD RECORD GENERATOR 
    let recordDisplayStr = "🔒";
    if (i <= gameState.highestUnlockedLevel) {
      const recordsEarned = gameState.levelRecords[i] || 0;
      if (recordsEarned === 0) {
        recordDisplayStr = "⚪ ⚪ ⚪"; 
      } else {
        recordDisplayStr = "残留".replace("残留", "📀").repeat(recordsEarned); 
      }
    }

    button.innerHTML = `
      <div class="node-circle">${i}</div>
      <div class="node-records">${recordDisplayStr}</div>
    `;

    row.appendChild(button);
    mapLayer.appendChild(row);
  }
}

// ==========================================================================
// 3. POPUP MODALS LOGIC OVERLAYS
// ==========================================================================
function toggleModal(modalId, shouldOpen) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (shouldOpen) {
    modal.classList.add("visible");
  } else {
    modal.classList.remove("visible");
  }
}

function launchLevelPrePopup(levelNumber) {
  if (gameState.lives <= 0) {
    alert("Out of lives! Wait or buy more using coins.");
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
  gameState.targetScore = 400 + (targetLvl * 100);
  gameState.selectedTile = null;
  
  document.getElementById("activeEraName").innerText = `Level ${targetLvl} - 1940s Noir`;
  document.getElementById("movesDisplay").innerText = gameState.moves;
  document.getElementById("targetDisplay").innerText = gameState.targetScore;
  document.getElementById("scoreDisplay").innerText = gameState.score;
  
  switchView("gamePlayScreen");
  generateRandomBoard();
  drawMatch3Board();
}

// ==========================================================================
// 4. INTERACTIVE MATCH-3 GAME RECKONING ENGINE
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
        ctx.fillStyle = "rgba(212, 175, 55, 0.3)";
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

  const canvas = document.getElementById("gameCanvas");
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  const tileSize = canvas.width / gameState.boardSize;
  const c = Math.floor(clickX / tileSize);
  const r = Math.floor(clickY / tileSize);

  if (r >= 0 && r < gameState.boardSize && c >= 0 && c < gameState.boardSize) {
    if (!gameState.selectedTile) {
      gameState.selectedTile = { r, c };
    } else {
      const dist = Math.abs(gameState.selectedTile.r - r) + Math.abs(gameState.selectedTile.c - c);
      if (dist === 1) {
        swapTiles(gameState.selectedTile.r, gameState.selectedTile.c, r, c);
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
  } else {
    gameState.moves--;
    document.getElementById("movesDisplay").innerText = gameState.moves;
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
      processBoardGravity();
    }
  }, 250);
}

function checkGameEndCondition() {
  if (gameState.score >= gameState.targetScore) {
    // Dynamic Gold Record Allocation Logic
    let finalRecords = 1;
    const performanceRatio = gameState.score / gameState.targetScore;
    
    if (performanceRatio >= 1.5) {
      finalRecords = 3; 
    } else if (performanceRatio >= 1.2) {
      finalRecords = 2; 
    }

    alert(`Level Complete!\nScore: ${gameState.score}\nYou earned ${finalRecords} Gold Record(s)! 📀`);
    
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
    alert("Out of Moves! The sequence collapsed.");
    if (gameState.lives > 0) {
      gameState.lives--;
      document.getElementById("livesCounter").innerText = gameState.lives;
    }
    exitToHome();
  }
}

// ==========================================================================
// 5. DESTRUCTIVE ACTIONS & COSMETICS HOOKS
// ==========================================================================
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
