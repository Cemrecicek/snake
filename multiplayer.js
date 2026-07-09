var socket = io();

var createRoomButton = document.querySelector(".create-room-btn");
var joinRoomButton = document.querySelector(".join-room-btn");
var roomCodeInput = document.querySelector(".room-code-input");
var multiplayerPlayerNameInput = document.querySelector(
  ".multiplayer-player-name",
);
var multiplayerPauseButton = document.querySelector(".multiplayer-pause-btn");

var roomInfo = document.querySelector(".room-info");
var roomCodeText = document.querySelector(".room-code-text");
var playerCountText = document.querySelector(".player-count-text");
var roomMessageText = document.querySelector(".room-message-text");

var multiplayerIntroModal = document.querySelector(".multiplayer-intro-modal");
var introPlayerName = document.querySelector(".intro-player-name");
var introPlayerNumber = document.querySelector(".intro-player-number");
var introPlayerColor = document.querySelector(".intro-player-color");
var introCountdown = document.querySelector(".intro-countdown");

var controlSideButtons = document.querySelectorAll(".control-side-btn");
var multiplayerControls = document.querySelector(".multiplayer-controls");

var multiplayerControlSide =
  localStorage.getItem("multiplayerControlSide") || "left";

var multiplayerGameOverModal = document.querySelector(
  ".multiplayer-game-over-modal",
);
var multiplayerWinnerText = document.querySelector(".multiplayer-winner-text");
var multiplayerFinalScoreOne = document.querySelector(
  ".multiplayer-final-score-one",
);

var multiplayerSnakeColor =
  localStorage.getItem("multiplayerSnakeColor") || "green";

var multiplayerBoardTheme =
  localStorage.getItem("multiplayerBoardTheme") || "dark";

var multiplayerSnakeColorSelect = document.querySelector(
  ".multiplayer-snake-color-select",
);

var multiplayerThemeSelect = document.querySelector(
  ".multiplayer-theme-select",
);

var multiplayerFinalScoreTwo = document.querySelector(
  ".multiplayer-final-score-two",
);
var multiplayerRestartButton = document.querySelector(
  ".multiplayer-restart-btn",
);
var multiplayerMenuButton = document.querySelector(".multiplayer-menu-btn");
var multiplayerRestartMessage = document.querySelector(
  ".multiplayer-restart-message",
);

var multiplayerBoard = document.querySelector("#multiplayer-board");
var multiplayerContext = multiplayerBoard.getContext("2d");

var currentRoomCode = null;

var myPlayerName = "";
var myPlayerNumber = "";
var myColorName = "";

var multiplayerIntroFinished = false;
var latestGameState = null;

var multiplayerRows = 20;
var multiplayerCols = 30;
var multiplayerBlockSize = 24;

multiplayerBoard.width = multiplayerCols * multiplayerBlockSize;
multiplayerBoard.height = multiplayerRows * multiplayerBlockSize;

function setMyPlayerInfo(playerName, playerNumber, colorName) {
  myPlayerName = playerName;
  myPlayerNumber = playerNumber;
  myColorName = colorName;
}

function showMultiplayerIntro() {
  roomInfo.classList.add("hidden");

  introPlayerName.textContent = myPlayerName;

  introPlayerNumber.textContent =
    myPlayerNumber === "player1" ? "Oyuncu 1" : "Oyuncu 2";

  introPlayerColor.textContent = "Renk: " + myColorName;
  introCountdown.textContent = "Oyun 4 saniye içinde başlıyor...";

  multiplayerIntroModal.classList.remove("hidden");
}

function setupMultiplayerSelects() {
  if (multiplayerSnakeColorSelect) {
    multiplayerSnakeColorSelect.value = multiplayerSnakeColor;

    multiplayerSnakeColorSelect.addEventListener("change", function () {
      multiplayerSnakeColor = multiplayerSnakeColorSelect.value;
      localStorage.setItem("multiplayerSnakeColor", multiplayerSnakeColor);
    });
  }

  if (multiplayerThemeSelect) {
    multiplayerThemeSelect.value = multiplayerBoardTheme;

    multiplayerThemeSelect.addEventListener("change", function () {
      multiplayerBoardTheme = multiplayerThemeSelect.value;
      localStorage.setItem("multiplayerBoardTheme", multiplayerBoardTheme);
    });
  }
}

