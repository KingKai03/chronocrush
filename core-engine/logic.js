const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ROWS = 4;
const COLS = 4;
let TILE_SIZE = 100; 

let grid = [];
let firstSelectedTile = null; 

let score = 0;
let movesLeft = 20;
let gameActive = true;
let currentEra = "1940s"; 

let unlockedInventory = { coat: false, jacket: false, vest: false, jumpsuit: false };

const eraConfigs = {
    "1940s": { pieces: ["📻", "✒️", "🎩", "🎷"], target: 500, boardBg: "#2b2520", borderColor: "#4a3c31", title: "Current Era: 1940s Noir 🕵️‍♂️" },
    "1950s": { pieces: ["🪩", "🥤", "🎸", "🕶️"], target: 750, boardBg: "#1f2a38", borderColor: "#3b526b", title: "Current Era: 1950s Rock & Roll 🎸⚡" },
    "1960s": { pieces: ["☮️", "🌸", "🚌", "🎨"], target: 1000, boardBg: "#341f38", borderColor: "#603b6b", title: "Current Era: 1960s Peace & Love ☮️🌸" },
    "1970s": { pieces: ["🪩", "✨", "🛼", "🕺"], target: 1250, boardBg: "#3d1822", borderColor: "#7a2b3f", title: "Current Era: 1970s Disco Funk 🪩✨" }
};

// Layout Pointers
const scoreText = document.getElementById("scoreText");
const movesText = document.getElementById("movesText");
const targetText = document.getElementById("targetText");
const currentEraText = document.getElementById("currentEraText");

// Modular Avatar Layer Elements
const layerHair = document.getElementById("layerHair");
const layerFace = document.getElementById("layerFace");
const layerOutfit = document.getElementById("layerOutfit");
const layerBody = document.getElementById("layerBody");
const lblBase = document.getElementById("lblBase");
const avatarMoodBubble = document.getElementById("avatarMoodBubble");
const avatarContainer = document.getElementById("avatarContainer");

// Buttons Links
const coatBtn = document.getElementById("coatBtn");
const jacketBtn = document.getElementById("jacketBtn");
const vestBtn = document.getElementById("vestBtn");
const jumpsuitBtn = document.getElementById("jumpsuitBtn");

// Mobile Layout Scale Calculator Engine
function resizeGame() {
    const width = window.innerWidth;
    if (width <= 768) {
        let evaluatedSize = Math.floor((width * 0.90) / 4);
        TILE_SIZE = Math.min(evaluatedSize, 90);
    } else {
        TILE_SIZE = 100;
    }
    canvas.width = TILE_SIZE * COLS;
    canvas.height = TILE_SIZE * ROWS;
    drawGrid();
}
window.addEventListener("resize", resizeGame);

function initGrid() {
    score = 0; 
    movesLeft = 20; 
    gameActive = true;
    updateUI();
    setAvatarMood("encouraging"); 
    
    for (let r = 0; r < ROWS; r++) {
        grid[r] = []; 
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = getRandomPiece(); 
        }
    }
    while (checkMatches().length > 0) { clearAndRefill(false); }
    resizeGame();
}

function getRandomPiece() {
    const currentPieces = eraConfigs[currentEra].pieces;
    return currentPieces[Math.floor(Math.random() * currentPieces.length)];
}

// BLACK HOLE TRANSITION ENGINE
function triggerTimeTravelWarp(nextEraName) {
    document.body.classList.add("portal-active");
    canvas.className = "implode-active";
    if (avatarContainer) avatarContainer.className = "implode-active";

    setTimeout(() => {
        currentEra = nextEraName;
        initGrid();
        drawGrid();
        setAvatarMood("happy");
        
        canvas.className = "explode-active";
        if (avatarContainer) avatarContainer.className = "explode-active";
    }, 500);

    setTimeout(() => {
        document.body.classList.remove("portal-active");
        canvas.className = "";
        if (avatarContainer) avatarContainer.className = "breathing"; 
    }, 1000);
}

