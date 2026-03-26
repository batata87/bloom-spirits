import * as PIXI from "pixi.js";
import { GlowFilter } from "@pixi/filter-glow";
import { subscribeRestorationPresence, helpersToMultiplier } from "./lib/restorationPresence.ts";
import {
  SPIRIT_LOOK_COUNT,
  SPIRIT_LOOKS,
  SPIRIT_SWATCH_COLORS,
  normalizeSpiritLook,
  drawSpiritPortrait,
} from "./sprites/spiritLooks.js";

export {
  SPIRIT_LOOK_COUNT,
  SPIRIT_LOOKS,
  SPIRIT_SWATCH_COLORS,
  normalizeSpiritLook,
} from "./sprites/spiritLooks.js";

const WORLD_SIZE = 4200;
const HALF_WORLD = WORLD_SIZE * 0.5;
const LIFE_W = 96;
const LIFE_H = 96;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const PROGRESSION_KEY = "bloom_progression_v1";

function loadProgression() {
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return {
      spiritStrength: Math.max(0, Number(p.spiritStrength) || 0),
      totalAwakenings: Math.max(0, Number(p.totalAwakenings) || 0),
      lastSeenAt: Number(p.lastSeenAt) || 0,
      lastDailyBonusDay: typeof p.lastDailyBonusDay === "string" ? p.lastDailyBonusDay : "",
      worldMemoryTrail: Array.isArray(p.worldMemoryTrail) ? p.worldMemoryTrail : [],
    };
  } catch {
    return {
      spiritStrength: 0,
      totalAwakenings: 0,
      lastSeenAt: 0,
      lastDailyBonusDay: "",
      worldMemoryTrail: [],
    };
  }
}

function saveProgression(p) {
  try {
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify(p));
  } catch {
    // Ignore storage errors and keep gameplay uninterrupted.
  }
}

function dayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function createBackgroundTexture(width, height) {
  const c = document.createElement("canvas");
  c.width = Math.max(64, Math.floor(width));
  c.height = Math.max(64, Math.floor(height));
  const ctx = c.getContext("2d");
  const vertical = ctx.createLinearGradient(0, 0, 0, c.height);
  vertical.addColorStop(0, "#3f6f4d");
  vertical.addColorStop(0.5, "#2f5e43");
  vertical.addColorStop(1, "#244835");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, c.width, c.height);
  const radial = ctx.createRadialGradient(c.width * 0.45, c.height * 0.35, 40, c.width * 0.45, c.height * 0.35, c.width * 0.85);
  radial.addColorStop(0, "rgba(156,205,158,0.18)");
  radial.addColorStop(1, "rgba(156,205,158,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 480; i += 1) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 50 + Math.random() * 220;
    const haze = ctx.createRadialGradient(x, y, 0, x, y, r);
    haze.addColorStop(0, "rgba(190,240,170,0.05)");
    haze.addColorStop(1, "rgba(190,240,170,0)");
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return PIXI.Texture.from(c);
}

/**
 * High-res portrait texture for the player spirit (plain orb or illustrated form).
 * @param {number} lookIndex
 */
export function createSpiritTexture(lookIndex) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  drawSpiritPortrait(ctx, 256, lookIndex);
  return PIXI.Texture.from(c);
}

function makeLifeTextureCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = LIFE_W;
  canvas.height = LIFE_H;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(LIFE_W, LIFE_H);
  return { canvas, ctx, img };
}

function worldToLife(x, y) {
  const u = (x + HALF_WORLD) / WORLD_SIZE;
  const v = (y + HALF_WORLD) / WORLD_SIZE;
  return {
    lx: clamp(Math.floor(u * LIFE_W), 0, LIFE_W - 1),
    ly: clamp(Math.floor(v * LIFE_H), 0, LIFE_H - 1),
  };
}

function lifeToWorld(ix, iy) {
  const x = (ix / (LIFE_W - 1)) * WORLD_SIZE - HALF_WORLD;
  const y = (iy / (LIFE_H - 1)) * WORLD_SIZE - HALF_WORLD;
  return { x, y };
}

/**
 * Stylized trail/bloom flowers — distinct petals + stem (reads as flora, not soft balloons).
 */
function makePainterlyFlowerTexture(variant) {
  const W = 128;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const cx = W * 0.5;
  const cy = H * 0.4;

  const themes = [
    { petalHi: "#ff6eb4", petalLo: "#ff9ec8", petalEdge: "#c83878", center: "#fff8c8", stem: "#2d6b42" },
    { petalHi: "#ffd040", petalLo: "#ffe888", petalEdge: "#d09010", center: "#fffef0", stem: "#2d6b42" },
    { petalHi: "#7ab0ff", petalLo: "#c8dcff", petalEdge: "#4070c8", center: "#f4f8ff", stem: "#2d6b42" },
    { petalHi: "#ff9078", petalLo: "#ffc0b0", petalEdge: "#d85840", center: "#fff0e8", stem: "#2d6b42" },
    { petalHi: "#e868c8", petalLo: "#c8a0ff", petalEdge: "#9030a0", center: "#fff5ff", stem: "#2d6b42" },
  ];
  const t = themes[variant % themes.length];

  ctx.strokeStyle = t.stem;
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy + 14);
  ctx.quadraticCurveTo(cx + 5, cy + 44, cx + 8, H - 20);
  ctx.stroke();

  ctx.fillStyle = t.stem;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx + sx * 16, cy + 26);
    ctx.lineTo(cx, cy + 18);
    ctx.fill();
  }

  const nPetals = 6 + (variant % 3);
  const rx = 9 + (variant % 2);
  const ry = 20 + (variant % 3);
  for (let i = 0; i < nPetals; i += 1) {
    const a = (i / nPetals) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -ry - 8, 0, 6);
    g.addColorStop(0, t.petalHi);
    g.addColorStop(0.5, t.petalLo);
    g.addColorStop(1, t.petalEdge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -14, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const cg = ctx.createRadialGradient(cx, cy - 1, 0, cx, cy, 13);
  cg.addColorStop(0, t.center);
  cg.addColorStop(0.75, t.petalEdge);
  cg.addColorStop(1, t.petalEdge);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,40,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  return PIXI.Texture.from(c);
}

/** Soft watercolor tree clump for gradual world regrowth. */
function makePainterlyTreeTexture(variant) {
  const W = 156;
  const H = 172;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const trunkX = W * 0.5;
  const trunkBottom = H - 14;
  const palettes = [
    { leafA: "#355f3c", leafB: "#264a2f", leafC: "#4f7a54", trunk: "#5a4535" },
    { leafA: "#2f5b39", leafB: "#21452a", leafC: "#466f4b", trunk: "#5a4636" },
    { leafA: "#3a6540", leafB: "#2a5032", leafC: "#567f5a", trunk: "#624b38" },
  ];
  const p = palettes[variant % palettes.length];

  ctx.strokeStyle = p.trunk;
  ctx.lineCap = "round";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(trunkX, trunkBottom);
  ctx.lineTo(trunkX, H * 0.46);
  ctx.stroke();

  const layers = 5;
  for (let i = 0; i < layers; i += 1) {
    const y = H * 0.42 + i * 18;
    const w = 84 - i * 14 + (variant % 2) * 4;
    const h = 44 - i * 6;
    const gx = trunkX;
    const gy = y;
    const g = ctx.createRadialGradient(gx, gy - h * 0.18, 3, gx, gy, Math.max(w, h) * 0.62);
    g.addColorStop(0, p.leafC);
    g.addColorStop(0.5, p.leafA);
    g.addColorStop(1, p.leafB);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(gx, gy - h);
    ctx.lineTo(gx + w * 0.5, gy);
    ctx.lineTo(gx, gy + h * 0.2);
    ctx.lineTo(gx - w * 0.5, gy);
    ctx.closePath();
    ctx.fill();
  }

  return PIXI.Texture.from(c);
}

/** Inner “soul” glyph layered on the player spirit — matches {@link createSpiritTexture} themes. */
function makeSoulTexture(lookIndex) {
  const idx = normalizeSpiritLook(lookIndex);
  const soulThemes = [
    { glow: ["rgba(255,255,235,0.98)", "rgba(210,255,146,0.82)", "rgba(144,232,116,0.34)", "rgba(144,232,116,0)"], ring: "rgba(235,255,205,0.75)", cross: "rgba(255,255,235,0.55)" },
    { glow: ["rgba(255,250,255,0.98)", "rgba(230,200,255,0.82)", "rgba(180,140,255,0.34)", "rgba(160,100,240,0)"], ring: "rgba(230,210,255,0.78)", cross: "rgba(255,245,255,0.55)" },
    { glow: ["rgba(255,255,240,0.98)", "rgba(255,220,150,0.85)", "rgba(255,170,80,0.38)", "rgba(255,120,40,0)"], ring: "rgba(255,230,190,0.8)", cross: "rgba(255,255,240,0.58)" },
    { glow: ["rgba(240,255,255,0.98)", "rgba(160,235,255,0.84)", "rgba(80,200,240,0.36)", "rgba(40,160,220,0)"], ring: "rgba(200,245,255,0.78)", cross: "rgba(240,255,255,0.58)" },
    { glow: ["rgba(255,250,252,0.98)", "rgba(255,200,230,0.84)", "rgba(255,150,190,0.38)", "rgba(255,100,160,0)"], ring: "rgba(255,220,235,0.78)", cross: "rgba(255,250,252,0.58)" },
    { glow: ["rgba(255,255,255,0.98)", "rgba(230,240,255,0.86)", "rgba(200,220,245,0.38)", "rgba(170,195,230,0)"], ring: "rgba(220,235,255,0.75)", cross: "rgba(255,255,255,0.58)" },
  ];
  const t = soulThemes[idx];
  const c = document.createElement("canvas");
  c.width = 120;
  c.height = 120;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(60, 60, 3, 60, 60, 54);
  g.addColorStop(0, t.glow[0]);
  g.addColorStop(0.38, t.glow[1]);
  g.addColorStop(0.72, t.glow[2]);
  g.addColorStop(1, t.glow[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.beginPath();
  ctx.arc(60, 60, 22, 0, Math.PI * 2);
  ctx.strokeStyle = t.ring;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(60, 42);
  ctx.lineTo(60, 78);
  ctx.moveTo(42, 60);
  ctx.lineTo(78, 60);
  ctx.strokeStyle = t.cross;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  return PIXI.Texture.from(c);
}

/** Collectible world essences — neutral green (not tied to player look). */
function makeWorldEssenceTexture() {
  const c = document.createElement("canvas");
  c.width = 120;
  c.height = 120;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(60, 60, 3, 60, 60, 54);
  g.addColorStop(0, "rgba(255,255,235,0.98)");
  g.addColorStop(0.38, "rgba(210,255,146,0.82)");
  g.addColorStop(0.72, "rgba(144,232,116,0.34)");
  g.addColorStop(1, "rgba(144,232,116,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.beginPath();
  ctx.arc(60, 60, 22, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(235,255,205,0.75)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(60, 42);
  ctx.lineTo(60, 78);
  ctx.moveTo(42, 60);
  ctx.lineTo(78, 60);
  ctx.strokeStyle = "rgba(255,255,235,0.55)";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  return PIXI.Texture.from(c);
}

function makeNoiseTexture(width, height, alpha = 14) {
  const c = document.createElement("canvas");
  c.width = Math.max(64, Math.floor(width));
  c.height = Math.max(64, Math.floor(height));
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 120 + ((Math.random() * 70) | 0);
    d[i] = n;
    d[i + 1] = n + 10;
    d[i + 2] = n;
    d[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  return PIXI.Texture.from(c);
}

function makeSoftGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
  g.addColorStop(0, "rgba(228,255,178,0.8)");
  g.addColorStop(0.6, "rgba(165,236,122,0.28)");
  g.addColorStop(1, "rgba(165,236,122,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return PIXI.Texture.from(c);
}

/** Tiny world creatures — all kinds are collectible magical creatures. */
function makeCritterTexture(kind) {
  const c = document.createElement("canvas");
  c.width = 56;
  c.height = 56;
  const ctx = c.getContext("2d");
  const cx = 28;
  const cy = 30;

  switch (kind) {
    case 0: {
      // Tiny fox-like creature, angular style (no inner circles).
      const bodyG = ctx.createLinearGradient(cx - 14, cy - 8, cx + 14, cy + 10);
      bodyG.addColorStop(0, "rgba(235,194,142,0.98)");
      bodyG.addColorStop(1, "rgba(210,152,95,0.98)");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 6);
      ctx.lineTo(cx - 6, cy - 6);
      ctx.lineTo(cx + 6, cy - 6);
      ctx.lineTo(cx + 12, cy + 6);
      ctx.lineTo(cx + 2, cy + 12);
      ctx.lineTo(cx - 2, cy + 12);
      ctx.fill();
      ctx.fillStyle = "rgba(248,225,190,0.95)";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 6);
      ctx.lineTo(cx - 14, cy - 18);
      ctx.lineTo(cx - 4, cy - 10);
      ctx.moveTo(cx + 8, cy - 6);
      ctx.lineTo(cx + 14, cy - 18);
      ctx.lineTo(cx + 4, cy - 10);
      ctx.fill();
      break;
    }
    case 1: {
      // Bird-like creature, no circular core.
      const bodyG = ctx.createLinearGradient(cx - 14, cy - 8, cx + 14, cy + 10);
      bodyG.addColorStop(0, "rgba(166,212,255,0.98)");
      bodyG.addColorStop(1, "rgba(120,168,240,0.98)");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy + 2);
      ctx.lineTo(cx - 4, cy - 8);
      ctx.lineTo(cx + 10, cy - 6);
      ctx.lineTo(cx + 14, cy + 2);
      ctx.lineTo(cx + 2, cy + 10);
      ctx.lineTo(cx - 8, cy + 8);
      ctx.fill();
      ctx.fillStyle = "rgba(255,210,120,0.95)";
      ctx.beginPath();
      ctx.moveTo(cx + 14, cy);
      ctx.lineTo(cx + 24, cy + 2);
      ctx.lineTo(cx + 14, cy + 6);
      ctx.fill();
      break;
    }
    case 2: {
      // Magical ember moth (no inner circular details).
      const wingG = ctx.createLinearGradient(cx - 18, cy - 14, cx + 18, cy + 10);
      wingG.addColorStop(0, "rgba(255,196,120,0.98)");
      wingG.addColorStop(1, "rgba(255,150,92,0.98)");
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 4);
      ctx.lineTo(cx - 18, cy + 2);
      ctx.lineTo(cx - 9, cy + 14);
      ctx.lineTo(cx - 1, cy + 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy - 4);
      ctx.lineTo(cx + 18, cy + 2);
      ctx.lineTo(cx + 9, cy + 14);
      ctx.lineTo(cx + 1, cy + 6);
      ctx.fill();
      ctx.fillStyle = "rgba(130,62,36,0.98)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx - 3, cy + 8);
      ctx.lineTo(cx + 3, cy + 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,238,210,0.95)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.quadraticCurveTo(cx - 8, cy - 17, cx - 13, cy - 16);
      ctx.moveTo(cx, cy - 10);
      ctx.quadraticCurveTo(cx + 8, cy - 17, cx + 13, cy - 16);
      ctx.stroke();
      break;
    }
    case 3: {
      // Artistic butterfly (replaces the old gray bug-like creature).
      const wingG = ctx.createLinearGradient(cx - 20, cy - 14, cx + 20, cy + 14);
      wingG.addColorStop(0, "rgba(174,226,255,0.98)");
      wingG.addColorStop(0.5, "rgba(196,188,255,0.98)");
      wingG.addColorStop(1, "rgba(255,192,236,0.98)");
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.moveTo(cx - 1, cy - 2);
      ctx.quadraticCurveTo(cx - 20, cy - 18, cx - 21, cy + 3);
      ctx.quadraticCurveTo(cx - 15, cy + 16, cx - 2, cy + 7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 2);
      ctx.quadraticCurveTo(cx + 20, cy - 18, cx + 21, cy + 3);
      ctx.quadraticCurveTo(cx + 15, cy + 16, cx + 2, cy + 7);
      ctx.fill();
      ctx.fillStyle = "rgba(96,72,145,0.98)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11);
      ctx.lineTo(cx - 3, cy + 9);
      ctx.lineTo(cx + 3, cy + 9);
      ctx.fill();
      ctx.strokeStyle = "rgba(240,244,255,0.92)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.quadraticCurveTo(cx - 8, cy - 17, cx - 13, cy - 16);
      ctx.moveTo(cx, cy - 10);
      ctx.quadraticCurveTo(cx + 8, cy - 17, cx + 13, cy - 16);
      ctx.stroke();
      break;
    }
    case 4: {
      // Large magical moth spirit.
      const wingG = ctx.createLinearGradient(cx - 20, cy - 16, cx + 20, cy + 16);
      wingG.addColorStop(0, "rgba(255,170,240,0.98)");
      wingG.addColorStop(0.5, "rgba(190,150,255,0.98)");
      wingG.addColorStop(1, "rgba(130,220,255,0.98)");
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.ellipse(cx - 14, cy - 2, 13, 20, -0.42, 0, Math.PI * 2);
      ctx.ellipse(cx + 14, cy - 2, 13, 20, 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(95,60,150,0.98)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx - 4, cy + 10);
      ctx.lineTo(cx + 4, cy + 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,245,255,0.92)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 10);
      ctx.quadraticCurveTo(cx - 10, cy - 20, cx - 17, cy - 19);
      ctx.moveTo(cx + 3, cy - 10);
      ctx.quadraticCurveTo(cx + 10, cy - 20, cx + 17, cy - 19);
      ctx.stroke();
      break;
    }
    default: {
      // Large magical fox-like spirit.
      const bodyG = ctx.createLinearGradient(cx - 18, cy - 10, cx + 18, cy + 16);
      bodyG.addColorStop(0, "rgba(255,240,140,0.98)");
      bodyG.addColorStop(0.55, "rgba(255,198,95,0.98)");
      bodyG.addColorStop(1, "rgba(255,145,80,0.98)");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 6);
      ctx.lineTo(cx - 8, cy - 8);
      ctx.lineTo(cx + 8, cy - 8);
      ctx.lineTo(cx + 15, cy + 6);
      ctx.lineTo(cx + 2, cy + 14);
      ctx.lineTo(cx - 2, cy + 14);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 5);
      ctx.lineTo(cx - 16, cy - 21);
      ctx.lineTo(cx - 3, cy - 12);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 9, cy - 5);
      ctx.lineTo(cx + 16, cy - 21);
      ctx.lineTo(cx + 3, cy - 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,250,200,0.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + 12, cy + 5);
      ctx.quadraticCurveTo(cx + 22, cy + 2, cx + 24, cy + 11);
      ctx.stroke();
      break;
    }
  }
  return PIXI.Texture.from(c);
}

