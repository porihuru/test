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

const POWER_UP_TYPES = [
  { name: 'Rapid Fire', color: '#53ffa4' },
  { name: 'Shield', color: '#00d9ff' },
  { name: 'Triple Shot', color: '#ff9500' },
  { name: 'Speed Boost', color: '#ffeb3b' },
  { name: 'Homing Missiles', color: '#ff6b6b' }
];

const player = {
  x: 120,
  y: H / 2,
  radius: 16,
  speed: 4.2,
  cooldown: 0,
  powerTimer: 0,
  hitCooldown: 0,
  powerType: null,
  shieldHits: 0,
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
  player.powerType = null;
  player.shieldHits = 0;

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
  
  if (player.powerTimer > 0 && player.powerType !== null) {
    const powerName = POWER_UP_TYPES[player.powerType].name;
    const shieldInfo = player.powerType === 1 ? ` (${player.shieldHits} hits)` : '';
    powerEl.textContent = `Power: ${powerName}${shieldInfo}`;
  } else {
    powerEl.textContent = "Power: None";
  }
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
  const type = Math.floor(Math.random() * POWER_UP_TYPES.length);
  powerUps.push({
    x: W + 40,
    y: Math.random() * (H - 100) + 50,
    radius: 12,
    speed: 2.6,
    type: type,
  });
}

