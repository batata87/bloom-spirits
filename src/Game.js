import Snake from "./Snake.js";
import Orb from "./Orb.js";
import Input from "./Input.js";

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.lengthLabel = document.getElementById("lengthLabel");

    this.worldSize = 5000;
    this.camera = { x: 0, y: 0 };
    this.lastTime = performance.now();

    this.snake = new Snake(this.worldSize * 0.5, this.worldSize * 0.5);
    this.input = new Input(this.canvas);
    this.orbs = [];
    this.maxOrbs = 320;

    this.resize();
    this.seedOrbs();

    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((ts) => this.loop(ts));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  seedOrbs() {
    for (let i = 0; i < this.maxOrbs; i += 1) {
      this.orbs.push(Orb.spawnRandom(this.worldSize));
    }
  }

  spawnUntilFull() {
    while (this.orbs.length < this.maxOrbs) {
      this.orbs.push(Orb.spawnRandom(this.worldSize));
    }
  }

  update(dt) {
    this.input.updateWorldMouse(this.camera);
    this.snake.update(dt, this.input);
    this.handleOrbCollisions();
    this.spawnUntilFull();

    this.camera.x = this.snake.position.x - this.canvas.width * 0.5;
    this.camera.y = this.snake.position.y - this.canvas.height * 0.5;
    this.lengthLabel.textContent = `Length: ${Math.floor(this.snake.lengthUnits)}`;
  }

  handleOrbCollisions() {
    const eatDistance = this.snake.radius + 8;
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      const dx = orb.x - this.snake.position.x;
      const dy = orb.y - this.snake.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= eatDistance * eatDistance) {
        this.snake.grow(orb.value);
        this.orbs.splice(i, 1);
      }
    }
  }

  drawGrid() {
    const { ctx, canvas, camera } = this;
    const spacing = 48;
    const offsetX = -((camera.x % spacing) + spacing) % spacing;
    const offsetY = -((camera.y % spacing) + spacing) % spacing;

    ctx.fillStyle = "#0a0d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(75, 110, 152, 0.17)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < canvas.width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY; y < canvas.height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
  }

  draw(nowMs) {
    const { ctx, canvas, camera } = this;
    this.drawGrid();

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const orb of this.orbs) {
      orb.draw(ctx, nowMs);
    }
    this.snake.draw(ctx);
    ctx.restore();

    ctx.strokeStyle = "rgba(64, 90, 130, 0.45)";
    ctx.strokeRect(-camera.x, -camera.y, this.worldSize, this.worldSize);
  }

  loop(now) {
    const dt = Math.min(0.033, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.draw(now);

    requestAnimationFrame((ts) => this.loop(ts));
  }
}

new Game();