setupMultiplayerSelects();

function updateMultiplayerControlSide(side) {
  var multiplayerGameArea = document.querySelector(".multiplayer-game-area");

  multiplayerControlSide = side;
  localStorage.setItem("multiplayerControlSide", side);

  multiplayerControls.classList.remove("control-left");
  multiplayerControls.classList.remove("control-right");

  multiplayerGameArea.classList.remove("controls-left");
  multiplayerGameArea.classList.remove("controls-right");

  if (side === "right") {
    multiplayerControls.classList.add("control-right");
    multiplayerGameArea.classList.add("controls-right");
  } else {
    multiplayerControls.classList.add("control-left");
    multiplayerGameArea.classList.add("controls-left");
  }

  controlSideButtons.forEach(function (button) {
    if (button.dataset.side === side) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

function showMultiplayerGameArea() {
  var multiplayerLobby = document.querySelector(".multiplayer-lobby");
  var multiplayerGameArea = document.querySelector(".multiplayer-game-area");

  multiplayerIntroFinished = true;

  multiplayerIntroModal.classList.add("hidden");
  roomInfo.classList.add("hidden");
  multiplayerLobby.classList.add("hidden");
  multiplayerGameArea.classList.remove("hidden");
  multiplayerPauseButton.classList.remove("hidden");
  multiplayerPauseButton.textContent = "Pause";

  console.log("[MULTI] Oyun alanı açıldı, chaos popup başlatılıyor");

  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }

  if (typeof scheduleNextChaosPopup === "function") {
    scheduleNextChaosPopup();
  } else {
    console.log("[MULTI] scheduleNextChaosPopup bulunamadı!");
  }

  if (latestGameState) {
    drawMultiplayerGame(latestGameState);
  }
}

function showMultiplayerGameOverModal(data) {
  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }

  multiplayerPauseButton.classList.add("hidden");

  multiplayerWinnerText.textContent = "Kazanan: " + data.winner;

  multiplayerFinalScoreOne.textContent =
    data.players.player1.name + ": " + data.players.player1.score;

  multiplayerFinalScoreTwo.textContent =
    data.players.player2.name + ": " + data.players.player2.score;

  multiplayerRestartMessage.textContent = "";
  multiplayerRestartButton.disabled = false;

  multiplayerGameOverModal.classList.remove("hidden");
}

function hideMultiplayerGameOverModal() {
  multiplayerGameOverModal.classList.add("hidden");
}

function drawMultiplayerGame(gameState) {
  multiplayerBoard.width = gameState.cols * gameState.blockSize;
  multiplayerBoard.height = gameState.rows * gameState.blockSize;

  var selectedTheme = gameState.boardTheme || {
    background: "black",
    food: "red",
  };

  multiplayerContext.fillStyle = selectedTheme.background;
  multiplayerContext.fillRect(
    0,
    0,
    multiplayerBoard.width,
    multiplayerBoard.height,
  );

  multiplayerContext.fillStyle = selectedTheme.food;
  multiplayerContext.fillRect(
    gameState.food.x * gameState.blockSize,
    gameState.food.y * gameState.blockSize,
    gameState.blockSize,
    gameState.blockSize,
  );

  drawMultiplayerPlayer(gameState.players.player1, gameState.blockSize);
  drawMultiplayerPlayer(gameState.players.player2, gameState.blockSize);

  document.querySelector(".player-one-score").textContent =
    gameState.players.player1.name + ": " + gameState.players.player1.score;

  document.querySelector(".player-two-score").textContent =
    gameState.players.player2.name + ": " + gameState.players.player2.score;
}

function drawMultiplayerPlayer(player, blockSize) {
  multiplayerContext.fillStyle = player.color;

  multiplayerContext.fillRect(
    player.x * blockSize,
    player.y * blockSize,
    blockSize,
    blockSize,
  );

  player.body.forEach(function (part) {
    multiplayerContext.fillRect(
      part.x * blockSize,
      part.y * blockSize,
      blockSize,
      blockSize,
    );
  });
}

socket.on("connect", function () {
  console.log("Socket bağlantısı kuruldu:", socket.id);
});

createRoomButton.addEventListener("click", function () {
  var playerName = multiplayerPlayerNameInput.value.trim();

  if (playerName === "") {
    roomInfo.classList.remove("hidden");
    roomMessageText.textContent = "Lütfen oyuncu adını gir.";
    return;
  }

  multiplayerIntroFinished = false;
  latestGameState = null;

  socket.emit("createRoom", {
    playerName: playerName,
    snakeColor: multiplayerSnakeColor,
    boardTheme: multiplayerBoardTheme,
  });
});

joinRoomButton.addEventListener("click", function () {
  var playerName = multiplayerPlayerNameInput.value.trim();
  var roomCode = roomCodeInput.value.trim().toUpperCase();

  if (playerName === "") {
    roomInfo.classList.remove("hidden");
    roomMessageText.textContent = "Lütfen oyuncu adını gir.";
    return;
  }

  if (roomCode === "") {
    roomInfo.classList.remove("hidden");
    roomMessageText.textContent = "Lütfen oda kodu gir.";
    return;
  }

  multiplayerIntroFinished = false;
  latestGameState = null;

  socket.emit("joinRoom", {
    roomCode: roomCode,
    playerName: playerName,
    snakeColor: multiplayerSnakeColor,
  });
});

socket.on("roomCreated", function (data) {
  currentRoomCode = data.roomCode;

  roomInfo.classList.remove("hidden");
  roomCodeText.textContent = "Oda Kodu: " + data.roomCode;
  playerCountText.textContent = "Oyuncu Sayısı: 1/2";
  roomMessageText.textContent = "Arkadaşının katılmasını bekliyorsun...";

  setMyPlayerInfo(data.playerName, data.playerNumber, data.colorName);
});

socket.on("roomJoined", function (data) {
  currentRoomCode = data.roomCode;

  roomInfo.classList.remove("hidden");
  roomCodeText.textContent = "Oda Kodu: " + data.roomCode;
  roomMessageText.textContent = "Odaya katıldın.";

  setMyPlayerInfo(data.playerName, data.playerNumber, data.colorName);
});

socket.on("roomStatus", function (data) {
  roomInfo.classList.remove("hidden");
  roomCodeText.textContent = "Oda Kodu: " + data.roomCode;
  playerCountText.textContent = "Oyuncu Sayısı: " + data.playerCount + "/2";

  if (data.playerCount === 1) {
    roomMessageText.textContent = "Diğer oyuncu bekleniyor...";
  }

  if (data.playerCount === 2) {
    roomMessageText.textContent = "İki oyuncu hazır.";
  }
});

socket.on("joinError", function (message) {
  roomInfo.classList.remove("hidden");
  roomMessageText.textContent = message;
});

socket.on("playersReady", function () {
  var multiplayerLobby = document.querySelector(".multiplayer-lobby");
  var multiplayerGameArea = document.querySelector(".multiplayer-game-area");

  latestGameState = null;
  multiplayerIntroFinished = false;

  roomInfo.classList.add("hidden");
  multiplayerLobby.classList.add("hidden");
  multiplayerGameArea.classList.add("hidden");

  showMultiplayerIntro();

  setTimeout(function () {
    showMultiplayerGameArea();
  }, 4000);
});

socket.on("gameState", function (gameState) {
  latestGameState = gameState;

  if (!multiplayerIntroFinished) {
    return;
  }

  drawMultiplayerGame(gameState);
});

socket.on("disconnect", function () {
  console.log("Socket bağlantısı koptu.");
});

document.addEventListener("keydown", function (e) {
  if (e.code === "ArrowUp" || e.key === "w" || e.key === "W") {
    sendMultiplayerDirection("up");
  } else if (e.code === "ArrowDown" || e.key === "s" || e.key === "S") {
    sendMultiplayerDirection("down");
  } else if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") {
    sendMultiplayerDirection("left");
  } else if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") {
    sendMultiplayerDirection("right");
  }
});

