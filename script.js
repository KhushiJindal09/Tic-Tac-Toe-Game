const AudioFX = (() => {
  let ctx = null;
  let muted = false;

  function getCtx(){
    if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function tone(freq, duration, type='sine', gainVal=0.15, delay=0){
    if(muted) return;
    try{
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = gainVal;
      osc.connect(gain);
      gain.connect(ac.destination);
      const start = ac.currentTime + delay;
      osc.start(start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.stop(start + duration + 0.02);
    }catch(e){ }
  }

  return {
    toggleMute(){ muted = !muted; return muted; },
    isMuted(){ return muted; },
    move(){ tone(420, 0.08, 'triangle', 0.12); },
    win(){
      tone(523.25, 0.15, 'sine', 0.15, 0);
      tone(659.25, 0.15, 'sine', 0.15, 0.12);
      tone(783.99, 0.25, 'sine', 0.15, 0.24);
    },
    draw(){
      tone(300, 0.2, 'sawtooth', 0.1, 0);
      tone(220, 0.3, 'sawtooth', 0.1, 0.15);
    },
    click(){ tone(700, 0.05, 'square', 0.06); }
  };
})();

function vibrate(pattern){
  if(navigator.vibrate){
    try{ navigator.vibrate(pattern); }catch(e){}
  }
}

const GameEngine = (() => {
  const WIN_PATTERNS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  function createEmptyBoard(){
    return Array(9).fill(null);
  }

  function checkWinner(board){
    for(const pattern of WIN_PATTERNS){
      const [a,b,c] = pattern;
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        return { winner: board[a], pattern };
      }
    }
    return null;
  }

  function isBoardFull(board){
    return board.every(cell => cell !== null);
  }

  function getEmptyCells(board){
    return board.reduce((acc, val, idx) => {
      if(val === null) acc.push(idx);
      return acc;
    }, []);
  }

  return { WIN_PATTERNS, createEmptyBoard, checkWinner, isBoardFull, getEmptyCells };
})();

const AI = (() => {

  function findWinningMove(board, symbol){
    const empties = GameEngine.getEmptyCells(board);
    for(const idx of empties){
      const copy = board.slice();
      copy[idx] = symbol;
      if(GameEngine.checkWinner(copy)) return idx;
    }
    return null;
  }

  function getMove(board, aiSymbol, humanSymbol){
    let move = findWinningMove(board, aiSymbol);
    if(move !== null) return move;

    move = findWinningMove(board, humanSymbol);
    if(move !== null) return move;

    if(board[4] === null) return 4;

    const corners = [0,2,6,8].filter(i => board[i] === null);
    if(corners.length){
      return corners[Math.floor(Math.random() * corners.length)];
    }

    const empties = GameEngine.getEmptyCells(board);
    return empties[Math.floor(Math.random() * empties.length)];
  }

  return { getMove };
})();

const UI = (() => {
  let board = GameEngine.createEmptyBoard();
  let currentPlayer = 'X';
  let gameMode = 'pvp';
  let aiSymbol = 'O';
  let humanSymbol = 'X';
  let gameOver = false;
  let scores = { X: 0, O: 0, draws: 0 };

  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const boardEl = document.getElementById('board');
  const winLineEl = document.getElementById('win-line');
  const statusEl = document.getElementById('status-msg');
  const turnIndicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const scoreDEl = document.getElementById('score-d');
  const scoreXCard = document.getElementById('score-x-card');
  const scoreOCard = document.getElementById('score-o-card');
  const muteBtn = document.getElementById('mute-btn');
  const difficultyBlock = document.getElementById('difficulty-block');

  function initStartScreen(){
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameMode = btn.dataset.mode;
        difficultyBlock.style.display = gameMode === 'pvc' ? 'flex' : 'none';
      });
    });

    document.querySelectorAll('[data-symbol]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-symbol]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        aiSymbol = btn.dataset.symbol;
        humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
      });
    });
    document.querySelector('[data-symbol="O"]').classList.add('active');

    document.getElementById('start-btn').addEventListener('click', () => {
      AudioFX.click();
      startGame();
    });
  }

  function startGame(){
    startScreen.style.display = 'none';
    gameScreen.classList.add('visible');
    resetBoardState();
    renderBoard();
    updateTurnIndicator();

    if(gameMode === 'pvc' && aiSymbol === 'X' && currentPlayer === aiSymbol){
      setTimeout(aiMove, 500);
    }
  }

  function buildCells(){
    boardEl.innerHTML = '<div class="win-line" id="win-line"></div>';
    for(let i=0;i<9;i++){
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.index = i;
      cell.addEventListener('click', () => handleCellClick(i));
      boardEl.appendChild(cell);
    }
  }

  function renderBoard(){
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
      cell.textContent = board[i] || '';
      cell.classList.remove('x','o','win-cell');
      if(board[i] === 'X') cell.classList.add('x');
      if(board[i] === 'O') cell.classList.add('o');
      cell.classList.toggle('disabled', board[i] !== null || gameOver);
    });
  }

  function resetBoardState(){
    board = GameEngine.createEmptyBoard();
    currentPlayer = 'X';
    gameOver = false;
    statusEl.classList.remove('show','win','draw');
    statusEl.textContent = '';
    const wl = document.getElementById('win-line');
    wl.classList.remove('show');
    wl.style.width = '0px';
    buildCells();
    renderBoard();
    updateTurnIndicator();
  }

  function updateTurnIndicator(){
    turnIndicator.classList.toggle('turn-o', currentPlayer === 'O');
    if(gameMode === 'pvc'){
      const label = currentPlayer === aiSymbol ? `Computer (${currentPlayer})'s Turn` : `Your Turn (${currentPlayer})`;
      turnText.textContent = label;
    }else{
      turnText.textContent = `Player ${currentPlayer}'s Turn`;
    }
    scoreXCard.classList.toggle('active', currentPlayer === 'X' && !gameOver);
    scoreOCard.classList.toggle('active', currentPlayer === 'O' && !gameOver);
  }

  function handleCellClick(index){
    if(gameOver || board[index] !== null) return;

    if(gameMode === 'pvc' && currentPlayer === aiSymbol) return;

    placeMove(index);
  }

  function placeMove(index){
    board[index] = currentPlayer;
    AudioFX.move();
    vibrate(15);

    const cellEl = boardEl.querySelector(`.cell[data-index="${index}"]`);
    cellEl.textContent = currentPlayer;
    cellEl.classList.add(currentPlayer.toLowerCase());
    cellEl.classList.add('pop');
    cellEl.classList.add('disabled');

    const result = GameEngine.checkWinner(board);

    if(result){
      handleWin(result);
      return;
    }

    if(GameEngine.isBoardFull(board)){
      handleDraw();
      return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateTurnIndicator();
    renderBoard();

    if(gameMode === 'pvc' && currentPlayer === aiSymbol){
      setTimeout(aiMove, 450);
    }
  }

  function aiMove(){
    if(gameOver) return;
    const idx = AI.getMove(board, aiSymbol, humanSymbol);
    if(idx !== null && idx !== undefined){
      placeMove(idx);
    }
  }

  function handleWin({winner, pattern}){
    gameOver = true;
    scores[winner]++;
    updateScoreboard();

    pattern.forEach(i => {
      boardEl.querySelector(`.cell[data-index="${i}"]`).classList.add('win-cell');
    });

    drawWinLine(pattern);

    let msg;
    if(gameMode === 'pvc'){
      msg = winner === aiSymbol ? '⚡ Computer Wins!' : '🏆 You Win!';
    }else{
      msg = `🏆 Player ${winner} Wins!`;
    }
    statusEl.textContent = msg;
    statusEl.classList.add('show','win');

    renderBoard();
    disableAllCells();
    AudioFX.win();
    vibrate([0,40,60,40,80]);
    launchConfetti();

    turnIndicator.classList.toggle('turn-o', winner === 'O');
    turnText.textContent = msg;
  }

  function handleDraw(){
    gameOver = true;
    scores.draws++;
    updateScoreboard();
    statusEl.textContent = "🤝 It's a Draw!";
    statusEl.classList.add('show','draw');
    renderBoard();
    disableAllCells();
    AudioFX.draw();
    vibrate([0,30,40,30]);
    turnText.textContent = "It's a Draw!";
  }

  function disableAllCells(){
    boardEl.querySelectorAll('.cell').forEach(c => c.classList.add('disabled'));
  }

  function drawWinLine(pattern){
    const wl = document.getElementById('win-line');
    const cells = pattern.map(i => boardEl.querySelector(`.cell[data-index="${i}"]`));
    const boardRect = boardEl.getBoundingClientRect();
    const r1 = cells[0].getBoundingClientRect();
    const r2 = cells[2].getBoundingClientRect();

    const x1 = r1.left + r1.width/2 - boardRect.left;
    const y1 = r1.top + r1.height/2 - boardRect.top;
    const x2 = r2.left + r2.width/2 - boardRect.left;
    const y2 = r2.top + r2.height/2 - boardRect.top;

    const length = Math.hypot(x2-x1, y2-y1);
    const angle = Math.atan2(y2-y1, x2-x1) * 180 / Math.PI;

    wl.style.width = `${length + 20}px`;
    wl.style.height = '6px';
    wl.style.left = `${x1 - 10}px`;
    wl.style.top = `${y1}px`;
    wl.style.transform = `rotate(${angle}deg) translateY(-50%)`;
    wl.classList.add('show');
  }

  function updateScoreboard(){
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    scoreDEl.textContent = scores.draws;
  }

  function resetScores(){
    scores = { X: 0, O: 0, draws: 0 };
    updateScoreboard();
  }

  function initControls(){
    document.getElementById('restart-btn').addEventListener('click', () => {
      AudioFX.click();
      vibrate(10);
      resetBoardState();
      if(gameMode === 'pvc' && aiSymbol === 'X'){
        setTimeout(aiMove, 500);
      }
    });

    document.getElementById('reset-score-btn').addEventListener('click', () => {
      AudioFX.click();
      vibrate(10);
      resetScores();
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
      AudioFX.click();
      vibrate(10);
      gameScreen.classList.remove('visible');
      startScreen.style.display = 'flex';
    });

    muteBtn.addEventListener('click', () => {
      const muted = AudioFX.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }

  function init(){
    initStartScreen();
    initControls();
    updateScoreboard();
  }

  return { init };
})();

(function particlesBg(){
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const colors = ['#00f0ff', '#ff2bd6', '#7b5bff'];

  function createParticles(){
    particles = [];
    const count = Math.min(60, Math.floor(window.innerWidth / 20));
    for(let i=0;i<count;i++){
      particles.push({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height,
        r: Math.random()*2 + 0.5,
        dx: (Math.random()-0.5)*0.3,
        dy: (Math.random()-0.5)*0.3,
        color: colors[Math.floor(Math.random()*colors.length)],
        alpha: Math.random()*0.5+0.1
      });
    }
  }
  createParticles();
  window.addEventListener('resize', createParticles);

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      if(p.x < 0) p.x = canvas.width;
      if(p.x > canvas.width) p.x = 0;
      if(p.y < 0) p.y = canvas.height;
      if(p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  animate();
})();

function launchConfetti(){
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#00f0ff', '#ff2bd6', '#7b5bff', '#ffe35b', '#ffffff'];
  const pieces = [];
  const count = 140;
  const originX = canvas.width/2;
  const originY = canvas.height/2;

  for(let i=0;i<count;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = Math.random()*8 + 4;
    pieces.push({
      x: originX,
      y: originY,
      dx: Math.cos(angle)*speed,
      dy: Math.sin(angle)*speed - 4,
      size: Math.random()*8+4,
      color: colors[Math.floor(Math.random()*colors.length)],
      rotation: Math.random()*360,
      rotSpeed: (Math.random()-0.5)*15,
      life: 1
    });
  }

  let frame = 0;
  function animate(){
    frame++;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;

    pieces.forEach(p => {
      if(p.life <= 0) return;
      alive = true;
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.18;
      p.rotation += p.rotSpeed;
      p.life -= 0.008;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI/180);
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      ctx.restore();
    });

    ctx.globalAlpha = 1;

    if(alive && frame < 240){
      requestAnimationFrame(animate);
    }else{
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
  }
  animate();
}

window.addEventListener('resize', () => {
  const c = document.getElementById('confetti-canvas');
  c.width = window.innerWidth;
  c.height = window.innerHeight;
});

UI.init();