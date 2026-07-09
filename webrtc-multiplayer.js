console.log("[P2P] webrtc-multiplayer.js yüklendi");

const P2P_SUPABASE_URL = "https://isdvdveuexfmvczaimqv.supabase.co";
const P2P_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZHZkdmV1ZXhmbXZjemFpbXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODk3ODUsImV4cCI6MjA5ODg2NTc4NX0.jMIoFy2aoXlN4YIDFxHZhS-id5NHntDOQ8VDaPXFeBw";

const p2pSupabaseClient = supabase.createClient(
  P2P_SUPABASE_URL,
  P2P_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

let peerConnection = null;
let dataChannel = null;
let currentRoomCode = null;
let myRole = null;
let roomSubscription = null;
let iceSubscription = null;
let pendingIceCandidates = [];
let p2pIntroTimer = null;

let guestAnswerPollTimer = null;
let isLeavingP2P = false;

let p2pChaosTimer = null;

let spectatorStateChannel = null;
let lastSpectatorDbPublishAt = 0;
let spectatorDbPublishInFlight = false;

let handledIceCandidateIds = new Set();

let p2pGameState = null;
let p2pGameLoop = null;
let localPlayerKey = null;
let multiplayerIntroFinished = false;

let p2pRestartVotes = {
  player1: false,
  player2: false,
};

let p2pHostName = "Oyuncu 1";
let p2pGuestName = "Oyuncu 2";

let p2pHostColorKey = "green";
let p2pGuestColorKey = "blue";
let p2pBoardThemeKey = "dark";

const backMenuButtons = document.querySelectorAll(".back-menu-btn");

backMenuButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    if (currentRoomCode && myRole) {
      isLeavingP2P = true;

      sendP2PMessage({
        type: "playerLeft",
      });

      setTimeout(function () {
        resetP2PConnectionOnly();
        isLeavingP2P = false;
      }, 150);
    }
  });
});

const multiplayerBoard = document.querySelector("#multiplayer-board");
const multiplayerContext = multiplayerBoard
  ? multiplayerBoard.getContext("2d")
  : null;

const multiplayerSnakeColorSelect = document.querySelector(
  ".multiplayer-snake-color-select",
);

const multiplayerThemeSelect = document.querySelector(
  ".multiplayer-theme-select",
);

const playerOneScoreText = document.querySelector(".player-one-score");
const playerTwoScoreText = document.querySelector(".player-two-score");

const multiplayerControlButtons = document.querySelectorAll(
  ".multiplayer-control-btn",
);

const multiplayerRestartButton = document.querySelector(
  ".multiplayer-restart-btn",
);

const multiplayerMenuButton = document.querySelector(".multiplayer-menu-btn");

const multiplayerGameOverModal = document.querySelector(
  ".multiplayer-game-over-modal",
);

const multiplayerRestartMessage = document.querySelector(
  ".multiplayer-restart-message",
);

const multiplayerPauseModal = document.querySelector(
  ".multiplayer-pause-modal",
);

const multiplayerResumeButton = document.querySelector(
  ".multiplayer-resume-btn",
);

const createRoomButton = document.querySelector(".create-room-btn");
const joinRoomButton = document.querySelector(".join-room-btn");
const roomCodeInput = document.querySelector(".room-code-input");
const multiplayerPlayerNameInput = document.querySelector(
  ".multiplayer-player-name",
);

const roomInfo = document.querySelector(".room-info");
const roomCodeText = document.querySelector(".room-code-text");
const playerCountText = document.querySelector(".player-count-text");
const roomMessageText = document.querySelector(".room-message-text");

const multiplayerLobby = document.querySelector(".multiplayer-lobby");
const multiplayerGameArea = document.querySelector(".multiplayer-game-area");
const multiplayerIntroModal = document.querySelector(
  ".multiplayer-intro-modal",
);
const multiplayerPauseButton = document.querySelector(".multiplayer-pause-btn");