function setAvatarMood(mood) {
    if (!avatarMoodBubble || !layerFace) return;
    if (mood === "encouraging") {
        avatarMoodBubble.innerText = "READY";
        avatarMoodBubble.style.backgroundColor = "#d4af37";
        layerFace.innerText = "😊";
    } else if (mood === "happy") {
        avatarMoodBubble.innerText = "BOOGIE! 🪩";
        avatarMoodBubble.style.backgroundColor = "#2ce642";
        layerFace.innerText = "🤩";
    } else if (mood === "sad") {
        avatarMoodBubble.innerText = "ERROR 💥";
        avatarMoodBubble.style.backgroundColor = "#e62c2c";
        layerFace.innerText = "😭";
    }
}

function updateUI() {
    if (scoreText) scoreText.innerText = score;
    if (movesText) movesText.innerText = movesLeft;
    if (targetText) targetText.innerText = eraConfigs[currentEra].target;
    if (currentEraText) currentEraText.innerText = eraConfigs[currentEra].title;
    
    if (canvas) canvas.style.borderColor = eraConfigs[currentEra].borderColor;

    // Fixed Switchboard Rendering (Added absolute quotes around hex values)
    const processBtn = (btn, unlockedFlag, bgStyle) => {
        if (!btn) return;
        if (unlockedFlag) {
            btn.disabled = false;
            btn.style.backgroundColor = bgStyle;
            btn.style.color = "#fff";
            btn.style.borderColor = "#d4af37";
            btn.style.cursor = "pointer";
        } else {
            btn.disabled = true;
            btn.style.backgroundColor = "#332a22"; // Fixed missing quotes syntax crash
            btn.style.color = "#665544";
            btn.style.borderColor = "#44372c";
            btn.style.cursor = "not-allowed";
        }
    };

    processBtn(coatBtn, unlockedInventory.coat, "#5c4731");
    processBtn(jacketBtn, unlockedInventory.jacket, "#24405e");
    processBtn(vestBtn, unlockedInventory.vest, "#56245e");
    processBtn(jumpsuitBtn, unlockedInventory.jumpsuit, "#701b34");
}

// HIGH-PERFORMANCE RENDERING MATRIX 
function drawGrid() {
    if (!ctx || !canvas) return;
    
    // Paint background loop inside canvas context directly to stop flickering
    ctx.fillStyle = eraConfigs[currentEra].boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const xPos = c * TILE_SIZE; 
            const yPos = r * TILE_SIZE;
            
            if (firstSelectedTile && firstSelectedTile.row === r && firstSelectedTile.col === c) {
                ctx.fillStyle = "rgba(255,255,255,0.18)";
                ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            }
            
            ctx.strokeStyle = eraConfigs[currentEra].borderColor;
            ctx.lineWidth = 1; 
            ctx.strokeRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            
            if (grid[r] && grid[r][c] !== "") {
                ctx.font = `${TILE_SIZE * 0.45}px serif`;
                ctx.textAlign = "center"; 
                ctx.textBaseline = "middle";
                ctx.fillText(grid[r][c], xPos + TILE_SIZE / 2, yPos + TILE_SIZE / 2);
            }
        }
    }
}

// Global Touch/Mouse Input Router
if (canvas) {
    canvas.addEventListener("mousedown", handleInputEvent);
    canvas.addEventListener("touchstart", function(e) {
        if(e.touches.length > 0) {
            e.preventDefault();
            handleInputEvent(e.touches[0]);
        }
    }, {passive: false});
}

