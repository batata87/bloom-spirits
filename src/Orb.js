function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default class Orb {
  constructor(x, y, value = 1, color = "#53e3ff") {
    this.x = x;
    this.y = y;
    this.value = value;
    this.color = color;
    this.baseRadius = 4 + value * 0.8;
    this.pulseSeed = Math.random() * Math.PI * 2;
  }

  static spawnRandom(worldSize) {
    const margin = 100;
    const x = randomBetween(margin, worldSize - margin);
    const y = randomBetween(margin, worldSize - margin);
    const value = randomBetween(0.8, 2.2);
    return new Orb(x, y, value);
  }

  draw(ctx, nowMs) {
    const t = nowMs * 0.004 + this.pulseSeed;
    const pulse = 0.75 + Math.sin(t) * 0.25;
    const radius = this.baseRadius * pulse;

    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
