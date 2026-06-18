const gameState = {
  lives: 5, gold: 150, currentLevel: 1, highestUnlockedLevel: 1, totalLevels: 70,
  isGameActive: false, levelPendingStart: null, levelRecords: {}, boardSize: 6, grid: [],
  score: 0, targetScore: 500, moves: 22, selectedTile: null,
  preferences: { sound: true, sfx: true, vibe: true },
  audioCtx: null, musicInterval: null, currentTrackEra: null, matchExplosions: []
};

const eraTimeline = [
  { name: "1940s Noir", startLvl: 1, endLvl: 10, tempo: 110, melody: [130, 147, 165, 147], wave: "sine" },
  { name: "1950s Rockabilly", startLvl: 11, endLvl: 20, tempo: 145, melody: [220, 261, 329, 261], wave: "triangle" },
  { name: "1960s Psychedelic", startLvl: 21, endLvl: 30, tempo: 90, melody: [196, 220, 293, 329], wave: "sine" },
  { name: "1970s Disco", startLvl: 31, endLvl: 40, tempo: 125, melody: [164, 329, 220, 440], wave: "triangle" },
  { name: "1980s Retro Synth", startLvl: 41, endLvl: 50, tempo: 128, melody: [220, 440, 329, 659], wave: "sawtooth" },
  { name: "1990s Grunge", startLvl: 51, endLvl: 60, tempo: 105, melody: [146, 165, 146, 130], wave: "sawtooth" },
  { name: "2000s Y2K Pop", startLvl: 61, endLvl: 70, tempo: 132, melody: [261, 392, 329, 440], wave: "sine" }
];

const gameItems = ['📻', '🎩', '✒️', '🎷'];

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    gameState.highestUnlockedLevel = parseInt(localStorage.getItem("chrono_highest_level")) || 1;
    gameState.levelRecords = JSON.parse(localStorage.getItem("chrono_level_records")) || {};
    gameState.preferences = JSON.parse(localStorage.getItem("chrono_preferences")) || {sound:true, sfx:true, vibe:true};
    switchView("welcomeScreen");
  }, 1500);
  const canvas = document.getElementById("gameCanvas");
  if (canvas) canvas.addEventListener("mousedown", handleCanvasClick);
  
  setInterval(updateAndDrawBoard, 40);
});

/* Force immediate user-gesture unlock to bypass standard browser audio blocks */
function initAudio() { 
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (gameState.audioCtx && gameState.audioCtx.state === 'suspended') {
    gameState.audioCtx.resume();
  }
}

function startEraMusic(eraName) {
  initAudio(); 
  if (!gameState.preferences.sound) return;
  if (gameState.currentTrackEra === eraName && gameState.musicInterval) return;
  
  stopEraMusic(); 
  gameState.currentTrackEra = eraName;
  const era = eraTimeline.find(e => e.name === eraName);
  let step = 0; const noteLen = 60 / era.tempo;
  
  gameState.musicInterval = setInterval(() => {
    if (!gameState.preferences.sound || !gameState.audioCtx || gameState.audioCtx.state === 'suspended') return;
    
    const osc = gameState.audioCtx.createOscillator();
    const gain = gameState.audioCtx.createGain();
    
    osc.type = era.wave;
    osc.frequency.setValueAtTime(era.melody[step % era.melody.length], gameState.audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.06, gameState.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, gameState.audioCtx.currentTime + noteLen - 0.02);
    
    osc.connect(gain); 
    gain.connect(gameState.audioCtx.destination);
    
    osc.start(); 
    osc.stop(gameState.audioCtx.currentTime + noteLen);
    step++;
  }, noteLen * 1000);
}

function stopEraMusic() { 
  if (gameState.musicInterval) { 
    clearInterval(gameState.musicInterval); 
    gameState.musicInterval = null; 
  } 
  gameState.currentTrackEra = null; 
}

function triggerVibration(sequence) {
  if (gameState.preferences.vibe && navigator.vibrate) {
    navigator.vibrate(sequence);
  }
}

function switchView(id) { 
  document.querySelectorAll('.full-screen-view').forEach(s => s.classList.remove('active')); 
  document.getElementById(id).classList.add('active'); 
}