function p2pLog(...args) {
  console.log("[P2P]", ...args);
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function setRoomMessage(message) {
  roomInfo.classList.remove("hidden");
  roomMessageText.textContent = message;
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  peerConnection.onicecandidate = async function (event) {
    if (!event.candidate || !currentRoomCode || !myRole) return;

    if (myRole !== "host" && myRole !== "guest") {
      return;
    }

    p2pLog("ICE candidate oluştu");

    const { error } = await p2pSupabaseClient
      .from("p2p_ice_candidates")
      .insert({
        room_code: currentRoomCode,
        sender: myRole,
        candidate: event.candidate.toJSON(),
      });

    if (error) {
      console.error("[P2P] ICE candidate kaydetme hatası:", error);
    }
  };

  peerConnection.onconnectionstatechange = function () {
    p2pLog("Connection state:", peerConnection.connectionState);
  };

  peerConnection.ondatachannel = function (event) {
    p2pLog("DataChannel karşı taraftan geldi");

    dataChannel = event.channel;
    setupDataChannel();
  };
}

function setupDataChannel() {
  dataChannel.onopen = function () {
    p2pLog("DataChannel OPEN ");

    if (playerCountText) {
      playerCountText.textContent = "Oyuncu Sayısı: 2/2";
    }

    if (roomMessageText) {
      roomMessageText.textContent = "Oyun 4 saniye içinde başlıyor...";
    }

    dataChannel.send(
      JSON.stringify({
        type: "hello",
        from: myRole,
      }),
    );

    p2pIntroTimer = setTimeout(function () {
      p2pIntroTimer = null;
      showP2PGamePlaceholder();
    }, 4000);
  };

  dataChannel.onmessage = function (event) {
    const data = JSON.parse(event.data);
    p2pLog("Mesaj geldi:", data);

    if (data.type === "hello") {
      return;
    }

    if (data.type === "direction") {
      if (myRole !== "host") {
        return;
      }

      if (!p2pGameState) {
        return;
      }

      changeP2PPlayerDirection(p2pGameState.players.player2, data.direction);

      return;
    }

    if (data.type === "gameState") {
      p2pGameState = data.gameState;
      drawP2PGame(p2pGameState);
      return;
    }

    if (data.type === "gameOver") {
      p2pGameState = data.gameState;
      drawP2PGame(p2pGameState);
      showP2PGameOver(p2pGameState);
      return;
    }
    if (data.type === "pause") {
      handleP2PPauseChanged(data.paused);
      return;
    }

    if (data.type === "restartRequest") {
      handleP2PRestartRequest(data.playerKey);
      return;
    }

    if (data.type === "restartAccepted") {
      handleP2PRestartAccepted();
      return;
    }

    if (data.type === "chaosPopup") {
      if (typeof showChaosPopup === "function") {
        showChaosPopup(data.popupIndex);
      }

      return;
    }

    if (data.type === "chaosStop") {
      stopP2PChaosPopups();

      if (typeof stopChaosPopups === "function") {
        stopChaosPopups();
      }

      return;
    }

    if (data.type === "playerLeft") {
      handleP2PPlayerLeft();
      return;
    }
  };

  dataChannel.onclose = function () {
    p2pLog("DataChannel kapandı");

    if (!isLeavingP2P && currentRoomCode && myRole) {
      handleP2PPlayerLeft();
    }
  };

  dataChannel.onerror = function (error) {
    console.error("[P2P] DataChannel hatası:", error);
  };
}

async function createP2PRoom() {
  p2pLog("createP2PRoom çalıştı");

  const playerName = multiplayerPlayerNameInput.value.trim();
  p2pHostName = playerName;
  p2pGuestName = "Oyuncu 2";

  p2pHostColorKey = multiplayerSnakeColorSelect
    ? multiplayerSnakeColorSelect.value
    : "green";

  p2pBoardThemeKey = multiplayerThemeSelect
    ? multiplayerThemeSelect.value
    : "dark";

  p2pLog("Girilen oyuncu adı:", playerName);

  if (!playerName) {
    setRoomMessage("Lütfen oyuncu adını gir.");
    return;
  }

  resetP2PConnectionOnly();

  myRole = "host";
  currentRoomCode = generateRoomCode();

  p2pLog("Oda kodu üretildi:", currentRoomCode);

  roomInfo.classList.remove("hidden");
  roomCodeText.textContent = "Oda Kodu: " + currentRoomCode;
  playerCountText.textContent = "Oyuncu Sayısı: 1/2";
  roomMessageText.textContent = "Oda Supabase'e kaydediliyor...";

  createPeerConnection();

  dataChannel = peerConnection.createDataChannel("snake-game");
  setupDataChannel();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const { error } = await p2pSupabaseClient.from("p2p_rooms").insert({
    room_code: currentRoomCode,
    host_name: playerName,
    host_offer: peerConnection.localDescription.toJSON(),
    host_color_key: p2pHostColorKey,
    board_theme_key: p2pBoardThemeKey,
    status: "waiting",
  });

  if (error) {
    console.error("[P2P] Oda oluşturma hatası:", error);
    setRoomMessage("Oda oluşturulamadı: " + error.message);
    return;
  }

  roomMessageText.textContent = "Arkadaşının katılmasını bekliyorsun...";

  p2pLog("Oda Supabase'e kaydedildi:", currentRoomCode);

  listenForGuestAnswer();
  listenForIceCandidates();
}

async function joinP2PRoom() {
  const playerName = multiplayerPlayerNameInput.value.trim();
  p2pGuestName = playerName;

  p2pGuestColorKey = multiplayerSnakeColorSelect
    ? multiplayerSnakeColorSelect.value
    : "blue";

  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!playerName) {
    setRoomMessage("Lütfen oyuncu adını gir.");
    return;
  }

  if (!roomCode) {
    setRoomMessage("Lütfen oda kodu gir.");
    return;
  }

  resetP2PConnectionOnly();

  myRole = "guest";
  currentRoomCode = roomCode;

  const { data: room, error } = await p2pSupabaseClient
    .from("p2p_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (error || !room) {
    console.error("[P2P] Oda bulunamadı:", error);
    setRoomMessage("Oda bulunamadı.");
    return;
  }

  p2pHostName = room.host_name || "Oyuncu 1";
  p2pHostColorKey = room.host_color_key || "green";
  p2pBoardThemeKey = room.board_theme_key || "dark";

  createPeerConnection();

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(room.host_offer),
  );

  await flushPendingIceCandidates();

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const { error: updateError } = await p2pSupabaseClient
    .from("p2p_rooms")
    .update({
      guest_name: playerName,
      guest_color_key: p2pGuestColorKey,
      guest_answer: peerConnection.localDescription.toJSON(),
      status: "connected",
    })
    .eq("room_code", roomCode);

  if (updateError) {
    console.error("[P2P] Answer kaydetme hatası:", updateError);
    setRoomMessage("Odaya katılırken hata oluştu.");
    return;
  }

  roomInfo.classList.remove("hidden");
  roomCodeText.textContent = "Oda Kodu: " + roomCode;
  playerCountText.textContent = "Oyuncu Sayısı: 2/2";
  roomMessageText.textContent = "P2P bağlantı kuruluyor...";

  p2pLog("Odaya katıldın:", roomCode);

  listenForIceCandidates();
}

