// chaos-popups.js
console.log("chaos-popups.js yüklendi");

const CHAOS_DEBUG = true;

function chaosLog(...args) {
  if (CHAOS_DEBUG) {
    console.log("[CHAOS POPUP]", ...args);
  }
}

const popupMessages = [
  {
    title: "Kapat Devam",
    text: "Kapatırsan devam eder. Devam edersen kapanır. Mantıklı mı? Hayır.",
    correctText: "Kapat",
    wrongText: "Devam",
  },
  {
    title: "Yılan KVKK",
    text: "Yılanın kuyruk verilerini saçma amaçlarla işlememize izin veriyor musun?",
    correctText: "İzin Ver",
    wrongText: "Kuyruğuma Dokunma",
  },
  {
    title: "Acil Elma Uyarısı",
    text: "Bu elma duygusal olarak hazır olmayabilir.",
    correctText: "Yine de Ye",
    wrongText: "Elmayı Dinle",
  },
  {
    title: "Captcha",
    text: "Robot olmadığını kanıtla: Yılanın bacağı kaç tanedir?",
    correctText: "Yoktur",
    wrongText: "Düşünüyorum",
  },
  {
    title: "Kritik Karar",
    text: "Bu popup kapanmak istemiyor. Duygularını incitmeden kapat.",
    correctText: "Nazikçe Kapat",
    wrongText: "Trip At",
  },
];

function getRandomChaosPopupIndex() {
  return Math.floor(Math.random() * popupMessages.length);
}

let chaosPopupActive = false;
let chaosPopupTimeout = null;
let chaosPopupSpawnTimeout = null;

