function showScreen(screenClassName) {
  var screens = document.querySelectorAll(".screen");

  screens.forEach(function (screen) {
    screen.classList.add("hidden");
  });

  var activeScreen = document.querySelector("." + screenClassName);

  if (activeScreen) {
    activeScreen.classList.remove("hidden");
  }
}

window.addEventListener("load", function () {
  var singlePlayerButton = document.querySelector(".single-player-btn");
  var multiplayerButton = document.querySelector(".multiplayer-btn");
  var backMenuButtons = document.querySelectorAll(".back-menu-btn");

  if (singlePlayerButton) {
    singlePlayerButton.addEventListener("click", function () {
      showScreen("single-player-screen");

      if (typeof startGame === "function") {
        startGame();
      }
    });
  }

  if (multiplayerButton) {
    multiplayerButton.addEventListener("click", function () {
      if (typeof resetMultiplayerToMenu === "function") {
        resetMultiplayerToMenu();
      }

      showScreen("multiplayer-screen");
    });
  }

  backMenuButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      if (typeof resetSinglePlayerToMenu === "function") {
        resetSinglePlayerToMenu();
      }

      if (typeof resetMultiplayerToMenu === "function") {
        resetMultiplayerToMenu();
      }

      showScreen("menu-screen");
    });
  });
});
