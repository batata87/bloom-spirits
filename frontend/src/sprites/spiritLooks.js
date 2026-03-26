/**
 * Spirit look definitions + procedural portrait art (canvas).
 * Index 0 = minimal default orb; 1–5 = characterful animal / spirit faces for skins & monetization.
 */

export const SPIRIT_LOOK_COUNT = 6;

/** @typedef {{ id: number, label: string, tagline: string, poeticLine: string, tier: 'default' | 'spirit' }} SpiritLookMeta */

/** @type {SpiritLookMeta[]} */
export const SPIRIT_LOOKS = [
  { id: 0, label: "Seed", tagline: "Simple glow — the default path", poeticLine: "Light before a name", tier: "default" },
  { id: 1, label: "Fox", tagline: "Clever fox spirit of twilight", poeticLine: "A spark of quiet warmth", tier: "spirit" },
  { id: 2, label: "Owl", tagline: "Quiet wisdom from the canopy", poeticLine: "Sees what others miss", tier: "spirit" },
  { id: 3, label: "Bunny", tagline: "Soft steps through silver grass", poeticLine: "Silver paths through grass", tier: "spirit" },
  { id: 4, label: "Deer", tagline: "Antlers like branching dawn", poeticLine: "Dawn caught in antlers", tier: "spirit" },
  { id: 5, label: "Frog", tagline: "Cheerful guardian of the shallows", poeticLine: "Laughter in still water", tier: "spirit" },
];

/** Swatches for UI cards / picker rings. */
export const SPIRIT_SWATCH_COLORS = [
  0xa8e8b8, 0xff9a6a, 0xc4a882, 0xe8e0f0, 0xd4a574, 0x7bc9a8,
];

export function normalizeSpiritLook(id) {
  const n = Math.floor(Number(id));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SPIRIT_LOOK_COUNT - 1, n));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 */