function createChaosPopupUI() {
  chaosLog("createChaosPopupUI çağrıldı");

  if (document.querySelector(".chaos-popup")) {
    chaosLog("UI zaten var, tekrar oluşturulmadı");
    return;
  }

  const popup = document.createElement("div");
  popup.className = "chaos-popup hidden";

  popup.innerHTML = `
    <div class="chaos-popup-content">
      <h2 class="chaos-popup-title">Sistem Uyarısı</h2>
      <p class="chaos-popup-text">Devam etmek için gereksiz yere devam et.</p>

      <div class="chaos-popup-actions">
        <button class="chaos-popup-wrong">Kapat</button>
        <button class="chaos-popup-correct">Devam</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  chaosLog("UI oluşturuldu:", popup);
}

function getChaosElements() {
  return {
    popup: document.querySelector(".chaos-popup"),
    title: document.querySelector(".chaos-popup-title"),
    text: document.querySelector(".chaos-popup-text"),
    correct: document.querySelector(".chaos-popup-correct"),
    wrong: document.querySelector(".chaos-popup-wrong"),
    actions: document.querySelector(".chaos-popup-actions"),
  };
}

function setupChaosPopupButtons() {
  chaosLog("setupChaosPopupButtons çağrıldı");

  createChaosPopupUI();

  const elements = getChaosElements();

  if (!elements.correct || !elements.wrong) {
    chaosLog("Butonlar bulunamadı!");
    return;
  }

  elements.correct.addEventListener("click", () => {
    chaosLog("Doğru butona basıldı");
    hideChaosPopup();
  });

  elements.wrong.addEventListener("click", () => {
    chaosLog("Yanlış butona basıldı");
    hideChaosPopup();
    applyChaosPenalty();
  });

  chaosLog("Buton eventleri bağlandı");
}

function showChaosPopup(forcedIndex) {
  chaosLog("showChaosPopup çağrıldı", {
    gameOver: window.gameOver,
    chaosPopupActive,
    forcedIndex,
  });

  if (!isChaosPopupAllowed()) {
    return;
  }

  if (chaosPopupActive) {
    chaosLog("Popup engellendi: zaten aktif");
    return;
  }

  createChaosPopupUI();

  const elements = getChaosElements();

  if (!elements.popup) {
    chaosLog("Popup elementi bulunamadı!");
    return;
  }

  chaosPopupActive = true;

  const popupIndex =
    typeof forcedIndex === "number" ? forcedIndex : getRandomChaosPopupIndex();

  const data = popupMessages[popupIndex];

  chaosLog("Seçilen popup:", data);

  elements.title.textContent = data.title;
  elements.text.textContent = data.text;
  elements.correct.textContent = data.correctText;
  elements.wrong.textContent = data.wrongText;

  if (Math.random() < 0.5) {
    elements.actions.appendChild(elements.correct);
    elements.actions.appendChild(elements.wrong);
  } else {
    elements.actions.appendChild(elements.wrong);
    elements.actions.appendChild(elements.correct);
  }

  elements.popup.classList.remove("hidden");

  if (typeof window.slowDownSingleSnake === "function") {
    window.slowDownSingleSnake();
  }

  chaosLog("Popup gösterildi. Class list:", elements.popup.className);

  chaosPopupTimeout = setTimeout(() => {
    chaosLog("Popup süresi doldu, ceza uygulanacak");
    hideChaosPopup();
    applyChaosPenalty();
  }, 4000);
}

function hideChaosPopup() {
  chaosLog("hideChaosPopup çağrıldı");

  const elements = getChaosElements();
  if (!elements.popup) {
    chaosLog("Kapatılacak popup bulunamadı");
    return;
  }

  elements.popup.classList.add("hidden");
  chaosPopupActive = false;

  if (typeof window.restoreSingleSnakeSpeed === "function") {
    window.restoreSingleSnakeSpeed();
  }

  clearTimeout(chaosPopupTimeout);
  chaosPopupTimeout = null;

  chaosLog("Popup gizlendi");
}

function applyChaosPenalty() {
  if (typeof window.count === "number") {
    window.count = Math.max(0, window.count - 1);
  }

  const scoreElement = document.querySelector(".skor");
  if (scoreElement && typeof window.count === "number") {
    scoreElement.textContent = "Skor: " + window.count;
  }
}

function scheduleNextChaosPopup() {
  chaosLog("scheduleNextChaosPopup çağrıldı", {
    gameOver: window.gameOver,
    count: window.count,
  });

  clearTimeout(chaosPopupSpawnTimeout);

  if (!isChaosPopupAllowed()) {
    chaosLog("Spawner durdu: aktif oyun alanı yok");
    return;
  }

  const score = typeof window.count === "number" ? window.count : 0;

  const minDelay = Math.max(2500, 4500 - score * 200);
  const maxDelay = Math.max(4000, 7000 - score * 250);
  const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

  chaosLog(`Yeni popup ${delay}ms sonra denenecek`, {
    score,
    minDelay,
    maxDelay,
  });

  chaosPopupSpawnTimeout = setTimeout(() => {
    chaosLog("Spawner zamanı geldi, popup gösterilecek");
    showChaosPopup();
    scheduleNextChaosPopup();
  }, delay);
}

function isChaosPopupAllowed() {
  const singleGameArea = document.querySelector(".single-game-area");
  const multiplayerGameArea = document.querySelector(".multiplayer-game-area");

  const isSinglePlaying =
    singleGameArea && !singleGameArea.classList.contains("hidden");

  const isMultiplayerPlaying =
    multiplayerGameArea && !multiplayerGameArea.classList.contains("hidden");

  if (!isSinglePlaying && !isMultiplayerPlaying) {
    chaosLog("Popup engellendi: aktif oyun alanı yok");
    return false;
  }

  return true;
}

function stopChaosPopups() {
  hideChaosPopup();

  clearTimeout(chaosPopupSpawnTimeout);
  chaosPopupSpawnTimeout = null;
}

document.addEventListener("DOMContentLoaded", () => {
  chaosLog("DOM hazır, chaos popup setup başlıyor");
  setupChaosPopupButtons();
});

// snake.js içinden kullanmak için dışarı açıyoruz
window.setupChaosPopupButtons = setupChaosPopupButtons;
window.scheduleNextChaosPopup = scheduleNextChaosPopup;
window.stopChaosPopups = stopChaosPopups;
window.showChaosPopup = showChaosPopup;
window.hideChaosPopup = hideChaosPopup;
window.getRandomChaosPopupIndex = getRandomChaosPopupIndex;