function createSoundManager() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = Ctx ? new Ctx() : null;
  const sfxBus = audioCtx ? audioCtx.createGain() : null;
  if (sfxBus && audioCtx) {
    sfxBus.gain.value = 0.42;
    sfxBus.connect(audioCtx.destination);
  }

  function playCollectSound() {
    if (!audioCtx || !sfxBus) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, now);
    lp.Q.value = 0.75;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 3.05);
  }

  function playSurpriseCollectSound() {
    if (!audioCtx || !sfxBus) return;
    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
    master.connect(sfxBus);
    const notes = [523.25, 659.25, 783.99];
    for (let i = 0; i < notes.length; i += 1) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const hp = audioCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 220;
      osc.type = "triangle";
      const start = now + i * 0.08;
      const end = start + 0.34;
      osc.frequency.setValueAtTime(notes[i], start);
      osc.frequency.exponentialRampToValueAtTime(notes[i] * 1.55, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.24 - i * 0.04, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(hp);
      hp.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(end + 0.03);
    }
  }

  const makeAudio = (candidates, { loop = false, volume = 0.25 } = {}) => {
    const a = new Audio();
    a.loop = loop;
    a.volume = volume;
    a.preload = "auto";
    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) return;
      a.src = candidates[idx];
      idx += 1;
      a.load();
    };
    a.addEventListener("error", tryNext);
    tryNext();
    return a;
  };

  // Supports both "/assets/..." and "assets/..." forms.
  const ambient = makeAudio(["/assets/sounds/ambient.mp3", "assets/sounds/ambient.mp3"], { loop: true, volume: 0.24 });
  const bloom = makeAudio(["/assets/sounds/bloom.mp3", "assets/sounds/bloom.mp3"], { volume: 0.24 });
  const baseAmbientVol = 0.24;
  let ambientVolTarget = baseAmbientVol;

  const playAmbient = () => {
    ambient.play().catch(() => {});
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  };

  const setAmbientVolumeTarget = (v) => {
    ambientVolTarget = Math.max(0, Math.min(1, v));
  };

  const tickAmbientVolume = (dt) => {
    ambient.volume += (ambientVolTarget - ambient.volume) * Math.min(1, 0.08 * dt);
  };

  const playEffect = (name, volumeMul = 1) => {
    if (name === "collect") {
      playCollectSound();
      return;
    }
    if (name === "surprise") {
      playSurpriseCollectSound();
      return;
    }
    const source = name === "bloom" ? bloom : null;
    if (!source) return;
    const sfx = source.cloneNode();
    sfx.volume = Math.min(1, source.volume * volumeMul);
    sfx.play().catch(() => {});
  };

  const unlock = () => {
    playAmbient();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    playAmbient,
    playEffect,
    setAmbientVolumeTarget,
    tickAmbientVolume,
    resetAmbientVolumeTarget: () => {
      ambientVolTarget = baseAmbientVol;
    },
    destroy: () => {
      ambient.pause();
      ambient.currentTime = 0;
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    },
  };
}

