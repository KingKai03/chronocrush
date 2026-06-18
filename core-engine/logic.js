// STATE SYSTEM MANAGEMENT CONFIG
const gameState = {
  currentUser: null,
  lives: 5,
  gold: 150,
  currentLevel: 1,
  highestUnlockedLevel: 1,
  totalLevels: 6,
  isGameActive: false
};

// INITIALIZATION ROUTINE ON DOM LOAD
document.addEventListener("DOMContentLoaded", () => {
  // Check localStorage to see if a session exists
  const savedUser = localStorage.getItem("chrono_user");
  if (savedUser) {
    gameState.currentUser = savedUser;
    gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
    loadHomepage();
  }
});

// AUTH MODULE CONTROL FLOW
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
  loadHomepage();
}

function handleSignOut() {
  localStorage.clear();
  gameState.currentUser = null;
  gameState.highestUnlockedLevel = 1;
  toggleSettings(false);
  switchView("authScreen");
}

// CONTROL PAGE COMPONENT SWITCHING
function switchView(targetScreenId) {
  document.querySelectorAll('.full-screen-view').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(targetScreenId).classList.add('active');
}

// LEVEL HOMEPAGE MAP ENGINE BUILDER
function loadHomepage() {
  switchView("homePage");
  document.getElementById("livesCounter").innerText = gameState.lives;
  document.getElementById("profileGold").innerText = gameState.gold;
  renderMapPathway();
}

function renderMapPathway() {
  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = ""; // Clear active rendering layers

  // Define alternating positions like Candy Crush map paths
  const alignments = ["mid", "left", "mid", "right", "mid", "left"];

  for (let i = 1; i <= gameState.totalLevels; i++) {
    const row = document.createElement("div");
    const alignment = alignments[(i - 1) % alignments.length];
    row.className = `map-row ${alignment}`;

    const button = document.createElement("button");
    button.className = "level-node";
    
    // Evaluate operational locking states
    if (i === gameState.highestUnlockedLevel) {
      button.classList.add("active");
    } else if (i < gameState.highestUnlockedLevel) {
      button.classList.add("unlocked");
    } else {
      button.disabled = true;
    }

    button.onclick = () => launchLevelArena(i);

    button.innerHTML = `
      <div class="node-circle">${i}</div>
      <div class="node-records">${i <= gameState.highestUnlockedLevel ? "⭐⭐⭐" : "🔒"}</div>
    `;

    row.appendChild(button);
    mapLayer.appendChild(row);
  }
}

// LAUNCH DEDICATED LEVEL PLAYGROUND GAME SCREEN
function launchLevelArena(levelNumber) {
  if (gameState.lives <= 0) {
    alert("Out of lives! Wait or refill using coins.");
    return;
  }
  
  gameState.currentLevel = levelNumber;
  gameState.isGameActive = true;
  
  // Update header context text interface elements
  document.getElementById("activeEraName").innerText = `Level ${levelNumber} - 1940s Noir`;
  document.getElementById("movesDisplay").innerText = "22";
  document.getElementById("scoreDisplay").innerText = "0";
  
  switchView("gamePlayScreen");
  initMatch3Engine(); // Call hook placeholder for grid calculations
}

function exitToHome() {
  gameState.isGameActive = false;
  loadHomepage();
}

// LIVES MANAGEMENT CALCULATIONS PLACEHOLDER HOOKS
function consumeLife() {
  if(gameState.lives > 0) {
    gameState.lives--;
    document.getElementById("livesCounter").innerText = gameState.lives;
  }
}

// SETTINGS DIALOG VIEW SWITCHES
function toggleSettings(shouldOpen) {
  const modal = document.getElementById("settingsModal");
  if (shouldOpen) {
    modal.classList.add("visible");
  } else {
    modal.classList.remove("visible");
  }
}

function resetGameProgress() {
  if (confirm("Are you sure you want to completely clear your historical era progress data?")) {
    gameState.highestUnlockedLevel = 1;
    localStorage.setItem("chrono_highest_level", 1);
    toggleSettings(false);
    loadHomepage();
  }
}

// COSMETIC SCREEN TRANSITION PORTAL FLASH FLUIDITY
function triggerFlashAnimation() {
  const flash = document.getElementById("portalFlash");
  flash.classList.add("active");
  setTimeout(() => {
    flash.classList.remove("active");
  }, 400);
}

// SIMPLE FALLBACK ENGINE DRAW EMBED
function initMatch3Engine() {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Clear and print baseline loading context signature onto canvas view directly
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "#d4af37";
  ctx.font = "14px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("[ Grid Interactive Canvas Loaded ]", canvas.width / 2, canvas.height / 2);
  ctx.fillText(`Playing Level ${gameState.currentLevel}`, canvas.width / 2, (canvas.height / 2) + 24);
}
