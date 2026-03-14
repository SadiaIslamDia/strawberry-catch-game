
const startSoundEl   = document.getElementById('startSound');
const catchSoundEl   = document.getElementById('catchSound');
const missSoundEl    = document.getElementById('missSound');
const gameoverSoundEl = document.getElementById('gameoverSound');

function playSound(audioEl) {
  if (!audioEl) return;
  try {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {}); // silently ignore autoplay blocks
  } catch (e) {}
}

// ── DOM refs ─────────────────────────────────────────────────
const gameArea        = document.getElementById('gameArea');
const basket          = document.getElementById('basket');
const scoreEl         = document.getElementById('score');
const lifeEl          = document.getElementById('life');
const highScoreEl     = document.getElementById('highScore');
const startScreen     = document.getElementById('startScreen');
const gameWrapper     = document.getElementById('gameWrapper');
const gameOverScreen  = document.getElementById('gameOverScreen');
const finalScoreEl    = document.getElementById('finalScore');
const newHighMsg      = document.getElementById('newHighMsg');
const startBtn        = document.getElementById('startBtn');

// ── Constants ────────────────────────────────────────────────
const BASKET_W      = 64;   // must match CSS width on #basket
const BASKET_BOTTOM = 12;   // must match CSS bottom on #basket
const BERRY_SIZE    = 34;   // approximate emoji size in px
const KEY_STEP      = 20;   // px per animation frame for arrow keys

// ── Helpers: live arena size (works on any screen) ──────────
function areaW() { return gameArea.offsetWidth;  }
function areaH() { return gameArea.offsetHeight; }

// ── Game state ───────────────────────────────────────────────
let score     = 0;
let life      = 3;
let running   = false;
let basketX   = 0;           // current left-edge position of basket
let spawnTimer = null;       // setInterval ID for spawning berries
let drops      = [];         // all active setInterval IDs for falling berries
let highScore  = +(localStorage.getItem('sbHS') || 0);
highScoreEl.textContent = highScore;

// ── Basket position helper ───────────────────────────────────
function setBasket(x) {
  basketX = Math.max(0, Math.min(areaW() - BASKET_W, x));
  basket.style.left = basketX + 'px';
}


// ════════════════════════════════════════════════════════════
//  🖱️  MOUSE CONTROL
//  The basket centre follows the mouse cursor smoothly.
//
//  How it works:
//  · #basket has  pointer-events:none  in CSS, so mouse events
//    fall through the emoji directly to #gameArea beneath it.
//  · We listen on #gameArea for mousemove.
//  · We calculate cursor X relative to the arena and centre
//    the basket under it.
// ════════════════════════════════════════════════════════════
gameArea.addEventListener('mousemove', function (e) {
  if (!running) return;
  const rect = gameArea.getBoundingClientRect();
  const relX = e.clientX - rect.left;      // cursor X inside the arena
  setBasket(relX - BASKET_W / 2);          // centre basket on cursor
});


// ════════════════════════════════════════════════════════════
//  👆  TOUCH CONTROL
//  The basket centre follows the first finger in real time.
//
//  How it works:
//  · touch-action:none on #gameArea (set in CSS) tells the
//    browser NOT to scroll or zoom when touching the arena.
//  · We call e.preventDefault() on both touchstart and
//    touchmove (with passive:false) to fully block scrolling.
//  · We read the first touch point and map it to arena coords.
// ════════════════════════════════════════════════════════════
function handleTouch(e) {
  if (!running) return;
  e.preventDefault();                        // block page scroll / zoom
  const rect  = gameArea.getBoundingClientRect();
  const touch = e.touches[0];               // track first finger only
  const relX  = touch.clientX - rect.left;  // finger X inside the arena
  setBasket(relX - BASKET_W / 2);           // centre basket under finger
}
gameArea.addEventListener('touchstart', handleTouch, { passive: false });
gameArea.addEventListener('touchmove',  handleTouch, { passive: false });


// ════════════════════════════════════════════════════════════
//  ⌨️  KEYBOARD CONTROL  (Arrow Left / Arrow Right)
//  Uses requestAnimationFrame for smooth, lag-free movement.
// ════════════════════════════════════════════════════════════
const keysDown = {};   // tracks which keys are currently held

document.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();           // stop page from scrolling
    keysDown[e.key] = true;
  }
});
document.addEventListener('keyup', (e) => {
  keysDown[e.key] = false;
  // Remove visual tilt when key released
  if (!keysDown['ArrowLeft'] && !keysDown['ArrowRight']) {
    basket.classList.remove('tilt-left', 'tilt-right');
  }
});