function listenForGuestAnswer() {
  async function checkGuestAnswerNow() {
    const { data: room, error } = await p2pSupabaseClient
      .from("p2p_rooms")
      .select("*")
      .eq("room_code", currentRoomCode)
      .single();

    if (error) {
      console.error("[P2P] Guest answer kontrol hatası:", error);
      return;
    }

    await handleGuestAnswer(room);
  }

  roomSubscription = p2pSupabaseClient
    .channel("p2p-room-" + currentRoomCode)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "p2p_rooms",
        filter: "room_code=eq." + currentRoomCode,
      },
      async function (payload) {
        p2pLog("Oda UPDATE geldi:", payload.new);
        await handleGuestAnswer(payload.new);
      },
    )
    .subscribe(function (status) {
      p2pLog("Room subscription status:", status);
    });

  checkGuestAnswerNow();

  guestAnswerPollTimer = setInterval(function () {
    checkGuestAnswerNow();
  }, 1000);
}

async function handleGuestAnswer(room) {
  if (!room || !room.guest_answer) return;

  p2pGuestName = room.guest_name || "Oyuncu 2";
  p2pGuestColorKey = room.guest_color_key || "blue";

  p2pHostName = room.host_name || p2pHostName || "Oyuncu 1";
  p2pHostColorKey = room.host_color_key || p2pHostColorKey || "green";
  p2pBoardThemeKey = room.board_theme_key || p2pBoardThemeKey || "dark";

  p2pLog("Guest answer işleniyor:", room);

  if (playerCountText) {
    playerCountText.textContent = "Oyuncu Sayısı: 2/2";
  }

  if (roomMessageText) {
    roomMessageText.textContent = "İkinci oyuncu katıldı. Bağlanıyor...";
  }

  if (!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(room.guest_answer),
    );

    await flushPendingIceCandidates();
  }

  if (guestAnswerPollTimer) {
    clearInterval(guestAnswerPollTimer);
    guestAnswerPollTimer = null;
  }
}

