
//board
var blockSize = 25
var rows = 21
var cols = 21
var board
var context

//yılanın başlangıcı

var snakeX = blockSize * 10
var snakeY = blockSize * 10

velocityX=0
velocityY=0



//elma

var elmaX 
var elmaY 

//elmanın koordinatları için fonksiyon
function placeFood(){
    elmaX = Math.floor(Math.random()*cols)*blockSize
    elmaY = Math.floor(Math.random()*rows)*blockSize
    
}

//içerikleri oluşturalım

function update() {

// oyunun bitme durumunu kontrol edelim

   
    context.fillStyle = "black"
    context.fillRect(0, 0, board.width, board.height)
    
    context.fillStyle = "red"
    context.fillRect(elmaX, elmaY, blockSize, blockSize)
    


    context.fillStyle = "green"
    snakeX+=velocityX*blockSize
    snakeY+=velocityY*blockSize
    context.fillRect(snakeX, snakeY, blockSize, blockSize)
    

    
}

//foksiyonumuz

window.onload = function () {
    board = document.getElementById("board")
    board.height = rows * blockSize
    board.width = cols * blockSize
    context = board.getContext("2d")

    placeFood()
    document.addEventListener("keyup", changeDirection)
    // update()
    setInterval(update,1000/10)
}

function changeDirection(e){
    if (e.code=="ArrowUp"){
        velocityX=0
        velocityY=-1
    }
    else if(e.code=="ArrowDown"){
        velocityX=0
        velocityY=1
    }
    else if(e.code=="ArrowLeft"){
        velocityX=-1
        velocityY=0
    }
    else if(e.code=="ArrowRight"){
        velocityX=1
        velocityY=0
    }
}