function shoot() {
  const powerType = player.powerType;
  
  // Rapid Fire: 2 bullets with offset
  if (powerType === 0) {
    const spread = [-8, 8];
    spread.forEach((offset) => {
      bullets.push({
        x: player.x + 18,
        y: player.y + offset,
        radius: 4,
        speed: 8.2,
        type: 'normal',
      });
    });
    player.cooldown = 6;
  }
  // Shield: normal shooting
  else if (powerType === 1) {
    bullets.push({
      x: player.x + 18,
      y: player.y,
      radius: 4,
      speed: 8.2,
      type: 'normal',
    });
    player.cooldown = 10;
  }
  // Triple Shot: 3 directions
  else if (powerType === 2) {
    const angles = [-0.3, 0, 0.3]; // forward, up diagonal, down diagonal
    angles.forEach((angle) => {
      bullets.push({
        x: player.x + 18,
        y: player.y,
        radius: 4,
        speed: 8.2,
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        type: 'normal',
      });
    });
    player.cooldown = 10;
  }
  // Speed Boost: normal shooting
  else if (powerType === 3) {
    bullets.push({
      x: player.x + 18,
      y: player.y,
      radius: 4,
      speed: 8.2,
      type: 'normal',
    });
    player.cooldown = 10;
  }
  // Homing Missiles
  else if (powerType === 4) {
    bullets.push({
      x: player.x + 18,
      y: player.y,
      radius: 4,
      speed: 8.2,
      type: 'homing',
    });
    player.cooldown = 10;
  }
  // No power: normal shooting
  else {
    bullets.push({
      x: player.x + 18,
      y: player.y,
      radius: 4,
      speed: 8.2,
      type: 'normal',
    });
    player.cooldown = 10;
  }
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
  
  // Reset power type when timer expires
  if (player.powerTimer <= 0) {
    player.powerType = null;
    player.shieldHits = 0;
  }

  const moveX = (keys.has("ArrowRight") || keys.has("KeyD")) - (keys.has("ArrowLeft") || keys.has("KeyA"));
  const moveY = (keys.has("ArrowDown") || keys.has("KeyS")) - (keys.has("ArrowUp") || keys.has("KeyW"));

  // Speed Boost: 1.5x movement speed
  const speedMultiplier = player.powerType === 3 ? 1.5 : 1;
  player.x = clamp(player.x + moveX * player.speed * speedMultiplier * dt, 40, W - 40);
  player.y = clamp(player.y + moveY * player.speed * speedMultiplier * dt, 40, H - 40);

  if ((keys.has("Space") || keys.has("KeyJ")) && player.cooldown <= 0) {
    shoot();
  }

  bullets.forEach((bullet) => {
    if (bullet.type === 'homing' && enemies.length > 0) {
      // Find nearest enemy
      let nearest = enemies[0];
      let minDist = Infinity;
      enemies.forEach((enemy) => {
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearest = enemy;
        }
      });
      
      // Move toward nearest enemy
      const dx = nearest.x - bullet.x;
      const dy = nearest.y - bullet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        bullet.x += (dx / dist) * bullet.speed * dt;
        bullet.y += (dy / dist) * bullet.speed * dt;
      }
    } else if (bullet.dx !== undefined && bullet.dy !== undefined) {
      // Triple shot with angles
      bullet.x += bullet.dx * bullet.speed * dt;
      bullet.y += bullet.dy * bullet.speed * dt;
    } else {
      // Normal bullet movement
      bullet.x += bullet.speed * dt;
    }
  });
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    if (bullets[i].x > W + 40 || bullets[i].x < -40 || bullets[i].y > H + 40 || bullets[i].y < -40) {
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
      // Shield absorbs hits
      if (player.powerType === 1 && player.shieldHits < 3) {
        player.shieldHits += 1;
        player.hitCooldown = 45;
        if (player.shieldHits >= 3) {
          // Shield depleted
          player.powerTimer = 0;
          player.powerType = null;
          player.shieldHits = 0;
        }
      } else {
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
  }

  for (let i = powerUps.length - 1; i >= 0; i -= 1) {
    if (hitTest(powerUps[i], player)) {
      const powerUp = powerUps[i];
      powerUps.splice(i, 1);
      player.powerTimer = 300;
      player.powerType = powerUp.type;
      player.shieldHits = 0;
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
  
  // Draw shield effect if active
  if (player.powerType === 1 && player.shieldHits < 3) {
    ctx.strokeStyle = '#00d9ff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  
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
  bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.type === 'homing' ? '#ff6b6b' : '#ffdf7e';
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
    ctx.fillStyle = POWER_UP_TYPES[item.type].color;
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

// Virtual controller support
const virtualButtons = {
  up: { codes: ["ArrowUp", "KeyW"] },
  down: { codes: ["ArrowDown", "KeyS"] },
  left: { codes: ["ArrowLeft", "KeyA"] },
  right: { codes: ["ArrowRight", "KeyD"] },
  fire: { codes: ["Space"] },
  restart: { codes: ["KeyR"] },
};

function handleButtonPress(button) {
  const key = button.dataset.key;
  if (!key || !virtualButtons[key]) return;

  button.classList.add("active");

  if (key === "restart" && (state.gameOver || state.win)) {
    resetGame();
    return;
  }

  virtualButtons[key].codes.forEach((code) => keys.add(code));
}

function handleButtonRelease(button) {
  const key = button.dataset.key;
  if (!key || !virtualButtons[key]) return;

  button.classList.remove("active");
  virtualButtons[key].codes.forEach((code) => keys.delete(code));
}

// Add event listeners to all virtual controller buttons
document.querySelectorAll(".btn-control").forEach((button) => {
  // Touch events
  button.addEventListener("touchstart", (event) => {
    event.preventDefault();
    handleButtonPress(button);
  });

  button.addEventListener("touchend", (event) => {
    event.preventDefault();
    handleButtonRelease(button);
  });

  button.addEventListener("touchcancel", (event) => {
    event.preventDefault();
    handleButtonRelease(button);
  });

  // Mouse events (for desktop testing)
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    handleButtonPress(button);
  });

  button.addEventListener("mouseup", (event) => {
    event.preventDefault();
    handleButtonRelease(button);
  });

  button.addEventListener("mouseleave", (event) => {
    handleButtonRelease(button);
  });

  // Prevent context menu on long press
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
});

initStars();
resetGame();
requestAnimationFrame(loop);
