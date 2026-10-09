// Fullscreen counter: the number grows from 1/6 to 1/2 of the screen width,
// leaving a trail, then the gradient wipes it and the zoom starts again.
// app.js drives it through showCounter() / hideCounter().

let counterValue = null;
let sizeFont;
let c1, c2;

function setup() {
  const canvas = createCanvas(window.innerWidth, window.innerHeight);
  canvas.parent('counter-canvas');
  strokeWeight(10);
  textFont('Helvetica');
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  c1 = color(255, 46, 99);
  c2 = color(255, 98, 58);
  restartZoom();
  noLoop();
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  restartZoom();
}

function draw() {
  sizeFont += 2;
  writeNumber();
  if (sizeFont > width / 2) restartZoom();
}

function restartZoom() {
  setGradient(c1, c2);
  sizeFont = width / 6;
}

function setGradient(c1, c2) {
  noFill();
  for (let y = 0; y < height; y++) {
    stroke(lerpColor(c1, c2, map(y, 0, height, 0, 1)));
    line(0, y, width, y);
  }
}

function writeNumber() {
  if (counterValue === null) return;
  fill(255);
  textSize(sizeFont);
  text(counterValue.toLocaleString('en-US'), width / 2, height / 2);
}

function showCounter(value) {
  counterValue = value;
  restartZoom();
  loop();
}

function hideCounter() {
  noLoop();
}