async function handleRemoteIceCandidate(item) {
  if (!item) return;
  if (item.sender === myRole) return;

  if (item.id && handledIceCandidateIds.has(item.id)) {
    return;
  }

  if (item.id) {
    handledIceCandidateIds.add(item.id);
  }

  p2pLog("Karşı taraftan ICE candidate işleniyor");

  try {
    if (!peerConnection.remoteDescription) {
      p2pLog("Remote description yok, ICE candidate beklemeye alındı");
      pendingIceCandidates.push(item.candidate);
      return;
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(item.candidate));
    p2pLog("ICE candidate eklendi");
  } catch (error) {
    console.error("[P2P] ICE candidate ekleme hatası:", error);
  }
}

function listenForIceCandidates() {
  iceSubscription = p2pSupabaseClient
    .channel("p2p-ice-" + currentRoomCode + "-" + myRole)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "p2p_ice_candidates",
        filter: "room_code=eq." + currentRoomCode,
      },
      async function (payload) {
        await handleRemoteIceCandidate(payload.new);
      },
    )
    .subscribe(async function (status) {
      p2pLog("ICE subscription status:", status);

      if (status === "SUBSCRIBED") {
        const { data: candidates, error } = await p2pSupabaseClient
          .from("p2p_ice_candidates")
          .select("*")
          .eq("room_code", currentRoomCode)
          .neq("sender", myRole);

        if (error) {
          console.error("[P2P] ICE candidate listesi okunamadı:", error);
          return;
        }

        for (const candidate of candidates || []) {
          await handleRemoteIceCandidate(candidate);
        }
      }
    });
}

async function flushPendingIceCandidates() {
  if (!peerConnection || !peerConnection.remoteDescription) {
    return;
  }

  while (pendingIceCandidates.length > 0) {
    const candidate = pendingIceCandidates.shift();

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

      p2pLog("Bekleyen ICE candidate eklendi");
    } catch (error) {
      console.error("[P2P] Bekleyen ICE candidate ekleme hatası:", error);
    }
  }
}

function showP2PGamePlaceholder() {
  if (multiplayerIntroModal) {
    multiplayerIntroModal.classList.add("hidden");
  }

  if (multiplayerLobby) {
    multiplayerLobby.classList.add("hidden");
  }

  if (roomInfo) {
    roomInfo.classList.add("hidden");
  }

  if (multiplayerGameArea) {
    multiplayerGameArea.classList.remove("hidden");
  }

  if (multiplayerPauseButton) {
    multiplayerPauseButton.classList.remove("hidden");
    multiplayerPauseButton.textContent = "Pause";
  }

  console.log("[P2P] Oyun alanı açıldı, P2P oyun başlatılıyor.");

  startP2PGame();
  startP2PChaosPopups();
}

function startP2PGame() {
  console.log("[P2P] startP2PGame çalıştı", {
    myRole,
    multiplayerBoard,
    multiplayerContext,
  });

  if (!multiplayerBoard || !multiplayerContext) {
    console.error("[P2P] Multiplayer canvas bulunamadı!");
    return;
  }

  multiplayerIntroFinished = true;
  localPlayerKey = myRole === "host" ? "player1" : "player2";

  if (myRole === "host") {
    startP2PHostGame();
  } else {
    if (p2pGameState) {
      drawP2PGame(p2pGameState);
    } else {
      drawP2PWaitingScreen();
    }
  }
}

function startP2PHostGame() {
  if (p2pGameLoop) {
    clearInterval(p2pGameLoop);
    p2pGameLoop = null;
  }

  p2pHostName =
    multiplayerPlayerNameInput.value.trim() || p2pHostName || "Oyuncu 1";

  p2pHostColorKey = p2pHostColorKey || "green";
  p2pGuestColorKey = p2pGuestColorKey || "blue";
  p2pBoardThemeKey = p2pBoardThemeKey || "dark";

  p2pGameState = createP2PInitialGameState({
    player1Name: p2pHostName,
    player2Name: p2pGuestName,
    player1ColorKey: p2pHostColorKey,
    player2ColorKey: p2pGuestColorKey,
    boardTheme: p2pBoardThemeKey,
  });
  p2pGameState.gameStarted = true;

  drawP2PGame(p2pGameState);

  sendP2PMessage({
    type: "gameState",
    gameState: p2pGameState,
  });

  publishSpectatorGameState(true);

  let spectatorPublishTick = 0;

  p2pGameLoop = setInterval(function () {
    if (!p2pGameState || p2pGameState.gameOver) {
      clearInterval(p2pGameLoop);
      p2pGameLoop = null;
      return;
    }

    p2pGameState = updateP2PGame(p2pGameState);

    drawP2PGame(p2pGameState);

    sendP2PMessage({
      type: "gameState",
      gameState: p2pGameState,
    });

    publishSpectatorGameState();

    if (p2pGameState.gameOver) {
      sendP2PMessage({
        type: "gameOver",
        gameState: p2pGameState,
      });
      publishSpectatorGameState(true);

      showP2PGameOver(p2pGameState);

      clearInterval(p2pGameLoop);
      p2pGameLoop = null;
    }
  }, 150);
}
function getSpectatorStateChannel() {
  if (!currentRoomCode) {
    return null;
  }

  if (spectatorStateChannel) {
    return spectatorStateChannel;
  }

  spectatorStateChannel = p2pSupabaseClient.channel(
    "p2p-spectator-" + currentRoomCode,
    {
      config: {
        broadcast: {
          self: false,
        },
      },
    },
  );

  spectatorStateChannel.subscribe(function (status) {
    p2pLog("Spectator broadcast channel status:", status);
  });

  return spectatorStateChannel;
}