function sendMultiplayerDirection(direction) {
  if (!currentRoomCode || !multiplayerIntroFinished) {
    return;
  }

  socket.emit("changeMultiplayerDirection", {
    roomCode: currentRoomCode,
    direction: direction,
  });
}

var multiplayerControlButtons = document.querySelectorAll(
  ".multiplayer-control-btn",
);

multiplayerControlButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    var direction = button.dataset.direction;
    sendMultiplayerDirection(direction);
  });

  button.addEventListener("touchstart", function (e) {
    e.preventDefault();

    var direction = button.dataset.direction;
    sendMultiplayerDirection(direction);
  });
});

controlSideButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    updateMultiplayerControlSide(button.dataset.side);
  });
});

updateMultiplayerControlSide(multiplayerControlSide);

socket.on("multiplayerGameOver", function (data) {
  showMultiplayerGameOverModal(data);
});

multiplayerRestartButton.addEventListener("click", function () {
  if (!currentRoomCode) {
    return;
  }

  multiplayerRestartButton.disabled = true;
  multiplayerRestartMessage.textContent =
    "Tekrar oyun isteğin gönderildi. Diğer oyuncu bekleniyor...";

  socket.emit("restartMultiplayerGame", {
    roomCode: currentRoomCode,
  });
});

