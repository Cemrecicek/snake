// multiplayer-engine.js

const P2P_GAME_ROWS = 24;
const P2P_GAME_COLS = 36;
const P2P_BLOCK_SIZE = 24;

const P2P_PLAYER_COLORS = {
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

const P2P_BOARD_THEMES = {
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

function getP2PSafeColorKey(colorKey, fallback) {
  if (P2P_PLAYER_COLORS[colorKey]) {
    return colorKey;
  }

  return fallback;
}

function getP2PSafeThemeKey(themeKey) {
  if (P2P_BOARD_THEMES[themeKey]) {
    return themeKey;
  }

  return "dark";
}

function getP2PThemeData(themeKey) {
  return P2P_BOARD_THEMES[getP2PSafeThemeKey(themeKey)];
}

function getP2PDifferentColorKey(requestedColorKey, otherColorKey) {
  const safeRequestedColorKey = getP2PSafeColorKey(requestedColorKey, "blue");

  if (safeRequestedColorKey !== otherColorKey) {
    return safeRequestedColorKey;
  }

  const colorKeys = Object.keys(P2P_PLAYER_COLORS);

  for (let i = 0; i < colorKeys.length; i += 1) {
    if (colorKeys[i] !== otherColorKey) {
      return colorKeys[i];
    }
  }

  return "blue";
}

function createP2PInitialGameState(options) {
  options = options || {};

  const player1ColorKey = getP2PSafeColorKey(options.player1ColorKey, "green");
  const player2ColorKey = getP2PDifferentColorKey(
    options.player2ColorKey || "blue",
    player1ColorKey,
  );

  const boardThemeKey = getP2PSafeThemeKey(options.boardTheme);
  const boardTheme = getP2PThemeData(boardThemeKey);

  return {
    rows: P2P_GAME_ROWS,
    cols: P2P_GAME_COLS,
    blockSize: P2P_BLOCK_SIZE,
    boardTheme: boardTheme,
    food: {
      x: 18,
      y: 12,
    },
    players: {
      player1: {
        name: options.player1Name || "Oyuncu 1",
        x: 8,
        y: 12,
        direction: null,
        body: [],
        score: 0,
        colorKey: player1ColorKey,
        color: P2P_PLAYER_COLORS[player1ColorKey].value,
        colorName: P2P_PLAYER_COLORS[player1ColorKey].name,
      },
      player2: {
        name: options.player2Name || "Oyuncu 2",
        x: 28,
        y: 12,
        direction: null,
        body: [],
        score: 0,
        colorKey: player2ColorKey,
        color: P2P_PLAYER_COLORS[player2ColorKey].value,
        colorName: P2P_PLAYER_COLORS[player2ColorKey].name,
      },
    },
    gameStarted: false,
    gameOver: false,
    paused: false,
    winner: null,
  };
}

function isP2PPositionOnPlayer(position, player) {
  if (position.x === player.x && position.y === player.y) {
    return true;
  }

  return player.body.some(function (part) {
    return position.x === part.x && position.y === part.y;
  });
}

function isP2PPositionOccupied(position, game) {
  return (
    isP2PPositionOnPlayer(position, game.players.player1) ||
    isP2PPositionOnPlayer(position, game.players.player2)
  );
}

function placeP2PFood(game) {
  let food;
  let attempts = 0;
  const maxAttempts = P2P_GAME_ROWS * P2P_GAME_COLS;

  do {
    food = {
      x: Math.floor(Math.random() * P2P_GAME_COLS),
      y: Math.floor(Math.random() * P2P_GAME_ROWS),
    };

    attempts += 1;
  } while (isP2PPositionOccupied(food, game) && attempts < maxAttempts);

  return food;
}

function moveP2PPlayer(player) {
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

function checkP2PFood(game, player) {
  if (player.x === game.food.x && player.y === game.food.y) {
    player.score += 1;

    player.body.push({
      x: player.x,
      y: player.y,
    });

    game.food = placeP2PFood(game);
  }
}

function isP2POutOfBounds(player) {
  return (
    player.x < 0 ||
    player.x >= P2P_GAME_COLS ||
    player.y < 0 ||
    player.y >= P2P_GAME_ROWS
  );
}

function isP2PSamePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isP2PHeadTouchingBody(player, body) {
  return body.some(function (part) {
    return player.x === part.x && player.y === part.y;
  });
}

function getP2PWinnerByScore(player1, player2) {
  if (player1.score > player2.score) {
    return player1.name;
  }

  if (player2.score > player1.score) {
    return player2.name;
  }

  return "Berabere";
}

function changeP2PPlayerDirection(player, direction) {
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

function checkP2PGameOver(game) {
  const player1 = game.players.player1;
  const player2 = game.players.player2;

  const player1Out = isP2POutOfBounds(player1);
  const player2Out = isP2POutOfBounds(player2);

  const headToHead = isP2PSamePosition(player1, player2);

  const player1HitSelf = isP2PHeadTouchingBody(player1, player1.body);
  const player2HitSelf = isP2PHeadTouchingBody(player2, player2.body);

  const player1HitPlayer2Body = isP2PHeadTouchingBody(player1, player2.body);

  const player2HitPlayer1Body = isP2PHeadTouchingBody(player2, player1.body);

  const anyGameOver =
    player1Out ||
    player2Out ||
    headToHead ||
    player1HitSelf ||
    player2HitSelf ||
    player1HitPlayer2Body ||
    player2HitPlayer1Body;

  if (anyGameOver) {
    game.gameOver = true;
    game.gameStarted = false;
    game.winner = getP2PWinnerByScore(player1, player2);
  }
}

function updateP2PGame(game) {
  if (!game || !game.gameStarted || game.gameOver || game.paused) {
    return game;
  }

  moveP2PPlayer(game.players.player1);
  moveP2PPlayer(game.players.player2);

  checkP2PGameOver(game);

  if (game.gameOver) {
    return game;
  }

  checkP2PFood(game, game.players.player1);
  checkP2PFood(game, game.players.player2);

  return game;
}

window.createP2PInitialGameState = createP2PInitialGameState;
window.updateP2PGame = updateP2PGame;
window.changeP2PPlayerDirection = changeP2PPlayerDirection;
