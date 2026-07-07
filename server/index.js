const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, "..")));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = {};

const GAME_ROWS = 24;
const GAME_COLS = 36;
const BLOCK_SIZE = 24;

const PLAYER_COLORS = {
  green: {
    value: "#7CFC00",
    name: "Yeşil",
  },
  blue: {
    value: "#00BFFF",
    name: "Mavi",
  },
  purple: {
    value: "#A855F7",
    name: "Mor",
  },
  orange: {
    value: "#FF9800",
    name: "Turuncu",
  },
  pink: {
    value: "#FF4FD8",
    name: "Pembe",
  },
};

const BOARD_THEMES = {
  dark: {
    key: "dark",
    background: "black",
    food: "red",
  },
  light: {
    key: "light",
    background: "#D8DEE9",
    food: "#ff002b",
  },
};

app.get("/health", function (req, res) {
  res.send("Snake multiplayer server çalışıyor.");
});

function getSafeColorKey(colorKey, fallback) {
  if (PLAYER_COLORS[colorKey]) {
    return colorKey;
  }

  return fallback;
}

function getSafeThemeKey(themeKey) {
  if (BOARD_THEMES[themeKey]) {
    return themeKey;
  }

  return "dark";
}

function getThemeData(themeKey) {
  var safeThemeKey = getSafeThemeKey(themeKey);
  return BOARD_THEMES[safeThemeKey];
}

function getDifferentColorKey(requestedColorKey, otherColorKey) {
  var safeRequestedColorKey = getSafeColorKey(requestedColorKey, "blue");

  if (safeRequestedColorKey !== otherColorKey) {
    return safeRequestedColorKey;
  }

  var colorKeys = Object.keys(PLAYER_COLORS);

  for (var i = 0; i < colorKeys.length; i++) {
    if (colorKeys[i] !== otherColorKey) {
      return colorKeys[i];
    }
  }

  return "blue";
}

function createInitialGameState(roomCode, options) {
  options = options || {};

  var player1ColorKey = getSafeColorKey(options.player1ColorKey, "green");
  var player2ColorKey = getDifferentColorKey("blue", player1ColorKey);
  var boardThemeKey = getSafeThemeKey(options.boardTheme);
  var boardTheme = getThemeData(boardThemeKey);

  return {
    roomCode: roomCode,
    rows: GAME_ROWS,
    cols: GAME_COLS,
    blockSize: BLOCK_SIZE,
    boardTheme: boardTheme,
    food: {
      x: 18,
      y: 12,
    },
    players: {
      player1: {
        id: null,
        name: "Oyuncu 1",
        x: 8,
        y: 12,
        direction: null,
        body: [],
        score: 0,
        colorKey: player1ColorKey,
        color: PLAYER_COLORS[player1ColorKey].value,
        colorName: PLAYER_COLORS[player1ColorKey].name,
      },
      player2: {
        id: null,
        name: "Oyuncu 2",
        x: 28,
        y: 12,
        direction: null,
        body: [],
        score: 0,
        colorKey: player2ColorKey,
        color: PLAYER_COLORS[player2ColorKey].value,
        colorName: PLAYER_COLORS[player2ColorKey].name,
      },
    },
    gameStarted: false,
    gameOver: false,
    paused: false,
    winner: null,
    restartVotes: {
      player1: false,
      player2: false,
    },
    intervalId: null,
  };
}

function isPositionOnPlayer(position, player) {
  if (position.x === player.x && position.y === player.y) {
    return true;
  }

  return player.body.some(function (part) {
    return position.x === part.x && position.y === part.y;
  });
}

function isPositionOccupied(position, game) {
  return (
    isPositionOnPlayer(position, game.players.player1) ||
    isPositionOnPlayer(position, game.players.player2)
  );
}

function placeFood(game) {
  var food;
  var attempts = 0;
  var maxAttempts = GAME_ROWS * GAME_COLS;

  do {
    food = {
      x: Math.floor(Math.random() * GAME_COLS),
      y: Math.floor(Math.random() * GAME_ROWS),
    };

    attempts += 1;
  } while (isPositionOccupied(food, game) && attempts < maxAttempts);

  return food;
}

function movePlayer(player) {
  if (!player.direction) {
    return;
  }

  player.body.unshift({
    x: player.x,
    y: player.y,
  });

  if (player.direction === "up") {
    player.y -= 1;
  } else if (player.direction === "down") {
    player.y += 1;
  } else if (player.direction === "left") {
    player.x -= 1;
  } else if (player.direction === "right") {
    player.x += 1;
  }

  player.body.pop();
}

function checkFood(game, player) {
  if (player.x === game.food.x && player.y === game.food.y) {
    player.score += 1;

    player.body.push({
      x: player.x,
      y: player.y,
    });

    game.food = placeFood(game);
  }
}

function isOutOfBounds(player) {
  return (
    player.x < 0 ||
    player.x >= GAME_COLS ||
    player.y < 0 ||
    player.y >= GAME_ROWS
  );
}

function isSamePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isHeadTouchingBody(player, body) {
  return body.some(function (part) {
    return player.x === part.x && player.y === part.y;
  });
}

