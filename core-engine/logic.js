// 1. Connect to the canvas box
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 2. Grid math and rules
const ROWS = 4;
const COLS = 4;
const TILE_SIZE = 100; 

const vintagePieces = ["📻", "✒️", "🎩", "🎷"];
let grid = [];

// Track player clicks
let firstSelectedTile = null; 

function initGrid() {
    for (let r = 0; r < ROWS; r++) {
        grid[r] = []; 
        for (let c = 0; c < COLS; c++) {
            const randomPiece = vintagePieces[Math.floor(Math.random() * vintagePieces.length)];
            grid[r][c] = randomPiece; 
        }
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const xPos = c * TILE_SIZE;
            const yPos = r * TILE_SIZE;
            
            // If this tile is the one the player clicked first, give it a glowing background!
            if (firstSelectedTile && firstSelectedTile.row === r && firstSelectedTile.col === c) {
                ctx.fillStyle = "#5c4d3c"; // Highlight color
                ctx.fillRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            }
            
            ctx.strokeStyle = "#4a3c31"; 
            ctx.lineWidth = 2;
            ctx.strokeRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            
            ctx.font = "44px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(grid[r][c], xPos + TILE_SIZE / 2, yPos + TILE_SIZE / 2);
        }
    }
}

// 3. NEW: Listen for the player clicking on the canvas
canvas.addEventListener("mousedown", function(event) {
    // Get the exact pixel coordinates of the click inside the canvas bounds
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Convert pixels into grid Columns and Rows
    const clickedCol = Math.floor(clickX / TILE_SIZE);
    const clickedRow = Math.floor(clickY / TILE_SIZE);
    
    handleTileSelection(clickedRow, clickedCol);
});

// 4. NEW: Decide whether to highlight a tile or swap it
function handleTileSelection(row, col) {
    if (firstSelectedTile === null) {
        // First click: select the piece
        firstSelectedTile = { row: row, col: col };
    } else {
        // Second click: check if the new tile is a direct neighbor (up, down, left, right)
        const dRow = Math.abs(row - firstSelectedTile.row);
        const dCol = Math.abs(col - firstSelectedTile.col);
        const isNeighbor = (dRow + dCol === 1);
        
        if (isNeighbor) {
            // Swap them in the math array!
            let temp = grid[firstSelectedTile.row][firstSelectedTile.col];
            grid[firstSelectedTile.row][firstSelectedTile.col] = grid[row][col];
            grid[row][col] = temp;
        }
        
        // Reset selection whether they swapped or missed
        firstSelectedTile = null;
    }
    
    // Redraw the screen to update the visuals instantly
    drawGrid();
}

// Fire up the game!
initGrid();
drawGrid();
