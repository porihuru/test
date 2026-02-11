const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const hpBarEl = document.getElementById("hp-bar");
const powerEl = document.getElementById("power");
const overlayEl = document.getElementById("overlay");
const overlayTextEl = document.getElementById("overlay-text");

const W = canvas.width;
const H = canvas.height;

const keys = new Set();
const stars = [];
const bullets = [];
const enemies = [];
const powerUps = [];

const state = {
  score: 0,
  lives: 3,
  hp: 100,
  bossSpawned: false,
  gameOver: false,
  win: false,
};

const player = {
  x: 120,
  y: H / 2,
  radius: 16,
  speed: 4.2,
  cooldown: 0,
  powerTimer: 0,
  hitCooldown: 0,
};

let spawnTimer = 0;
let powerTimer = 300;
let lastTime = 0;

function initStars() {
  for (let i = 0; i < 120; i += 1) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 1.8 + 0.6,
    });
  }
}

function resetGame() {
  state.score = 0;
  state.lives = 3;
  state.hp = 100;
  state.bossSpawned = false;
  state.gameOver = false;
  state.win = false;

  player.x = 120;
  player.y = H / 2;
  player.cooldown = 0;
  player.powerTimer = 0;
  player.hitCooldown = 0;

  bullets.length = 0;
  enemies.length = 0;
  powerUps.length = 0;

  spawnTimer = 0;
  powerTimer = 300;

  overlayEl.hidden = true;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  hpBarEl.style.width = `${Math.max(0, state.hp)}%`;
  powerEl.textContent = player.powerTimer > 0 ? "Power: Rapid" : "Power: None";
}

function showOverlay(message) {
  overlayTextEl.textContent = message;
  overlayEl.hidden = false;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function spawnEnemy(isBoss) {
  if (isBoss) {
    enemies.push({
      x: W + 120,
      y: H / 2,
      radius: 42,
      speed: 1.2,
      hp: 220,
      type: "boss",
      wobble: 0,
    });
    return;
  }

  const radius = Math.random() * 10 + 16;
  enemies.push({
    x: W + radius + 20,
    y: Math.random() * (H - 80) + 40,
    radius,
    speed: Math.random() * 2 + 2,
    hp: 1,
    type: "grunt",
    wobble: Math.random() * Math.PI * 2,
  });
}

function spawnPowerUp() {
  powerUps.push({
    x: W + 40,
    y: Math.random() * (H - 100) + 50,
    radius: 12,
    speed: 2.6,
  });
}

function shoot() {
  const hasPower = player.powerTimer > 0;
  const spread = hasPower ? [-8, 8] : [0];
  spread.forEach((offset) => {
    bullets.push({
      x: player.x + 18,
      y: player.y + offset,
      radius: 4,
      speed: 8.2,
    });
  });
  player.cooldown = hasPower ? 6 : 10;
}

function hitTest(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy <= r * r;
}

function update(dt) {
  if (state.gameOver || state.win) {
    return;
  }

  player.cooldown = Math.max(0, player.cooldown - dt);
  player.powerTimer = Math.max(0, player.powerTimer - dt);
  player.hitCooldown = Math.max(0, player.hitCooldown - dt);

  const moveX = (keys.has("ArrowRight") || keys.has("KeyD")) - (keys.has("ArrowLeft") || keys.has("KeyA"));
  const moveY = (keys.has("ArrowDown") || keys.has("KeyS")) - (keys.has("ArrowUp") || keys.has("KeyW"));

  player.x = clamp(player.x + moveX * player.speed * dt, 40, W - 40);
  player.y = clamp(player.y + moveY * player.speed * dt, 40, H - 40);

  if ((keys.has("Space") || keys.has("KeyJ")) && player.cooldown <= 0) {
    shoot();
  }

  bullets.forEach((bullet) => {
    bullet.x += bullet.speed * dt;
  });
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (bullets[i].x > W + 40) {
      bullets.splice(i, 1);
    }
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (!state.bossSpawned && state.score >= 500) {
      state.bossSpawned = true;
      spawnEnemy(true);
    } else if (!state.bossSpawned) {
      spawnEnemy(false);
    }
    spawnTimer = Math.random() * 30 + 28;
  }

  powerTimer -= dt;
  if (powerTimer <= 0) {
    spawnPowerUp();
    powerTimer = Math.random() * 240 + 240;
  }

  enemies.forEach((enemy) => {
    enemy.x -= enemy.speed * dt;
    if (enemy.type === "boss") {
      enemy.wobble += 0.02 * dt;
      enemy.y = H / 2 + Math.sin(enemy.wobble) * 120;
    } else {
      enemy.wobble += 0.03 * dt;
      enemy.y += Math.sin(enemy.wobble) * 0.5 * dt;
    }
  });

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].x < -120) {
      enemies.splice(i, 1);
    }
  }

  powerUps.forEach((item) => {
    item.x -= item.speed * dt;
  });
  for (let i = powerUps.length - 1; i >= 0; i -= 1) {
    if (powerUps[i].x < -40) {
      powerUps.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    for (let j = bullets.length - 1; j >= 0; j -= 1) {
      if (hitTest(enemies[i], bullets[j])) {
        bullets.splice(j, 1);
        enemies[i].hp -= 1;
        if (enemies[i].hp <= 0) {
          const isBoss = enemies[i].type === "boss";
          enemies.splice(i, 1);
          state.score += isBoss ? 300 : 20;
          if (isBoss) {
            state.win = true;
            showOverlay("You Win! Press R to restart");
          }
        }
        break;
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (hitTest(enemies[i], player) && player.hitCooldown <= 0) {
      player.hitCooldown = 45;
      state.hp -= enemies[i].type === "boss" ? 40 : 20;
      if (state.hp <= 0) {
        state.lives -= 1;
        state.hp = 100;
        if (state.lives <= 0) {
          state.gameOver = true;
          showOverlay("Game Over - Press R to restart");
        }
      }
    }
  }

  for (let i = powerUps.length - 1; i >= 0; i -= 1) {
    if (hitTest(powerUps[i], player)) {
      powerUps.splice(i, 1);
      player.powerTimer = 300;
      state.score += 40;
    }
  }

  updateHud();
}

function drawBackground() {
  ctx.fillStyle = "#0a0f1f";
  ctx.fillRect(0, 0, W, H);

  stars.forEach((star) => {
    star.x -= star.speed;
    if (star.x < 0) {
      star.x = W + Math.random() * 40;
      star.y = Math.random() * H;
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#78f0ff";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-14, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-14, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f7c948";
  ctx.beginPath();
  ctx.arc(-10, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = "#ffdf7e";
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.type === "boss" ? "#ff6b6b" : "#5f8bff";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x - enemy.radius / 3, enemy.y - enemy.radius / 4, enemy.radius / 2.4, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawPowerUps() {
  powerUps.forEach((item) => {
    ctx.fillStyle = "#53ffa4";
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function render() {
  drawBackground();
  drawPowerUps();
  drawPlayer();
  drawBullets();
  drawEnemies();
}

function loop(timestamp) {
  const scaled = (timestamp - lastTime) / 16.67;
  lastTime = timestamp;
  const dt = Math.min(2, scaled || 1);

  update(dt);
  render();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
  }
  keys.add(event.code);

  if ((state.gameOver || state.win) && event.code === "KeyR") {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

initStars();
resetGame();
requestAnimationFrame(loop);
