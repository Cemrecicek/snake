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

var count = 0;
var highScore = 0;

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
  saveScoreButton.disabled = false;

  modalScore.textContent = "Skor: " + count;
  modalHighScore.textContent = "En Yüksek Skor: " + highScore;
  saveMessage.textContent = "";

  modal.classList.remove("hidden");

  setTimeout(function () {
    playerNameInput.focus();
  }, 100);
}

function hideGameOverModal() {
  var modal = document.querySelector(".modal");
  modal.classList.add("hidden");
}

//içerikleri oluşturalım

function update() {
  // oyunun bitme durumunu kontrol edelim
  if (gameOver || isPaused) {
    return;
  }

  context.fillStyle = "black";
  context.fillRect(0, 0, board.width, board.height);

  context.fillStyle = "red";
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

  context.fillStyle = "chartreuse";
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

  isPaused = !isPaused;
  updatePauseButton();
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
  baslatButton.addEventListener("click", startGame);

  var pauseButton = document.querySelector(".pause-btn");
  pauseButton.addEventListener("click", togglePause);

  var modalRestartButton = document.querySelector(".modal-restart");
  modalRestartButton.addEventListener("click", startGame);

  var saveScoreButton = document.querySelector(".save-score");
  saveScoreButton.addEventListener("click", saveGlobalScore);

  var playerNameInput = document.querySelector(".player-name");

  playerNameInput.addEventListener("keydown", function (e) {
    e.stopPropagation();

    if (e.key === "Enter") {
      saveGlobalScore();
    }
  });

  loadGlobalScores();

  var controlButtons = document.querySelectorAll(".control-btn");

  controlButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setDirection(button.dataset.direction);
    });
  });

  setInterval(update, 1000 / 10);
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
