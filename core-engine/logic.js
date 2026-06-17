// 1. Connect to the canvas box we created in the HTML
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 2. Set up our grid math rules
const ROWS = 4;
const COLS = 4;
const TILE_SIZE = 100; // Each piece takes up 100x100 pixels

// 3. Define our 1940s vintage pieces (Emojis act as placeholders for now!)
const vintagePieces = ["📻", "✒️", "🎩", "🎷"];

// 4. Create an empty container (array) to hold the board data
let grid = [];

// 5. This function builds a randomized board behind the scenes
function initGrid() {
    for (let r = 0; r < ROWS; r++) {
        grid[r] = []; // Create a blank row
        for (let c = 0; c < COLS; c++) {
            // Pick a completely random item from our 1940s list
            const randomPiece = vintagePieces[Math.floor(Math.random() * vintagePieces.length)];
            grid[r][c] = randomPiece; // Assign it to a specific box (row, column)
        }
    }
}

// 6. This function takes that behind-the-scenes data and draws it beautifully
function drawGrid() {
    // Clear any old drawing from the canvas box first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // Calculate where this specific tile belongs on the screen
            const xPos = c * TILE_SIZE;
            const yPos = r * TILE_SIZE;
            
            // Draw a vintage dark border line around each individual box
            ctx.strokeStyle = "#4a3c31"; 
            ctx.lineWidth = 2;
            ctx.strokeRect(xPos, yPos, TILE_SIZE, TILE_SIZE);
            
            // Center our vintage emoji perfectly inside its square
            ctx.font = "44px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(grid[r][c], xPos + TILE_SIZE / 2, yPos + TILE_SIZE / 2);
        }
    }
}

// 7. Fire up the game!
initGrid();
drawGrid();
