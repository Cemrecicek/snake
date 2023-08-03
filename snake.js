
//board
var blockSize = 25
var rows = 21
var cols = 21
var board
var context


//yılanın başlangıcı

var snakeX = blockSize * 10
var snakeY = blockSize * 10

var velocityX = 0
var velocityY = 0

var snakeBody = []

var count = 0


//elma

var elmaX
var elmaY

//oyun bitim kontrol fonksiyonu
var gameOver = false

//elmanın koordinatları için fonksiyon
function placeFood() {
    elmaX = Math.floor(Math.random() * cols) * blockSize
    elmaY = Math.floor(Math.random() * rows) * blockSize

}

//içerikleri oluşturalım

function update() {

    // oyunun bitme durumunu kontrol edelim
    if (gameOver) {
        return
    }


    context.fillStyle = "black"
    context.fillRect(0, 0, board.width, board.height)

    context.fillStyle = "red"
    context.fillRect(elmaX, elmaY, blockSize, blockSize)


    //Yılanın elmayı yediğini kontrol edelim
    if (snakeX == elmaX && snakeY == elmaY) {
        snakeBody.push([elmaX, elmaY])
        placeFood()
        count++
        var h2Element = document.querySelector('.skor');
        h2Element.textContent = 'Skor: ' + count;

    }

    for (let i = snakeBody.length - 1; i > 0; i--) {
        snakeBody[i] = snakeBody[i - 1]
    }

    if (snakeBody.length) {
        snakeBody[0] = [snakeX, snakeY]
    }

    context.fillStyle = "chartreuse"
    snakeX += velocityX * blockSize
    snakeY += velocityY * blockSize
    context.fillRect(snakeX, snakeY, blockSize, blockSize)

    for (let i = 0; i < snakeBody.length; i++) {
        context.fillRect(snakeBody[i][0], snakeBody[i][1], blockSize, blockSize)
    }



    //oyunun sonlanma durumları
    if (snakeX < 0 || snakeX > cols * blockSize || snakeY < 0 || snakeY > blockSize * rows) {
        gameOver = true
        alert("Oyununuz bitti")
    }

    for (let i = 0; i < snakeBody.length; i++) {
        if (snakeX == snakeBody[i][0] && snakeY == snakeBody[i][1]) {
            gameOver = true
            alert("oyununuz bitti")
        }
    }



}
// Oyunu başlatan fonksiyon
function startGame() {
    // Oyunun durumunu sıfırla
    gameOver = false;
    snakeX = blockSize * 10;
    snakeY = blockSize * 10;
    velocityX = 0;
    velocityY = 0;
    snakeBody = [];
    count = 0;
    placeFood();

    // Skor alanını sıfırla
    var h2Element = document.querySelector(".skor");
    h2Element.textContent = "Skor: " + count;
}


//foksiyonumuz

window.onload = function () {
    board = document.getElementById("board")
    board.height = rows * blockSize
    board.width = cols * blockSize
    context = board.getContext("2d")

    placeFood()
    document.addEventListener("keyup", changeDirection)
    var baslatButton = document.querySelector(".baslat");
    baslatButton.addEventListener("click", startGame);
    setInterval(update, 1000 / 10)
}

function changeDirection(e) {
    if (e.code == "ArrowUp" && velocityY != 1) {
        velocityX = 0
        velocityY = -1
    }
    else if (e.code == "ArrowDown" && velocityY != -1) {
        velocityX = 0
        velocityY = 1
    }
    else if (e.code == "ArrowLeft" && velocityX != 1) {
        velocityX = -1
        velocityY = 0
    }
    else if (e.code == "ArrowRight" && velocityX != -1) {
        velocityX = 1
        velocityY = 0
    }
}


