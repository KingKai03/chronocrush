const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ROWS = 4;
const COLS = 4;
const TILE_SIZE = 100; 

let grid = [];
let firstSelectedTile = null; 

// ENGINE GAME SYSTEMS STATE VARIABLES
let score = 0;
let movesLeft = 20;
let gameActive = true;
let currentEra = "1940s"; 

// UNLOCKED CLOSET INVENTORY REGISTRY DATABASE
let unlockedInventory = {
    coat: false,
    jacket: false,
    vest: false,
    jumpsuit: false
};

// ERA CONFIGURATIONS DEFINITION MATRIX WITH LEVEL 4 DISCO ADDED
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
        pieces: ["☮️", "🌸", "🚌", "🎨"], 
        target: 1000, 
        boardBg: "#341f38", 
        borderColor: "#603b6b",
        title: "Current Era: 1960s Peace & Love ☮️🌸"
    },
    "1970s": {
        pieces: ["🪩", "✨", "🛼", "🕺"], 
        target: 1250, 
        boardBg: "#3d1822", 
        borderColor: "#7a2b3f",
        title: "Current Era: 1970s Disco Funk 🪩✨"
    }
};

// Link directly to core HTML layout elements
const scoreText = document.getElementById("scoreText");
const movesText = document.getElementById("movesText");
const targetText = document.getElementById("targetText");
const currentEraText = document.getElementById("currentEraText");

// Avatar Specific Layer Links
const layerHair = document.getElementById("layerHair");
const layerFace = document.getElementById("layerFace");
const layerOutfit = document.getElementById("layerOutfit");
const avatarMoodBubble = document.getElementById("avatarMoodBubble");
const avatarContainer = document.getElementById("avatarContainer");

// Lock/Unlock Control Buttons Links
const coatBtn = document.getElementById("coatBtn");
const jacketBtn = document.getElementById("jacketBtn");
const vestBtn = document.getElementById("vestBtn");
const jumpsuitBtn = document.getElementById("jumpsuitBtn");

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
    while (checkMatches().length > 0) {
        clearAndRefill(false); 
    }
}

function getRandomPiece() {
    const currentPieces = eraConfigs[currentEra].pieces;
    return currentPieces[Math.floor(Math.random() * currentPieces.length)];
}

// BLACK HOLE COSMIC TIME TELEPORTATION ENGINE ENGINE
function triggerTimeTravelWarp(nextEraName) {
    // Step 1: Engage universe space background overlay and open black hole event horizon
    document.body.classList.add("portal-active");
    canvas.className = "grid-implode"; // Suck canvas into black hole
    avatarContainer.className = "grid-implode"; // Suck companion in too!

    // Step 2: At full implosion, shift engine variables, load next stage items quietly
    setTimeout(() => {
        currentEra = nextEraName;
        initGrid();
        drawGrid();
        setAvatarMood("happy");
        
        // Reverse warp direction to "spit out" next world layout elements
        canvas.className = "grid-explode";
        avatarContainer.className = "grid-explode";
    }, 500);

    // Step 3: Dissolve universe environment view overlay clean
    setTimeout(() => {
        document.body.classList.remove("portal-active");
        canvas.className = "";
        avatarContainer.className = "";
    }, 1000);
}

// COMPANION EMOTION DRIVER CONTROLLER
function setAvatarMood(mood) {
    if (!avatarMoodBubble || !layerFace || !avatarContainer) return;

    if (mood === "encouraging") {
        avatarMoodBubble.innerText = "You got this!";
        avatarMoodBubble.style.backgroundColor = "#d4af37";
        layerFace.innerText = "😊";
        avatarContainer.style.transform = "scale(1) rotate(0deg)";
    } else if (mood === "happy") {
        avatarMoodBubble.innerText = "Boogie On! 🪩";
        avatarMoodBubble.style.backgroundColor = "#2ce642";
        layerFace.innerText = "🤩";
        avatarContainer.style.transform = "scale(1.15) translateY(-12px) rotate(8deg)";
    } else if (mood === "sad") {
        avatarMoodBubble.innerText = "Bummer... 💥";
        avatarMoodBubble.style.backgroundColor = "#e62c2c";
        layerFace.innerText = "😭";
        avatarContainer.style.transform = "scale(0.9) translateY(8px) rotate(-12deg)";
    }
}

