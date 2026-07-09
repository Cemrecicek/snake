var SUPABASE_URL = "https://isdvdveuexfmvczaimqv.supabase.co";
var SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZHZkdmV1ZXhmbXZjemFpbXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODk3ODUsImV4cCI6MjA5ODg2NTc4NX0.jMIoFy2aoXlN4YIDFxHZhS-id5NHntDOQ8VDaPXFeBw";

var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

//board
var blockSize = 25;
var rows = 21;
var cols = 21;
var board;
var context;

//yılanın başlangıcı

var snakeX = blockSize * 10;
var snakeY = blockSize * 10;

var velocityX = 0;
var velocityY = 0;

var snakeBody = [];

let singleGameInterval = null;
let normalGameSpeed = 10;
let currentGameSpeed = normalGameSpeed;

var count = 0;
var highScore = 0;

var snakeColor = localStorage.getItem("snakeColor") || "green";
var boardTheme = localStorage.getItem("boardTheme") || "dark";

var colorMap = {
  green: "#7CFC00",
  blue: "#00BFFF",
  purple: "#A855F7",
  orange: "#FF9800",
  pink: "#FF4FD8",
};

var themeMap = {
  dark: {
    background: "black",
    food: "red",
  },
  light: {
    background: "#D8DEE9",
    food: "#ff002b",
  },
};

//elma

var elmaX;
var elmaY;

//oyun bitim kontrol fonksiyonu
var gameOver = false;
var isPaused = false;

//elmanın koordinatları için fonksiyon
// elmanın yılanın üstüne çıkmaması için fonksiyon
function placeFood() {
  var newElmaX;
  var newElmaY;
  var isOnSnake;
  var attempts = 0;
  var maxAttempts = rows * cols;

  do {
    newElmaX = Math.floor(Math.random() * cols) * blockSize;
    newElmaY = Math.floor(Math.random() * rows) * blockSize;

    isOnSnake = false;

    if (newElmaX === snakeX && newElmaY === snakeY) {
      isOnSnake = true;
    }

    snakeBody.forEach(function (part) {
      if (newElmaX === part[0] && newElmaY === part[1]) {
        isOnSnake = true;
      }
    });

    attempts += 1;
  } while (isOnSnake && attempts < maxAttempts);

  elmaX = newElmaX;
  elmaY = newElmaY;
}

function restartSingleGameLoop(speed) {
  currentGameSpeed = speed;

  if (singleGameInterval) {
    clearInterval(singleGameInterval);
  }

  singleGameInterval = setInterval(update, 1000 / currentGameSpeed);
}

function slowDownSingleSnake() {
  restartSingleGameLoop(4); // popup varken yavaş hız
}

function restoreSingleSnakeSpeed() {
  restartSingleGameLoop(normalGameSpeed); // normal hız
}

window.slowDownSingleSnake = slowDownSingleSnake;
window.restoreSingleSnakeSpeed = restoreSingleSnakeSpeed;

//Highscore
function updateScoreBoard() {
  var skorElement = document.querySelector(".skor");
  var highScoreElement = document.querySelector(".enYuksekSkor");

  skorElement.textContent = "Skor: " + count;
  highScoreElement.textContent = "En Yüksek Skor: " + highScore;
}

async function loadGlobalScores() {
  var leaderboardList = document.querySelector(".leaderboard-list");

  leaderboardList.innerHTML = "<li>Yükleniyor...</li>";

  var result = await supabaseClient
    .from("scores")
    .select("player_name, score")
    .order("score", { ascending: false })
    .limit(5);

  if (result.error) {
    leaderboardList.innerHTML = "<li>Skorlar yüklenemedi.</li>";
    console.log(result.error);
    updateScoreBoard();
    return;
  }

  leaderboardList.innerHTML = "";

  if (result.data.length === 0) {
    leaderboardList.innerHTML = "<li>Henüz skor yok.</li>";
    updateScoreBoard();
    return;
  }

  highScore = result.data[0].score;
  updateScoreBoard();

  result.data.forEach(function (item) {
    var li = document.createElement("li");
    li.textContent = item.player_name + " - " + item.score;
    leaderboardList.appendChild(li);
  });
}

async function saveGlobalScore() {
  var playerNameInput = document.querySelector(".player-name");
  var saveMessage = document.querySelector(".save-message");
  var saveScoreButton = document.querySelector(".save-score");

  var playerName = playerNameInput.value.trim();

  if (playerName === "") {
    saveMessage.textContent = "Lütfen adınızı yazın.";
    return;
  }

  saveMessage.textContent = "Kaydediliyor...";
  saveScoreButton.disabled = true;

  var result = await supabaseClient.from("scores").insert({
    player_name: playerName,
    score: count,
  });

  if (result.error) {
    saveMessage.textContent = "Skor kaydedilemedi.";
    saveScoreButton.disabled = false;
    console.log(result.error);
    return;
  }

  saveMessage.textContent = "Skor kaydedildi.";
  playerNameInput.value = "";

  loadGlobalScores();
  setTimeout(function () {
    hideGameOverModal();
  }, 700);
}