function handleInputEvent(eventSource) {
    if (!gameActive || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = eventSource.clientX - rect.left;
    const clickY = eventSource.clientY - rect.top;
    
    const clickedCol = Math.floor(clickX / TILE_SIZE);
    const clickedRow = Math.floor(clickY / TILE_SIZE);
    
    if (clickedRow >= 0 && clickedRow < ROWS && clickedCol >= 0 && clickedCol < COLS) {
        handleTileSelection(clickedRow, clickedCol);
    }
}

function handleTileSelection(row, col) {
    if (firstSelectedTile === null) {
        firstSelectedTile = { row: row, col: col };
        drawGrid();
    } else {
        const dRow = Math.abs(row - firstSelectedTile.row);
        const dCol = Math.abs(col - firstSelectedTile.col);
        if (dRow + dCol === 1) {
            let temp = grid[firstSelectedTile.row][firstSelectedTile.col];
            grid[firstSelectedTile.row][firstSelectedTile.col] = grid[row][col];
            grid[row][col] = temp;
            
            if (checkMatches().length > 0) {
                movesLeft--;
                clearAndRefill(true);
                updateUI();
                checkGameStatus();
            } else {
                grid[row][col] = grid[firstSelectedTile.row][firstSelectedTile.col];
                firstSelectedTile = null;
            }
        }
        firstSelectedTile = null;
        drawGrid();
    }
}

function checkMatches() {
    let matchPositions = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 2; c++) {
            if (grid[r] && grid[r][c] !== "" && grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) {
                matchPositions.push({r: r, c: c}, {r: r, c: c+1}, {r: r, c: c+2});
            }
        }
    }
    for (let r = 0; r < ROWS - 2; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r] && grid[r+1] && grid[r+2] && grid[r][c] !== "" && grid[r][c] === grid[r+1][c] && grid[r][c] === grid[r+2][c]) {
                matchPositions.push({r: r, c: c}, {r: r+1, c: c}, {r: r+2, c: c});
            }
        }
    }
    return matchPositions;
}

function clearAndRefill(awardPoints) {
    let matches = checkMatches();
    if (awardPoints && matches.length > 0) {
        let unique = [];
        for (let m of matches) { if (!unique.some(u => u.r === m.r && u.c === m.c)) unique.push(m); }
        score += unique.length * 50;
        
        if (avatarContainer) {
            avatarContainer.classList.remove("breathing");
            avatarContainer.classList.add("jump-active");
            setTimeout(() => {
                avatarContainer.classList.remove("jump-active");
                if(gameActive) avatarContainer.classList.add("breathing");
            }, 450);
        }
    }
    for (let m of matches) if (grid[m.r]) grid[m.r][m.c] = "";
    for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r] && grid[r][c] === "") {
                for (let l = r - 1; l >= 0; l--) {
                    if (grid[l] && grid[l][c] !== "") { grid[r][c] = grid[l][c]; grid[l][c] = ""; break; }
                }
            }
        }
    }
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) { if (grid[r] && grid[r][c] === "") grid[r][c] = getRandomPiece(); }
    }
    if (checkMatches().length > 0) clearAndRefill(awardPoints);
}

function checkGameStatus() {
    if (score >= eraConfigs[currentEra].target) {
        gameActive = false; setAvatarMood("happy");
        setTimeout(() => {
            if (currentEra === "1940s") { unlockedInventory.coat = true; triggerTimeTravelWarp("1950s"); }
            else if (currentEra === "1950s") { unlockedInventory.jacket = true; triggerTimeTravelWarp("1960s"); }
            else if (currentEra === "1960s") { unlockedInventory.vest = true; triggerTimeTravelWarp("1970s"); }
            else if (currentEra === "1970s") { unlockedInventory.jumpsuit = true; triggerTimeTravelWarp("1940s"); }
        }, 600);
    } else if (movesLeft <= 0) {
        gameActive = false; setAvatarMood("sad");
        setTimeout(() => { alert("Timeline Collapsed! Resetting..."); initGrid(); }, 500);
    }
}

// Customization Connectors
window.changeIdentity = function(genderType, colorValue) {
    if(lblBase) lblBase.innerText = genderType;
    if(layerBody) layerBody.style.backgroundColor = colorValue;
};
window.changeHair = function(emoji) { if (layerHair) layerHair.innerText = emoji; };
window.changeOutfit = function(emoji) { if (layerOutfit) layerOutfit.innerText = emoji; };

initGrid();
