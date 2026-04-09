const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");

const W = canvas.width;
const H = canvas.height;

// --- Game state ---

let player, invaders, bullets, enemyBullets, particles, stars;
let score, lives, level, gameOver, paused, animFrame;
let invaderDir, invaderSpeed, dropDistance, shootTimer;
let keys = {};

// --- Stars background ---

function createStars() {
  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
      brightness: Math.random(),
    });
  }
}

function updateStars() {
  for (const s of stars) {
    s.y += s.speed;
    if (s.y > H) {
      s.y = 0;
      s.x = Math.random() * W;
    }
    s.brightness += (Math.random() - 0.5) * 0.1;
    s.brightness = Math.max(0.2, Math.min(1, s.brightness));
  }
}

function drawStars() {
  for (const s of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
}

// --- Player ---

function createPlayer() {
  return { x: W / 2, y: H - 40, w: 36, h: 24, speed: 5, cooldown: 0 };
}

function drawPlayer() {
  const p = player;
  ctx.fillStyle = "#0f0";
  // Ship body
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - p.h / 2);
  ctx.lineTo(p.x - p.w / 2, p.y + p.h / 2);
  ctx.lineTo(p.x + p.w / 2, p.y + p.h / 2);
  ctx.closePath();
  ctx.fill();
  // Cannon
  ctx.fillRect(p.x - 2, p.y - p.h / 2 - 6, 4, 8);
  // Engine glow
  ctx.fillStyle = `rgba(0, 255, 100, ${0.3 + Math.random() * 0.3})`;
  ctx.fillRect(p.x - 6, p.y + p.h / 2, 12, 4 + Math.random() * 4);
}

function updatePlayer() {
  if (keys["ArrowLeft"] || keys["KeyA"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["KeyD"]) player.x += player.speed;
  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
  if (player.cooldown > 0) player.cooldown--;
  if (keys["Space"] && player.cooldown === 0) {
    bullets.push({ x: player.x, y: player.y - player.h / 2 - 6, w: 3, h: 10 });
    player.cooldown = 15;
  }
}

// --- Invaders ---

function createInvaders() {
  const rows = Math.min(5, 3 + Math.floor((level - 1) / 2));
  const cols = Math.min(11, 8 + Math.floor((level - 1) / 3));
  const grid = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid.push({
        x: 60 + c * 48,
        y: 50 + r * 38,
        w: 28,
        h: 20,
        alive: true,
        type: r === 0 ? 2 : r < 3 ? 1 : 0,
        frame: 0,
      });
    }
  }
  return grid;
}

const INVADER_COLORS = ["#ff4444", "#ff8800", "#ffff00"];
const INVADER_POINTS = [10, 20, 40];

function drawInvader(inv) {
  if (!inv.alive) return;
  const color = INVADER_COLORS[inv.type];
  ctx.fillStyle = color;
  const cx = inv.x;
  const cy = inv.y;
  const hw = inv.w / 2;
  const hh = inv.h / 2;

  if (inv.type === 0) {
    // Grunt: blocky
    ctx.fillRect(cx - hw, cy - hh, inv.w, inv.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - hw + 4, cy - hh + 4, 6, 6);
    ctx.fillRect(cx + hw - 10, cy - hh + 4, 6, 6);
    // Legs
    ctx.fillStyle = color;
    const legOff = inv.frame % 2 === 0 ? 3 : -3;
    ctx.fillRect(cx - hw + 2, cy + hh, 6, 4 + legOff);
    ctx.fillRect(cx + hw - 8, cy + hh, 6, 4 - legOff);
  } else if (inv.type === 1) {
    // Mid-tier: rounder
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - 8, cy - 3, 5, 5);
    ctx.fillRect(cx + 3, cy - 3, 5, 5);
    // Antennae
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const wave = inv.frame % 2 === 0 ? -4 : 4;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - hh);
    ctx.lineTo(cx - 10 + wave, cy - hh - 8);
    ctx.moveTo(cx + 6, cy - hh);
    ctx.lineTo(cx + 10 - wave, cy - hh - 8);
    ctx.stroke();
  } else {
    // Elite: diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh - 4);
    ctx.lineTo(cx + hw + 4, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw - 4, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 2, 3, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateInvaders() {
  let alive = invaders.filter((i) => i.alive);
  if (alive.length === 0) {
    nextLevel();
    return;
  }

  let leftMost = W, rightMost = 0;
  for (const inv of alive) {
    leftMost = Math.min(leftMost, inv.x - inv.w / 2);
    rightMost = Math.max(rightMost, inv.x + inv.w / 2);
  }

  let shouldDrop = false;
  if (invaderDir === 1 && rightMost + invaderSpeed >= W - 10) shouldDrop = true;
  if (invaderDir === -1 && leftMost - invaderSpeed <= 10) shouldDrop = true;

  if (shouldDrop) {
    invaderDir *= -1;
    for (const inv of alive) inv.y += dropDistance;
  } else {
    for (const inv of alive) inv.x += invaderSpeed * invaderDir;
  }

  // Animate frames
  for (const inv of alive) {
    inv.frame = Math.floor(Date.now() / 500) % 2;
  }

  // Enemy shooting
  shootTimer--;
  if (shootTimer <= 0) {
    const shootDelay = Math.max(20, 60 - level * 5);
    shootTimer = shootDelay + Math.floor(Math.random() * shootDelay);
    // Pick a random bottom-row invader per column
    const columns = {};
    for (const inv of alive) {
      const col = Math.round(inv.x / 48);
      if (!columns[col] || inv.y > columns[col].y) columns[col] = inv;
    }
    const bottomRow = Object.values(columns);
    if (bottomRow.length > 0) {
      const shooter = bottomRow[Math.floor(Math.random() * bottomRow.length)];
      enemyBullets.push({ x: shooter.x, y: shooter.y + shooter.h / 2, w: 3, h: 10 });
    }
  }

  // Check if invaders reached the player
  for (const inv of alive) {
    if (inv.y + inv.h / 2 >= player.y - player.h / 2) {
      endGame();
      return;
    }
  }
}

// --- Bullets ---

function updateBullets() {
  // Player bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 7;
    if (bullets[i].y < -10) {
      bullets.splice(i, 1);
      continue;
    }
    // Check invader hits
    for (const inv of invaders) {
      if (!inv.alive) continue;
      if (rectsOverlap(bullets[i], inv)) {
        inv.alive = false;
        spawnExplosion(inv.x, inv.y, INVADER_COLORS[inv.type]);
        score += INVADER_POINTS[inv.type];
        scoreEl.textContent = `SCORE: ${score}`;
        // Speed up remaining invaders
        const aliveCount = invaders.filter((x) => x.alive).length;
        invaderSpeed = (1.2 + level * 0.3) * (1 + (invaders.length - aliveCount) / invaders.length);
        bullets.splice(i, 1);
        break;
      }
    }
  }

  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    enemyBullets[i].y += 4 + level * 0.5;
    if (enemyBullets[i].y > H + 10) {
      enemyBullets.splice(i, 1);
      continue;
    }
    // Check player hit
    if (rectHitsPlayer(enemyBullets[i])) {
      spawnExplosion(player.x, player.y, "#0f0");
      enemyBullets.splice(i, 1);
      loseLife();
    }
  }
}