function loadHomepage() {
  switchView("homePage");
  document.getElementById("livesCounter").innerText = gameState.lives;
  document.getElementById("profileGold").innerText = gameState.gold;
  const mapLayer = document.getElementById("mapLayer");
  mapLayer.innerHTML = "";
  const align = ["mid", "left", "mid", "right"];
  
  eraTimeline.forEach(era => {
    const banner = document.createElement("div"); banner.className = "era-header-banner"; banner.innerText = era.name.toUpperCase(); mapLayer.appendChild(banner);
    for (let i = era.startLvl; i <= era.endLvl; i++) {
      const row = document.createElement("div"); row.className = `map-row ${align[i % 4]}`;
      const btn = document.createElement("button"); btn.className = `level-node ${i==gameState.highestUnlockedLevel?'active':(i<gameState.highestUnlockedLevel?'unlocked':'')}`;
      if (i > gameState.highestUnlockedLevel) btn.disabled = true;
      btn.onclick = () => { initAudio(); gameState.levelPendingStart = i; document.getElementById("modalLevelTitle").innerText = `LEVEL ${i}`; toggleModal('levelReadyModal', true); };
      const recs = gameState.levelRecords[i] ? "📀".repeat(gameState.levelRecords[i]) : (i<=gameState.highestUnlockedLevel?"⚪⚪⚪":"🔒");
      btn.innerHTML = `<div class="node-circle">${i}</div><div class="node-records">${recs}</div>`;
      row.appendChild(btn); mapLayer.appendChild(row);
    }
  });
  
  const currentEra = eraTimeline.find(e => gameState.highestUnlockedLevel >= e.startLvl && gameState.highestUnlockedLevel <= e.endLvl);
  if (currentEra) startEraMusic(currentEra.name);
}

function toggleModal(id, open) { 
  const m = document.getElementById(id); 
  if (open) m.classList.add('visible'); else m.classList.remove('visible'); 
}

function confirmAndStartLevel() {
  toggleModal('levelReadyModal', false);
  const lvl = gameState.levelPendingStart; gameState.currentLevel = lvl; gameState.isGameActive = true; gameState.score = 0; gameState.moves = 22; gameState.targetScore = 400 + (lvl * 20);
  document.getElementById("activeEraName").innerText = `Level ${lvl}`;
  document.getElementById("movesDisplay").innerText = 22; document.getElementById("targetDisplay").innerText = gameState.targetScore; document.getElementById("scoreDisplay").innerText = 0;
  switchView("gamePlayScreen");
  
  // Audio configuration context continues playing context music loops without cutting out
  const era = eraTimeline.find(e => lvl >= e.startLvl && lvl <= e.endLvl);
  if (era) startEraMusic(era.name);
  
  generateBoard();
}

function generateBoard() {
  for (let r=0; r<6; r++) { gameState.grid[r]=[]; for (let c=0; c<6; c++) { gameState.grid[r][c] = gameItems[Math.floor(Math.random()*4)]; } }
}