async function publishSpectatorGameState(forceDbSave) {
  if (myRole !== "host") return;
  if (!currentRoomCode || !p2pGameState) return;

  const stateSnapshot = JSON.parse(JSON.stringify(p2pGameState));
  const status = stateSnapshot.gameOver ? "game_over" : "playing";

  const channel = getSpectatorStateChannel();

  if (channel) {
    channel.send({
      type: "broadcast",
      event: "state",
      payload: {
        roomCode: currentRoomCode,
        gameState: stateSnapshot,
        status: status,
      },
    });
  }

  const now = Date.now();

  if (!forceDbSave && now - lastSpectatorDbPublishAt < 2000) {
    return;
  }

  if (spectatorDbPublishInFlight) {
    return;
  }

  spectatorDbPublishInFlight = true;
  lastSpectatorDbPublishAt = now;

  const { error } = await p2pSupabaseClient.from("p2p_room_state").upsert(
    {
      room_code: currentRoomCode,
      game_state: stateSnapshot,
      status: status,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "room_code",
    },
  );

  spectatorDbPublishInFlight = false;

  if (error) {
    console.error("[P2P] İzleyici state DB publish hatası:", error);
  }
}

function sendP2PMessage(message) {
  if (!dataChannel || dataChannel.readyState !== "open") {
    return;
  }

  dataChannel.send(JSON.stringify(message));
}

function drawP2PWaitingScreen() {
  if (!multiplayerBoard || !multiplayerContext) {
    return;
  }

  multiplayerBoard.width = 36 * 24;
  multiplayerBoard.height = 24 * 24;

  multiplayerContext.fillStyle = "black";
  multiplayerContext.fillRect(
    0,
    0,
    multiplayerBoard.width,
    multiplayerBoard.height,
  );

  multiplayerContext.fillStyle = "white";
  multiplayerContext.font = "20px Courier New";
  multiplayerContext.textAlign = "center";
  multiplayerContext.fillText(
    "Host oyun durumunu bekleniyor...",
    multiplayerBoard.width / 2,
    multiplayerBoard.height / 2,
  );
}

function drawP2PGame(game) {
  if (!game || !multiplayerBoard || !multiplayerContext) {
    console.error("[P2P] drawP2PGame çalışamadı:", {
      game,
      multiplayerBoard,
      multiplayerContext,
    });
    return;
  }

  multiplayerBoard.width = game.cols * game.blockSize;
  multiplayerBoard.height = game.rows * game.blockSize;

  const selectedTheme = game.boardTheme || {
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
    game.food.x * game.blockSize,
    game.food.y * game.blockSize,
    game.blockSize,
    game.blockSize,
  );

  drawP2PPlayer(game.players.player1, game.blockSize);
  drawP2PPlayer(game.players.player2, game.blockSize);

  if (playerOneScoreText) {
    playerOneScoreText.textContent =
      game.players.player1.name + ": " + game.players.player1.score;
  }

  if (playerTwoScoreText) {
    playerTwoScoreText.textContent =
      game.players.player2.name + ": " + game.players.player2.score;
  }
}

