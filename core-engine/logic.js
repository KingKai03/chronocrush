const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ROWS = 4;
const COLS = 4;
const TILE_SIZE = 100; 

const vintagePieces = ["📻", "✒️", "🎩", "🎷"];
let grid = [];
let firstSelectedTile = null; 

// GAME STATE VARIABLES
let score = 0;
let movesLeft = 20;
const TARGET_SCORE = 500;
let gameActive = true;

// Connect to our HTML display text boxes
const scoreText = document.getElementById("scoreText");
const movesText = document.getElementById("movesText");

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
    return vintagePieces[Math.floor(Math.random() * vintagePieces.length)];
}

function updateUI() {
    if (scoreText) scoreText.innerText = score;
    if (movesText) movesText.innerText = movesLeft;
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const xPos = c * TILE_SIZE;
            const yPos = r * TILE_SIZE;
            
            if (firstSelectedTile && firstSelectedTile.row === r && firstSelectedTile.col === c) {
                ctx.fillStyle = "#5c4d3c"; 
                ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            }
            
            ctx.strokeStyle = "#4a3c31"; 
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
    if (score >= TARGET_SCORE) {
        gameActive = false;
        setTimeout(() => {
            alert("✨ TIME PORTAL RECHARGED! ✨\nYou scored over 500! You unlocked the 1940s Detective Trench Coat for your Avatar!");
            initGrid(); 
            drawGrid();
        }, 300);
    } else if (movesLeft <= 0) {
        gameActive = false;
        setTimeout(() => {
            alert("❌ TIMELINE COLLAPSED! ❌\nYou ran out of moves. The Time Engine needs to reboot!");
            initGrid(); 
            drawGrid();
        }, 300);
    }
}

// Start game
initGrid();
drawGrid();