function drawBullets() {
  ctx.fillStyle = "#0ff";
  ctx.shadowColor = "#0ff";
  ctx.shadowBlur = 6;
  for (const b of bullets) ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#f44";
  ctx.shadowColor = "#f44";
  ctx.shadowBlur = 6;
  for (const b of enemyBullets) ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);
  ctx.shadowBlur = 0;
}

// --- Collision helpers ---

function rectsOverlap(bullet, inv) {
  return (
    bullet.x + bullet.w / 2 > inv.x - inv.w / 2 &&
    bullet.x - bullet.w / 2 < inv.x + inv.w / 2 &&
    bullet.y < inv.y + inv.h / 2 &&
    bullet.y + bullet.h > inv.y - inv.h / 2
  );
}

function rectHitsPlayer(bullet) {
  return (
    bullet.x + bullet.w / 2 > player.x - player.w / 2 &&
    bullet.x - bullet.w / 2 < player.x + player.w / 2 &&
    bullet.y + bullet.h > player.y - player.h / 2 &&
    bullet.y < player.y + player.h / 2
  );
}

// --- Particles ---

function spawnExplosion(x, y, color) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: Math.random() * 3 + 1,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// --- Game flow ---

function loseLife() {
  lives--;
  livesEl.textContent = `LIVES: ${lives}`;
  if (lives <= 0) {
    endGame();
  } else {
    player.x = W / 2;
  }
}

function nextLevel() {
  level++;
  levelEl.textContent = `LEVEL: ${level}`;
  invaders = createInvaders();
  invaderDir = 1;
  invaderSpeed = 1.2 + level * 0.3;
  dropDistance = 12;
  bullets = [];
  enemyBullets = [];
  shootTimer = 60;
}

function endGame() {
  gameOver = true;
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "GAME OVER";
  overlay.querySelector("p").textContent = `Final score: ${score}`;
  startBtn.textContent = "PLAY AGAIN";
}

function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  gameOver = false;
  player = createPlayer();
  invaders = createInvaders();
  bullets = [];
  enemyBullets = [];
  particles = [];
  invaderDir = 1;
  invaderSpeed = 1.5;
  dropDistance = 12;
  shootTimer = 60;

  scoreEl.textContent = "SCORE: 0";
  livesEl.textContent = "LIVES: 3";
  levelEl.textContent = "LEVEL: 1";

  overlay.classList.add("hidden");
  if (animFrame) cancelAnimationFrame(animFrame);
  loop();
}

// --- Main loop ---

function loop() {
  if (gameOver) return;
  ctx.clearRect(0, 0, W, H);

  updateStars();
  drawStars();
  updatePlayer();
  updateInvaders();
  if (gameOver) return;
  updateBullets();
  updateParticles();

  drawPlayer();
  for (const inv of invaders) drawInvader(inv);
  drawBullets();
  drawParticles();

  animFrame = requestAnimationFrame(loop);
}

// --- Input ---

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// --- Start ---

createStars();
startBtn.addEventListener("click", initGame);