function drawP2PPlayer(player, blockSize) {
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

function showP2PGameOver(game) {
  stopP2PChaosPopups();

  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }
  const multiplayerGameOverModal = document.querySelector(
    ".multiplayer-game-over-modal",
  );

  const multiplayerWinnerText = document.querySelector(
    ".multiplayer-winner-text",
  );

  const multiplayerFinalScoreOne = document.querySelector(
    ".multiplayer-final-score-one",
  );

  const multiplayerFinalScoreTwo = document.querySelector(
    ".multiplayer-final-score-two",
  );

  if (multiplayerPauseButton) {
    multiplayerPauseButton.classList.add("hidden");
  }

  if (multiplayerWinnerText) {
    multiplayerWinnerText.textContent = "Kazanan: " + game.winner;
  }

  if (multiplayerFinalScoreOne) {
    multiplayerFinalScoreOne.textContent =
      game.players.player1.name + ": " + game.players.player1.score;
  }

  if (multiplayerFinalScoreTwo) {
    multiplayerFinalScoreTwo.textContent =
      game.players.player2.name + ": " + game.players.player2.score;
  }

  if (multiplayerGameOverModal) {
    multiplayerGameOverModal.classList.remove("hidden");
  }
}

function startP2PChaosPopups() {
  stopP2PChaosPopups();

  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }


  if (myRole !== "host") {
    return;
  }

  scheduleNextP2PChaosPopup();
}

function scheduleNextP2PChaosPopup() {
  stopP2PChaosPopups();

  if (
    !multiplayerIntroFinished ||
    !p2pGameState ||
    p2pGameState.gameOver ||
    p2pGameState.paused
  ) {
    return;
  }

  const scoreTotal =
    p2pGameState.players.player1.score + p2pGameState.players.player2.score;

  const minDelay = Math.max(2500, 4500 - scoreTotal * 200);
  const maxDelay = Math.max(4000, 7000 - scoreTotal * 250);

  const delay = Math.floor(
    Math.random() * (maxDelay - minDelay + 1) + minDelay,
  );

  p2pChaosTimer = setTimeout(function () {
    p2pChaosTimer = null;

    triggerP2PChaosPopup();

    scheduleNextP2PChaosPopup();
  }, delay);
}

function triggerP2PChaosPopup() {
  if (
    !multiplayerIntroFinished ||
    !p2pGameState ||
    p2pGameState.gameOver ||
    p2pGameState.paused
  ) {
    return;
  }

  let popupIndex = null;

  if (typeof getRandomChaosPopupIndex === "function") {
    popupIndex = getRandomChaosPopupIndex();
  }

  if (typeof showChaosPopup === "function") {
    showChaosPopup(popupIndex);
  }

  sendP2PMessage({
    type: "chaosPopup",
    popupIndex: popupIndex,
  });
}

function stopP2PChaosPopups() {
  if (p2pChaosTimer) {
    clearTimeout(p2pChaosTimer);
    p2pChaosTimer = null;
  }
}

function leaveP2PGame() {
  isLeavingP2P = true;

  sendP2PMessage({
    type: "playerLeft",
  });

  setTimeout(function () {
    resetMultiplayerToMenu();

    if (typeof showScreen === "function") {
      showScreen("menu-screen");
    }

    isLeavingP2P = false;
  }, 150);
}

function handleP2PPlayerLeft() {
  isLeavingP2P = true;

  resetMultiplayerToMenu();

  roomInfo.classList.remove("hidden");
  roomCodeText.textContent = "Oda Kodu: -";
  playerCountText.textContent = "Oyuncu Sayısı: 0/2";
  roomMessageText.textContent = "Diğer oyuncu ayrıldı.";

  isLeavingP2P = false;
}

function toggleP2PPause() {
  if (myRole === "spectator") {
    return;
  }
  if (!multiplayerIntroFinished || !p2pGameState || p2pGameState.gameOver) {
    return;
  }

  const nextPaused = !p2pGameState.paused;

  handleP2PPauseChanged(nextPaused);

  sendP2PMessage({
    type: "pause",
    paused: nextPaused,
  });
}

function handleP2PPauseChanged(paused) {
  if (p2pGameState) {
    p2pGameState.paused = paused;
  }

  if (multiplayerPauseButton) {
    multiplayerPauseButton.textContent = paused ? "Devam" : "Pause";
  }

  if (multiplayerPauseModal) {
    if (paused) {
      multiplayerPauseModal.classList.remove("hidden");
    } else {
      multiplayerPauseModal.classList.add("hidden");
    }
  }

  if (paused) {
    stopP2PChaosPopups();

    if (typeof hideChaosPopup === "function") {
      hideChaosPopup();
    }
  } else {
    startP2PChaosPopups();
  }
}