function updateUI() {
    if (scoreText) scoreText.innerText = score;
    if (movesLeft <= 5) {
        movesText.style.color = "#e62c2c";
    } else {
        movesText.style.color = "#fff";
    }
    if (movesText) movesText.innerText = movesLeft;
    if (targetText) targetText.innerText = eraConfigs[currentEra].target;
    if (currentEraText) currentEraText.innerText = eraConfigs[currentEra].title;
    
    canvas.style.backgroundColor = eraConfigs[currentEra].boardBg;
    canvas.style.borderColor = eraConfigs[currentEra].borderColor;

    // Evaluate inventory flags
    if (unlockedInventory.coat && coatBtn) {
        coatBtn.disabled = false;
        coatBtn.style.backgroundColor = "#5c4731";
        coatBtn.style.color = "#fff";
        coatBtn.style.border = "1px solid #d4af37";
        coatBtn.style.cursor = "pointer";
    }
    if (unlockedInventory.jacket && jacketBtn) {
        jacketBtn.disabled = false;
        jacketBtn.style.backgroundColor = "#24405e";
        jacketBtn.style.color = "#fff";
        jacketBtn.style.border = "1px solid #5cb3ff";
        jacketBtn.style.cursor = "pointer";
    }
    if (unlockedInventory.vest && vestBtn) {
        vestBtn.disabled = false;
        vestBtn.style.backgroundColor = "#56245e";
        vestBtn.style.color = "#fff";
        vestBtn.style.border = "1px solid #df5cff";
        vestBtn.style.cursor = "pointer";
    }
    if (unlockedInventory.jumpsuit && jumpsuitBtn) {
        jumpsuitBtn.disabled = false;
        jumpsuitBtn.style.backgroundColor = "#701b34";
        jumpsuitBtn.style.color = "#fff";
        jumpsuitBtn.style.border = "1px solid #ff5c8a";
        jumpsuitBtn.style.cursor = "pointer";
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
                else if (currentEra === "1960s") ctx.fillStyle = "#543b61";
                else ctx.fillStyle = "#69293a";
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
        
        // Match hop jump
        if (avatarContainer) {
            avatarContainer.style.transform = "translateY(-12px)";
            setTimeout(() => { avatarContainer.style.transform = "translateY(0px)"; }, 120);
        }
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
        setAvatarMood("happy"); 
        
        setTimeout(() => {
            if (currentEra === "1940s") {
                alert("✨ TIMELINE RESTORED! ✨\nYou unlocked the '40s Detective Trench Coat!");
                unlockedInventory.coat = true; 
                triggerTimeTravelWarp("1950s"); 
            } else if (currentEra === "1950s") {
                alert("🎸 NEON TIMELINE CHARGED! ✨\nYou unlocked the '50s Greaser Leather Jacket!");
                unlockedInventory.jacket = true; 
                triggerTimeTravelWarp("1960s"); 
            } else if (currentEra === "1960s") {
                alert("🌸 GROOVY HARMONY ACHIEVED! ✌️\nYou unlocked the '60s Hippie Fringe Vest!");
                unlockedInventory.vest = true;
                triggerTimeTravelWarp("1970s"); 
            } else if (currentEra === "1970s") {
                alert("🪩 OUT-SIGHT DISCO FEVER DANCE UNLOCKED! ✨\nYou conquered Level 4! The '70s Shimmer Jumpsuit is yours!");
                unlockedInventory.jumpsuit = true;
                triggerTimeTravelWarp("1940s"); 
            }
        }, 500);
    } else if (movesLeft <= 0) {
        gameActive = false;
        setAvatarMood("sad"); 
        
        setTimeout(() => {
            alert("❌ TIMELINE COLLAPSED! ❌\nYou ran out of moves. Rebuilding this level!");
            initGrid(); 
            drawGrid();
        }, 500);
    }
}

window.changeHair = function(hairEmoji) {
    if (layerHair) layerHair.innerText = hairEmoji;
};

window.changeOutfit = function(outfitEmoji) {
    if (layerOutfit) layerOutfit.innerText = outfitEmoji;
};

initGrid();
drawGrid();