function drawPlainOrb(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const outer = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.42);
  outer.addColorStop(0, "rgba(235,255,238,0.75)");
  outer.addColorStop(0.45, "rgba(160,225,175,0.42)");
  outer.addColorStop(1, "rgba(120,200,150,0)");
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, size, size);
  const core = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy, size * 0.18);
  core.addColorStop(0, "rgba(255,255,252,0.95)");
  core.addColorStop(0.55, "rgba(200,245,205,0.75)");
  core.addColorStop(1, "rgba(130,210,155,0.35)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 */
function drawKitsune(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.52;
  const s = size / 256;
  // Warm aura
  const aura = ctx.createRadialGradient(cx, cy, 10 * s, cx, cy, 110 * s);
  aura.addColorStop(0, "rgba(255,200,160,0.45)");
  aura.addColorStop(0.5, "rgba(255,140,90,0.2)");
  aura.addColorStop(1, "rgba(255,120,60,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);
  // Ears
  ctx.fillStyle = "#ff9a5a";
  ctx.beginPath();
  ctx.moveTo(cx - 58 * s, cy - 35 * s);
  ctx.lineTo(cx - 42 * s, cy - 95 * s);
  ctx.lineTo(cx - 18 * s, cy - 48 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 58 * s, cy - 35 * s);
  ctx.lineTo(cx + 42 * s, cy - 95 * s);
  ctx.lineTo(cx + 18 * s, cy - 48 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe8d8";
  ctx.beginPath();
  ctx.moveTo(cx - 50 * s, cy - 40 * s);
  ctx.lineTo(cx - 42 * s, cy - 78 * s);
  ctx.lineTo(cx - 26 * s, cy - 50 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 50 * s, cy - 40 * s);
  ctx.lineTo(cx + 42 * s, cy - 78 * s);
  ctx.lineTo(cx + 26 * s, cy - 50 * s);
  ctx.closePath();
  ctx.fill();
  // Face
  const face = ctx.createRadialGradient(cx - 8 * s, cy - 18 * s, 4, cx, cy + 8 * s, 72 * s);
  face.addColorStop(0, "#ffe8c8");
  face.addColorStop(0.7, "#ffc898");
  face.addColorStop(1, "#e89868");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4 * s, 68 * s, 58 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  const eye = (ex, ey) => {
    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 16 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffef8";
    ctx.beginPath();
    ctx.arc(ex + 5 * s, ey - 6 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  eye(cx - 28 * s, cy - 4 * s);
  eye(cx + 28 * s, cy - 4 * s);
  // Nose
  ctx.fillStyle = "#5a3020";
  ctx.beginPath();
  ctx.moveTo(cx, cy + 18 * s);
  ctx.lineTo(cx - 6 * s, cy + 28 * s);
  ctx.lineTo(cx + 6 * s, cy + 28 * s);
  ctx.closePath();
  ctx.fill();
  // Smile
  ctx.strokeStyle = "rgba(90,48,32,0.45)";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(cx, cy + 8 * s, 22 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Cheek blush
  ctx.fillStyle = "rgba(255,140,160,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - 48 * s, cy + 18 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 48 * s, cy + 18 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawOwl(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const s = size / 256;
  const aura = ctx.createRadialGradient(cx, cy, 8, cx, cy, 105 * s);
  aura.addColorStop(0, "rgba(200,185,160,0.4)");
  aura.addColorStop(1, "rgba(120,100,80,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);
  // Ear tufts
  ctx.fillStyle = "#6b5344";
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 55 * s, cy - 70 * s);
    ctx.lineTo(cx + sx * 72 * s, cy - 108 * s);
    ctx.lineTo(cx + sx * 38 * s, cy - 78 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Head circle
  const head = ctx.createRadialGradient(cx, cy - 10 * s, 4, cx, cy + 10 * s, 78 * s);
  head.addColorStop(0, "#c4a882");
  head.addColorStop(1, "#8b6f52");
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(cx, cy - 5 * s, 78 * s, 0, Math.PI * 2);
  ctx.fill();
  // Face mask (heart-ish)
  ctx.fillStyle = "#e8dcc8";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8 * s, 62 * s, 52 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Big eyes
  const bigEye = (ex) => {
    ctx.fillStyle = "#f0e8d8";
    ctx.beginPath();
    ctx.ellipse(ex, cy - 8 * s, 38 * s, 44 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2818";
    ctx.beginPath();
    ctx.ellipse(ex, cy - 4 * s, 22 * s, 28 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1008";
    ctx.beginPath();
    ctx.arc(ex + 6 * s, cy - 12 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(ex + 10 * s, cy - 18 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  bigEye(cx - 32 * s);
  bigEye(cx + 32 * s);
  // Beak
  ctx.fillStyle = "#f4c070";
  ctx.beginPath();
  ctx.moveTo(cx, cy + 22 * s);
  ctx.lineTo(cx - 12 * s, cy + 42 * s);
  ctx.lineTo(cx + 12 * s, cy + 42 * s);
  ctx.closePath();
  ctx.fill();
}

function drawHare(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.52;
  const s = size / 256;
  const aura = ctx.createRadialGradient(cx, cy, 6, cx, cy, 108 * s);
  aura.addColorStop(0, "rgba(240,230,255,0.42)");
  aura.addColorStop(1, "rgba(200,180,230,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);
  // Long ears
  ctx.fillStyle = "#e8e0f0";
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * 38 * s, cy - 88 * s, 18 * s, 52 * s, sx * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd8e8";
    ctx.beginPath();
    ctx.ellipse(cx + sx * 38 * s, cy - 88 * s, 8 * s, 36 * s, sx * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e0f0";
  }
  // Face
  const face = ctx.createRadialGradient(cx, cy, 6, cx, cy + 12 * s, 65 * s);
  face.addColorStop(0, "#f8f4ff");
  face.addColorStop(1, "#d8cce8");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8 * s, 62 * s, 54 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = "#2a2030";
  ctx.beginPath();
  ctx.arc(cx - 24 * s, cy + 4 * s, 10 * s, 0, Math.PI * 2);
  ctx.arc(cx + 24 * s, cy + 4 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - 22 * s, cy + 2 * s, 3 * s, 0, Math.PI * 2);
  ctx.arc(cx + 26 * s, cy + 2 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  // Nose
  ctx.fillStyle = "#ff9ec8";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28 * s, 10 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(180,100,130,0.4)";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 34 * s);
  ctx.lineTo(cx, cy + 44 * s);
  ctx.stroke();
}

function drawStag(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.52;
  const s = size / 256;
  const aura = ctx.createRadialGradient(cx, cy, 8, cx, cy, 110 * s);
  aura.addColorStop(0, "rgba(220,190,150,0.38)");
  aura.addColorStop(1, "rgba(160,120,80,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);
  // Antlers
  ctx.strokeStyle = "#5a4030";
  ctx.lineWidth = 5 * s;
  ctx.lineCap = "round";
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 28 * s, cy - 58 * s);
    ctx.lineTo(cx + sx * 48 * s, cy - 102 * s);
    ctx.lineTo(cx + sx * 62 * s, cy - 88 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + sx * 48 * s, cy - 102 * s);
    ctx.lineTo(cx + sx * 58 * s, cy - 118 * s);
    ctx.stroke();
  }
  // Face
  const face = ctx.createRadialGradient(cx, cy - 8 * s, 4, cx, cy + 16 * s, 68 * s);
  face.addColorStop(0, "#e8d4b8");
  face.addColorStop(1, "#b89870");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6 * s, 58 * s, 62 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Snout
  ctx.fillStyle = "#c8a888";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 38 * s, 28 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes (gentle)
  ctx.fillStyle = "#3a3028";
  ctx.beginPath();
  ctx.ellipse(cx - 26 * s, cy - 4 * s, 12 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 26 * s, cy - 4 * s, 12 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(cx - 22 * s, cy - 8 * s, 4 * s, 0, Math.PI * 2);
  ctx.arc(cx + 30 * s, cy - 8 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  // Nose tip
  ctx.fillStyle = "#4a3830";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 44 * s, 12 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawToad(ctx, size) {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const s = size / 256;
  const aura = ctx.createRadialGradient(cx, cy, 6, cx, cy, 105 * s);
  aura.addColorStop(0, "rgba(140,220,180,0.45)");
  aura.addColorStop(1, "rgba(60,160,120,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);
  // Body
  const body = ctx.createRadialGradient(cx, cy + 10 * s, 8, cx, cy + 24 * s, 72 * s);
  body.addColorStop(0, "#8fd4a8");
  body.addColorStop(1, "#4a9870");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18 * s, 78 * s, 58 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spots
  ctx.fillStyle = "rgba(40,120,80,0.35)";
  for (let i = 0; i < 7; i += 1) {
    const ax = cx + (Math.cos(i * 1.7) * 38 - 10) * s;
    const ay = cy + (Math.sin(i * 1.2) * 22 + 20) * s;
    ctx.beginPath();
    ctx.arc(ax, ay, 4 + (i % 3) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eye bumps
  ctx.fillStyle = "#7bc9a8";
  ctx.beginPath();
  ctx.ellipse(cx - 38 * s, cy - 28 * s, 28 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 38 * s, cy - 28 * s, 28 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = "#f8fff8";
  ctx.beginPath();
  ctx.arc(cx - 38 * s, cy - 28 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(cx + 38 * s, cy - 28 * s, 18 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#204030";
  ctx.beginPath();
  ctx.arc(cx - 34 * s, cy - 26 * s, 10 * s, 0, Math.PI * 2);
  ctx.arc(cx + 42 * s, cy - 26 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - 30 * s, cy - 30 * s, 4 * s, 0, Math.PI * 2);
  ctx.arc(cx + 46 * s, cy - 30 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = "rgba(30,80,50,0.55)";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(cx, cy + 8 * s, 28 * s, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
}

/**
 * Render full spirit portrait into canvas context (square).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size canvas width/height
 * @param {number} lookIndex
 */
export function drawSpiritPortrait(ctx, size, lookIndex) {
  const idx = normalizeSpiritLook(lookIndex);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  if (idx === 0) {
    drawPlainOrb(ctx, size);
  } else if (idx === 1) {
    drawKitsune(ctx, size);
  } else if (idx === 2) {
    drawOwl(ctx, size);
  } else if (idx === 3) {
    drawHare(ctx, size);
  } else if (idx === 4) {
    drawStag(ctx, size);
  } else {
    drawToad(ctx, size);
  }
  ctx.restore();
}
