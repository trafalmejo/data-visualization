let windowsCount;
let macCount;
let sizeFont;
var c1, c2;
// Constants
const Y_AXIS = 1;
const X_AXIS = 2;

function preload(){
    fetchCount()
}
function setup() {
// Sets the screen to be 720 pixels wide and 400 pixels high
// createCanvas(720, 400);
canvas = createCanvas(window.innerWidth, window.innerHeight);
sizeFont = window.innerWidth / 6 
strokeWeight(10)
textSize(sizeFont);
textFont('Helvetica');
textStyle(BOLD);
textAlign(CENTER, CENTER);
  // Define colors
  c1 = color(255, 46, 99);
  c2 = color(255, 98, 58);
  setGradient(c1, c2);

}
function windowResized() {
console.log("resized")
sizeFont = window.innerWidth / 6 
textSize(sizeFont);
setGradient(c1, c2);
fetchCount();
  }
function draw() {
    sizeFont+=2;
    writeNumber()
    if(sizeFont > window.innerWidth/2){
        setGradient(c1,c2)
        sizeFont = window.innerWidth / 6 
    }
}

function setGradient(c1, c2) {
    // noprotect
    noFill();
    for (var y = 0; y < height; y++) {
      var inter = map(y, 0, height, 0, 1);
      var c = lerpColor(c1, c2, inter);
      stroke(c);
      line(0, y, width, y);
    }
  }
function fetchCount(){
    fetch('https://api.github.com/repos/trafalmejo/OSCAR/releases')
  .then((response) => {
    return response.json();
  })
  .then((myJson) => {
    windowsCount = myJson[0].assets[0].download_count
    macCount = myJson[0].assets[1].download_count
    console.log("count:", windowsCount+macCount);
    writeNumber()
  });
}
function writeNumber(){    
    fill(255)
    textSize(sizeFont);
    var total = windowsCount+macCount
    if(!isNaN(total))
        text(windowsCount+macCount, window.innerWidth/2, window.innerHeight/2);
}
function keyPressed() {
    console.log("KeyPressed");
    if (keyCode === DELETE) {
        reset();
    }
    if (keyCode == "32") {
    }if(keyCode === ENTER) {
    }
}
function mouseClicked() {
    console.log("MouseClicked");
}
function reset(){
    background(0);
}