function getWinnerByScore(player1, player2) {
  if (player1.score > player2.score) {
    return player1.name;
  }

  if (player2.score > player1.score) {
    return player2.name;
  }

  return "Berabere";
}

function endGame(roomCode, winner) {
  var game = rooms[roomCode];

  if (!game) {
    return;
  }

  game.gameOver = true;
  game.gameStarted = false;
  game.winner = winner;

  if (game.intervalId) {
    clearInterval(game.intervalId);
    game.intervalId = null;
  }

  io.to(roomCode).emit("gameState", game);

  io.to(roomCode).emit("multiplayerGameOver", {
    winner: winner,
    players: game.players,
  });
}

function checkGameOver(roomCode) {
  var game = rooms[roomCode];

  if (!game) {
    return;
  }

  var player1 = game.players.player1;
  var player2 = game.players.player2;

  var player1Out = isOutOfBounds(player1);
  var player2Out = isOutOfBounds(player2);

  var headToHead = isSamePosition(player1, player2);

  var player1HitSelf = isHeadTouchingBody(player1, player1.body);
  var player2HitSelf = isHeadTouchingBody(player2, player2.body);

  var player1HitPlayer2Body = isHeadTouchingBody(player1, player2.body);
  var player2HitPlayer1Body = isHeadTouchingBody(player2, player1.body);

  var anyGameOver =
    player1Out ||
    player2Out ||
    headToHead ||
    player1HitSelf ||
    player2HitSelf ||
    player1HitPlayer2Body ||
    player2HitPlayer1Body;

  if (anyGameOver) {
    endGame(roomCode, getWinnerByScore(player1, player2));
  }
}

function updateGame(roomCode) {
  var game = rooms[roomCode];

  if (!game || !game.gameStarted || game.gameOver || game.paused) {
    return;
  }

  movePlayer(game.players.player1);
  movePlayer(game.players.player2);

  checkGameOver(roomCode);

  if (game.gameOver) {
    return;
  }

  checkFood(game, game.players.player1);
  checkFood(game, game.players.player2);

  io.to(roomCode).emit("gameState", game);
}

function startRoomGame(roomCode) {
  var game = rooms[roomCode];

  if (!game) {
    return;
  }

  io.to(roomCode).emit("playersReady", {
    roomCode: roomCode,
    message: "İki oyuncu hazır.",
  });

  io.to(roomCode).emit("gameState", game);
}

function getPlayerBySocketId(game, socketId) {
  if (game.players.player1.id === socketId) {
    return game.players.player1;
  }

  if (game.players.player2.id === socketId) {
    return game.players.player2;
  }

  return null;
}

function changePlayerDirection(player, direction) {
  if (direction === "up" && player.direction !== "down") {
    player.direction = "up";
  } else if (direction === "down" && player.direction !== "up") {
    player.direction = "down";
  } else if (direction === "left" && player.direction !== "right") {
    player.direction = "left";
  } else if (direction === "right" && player.direction !== "left") {
    player.direction = "right";
  }
}

function resetRoomGame(roomCode) {
  var oldGame = rooms[roomCode];

  if (!oldGame) {
    return;
  }

  var player1Id = oldGame.players.player1.id;
  var player2Id = oldGame.players.player2.id;

  var player1Name = oldGame.players.player1.name;
  var player2Name = oldGame.players.player2.name;

  var player1ColorKey = oldGame.players.player1.colorKey;
  var player2ColorKey = oldGame.players.player2.colorKey;
  var boardTheme = oldGame.boardTheme.key;

  rooms[roomCode] = createInitialGameState(roomCode, {
    player1ColorKey: player1ColorKey,
    boardTheme: boardTheme,
  });

  rooms[roomCode].players.player1.id = player1Id;
  rooms[roomCode].players.player2.id = player2Id;

  rooms[roomCode].players.player1.name = player1Name;
  rooms[roomCode].players.player2.name = player2Name;

  rooms[roomCode].players.player2.colorKey = player2ColorKey;
  rooms[roomCode].players.player2.color = PLAYER_COLORS[player2ColorKey].value;
  rooms[roomCode].players.player2.colorName =
    PLAYER_COLORS[player2ColorKey].name;

  io.to(roomCode).emit("restartAccepted", {
    message: "İki oyuncu hazır. Oyun yeniden başlıyor.",
  });

  startRoomGame(roomCode);
}

