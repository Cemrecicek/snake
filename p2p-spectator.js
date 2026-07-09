console.log("[P2P SPECTATOR] p2p-spectator.js yüklendi");

let spectatorSubscription = null;
let p2pSpectatorName = "İzleyici";

const watchRoomButton = document.querySelector(".watch-room-btn");

function getP2PBridge() {
  if (!window.P2PGame) {
    console.error("[P2P SPECTATOR] window.P2PGame bulunamadı.");
    return null;
  }

  return window.P2PGame;
}

async function watchP2PRoom() {
  const p2p = getP2PBridge();
  if (!p2p) return;

  const elements = p2p.getElements();
  const roomCode = elements.roomCodeInput.value.trim().toUpperCase();
  const spectatorName = elements.multiplayerPlayerNameInput.value.trim();

  if (!spectatorName) {
    p2p.setRoomMessage("İzleyici olarak katılmak için adını gir.");
    return;
  }

  if (!roomCode) {
    p2p.setRoomMessage("İzlemek için oda kodu gir.");
    return;
  }

  p2pSpectatorName = spectatorName;

  p2p.resetConnectionOnly();
  p2p.setRole("spectator");
  p2p.setRoomCode(roomCode);

  const supabaseClient = p2p.getSupabaseClient();

  const { data: room, error } = await supabaseClient
    .from("p2p_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (error || !room) {
    console.error("[P2P SPECTATOR] İzlenecek oda bulunamadı:", error);
    p2p.setRoomMessage("İzlenecek oda bulunamadı.");
    return;
  }

  if (elements.multiplayerLobby) {
    elements.multiplayerLobby.classList.add("hidden");
  }

  if (elements.roomInfo) {
    elements.roomInfo.classList.add("hidden");
  }

  if (elements.multiplayerGameArea) {
    elements.multiplayerGameArea.classList.remove("hidden");
  }

  if (elements.multiplayerPauseButton) {
    elements.multiplayerPauseButton.classList.add("hidden");
  }

  p2p.drawWaiting();

  listenForSpectatorState(roomCode);
}

function listenForSpectatorState(roomCode) {
  const p2p = getP2PBridge();
  if (!p2p) return;

  const supabaseClient = p2p.getSupabaseClient();

  if (spectatorSubscription) {
    supabaseClient.removeChannel(spectatorSubscription);
    spectatorSubscription = null;
  }

  spectatorSubscription = supabaseClient
    .channel("p2p-spectator-" + roomCode)
    .on(
      "broadcast",
      {
        event: "state",
      },
      function (event) {
        const payload = event.payload;

        if (!payload || payload.roomCode !== roomCode || !payload.gameState) {
          return;
        }

        renderSpectatorGameState(payload.gameState);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "p2p_room_state",
        filter: "room_code=eq." + roomCode,
      },
      function (payload) {
        const row = payload.new;

        if (!row || !row.game_state) {
          return;
        }

        renderSpectatorGameState(row.game_state);
      },
    )
    .subscribe(function (status) {
      console.log("[P2P SPECTATOR] subscription status:", status);
    });

  loadInitialSpectatorState(roomCode);
}

async function loadInitialSpectatorState(roomCode) {
  const p2p = getP2PBridge();
  if (!p2p) return;

  const supabaseClient = p2p.getSupabaseClient();

  const { data, error } = await supabaseClient
    .from("p2p_room_state")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (error || !data || !data.game_state) {
    p2p.drawWaiting();
    return;
  }

  renderSpectatorGameState(data.game_state);
}

window.P2PSpectator = {
  getSpectatorName() {
    return p2pSpectatorName;
  },

  stop() {
    const p2p = getP2PBridge();
    if (!p2p) return;

    const supabaseClient = p2p.getSupabaseClient();

    if (spectatorSubscription) {
      supabaseClient.removeChannel(spectatorSubscription);
      spectatorSubscription = null;
    }
  },
};

function renderSpectatorGameState(gameState) {
  const p2p = getP2PBridge();
  if (!p2p || !gameState) return;

  p2p.setGameState(gameState);
  p2p.drawGame(gameState);

  if (gameState.gameOver) {
    p2p.showGameOver(gameState);
  }
}

if (watchRoomButton) {
  watchRoomButton.addEventListener("click", function () {
    watchP2PRoom();
  });
}