function showGameOverModal() {
  var modal = document.querySelector(".modal");
  var modalScore = document.querySelector(".modal-score");
  var modalHighScore = document.querySelector(".modal-high-score");
  var playerNameInput = document.querySelector(".player-name");
  var saveMessage = document.querySelector(".save-message");
  var saveScoreButton = document.querySelector(".save-score");

  if (!modal) {
    return;
  }

  if (saveScoreButton) {
    saveScoreButton.disabled = false;
  }

  if (modalScore) {
    modalScore.textContent = "Skor: " + count;
  }

  if (modalHighScore) {
    modalHighScore.textContent = "En Yüksek Skor: " + highScore;
  }

  if (saveMessage) {
    saveMessage.textContent = "";
  }

  modal.classList.remove("hidden");

  if (playerNameInput) {
    setTimeout(function () {
      playerNameInput.focus();
    }, 100);
  }
}

function hideGameOverModal() {
  var modal = document.querySelector(".modal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
}

//içerikleri oluşturalım

function update() {
  // oyunun bitme durumunu kontrol edelim
  if (gameOver || isPaused) {
    return;
  }

  context.fillStyle = themeMap[boardTheme].background;
  context.fillRect(0, 0, board.width, board.height);

  context.fillStyle = themeMap[boardTheme].food;
  context.fillRect(elmaX, elmaY, blockSize, blockSize);

  //Yılanın elmayı yediğini kontrol edelim
  if (snakeX == elmaX && snakeY == elmaY) {
    snakeBody.push([elmaX, elmaY]);
    placeFood();
    count++;

    if (count > highScore) {
      highScore = count;
    }

    updateScoreBoard();
  }
  for (let i = snakeBody.length - 1; i > 0; i--) {
    snakeBody[i] = snakeBody[i - 1];
  }

  if (snakeBody.length) {
    snakeBody[0] = [snakeX, snakeY];
  }

  context.fillStyle = colorMap[snakeColor];
  snakeX += velocityX * blockSize;
  snakeY += velocityY * blockSize;
  context.fillRect(snakeX, snakeY, blockSize, blockSize);

  for (let i = 0; i < snakeBody.length; i++) {
    context.fillRect(snakeBody[i][0], snakeBody[i][1], blockSize, blockSize);
  }

  //oyunun sonlanma durumları
  if (
    snakeX < 0 ||
    snakeX >= cols * blockSize ||
    snakeY < 0 ||
    snakeY >= rows * blockSize
  ) {
    gameOver = true;
    stopChaosPopups();
    showGameOverModal();
    return;
  }

  for (let i = 0; i < snakeBody.length; i++) {
    if (snakeX == snakeBody[i][0] && snakeY == snakeBody[i][1]) {
      gameOver = true;
      showGameOverModal();
      return;
    }
  }
}

// Oyunu başlatan fonksiyon
function startGame() {
  showSinglePlayerGame();
  hideGameOverModal();

  // Oyunun durumunu sıfırla
  gameOver = false;
  isPaused = false;
  updatePauseButton();
  snakeX = blockSize * 10;
  snakeY = blockSize * 10;
  velocityX = 0;
  velocityY = 0;
  snakeBody = [];
  count = 0;

  placeFood();
  updateScoreBoard();

  stopChaosPopups();
  scheduleNextChaosPopup();
}

function updatePauseButton() {
  var pauseButton = document.querySelector(".pause-btn");

  if (!pauseButton) {
    return;
  }

  if (isPaused) {
    pauseButton.textContent = "Devam";
  } else {
    pauseButton.textContent = "Pause";
  }
}

function togglePause() {
  if (gameOver) {
    return;
  }

  var pauseModal = document.querySelector(".single-pause-modal");

  isPaused = !isPaused;
  updatePauseButton();

  if (pauseModal) {
    if (isPaused) {
      pauseModal.classList.remove("hidden");
    } else {
      pauseModal.classList.add("hidden");
    }
  }
}

function showSinglePlayerSetup() {
  var setupPanel = document.querySelector(".single-setup-panel");
  var gameArea = document.querySelector(".single-game-area");
  var pauseButton = document.querySelector(".pause-btn");
  var pauseModal = document.querySelector(".single-pause-modal");

  gameOver = true;
  isPaused = false;

  stopChaosPopups();

  if (setupPanel) {
    setupPanel.classList.remove("hidden");
  }

  if (gameArea) {
    gameArea.classList.add("hidden");
  }

  if (pauseButton) {
    pauseButton.classList.add("hidden");
  }

  if (pauseModal) {
    pauseModal.classList.add("hidden");
  }

  updatePauseButton();
}

function showSinglePlayerGame() {
  var setupPanel = document.querySelector(".single-setup-panel");
  var gameArea = document.querySelector(".single-game-area");
  var pauseButton = document.querySelector(".pause-btn");

  if (setupPanel) {
    setupPanel.classList.add("hidden");
  }

  if (gameArea) {
    gameArea.classList.remove("hidden");
  }

  if (pauseButton) {
    pauseButton.classList.remove("hidden");
  }
}

function setupSingleSelects() {
  var colorSelect = document.querySelector(".single-snake-color-select");
  var themeSelect = document.querySelector(".single-theme-select");

  if (colorSelect) {
    colorSelect.value = snakeColor;

    colorSelect.addEventListener("change", function () {
      snakeColor = colorSelect.value;
      localStorage.setItem("snakeColor", snakeColor);
    });
  }

  if (themeSelect) {
    themeSelect.value = boardTheme;

    themeSelect.addEventListener("change", function () {
      boardTheme = themeSelect.value;
      localStorage.setItem("boardTheme", boardTheme);
    });
  }
}

function resetSinglePlayerToMenu() {
  gameOver = true;
  isPaused = false;

  snakeX = blockSize * 10;
  snakeY = blockSize * 10;
  velocityX = 0;
  velocityY = 0;
  snakeBody = [];
  count = 0;

  var oyunBittiText = document.querySelector(".oyunBitti");
  var pauseModal = document.querySelector(".single-pause-modal");

  if (oyunBittiText) {
    oyunBittiText.innerHTML = "";
  }

  if (pauseModal) {
    pauseModal.classList.add("hidden");
  }

  hideGameOverModal();
  updatePauseButton();
  updateScoreBoard();
  showSinglePlayerSetup();
}

//foksiyonumuz

window.onload = function () {
  board = document.getElementById("board");
  board.height = rows * blockSize;
  board.width = cols * blockSize;
  context = board.getContext("2d");

  placeFood();
  updateScoreBoard();

  document.addEventListener("keydown", changeDirection);

  var baslatButton = document.querySelector(".baslat");

  if (baslatButton) {
    baslatButton.addEventListener("click", startGame);
  }

  var pauseButton = document.querySelector(".pause-btn");

  if (pauseButton) {
    pauseButton.addEventListener("click", togglePause);
  }

  var singleResumeButton = document.querySelector(".single-resume-btn");

  if (singleResumeButton) {
    singleResumeButton.addEventListener("click", togglePause);
  }

  setupSingleSelects();
  showSinglePlayerSetup();

  var modalRestartButton = document.querySelector(".modal-restart");

  if (modalRestartButton) {
    modalRestartButton.addEventListener("click", startGame);
  }

  var saveScoreButton = document.querySelector(".save-score");

  if (saveScoreButton) {
    saveScoreButton.addEventListener("click", saveGlobalScore);
  }

  var playerNameInput = document.querySelector(".player-name");

  if (playerNameInput) {
    playerNameInput.addEventListener("keydown", function (e) {
      e.stopPropagation();

      if (e.key === "Enter") {
        saveGlobalScore();
      }
    });
  }

  loadGlobalScores();

  var controlButtons = document.querySelectorAll(".control-btn");

  controlButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setDirection(button.dataset.direction);
    });
  });

  restartSingleGameLoop(normalGameSpeed);
};

function changeDirection(e) {
  var activeElement = document.activeElement;

  if (
    activeElement &&
    activeElement.classList &&
    activeElement.classList.contains("player-name")
  ) {
    return;
  }

  if (e.code === "KeyR") {
    startGame();
    return;
  }
  if (e.code === "KeyP") {
    togglePause();
    return;
  }

  if (e.code === "ArrowUp" || e.key === "w" || e.key === "W") {
    setDirection("up");
  } else if (e.code === "ArrowDown" || e.key === "s" || e.key === "S") {
    setDirection("down");
  } else if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") {
    setDirection("left");
  } else if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") {
    setDirection("right");
  }
}

function setDirection(direction) {
  if (direction === "up" && velocityY !== 1) {
    velocityX = 0;
    velocityY = -1;
  } else if (direction === "down" && velocityY !== -1) {
    velocityX = 0;
    velocityY = 1;
  } else if (direction === "left" && velocityX !== 1) {
    velocityX = -1;
    velocityY = 0;
  } else if (direction === "right" && velocityX !== -1) {
    velocityX = 1;
    velocityY = 0;
  }
}
