const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ROWS = 4;
const COLS = 4;
const TILE_SIZE = 100; 

const vintagePieces = ["📻", "✒️", "🎩", "🎷"];
let grid = [];
let firstSelectedTile = null; 

function initGrid() {
    for (let r = 0; r < ROWS; r++) {
        grid[r] = []; 
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = getRandomPiece(); 
        }
    }
    // Check if the board accidentally spawned with matches, clean them up
    while (checkMatches().length > 0) {
        clearAndRefill();
    }
}

function getRandomPiece() {
    return vintagePieces[Math.floor(Math.random() * vintagePieces.length)];
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
            
            // If empty string (matched), don't draw text
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
            // 1. Swap the items in our math grid
            let temp = grid[firstSelectedTile.row][firstSelectedTile.col];
            grid[firstSelectedTile.row][firstSelectedTile.col] = grid[row][col];
            grid[row][col] = temp;
            
            // 2. Scan to see if this swap made a match
            let matchesFound = checkMatches();
            
            if (matchesFound.length > 0) {
                // Yes! Process the score and drop new pieces down
                clearAndRefill();
            } else {
                // No match? Swap them back instantly (unsuccessful move)
                grid[row][col] = grid[firstSelectedTile.row][firstSelectedTile.col];
                grid[firstSelectedTile.row][firstSelectedTile.col] = temp;
            }
        }
        
        firstSelectedTile = null;
        drawGrid();
    }
}

// Scans the board looking for horizontal or vertical streaks of 3
function checkMatches() {
    let matchPositions = [];

    // Horizontal Scanning
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 2; c++) {
            let p1 = grid[r][c];
            let p2 = grid[r][c+1];
            let p3 = grid[r][c+2];
            if (p1 !== "" && p1 === p2 && p1 === p3) {
                matchPositions.push({r: r, c: c}, {r: r, c: c+1}, {r: r, c: c+2});
            }
        }
    }

    // Vertical Scanning
    for (let r = 0; r < ROWS - 2; r++) {
        for (let c = 0; c < COLS; c++) {
            let p1 = grid[r][c];
            let p2 = grid[r+1][c];
            let p3 = grid[r+2][c];
            if (p1 !== "" && p1 === p2 && p1 === p3) {
                matchPositions.push({r: r, c: c}, {r: r+1, c: c}, {r: r+2, c: c});
            }
        }
    }

    return matchPositions;
}

// Clears matching items, slides pieces down, refills top rows
function clearAndRefill() {
    let matches = checkMatches();
    
    // Clear items by turning them into empty strings
    for (let m of matches) {
        grid[m.r][m.c] = "";
    }

    // Shift pieces down into empty spaces
    for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c] === "") {
                // Look above for a real piece to drop down
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

    // Fill top row remaining gaps with new random items
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === "") {
                grid[r][c] = getRandomPiece();
            }
        }
    }

    // Repeat check recursively if falling pieces generated a new cascade match!
    if (checkMatches().length > 0) {
        clearAndRefill();
    }
}

// Fire up the board
initGrid();
drawGrid();