socket.on("restartVoteStatus", function (data) {
  if (data.player1Ready && data.player2Ready) {
    multiplayerRestartMessage.textContent = "İki oyuncu hazır.";
  } else {
    multiplayerRestartMessage.textContent =
      "Tekrar başlamak için iki oyuncu da onaylamalı.";
  }
});

socket.on("restartAccepted", function () {
  hideMultiplayerGameOverModal();

  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }

  multiplayerIntroFinished = false;
  latestGameState = null;
});

multiplayerMenuButton.addEventListener("click", function () {
  hideMultiplayerGameOverModal();

  multiplayerPauseButton.classList.add("hidden");

  var multiplayerLobby = document.querySelector(".multiplayer-lobby");
  var multiplayerGameArea = document.querySelector(".multiplayer-game-area");

  multiplayerGameArea.classList.add("hidden");
  multiplayerLobby.classList.remove("hidden");

  if (typeof showScreen === "function") {
    showScreen("menu-screen");
  }
});

multiplayerPauseButton.addEventListener("click", function () {
  if (!currentRoomCode || !multiplayerIntroFinished) {
    return;
  }

  socket.emit("toggleMultiplayerPause", {
    roomCode: currentRoomCode,
  });
});

socket.on("multiplayerPauseChanged", function (data) {
  var multiplayerPauseModal = document.querySelector(
    ".multiplayer-pause-modal",
  );

  if (data.paused) {
    multiplayerPauseButton.textContent = "Devam";

    if (multiplayerPauseModal) {
      multiplayerPauseModal.classList.remove("hidden");
    }
  } else {
    multiplayerPauseButton.textContent = "Pause";

    if (multiplayerPauseModal) {
      multiplayerPauseModal.classList.add("hidden");
    }
  }
});

var multiplayerResumeButton = document.querySelector(".multiplayer-resume-btn");

if (multiplayerResumeButton) {
  multiplayerResumeButton.addEventListener("click", function () {
    if (!currentRoomCode || !multiplayerIntroFinished) {
      return;
    }

    socket.emit("toggleMultiplayerPause", {
      roomCode: currentRoomCode,
    });
  });
}

function resetMultiplayerToMenu() {
  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }

  if (currentRoomCode) {
    socket.emit("leaveRoom", {
      roomCode: currentRoomCode,
    });
  }

  currentRoomCode = null;
  myPlayerName = "";
  myPlayerNumber = "";
  myColorName = "";
  multiplayerIntroFinished = false;
  latestGameState = null;

  hideMultiplayerGameOverModal();

  multiplayerIntroModal.classList.add("hidden");

  if (multiplayerPauseButton) {
    multiplayerPauseButton.classList.add("hidden");
    multiplayerPauseButton.textContent = "Pause";
  }

  roomInfo.classList.add("hidden");
  roomCodeText.textContent = "Oda Kodu: -";
  playerCountText.textContent = "Oyuncu Sayısı: 0/2";
  roomMessageText.textContent = "Oda bekleniyor...";

  var multiplayerLobby = document.querySelector(".multiplayer-lobby");
  var multiplayerGameArea = document.querySelector(".multiplayer-game-area");

  multiplayerLobby.classList.remove("hidden");
  multiplayerGameArea.classList.add("hidden");

  if (multiplayerBoard && multiplayerContext) {
    multiplayerContext.clearRect(
      0,
      0,
      multiplayerBoard.width,
      multiplayerBoard.height,
    );
  }
}

socket.on("playerLeft", function (data) {
  resetMultiplayerToMenu();

  roomInfo.classList.remove("hidden");
  roomMessageText.textContent = data.message || "Diğer oyuncu ayrıldı.";
});
