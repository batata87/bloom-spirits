function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default class Snake {
  constructor(x, y) {
    this.head = { x, y };
    this.heading = 0;
    this.speed = 185;
    this.boostSpeed = 290;
    this.turnRate = 6.5;
    this.radius = 13;
    this.baseGap = 9;
    this.lengthUnits = 24;
    this.segments = [];

    this.targetLength = this.computeSegmentCount();
    for (let i = 0; i < this.targetLength; i += 1) {
      this.segments.push({ x: x - i * this.baseGap, y });
    }
  }

  get position() {
    return this.head;
  }

  computeSegmentCount() {
    return Math.max(20, Math.floor(this.lengthUnits * 1.9));
  }

  grow(amount) {
    this.lengthUnits += amount;
    this.radius = clamp(this.radius + amount * 0.065, 13, 45);
    this.targetLength = this.computeSegmentCount();
  }

  consumeForBoost(dt) {
    const consumptionRate = 1.8;
    this.lengthUnits = Math.max(12, this.lengthUnits - consumptionRate * dt);
    this.targetLength = this.computeSegmentCount();
  }

  update(dt, input) {
    const targetAngle = Math.atan2(
      input.mouseWorld.y - this.head.y,
      input.mouseWorld.x - this.head.x
    );
    let angleDiff = targetAngle - this.heading;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    this.heading += angleDiff * Math.min(1, this.turnRate * dt);

    const isBoost = input.isBoosting && this.lengthUnits > 12;
    const currentSpeed = isBoost ? this.boostSpeed : this.speed;
    if (isBoost) {
      this.consumeForBoost(dt);
    }

    this.head.x += Math.cos(this.heading) * currentSpeed * dt;
    this.head.y += Math.sin(this.heading) * currentSpeed * dt;

    this.segments[0].x = this.head.x;
    this.segments[0].y = this.head.y;

    for (let i = 1; i < this.segments.length; i += 1) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      curr.x = lerp(curr.x, prev.x, 0.42);
      curr.y = lerp(curr.y, prev.y, 0.42);
    }

    while (this.segments.length < this.targetLength) {
      const tail = this.segments[this.segments.length - 1];
      this.segments.push({ x: tail.x, y: tail.y });
    }
    while (this.segments.length > this.targetLength) {
      this.segments.pop();
    }
  }

  draw(ctx) {
    const bodyColor = "#5ec8ff";
    const headColor = "#a1ecff";
    const bodyRadius = this.radius * 0.86;

    for (let i = this.segments.length - 1; i >= 0; i -= 1) {
      const seg = this.segments[i];
      const t = i / this.segments.length;
      const r = bodyRadius * (0.58 + (1 - t) * 0.42);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = "#89e9ff";
    ctx.shadowBlur = 22;
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(this.head.x, this.head.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const eyeDistance = this.radius * 0.42;
    const eyeOffset = this.radius * 0.35;
    const ex = Math.cos(this.heading + Math.PI / 2) * eyeOffset;
    const ey = Math.sin(this.heading + Math.PI / 2) * eyeOffset;
    const fx = Math.cos(this.heading) * eyeDistance;
    const fy = Math.sin(this.heading) * eyeDistance;

    ctx.fillStyle = "#10212f";
    ctx.beginPath();
    ctx.arc(this.head.x + ex + fx, this.head.y + ey + fy, this.radius * 0.15, 0, Math.PI * 2);
    ctx.arc(this.head.x - ex + fx, this.head.y - ey + fy, this.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}