function requestP2PRestart() {
  if (myRole === "spectator") {
    return;
  }
  if (!localPlayerKey) {
    return;
  }

  if (multiplayerRestartButton) {
    multiplayerRestartButton.disabled = true;
  }

  if (multiplayerRestartMessage) {
    multiplayerRestartMessage.textContent =
      "Tekrar oyun isteğin gönderildi. Diğer oyuncu bekleniyor...";
  }

  handleP2PRestartRequest(localPlayerKey);

  sendP2PMessage({
    type: "restartRequest",
    playerKey: localPlayerKey,
  });
}

function handleP2PRestartRequest(playerKey) {
  if (!playerKey) {
    return;
  }

  p2pRestartVotes[playerKey] = true;

  if (multiplayerRestartMessage) {
    multiplayerRestartMessage.textContent =
      "Tekrar başlamak için iki oyuncu da onaylamalı.";
  }

  if (myRole !== "host") {
    return;
  }

  if (p2pRestartVotes.player1 && p2pRestartVotes.player2) {
    sendP2PMessage({
      type: "restartAccepted",
    });

    handleP2PRestartAccepted();
  }
}

function handleP2PRestartAccepted() {
  p2pGameState = null;

  p2pRestartVotes = {
    player1: false,
    player2: false,
  };

  if (multiplayerGameOverModal) {
    multiplayerGameOverModal.classList.add("hidden");
  }

  if (multiplayerRestartButton) {
    multiplayerRestartButton.disabled = false;
  }

  if (multiplayerRestartMessage) {
    multiplayerRestartMessage.textContent = "";
  }

  if (multiplayerPauseButton) {
    multiplayerPauseButton.classList.remove("hidden");
    multiplayerPauseButton.textContent = "Pause";
  }

  if (myRole === "host") {
    startP2PHostGame();
  } else {
    drawP2PWaitingScreen();
  }
}

function resetP2PConnectionOnly() {
  if (window.P2PSpectator && typeof window.P2PSpectator.stop === "function") {
    window.P2PSpectator.stop();
  }
  stopP2PChaosPopups();

  if (typeof stopChaosPopups === "function") {
    stopChaosPopups();
  }

  handledIceCandidateIds = new Set();
  if (p2pGameLoop) {
    clearInterval(p2pGameLoop);
    p2pGameLoop = null;
  }

  p2pRestartVotes = {
    player1: false,
    player2: false,
  };

  p2pGameState = null;
  localPlayerKey = null;
  multiplayerIntroFinished = false;

  if (p2pIntroTimer) {
    clearTimeout(p2pIntroTimer);
    p2pIntroTimer = null;
  }

  if (guestAnswerPollTimer) {
    clearInterval(guestAnswerPollTimer);
    guestAnswerPollTimer = null;
  }

  pendingIceCandidates = [];

  if (roomSubscription) {
    p2pSupabaseClient.removeChannel(roomSubscription);
    roomSubscription = null;
  }

  if (iceSubscription) {
    p2pSupabaseClient.removeChannel(iceSubscription);
    iceSubscription = null;
  }

  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (spectatorStateChannel) {
    p2pSupabaseClient.removeChannel(spectatorStateChannel);
    spectatorStateChannel = null;
  }

  lastSpectatorDbPublishAt = 0;
  spectatorDbPublishInFlight = false;

  if (multiplayerGameOverModal) {
    multiplayerGameOverModal.classList.add("hidden");
  }

  if (multiplayerPauseModal) {
    multiplayerPauseModal.classList.add("hidden");
  }

  if (multiplayerRestartButton) {
    multiplayerRestartButton.disabled = false;
  }

  if (multiplayerRestartMessage) {
    multiplayerRestartMessage.textContent = "";
  }
}

document.addEventListener("keydown", function (e) {
  if (e.code === "ArrowUp" || e.key === "w" || e.key === "W") {
    sendP2PDirection("up");
  } else if (e.code === "ArrowDown" || e.key === "s" || e.key === "S") {
    sendP2PDirection("down");
  } else if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") {
    sendP2PDirection("left");
  } else if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") {
    sendP2PDirection("right");
  }
});

multiplayerControlButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    sendP2PDirection(button.dataset.direction);
  });

  button.addEventListener("touchstart", function (e) {
    e.preventDefault();
    sendP2PDirection(button.dataset.direction);
  });
});