// rAF loop — runs every frame; moves basket if a key is held
(function rafLoop() {
  if (running) {
    if (keysDown['ArrowLeft']) {
      setBasket(basketX - KEY_STEP);
      basket.classList.add('tilt-left');
      basket.classList.remove('tilt-right');
    }
    if (keysDown['ArrowRight']) {
      setBasket(basketX + KEY_STEP);
      basket.classList.add('tilt-right');
      basket.classList.remove('tilt-left');
    }
  }
  requestAnimationFrame(rafLoop);
})();


// ── Sparkle effect on catch ──────────────────────────────────
const SPARKS = ['✨', '💫', '⭐', '🌟', '💥'];
function spawnSparks(x, y) {
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle';
    el.textContent = SPARKS[i % SPARKS.length];
    el.style.left = (x - 12 + Math.random() * 40) + 'px';
    el.style.top  = (y -  8 + Math.random() * 20) + 'px';
    gameArea.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}

// ── Score pop-up on catch ────────────────────────────────────
function spawnScorePop(x, y) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = '+1';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  gameArea.appendChild(el);
  setTimeout(() => el.remove(), 750);
}


// ── Spawn one falling strawberry ─────────────────────────────
function spawnBerry() {
  if (!running) return;

  const el = document.createElement('div');
  el.className = 'strawberry';
  el.textContent = '🍓';

  // Random horizontal start position within the arena
  const startX = Math.random() * (areaW() - BERRY_SIZE);
  el.style.left = startX + 'px';
  el.style.top  = (-BERRY_SIZE) + 'px';
  gameArea.appendChild(el);

  let topPos = -BERRY_SIZE;
  // Speed gradually increases as score grows (gets harder!)
  const speed = 3.8 + Math.random() * 2.2 + score * 0.035;

  // Basket top-edge Y for collision detection
  const basketTopY = areaH() - BASKET_BOTTOM - 48; // 48 ≈ basket emoji height

  const id = setInterval(() => {
    if (!running) { clearInterval(id); el.remove(); return; }

    topPos += speed;
    el.style.top = topPos + 'px';

    const berryL   = parseFloat(el.style.left);
    const berryR   = berryL + BERRY_SIZE;
    const berryBot = topPos + BERRY_SIZE;

    const bL = basketX;
    const bR = basketX + BASKET_W;

    // ── Caught ────────────────────────────────────────────────
    if (berryBot >= basketTopY && berryBot <= areaH() + 5 &&
        berryL < bR && berryR > bL) {

      score++;
      scoreEl.textContent = score;
      spawnSparks(berryL, topPos);
      spawnScorePop(berryL + BERRY_SIZE / 2 - 10, basketTopY - 28);
      playSound(catchSoundEl);
      clearInterval(id);
      el.remove();
      return;
    }

    // ── Missed (fell off bottom) ──────────────────────────────
    if (topPos > areaH() + 5) {
      life--;
      lifeEl.textContent = life;
      playSound(missSoundEl);

      // Flash red border
      gameArea.classList.add('miss-flash');
      setTimeout(() => gameArea.classList.remove('miss-flash'), 400);

      clearInterval(id);
      el.remove();
      if (life <= 0) endGame();
    }
  }, 16); // ~60 fps

  drops.push(id);
}


// ── Start game ───────────────────────────────────────────────
function startGame() {
  startScreen.classList.add('hidden');
  gameWrapper.style.display = 'flex';

  // Reset state
  score = 0; life = 3; running = true;
  scoreEl.textContent = score;
  lifeEl.textContent  = life;

  // Centre basket on start
  setBasket((areaW() - BASKET_W) / 2);

  playSound(startSoundEl);

  // Spawn a berry every 900 ms
  spawnTimer = setInterval(spawnBerry, 900);
}


// ── End game ─────────────────────────────────────────────────
function endGame() {
  running = false;
  clearInterval(spawnTimer);
  drops.forEach(clearInterval);
  drops = [];
  // Clean up any leftover elements
  document.querySelectorAll('.strawberry, .sparkle, .score-pop').forEach(el => el.remove());

  playSound(gameoverSoundEl);

  // Save high score
  const isNew = score > highScore;
  if (isNew) {
    highScore = score;
    localStorage.setItem('sbHS', score);
    highScoreEl.textContent = score;
  }

  // Show game-over screen
  gameWrapper.style.display = 'none';
  gameOverScreen.classList.remove('hidden');
  finalScoreEl.textContent = score;
  newHighMsg.style.display = isNew ? 'block' : 'none';
}


// ── Wire up Start button ──────────────────────────────────────
startBtn.addEventListener('click', startGame);