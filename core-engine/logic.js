const gameState = { highestUnlockedLevel: 1 };

document.addEventListener("DOMContentLoaded", () => {
  // Fixes the "DOM fully loaded" error by waiting for full render
  loadHomepage();
});

function loadHomepage() {
  const mapLayer = document.getElementById("mapLayer");
  if (!mapLayer) return;
  mapLayer.innerHTML = ""; 

  // Hardcoded era structure to ensure no errors
  const eras = [
    { name: "1940S NOIR", start: 1, end: 10 },
    { name: "1950S ROCKABILLY", start: 11, end: 20 }
  ];

  eras.forEach(era => {
    const banner = document.createElement("div");
    banner.className = "era-header-banner";
    banner.innerText = era.name;
    mapLayer.appendChild(banner);

    for (let i = era.start; i <= era.end; i++) {
      const btn = document.createElement("button");
      btn.className = "level-node unlocked";
      btn.innerText = i;
      mapLayer.appendChild(btn);
    }
  });
  
  // Ensure the page is set to active
  document.getElementById("homePage").classList.add("active");
}/* ============================================================
   CHRONOCRUSH — logic.js
   ============================================================ */

const gameState = {
  lives: 5, gold: 150, currentLevel: 1, highestUnlockedLevel: 1, totalLevels: 70,
  isGameActive: false, levelPendingStart: null, levelRecords: {}, boardSize: 6, grid: [],
  score: 0, targetScore: 500, moves: 22, selectedTile: null,
  preferences: { sound: true, sfx: true, vibe: true },
  audioCtx: null, musicInterval: null, currentTrackEra: null, matchExplosions: []
};

// Global variables
let fxCanvas = null, fxCtx = null, fxParticles = [], fxAnimationId = null;

const eraTimeline = [
  { name: "1940s Noir", startLvl: 1, endLvl: 10, tempo: 80, melody: [196, 220, 246, 220], wave: "sine" },
  { name: "1950s Rockabilly", startLvl: 11, endLvl: 20, tempo: 85, melody: [220, 261, 329, 261], wave: "sine" },
  { name: "1960s Psychedelic", startLvl: 21, endLvl: 30, tempo: 80, melody: [293, 329, 392, 329], wave: "sine" },
  { name: "1970s Disco", startLvl: 31, endLvl: 40, tempo: 90, melody: [220, 329, 293, 220], wave: "sine" },
  { name: "1980s Retro Synth", startLvl: 41, endLvl: 50, tempo: 95, melody: [329, 392, 440, 392], wave: "sine" },
  { name: "1990s Grunge", startLvl: 51, endLvl: 60, tempo: 80, melody: [196, 220, 196, 174], wave: "sine" },
  { name: "2000s Y2K Pop", startLvl: 61, endLvl: 70, tempo: 95, melody: [261, 329, 392, 329], wave: "sine" }
];

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  
  // Initialization
  gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
  
  // Render the Map
  loadHomepage();
});

// CORE VIEW SWITCHER - Keeps background visible, updates foreground
function switchView(id) {
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
  }
}

function loadHomepage() {
  switchView("homePage");
  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = ""; // Clear existing

  eraTimeline.forEach(era => {
    const banner = document.createElement("div");
    banner.className = "era-header-banner";
    banner.innerText = era.name.toUpperCase();
    mapLayer.appendChild(banner);

    for (let i = era.startLvl; i <= era.endLvl; i++) {
      const btn = document.createElement("button");
      btn.className = `level-node ${i <= gameState.highestUnlockedLevel ? 'unlocked' : ''}`;
      btn.innerHTML = `<div class="node-circle">${i}</div>`;
      btn.onclick = () => { 
        gameState.levelPendingStart = i;
        toggleModal('levelReadyModal', true);
      };
      mapLayer.appendChild(btn);
    }
  });
}

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.toggle('visible', show);
}

function transitionToMap() {
  loadHomepage();
}

function confirmAndStartLevel() {
  toggleModal('levelReadyModal', false);
  startLevelLogic(gameState.levelPendingStart);
}

function startLevelLogic(lvl) {
  gameState.currentLevel = lvl;
  gameState.isGameActive = true;
  document.getElementById("activeEraName").innerText = "LEVEL " + lvl;
  switchView("gamePlayScreen");
  generateBoard();
}

function generateBoard() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  // Simple board draw placeholder
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0,0,320,320);
}

function openSettingsModal() { toggleModal('settingsModal', true); }

function togglePreference(p) {
    gameState.preferences[p] = !gameState.preferences[p];
    alert(p + " is now " + (gameState.preferences[p] ? "ON" : "OFF"));
}

function advanceToNextLevel() {
    toggleModal('levelSuccessModal', false);
    loadHomepage();
}

function retryCurrentLevel() {
    toggleModal('levelSuccessModal', false);
    startLevelLogic(gameState.currentLevel);
}
