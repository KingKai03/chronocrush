
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ROWS = 4;
const COLS = 4;
const TILE_SIZE = 100; 

let grid = [];
let firstSelectedTile = null; 

// GAME STATE ENGINE VARIABLES
let score = 0;
let movesLeft = 20;
let gameActive = true;
let currentEra = "1940s"; 

// UNLOCKED CLOSET INVENTORY DATABASE
let unlockedInventory = {
    coat: false,
    jacket: false,
    vest: false
};

// ERA DESIGN CONFIGURATION SCHEMES
const eraConfigs = {
    "1940s": {
        pieces: ["📻", "✒️", "🎩", "🎷"], 
        target: 500,
        boardBg: "#2b2520",
        borderColor: "#4a3c31",
        title: "Current Era: 1940s Noir 🕵️‍♂️"
    },
    "1950s": {
        pieces: ["🪩", "🥤", "🎸", "🕶️"], 
        target: 750, 
        boardBg: "#1f2a38", 
        borderColor: "#3b526b",
        title: "Current Era: 1950s Rock & Roll 🎸⚡"
    },
    "1960s": {
        pieces: ["☮️", "🌸", "🚌", "🎨"], // Peace, Flower, VW Bus, Tie-Dye Palette
        target: 1000, // Higher master target score!
        boardBg: "#341f38", // Psychadelic deep purple background
        borderColor: "#603b6b",
        title: "Current Era: 1960s Peace & Love ☮️🌸"
    }
};

// Connect to our HTML UI components
const scoreText = document.getElementById("scoreText");
const movesText = document.getElementById("movesText");
const targetText = document.getElementById("targetText");
const currentEraText = document.getElementById("currentEraText");
const avatarEquipped = document.getElementById("avatarEquipped");
const coatBtn = document.getElementById("coatBtn");
const jacketBtn = document.getElementById("jacketBtn");
const vestBtn = document.getElementById("vestBtn");

function initGrid() {
    score = 0;
    movesLeft = 20;
    gameActive = true;
    
    updateUI();
    
    for (let r = 0; r < ROWS; r++) {
        grid[r] = []; 
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = getRandomPiece(); 
        }
    }
    while (checkMatches().length > 0) {
        clearAndRefill(false); 
    }
}

function getRandomPiece() {
    const currentPieces = eraConfigs[currentEra].pieces;
    return currentPieces[Math.floor(Math.random() * currentPieces.length)];
}

function updateUI() {
    if (scoreText) scoreText.innerText = score;
    if (movesText) movesText.innerText = movesLeft;
    if (targetText) targetText.innerText = eraConfigs[currentEra].target;
    if (currentEraText) currentEraText.innerText = eraConfigs[currentEra].title;
    
    canvas.style.backgroundColor = eraConfigs[currentEra].boardBg;
    canvas.style.borderColor = eraConfigs[currentEra].borderColor;

    // Refresh closet layout buttons state based on unlocks database
    if (unlockedInventory.coat) {
        coatBtn.disabled = false;
        coatBtn.style.backgroundColor = "#5c4731";
        coatBtn.style.color = "#fff";
        coatBtn.style.border = "2px solid #d4af37";
        coatBtn.style.cursor = "pointer";
        coatBtn.innerHTML = "🧥 Wear Coat";
    }
    if (unlockedInventory.jacket) {
        jacketBtn.disabled = false;
        jacketBtn.style.backgroundColor = "#24405e";
        jacketBtn.style.color = "#fff";
        jacketBtn.style.border = "2px solid #5cb3ff";
        jacketBtn.style.cursor = "pointer";
        jacketBtn.innerHTML = "🧥⚡ Wear Jacket";
    }
    if (unlockedInventory.vest) {
        vestBtn.disabled = false;
        vestBtn.style.backgroundColor = "#56245e";
        vestBtn.style.color = "#fff";
        vestBtn.style.border = "2px solid #df5cff";
        vestBtn.style.cursor = "pointer";
        vestBtn.innerHTML = "🎽🌸 Wear Vest";
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const xPos = c * TILE_SIZE;
            const yPos = r * TILE_SIZE;
            
            if (firstSelectedTile && firstSelectedTile.row === r && firstSelectedTile.col === c) {
                if (currentEra === "1940s") ctx.fillStyle = "#5c4d3c";
                else if (currentEra === "1950s") ctx.fillStyle = "#3b4d61";
                else ctx.fillStyle = "#543b61";
                ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            }
            
            ctx.strokeStyle = eraConfigs[currentEra].borderColor; 
            ctx.lineWidth = 2;
            ctx.strokeRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            
            if (grid[r][c] !== "") {
                ctx.font = "44px serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(grid[r][c], xPos + TILE_SIZE / 2, yPos + TILE_SIZE / 2);
            }
        }
    }
}

