export default class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseScreen = { x: 0, y: 0 };
    this.mouseWorld = { x: 0, y: 0 };
    this.isBoosting = false;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener("mousemove", (event) => {
      this.mouseScreen.x = event.clientX;
      this.mouseScreen.y = event.clientY;
    });

    window.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.isBoosting = true;
      }
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.isBoosting = false;
      }
    });
  }

  updateWorldMouse(camera) {
    this.mouseWorld.x = this.mouseScreen.x + camera.x;
    this.mouseWorld.y = this.mouseScreen.y + camera.y;
  }
}