export async function mountGame(hostEl, options = {}) {
  const {
    app: injectedApp = null,
    gameParent = null,
    onBloom = null,
    onWorldAwaken = null,
    onSessionTime = null,
    flowPlayerName = "Guest",
    onFlowProfile = () => {},
    onFlowLogout = () => {},
    onFlowFeedback = () => {},
    spiritLookId: initialSpiritLookId = 0,
    gameModeId: initialGameModeId = "restoration",
    gameModeLabel: initialGameModeLabel = "Endless Restoration",
  } = options;

  if (!injectedApp) {
    document.querySelectorAll("canvas").forEach((n) => n.remove());
  }

  const app = injectedApp ?? new PIXI.Application();
  if (!injectedApp) {
    await app.init({
      resizeTo: hostEl,
      background: "#19382a",
      antialias: true,
      autoDensity: true,
    });
    app.ticker.maxFPS = 30;
    hostEl.appendChild(app.canvas);
  }

  const stage = app.stage;
  const root = gameParent ?? stage;
  let gamePaused = false;

  const backdropLayer = new PIXI.Container();
  const world = new PIXI.Container();
  const lifeLayer = new PIXI.Container();
  const depthLayer = new PIXI.Container();
  const lifeAuraLayer = new PIXI.Container();
  const floraLayer = new PIXI.Container();
  const critterLayer = new PIXI.Container();
  const trailLayer = new PIXI.Container();
  const spiritLayer = new PIXI.Container();
  const particleLayer = new PIXI.Container();
  const weatherLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();

  root.addChild(backdropLayer);
  root.addChild(world);
  world.addChild(lifeLayer);
  world.addChild(depthLayer);
  world.addChild(lifeAuraLayer);
  world.addChild(floraLayer);
  world.addChild(critterLayer);
  world.addChild(trailLayer);
  world.addChild(spiritLayer);
  world.addChild(particleLayer);
  root.addChild(weatherLayer);
  root.addChild(uiLayer);

  let bgTex = createBackgroundTexture(app.screen.width * 1.5, app.screen.height * 1.5);
  let noiseTexNear = makeNoiseTexture(app.screen.width * 1.35, app.screen.height * 1.35, 10);
  let noiseTexFar = makeNoiseTexture(app.screen.width * 1.8, app.screen.height * 1.8, 8);
  const bg = new PIXI.Sprite(bgTex);
  bg.anchor.set(0.5);
  bg.x = app.screen.width * 0.5;
  bg.y = app.screen.height * 0.5;
  const bgNoiseNear = new PIXI.Sprite(noiseTexNear);
  bgNoiseNear.anchor.set(0.5);
  bgNoiseNear.x = app.screen.width * 0.5;
  bgNoiseNear.y = app.screen.height * 0.5;
  bgNoiseNear.alpha = 0.11;
  const bgNoiseFar = new PIXI.Sprite(noiseTexFar);
  bgNoiseFar.anchor.set(0.5);
  bgNoiseFar.x = app.screen.width * 0.5;
  bgNoiseFar.y = app.screen.height * 0.5;
  bgNoiseFar.alpha = 0.08;
  const bgTint = new PIXI.Graphics();
  backdropLayer.addChild(bg);
  backdropLayer.addChild(bgNoiseFar);
  backdropLayer.addChild(bgNoiseNear);
  backdropLayer.addChild(bgTint);

  const lifeField = new Float32Array(LIFE_W * LIFE_H);
  lifeField.fill(0.01);
  const trailMemory = new Float32Array(LIFE_W * LIFE_H);
  const lifeCanvas = makeLifeTextureCanvas();
  const lifeTex = PIXI.Texture.from(lifeCanvas.canvas);
  const lifeSprite = new PIXI.Sprite(lifeTex);
  lifeSprite.anchor.set(0.5);
  lifeSprite.width = WORLD_SIZE;
  lifeSprite.height = WORLD_SIZE;
  lifeSprite.alpha = 0.56;
  lifeLayer.addChild(lifeSprite);

  const spiritLookTextures = [];
  const soulLookTextures = [];
  for (let i = 0; i < SPIRIT_LOOK_COUNT; i += 1) {
    spiritLookTextures.push(createSpiritTexture(i));
    soulLookTextures.push(makeSoulTexture(i));
  }
  let activeSpiritLook = normalizeSpiritLook(initialSpiritLookId);

  const spirit = new PIXI.Sprite(spiritLookTextures[activeSpiritLook]);
  spirit.anchor.set(0.5);
  spirit.scale.set(1.55);
  spiritLayer.addChild(spirit);

  const soul = new PIXI.Sprite(soulLookTextures[activeSpiritLook]);
  soul.anchor.set(0.5);
  soul.scale.set(0.32);
  spirit.addChild(soul);

  const applySpiritLook = (id) => {
    activeSpiritLook = normalizeSpiritLook(id);
    spirit.texture = spiritLookTextures[activeSpiritLook];
    soul.texture = soulLookTextures[activeSpiritLook];
  };

  const ghosts = [];

  const trail = [];
  const trailGfx = new PIXI.Graphics();
  trailGfx.blendMode = "add";
  trailLayer.addChild(trailGfx);
  const trailGlowTex = makeSoftGlowTexture();
  const trailGlows = [];
  const flowerTextures = [
    makePainterlyFlowerTexture(0),
    makePainterlyFlowerTexture(1),
    makePainterlyFlowerTexture(2),
    makePainterlyFlowerTexture(3),
    makePainterlyFlowerTexture(4),
  ];
  const flowers = [];
  const treeTextures = [makePainterlyTreeTexture(0), makePainterlyTreeTexture(1), makePainterlyTreeTexture(2)];
  const trees = [];
  const bloomBursts = [];

  const essences = [];
  const boosterDrops = [];
  let boosterDropTimerMs = 4500 + Math.random() * 3000;
  const essenceTex = makeWorldEssenceTexture();
  const critterTextures = [0, 1, 2, 3, 4, 5].map((k) => makeCritterTexture(k));
  const worldCritters = [];
  let commonCritterTimerMs = 11000 + Math.random() * 14000;
  // Specials are the large "magical creatures" (kind 4+). Keep them common.
  let specialCritterTimerMs = 22000 + Math.random() * 42000;
  /** Periodic “surprise” — extra essence + bloom so the world feels less static. */
  let surpriseTimerMs = 36000 + Math.random() * 24000;
  let collectedCrittersCommon = 0;
  let collectedCrittersRare = 0;
  const COMMON_CRITTER_SCALE_MUL = 2;
  const SPECIAL_SURPRISE_SCALE_MUL = 3;
  const ambientMotes = [];
  const playerMotes = [];
  const lifeAuras = [];

  const pointer = { x: app.screen.width * 0.5, y: app.screen.height * 0.5 };
  const keys = new Set();
  let boostHeld = false;
  const velocity = { x: 0, y: 0 };
  let energy = 0;
  let level = 1;
  let hintOverrideMs = 0;
  let helpPanelOpen = false;
  let menuOpen = false;

  const weather = { kind: "sunny", timer: 65000 };
  /** Global tuning: lower = slower restoration (all sources scale here). */
  const BASE_WORLD_GAIN_SCALE = 0.064;
  let helperPresenceCount = 1;
  let helperMultiplier = 1;
  let coopResonanceTimerMs = 6200;
  let coopHintShown = false;
  /** @type {{ name: string }[]} */
  let presencePeers = [];
  let playerDisplayName = flowPlayerName;
  let gameModeId = initialGameModeId;
  let gameModeLabel = initialGameModeLabel;

  /** Bottom boosters — consumable-style counts (UI); gameplay hooks below. */
  const LURE_DURATION_MS = 12000;
  const SURGE_DURATION_MS = 6500;
  let lureCharges = 1;
  let surgeCharges = 1;
  let sightCharges = 1;
  const LURE_MAX = 12;
  const SURGE_MAX = 10;
  const SIGHT_MAX = 8;
  let lureActiveMs = 0;
  let surgeBoostMs = 0;
  let lureFxTimerMs = 0;
  let surgeFxTimerMs = 0;
  let lurePulseMs = 0;
  let surgePulseMs = 0;
  let sightPulseMs = 0;
  /** 0–2: wider field of view when using Sight. */
  let sightZoomStep = 0;

  const truncHudName = (s, max = 13) => {
    const t = (s || "").trim() || "Guest";
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  };

  const presenceSub = subscribeRestorationPresence(flowPlayerName, (u) => {
    helperPresenceCount = u.count;
    helperMultiplier = u.multiplier;
    presencePeers = u.peers;
  });

  let worldLife = 0;
  const worldMilestones = [25, 50, 75];
  let nextMilestoneIdx = 0;
  let hasAwakened = false;
  let awakeningActive = false;
  let awakeningElapsed = 0;
  let awakeningBoost = 0;
  let eventSuppress = 0;
  let naturalBloomTimer = 4000 + Math.random() * 2000;
  let afterglowMotesAdded = false;
  const AWAKENING_TOTAL_MS = 4200;
  let worldCycle = 0;
  let worldVariation = 0;
  let worldResetPendingMs = 0;
  let firstMoveReactionShown = false;
  const progression = loadProgression();
  let spiritStrength = Math.min(12, progression.spiritStrength);
  let totalAwakenings = progression.totalAwakenings;
  let worldStage = Math.min(4, Math.floor(totalAwakenings / 2));
  let stageBoostSaturation = 0;
  let microBloomTimerMs = 900;
  let trailIntersectFxTimerMs = 0;
  let sessionPlayedMs = 0;
  let dailyBonusPending = progression.lastDailyBonusDay !== dayKey(Date.now());
  const offlineElapsedMs = progression.lastSeenAt > 0 ? Math.max(0, Date.now() - progression.lastSeenAt) : 0;
  let offlineGrowthPending = Math.min(16, (offlineElapsedMs / (1000 * 60 * 60)) * 0.7);
  let returnHintPending = dailyBonusPending || offlineGrowthPending > 0.5;
  /** Energy thresholds for levels 2–4 (shown in HUD). */
  const LEVEL_ENERGY_THRESHOLDS = [30, 70, 120];

  const toastText = new PIXI.Text({
    text: "",
    style: {
      fill: 0xd8f0e4,
      fontFamily: "Montserrat",
      fontSize: 13,
      fontWeight: "500",
      align: "center",
      wordWrap: true,
      wordWrapWidth: 560,
    },
  });
  toastText.anchor.set(0.5, 0);
  const critterGuide = new PIXI.Graphics();
  critterGuide.alpha = 0;
  uiLayer.addChild(critterGuide);

  const worldBarBg = new PIXI.Graphics();
  const worldBarFill = new PIXI.Graphics();
  const worldBarLabel = new PIXI.Text({
    text: "World Awakening",
    style: { fill: 0xe5ffe3, fontFamily: "Montserrat", fontSize: 12, fontWeight: "600" },
  });
  uiLayer.addChild(worldBarBg);
  uiLayer.addChild(worldBarFill);
  uiLayer.addChild(worldBarLabel);

  const milestoneText = new PIXI.Text({
    text: "",
    style: { fill: 0xeeffe9, fontFamily: "Montserrat", fontSize: 28, fontWeight: "600" },
  });
  milestoneText.anchor.set(0.5);
  milestoneText.alpha = 0;
  uiLayer.addChild(milestoneText);
  const screenGlow = new PIXI.Graphics();
  screenGlow.alpha = 0;
  uiLayer.addChild(screenGlow);
  const awakeningWave = new PIXI.Sprite(trailGlowTex);
  awakeningWave.anchor.set(0.5);
  awakeningWave.alpha = 0;
  awakeningWave.tint = 0xd8ffe8;
  awakeningWave.blendMode = "screen";
  uiLayer.addChild(awakeningWave);

  const miniMapBg = new PIXI.Graphics();
  const miniMapDots = new PIXI.Graphics();
  const miniMapTex = PIXI.Texture.from(lifeCanvas.canvas);
  const miniMap = new PIXI.Sprite(miniMapTex);
  miniMap.alpha = 0.48;
  miniMap.tint = 0xb8d6be;

  const HUD_SHIFT_Y = 40;

  const hudPanel = new PIXI.Graphics();
  const leaderboardHeader = new PIXI.Text({
    text: "",
    style: { fill: 0xe8fff0, fontFamily: "Montserrat", fontSize: 12, fontWeight: "600" },
  });
  const leaderboardSub = new PIXI.Text({
    text: "",
    style: { fontFamily: "Montserrat", fontSize: 10, fill: 0x9ec4ae, fontWeight: "500" },
  });
  const leaderboardList = new PIXI.Text({
    text: "",
    style: {
      fill: 0xc8e8d4,
      fontFamily: "Montserrat",
      fontSize: 11,
      fontWeight: "500",
      lineHeight: 15,
      wordWrap: true,
      wordWrapWidth: 214,
    },
  });
  const leaderboardSelfRow = new PIXI.Text({
    text: "",
    style: { fill: 0xffe8a8, fontFamily: "Montserrat", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  });
  const leaderboardHi = new PIXI.Graphics();
  const leftHud = new PIXI.Container();
  leftHud.addChild(hudPanel);
  leftHud.addChild(leaderboardHi);
  leftHud.addChild(leaderboardHeader);
  leftHud.addChild(leaderboardSub);
  leftHud.addChild(leaderboardList);
  leftHud.addChild(leaderboardSelfRow);
  uiLayer.addChild(leftHud);

  const rightHud = new PIXI.Container();
  const currencyBg = new PIXI.Graphics();
  const currencyIcon = new PIXI.Sprite(essenceTex);
  currencyIcon.anchor.set(0.5);
  const surprisesBg = new PIXI.Graphics();
  const surprisesIcon = new PIXI.Graphics();
  const currencyLabel = new PIXI.Text({
    text: "Essence",
    style: { fontFamily: "Montserrat", fontSize: 10, fill: 0xa8d4bc, fontWeight: "600" },
  });
  const currencyValue = new PIXI.Text({
    text: "0",
    style: {
      fontFamily: "Montserrat",
      fontSize: 18,
      fontWeight: "700",
      fill: 0xfff8e0,
      dropShadow: { alpha: 0.35, angle: Math.PI / 2, blur: 3, color: 0x0a3018, distance: 1 },
    },
  });
  const surprisesLabel = new PIXI.Text({
    text: "Magical creatures",
    style: { fontFamily: "Montserrat", fontSize: 10, fill: 0xa8d4bc, fontWeight: "600" },
  });
  const surprisesValue = new PIXI.Text({
    text: "0",
    style: {
      fontFamily: "Montserrat",
      fontSize: 18,
      fontWeight: "700",
      fill: 0xfff8e0,
      dropShadow: { alpha: 0.35, angle: Math.PI / 2, blur: 3, color: 0x0a3018, distance: 1 },
    },
  });
  rightHud.addChild(currencyBg);
  rightHud.addChild(currencyIcon);
  rightHud.addChild(currencyLabel);
  rightHud.addChild(currencyValue);
  rightHud.addChild(surprisesBg);
  rightHud.addChild(surprisesIcon);
  rightHud.addChild(surprisesLabel);
  rightHud.addChild(surprisesValue);
  rightHud.addChild(miniMapBg);
  rightHud.addChild(miniMap);
  rightHud.addChild(miniMapDots);
  uiLayer.addChild(rightHud);

  const helpTitle = new PIXI.Text({
    text: "How to play",
    style: { fill: 0xe8fff0, fontFamily: "Montserrat", fontSize: 22, fontWeight: "600" },
  });
  const helpBody = new PIXI.Text({
    text: "",
    style: {
      fill: 0xc8ead4,
      fontFamily: "Montserrat",
      fontSize: 15,
      fontWeight: "500",
      lineHeight: 23,
      wordWrap: true,
      wordWrapWidth: 460,
    },
  });
  const helpHint = new PIXI.Text({
    text: "Click outside or press Esc to close",
    style: { fill: 0x8ab89a, fontFamily: "Montserrat", fontSize: 12, fontWeight: "500" },
  });
  const helpPanelGfx = new PIXI.Graphics();
  const helpPanelInner = new PIXI.Container();
  helpPanelInner.eventMode = "static";
  helpPanelInner.cursor = "default";
  helpPanelInner.on("pointerdown", (e) => e.stopPropagation());
  const helpDim = new PIXI.Graphics();
  helpDim.eventMode = "static";
  helpDim.cursor = "pointer";
  helpDim.on("pointerdown", () => {
    helpPanelOpen = false;
    helpOverlay.visible = false;
  });
  const helpOverlay = new PIXI.Container();
  helpOverlay.visible = false;
  helpOverlay.addChild(helpDim);
  helpOverlay.addChild(helpPanelInner);
  helpPanelInner.addChild(helpPanelGfx);
  helpPanelInner.addChild(helpTitle);
  helpPanelInner.addChild(helpBody);
  helpPanelInner.addChild(helpHint);

  const buildHelpBodyText = () =>
    [
      "GOAL",
      "Fill World Awakening (top bar) to 100%. The world answers with a Great Bloom.",
      "",
      "CONTROLS",
      "Move with the pointer, or WASD. Hold Space (or hold mouse) to boost.",
      "",
      "COLLECT",
      "Yellow essence: Energy and world restoration. Small animals you meet add extra restoration (tracked in play, not on the main HUD).",
      "",
      "LEVELS",
      `Rise at Energy ${LEVEL_ENERGY_THRESHOLDS.join(", ")}. Higher levels: stronger glow and faster life paint.`,
      "",
      "OTHER SPIRITS",
      "Top-left lists spirits in your session (you’re highlighted). Growing together is stronger: nearby spirits create co-op resonance that speeds awakening.",
    ].join("\n");

  const layoutHelpOverlay = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    helpDim.clear();
    helpDim.rect(0, 0, w, h).fill({ color: 0x061208, alpha: 0.78 });
    const pw = Math.min(520, w - 28);
    helpBody.style.wordWrapWidth = pw - 40;
    helpBody.text = buildHelpBodyText();
    const pad = 22;
    const titleH = 36;
    helpTitle.x = pad;
    helpTitle.y = pad;
    helpBody.x = pad;
    helpBody.y = pad + titleH;
    helpHint.x = pad;
    helpHint.y = helpBody.y + helpBody.height + 12;
    const boxW = pw;
    const boxH = helpHint.y + helpHint.height + pad;
    helpPanelGfx.clear();
    helpPanelGfx.roundRect(0, 0, boxW, boxH, 16).fill({ color: 0x13251a, alpha: 0.96 });
    helpPanelGfx.roundRect(0, 0, boxW, boxH, 16).stroke({ width: 1, color: 0x9ed9b0, alpha: 0.35 });
    helpPanelInner.x = w * 0.5 - boxW * 0.5;
    helpPanelInner.y = h * 0.5 - boxH * 0.5;
  };

  const menuBackdrop = new PIXI.Graphics();
  menuBackdrop.eventMode = "static";
  menuBackdrop.cursor = "default";
  menuBackdrop.visible = false;
  menuBackdrop.on("pointerdown", () => {
    menuOpen = false;
    menuBackdrop.visible = false;
    menuDropdown.visible = false;
  });

  const menuDropdown = new PIXI.Container();
  menuDropdown.visible = false;
  menuDropdown.eventMode = "static";
  menuDropdown.on("pointerdown", (e) => e.stopPropagation());
  const menuPanelBg = new PIXI.Graphics();
  const menuItemStyle = { fill: 0xd8f0e4, fontFamily: "Montserrat", fontSize: 14, fontWeight: "500" };
  const menuProfile = new PIXI.Text({ text: "Profile", style: menuItemStyle });
  const menuLogout = new PIXI.Text({ text: "Logout", style: menuItemStyle });
  const menuRowH = 36;
  const menuPad = 12;
  const menuW = 176;
  for (const t of [menuProfile, menuLogout]) {
    t.eventMode = "static";
    t.cursor = "pointer";
  }
  menuProfile.on("pointerdown", (e) => {
    e.stopPropagation();
    menuOpen = false;
    menuBackdrop.visible = false;
    menuDropdown.visible = false;
    onFlowProfile();
  });
  menuLogout.on("pointerdown", (e) => {
    e.stopPropagation();
    menuOpen = false;
    menuBackdrop.visible = false;
    menuDropdown.visible = false;
    onFlowLogout();
  });
  menuDropdown.addChild(menuPanelBg);
  menuDropdown.addChild(menuProfile);
  menuDropdown.addChild(menuLogout);

  const menuBtn = new PIXI.Container();
  menuBtn.eventMode = "static";
  menuBtn.cursor = "pointer";
  const menuBtnBg = new PIXI.Graphics();
  const menuBtnIcon = new PIXI.Text({
    text: "☰",
    style: { fill: 0xeafff0, fontFamily: "Montserrat", fontSize: 22, fontWeight: "600" },
  });
  menuBtnIcon.anchor.set(0.5);
  menuBtn.addChild(menuBtnBg);
  menuBtn.addChild(menuBtnIcon);
  menuBtn.on("pointerdown", (e) => {
    e.stopPropagation();
    menuOpen = !menuOpen;
    menuBackdrop.visible = menuOpen;
    menuDropdown.visible = menuOpen;
    if (menuOpen) layoutMenuUI();
  });
  const feedbackQuickBtn = new PIXI.Container();
  feedbackQuickBtn.eventMode = "static";
  feedbackQuickBtn.cursor = "pointer";
  const feedbackQuickBg = new PIXI.Graphics();
  const feedbackQuickText = new PIXI.Text({
    text: "Feedback",
    style: { fill: 0xd8f0e4, fontFamily: "Montserrat", fontSize: 12, fontWeight: "600" },
  });
  feedbackQuickText.anchor.set(0.5);
  feedbackQuickBtn.addChild(feedbackQuickBg);
  feedbackQuickBtn.addChild(feedbackQuickText);
  feedbackQuickBtn.on("pointerdown", (e) => {
    e.stopPropagation();
    onFlowFeedback();
  });
  feedbackQuickBtn.on("pointerover", () => {
    feedbackQuickBg.clear();
    feedbackQuickBg.roundRect(0, 0, 96, 32, 10).fill({ color: 0x214a36, alpha: 0.94 });
    feedbackQuickBg.roundRect(0, 0, 96, 32, 10).stroke({ width: 1, color: 0xbff2cf, alpha: 0.62 });
  });
  feedbackQuickBtn.on("pointerout", () => {
    feedbackQuickBg.clear();
    feedbackQuickBg.roundRect(0, 0, 96, 32, 10).fill({ color: 0x1a3d2c, alpha: 0.92 });
    feedbackQuickBg.roundRect(0, 0, 96, 32, 10).stroke({ width: 1, color: 0x9fdcb2, alpha: 0.46 });
  });

  const boosterD = 56;
  const bottomHud = new PIXI.Container();
  const drawBoosterBg = (g, hover, enabled) => {
    g.clear();
    const a = enabled ? (hover ? 0.2 : 0.12) : 0.05;
    g.circle(boosterD * 0.5, boosterD * 0.5, boosterD * 0.48).fill({ color: 0xffffff, alpha: a });
  };
  /**
   * @param {string} iconChar
   * @param {string} startBadge
   * @param {() => void} onTap
   * @param {string} hotkey
   * @param {string} label
   */
  const makeBoosterSlot = (iconChar, startBadge, onTap, hotkey, label) => {
    const wrap = new PIXI.Container();
    const halo = new PIXI.Graphics();
    const bg = new PIXI.Graphics();
    const ic = new PIXI.Text({ text: iconChar, style: { fontSize: 25 } });
    ic.anchor.set(0.5);
    ic.x = boosterD * 0.5;
    ic.y = boosterD * 0.5;
    halo.circle(boosterD * 0.5, boosterD * 0.5, boosterD * 0.72).fill({ color: 0xbce8ff, alpha: 0.22 });
    halo.filters = [
      new GlowFilter({
        color: 0xe8f7ff,
        distance: 24,
        outerStrength: 1.8,
        innerStrength: 0.35,
        quality: 0.18,
      }),
    ];
    const badge = new PIXI.Graphics();
    const bt = new PIXI.Text({
      text: startBadge,
      style: { fontFamily: "Montserrat", fontSize: 11, fontWeight: "700", fill: 0x0a1010 },
    });
    bt.anchor.set(0.5);
    bt.x = boosterD - 8;
    bt.y = boosterD - 8;
    badge.circle(boosterD - 8, boosterD - 8, 10).fill({ color: 0xfafefe, alpha: 0.95 });
    const hkBg = new PIXI.Graphics();
    const hkX = Math.round(boosterD * 0.5 + 18);
    const hkY = Math.round(boosterD * 0.5 + 18);
    hkBg.roundRect(hkX - 10, hkY - 8, 20, 16, 6).fill({ color: 0x102318, alpha: 0.92 });
    hkBg.roundRect(hkX - 10, hkY - 8, 20, 16, 6).stroke({ width: 1, color: 0xe8fff0, alpha: 0.62 });
    const hk = new PIXI.Text({
      text: hotkey,
      style: {
        fontFamily: "Montserrat",
        fontSize: 12,
        fontWeight: "800",
        fill: 0xffffff,
        stroke: { color: 0x0a1410, width: 2, join: "round" },
      },
    });
    hk.anchor.set(0.5);
    hk.resolution = 2;
    hk.alpha = 0.98;
    hk.x = hkX;
    hk.y = hkY;
    const lb = new PIXI.Text({
      text: label,
      style: { fontFamily: "Montserrat", fontSize: 10, fontWeight: "600", fill: 0xb8dccc },
    });
    lb.anchor.set(0.5);
    lb.x = boosterD * 0.5;
    lb.y = boosterD + 24;
    const timerBack = new PIXI.Graphics();
    const timerFill = new PIXI.Graphics();
    wrap.addChild(halo);
    wrap.addChild(bg);
    wrap.addChild(ic);
    wrap.addChild(badge);
    wrap.addChild(bt);
    wrap.addChild(hkBg);
    wrap.addChild(hk);
    wrap.addChild(lb);
    wrap.addChild(timerBack);
    wrap.addChild(timerFill);
    wrap.eventMode = "static";
    wrap.cursor = "pointer";
    wrap.hitArea = new PIXI.Rectangle(0, 0, boosterD, boosterD + 34);
    let enabled = true;
    let active = false;
    const phase = Math.random() * Math.PI * 2;
    const paint = (hover) => drawBoosterBg(bg, hover, enabled);
    paint(false);
    wrap.on("pointerover", () => paint(true));
    wrap.on("pointerout", () => paint(false));
    wrap.on("pointerdown", (e) => {
      e.stopPropagation();
      if (gamePaused) return;
      onTap();
    });
    const drawTimer = (progress) => {
      timerBack.clear();
      timerFill.clear();
      if (progress <= 0.001) return;
      const p = Math.max(0, Math.min(1, progress));
      const tw = 34;
      const th = 4;
      const tx = boosterD * 0.5 - tw * 0.5;
      const ty = boosterD - 8;
      timerBack.roundRect(tx, ty, tw, th, 3).fill({ color: 0x06120d, alpha: 0.72 });
      timerFill.roundRect(tx, ty, tw * p, th, 3).fill({ color: 0x9ee8a8, alpha: 0.95 });
    };
    return {
      wrap,
      setBadge: (t) => {
        bt.text = t;
      },
      setEnabled: (v) => {
        enabled = v;
        wrap.eventMode = v ? "static" : "passive";
        wrap.cursor = v ? "pointer" : "default";
        ic.alpha = v ? 1 : 0.6;
        paint(false);
      },
      setActive: (v) => {
        active = v;
      },
      updateHalo: (timeMs) => {
        const breathe = 0.5 + Math.sin(timeMs * 0.0022 + phase) * 0.5;
        const target = !enabled ? 0.03 : active ? 0.28 + breathe * 0.22 : 0.06 + breathe * 0.05;
        halo.alpha += (target - halo.alpha) * 0.18;
      },
      setTimerProgress: (progress) => drawTimer(progress),
    };
  };
  const fireLure = () => {
    if (lureCharges <= 0) {
      hintOverrideMs = 2200;
      toastText.text = "Lure is empty. Find a blossom pickup.";
      return;
    }
    lureCharges -= 1;
    lureActiveMs = LURE_DURATION_MS;
    lureFxTimerMs = 0;
    lurePulseMs = 700;
    sounds.playEffect("collect", 0.55);
    hintOverrideMs = 2400;
    toastText.text = "Lure active: larger essence pickup radius.";
    spawnBloomEvent(player.x, player.y, 1.05, { awardWorldLife: false, particleMult: 1.05 });
    screenGlowMs = Math.max(screenGlowMs, 220);
  };
  const fireSurge = () => {
    if (surgeCharges <= 0) {
      hintOverrideMs = 2200;
      toastText.text = "Surge is empty. Find a spark pickup.";
      return;
    }
    surgeCharges -= 1;
    surgeBoostMs = SURGE_DURATION_MS;
    surgeFxTimerMs = 0;
    surgePulseMs = 760;
    hintOverrideMs = 1800;
    toastText.text = "Surge active: faster movement for a short burst.";
    spawnBloomEvent(player.x, player.y, 1.2, { awardWorldLife: false, particleMult: 1.15 });
    screenGlowMs = Math.max(screenGlowMs, 320);
  };
  const fireSight = () => {
    if (sightCharges <= 0) {
      hintOverrideMs = 2200;
      toastText.text = "Sight is empty. Find an eye pickup.";
      return;
    }
    sightCharges -= 1;
    sightPulseMs = 680;
    sightZoomStep = (sightZoomStep + 1) % 3;
    hintOverrideMs = 2200;
    const sightNames = ["Near view", "Balanced view", "Far view"];
    toastText.text = `Sight active: ${sightNames[sightZoomStep]}.`;
    spawnBloomEvent(player.x, player.y, 0.95, { awardWorldLife: false, particleMult: 0.9 });
  };
  const boosterLure = makeBoosterSlot("🌸", String(lureCharges), fireLure, "Z", "Lure");
  const boosterSurge = makeBoosterSlot("⚡", String(surgeCharges), fireSurge, "X", "Surge");
  const boosterSight = makeBoosterSlot("◇", String(sightCharges), fireSight, "C", "Sight");
  bottomHud.addChild(boosterLure.wrap);
  bottomHud.addChild(boosterSurge.wrap);
  bottomHud.addChild(boosterSight.wrap);

  rightHud.addChild(menuBtn);
  rightHud.addChild(feedbackQuickBtn);
  uiLayer.addChild(bottomHud);
  uiLayer.addChild(menuBackdrop);
  uiLayer.addChild(menuDropdown);
  uiLayer.addChild(helpOverlay);
  uiLayer.addChild(toastText);

  const layoutMenuUI = () => {
    const hb = 44;
    menuBtnBg.clear();
    menuBtnBg.roundRect(0, 0, hb, hb, 12).fill({ color: 0x1a3d2c, alpha: 0.9 });
    menuBtnBg.roundRect(0, 0, hb, hb, 12).stroke({ width: 1, color: 0xa8e8c0, alpha: 0.5 });
    menuBtnIcon.x = hb * 0.5;
    menuBtnIcon.y = hb * 0.5;
    const boxH = menuPad * 2 + menuRowH * 2;
    menuPanelBg.clear();
    menuPanelBg.roundRect(0, 0, menuW, boxH, 12).fill({ color: 0x13251a, alpha: 0.96 });
    menuPanelBg.roundRect(0, 0, menuW, boxH, 12).stroke({ width: 1, color: 0x9ed9b0, alpha: 0.35 });
    menuProfile.x = menuPad;
    menuProfile.y = menuPad;
    menuLogout.x = menuPad;
    menuLogout.y = menuPad + menuRowH;
    menuDropdown.x = menuBtn.x - menuW + hb;
    menuDropdown.y = menuBtn.y + hb + 6;
    feedbackQuickBg.clear();
    feedbackQuickBg.roundRect(0, 0, 96, 32, 10).fill({ color: 0x1a3d2c, alpha: 0.92 });
    feedbackQuickBg.roundRect(0, 0, 96, 32, 10).stroke({ width: 1, color: 0x9fdcb2, alpha: 0.46 });
    feedbackQuickText.x = 48;
    feedbackQuickText.y = 16;
    menuBackdrop.clear();
    menuBackdrop.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x061208, alpha: 0.4 });
  };

  const layoutUI = () => {
    const h = HUD_SHIFT_Y;
    const topY = 10 + h;
    const pad = 10;
    const lbW = Math.min(228, Math.floor(app.screen.width * 0.48));
    const LB_H = 192;
    leaderboardHeader.x = pad + 12;
    leaderboardHeader.y = topY;
    leaderboardSub.x = pad + 12;
    leaderboardSub.y = topY + 18;
    leaderboardList.x = pad + 12;
    leaderboardList.y = topY + 36;
    leaderboardList.style.wordWrapWidth = lbW - 20;
    hudPanel.clear();
    hudPanel.roundRect(pad, topY, lbW, LB_H, 10).fill({ color: 0x10271b, alpha: 0.42 });
    hudPanel.roundRect(pad, topY, lbW, LB_H, 10).stroke({ width: 1, color: 0xb5e8b7, alpha: 0.22 });

    const marginR = 14;
    const hb = 44;
    const menuX = app.screen.width - marginR - hb;
    menuBtn.x = menuX;
    menuBtn.y = topY;
    feedbackQuickBtn.x = menuX - 102;
    feedbackQuickBtn.y = topY + 6;
    const currencyW = 140;
    const currencyH = 40;
    const currencyX = app.screen.width - marginR - currencyW;
    const currencyY = topY + hb + 8;
    currencyBg.clear();
    currencyBg.roundRect(0, 0, currencyW, currencyH, 12).fill({ color: 0x13251a, alpha: 0.92 });
    currencyBg.roundRect(0, 0, currencyW, currencyH, 12).stroke({ width: 1, color: 0xd8c878, alpha: 0.3 });
    currencyBg.x = currencyX;
    currencyBg.y = currencyY;
    currencyIcon.x = currencyX + 18;
    currencyIcon.y = currencyY + currencyH * 0.5;
    currencyIcon.scale.set(0.23);
    currencyIcon.alpha = 0.98;
    currencyLabel.x = currencyX + 34;
    currencyLabel.y = currencyY + 5;
    currencyValue.x = currencyX + 34;
    currencyValue.y = currencyY + 17;
    const surprisesY = currencyY + currencyH + 8;
    surprisesBg.clear();
    surprisesBg.roundRect(0, 0, currencyW, currencyH, 12).fill({ color: 0x13251a, alpha: 0.92 });
    surprisesBg.roundRect(0, 0, currencyW, currencyH, 12).stroke({ width: 1, color: 0xd8c878, alpha: 0.3 });
    surprisesBg.x = currencyX;
    surprisesBg.y = surprisesY;
    surprisesIcon.clear();
    surprisesIcon.circle(currencyX + 18, surprisesY + currencyH * 0.5, 9).fill({ color: 0xffe8a8, alpha: 0.98 });
    surprisesIcon.circle(currencyX + 18, surprisesY + currencyH * 0.5, 9).stroke({ width: 1, color: 0xfff0c8, alpha: 0.45 });
    surprisesLabel.x = currencyX + 34;
    surprisesLabel.y = surprisesY + 5;
    surprisesValue.x = currencyX + 34;
    surprisesValue.y = surprisesY + 17;

    const s = Math.min(118, Math.max(88, Math.floor(app.screen.height * 0.19)));
    const miniMapX = app.screen.width - marginR - s;
    const miniMapY = surprisesY + currencyH + 12;
    miniMap.x = miniMapX;
    miniMap.y = miniMapY;
    miniMap.width = s;
    miniMap.height = s;
    miniMapBg.clear();
    miniMapBg.roundRect(miniMapX - 6, miniMapY - 6, s + 12, s + 12, 8).fill({ color: 0x11281c, alpha: 0.32 });
    miniMapBg.roundRect(miniMapX - 6, miniMapY - 6, s + 12, s + 12, 8).stroke({ width: 1, color: 0xb8f7be, alpha: 0.12 });

    const gap = 10;
    const totalW = 3 * boosterD + 2 * gap;
    const startX = (app.screen.width - totalW) * 0.5;
    const baseBottom = app.screen.height - 30;
    boosterLure.wrap.x = startX;
    boosterSurge.wrap.x = startX + boosterD + gap;
    boosterSight.wrap.x = startX + 2 * (boosterD + gap);
    const arc = 8;
    boosterLure.wrap.y = baseBottom - boosterD - 12 + arc * 0.45;
    boosterSurge.wrap.y = baseBottom - boosterD - 12 - arc;
    boosterSight.wrap.y = baseBottom - boosterD - 12 + arc * 0.45;
    layoutMenuUI();
    toastText.style.wordWrapWidth = Math.min(560, app.screen.width - 36);
    toastText.x = app.screen.width * 0.5;
    const boosterTopY = Math.min(boosterLure.wrap.y, boosterSurge.wrap.y, boosterSight.wrap.y);
    toastText.y = Math.max(72 + h, boosterTopY - 54);
    if (helpPanelOpen) layoutHelpOverlay();

    const barW = Math.min(280, Math.max(120, app.screen.width - lbW - 132 - 28));
    const barH = 10;
    const bx = app.screen.width * 0.5 - barW * 0.5;
    const by = 14 + h;
    worldBarBg.clear();
    worldBarBg.roundRect(bx, by, barW, barH, 6).fill({ color: 0x10271b, alpha: 0.45 });
    worldBarBg.roundRect(bx, by, barW, barH, 6).stroke({ width: 1, color: 0xb8f7be, alpha: 0.2 });
    worldBarLabel.x = bx + barW * 0.5 - worldBarLabel.width * 0.5;
    worldBarLabel.y = by - 16;
    milestoneText.x = app.screen.width * 0.5;
    milestoneText.y = app.screen.height * 0.42;
    screenGlow.clear();
    screenGlow.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0xd8ffcf, alpha: 1 });
  };
  layoutUI();

  const syncPointer = (e) => {
    pointer.x = e.global.x;
    pointer.y = e.global.y;
  };
  /** Canvas-relative coords — robust when CSS scales the canvas or with density scaling. */
  const syncPointerFromClient = (clientX, clientY) => {
    const rect = app.canvas.getBoundingClientRect();
    const sx = ((clientX - rect.left) / Math.max(1e-6, rect.width)) * app.screen.width;
    const sy = ((clientY - rect.top) / Math.max(1e-6, rect.height)) * app.screen.height;
    pointer.x = sx;
    pointer.y = sy;
  };
  stage.eventMode = "static";
  stage.hitArea = app.screen;
  stage.on("pointermove", syncPointer);
  const onCanvasPointerMove = (ev) => syncPointerFromClient(ev.clientX, ev.clientY);
  app.canvas.addEventListener("pointermove", onCanvasPointerMove);

  const onKeyDown = (e) => {
    if (e.code === "Escape") {
      if (helpPanelOpen) {
        helpPanelOpen = false;
        helpOverlay.visible = false;
      } else if (menuOpen) {
        menuOpen = false;
        menuBackdrop.visible = false;
        menuDropdown.visible = false;
      }
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      boostHeld = true;
    }
    if (!gamePaused && !e.repeat) {
      if (e.code === "KeyZ") fireLure();
      if (e.code === "KeyX") fireSurge();
      if (e.code === "KeyC") fireSight();
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      keys.add(e.code);
    }
  };
  const onKeyUp = (e) => {
    if (e.code === "Space") boostHeld = false;
    keys.delete(e.code);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const onMouseDown = (e) => {
    if (e.button === 0) boostHeld = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) boostHeld = false;
  };
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);

  const rainDrops = [];
  const weatherVeil = new PIXI.Graphics();
  weatherLayer.addChild(weatherVeil);
  const sunnyGlow = new PIXI.Sprite(makeSoftGlowTexture());
  sunnyGlow.anchor.set(0.5);
  sunnyGlow.x = app.screen.width * 0.78;
  sunnyGlow.y = app.screen.height * 0.18;
  sunnyGlow.scale.set(8);
  sunnyGlow.alpha = 0;
  weatherLayer.addChild(sunnyGlow);
  const windStreaks = [];
  for (let i = 0; i < 34; i += 1) {
    const w = new PIXI.Graphics();
    w.moveTo(0, 0).lineTo(28 + Math.random() * 26, 0).stroke({ width: 1.2, color: 0xe6ffe8, alpha: 0.22 });
    w.x = Math.random() * app.screen.width;
    w.y = Math.random() * app.screen.height;
    w._vx = 2.2 + Math.random() * 1.8;
    w._vy = -0.2 + Math.random() * 0.4;
    windStreaks.push(w);
    weatherLayer.addChild(w);
  }
  const weatherVisual = {
    veilColor: 0xf9f2cd,
    veilAlpha: 0.04,
    rainAlpha: 0,
    sunAlpha: 0.14,
    windAlpha: 0,
    targetVeilColor: 0xf9f2cd,
    targetVeilAlpha: 0.04,
    targetRainAlpha: 0,
    targetSunAlpha: 0.14,
    targetWindAlpha: 0,
  };
  const spawnRain = () => {
    for (let i = 0; i < 120; i += 1) {
      const d = new PIXI.Graphics();
      const len = 10 + Math.random() * 18;
      d.moveTo(0, 0).lineTo(0, len).stroke({ width: 2.2, color: 0xa7dbff, alpha: 0.58 });
      d.x = Math.random() * app.screen.width;
      d.y = Math.random() * app.screen.height;
      // Keep rain mostly vertical; only a tiny horizontal drift.
      d._vx = (Math.random() - 0.5) * 0.12;
      d._vy = 3.2 + Math.random() * 1.8;
      weatherLayer.addChild(d);
      rainDrops.push(d);
    }
  };
  spawnRain();
  for (let i = 0; i < 140; i += 1) {
    const m = new PIXI.Sprite(trailGlowTex);
    m.anchor.set(0.5);
    m.x = (Math.random() * 2 - 1) * HALF_WORLD;
    m.y = (Math.random() * 2 - 1) * HALF_WORLD;
    m.scale.set(0.2 + Math.random() * 0.45);
    m.alpha = 0.05 + Math.random() * 0.12;
    m._phase = Math.random() * Math.PI * 2;
    m._vx = (Math.random() - 0.5) * 0.15;
    m._vy = (Math.random() - 0.5) * 0.15;
    ambientMotes.push(m);
    depthLayer.addChild(m);
  }

  let lifePaintTick = 0;
  let flowerSpawnStep = 0;
  let treeSpawnStep = 0;
  let bloomEventTimer = 5000;
  let bloomPulseMs = 0;
  let auraSpawnAccum = 0;
  let beatTimerMs = 0;
  let beatDurationMs = 1700 + Math.random() * 600;
  const player = { x: 0, y: 0 };
  const cam = { x: 0, y: 0, zoom: 0.65 };

  const addLifeAt = (wx, wy, rCells, amount) => {
    const { lx, ly } = worldToLife(wx, wy);
    for (let oy = -rCells; oy <= rCells; oy += 1) {
      for (let ox = -rCells; ox <= rCells; ox += 1) {
        const tx = lx + ox;
        const ty = ly + oy;
        if (tx < 0 || ty < 0 || tx >= LIFE_W || ty >= LIFE_H) continue;
        const d = Math.hypot(ox, oy);
        if (d > rCells) continue;
        const infl = (1 - d / rCells) * amount;
        const idx = ty * LIFE_W + tx;
        lifeField[idx] = clamp(lifeField[idx] + infl, 0, 1);
      }
    }
  };

  const sampleLife = (wx, wy) => {
    const { lx, ly } = worldToLife(wx, wy);
    return lifeField[ly * LIFE_W + lx];
  };

  const updateLifeTexture = () => {
    const { img, ctx, canvas } = lifeCanvas;
    const d = img.data;
    const stagePalettes = [
      { dead: [132, 112, 90], alive: [170, 224, 148] }, // soft meadow
      { dead: [122, 106, 82], alive: [156, 214, 126] }, // richer vegetation
      { dead: [112, 98, 74], alive: [126, 194, 108] }, // forest density
      { dead: [100, 104, 98], alive: [118, 194, 186] }, // water-light feel
      { dead: [88, 84, 96], alive: [142, 118, 202] }, // night bloom
    ];
    const pal = stagePalettes[worldStage] || stagePalettes[0];
    const sat = 1 + stageBoostSaturation * 0.16 + (worldLife / 100) * 0.18;
    for (let i = 0; i < lifeField.length; i += 1) {
      const v = lifeField[i];
      const rr = (pal.dead[0] + (pal.alive[0] - pal.dead[0]) * v) * sat;
      const gg = (pal.dead[1] + (pal.alive[1] - pal.dead[1]) * v) * sat;
      const bb = (pal.dead[2] + (pal.alive[2] - pal.dead[2]) * v) * sat;
      d[i * 4] = clamp(rr, 0, 255) | 0;
      d[i * 4 + 1] = clamp(gg, 0, 255) | 0;
      d[i * 4 + 2] = clamp(bb, 0, 255) | 0;
      d[i * 4 + 3] = 150;
    }
    ctx.putImageData(img, 0, 0);
    lifeTex.source.update();
    miniMapTex.source.resource = canvas;
    miniMapTex.source.update();
  };

  const maybeSpawnEssence = () => {
    if (essences.length > 45) return;
    const ix = (Math.random() * LIFE_W) | 0;
    const iy = (Math.random() * LIFE_H) | 0;
    const life = lifeField[iy * LIFE_W + ix];
    if (Math.random() > 1 - life * 0.8) return; // spawn more in dead places
    const w = lifeToWorld(ix, iy);
    const e = new PIXI.Sprite(essenceTex);
    e.anchor.set(0.5);
    e.x = w.x + (Math.random() - 0.5) * 36;
    e.y = w.y + (Math.random() - 0.5) * 36;
    e.scale.set(1.36 + Math.random() * 0.8);
    e.alpha = 0.92;
    e.blendMode = "add";
    e.tint = 0xf0ffb8;
    e._vx = (Math.random() - 0.5) * 0.4;
    e._vy = (Math.random() - 0.5) * 0.4;
    e._phase = Math.random() * Math.PI * 2;
    e._baseScale = e.scale.x;
    essences.push(e);
    particleLayer.addChild(e);
  };

  const spawnBoosterDrop = (type) => {
    if (boosterDrops.length >= 8) return;
    const ix = (Math.random() * LIFE_W) | 0;
    const iy = (Math.random() * LIFE_H) | 0;
    const w = lifeToWorld(ix, iy);
    const c = new PIXI.Container();
    const halo = new PIXI.Graphics();
    const g = new PIXI.Graphics();
    const icon = type === "lure" ? "🌸" : type === "surge" ? "⚡" : "◇";
    const tint = type === "lure" ? 0xff9ed0 : type === "surge" ? 0xffd878 : 0xb8e4ff;
    halo.circle(0, 0, 52).fill({ color: tint, alpha: 0.2 });
    halo.filters = [
      new GlowFilter({
        color: tint,
        distance: 28,
        outerStrength: 2.4,
        innerStrength: 0.4,
        quality: 0.18,
      }),
    ];
    g.circle(0, 0, 40).fill({ color: 0x163028, alpha: 0.24 });
    const t = new PIXI.Text({ text: icon, style: { fontSize: 40 } });
    t.anchor.set(0.5);
    t.alpha = 0.98;
    c.addChild(halo);
    c.addChild(g);
    c.addChild(t);
    c.x = w.x + (Math.random() - 0.5) * 30;
    c.y = w.y + (Math.random() - 0.5) * 30;
    c.alpha = 0.95;
    c._type = type;
    c._phase = Math.random() * Math.PI * 2;
    c._baseY = c.y;
    c._tint = tint;
    c.tint = tint;
    c.scale.set(1.45);
    c._spin = (Math.random() - 0.5) * 0.02;
    boosterDrops.push(c);
    particleLayer.addChild(c);
  };

  const setWeather = (kind) => {
    weather.kind = kind;
    weather.timer = 60000 + Math.random() * 30000;
    if (kind === "sunny") {
      weatherVisual.targetVeilColor = 0xfff4c7;
      weatherVisual.targetVeilAlpha = 0.04;
      weatherVisual.targetRainAlpha = 0;
      weatherVisual.targetSunAlpha = 0.18;
      weatherVisual.targetWindAlpha = 0;
    } else if (kind === "rain") {
      weatherVisual.targetVeilColor = 0xb7d1de;
      weatherVisual.targetVeilAlpha = 0.11;
      weatherVisual.targetRainAlpha = 1;
      weatherVisual.targetSunAlpha = 0.03;
      weatherVisual.targetWindAlpha = 0;
    } else {
      weatherVisual.targetVeilColor = 0xc9dfcb;
      weatherVisual.targetVeilAlpha = 0.065;
      weatherVisual.targetRainAlpha = 0;
      weatherVisual.targetSunAlpha = 0.07;
      weatherVisual.targetWindAlpha = 0.9;
    }
  };

  let awakeningSoundPlayed = false;

  function beginAwakening() {
    if (awakeningActive || hasAwakened) return;
    awakeningActive = true;
    awakeningElapsed = 0;
    awakeningSoundPlayed = true;
    milestoneText.style.fontSize = 34;
    milestoneText.text = "GREAT BLOOM\nThe world remembers";
    milestoneText.alpha = 0;
    screenGlowMs = 3200;
    spawnBloomEvent(player.x, player.y, 1.12, { awardWorldLife: false, playSound: false, particleMult: 1.05 });
    sounds.playEffect("bloom", 1.38);
    window.setTimeout(() => sounds.playEffect("bloom", 1.05), 220);
  }

  const spawnBloomEvent = (x, y, power = 1, opts = {}) => {
    power *= 1 + spiritStrength * 0.05;
    const awardWorldLife = opts.awardWorldLife !== false;
    const playSound = opts.playSound !== false;
    const affectedByBoost = opts.affectedByBoost !== false;
    const particleMult = opts.particleMult ?? 1;
    const boostMul = affectedByBoost ? 1 + awakeningBoost * 0.95 : 1;
    const nFlowers = Math.max(4, Math.floor(16 * particleMult * boostMul));
    const nHalos = Math.max(2, Math.floor(5 * particleMult * Math.min(1.15, boostMul)));

    addLifeAt(x, y, Math.round(8 * Math.min(1.2, power)), 0.12 * power);
    if (awardWorldLife) addWorldLife(0.5 * power);
    bloomPulseMs = Math.max(bloomPulseMs, 520 * (1 + awakeningBoost * 0.45));
    for (let i = 0; i < nFlowers; i += 1) {
      const p = new PIXI.Sprite(flowerTextures[(Math.random() * flowerTextures.length) | 0]);
      p.anchor.set(0.5);
      p.x = x;
      p.y = y;
      const flowerVis = 2.75;
      p.scale.set((0.26 + Math.random() * 0.28) * flowerVis * (particleMult < 0.75 ? 0.88 : 1));
      p.alpha = 0.94;
      p.blendMode = "normal";
      const a = (i / Math.max(1, nFlowers)) * Math.PI * 2 + Math.random() * 0.2;
      const sp = (1.2 + Math.random() * 2.6 * power) * (particleMult < 0.75 ? 0.62 : 1);
      p._vx = Math.cos(a) * sp;
      p._vy = Math.sin(a) * sp;
      p._age = 0;
      p._life = 1100 + Math.random() * 500;
      bloomBursts.push(p);
      particleLayer.addChild(p);
    }
    const ring = new PIXI.Sprite(trailGlowTex);
    ring.anchor.set(0.5);
    ring.x = x;
    ring.y = y;
    ring.scale.set(0.55 * (particleMult < 0.75 ? 0.75 : 1));
    ring.alpha = 0.75;
    ring._ring = true;
    ring._age = 0;
    ring._life = 900;
    bloomBursts.push(ring);
    particleLayer.addChild(ring);
    for (let i = 0; i < nHalos; i += 1) {
      const halo = new PIXI.Sprite(trailGlowTex);
      halo.anchor.set(0.5);
      halo.x = x + (Math.random() - 0.5) * 16;
      halo.y = y + (Math.random() - 0.5) * 16;
      halo.scale.set((0.44 + Math.random() * 0.34) * (particleMult < 0.75 ? 0.8 : 1));
      halo.alpha = 0.5;
      halo._ring = true;
      halo._age = 0;
      halo._life = 700 + Math.random() * 350;
      bloomBursts.push(halo);
      particleLayer.addChild(halo);
    }
    if (playSound) sounds.playEffect("bloom", affectedByBoost ? 1 : 0.72);
    onBloom?.();
  };

  const spawnNaturalBloom = (x, y) => {
    spawnBloomEvent(x, y, 0.48, {
      awardWorldLife: false,
      playSound: false,
      particleMult: 0.55,
      affectedByBoost: false,
    });
  };

  let screenGlowMs = 0;
  const triggerMilestone = () => {
    spawnBloomEvent(player.x, player.y, 1.8);
    sounds.playEffect("bloom");
    window.setTimeout(() => sounds.playEffect("bloom"), 120);
    screenGlowMs = Math.max(screenGlowMs, 520);
  };
  const addWorldLife = (amount) => {
    if (amount <= 0) return;
    const eff = amount * BASE_WORLD_GAIN_SCALE * helperMultiplier;
    const prev = worldLife;
    worldLife = clamp(worldLife + eff, 0, 100);
    if (worldLife < 95) hasAwakened = false;
    while (nextMilestoneIdx < worldMilestones.length && prev < worldMilestones[nextMilestoneIdx] && worldLife >= worldMilestones[nextMilestoneIdx]) {
      const ms = worldMilestones[nextMilestoneIdx];
      hintOverrideMs = Math.max(hintOverrideMs, 2200);
      if (ms === 25) toastText.text = "The meadow wakes - life stirs around you.";
      else if (ms === 50) toastText.text = "The world grows richer with every step.";
      else if (ms === 75) toastText.text = "Near full bloom - the world is almost singing.";
      triggerMilestone();
      nextMilestoneIdx += 1;
    }
    if (prev < 100 && worldLife >= 100 && !hasAwakened && !awakeningActive) beginAwakening();
  };

  const applyWorldVariation = () => {
    const stageVariants = [
      [0xe8fff0, 0xf2ffe2, 0xe6f8ff, 0xfff2e2],
      [0xe2ffd6, 0xe9ffd1, 0xe2f8d6, 0xf0ffd8],
      [0xd8f6d8, 0xd0f0cf, 0xcde8d0, 0xe0f0d8],
      [0xd8efff, 0xd6f9ff, 0xe0f6ff, 0xd8fff8],
      [0xd8d2ff, 0xe0d8ff, 0xd8d6ff, 0xe8dcff],
    ];
    const variants = stageVariants[worldStage] || stageVariants[0];
    bg.tint = variants[worldVariation % variants.length];
  };

  const resetWorldCycle = () => {
    worldCycle += 1;
    worldVariation = (worldVariation + 1) % 4;
    worldLife = 0;
    nextMilestoneIdx = 0;
    hasAwakened = false;
    awakeningActive = false;
    awakeningBoost = 0;
    eventSuppress = 0;
    naturalBloomTimer = 2200 + Math.random() * 1800;
    lifeField.fill(0.01);
    trailMemory.fill(0);
    trail.length = 0;
    treeSpawnStep = 0;
    trees.forEach((t) => t.destroy());
    trees.length = 0;
    triggerMilestone();
    updateLifeTexture();
    applyWorldVariation();
  };

  const sounds = createSoundManager();
  sounds.playAmbient();

  const MAGICAL_KINDS = new Set([0, 1, 2, 3, 4, 5]);
  const isMagicalCritter = (cr) => MAGICAL_KINDS.has(cr?._kind);
  const pickKind = (isSpecial) => {
    const magicalPool = [0, 1, 2, 3, 4, 5];
    const commonPool = [0, 1, 2, 3, 4, 5];
    const pool = isSpecial ? magicalPool : commonPool;
    return pool[(Math.random() * pool.length) | 0];
  };

  const spawnCritter = (isSpecial) => {
    const specialCount = worldCritters.reduce((acc, c) => acc + (c._special ? 1 : 0), 0);
    const commons = worldCritters.reduce((acc, c) => acc + (!c._special ? 1 : 0), 0);

    // Allow multiple magical creatures so they're not too rare.
    const maxSpecialCritters = 3;
    if (isSpecial && specialCount >= maxSpecialCritters) return;
    if (!isSpecial && commons >= 4) return;
    const maxCritters = isSpecial ? 12 : 6;
    if (worldCritters.length >= maxCritters) return;
    const kind = pickKind(isSpecial);
    const spr = new PIXI.Sprite(critterTextures[kind]);
    spr.anchor.set(0.5);
    const spread = 320 + Math.random() * 520;
    const ang = Math.random() * Math.PI * 2;
    spr.x = clamp(player.x + Math.cos(ang) * spread, -HALF_WORLD + 50, HALF_WORLD - 50);
    spr.y = clamp(player.y + Math.sin(ang) * spread, -HALF_WORLD + 50, HALF_WORLD - 50);
    const baseScale = 0.85 + Math.random() * 0.2;
    spr.scale.set(isSpecial ? baseScale * SPECIAL_SURPRISE_SCALE_MUL : baseScale);
    spr._kind = kind;
    spr._special = MAGICAL_KINDS.has(kind);
    spr._phase = Math.random() * Math.PI * 2;
    spr._hop = 0;
    spr._vx = (Math.random() - 0.5) * 0.35;
    spr._vy = (Math.random() - 0.5) * 0.35;
    spr.tint = spr._special ? 0xffffff : 0xe8fff0;
    spr.alpha = 0.94;
    worldCritters.push(spr);
    critterLayer.addChild(spr);
    if (window.localStorage?.getItem("debug_critter_children") === "1") {
      const labels = spr.children.map((ch, i) => ch?.label || ch?.name || ch?.constructor?.name || `child-${i}`);
      // Helps inspect unexpected overlays attached by future changes.
      console.log("[critter children]", { kind: spr._kind, special: spr._special, children: labels });
    }
  };

  const spawnLifeAura = (x, y, strength = 1) => {
    const progress = worldLife / 100;
    const afterglowAura = hasAwakened ? 0.14 : 0;
    const ab = awakeningBoost * 0.32;
    const aura = new PIXI.Sprite(trailGlowTex);
    aura.anchor.set(0.5);
    aura.x = x + (Math.random() - 0.5) * 8;
    aura.y = y + (Math.random() - 0.5) * 8;
    aura.scale.set((0.42 + Math.random() * 0.28) * strength * (0.9 + progress * 0.45) * (1 + afterglowAura + ab));
    aura.alpha = 0.28 * strength * (0.9 + progress * 0.5) * (1 + afterglowAura + ab);
    aura.blendMode = "screen";
    aura._age = 0;
    aura._life = 2200 + Math.random() * 1800;
    lifeAuras.push(aura);
    lifeAuraLayer.addChild(aura);
  };

  updateLifeTexture();
  if (Array.isArray(progression.worldMemoryTrail) && progression.worldMemoryTrail.length > 0) {
    const remembered = progression.worldMemoryTrail.slice(-36);
    for (let i = 0; i < remembered.length; i += 1) {
      const p = remembered[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
      const tex = flowerTextures[(Math.random() * flowerTextures.length) | 0];
      const f = new PIXI.Sprite(tex);
      f.anchor.set(0.5);
      f.x = clamp(p.x, -HALF_WORLD + 24, HALF_WORLD - 24);
      f.y = clamp(p.y, -HALF_WORLD + 24, HALF_WORLD - 24);
      f.rotation = Math.random() * Math.PI * 2;
      f.scale.set(0.65 + Math.random() * 0.4);
      f.alpha = 0.32 + Math.random() * 0.18;
      f._age = 12000 + Math.random() * 6000;
      flowers.push(f);
      floraLayer.addChild(f);
      addLifeAt(f.x, f.y, 2.6, 0.02);
    }
    updateLifeTexture();
  }

  const redrawBackdropTint = () => {
    bgTint.clear();
    bgTint.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x3f6f56, alpha: 0.05 });
    weatherVeil.clear();
    weatherVeil.rect(0, 0, app.screen.width, app.screen.height).fill({ color: weatherVisual.veilColor, alpha: 1 });
    sunnyGlow.x = app.screen.width * 0.78;
    sunnyGlow.y = app.screen.height * 0.18;
  };
  const onResize = () => {
    layoutUI();
    const oldBg = bgTex;
    const oldNear = noiseTexNear;
    const oldFar = noiseTexFar;
    bgTex = createBackgroundTexture(app.screen.width * 1.5, app.screen.height * 1.5);
    noiseTexNear = makeNoiseTexture(app.screen.width * 1.35, app.screen.height * 1.35, 10);
    noiseTexFar = makeNoiseTexture(app.screen.width * 1.8, app.screen.height * 1.8, 8);
    bg.texture = bgTex;
    bgNoiseNear.texture = noiseTexNear;
    bgNoiseFar.texture = noiseTexFar;
    bg.x = app.screen.width * 0.5;
    bg.y = app.screen.height * 0.5;
    bgNoiseNear.x = app.screen.width * 0.5;
    bgNoiseNear.y = app.screen.height * 0.5;
    bgNoiseFar.x = app.screen.width * 0.5;
    bgNoiseFar.y = app.screen.height * 0.5;
    redrawBackdropTint();
    oldBg.destroy(true);
    oldNear.destroy(true);
    oldFar.destroy(true);
  };
  redrawBackdropTint();
  app.renderer.on("resize", onResize);

  const onTick = (ticker) => {
    if (gamePaused) return;
    const dt = Math.min(2.2, ticker.deltaTime);
    onSessionTime?.(ticker.deltaMS);
    sessionPlayedMs += ticker.deltaMS;
    const cx = app.screen.width * 0.5;
    const cy = app.screen.height * 0.5;
    if (returnHintPending) {
      returnHintPending = false;
      hintOverrideMs = 3200;
      toastText.text = "Life continued while you were away.";
    }
    if (dailyBonusPending) {
      dailyBonusPending = false;
      progression.lastDailyBonusDay = dayKey(Date.now());
      lureCharges = Math.min(LURE_MAX, lureCharges + 1);
      surgeCharges = Math.min(SURGE_MAX, surgeCharges + 1);
      sightCharges = Math.min(SIGHT_MAX, sightCharges + 1);
      addWorldLife(6);
      hintOverrideMs = Math.max(hintOverrideMs, 3200);
      toastText.text = "Daily Bloom: the world welcomes you back.";
      saveProgression({
        ...progression,
        spiritStrength,
        totalAwakenings,
        lastSeenAt: Date.now(),
      });
    }
    if (offlineGrowthPending > 0.01) {
      const step = Math.min(offlineGrowthPending, 0.08 * dt);
      offlineGrowthPending -= step;
      addWorldLife(step * 4.5);
      stageBoostSaturation = Math.min(1, stageBoostSaturation + step * 0.02);
    }

    let awakeningMsgAlpha = 0;
    if (awakeningActive) {
      awakeningElapsed += ticker.deltaMS;
      const e = awakeningElapsed;
      if (e < 520) eventSuppress = 0.52 * (1 - e / 520);
      else eventSuppress = 0;

      if (!awakeningSoundPlayed && e >= 780) {
        awakeningSoundPlayed = true;
        sounds.playEffect("bloom", 1.35);
      }

      let awakeningBoostTarget = 0;
      if (e < 780) awakeningBoostTarget = 0;
      else if (e < 2960) awakeningBoostTarget = 1;
      else if (e < AWAKENING_TOTAL_MS) awakeningBoostTarget = Math.max(0, 1 - (e - 2960) / (AWAKENING_TOTAL_MS - 2960));
      else awakeningBoostTarget = 0;
      awakeningBoost = lerp(awakeningBoost, awakeningBoostTarget, 0.22 * dt);

      if (e >= 780 && e <= 2680) {
        const local = e - 780;
        if (local < 420) awakeningMsgAlpha = local / 420;
        else if (local > 1480) awakeningMsgAlpha = Math.max(0, (1900 - local) / 420);
        else awakeningMsgAlpha = 1;
      }

      if (awakeningElapsed >= AWAKENING_TOTAL_MS) {
        awakeningActive = false;
        hasAwakened = true;
        awakeningBoost = 0;
        eventSuppress = 0;
        worldResetPendingMs = 1700;
        milestoneText.text = "";
        milestoneText.style.fontSize = 28;
        milestoneText.alpha = 0;
        if (!afterglowMotesAdded) {
          afterglowMotesAdded = true;
          onWorldAwaken?.();
          totalAwakenings += 1;
          spiritStrength = Math.min(12, spiritStrength + 1);
          worldStage = Math.min(4, Math.floor(totalAwakenings / 2));
          progression.spiritStrength = spiritStrength;
          progression.totalAwakenings = totalAwakenings;
          progression.lastSeenAt = Date.now();
          saveProgression({
            ...progression,
            spiritStrength,
            totalAwakenings,
            lastSeenAt: Date.now(),
          });
          hintOverrideMs = 2600;
          toastText.text = `Spirit Strength ${spiritStrength} - Stage ${worldStage + 1} deepens.`;
          for (let i = 0; i < 40; i += 1) {
            const m = new PIXI.Sprite(trailGlowTex);
            m.anchor.set(0.5);
            m.x = (Math.random() * 2 - 1) * HALF_WORLD;
            m.y = (Math.random() * 2 - 1) * HALF_WORLD;
            m.scale.set(0.18 + Math.random() * 0.42);
            m.alpha = 0.05 + Math.random() * 0.11;
            m._phase = Math.random() * Math.PI * 2;
            m._vx = (Math.random() - 0.5) * 0.12;
            m._vy = (Math.random() - 0.5) * 0.12;
            ambientMotes.push(m);
            depthLayer.addChild(m);
          }
        }
      }
    } else {
      eventSuppress = 0;
    }

    const trailGlowMul = 1 + awakeningBoost * 0.52 + (hasAwakened ? 0.12 : 0);
    if (helperPresenceCount > 1 && !coopHintShown) {
      coopHintShown = true;
      hintOverrideMs = 2800;
      toastText.text = "Co-op resonance active: nearby spirits accelerate awakening.";
    }
    if (helperPresenceCount <= 1) coopHintShown = false;

    weather.timer -= ticker.deltaMS;
    if (weather.timer <= 0) {
      const states = ["sunny", "rain", "wind"];
      setWeather(states[(Math.random() * states.length) | 0]);
    }
    bloomEventTimer -= ticker.deltaMS;
    if (bloomEventTimer <= 0) {
      bloomEventTimer = 3800 + Math.random() * 2600;
      if (Math.hypot(velocity.x, velocity.y) > 0.35 && eventSuppress < 0.28) spawnBloomEvent(player.x, player.y, 0.9);
    }
    if (helperPresenceCount > 1 && !awakeningActive) {
      coopResonanceTimerMs -= ticker.deltaMS;
      if (coopResonanceTimerMs <= 0) {
        coopResonanceTimerMs = Math.max(1600, 4200 - helperPresenceCount * 520);
        const rings = Math.min(5, 1 + helperPresenceCount);
        for (let ri = 0; ri < rings; ri += 1) {
          const a = (ri / rings) * Math.PI * 2 + Math.random() * 0.2;
          const r = 24 + ri * 18;
          spawnBloomEvent(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, 0.9, {
            awardWorldLife: false,
            playSound: false,
            particleMult: 0.7,
          });
        }
        addWorldLife(3.2 + helperPresenceCount * 1.2);
        screenGlowMs = Math.max(screenGlowMs, 260);
      }
    } else {
      coopResonanceTimerMs = 6200;
    }

    naturalBloomTimer -= ticker.deltaMS;
    if (hasAwakened && !awakeningActive && naturalBloomTimer <= 0) {
      naturalBloomTimer = 3000 + Math.random() * 2600;
      const ang = Math.random() * Math.PI * 2;
      const r = 72 + Math.random() * 132;
      spawnNaturalBloom(player.x + Math.cos(ang) * r, player.y + Math.sin(ang) * r);
    }

    let inputX = 0;
    let inputY = 0;
    let inputMag = 1;

    const moveKeysHeld = keys.has("KeyA") || keys.has("KeyD") || keys.has("KeyW") || keys.has("KeyS");
    if (moveKeysHeld) {
      if (keys.has("KeyA")) inputX -= 1;
      if (keys.has("KeyD")) inputX += 1;
      if (keys.has("KeyW")) inputY -= 1;
      if (keys.has("KeyS")) inputY += 1;
      const len = Math.hypot(inputX, inputY) || 1;
      inputX /= len;
      inputY /= len;
      inputMag = 1;
    } else {
      // Steer toward world position under the cursor (not screen-center stick — feels responsive with camera).
      const twx = cam.x + (pointer.x - cx) / cam.zoom;
      const twy = cam.y + (pointer.y - cy) / cam.zoom;
      let dx = twx - player.x;
      let dy = twy - player.y;
      const dist = Math.hypot(dx, dy);
      const deadzone = 18;
      const ramp = 95;
      if (dist < deadzone) {
        inputX = 0;
        inputY = 0;
        inputMag = 0;
      } else {
        inputX = dx / dist;
        inputY = dy / dist;
        inputMag = Math.min(1, (dist - deadzone) / ramp);
      }
    }

    const surgeMul = surgeBoostMs > 0 ? 1.18 : 1;
    const accel = (boostHeld ? 0.42 : 0.28) * surgeMul;
    const baseSpeed = 5.85;
    const maxSpeed = baseSpeed * (boostHeld ? 1.42 : 1) * surgeMul + (weather.kind === "wind" ? 0.3 : 0);
    const targetVx = inputX * maxSpeed * inputMag;
    const targetVy = inputY * maxSpeed * inputMag;
    velocity.x = lerp(velocity.x, targetVx, accel * dt);
    velocity.y = lerp(velocity.y, targetVy, accel * dt);
    if (weather.kind === "wind") velocity.x += 0.02 * dt;

    const boundMin = -HALF_WORLD + 20;
    const boundMax = HALF_WORLD - 20;
    const nextX = player.x + velocity.x * dt;
    const nextY = player.y + velocity.y * dt;
    const clampedX = clamp(nextX, boundMin, boundMax);
    const clampedY = clamp(nextY, boundMin, boundMax);
    // Stop velocity into walls so input can reverse immediately (no "stuck at edge").
    if (nextX > boundMax) velocity.x = Math.min(0, velocity.x);
    else if (nextX < boundMin) velocity.x = Math.max(0, velocity.x);
    if (nextY > boundMax) velocity.y = Math.min(0, velocity.y);
    else if (nextY < boundMin) velocity.y = Math.max(0, velocity.y);
    player.x = clampedX;
    player.y = clampedY;
    spirit.x = player.x;
    spirit.y = player.y;

    beatTimerMs += ticker.deltaMS;
    if (beatTimerMs >= beatDurationMs) {
      beatTimerMs = 0;
      beatDurationMs = 1600 + Math.random() * 800; // 1.6s..2.4s with variation
    }
    const beatT = clamp(beatTimerMs / beatDurationMs, 0, 1);
    const beat = Math.sin(Math.PI * beatT) ** 2; // smooth organic pulse
    const moveSpeed = Math.hypot(velocity.x, velocity.y);
    if (!firstMoveReactionShown && moveSpeed > 0.32) {
      firstMoveReactionShown = true;
      hintOverrideMs = 3200;
      toastText.text = "Where you move, life begins";
      spawnBloomEvent(player.x, player.y, 1.5, { awardWorldLife: false, particleMult: 1.2 });
      screenGlowMs = Math.max(screenGlowMs, 460);
    }
    stageBoostSaturation = lerp(stageBoostSaturation, Math.min(1, stageBoostSaturation + moveSpeed * 0.00008 * dt), 0.025 * dt);
    if (moveSpeed > 0.2 && !awakeningActive) {
      microBloomTimerMs -= ticker.deltaMS;
      if (microBloomTimerMs <= 0) {
        microBloomTimerMs = 900 - Math.min(360, spiritStrength * 24);
        spawnBloomEvent(player.x, player.y, 0.5 + spiritStrength * 0.04, {
          awardWorldLife: false,
          playSound: false,
          particleMult: 0.45,
        });
        if (Math.random() < 0.24) spawnCritter(false);
      }
    } else {
      microBloomTimerMs = Math.min(1200, microBloomTimerMs + ticker.deltaMS * 0.5);
    }
    bloomPulseMs = Math.max(0, bloomPulseMs - ticker.deltaMS);
    const bloomPulse = bloomPulseMs > 0 ? Math.sin((1 - bloomPulseMs / 520) * Math.PI) : 0;
    const movePulse = clamp(moveSpeed / 4, 0, 1);
    const afterglowBreath = hasAwakened ? Math.sin(ticker.lastTime * 0.00019) * 0.04 : 0;
    const awakeningEm =
      awakeningActive && awakeningElapsed > 780 && awakeningElapsed < 3000
        ? Math.sin((awakeningElapsed - 780) * 0.0033) * 0.11 * awakeningBoost
        : 0;
    spirit.scale.set(
      1.52 + beat * 0.08 + movePulse * 0.08 + bloomPulse * 0.14 + awakeningEm + awakeningBoost * 0.1 + afterglowBreath,
    );
    spirit.alpha =
      0.84 + beat * 0.06 + movePulse * 0.1 + bloomPulse * 0.08 + awakeningBoost * 0.08 + (hasAwakened ? 0.04 : 0);
    soul.scale.set(0.32 + beat * 0.035 + awakeningBoost * 0.04);
    soul.alpha = 0.42 + beat * 0.09 + movePulse * 0.06 + awakeningBoost * 0.06 + (hasAwakened ? 0.05 : 0);

    trail.push({ x: player.x, y: player.y, phase: Math.random() * Math.PI * 2 });
    {
      const { lx, ly } = worldToLife(player.x, player.y);
      const memIdx = ly * LIFE_W + lx;
      trailMemory[memIdx] = clamp(trailMemory[memIdx] + 0.045 * dt, 0, 1);
    }
    const maxTrailPoints = 160 + spiritStrength * 22;
    if (trail.length > maxTrailPoints) trail.shift();
    auraSpawnAccum += moveSpeed * dt * (1 + awakeningBoost * 0.32 + (hasAwakened ? 0.1 : 0));
    const auraGate = 2.2 / (1 + awakeningBoost * 0.38 + (hasAwakened ? 0.12 : 0));
    if (auraSpawnAccum > auraGate * (1 + eventSuppress * 0.48)) {
      auraSpawnAccum = 0;
      spawnLifeAura(player.x, player.y, 1);
      if (trail.length > 20) {
        const tp = trail[trail.length - 20];
        spawnLifeAura(tp.x, tp.y, 0.7);
      }
      const wlAura =
        !hasAwakened && worldLife >= 99 && worldLife < 100 ? 0.06 : 0.01;
      addWorldLife(wlAura);
    }
    trailGfx.clear();
    if (trail.length > 2) {
      const first = trail[0];
      // Soft shadow pass for depth (keeps trail above terrain).
      trailGfx.moveTo(first.x, first.y);
      for (let i = 1; i < trail.length; i += 1) {
        const seg = trail[i];
        const t = i / (trail.length - 1);
        const wiggle = Math.sin(ticker.lastTime * 0.002 + seg.phase) * (1 - t) * 3;
        trailGfx.lineTo(seg.x + wiggle + 1.8, seg.y - wiggle * 0.5 + 1.8).stroke({
          width: 2 + t * 4,
          color: 0x132116,
          alpha: 0.03 + t * 0.08,
        });
      }

      trailGfx.moveTo(first.x, first.y);
      for (let i = 1; i < trail.length; i += 1) {
        const seg = trail[i];
        const t = i / (trail.length - 1);
        const wiggle = Math.sin(ticker.lastTime * 0.002 + seg.phase) * (1 - t) * 3;
        // Thin, subtle path — avoid a solid "snake" tube; florals carry the main read.
        trailGfx.lineTo(seg.x + wiggle, seg.y - wiggle * 0.5).stroke({
          width: 1.5 + t * 4 + Math.sin(seg.phase + ticker.lastTime * 0.0012) * 0.5,
          color: 0x9ee8a8,
          alpha: (0.035 + t * 0.14) * trailGlowMul,
        });
        if (i % 48 === 0 && Math.random() < 0.14) {
          const aura = new PIXI.Sprite(trailGlowTex);
          aura.anchor.set(0.5);
          aura.x = seg.x;
          aura.y = seg.y;
          aura.scale.set(0.22 + Math.random() * 0.22);
          aura.alpha = 0.14;
          aura._age = 0;
          aura._life = 1100 + Math.random() * 900;
          trailGlows.push(aura);
          trailLayer.addChild(aura);
        }
      }
    }

    flowerSpawnStep += Math.hypot(velocity.x, velocity.y) * dt * (1 - eventSuppress * 0.88);
    // Space blooms apart so each reads as a flower cluster, not a merged tunnel.
    if (flowerSpawnStep > 52) {
      flowerSpawnStep = 0;
      const tex = flowerTextures[(Math.random() * flowerTextures.length) | 0];
      const f = new PIXI.Sprite(tex);
      f.anchor.set(0.5);
      const lateral = 26 + Math.random() * 34;
      const along = (Math.random() - 0.5) * 14;
      let ox;
      let oy;
      if (moveSpeed > 0.12) {
        const spd = moveSpeed;
        const nx = -velocity.y / spd;
        const ny = velocity.x / spd;
        const side = Math.random() < 0.5 ? -1 : 1;
        ox = nx * lateral * side + (velocity.x / spd) * along;
        oy = ny * lateral * side + (velocity.y / spd) * along;
      } else {
        const a = Math.random() * Math.PI * 2;
        ox = Math.cos(a) * lateral * 0.85;
        oy = Math.sin(a) * lateral * 0.85;
      }
      f.x = player.x + ox;
      f.y = player.y + oy;
      f.rotation = Math.random() * Math.PI * 2;
      f.scale.set((0.62 + Math.random() * 0.38) * 1.28);
      f.alpha = 0.88;
      f.blendMode = "normal";
      f._age = 0;
      flowers.push(f);
      floraLayer.addChild(f);

      const glow = new PIXI.Sprite(trailGlowTex);
      glow.anchor.set(0.5);
      glow.x = f.x;
      glow.y = f.y;
      glow.scale.set(0.38 + Math.random() * 0.26);
      glow.alpha = 0.12 * trailGlowMul;
      glow.tint = 0xc8ffd8;
      glow._age = 0;
      glow._life = 2200;
      trailGlows.push(glow);
      trailLayer.addChild(glow);
    }

    for (let i = flowers.length - 1; i >= 0; i -= 1) {
      const f = flowers[i];
      f._age += ticker.deltaMS;
      f.rotation += 0.0007 * ticker.deltaMS;
      const { lx, ly } = worldToLife(f.x, f.y);
      const mem = trailMemory[ly * LIFE_W + lx];
      if (helperPresenceCount > 1 && mem > 0.5) f.tint = 0xffe8f6;
      else if (mem > 0.35) f.tint = 0xf2ffe8;
      else f.tint = 0xffffff;
      if (f._age > 18000 + spiritStrength * 1400) {
        f.alpha -= 0.0035 * dt;
        if (f.alpha <= 0) {
          f.destroy();
          flowers.splice(i, 1);
        }
      }
    }
    const regrowth = worldLife / 100;
    treeSpawnStep += Math.hypot(velocity.x, velocity.y) * dt * (0.25 + regrowth * 0.95);
    const desiredTrees = Math.floor(18 + regrowth * 90);
    if (regrowth > 0.12 && trees.length < desiredTrees && treeSpawnStep > 68) {
      treeSpawnStep = 0;
      const tex = treeTextures[(Math.random() * treeTextures.length) | 0];
      const tr = new PIXI.Sprite(tex);
      tr.anchor.set(0.5, 0.92);
      const dist = 90 + Math.random() * 200;
      const a = Math.random() * Math.PI * 2;
      tr.x = clamp(player.x + Math.cos(a) * dist, -HALF_WORLD + 58, HALF_WORLD - 58);
      tr.y = clamp(player.y + Math.sin(a) * dist, -HALF_WORLD + 58, HALF_WORLD - 58);
      const lifeAt = sampleLife(tr.x, tr.y);
      tr.scale.set((0.22 + regrowth * 0.55 + lifeAt * 0.18) * (0.78 + Math.random() * 0.35));
      tr.alpha = 0;
      tr._age = 0;
      tr._fadeMs = 1800 + Math.random() * 1200;
      tr._maxA = 0.18 + regrowth * 0.72;
      trees.push(tr);
      floraLayer.addChildAt(tr, 0);
    }
    for (let i = trees.length - 1; i >= 0; i -= 1) {
      const tr = trees[i];
      tr._age += ticker.deltaMS;
      const lifeAt = sampleLife(tr.x, tr.y);
      const tGrow = Math.min(1, tr._age / tr._fadeMs);
      tr.alpha = Math.min(tr._maxA, tGrow * (0.2 + lifeAt * 0.9));
      const sway = Math.sin(ticker.lastTime * 0.00055 + tr.x * 0.002) * 0.03;
      tr.rotation = sway;
      tr.tint = lifeAt > 0.45 ? 0xffffff : 0xe8d8bc;
      if (regrowth < 0.08 && tr._age > 9000) {
        tr.alpha -= 0.004 * dt;
        if (tr.alpha <= 0.01) {
          tr.destroy();
          trees.splice(i, 1);
        }
      }
    }
    for (let i = trailGlows.length - 1; i >= 0; i -= 1) {
      const g = trailGlows[i];
      g._age += ticker.deltaMS;
      const t = g._age / g._life;
      g.alpha = Math.max(0, 0.48 * (1 - t));
      g.scale.set(g.scale.x + 0.002 * dt);
      if (g.alpha <= 0.01) {
        g.destroy();
        trailGlows.splice(i, 1);
      }
    }

    const coopBoost = helperPresenceCount > 1 ? 1.5 + Math.min(0.5, (helperPresenceCount - 2) * 0.15) : 1;
    const growthBoost = (weather.kind === "rain" ? 1.65 : 1) * coopBoost;
    const strengthRadius = 5 + (level >= 4 ? 2 : 0) + spiritStrength * 0.22;
    addLifeAt(player.x, player.y, strengthRadius, 0.02 * dt * growthBoost * (1 + spiritStrength * 0.04));
    for (let i = 0; i < trail.length; i += 4) {
      const p = trail[i];
      const { lx, ly } = worldToLife(p.x, p.y);
      const mem = trailMemory[ly * LIFE_W + lx];
      const rich = 1 + mem * 0.7;
      addLifeAt(p.x, p.y, 2, 0.0038 * dt * growthBoost * rich);
    }
    if (helperPresenceCount > 1) {
      trailIntersectFxTimerMs -= ticker.deltaMS;
      const { lx, ly } = worldToLife(player.x, player.y);
      const dense = trailMemory[ly * LIFE_W + lx];
      if (dense > 0.58 && trailIntersectFxTimerMs <= 0) {
        trailIntersectFxTimerMs = 760;
        spawnBloomEvent(player.x, player.y, 0.92, { awardWorldLife: false, playSound: false, particleMult: 0.88 });
      }
    } else {
      trailIntersectFxTimerMs = 0;
    }

    const vitalityEssence = 0.52 + 0.48 * (worldLife / 100);
    if (Math.random() < 0.4 * (1 - eventSuppress * 0.55) * vitalityEssence) maybeSpawnEssence();
    boosterDropTimerMs -= ticker.deltaMS;
    if (boosterDropTimerMs <= 0) {
      boosterDropTimerMs = 4000 + Math.random() * 5000;
      const drops = 1 + ((Math.random() * 2) | 0);
      for (let di = 0; di < drops; di += 1) {
        const r = Math.random();
        if (r < 0.34) spawnBoosterDrop("lure");
        else if (r < 0.67) spawnBoosterDrop("surge");
        else spawnBoosterDrop("sight");
      }
    }
    const energyBoost = weather.kind === "sunny" ? 1.25 : 1;
    for (let i = essences.length - 1; i >= 0; i -= 1) {
      const e = essences[i];
      e._phase += 0.014 * dt;
      const windV = weather.kind === "wind" ? 0.26 : 0.08;
      e.x += (e._vx + windV) * dt;
      e.y += e._vy * dt + Math.sin(e._phase) * 0.2;
      e.alpha = 0.8 + Math.sin(e._phase * 1.3) * 0.16;
      e.rotation += 0.01 * dt;
      e.scale.set(e._baseScale * (1 + Math.sin(e._phase * 1.4) * 0.14));
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const pickR = lureActiveMs > 0 ? 42 : 28;
      if (dx * dx + dy * dy < pickR * pickR) {
        e.destroy();
        essences.splice(i, 1);
        energy += 1 * energyBoost;
        addLifeAt(player.x, player.y, 7, 0.14);
        spawnBloomEvent(player.x, player.y, 1.15);
        sounds.playEffect("collect");
        addWorldLife(1.35);
      }
    }

    for (let i = boosterDrops.length - 1; i >= 0; i -= 1) {
      const b = boosterDrops[i];
      b._phase += 0.02 * dt;
      b.y = b._baseY + Math.sin(b._phase) * 6;
      b.scale.set(0.96 + Math.sin(b._phase * 1.2) * 0.08);
      b.rotation += b._spin * dt;
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      if (dx * dx + dy * dy < 44 * 44) {
        if (b._type === "lure") {
          lureCharges = Math.min(LURE_MAX, lureCharges + 2);
          hintOverrideMs = 1800;
          toastText.text = "Picked up Blossom: +2 Lure charges.";
        } else if (b._type === "surge") {
          surgeCharges = Math.min(SURGE_MAX, surgeCharges + 2);
          hintOverrideMs = 1800;
          toastText.text = "Picked up Spark: +2 Surge charges.";
        } else {
          sightCharges = Math.min(SIGHT_MAX, sightCharges + 2);
          hintOverrideMs = 1800;
          toastText.text = "Picked up Eye: +2 Sight charges.";
        }
        spawnBloomEvent(player.x, player.y, 1.25, { awardWorldLife: false, particleMult: 1.2 });
        screenGlowMs = Math.max(screenGlowMs, 280);
        sounds.playEffect("collect", 1.15);
        b.destroy({ children: true });
        boosterDrops.splice(i, 1);
      }
    }

    for (let i = worldCritters.length - 1; i >= 0; i -= 1) {
      const cr = worldCritters[i];
      const magical = isMagicalCritter(cr);
      cr._hop += 0.022 * dt;
      cr.x += cr._vx * dt;
      cr.y += cr._vy * dt + Math.sin(cr._hop) * 0.08;
      if (Math.random() < 0.02 * dt) {
        cr._vx += (Math.random() - 0.5) * 0.12;
        cr._vy += (Math.random() - 0.5) * 0.12;
        cr._vx = clamp(cr._vx, -0.55, 0.55);
        cr._vy = clamp(cr._vy, -0.55, 0.55);
      }
      cr.x = clamp(cr.x, -HALF_WORLD + 40, HALF_WORLD - 40);
      cr.y = clamp(cr.y, -HALF_WORLD + 40, HALF_WORLD - 40);
      const pulse = 0.92 + Math.sin(ticker.lastTime * 0.004 + cr._phase) * 0.06;
      const baseCritterScale = (1.7 + (magical ? 0.24 : 0)) * pulse;
      cr.scale.set(magical ? baseCritterScale * SPECIAL_SURPRISE_SCALE_MUL : baseCritterScale * COMMON_CRITTER_SCALE_MUL);
      if (magical) cr.rotation = Math.sin(ticker.lastTime * 0.0028 + cr._phase) * 0.14;
      const dx = cr.x - player.x;
      const dy = cr.y - player.y;
      const pickR = magical ? 96 : 32;
      if (dx * dx + dy * dy < pickR * pickR) {
        collectedCrittersRare += 1;
        if (magical) {
          addWorldLife(4.8);
          spawnBloomEvent(player.x, player.y, 1.9, { particleMult: 1.45 });
          hintOverrideMs = Math.max(hintOverrideMs, 1200);
          toastText.text = "Magical creature found! Awakening surges forward.";
        } else {
          addWorldLife(0.62);
          spawnBloomEvent(player.x, player.y, 0.65, { particleMult: 0.7 });
        }
        sounds.playEffect(magical ? "surprise" : "collect", magical ? 1 : 1.05);
        cr.destroy({ children: true });
        worldCritters.splice(i, 1);
      }
    }

    commonCritterTimerMs -= ticker.deltaMS;
    if (commonCritterTimerMs <= 0) {
      spawnCritter(false);
      commonCritterTimerMs = 12000 + Math.random() * 18000;
    }
    specialCritterTimerMs -= ticker.deltaMS;
    if (specialCritterTimerMs <= 0) {
      spawnCritter(true);
      specialCritterTimerMs = 18000 + Math.random() * 42000;
    }

    surpriseTimerMs -= ticker.deltaMS;
    if (surpriseTimerMs <= 0 && !awakeningActive) {
      surpriseTimerMs = 30000 + Math.random() * 28000;
      const burst = 6 + ((Math.random() * 7) | 0);
      for (let si = 0; si < burst; si += 1) maybeSpawnEssence();
      spawnBloomEvent(player.x, player.y, 2.16);
      sounds.playEffect("bloom", 0.78);
      if (Math.random() < 0.9) spawnCritter(false);
    }

    const vitalityMotes = 0.5 + 0.5 * (worldLife / 100);
    if (
      movePulse > 0.45 &&
      Math.random() < 0.4 * (1 + awakeningBoost * 0.7 + (hasAwakened ? 0.16 : 0)) * (1 - eventSuppress * 0.45) * vitalityMotes
    ) {
      const pm = new PIXI.Sprite(trailGlowTex);
      pm.anchor.set(0.5);
      pm.x = player.x + (Math.random() - 0.5) * 8;
      pm.y = player.y + (Math.random() - 0.5) * 8;
      pm.scale.set(0.18 + Math.random() * 0.2);
      pm.alpha = 0.55;
      pm._vx = (Math.random() - 0.5) * 0.5 - velocity.x * 0.08;
      pm._vy = (Math.random() - 0.5) * 0.5 - velocity.y * 0.08;
      pm._age = 0;
      pm._life = 500 + Math.random() * 380;
      playerMotes.push(pm);
      particleLayer.addChild(pm);
    }
    for (let i = playerMotes.length - 1; i >= 0; i -= 1) {
      const m = playerMotes[i];
      m._age += ticker.deltaMS;
      m.x += m._vx * dt;
      m.y += m._vy * dt;
      const t = m._age / m._life;
      m.alpha = Math.max(0, 0.55 * (1 - t));
      if (m.alpha <= 0.02) {
        m.destroy();
        playerMotes.splice(i, 1);
      }
    }
    for (let i = bloomBursts.length - 1; i >= 0; i -= 1) {
      const b = bloomBursts[i];
      b._age += ticker.deltaMS;
      const t = b._age / b._life;
      if (b._ring) {
        b.scale.set(0.52 + t * 2.05);
        b.alpha = Math.max(0, 0.75 * (1 - t));
      } else {
        b.x += b._vx * dt;
        b.y += b._vy * dt;
        b.alpha = Math.max(0, 0.95 * (1 - t));
      }
      if (t >= 1) {
        b.destroy();
        bloomBursts.splice(i, 1);
      }
    }

    for (let i = lifeAuras.length - 1; i >= 0; i -= 1) {
      const a = lifeAuras[i];
      a._age += ticker.deltaMS;
      const t = a._age / a._life;
      a.alpha = Math.max(0, (0.28 + (1 - t) * 0.08) * (1 - t));
      a.scale.set(a.scale.x + 0.0014 * dt);
      if (t >= 1) {
        a.destroy();
        lifeAuras.splice(i, 1);
      }
    }

    // Very slow optional decay — several minutes to drift from full; allows re-awakening below ~95%.
    // No decay in the last 1% before your first awakening (avoids "stuck at 99%" with tiny gains).
    let worldDecay = 0.00001 * dt;
    if (!hasAwakened && worldLife >= 99) worldDecay = 0;
    worldLife = Math.max(0, worldLife - worldDecay);
    // Guarantee crossing 100% (float / rounding) — next step is the awakening moment.
    if (!hasAwakened && !awakeningActive && worldLife >= 99.92 && worldLife < 100) {
      addWorldLife(100 - worldLife);
    }
    const worldProgress = worldLife / 100;
    const stageDensity = 1 + worldStage * 0.16;
    bgNoiseNear.alpha = 0.08 + worldProgress * 0.06 * stageDensity;
    bgNoiseFar.alpha = 0.06 + worldProgress * 0.045 * stageDensity;
    let ambTarget = 0.24 * (0.58 + 0.42 * worldProgress);
    if (awakeningActive && awakeningElapsed >= 780 && awakeningElapsed < 2800) ambTarget = Math.max(ambTarget, 0.31);
    sounds.setAmbientVolumeTarget(ambTarget);
    sounds.tickAmbientVolume(dt);

    weatherVisual.veilAlpha = lerp(weatherVisual.veilAlpha, weatherVisual.targetVeilAlpha, 0.03 * dt);
    weatherVisual.rainAlpha = lerp(weatherVisual.rainAlpha, weatherVisual.targetRainAlpha, 0.06 * dt);
    weatherVisual.sunAlpha = lerp(weatherVisual.sunAlpha, weatherVisual.targetSunAlpha, 0.04 * dt);
    weatherVisual.windAlpha = lerp(weatherVisual.windAlpha, weatherVisual.targetWindAlpha, 0.06 * dt);
    const cLerp = Math.min(1, 0.03 * dt);
    const cr = (weatherVisual.veilColor >> 16) & 255;
    const cg = (weatherVisual.veilColor >> 8) & 255;
    const cb = weatherVisual.veilColor & 255;
    const tr = (weatherVisual.targetVeilColor >> 16) & 255;
    const tg = (weatherVisual.targetVeilColor >> 8) & 255;
    const tb = weatherVisual.targetVeilColor & 255;
    const nr = Math.round(cr + (tr - cr) * cLerp);
    const ng = Math.round(cg + (tg - cg) * cLerp);
    const nb = Math.round(cb + (tb - cb) * cLerp);
    weatherVisual.veilColor = (nr << 16) | (ng << 8) | nb;

    const oldLevel = level;
    if (energy >= 120) level = 4;
    else if (energy >= 70) level = 3;
    else if (energy >= 30) level = 2;
    else level = 1;
    if (oldLevel !== level) {
      hintOverrideMs = 5200;
      toastText.text = `Level ${level}! Stronger glow & faster life paint — keep gathering essence.`;
    }
    if (oldLevel < level) spawnBloomEvent(player.x, player.y, 1.35);

    for (let i = 0; i < lifeField.length; i += 1) {
      lifeField[i] = Math.max(0.03, lifeField[i] - 0.00001 * dt);
    }
    lifePaintTick += ticker.deltaMS;
    if (lifePaintTick > 110) {
      lifePaintTick = 0;
      updateLifeTexture();
    }

    cam.x = lerp(cam.x, player.x, 0.09 * dt);
    cam.y = lerp(cam.y, player.y, 0.09 * dt);
    const speed = Math.hypot(velocity.x, velocity.y);
    const sightOff = [0, -0.07, -0.12][sightZoomStep % 3];
    const targetZoom = 0.66 - clamp(speed / 25, 0, 0.06) + sightOff;
    cam.zoom = lerp(cam.zoom, targetZoom, 0.03 * dt);
    // Keep camera inside world bounds so map edges align with screen edges
    // (no large empty margin past the playable area).
    const halfViewW = (app.screen.width * 0.5) / cam.zoom;
    const halfViewH = (app.screen.height * 0.5) / cam.zoom;
    const minCamX = -HALF_WORLD + halfViewW;
    const maxCamX = HALF_WORLD - halfViewW;
    const minCamY = -HALF_WORLD + halfViewH;
    const maxCamY = HALF_WORLD - halfViewH;
    if (minCamX <= maxCamX) cam.x = clamp(cam.x, minCamX, maxCamX);
    else cam.x = 0;
    if (minCamY <= maxCamY) cam.y = clamp(cam.y, minCamY, maxCamY);
    else cam.y = 0;
    world.scale.set(cam.zoom);
    world.x = cx - cam.x * cam.zoom;
    world.y = cy - cam.y * cam.zoom;

    critterGuide.clear();
    if (worldCritters.length > 0) {
      let best = null;
      let bestD2 = Infinity;
      for (let i = 0; i < worldCritters.length; i += 1) {
        const cr = worldCritters[i];
        const dx = cr.x - player.x;
        const dy = cr.y - player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = cr;
        }
      }
      if (best) {
        const bestMagical = isMagicalCritter(best);
        const sx = cx + (best.x - cam.x) * cam.zoom;
        const sy = cy + (best.y - cam.y) * cam.zoom;
        const m = 48;
        const onScreen = sx > m && sx < app.screen.width - m && sy > m && sy < app.screen.height - m;
        if (onScreen) {
          // Never draw an overlay on top of visible creatures.
          critterGuide.alpha = 0;
        } else {
          critterGuide.alpha = 0.78;
          const acx = cx;
          const acy = cy;
          let edx = sx - acx;
          let edy = sy - acy;
          const el = Math.hypot(edx, edy) || 1;
          edx /= el;
          edy /= el;
          const radius = Math.min(app.screen.width, app.screen.height) * 0.42;
          const ex = clamp(acx + edx * radius, 28, app.screen.width - 28);
          const ey = clamp(acy + edy * radius, 28, app.screen.height - 28);
          const ang = Math.atan2(edy, edx);
          critterGuide.moveTo(ex + Math.cos(ang) * 12, ey + Math.sin(ang) * 12);
          critterGuide.lineTo(ex + Math.cos(ang + 2.2) * 7, ey + Math.sin(ang + 2.2) * 7);
          critterGuide.lineTo(ex + Math.cos(ang - 2.2) * 7, ey + Math.sin(ang - 2.2) * 7);
          critterGuide.lineTo(ex + Math.cos(ang) * 12, ey + Math.sin(ang) * 12);
          critterGuide.fill({ color: bestMagical ? 0xffe8a8 : 0xc8ffd8, alpha: 0.92 });
        }
      }
    } else {
      critterGuide.alpha = 0;
    }

    if (awakeningActive) {
      const e = awakeningElapsed;
      const waveT = Math.min(1, Math.max(0, e / 1180));
      const waveAlpha = Math.sin(waveT * Math.PI) * 0.22;
      awakeningWave.alpha = waveAlpha;
      awakeningWave.scale.set(0.38 + waveT * 23);
      const sx = cx + (player.x - cam.x) * cam.zoom;
      const sy = cy + (player.y - cam.y) * cam.zoom;
      awakeningWave.x = sx;
      awakeningWave.y = sy;
    } else {
      awakeningWave.alpha = 0;
    }

    const t = ticker.lastTime;
    const cxScreen = app.screen.width * 0.5;
    const cyScreen = app.screen.height * 0.5;
    bg.x = cxScreen + Math.sin(t * 0.00008) * 8;
    bg.y = cyScreen + Math.cos(t * 0.00006) * 7;
    bgNoiseNear.x = cxScreen + Math.sin(t * 0.00011) * 14;
    bgNoiseNear.y = cyScreen + Math.cos(t * 0.00009) * 10;
    bgNoiseFar.x = cxScreen + Math.cos(t * 0.00007) * 18;
    bgNoiseFar.y = cyScreen + Math.sin(t * 0.00005) * 16;
    bgNoiseNear.rotation = Math.sin(t * 0.00003) * 0.02;
    bgNoiseFar.rotation = -Math.cos(t * 0.000025) * 0.018;
    const breathe = 0.5 + Math.sin(t * 0.00015) * 0.5;
    const afterglowPulse = hasAwakened ? (Math.sin(t * 0.00008) + 1) * 0.5 : 0;
    const vit = worldProgress;
    const forgotten = 1 - vit;
    bg.alpha = 0.88 + breathe * 0.02 + vit * 0.1 + (hasAwakened ? 0.045 : 0) + afterglowPulse * 0.018;
    if (hasAwakened) {
      bg.tint = 0xe8fff0;
    } else {
      const r = Math.round(lerp(106, 214, vit));
      const g = Math.round(lerp(86, 242, vit));
      const b = Math.round(lerp(70, 176, vit));
      bg.tint = (r << 16) | (g << 8) | b;
    }
    const airMotes = 0.52 + 0.48 * vit;
    bgNoiseNear.alpha = (0.06 + vit * 0.09 + (hasAwakened ? 0.04 : 0)) * airMotes;
    bgNoiseFar.alpha = (0.045 + vit * 0.065 + (hasAwakened ? 0.03 : 0)) * airMotes;
    lifeSprite.alpha = 0.32 + vit * 0.38 + (hasAwakened ? 0.06 : 0) + forgotten * 0.04;
    weatherVeil.tint = weatherVisual.veilColor;
    weatherVeil.alpha = weatherVisual.veilAlpha;
    sunnyGlow.alpha = weatherVisual.sunAlpha;
    for (let i = 0; i < ambientMotes.length; i += 1) {
      const m = ambientMotes[i];
      m.x += m._vx * dt;
      m.y += m._vy * dt;
      m.alpha =
        (0.05 + ((Math.sin(ticker.lastTime * 0.0008 + m._phase) + 1) * 0.5) * (0.08 + worldProgress * 0.12)) *
        (0.48 + 0.52 * worldProgress) *
        (hasAwakened ? 1.26 : 1);
      if (m.x > HALF_WORLD) m.x = -HALF_WORLD;
      else if (m.x < -HALF_WORLD) m.x = HALF_WORLD;
      if (m.y > HALF_WORLD) m.y = -HALF_WORLD;
      else if (m.y < -HALF_WORLD) m.y = HALF_WORLD;
    }

    weatherLayer.visible = weatherVisual.rainAlpha > 0.02 || weatherVisual.windAlpha > 0.02 || weatherVisual.sunAlpha > 0.01;
    for (let i = 0; i < rainDrops.length; i += 1) {
      const d = rainDrops[i];
      d.x += d._vx * dt;
      d.y += d._vy * dt;
      d.alpha = 0.5 * weatherVisual.rainAlpha;
      if (d.y > app.screen.height + 10) d.y = -20;
      if (d.x < -10) d.x = app.screen.width + 10;
    }
    for (let i = 0; i < windStreaks.length; i += 1) {
      const w = windStreaks[i];
      w.x += w._vx * dt;
      w.y += w._vy * dt;
      w.alpha = 0.26 * weatherVisual.windAlpha;
      if (w.x > app.screen.width + 80) {
        w.x = -80;
        w.y = Math.random() * app.screen.height;
      }
    }

    if (surgeBoostMs > 0) surgeBoostMs -= ticker.deltaMS;
    if (lureActiveMs > 0) lureActiveMs -= ticker.deltaMS;
    if (lureActiveMs > 0) {
      lureFxTimerMs -= ticker.deltaMS;
      if (lureFxTimerMs <= 0) {
        lureFxTimerMs = 260;
        const ring = new PIXI.Sprite(trailGlowTex);
        ring.anchor.set(0.5);
        ring.x = player.x;
        ring.y = player.y;
        ring.scale.set(0.9);
        ring.alpha = 0.85;
        ring._ring = true;
        ring._age = 0;
        ring._life = 480;
        bloomBursts.push(ring);
        particleLayer.addChild(ring);
      }
    }
    if (surgeBoostMs > 0) {
      surgeFxTimerMs -= ticker.deltaMS;
      if (surgeFxTimerMs <= 0) {
        surgeFxTimerMs = 220;
        spawnBloomEvent(player.x, player.y, 0.62, { awardWorldLife: false, playSound: false, particleMult: 0.55 });
      }
    }
    if (worldResetPendingMs > 0) {
      worldResetPendingMs -= ticker.deltaMS;
      if (worldResetPendingMs <= 0) resetWorldCycle();
    }

    const en = Math.floor(energy);
    currencyValue.text = String(en);
    surprisesValue.text = String(collectedCrittersRare);

    const self = truncHudName(playerDisplayName);
    const peerSet = new Set(
      presencePeers.map((p) => truncHudName(p.name)).filter((n) => n !== self),
    );
    const peerNames = [...peerSet].sort((a, b) => a.localeCompare(b));
    const maxPeerLines = 6;
    const shown = peerNames.slice(0, maxPeerLines);
    leaderboardHeader.text = `Spirits in this room (${helperPresenceCount})`;
    const stageNames = ["Soft Meadow", "Richer Growth", "Forest Rise", "Water Light", "Night Bloom"];
    leaderboardSub.text = `Stage ${worldStage + 1}: ${stageNames[worldStage]}`;
    const lines = [];
    for (let i = 0; i < shown.length; i += 1) {
      lines.push(`${i + 1}. ${shown[i]} —`);
    }
    leaderboardList.text = lines.join("\n");
    leaderboardSelfRow.text = `${helperPresenceCount}. ${self} ${en}`;
    const pad = 10;
    const lbW = Math.min(228, Math.floor(app.screen.width * 0.48));
    leaderboardSelfRow.x = pad + 12;
    leaderboardSelfRow.y = leaderboardList.y + leaderboardList.height + 6;
    leaderboardHi.clear();
    leaderboardHi.roundRect(pad + 4, leaderboardSelfRow.y - 4, lbW - 8, 20, 5).fill({ color: 0x1a2408, alpha: 0.55 });

    boosterLure.setBadge(String(lureCharges));
    boosterLure.setEnabled(lureCharges > 0);
    boosterLure.setActive(lureActiveMs > 0);
    boosterLure.updateHalo(ticker.lastTime);
    boosterSurge.setBadge(String(surgeCharges));
    boosterSurge.setEnabled(surgeCharges > 0);
    boosterSurge.setActive(surgeBoostMs > 0);
    boosterSurge.updateHalo(ticker.lastTime);
    boosterSight.setBadge(String(sightCharges));
    boosterSight.setEnabled(sightCharges > 0);
    boosterSight.setActive(false);
    boosterSight.updateHalo(ticker.lastTime);
    lurePulseMs = Math.max(0, lurePulseMs - ticker.deltaMS);
    surgePulseMs = Math.max(0, surgePulseMs - ticker.deltaMS);
    sightPulseMs = Math.max(0, sightPulseMs - ticker.deltaMS);
    const lurePulse = lurePulseMs > 0 ? Math.sin((1 - lurePulseMs / 700) * Math.PI) * 0.16 : 0;
    const surgePulse = surgePulseMs > 0 ? Math.sin((1 - surgePulseMs / 760) * Math.PI) * 0.2 : 0;
    const sightPulse = sightPulseMs > 0 ? Math.sin((1 - sightPulseMs / 680) * Math.PI) * 0.14 : 0;
    boosterLure.wrap.scale.set((lureActiveMs > 0 ? 1.06 : 1) + lurePulse);
    boosterSurge.wrap.scale.set((surgeBoostMs > 0 ? 1.08 : 1) + surgePulse);
    boosterSight.wrap.scale.set(1 + sightPulse);
    boosterLure.setTimerProgress(lureActiveMs / LURE_DURATION_MS);
    boosterSurge.setTimerProgress(surgeBoostMs / SURGE_DURATION_MS);
    boosterSight.setTimerProgress(0);

    if (helpPanelOpen) layoutHelpOverlay();
    if (hintOverrideMs > 0) hintOverrideMs -= ticker.deltaMS;
    if (!hasAwakened && worldLife >= 98.5 && worldLife < 100 && !awakeningActive) {
      toastText.text = "Almost there — a little more awakening to call the Great Bloom.";
    } else if (hintOverrideMs > 0) {
      /* toastText keeps level-up line until timer ends */
    } else {
      toastText.text = "";
    }

    const lbWBar = Math.min(228, Math.floor(app.screen.width * 0.48));
    const barW = Math.min(280, Math.max(120, app.screen.width - lbWBar - 132 - 28));
    const barH = 10;
    const bx = app.screen.width * 0.5 - barW * 0.5;
    const by = 14 + HUD_SHIFT_Y;
    const wlDisp = worldLife >= 100 ? 100 : Math.round(worldLife * 10) / 10;
    worldBarLabel.text = `World Awakening ${wlDisp}%`;
    worldBarLabel.x = bx + barW * 0.5 - worldBarLabel.width * 0.5;
    worldBarFill.clear();
    worldBarFill.roundRect(bx, by, barW * worldProgress, barH, 6).fill({ color: 0x8df0a7, alpha: 0.82 });

    if (awakeningActive) {
      milestoneText.alpha = awakeningMsgAlpha;
    } else {
      milestoneText.alpha = 0;
    }
    if (screenGlowMs > 0) {
      screenGlowMs -= ticker.deltaMS;
      screenGlow.alpha = Math.min(0.16, screenGlowMs / 680) * (0.7 + worldProgress * 0.3);
    } else {
      screenGlow.alpha = 0;
    }

    miniMapDots.clear();
    const mmx = miniMap.x;
    const mmy = miniMap.y;
    const mms = miniMap.width;
    const toMini = (x, y) => ({
      x: mmx + ((x + HALF_WORLD) / WORLD_SIZE) * mms,
      y: mmy + ((y + HALF_WORLD) / WORLD_SIZE) * mms,
    });
    const p = toMini(player.x, player.y);
    miniMapDots.circle(p.x, p.y, 3.3).fill({ color: 0xeaffdf, alpha: 1 });
    for (let i = 0; i < worldCritters.length; i += 1) {
      const cr = worldCritters[i];
      const cp = toMini(cr.x, cr.y);
      const magical = isMagicalCritter(cr);
      miniMapDots.circle(cp.x, cp.y, magical ? 5 : 2).fill({ color: magical ? 0xffe8a8 : 0xa8e8c8, alpha: 0.95 });
    }
  };
  app.ticker.add(onTick);

  const cleanup = () => {
    if (sessionPlayedMs > 3 * 60 * 1000 && spiritStrength < 12) {
      spiritStrength = Math.min(12, spiritStrength + 1);
    }
    const memoryStride = Math.max(4, Math.floor(16 - spiritStrength * 0.6));
    const worldMemoryTrail = [];
    for (let i = 0; i < trail.length; i += memoryStride) {
      worldMemoryTrail.push({ x: trail[i].x, y: trail[i].y });
    }
    saveProgression({
      ...progression,
      spiritStrength,
      totalAwakenings,
      lastSeenAt: Date.now(),
      lastDailyBonusDay: progression.lastDailyBonusDay,
      worldMemoryTrail: worldMemoryTrail.slice(-64),
    });
    app.ticker.remove(onTick);
    app.renderer.off("resize", onResize);
    stage.off("pointermove", syncPointer);
    app.canvas.removeEventListener("pointermove", onCanvasPointerMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    flowers.forEach((f) => f.destroy());
    trees.forEach((t) => t.destroy());
    trailGlows.forEach((g) => g.destroy());
    bloomBursts.forEach((b) => b.destroy());
    awakeningWave.destroy();
    playerMotes.forEach((m) => m.destroy());
    lifeAuras.forEach((a) => a.destroy());
    ambientMotes.forEach((m) => m.destroy());
    essences.forEach((e) => e.destroy());
    boosterDrops.forEach((b) => b.destroy({ children: true }));
    worldCritters.forEach((c) => c.destroy({ children: true }));
    rainDrops.forEach((r) => r.destroy());
    flowerTextures.forEach((t) => t.destroy(true));
    treeTextures.forEach((t) => t.destroy(true));
    trailGlowTex.destroy(true);
    bgTex.destroy(true);
    noiseTexNear.destroy(true);
    noiseTexFar.destroy(true);
    spiritLookTextures.forEach((t) => t.destroy(true));
    soulLookTextures.forEach((t) => t.destroy(true));
    essenceTex.destroy(true);
    critterTextures.forEach((t) => t.destroy(true));
    presenceSub.unsubscribe();
    lifeTex.destroy(true);
    miniMapTex.destroy(true);
    sounds.destroy();
    if (!injectedApp) {
      app.destroy(true, { children: true, texture: true });
    }
  };

  return {
    cleanup,
    setPaused: (v) => {
      gamePaused = v;
    },
    setPlayerLabel: (s) => {
      playerDisplayName = s;
      presenceSub.setDisplayName(s);
    },
    setSpiritLook: (id) => {
      applySpiritLook(id);
    },
    setGameMode: (id, label) => {
      gameModeId = id;
      gameModeLabel = label ?? id;
    },
    getGameMode: () => ({ id: gameModeId, label: gameModeLabel }),
  };
}