canvas.addEventListener("mousedown", function(event) {
    if (!gameActive) return; 

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const clickedCol = Math.floor(clickX / TILE_SIZE);
    const clickedRow = Math.floor(clickY / TILE_SIZE);
    
    handleTileSelection(clickedRow, clickedCol);
});

function handleTileSelection(row, col) {
    if (firstSelectedTile === null) {
        firstSelectedTile = { row: row, col: col };
        drawGrid();
    } else {
        const dRow = Math.abs(row - firstSelectedTile.row);
        const dCol = Math.abs(col - firstSelectedTile.col);
        const isNeighbor = (dRow + dCol === 1);
        
        if (isNeighbor) {
            let temp = grid[firstSelectedTile.row][firstSelectedTile.col];
            grid[firstSelectedTile.row][firstSelectedTile.col] = grid[row][col];
            grid[row][col] = temp;
            
            let matchesFound = checkMatches();
            
            if (matchesFound.length > 0) {
                movesLeft--;
                clearAndRefill(true); 
                updateUI();
                checkGameStatus();
            } else {
                grid[row][col] = grid[firstSelectedTile.row][firstSelectedTile.col];
                grid[firstSelectedTile.row][firstSelectedTile.col] = temp;
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
            let p1 = grid[r][c]; let p2 = grid[r][c+1]; let p3 = grid[r][c+2];
            if (p1 !== "" && p1 === p2 && p1 === p3) {
                matchPositions.push({r: r, c: c}, {r: r, c: c+1}, {r: r, c: c+2});
            }
        }
    }
    for (let r = 0; r < ROWS - 2; r++) {
        for (let c = 0; c < COLS; c++) {
            let p1 = grid[r][c]; let p2 = grid[r+1][c]; let p3 = grid[r+2][c];
            if (p1 !== "" && p1 === p2 && p1 === p3) {
                matchPositions.push({r: r, c: c}, {r: r+1, c: c}, {r: r+2, c: c});
            }
        }
    }
    return matchPositions;
}

function clearAndRefill(awardPoints) {
    let matches = checkMatches();
    
    if (awardPoints && matches.length > 0) {
        let uniqueMatches = [];
        for (let m of matches) {
            if (!uniqueMatches.some(u => u.r === m.r && u.c === m.c)) {
                uniqueMatches.push(m);
            }
        }
        score += uniqueMatches.length * 50;
    }

    for (let m of matches) {
        grid[m.r][m.c] = "";
    }

    for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c] === "") {
                for (let lookup = r - 1; lookup >= 0; lookup--) {
                    if (grid[lookup][c] !== "") {
                        grid[r][c] = grid[lookup][c];
                        grid[lookup][c] = "";
                        break;
                    }
                }
            }
        }
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === "") {
                grid[r][c] = getRandomPiece();
            }
        }
    }

    if (checkMatches().length > 0) {
        clearAndRefill(awardPoints);
    }
}

function checkGameStatus() {
    const currentTarget = eraConfigs[currentEra].target;
    
    if (score >= currentTarget) {
        gameActive = false;
        setTimeout(() => {
            if (currentEra === "1940s") {
                alert("✨ TIMELINE RESTORED! ✨\nYou won Level 1! You unlocked the '40s Trench Coat. Teleporting to the 1950s Rock & Roll world!");
                unlockedInventory.coat = true; 
                currentEra = "1950s"; 
            } else if (currentEra === "1950s") {
                alert("🎸 NEON TIMELINE CHARGED! ✨\nYou beat Level 2! You unlocked the '50s Leather Jacket! Teleporting to the 1960s Woodstock era!");
                unlockedInventory.jacket = true; 
                currentEra = "1960s"; 
            } else if (currentEra === "1960s") {
                alert("🌸 GROOVY HARMONY ACHIEVED! ✌️\nYou beat Level 3! You unlocked the '60s Fringe Vest! The timeline loop is stable!");
                unlockedInventory.vest = true;
                currentEra = "1940s"; // Loop back around to the beginning
            }
            initGrid(); 
            drawGrid();
        }, 300);
    } else if (movesLeft <= 0) {
        gameActive = false;
        setTimeout(() => {
            alert("❌ TIMELINE COLLAPSED! ❌\nThe engine failed. Redoing this level!");
            initGrid(); 
            drawGrid();
        }, 300);
    }
}

// INTERACTIVE CLOSET ACTION CONTROLLER
window.equipItem = function(itemType) {
    if (itemType === 'coat' && unlockedInventory.coat) {
        avatarEquipped.innerText = "1940s Detective Noir 🕵️‍♂️🧥";
    } else if (itemType === 'jacket' && unlockedInventory.jacket) {
        avatarEquipped.innerText = "1950s Rockabilly Rebel 🎸🧥⚡";
    } else if (itemType === 'vest' && unlockedInventory.vest) {
        avatarEquipped.innerText = "1960s Flower Child ✌️🎽🌸";
    }
}

// Start game
initGrid();
drawGrid();