function updateAndDrawBoard() {
  const canvas = document.getElementById("gameCanvas"); if (!canvas) return;
  const ctx = canvas.getContext("2d"); ctx.clearRect(0,0,320,320);
  
  for (let r=0; r<6; r++) { for (let c=0; c<6; c++) {
    const x = c*53.3; const y = r*53.3; ctx.strokeStyle = "#475861"; ctx.strokeRect(x,y,53.3,53.3);
    if (gameState.selectedTile?.r == r && gameState.selectedTile?.c == c) { ctx.fillStyle = "rgba(212,175,55,0.25)"; ctx.fillRect(x,y,53.3,53.3); }
    if (gameState.grid[r] && gameState.grid[r][c]) {
      ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(gameState.grid[r][c], x+26.6, y+26.6);
    }
  }}
  
  for (let i = gameState.matchExplosions.length - 1; i >= 0; i--) {
    let p = gameState.matchExplosions[i]; ctx.fillStyle = `rgba(212,175,55,${p.alpha})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    p.y += p.vy; p.size *= 0.92; p.alpha -= 0.05;
    if (p.alpha <= 0) gameState.matchExplosions.splice(i, 1);
  }
}

function handleCanvasClick(e) {
  if (!gameState.isGameActive) return; initAudio();
  const rect = e.target.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const c = Math.floor(x/53.3); const r = Math.floor(y/53.3);
  
  if (!gameState.selectedTile) { 
    gameState.selectedTile = {r,c}; 
    triggerVibration(20); 
  } else {
    const dist = Math.abs(gameState.selectedTile.r - r) + Math.abs(gameState.selectedTile.c - c);
    if (dist == 1) { 
      swap(gameState.selectedTile.r, gameState.selectedTile.c, r, c); 
    } else {
      gameState.selectedTile = {r,c}; 
      triggerVibration(20);
    }
  }
}

function swap(r1,c1,r2,c2) {
  let tmp = gameState.grid[r1][c1]; gameState.grid[r1][c1] = gameState.grid[r2][c2]; gameState.grid[r2][c2] = tmp;
  gameState.moves--; document.getElementById("movesDisplay").innerText = gameState.moves;
  
  triggerVibration(45); 
  checkMatches();
  gameState.selectedTile = null;
}

function checkMatches() {
  let found = false;
  let matchRows = [];
  
  for (let r=0; r<6; r++) { for (let c=0; c<4; c++) {
    if (gameState.grid[r][c] && gameState.grid[r][c] == gameState.grid[r][c+1] && gameState.grid[r][c] == gameState.grid[r][c+2]) {
      matchRows.push({r, c: c}); matchRows.push({r, c: c+1}); matchRows.push({r, c: c+2}); found = true;
    }
  }}
  
  if (found) {
    gameState.score += 120; document.getElementById("scoreDisplay").innerText = gameState.score;
    
    triggerVibration([80, 50, 80]); 
    const wrapper = document.querySelector(".canvas-board-wrapper");
    wrapper.classList.add("board-flash"); setTimeout(() => wrapper.classList.remove("board-flash"), 300);
    
    matchRows.forEach(pos => {
      for(let k=0; k<5; k++) {
        gameState.matchExplosions.push({ x: (pos.c * 53.3) + 26, y: (pos.r * 53.3) + 26, size: 8, alpha: 1, vy: -1 - Math.random()*2 });
      }
      gameState.grid[pos.r][pos.c] = gameItems[Math.floor(Math.random()*4)]; 
    });
  }
  
  if (gameState.score >= gameState.targetScore) { 
    setTimeout(win, 350); 
  } else if (gameState.moves <= 0) { 
    alert("Out of moves!"); exitToHome(); 
  }
}

function win() {
  triggerVibration([100, 50, 100, 50, 250]);
  let stars = gameState.score > gameState.targetScore*1.5 ? 3 : (gameState.score > gameState.targetScore*1.2 ? 2 : 1);
  gameState.levelRecords[gameState.currentLevel] = stars;
  localStorage.setItem("chrono_level_records", JSON.stringify(gameState.levelRecords));
  if (gameState.currentLevel == gameState.highestUnlockedLevel) { gameState.highestUnlockedLevel++; localStorage.setItem("chrono_highest_level", gameState.highestUnlockedLevel); }
  document.getElementById("modalRecordsDisplay").innerHTML = "📀".repeat(stars);
  toggleModal('levelSuccessModal', true);
  exitToHome();
}

function exitToHome() { gameState.isGameActive = false; loadHomepage(); }
function transitionToMap() { initAudio(); triggerFlashAnimation(); loadHomepage(); }
function handleAuth() { initAudio(); triggerFlashAnimation(); switchView("welcomeScreen"); }
function triggerFlashAnimation() { const f = document.getElementById("portalFlash"); f.classList.add('active'); setTimeout(()=>f.classList.remove('active'), 400); }
function openSettingsModal() { toggleModal('settingsModal', true); }
function openHelpPanel() { alert("Match 3 items to earn Gold Records!"); }

function togglePreference(p) { 
  gameState.preferences[p] = !gameState.preferences[p]; 
  localStorage.setItem("chrono_preferences", JSON.stringify(gameState.preferences)); 
  const btn = document.getElementById(`toggle${p.charAt(0).toUpperCase() + p.slice(1)}Btn`);
  if (gameState.preferences[p]) btn.classList.add('active'); else btn.classList.remove('active');
  btn.innerText = gameState.preferences[p] ? "ON" : "OFF";
  if(p === 'sound') { if(!gameState.preferences.sound) stopEraMusic(); else { gameState.currentTrackEra = null; loadHomepage(); } }
}

function resetGameProgress() { localStorage.clear(); location.reload(); }