io.on("connection", function (socket) {
  console.log("Bir oyuncu bağlandı:", socket.id);

  socket.on("createRoom", function (data) {
    data = data || {};

    var roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    socket.join(roomCode);

    rooms[roomCode] = createInitialGameState(roomCode, {
      player1ColorKey: data.snakeColor,
      boardTheme: data.boardTheme,
    });

    rooms[roomCode].players.player1.id = socket.id;
    rooms[roomCode].players.player1.name = data.playerName || "Oyuncu 1";

    socket.emit("roomCreated", {
      roomCode: roomCode,
      playerId: socket.id,
      playerNumber: "player1",
      playerName: rooms[roomCode].players.player1.name,
      colorName: rooms[roomCode].players.player1.colorName,
    });

    socket.emit("roomStatus", {
      roomCode: roomCode,
      playerCount: 1,
    });

    console.log("Oda oluşturuldu:", roomCode);
  });

  socket.on("joinRoom", function (data) {
    data = data || {};

    if (!data.roomCode) {
      socket.emit("joinError", "Lütfen oda kodu gir.");
      return;
    }

    var roomCode = data.roomCode.trim().toUpperCase();

    var room = io.sockets.adapter.rooms.get(roomCode);

    if (!room || !rooms[roomCode]) {
      socket.emit("joinError", "Böyle bir oda yok.");
      return;
    }

    var playerCountBeforeJoin = room.size;

    if (playerCountBeforeJoin >= 2) {
      socket.emit("joinError", "Bu oda dolu.");
      return;
    }

    socket.join(roomCode);

    rooms[roomCode].players.player2.id = socket.id;
    rooms[roomCode].players.player2.name = data.playerName || "Oyuncu 2";

    var player2ColorKey = getDifferentColorKey(
      data.snakeColor,
      rooms[roomCode].players.player1.colorKey,
    );

    rooms[roomCode].players.player2.colorKey = player2ColorKey;
    rooms[roomCode].players.player2.color =
      PLAYER_COLORS[player2ColorKey].value;
    rooms[roomCode].players.player2.colorName =
      PLAYER_COLORS[player2ColorKey].name;

    var playerCountAfterJoin = io.sockets.adapter.rooms.get(roomCode).size;

    socket.emit("roomJoined", {
      roomCode: roomCode,
      playerId: socket.id,
      playerNumber: "player2",
      playerName: rooms[roomCode].players.player2.name,
      colorName: rooms[roomCode].players.player2.colorName,
    });

    io.to(roomCode).emit("roomStatus", {
      roomCode: roomCode,
      playerCount: playerCountAfterJoin,
    });

    if (playerCountAfterJoin === 2) {
      startRoomGame(roomCode);
    }

    console.log(
      socket.id + " odaya katıldı:",
      roomCode,
      "Oyuncu sayısı:",
      playerCountAfterJoin,
    );
  });

  socket.on("changeMultiplayerDirection", function (data) {
    var roomCode = data.roomCode;
    var direction = data.direction;

    var game = rooms[roomCode];

    if (!game || game.gameOver) {
      return;
    }

    var player = getPlayerBySocketId(game, socket.id);

    if (!player) {
      return;
    }

    changePlayerDirection(player, direction);

    if (!game.gameStarted) {
      game.gameStarted = true;

      game.intervalId = setInterval(function () {
        updateGame(roomCode);
      }, 150);
    }
  });

  socket.on("toggleMultiplayerPause", function (data) {
    data = data || {};

    var roomCode = data.roomCode;
    var game = rooms[roomCode];

    if (!game || game.gameOver || !game.gameStarted) {
      return;
    }

    game.paused = !game.paused;

    io.to(roomCode).emit("multiplayerPauseChanged", {
      paused: game.paused,
    });
  });

  socket.on("leaveRoom", function (data) {
    data = data || {};

    var roomCode = data.roomCode;

    if (!roomCode || !rooms[roomCode]) {
      return;
    }

    socket.leave(roomCode);

    socket.to(roomCode).emit("playerLeft", {
      message: "Diğer oyuncu ana menüye döndü.",
    });

    clearInterval(rooms[roomCode].intervalId);
    delete rooms[roomCode];
  });

  socket.on("restartMultiplayerGame", function (data) {
    var roomCode = data.roomCode;
    var game = rooms[roomCode];

    if (!game) {
      return;
    }

    var playerNumber = null;

    if (game.players.player1.id === socket.id) {
      playerNumber = "player1";
    } else if (game.players.player2.id === socket.id) {
      playerNumber = "player2";
    }

    if (!playerNumber) {
      return;
    }

    game.restartVotes[playerNumber] = true;

    io.to(roomCode).emit("restartVoteStatus", {
      player1Ready: game.restartVotes.player1,
      player2Ready: game.restartVotes.player2,
    });

    if (game.restartVotes.player1 && game.restartVotes.player2) {
      resetRoomGame(roomCode);
    }
  });

  socket.on("disconnect", function () {
    console.log("Oyuncu ayrıldı:", socket.id);

    Object.keys(rooms).forEach(function (roomCode) {
      var game = rooms[roomCode];

      if (
        game.players.player1.id === socket.id ||
        game.players.player2.id === socket.id
      ) {
        if (game.intervalId) {
          clearInterval(game.intervalId);
        }

        io.to(roomCode).emit("roomStatus", {
          roomCode: roomCode,
          playerCount: 1,
        });

        io.to(roomCode).emit("joinError", "Diğer oyuncu ayrıldı.");

        delete rooms[roomCode];

        console.log("Oda kapatıldı:", roomCode);
      }
    });
  });
});

const PORT = 3000;

server.listen(PORT, "0.0.0.0", function () {
  console.log("Server çalışıyor: http://localhost:" + PORT);
});
