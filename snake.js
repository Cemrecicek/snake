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
var highScore = Number(localStorage.getItem("snakeHighScore")) || 0;

//elma

var elmaX;
var elmaY;

//oyun bitim kontrol fonksiyonu
var gameOver = false;

//elmanın koordinatları için fonksiyon
function placeFood() {
  elmaX = Math.floor(Math.random() * cols) * blockSize;
  elmaY = Math.floor(Math.random() * rows) * blockSize;
}

//Highscore
function updateScoreBoard() {
  var skorElement = document.querySelector(".skor");
  var highScoreElement = document.querySelector(".enYuksekSkor");

  skorElement.textContent = "Skor: " + count;
  highScoreElement.textContent = "En Yüksek Skor: " + highScore;
}

function showGameOverModal() {
  var modal = document.querySelector(".modal");
  var modalScore = document.querySelector(".modal-score");
  var modalHighScore = document.querySelector(".modal-high-score");

  modalScore.textContent = "Skor: " + count;
  modalHighScore.textContent = "En Yüksek Skor: " + highScore;

  modal.classList.remove("hidden");
}

function hideGameOverModal() {
  var modal = document.querySelector(".modal");
  modal.classList.add("hidden");
}

//içerikleri oluşturalım

function update() {
  // oyunun bitme durumunu kontrol edelim
  if (gameOver) {
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
      localStorage.setItem("snakeHighScore", highScore);
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
  }

  for (let i = 0; i < snakeBody.length; i++) {
    if (snakeX == snakeBody[i][0] && snakeY == snakeBody[i][1]) {
      gameOver = true;
      showGameOverModal();
    }
  }
}

// Oyunu başlatan fonksiyon
function startGame() {
  hideGameOverModal();

  // Oyunun durumunu sıfırla
  gameOver = false;
  snakeX = blockSize * 10;
  snakeY = blockSize * 10;
  velocityX = 0;
  velocityY = 0;
  snakeBody = [];
  count = 0;

  placeFood();
  updateScoreBoard();
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

  var modalRestartButton = document.querySelector(".modal-restart");
  modalRestartButton.addEventListener("click", startGame);

  var controlButtons = document.querySelectorAll(".control-btn");

  controlButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setDirection(button.dataset.direction);
    });
  });

  setInterval(update, 1000 / 10);
};

function changeDirection(e) {
  if (e.code === "KeyR") {
    startGame();
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
