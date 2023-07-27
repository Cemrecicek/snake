
//board
var blockSize = 25
var rows = 21
var cols = 21
var board
var context

//foksiyonumuz

window.onload = function () {
    board = document.getElementById("board")
    board.height = rows * blockSize
    board.width = cols * blockSize
    context = board.getContext("2d")

    update()
}
//başlangıçta yılan

var snakeX = blockSize * 10
var snakeY = blockSize * 10


//elma

var elmaX 
var elmaY 

//elmanın koordinatları için fonksiyon

elmaX = Math.floor(Math.random()*cols)*blockSize
elmaY = Math.floor(Math.random()*rows)*blockSize


//içerikleri oluşturalım

function update() {
    context.fillStyle = "black"
    context.fillRect(0, 0, board.width, board.height)

    context.fillStyle = "green"
    context.fillRect(snakeX, snakeY, blockSize, blockSize)
    
    context.fillStyle = "red"
    context.fillRect(elmaX, elmaY, blockSize, blockSize)

    
}