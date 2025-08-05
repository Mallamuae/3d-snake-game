// 2D canvas implementation of a pseudo‑3D Snake game
//
// This version uses isometric projection to draw each cell as a rhombus on
// a 2D canvas, giving the impression of depth without requiring WebGL.
// The snake, food and power‑ups are rendered as simple prisms with
// shaded top and side faces.
// The game retains the same mechanics: eat food to grow, avoid
// colliding with walls or yourself, and collect power‑ups to speed up or
// shrink the snake.

(() => {
    // Configuration constants
    const BOARD_SIZE = 20;              // Number of cells per side
    const BASE_MOVE_INTERVAL = 250;     // ms per move at normal speed
    const SPEED_BOOST_FACTOR = 0.5;     // Speed multiplier when speed boost active
    const SPEED_BOOST_DURATION = 5000;  // ms duration of speed boost
    const SHRINK_FACTOR = 0.5;          // Fraction of length retained when shrink power‑up eaten
    const POWER_UP_INTERVAL = 10000;    // ms between power‑up spawns

    const POWER_TYPES = {
        SPEED: 'speed',
        SHRINK: 'shrink'
    };

    class SnakeGame2D {
        constructor() {
            // Canvas setup
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gameCanvas';
            this.ctx = this.canvas.getContext('2d');
            document.body.appendChild(this.canvas);
            // Isometric projection parameters (computed in resize)
            this.tileWidth = 40;
            this.tileHeight = 20;
            this.cubeHeight = 20;
            this.originX = 0;
            this.originY = 0;
            // Game state
            this.snakePositions = [];
            this.snakeColors = []; // Precomputed colours for segments
            this.currentDirection = { x: 1, z: 0 };
            this.nextDirection = { x: 1, z: 0 };
            this.moveInterval = BASE_MOVE_INTERVAL;
            this.lastMoveTime = 0;
            this.food = null;           // {x,z,type}
            this.powerUps = [];         // Array of {type, x, z}
            this.speedBoostEndTime = 0;
            this.nextPowerUpSpawnTime = 0;
            this.score = 0;
            this.gameOverFlag = false;
            this.animFrame = null;
        }

        // Initialise game on page load
        init() {
            this.resize();
            window.addEventListener('resize', () => this.resize());
            this.initSnake();
            this.spawnFood();
            this.spawnPowerUp();
            this.nextPowerUpSpawnTime = performance.now() + POWER_UP_INTERVAL;
            this.updateOverlay();
            this.bindControls();
            this.lastMoveTime = performance.now();
            this.animFrame = requestAnimationFrame(() => this.loop());
        }

        // Adjust canvas size and derive isometric parameters
        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            // Compute tile dimensions so the board fits within a margin
            const availW = this.canvas.width * 0.8;
            const availH = this.canvas.height * 0.8;
            // Candidate tile width derived from width and height
            const tileWidthFromWidth = availW / (BOARD_SIZE - 1);
            const tileWidthFromHeight = (availH / (BOARD_SIZE - 1)) * 2;
            this.tileWidth = Math.min(tileWidthFromWidth, tileWidthFromHeight);
            this.tileHeight = this.tileWidth / 2;
            // Height of cubes (snake segments) equal to tileHeight for nice proportions
            this.cubeHeight = this.tileHeight;
            // Board dimensions
            const boardPixelWidth = (BOARD_SIZE - 1) * this.tileWidth;
            const boardPixelHeight = (BOARD_SIZE - 1) * this.tileHeight + this.cubeHeight;
            // Centre the board on screen
            this.originX = this.canvas.width / 2;
            // Start Y coordinate such that the bottom of board touches centre vertically
            this.originY = (this.canvas.height - boardPixelHeight) / 2 + boardPixelHeight;
        }

        // Convert 3D grid coordinates (x,z,y) to 2D screen coordinates
        isoToScreen(x, z, y = 0) {
            // x and z are cell indices; y is height (0 for floor, 1 for snake)
            const isoX = (x - z) * this.tileWidth / 2;
            const isoY = (x + z) * this.tileHeight / 2 - y * this.cubeHeight;
            return { x: this.originX + isoX, y: this.originY - isoY };
        }

        // Initialise the snake with a default length
        initSnake() {
            this.snakePositions = [];
            // Starting location near the left side
            const startX = Math.floor(BOARD_SIZE / 4);
            const startZ = Math.floor(BOARD_SIZE / 2);
            const initialLength = 4;
            for (let i = 0; i < initialLength; i++) {
                this.snakePositions.push({ x: startX - i, z: startZ });
            }
            // Precompute gradient colours for segments: from bright green to dark green
            this.snakeColors = [];
            const maxSegments = BOARD_SIZE; // Enough colours for long snake
            for (let i = 0; i < maxSegments; i++) {
                const t = i / maxSegments;
                // Interpolate green channel from 200 to 80
                const g = Math.floor(200 - t * 120);
                const r = Math.floor(20 + t * 40);
                const b = Math.floor(20 + t * 40);
                this.snakeColors.push(`rgb(${r},${g},${b})`);
            }
        }

        // Spawn food in a random free cell
        spawnFood() {
            const cell = this.getRandomFreeCell();
            if (!cell) {
                this.endGame(true);
                return;
            }
            this.food = { x: cell.x, z: cell.z };
        }

        // Spawn a power‑up at a random free cell
        spawnPowerUp() {
            const cell = this.getRandomFreeCell();
            if (!cell) return;
            const types = Object.values(POWER_TYPES);
            const type = types[Math.floor(Math.random() * types.length)];
            this.powerUps.push({ type, x: cell.x, z: cell.z });
        }

        // Get a random cell that is not occupied by the snake, food or power‑ups
        getRandomFreeCell() {
            const occupied = new Set();
            for (const pos of this.snakePositions) {
                occupied.add(`${pos.x},${pos.z}`);
            }
            if (this.food) occupied.add(`${this.food.x},${this.food.z}`);
            for (const pu of this.powerUps) {
                occupied.add(`${pu.x},${pu.z}`);
            }
            const freeCells = [];
            for (let x = 0; x < BOARD_SIZE; x++) {
                for (let z = 0; z < BOARD_SIZE; z++) {
                    const key = `${x},${z}`;
                    if (!occupied.has(key)) {
                        freeCells.push({ x, z });
                    }
                }
            }
            if (freeCells.length === 0) return null;
            return freeCells[Math.floor(Math.random() * freeCells.length)];
        }

        // Update overlay for score and speed
        updateOverlay() {
            document.getElementById('score').textContent = this.score.toString();
            const speedMult = (BASE_MOVE_INTERVAL / this.moveInterval).toFixed(1);
            document.getElementById('speed').textContent = `${speedMult}x`;
        }

        // Bind input keys and restart button
        bindControls() {
            document.addEventListener('keydown', (e) => {
                if (this.gameOverFlag) return;
                let newDir;
                if (e.key === 'ArrowUp' || e.key === 'w') newDir = { x: 0, z: -1 };
                else if (e.key === 'ArrowDown' || e.key === 's') newDir = { x: 0, z: 1 };
                else if (e.key === 'ArrowLeft' || e.key === 'a') newDir = { x: -1, z: 0 };
                else if (e.key === 'ArrowRight' || e.key === 'd') newDir = { x: 1, z: 0 };
                if (newDir) {
                    // Prevent reversing
                    if (newDir.x + this.currentDirection.x === 0 && newDir.z + this.currentDirection.z === 0) {
                        return;
                    }
                    this.nextDirection = newDir;
                }
            });
            document.getElementById('restartBtn').addEventListener('click', () => {
                this.restart();
            });
        }

        // Main game loop executed via requestAnimationFrame
        loop() {
            const now = performance.now();
            // Move snake at intervals
            if (!this.gameOverFlag && now - this.lastMoveTime >= this.moveInterval) {
                this.moveSnake();
                this.lastMoveTime = now;
            }
            // Spawn power‑ups periodically
            if (!this.gameOverFlag && now >= this.nextPowerUpSpawnTime) {
                this.spawnPowerUp();
                this.nextPowerUpSpawnTime = now + POWER_UP_INTERVAL;
            }
            // Check for speed boost expiration
            if (this.speedBoostEndTime > 0 && now >= this.speedBoostEndTime) {
                this.moveInterval = BASE_MOVE_INTERVAL;
                this.speedBoostEndTime = 0;
                this.updateOverlay();
            }
            // Draw scene
            this.draw();
            this.animFrame = requestAnimationFrame(() => this.loop());
        }

        // Move the snake one step forward
        moveSnake() {
            // Apply queued direction
            this.currentDirection = { x: this.nextDirection.x, z: this.nextDirection.z };
            const head = this.snakePositions[0];
            const newX = head.x + this.currentDirection.x;
            const newZ = head.z + this.currentDirection.z;
            // Check wall collision
            if (newX < 0 || newX >= BOARD_SIZE || newZ < 0 || newZ >= BOARD_SIZE) {
                this.endGame(false);
                return;
            }
            // Check self collision
            for (const pos of this.snakePositions) {
                if (pos.x === newX && pos.z === newZ) {
                    this.endGame(false);
                    return;
                }
            }
            // Add new head
            this.snakePositions.unshift({ x: newX, z: newZ });
            let ate = false;
            // Check food
            if (this.food && newX === this.food.x && newZ === this.food.z) {
                ate = true;
                this.score++;
                this.spawnFood();
            }
            // Check power‑ups
            for (let i = 0; i < this.powerUps.length; i++) {
                const pu = this.powerUps[i];
                if (pu.x === newX && pu.z === newZ) {
                    this.applyPowerUp(pu.type);
                    this.powerUps.splice(i, 1);
                    ate = true;
                    break;
                }
            }
            // Remove tail if nothing eaten
            if (!ate) {
                this.snakePositions.pop();
            }
            this.updateOverlay();
        }

        // Apply power‑up effects
        applyPowerUp(type) {
            if (type === POWER_TYPES.SPEED) {
                this.moveInterval = BASE_MOVE_INTERVAL * SPEED_BOOST_FACTOR;
                this.speedBoostEndTime = performance.now() + SPEED_BOOST_DURATION;
            } else if (type === POWER_TYPES.SHRINK) {
                const target = Math.max(3, Math.ceil(this.snakePositions.length * SHRINK_FACTOR));
                while (this.snakePositions.length > target) {
                    this.snakePositions.pop();
                }
            }
        }

        // Draw entire scene on canvas
        draw() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // Draw board cells
            for (let x = 0; x < BOARD_SIZE; x++) {
                for (let z = 0; z < BOARD_SIZE; z++) {
                    this.drawTile(x, z);
                }
            }
            // Draw snake (from tail to head for correct layering)
            for (let i = this.snakePositions.length - 1; i >= 0; i--) {
                const seg = this.snakePositions[i];
                // Use gradient colours; head is index 0 (front of array)
                const colourIndex = Math.min(i, this.snakeColors.length - 1);
                const color = this.snakeColors[colourIndex];
                this.drawCube(seg.x, seg.z, color);
            }
            // Draw food
            if (this.food) {
                this.drawFood(this.food.x, this.food.z);
            }
            // Draw power‑ups
            for (const pu of this.powerUps) {
                this.drawPowerUp(pu.x, pu.z, pu.type);
            }
        }

        // Draw a single tile (floor) at cell coordinates x,z
        drawTile(x, z) {
            const ctx = this.ctx;
            // Compute corner positions of top face
            const p0 = this.isoToScreen(x, z, 0);
            const p1 = this.isoToScreen(x + 1, z, 0);
            const p2 = this.isoToScreen(x + 1, z + 1, 0);
            const p3 = this.isoToScreen(x, z + 1, 0);
            // Checkerboard pattern
            const isEven = (x + z) % 2 === 0;
            ctx.fillStyle = isEven ? '#2f2f2f' : '#383838';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.fill();
        }

        // Draw a cube (snake segment) at cell x,z with given base colour
        drawCube(x, z, baseColor) {
            const ctx = this.ctx;
            // Top face corners at height y=1
            const top0 = this.isoToScreen(x, z, 1);
            const top1 = this.isoToScreen(x + 1, z, 1);
            const top2 = this.isoToScreen(x + 1, z + 1, 1);
            const top3 = this.isoToScreen(x, z + 1, 1);
            // Base corners at y=0
            const b0 = this.isoToScreen(x, z, 0);
            const b1 = this.isoToScreen(x + 1, z, 0);
            const b2 = this.isoToScreen(x + 1, z + 1, 0);
            const b3 = this.isoToScreen(x, z + 1, 0);
            // Colours for faces: lighten/darken the base colour
            const topColor = this.adjustColor(baseColor, 1.2);
            const rightColor = this.adjustColor(baseColor, 0.9);
            const leftColor = this.adjustColor(baseColor, 0.7);
            // Right face (facing right) uses points: b1,b2,top2,top1
            ctx.fillStyle = rightColor;
            ctx.beginPath();
            ctx.moveTo(b1.x, b1.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(top2.x, top2.y);
            ctx.lineTo(top1.x, top1.y);
            ctx.closePath();
            ctx.fill();
            // Left face (facing left) uses points: b3,b0,top0,top3
            ctx.fillStyle = leftColor;
            ctx.beginPath();
            ctx.moveTo(b3.x, b3.y);
            ctx.lineTo(b0.x, b0.y);
            ctx.lineTo(top0.x, top0.y);
            ctx.lineTo(top3.x, top3.y);
            ctx.closePath();
            ctx.fill();
            // Top face uses top0,top1,top2,top3
            ctx.fillStyle = topColor;
            ctx.beginPath();
            ctx.moveTo(top0.x, top0.y);
            ctx.lineTo(top1.x, top1.y);
            ctx.lineTo(top2.x, top2.y);
            ctx.lineTo(top3.x, top3.y);
            ctx.closePath();
            ctx.fill();
        }

        // Draw food as a red gem on top of the tile
        drawFood(x, z) {
            const ctx = this.ctx;
            const p = this.isoToScreen(x + 0.5, z + 0.5, 1); // centre
            const radius = this.tileWidth * 0.15;
            ctx.fillStyle = '#ff5555';
            ctx.beginPath();
            ctx.arc(p.x, p.y - this.cubeHeight * 0.4, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw power‑ups with distinct shapes and colours
        drawPowerUp(x, z, type) {
            const ctx = this.ctx;
            const center = this.isoToScreen(x + 0.5, z + 0.5, 1);
            const size = this.tileWidth * 0.2;
            if (type === POWER_TYPES.SPEED) {
                // Speed boost: draw a blue diamond
                ctx.fillStyle = '#0088ff';
                ctx.beginPath();
                ctx.moveTo(center.x, center.y - size);
                ctx.lineTo(center.x + size, center.y);
                ctx.lineTo(center.x, center.y + size);
                ctx.lineTo(center.x - size, center.y);
                ctx.closePath();
                ctx.fill();
            } else if (type === POWER_TYPES.SHRINK) {
                // Shrink: draw a yellow triangle
                ctx.fillStyle = '#ffff66';
                ctx.beginPath();
                ctx.moveTo(center.x, center.y - size);
                ctx.lineTo(center.x + size, center.y + size);
                ctx.lineTo(center.x - size, center.y + size);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Adjust a CSS rgb() colour string by a brightness factor
        adjustColor(rgbString, factor) {
            // Parse rgb(r,g,b)
            const match = rgbString.match(/rgb\((\d+),(\d+),(\d+)\)/);
            if (!match) return rgbString;
            let [r, g, b] = match.slice(1).map(Number);
            r = Math.min(255, Math.max(0, Math.floor(r * factor)));
            g = Math.min(255, Math.max(0, Math.floor(g * factor)));
            b = Math.min(255, Math.max(0, Math.floor(b * factor)));
            return `rgb(${r},${g},${b})`;
        }

        // Show game over screen
        endGame(win) {
            this.gameOverFlag = true;
            if (this.animFrame) {
                cancelAnimationFrame(this.animFrame);
                this.animFrame = null;
            }
            const overDiv = document.getElementById('gameover');
            const overText = document.getElementById('gameoverText');
            overText.textContent = win ? `You win! Final score: ${this.score}` : `Game Over! Score: ${this.score}`;
            overDiv.style.display = 'block';
        }

        // Restart the game from scratch
        restart() {
            this.snakePositions = [];
            this.food = null;
            this.powerUps = [];
            this.currentDirection = { x: 1, z: 0 };
            this.nextDirection = { x: 1, z: 0 };
            this.moveInterval = BASE_MOVE_INTERVAL;
            this.speedBoostEndTime = 0;
            this.score = 0;
            this.gameOverFlag = false;
            document.getElementById('gameover').style.display = 'none';
            this.initSnake();
            this.spawnFood();
            this.spawnPowerUp();
            this.nextPowerUpSpawnTime = performance.now() + POWER_UP_INTERVAL;
            this.updateOverlay();
            this.lastMoveTime = performance.now();
            this.animFrame = requestAnimationFrame(() => this.loop());
        }
    }

    // Initialise the game when DOM is ready
    window.addEventListener('DOMContentLoaded', () => {
        const game = new SnakeGame2D();
        game.init();
    });
})();