function sendP2PDirection(direction) {
  if (myRole === "spectator") {
    return;
  }

  if (!multiplayerIntroFinished) {
    return;
  }

  if (myRole === "host") {
    if (!p2pGameState) {
      return;
    }

    changeP2PPlayerDirection(p2pGameState.players.player1, direction);

    return;
  }

  sendP2PMessage({
    type: "direction",
    direction: direction,
  });
}

function resetMultiplayerToMenu() {
  isLeavingP2P = true;

  resetP2PConnectionOnly();

  currentRoomCode = null;
  myRole = null;

  p2pHostName = "Oyuncu 1";
  p2pGuestName = "Oyuncu 2";
  p2pHostColorKey = "green";
  p2pGuestColorKey = "blue";
  p2pBoardThemeKey = "dark";

  if (multiplayerPauseButton) {
    multiplayerPauseButton.classList.add("hidden");
    multiplayerPauseButton.textContent = "Pause";
  }

  if (multiplayerIntroModal) {
    multiplayerIntroModal.classList.add("hidden");
  }

  if (roomInfo) {
    roomInfo.classList.add("hidden");
    roomCodeText.textContent = "Oda Kodu: -";
    playerCountText.textContent = "Oyuncu Sayısı: 0/2";
    roomMessageText.textContent = "Oda bekleniyor...";
  }

  if (multiplayerLobby) {
    multiplayerLobby.classList.remove("hidden");
  }

  if (multiplayerGameArea) {
    multiplayerGameArea.classList.add("hidden");
  }

  setTimeout(function () {
    isLeavingP2P = false;
  }, 200);
}

console.log("[P2P] createRoomButton:", createRoomButton);
console.log("[P2P] joinRoomButton:", joinRoomButton);

if (createRoomButton) {
  createRoomButton.addEventListener("click", function () {
    console.log("[P2P] Oda Oluştur butonuna basıldı");
    createP2PRoom();
  });
} else {
  console.error("[P2P] .create-room-btn bulunamadı!");
}

if (joinRoomButton) {
  joinRoomButton.addEventListener("click", function () {
    console.log("[P2P] Odaya Katıl butonuna basıldı");
    joinP2PRoom();
  });
} else {
  console.error("[P2P] .join-room-btn bulunamadı!");
}
if (multiplayerPauseButton) {
  multiplayerPauseButton.addEventListener("click", function () {
    toggleP2PPause();
  });
}

if (multiplayerResumeButton) {
  multiplayerResumeButton.addEventListener("click", function () {
    handleP2PPauseChanged(false);

    sendP2PMessage({
      type: "pause",
      paused: false,
    });
  });
}

if (multiplayerMenuButton) {
  multiplayerMenuButton.addEventListener("click", function () {
    leaveP2PGame();
  });
}
if (multiplayerRestartButton) {
  multiplayerRestartButton.addEventListener("click", function () {
    requestP2PRestart();
  });
}

window.resetMultiplayerToMenu = resetMultiplayerToMenu;

window.addEventListener("beforeunload", function () {
  if (
    currentRoomCode &&
    myRole &&
    dataChannel &&
    dataChannel.readyState === "open"
  ) {
    sendP2PMessage({
      type: "playerLeft",
    });
  }
});

window.P2PGame = {
  getState() {
    return {
      currentRoomCode,
      myRole,
      p2pGameState,
      p2pHostName,
      p2pGuestName,
      p2pHostColorKey,
      p2pGuestColorKey,
      p2pBoardThemeKey,
      multiplayerIntroFinished,
    };
  },

  setRole(role) {
    myRole = role;
  },

  setRoomCode(roomCode) {
    currentRoomCode = roomCode;
  },

  setGameState(gameState) {
    p2pGameState = gameState;
  },

  setSpectatorName(name) {
    window.p2pSpectatorName = name;
  },

  drawGame(gameState) {
    drawP2PGame(gameState);
  },

  drawWaiting() {
    drawP2PWaitingScreen();
  },

  showGameOver(gameState) {
    showP2PGameOver(gameState);
  },

  resetConnectionOnly() {
    resetP2PConnectionOnly();
  },

  resetToMenu() {
    resetMultiplayerToMenu();
  },

  setRoomMessage(message) {
    setRoomMessage(message);
  },

  getSupabaseClient() {
    return p2pSupabaseClient;
  },

  getElements() {
    return {
      roomCodeInput,
      multiplayerPlayerNameInput,
      multiplayerLobby,
      multiplayerGameArea,
      multiplayerPauseButton,
      roomInfo,
      roomCodeText,
      playerCountText,
      roomMessageText,
    };
  },
};
