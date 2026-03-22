import * as PIXI from "pixi.js";

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

function createSpiritTexture() {
  const c = document.createElement("canvas");
  c.width = 196;
  c.height = 196;
  const ctx = c.getContext("2d");
  const cx = c.width * 0.5;
  const cy = c.height * 0.5;

  const outer = ctx.createRadialGradient(cx, cy, 8, cx, cy, 84);
  outer.addColorStop(0, "rgba(230,255,228,0.62)");
  outer.addColorStop(0.4, "rgba(160,225,168,0.34)");
  outer.addColorStop(1, "rgba(160,225,168,0)");
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, c.width, c.height);

  const body = ctx.createRadialGradient(cx, cy, 6, cx, cy, 32);
  body.addColorStop(0, "rgba(244,255,236,0.95)");
  body.addColorStop(0.7, "rgba(191,234,184,0.88)");
  body.addColorStop(1, "rgba(145,200,143,0.55)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();
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
 * Impressionistic garden blooms — soft radial blobs, strong saturation, no hard outlines
 * (painterly clusters inspired by lush path-side flower beds).
 */
function makePainterlyFlowerTexture(variant) {
  const W = 128;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const cx = W * 0.5;
  const cy = H * 0.5;

  const drawBlob = (dx, dy, rx, ry, rotation, rGrad, c0, c1, c2) => {
    const x = cx + dx;
    const y = cy + dy;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rGrad);
    g.addColorStop(0, c0);
    g.addColorStop(0.48, c1);
    g.addColorStop(1, c2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const wisp = (x1, y1, x2, y2, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const palettes = [
    // 0 — vivid pink / magenta cluster (carnation-like)
    () => {
      drawBlob(-22, -12, 30, 22, -0.35, 40, "rgba(255,140,205,1)", "rgba(255,75,155,0.72)", "rgba(255,40,120,0)");
      drawBlob(20, 6, 26, 20, 0.45, 36, "rgba(255,175,220,1)", "rgba(255,95,175,0.68)", "rgba(255,50,130,0)");
      drawBlob(-4, 22, 24, 18, 0.1, 34, "rgba(255,115,190,1)", "rgba(235,65,150,0.65)", "rgba(220,40,110,0)");
      drawBlob(8, -18, 22, 16, 0.2, 30, "rgba(255,200,235,0.95)", "rgba(255,120,185,0.55)", "rgba(255,80,150,0)");
      drawBlob(-14, 14, 18, 14, -0.2, 26, "rgba(255,160,210,1)", "rgba(250,90,165,0.5)", "rgba(230,50,120,0)");
      wisp(cx - 40, cy + 48, cx - 36, cy + 58, "rgba(140,210,150,0.6)");
      wisp(cx + 38, cy + 46, cx + 42, cy + 56, "rgba(130,200,145,0.55)");
    },
    // 1 — marigold / lemon / gold
    () => {
      drawBlob(-18, -8, 28, 22, -0.25, 38, "rgba(255,235,90,1)", "rgba(255,195,40,0.75)", "rgba(255,160,20,0)");
      drawBlob(16, 10, 26, 20, 0.5, 34, "rgba(255,245,140,1)", "rgba(255,210,60,0.7)", "rgba(255,170,30,0)");
      drawBlob(-6, 20, 22, 17, 0, 30, "rgba(255,220,100,1)", "rgba(255,180,50,0.65)", "rgba(240,140,20,0)");
      drawBlob(10, -20, 20, 15, 0.3, 28, "rgba(255,250,200,0.95)", "rgba(255,200,80,0.55)", "rgba(255,160,40,0)");
      wisp(cx - 35, cy + 50, cx - 30, cy + 60, "rgba(160,215,130,0.5)");
    },
    // 2 — periwinkle / lavender / sky blue
    () => {
      drawBlob(-20, -6, 28, 21, -0.3, 38, "rgba(165,195,255,1)", "rgba(120,155,245,0.75)", "rgba(80,120,230,0)");
      drawBlob(18, 8, 25, 19, 0.4, 34, "rgba(200,185,255,1)", "rgba(150,130,240,0.68)", "rgba(110,90,210,0)");
      drawBlob(-8, 22, 22, 17, 0.1, 30, "rgba(175,210,255,1)", "rgba(130,170,245,0.62)", "rgba(90,130,220,0)");
      drawBlob(6, -18, 20, 15, 0.15, 28, "rgba(220,210,255,0.95)", "rgba(160,150,235,0.52)", "rgba(120,100,200,0)");
    },
    // 3 — coral / peach / warm pink
    () => {
      drawBlob(-18, -10, 29, 22, -0.28, 39, "rgba(255,155,145,1)", "rgba(255,110,100,0.74)", "rgba(255,70,70,0)");
      drawBlob(20, 6, 26, 20, 0.42, 35, "rgba(255,200,175,1)", "rgba(255,140,120,0.68)", "rgba(255,90,80,0)");
      drawBlob(-4, 20, 23, 17, 0, 31, "rgba(255,175,160,1)", "rgba(255,120,100,0.62)", "rgba(240,80,70,0)");
      drawBlob(10, -16, 21, 16, 0.2, 29, "rgba(255,225,210,0.95)", "rgba(255,150,130,0.55)", "rgba(255,100,85,0)");
    },
    // 4 — fuchsia / deep rose with mint accents
    () => {
      drawBlob(-20, -8, 30, 22, -0.32, 40, "rgba(255,90,180,1)", "rgba(230,40,150,0.76)", "rgba(200,20,120,0)");
      drawBlob(18, 10, 26, 20, 0.48, 36, "rgba(255,130,210,1)", "rgba(220,60,165,0.7)", "rgba(190,30,130,0)");
      drawBlob(-6, 22, 23, 17, 0.08, 32, "rgba(240,80,170,1)", "rgba(200,50,140,0.64)", "rgba(170,25,100,0)");
      drawBlob(8, -18, 20, 15, 0.18, 28, "rgba(255,200,230,0.92)", "rgba(255,100,180,0.52)", "rgba(220,50,130,0)");
      drawBlob(-36, 28, 14, 10, 0.6, 18, "rgba(160,230,175,0.85)", "rgba(100,190,130,0.45)", "rgba(60,150,90,0)");
      drawBlob(34, 26, 12, 9, -0.4, 16, "rgba(150,225,170,0.8)", "rgba(90,185,125,0.4)", "rgba(50,140,85,0)");
    },
  ];

  palettes[variant % palettes.length]();

  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
  cg.addColorStop(0, "rgba(255,255,250,0.95)");
  cg.addColorStop(0.45, "rgba(255,255,240,0.35)");
  cg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();

  return PIXI.Texture.from(c);
}

function makeEssenceTexture() {
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
  const trailLayer = new PIXI.Container();
  const spiritLayer = new PIXI.Container();
  const particleLayer = new PIXI.Container();
  const weatherLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  const flowTopBar = new PIXI.Container();

  root.addChild(backdropLayer);
  root.addChild(world);
  world.addChild(lifeLayer);
  world.addChild(depthLayer);
  world.addChild(lifeAuraLayer);
  world.addChild(floraLayer);
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
  lifeField.fill(0.06);
  const lifeCanvas = makeLifeTextureCanvas();
  const lifeTex = PIXI.Texture.from(lifeCanvas.canvas);
  const lifeSprite = new PIXI.Sprite(lifeTex);
  lifeSprite.anchor.set(0.5);
  lifeSprite.width = WORLD_SIZE;
  lifeSprite.height = WORLD_SIZE;
  lifeSprite.alpha = 0.56;
  lifeLayer.addChild(lifeSprite);

  const spiritTexture = createSpiritTexture();
  const spirit = new PIXI.Sprite(spiritTexture);
  spirit.anchor.set(0.5);
  spirit.scale.set(1.55);
  spiritLayer.addChild(spirit);

  const soulTex = makeEssenceTexture();
  const soul = new PIXI.Sprite(soulTex);
  soul.anchor.set(0.5);
  soul.scale.set(0.32);
  spirit.addChild(soul);

  const ghosts = [];
  for (let i = 0; i < 4; i += 1) {
    const g = new PIXI.Sprite(spiritTexture);
    g.anchor.set(0.5);
    g.scale.set(1.1);
    g.alpha = 0.58;
    g.tint = 0xc8ffd0;
    g.x = (Math.random() * 2 - 1) * 900;
    g.y = (Math.random() * 2 - 1) * 900;
    g._tx = g.x;
    g._ty = g.y;
    g._retarget = 300 + Math.random() * 1200;
    spiritLayer.addChild(g);
    ghosts.push(g);
  }

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
  const bloomBursts = [];

  const essences = [];
  const essenceTex = makeEssenceTexture();
  const ambientMotes = [];
  const playerMotes = [];
  const lifeAuras = [];

  const pointer = { x: app.screen.width * 0.5, y: app.screen.height * 0.5 };
  const keys = new Set();
  let boostHeld = false;
  const velocity = { x: 0, y: 0 };
  let energy = 0;
  let level = 1;

  const weather = { kind: "sunny", timer: 65000 };
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
  const awakeningMessages = ["The world remembers", "Life returns", "What was lost, returns"];

  const energyText = new PIXI.Text({
    text: "Energy: 0",
    style: { fill: 0xe6ffe3, fontFamily: "Montserrat", fontSize: 16, fontWeight: "600" },
  });
  energyText.x = 16;
  energyText.y = 12;
  uiLayer.addChild(energyText);

  const levelText = new PIXI.Text({
    text: "Level: 1",
    style: { fill: 0xc8ffd6, fontFamily: "Montserrat", fontSize: 14, fontWeight: "600" },
  });
  levelText.x = 16;
  levelText.y = 34;
  uiLayer.addChild(levelText);

  const goalText = new PIXI.Text({
    text: "Gather essence • Let your restoration flow through the land — both matter.",
    style: {
      fill: 0xa8d4b4,
      fontFamily: "Montserrat",
      fontSize: 11,
      fontWeight: "500",
      align: "center",
      wordWrap: true,
      wordWrapWidth: 520,
    },
  });
  goalText.anchor.set(0.5, 0);
  uiLayer.addChild(goalText);

  const whisperPool = [
    "Something was here once",
    "It feels familiar",
    "Life is returning",
    "The world remembers",
    "You are not alone here",
    "It is waking",
  ];
  let whisperCooldownMs = 22000 + Math.random() * 12000;
  let whisperPhase = 0;
  let whisperPhaseMs = 0;
  const whisperText = new PIXI.Text({
    text: "",
    style: {
      fill: 0xa8c9b8,
      fontFamily: "Montserrat, Georgia, serif",
      fontSize: 13,
      fontWeight: "400",
      fontStyle: "italic",
      align: "center",
      wordWrap: true,
      wordWrapWidth: 440,
    },
  });
  whisperText.anchor.set(0.5);
  whisperText.alpha = 0;
  uiLayer.addChild(whisperText);

  const hintText = new PIXI.Text({
    text: "Walk gently",
    style: { fill: 0xe8ffe0, fontFamily: "Montserrat", fontSize: 14, fontWeight: "500" },
  });
  uiLayer.addChild(hintText);

  const weatherText = new PIXI.Text({
    text: "Weather: Sunny",
    style: { fill: 0xe8ffe0, fontFamily: "Montserrat", fontSize: 13, fontWeight: "600" },
  });
  weatherText.x = 16;
  weatherText.y = 56;
  const hudPanel = new PIXI.Graphics();
  uiLayer.addChild(hudPanel);
  uiLayer.addChild(weatherText);

  const worldBarBg = new PIXI.Graphics();
  const worldBarFill = new PIXI.Graphics();
  const worldBarLabel = new PIXI.Text({
    text: "World Restoration",
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
  uiLayer.addChild(miniMapBg);
  uiLayer.addChild(miniMap);
  uiLayer.addChild(miniMapDots);

  const HUD_SHIFT_Y = 40;

  const flowPlayerLabel = new PIXI.Text({
    text: flowPlayerName,
    style: { fill: 0xc8e8d4, fontFamily: "Montserrat", fontSize: 13, fontWeight: "500" },
  });
  const flowProfile = new PIXI.Text({
    text: "Profile",
    style: { fill: 0xa8d4c0, fontFamily: "Montserrat", fontSize: 13, fontWeight: "500" },
  });
  flowProfile.eventMode = "static";
  flowProfile.cursor = "pointer";
  flowProfile.alpha = 0.62;
  flowProfile.on("pointerover", () => {
    flowProfile.alpha = 1;
  });
  flowProfile.on("pointerout", () => {
    flowProfile.alpha = 0.62;
  });
  flowProfile.on("pointerdown", () => onFlowProfile());

  const flowLogout = new PIXI.Text({
    text: "Logout",
    style: { fill: 0xa8d4c0, fontFamily: "Montserrat", fontSize: 13, fontWeight: "500" },
  });
  flowLogout.eventMode = "static";
  flowLogout.cursor = "pointer";
  flowLogout.alpha = 0.62;
  flowLogout.on("pointerover", () => {
    flowLogout.alpha = 1;
  });
  flowLogout.on("pointerout", () => {
    flowLogout.alpha = 0.62;
  });
  flowLogout.on("pointerdown", () => onFlowLogout());

  flowTopBar.addChild(flowPlayerLabel);
  flowTopBar.addChild(flowProfile);
  flowTopBar.addChild(flowLogout);
  uiLayer.addChild(flowTopBar);

  const layoutUI = () => {
    const h = HUD_SHIFT_Y;
    energyText.y = 12 + h;
    levelText.y = 34 + h;
    weatherText.y = 56 + h;

    hudPanel.clear();
    hudPanel.roundRect(8, 8 + h, 174, 70, 10).fill({ color: 0x10271b, alpha: 0.34 });
    hudPanel.roundRect(8, 8 + h, 174, 70, 10).stroke({ width: 1, color: 0xb5e8b7, alpha: 0.14 });
    goalText.x = app.screen.width * 0.5;
    goalText.y = app.screen.height - 58;
    goalText.style.wordWrapWidth = Math.min(560, app.screen.width - 32);
    whisperText.style.wordWrapWidth = Math.min(440, app.screen.width - 48);
    whisperText.x = app.screen.width * 0.5;
    whisperText.y = app.screen.height * 0.38;
    hintText.x = app.screen.width * 0.5 - hintText.width * 0.5;
    hintText.y = app.screen.height - 30;
    const s = 150;
    const x = app.screen.width - s - 16;
    const y = 16 + h;
    miniMap.x = x;
    miniMap.y = y;
    miniMap.width = s;
    miniMap.height = s;
    miniMapBg.clear();
    miniMapBg.roundRect(x - 7, y - 7, s + 14, s + 14, 8).fill({ color: 0x11281c, alpha: 0.32 });
    miniMapBg.roundRect(x - 7, y - 7, s + 14, s + 14, 8).stroke({ width: 1, color: 0xb8f7be, alpha: 0.12 });

    const barW = 260;
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

    flowPlayerLabel.x = 16;
    flowPlayerLabel.y = 10;
    flowLogout.x = app.screen.width - flowLogout.width - 20;
    flowLogout.y = 10;
    flowProfile.x = flowLogout.x - flowProfile.width - 28;
    flowProfile.y = 10;
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
    if (e.code === "Space") {
      e.preventDefault();
      boostHeld = true;
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
      d.moveTo(0, 0).lineTo(0, 10).stroke({ width: 1, color: 0xa7dbff, alpha: 0.5 });
      d.x = Math.random() * app.screen.width;
      d.y = Math.random() * app.screen.height;
      d._vx = -0.8 - Math.random() * 0.7;
      d._vy = 2.2 + Math.random() * 1.4;
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
    for (let i = 0; i < lifeField.length; i += 1) {
      const v = lifeField[i];
      const deadR = 58;
      const deadG = 66;
      const deadB = 60;
      const aliveR = 96;
      const aliveG = 185;
      const aliveB = 104;
      d[i * 4] = (deadR + (aliveR - deadR) * v) | 0;
      d[i * 4 + 1] = (deadG + (aliveG - deadG) * v) | 0;
      d[i * 4 + 2] = (deadB + (aliveB - deadB) * v) | 0;
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
    e.scale.set(0.27 + Math.random() * 0.16);
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

  const setWeather = (kind) => {
    weather.kind = kind;
    weather.timer = 60000 + Math.random() * 30000;
    weatherText.text = `Weather: ${kind[0].toUpperCase()}${kind.slice(1)}`;
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
    awakeningSoundPlayed = false;
    milestoneMsgMs = 0;
    screenGlowMs = 0;
    milestoneText.text = awakeningMessages[(Math.random() * awakeningMessages.length) | 0];
    spawnBloomEvent(player.x, player.y, 0.88, { awardWorldLife: false, playSound: false, particleMult: 0.92 });
  }

  const spawnBloomEvent = (x, y, power = 1, opts = {}) => {
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
      const flowerVis = 2.05;
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
    ring.scale.set(0.4 * (particleMult < 0.75 ? 0.75 : 1));
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
      halo.scale.set((0.34 + Math.random() * 0.28) * (particleMult < 0.75 ? 0.8 : 1));
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

  let milestoneMsgMs = 0;
  let screenGlowMs = 0;
  const milestoneMessages = ["A pulse beneath the silence", "The old warmth stirs", "What slept begins to listen"];
  const triggerMilestone = (idx) => {
    spawnBloomEvent(player.x, player.y, 1.8);
    sounds.playEffect("bloom");
    window.setTimeout(() => sounds.playEffect("bloom"), 120);
    milestoneText.text = milestoneMessages[idx] ?? "The land recalls";
    milestoneText.alpha = 1;
    milestoneMsgMs = 2400;
    screenGlowMs = 680;
  };
  const addWorldLife = (amount) => {
    if (amount <= 0) return;
    const prev = worldLife;
    worldLife = clamp(worldLife + amount, 0, 100);
    if (worldLife < 95) hasAwakened = false;
    while (nextMilestoneIdx < worldMilestones.length && prev < worldMilestones[nextMilestoneIdx] && worldLife >= worldMilestones[nextMilestoneIdx]) {
      triggerMilestone(nextMilestoneIdx);
      nextMilestoneIdx += 1;
    }
    if (prev < 100 && worldLife >= 100 && !hasAwakened && !awakeningActive) beginAwakening();
  };

  const sounds = createSoundManager();
  sounds.playAmbient();
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
    const cx = app.screen.width * 0.5;
    const cy = app.screen.height * 0.5;

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
        if (!afterglowMotesAdded) {
          afterglowMotesAdded = true;
          onWorldAwaken?.();
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

    const accel = boostHeld ? 0.36 : 0.22;
    const baseSpeed = 4.45; // slightly faster default feel
    const maxSpeed = baseSpeed * (boostHeld ? 1.42 : 1) + (weather.kind === "wind" ? 0.3 : 0);
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
    if (trail.length > 160) trail.shift();
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
      f.scale.set((0.62 + Math.random() * 0.38) * 1.22);
      f.alpha = 0.88;
      f.blendMode = "normal";
      f._age = 0;
      flowers.push(f);
      floraLayer.addChild(f);

      const glow = new PIXI.Sprite(trailGlowTex);
      glow.anchor.set(0.5);
      glow.x = f.x;
      glow.y = f.y;
      glow.scale.set(0.28 + Math.random() * 0.18);
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
      f.tint = 0xffffff;
      if (f._age > 18000) {
        f.alpha -= 0.0035 * dt;
        if (f.alpha <= 0) {
          f.destroy();
          flowers.splice(i, 1);
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

    const growthBoost = weather.kind === "rain" ? 1.65 : 1;
    addLifeAt(player.x, player.y, 5 + (level >= 4 ? 2 : 0), 0.02 * dt * growthBoost);
    for (let i = 0; i < trail.length; i += 4) {
      const p = trail[i];
      addLifeAt(p.x, p.y, 2, 0.0038 * dt * growthBoost);
    }

    for (let i = 0; i < ghosts.length; i += 1) {
      const g = ghosts[i];
      g._retarget -= ticker.deltaMS;
      if (g._retarget <= 0) {
        g._tx = g.x + (Math.random() * 2 - 1) * 520;
        g._ty = g.y + (Math.random() * 2 - 1) * 520;
        g._tx = clamp(g._tx, -HALF_WORLD + 40, HALF_WORLD - 40);
        g._ty = clamp(g._ty, -HALF_WORLD + 40, HALF_WORLD - 40);
        g._retarget = 400 + Math.random() * 1400;
      }
      const tx = g._tx - g.x;
      const ty = g._ty - g.y;
      const dist = Math.hypot(tx, ty) || 1;
      const step = 1.4 * dt;
      g.x += (tx / dist) * Math.min(step, dist);
      g.y += (ty / dist) * Math.min(step, dist);
      g.scale.set(1.05 + Math.sin(ticker.lastTime * 0.003 + i) * 0.08);
      addLifeAt(g.x, g.y, 3, 0.0055 * dt);
    }

    const vitalityEssence = 0.52 + 0.48 * (worldLife / 100);
    if (Math.random() < 0.32 * (1 - eventSuppress * 0.55) * vitalityEssence) maybeSpawnEssence();
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
      if (dx * dx + dy * dy < 22 * 22) {
        e.destroy();
        essences.splice(i, 1);
        energy += 1 * energyBoost;
        addLifeAt(player.x, player.y, 7, 0.14);
        spawnBloomEvent(player.x, player.y, 1.15);
        sounds.playEffect("collect");
        addWorldLife(1);
      }
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
        b.scale.set(0.4 + t * 1.8);
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
    let worldDecay = 0.000042 * dt;
    if (!hasAwakened && worldLife >= 99) worldDecay = 0;
    worldLife = Math.max(0, worldLife - worldDecay);
    // Guarantee crossing 100% (float / rounding) — next step is the awakening moment.
    if (!hasAwakened && !awakeningActive && worldLife >= 99.92 && worldLife < 100) {
      addWorldLife(100 - worldLife);
    }
    const worldProgress = worldLife / 100;
    let ambTarget = 0.24 * (0.58 + 0.42 * worldProgress);
    if (awakeningActive && awakeningElapsed >= 780 && awakeningElapsed < 2800) ambTarget = Math.max(ambTarget, 0.31);
    sounds.setAmbientVolumeTarget(ambTarget);
    sounds.tickAmbientVolume(dt);

    const moveSpdWhisper = Math.hypot(velocity.x, velocity.y);
    const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    if (whisperPhase === 0) {
      whisperCooldownMs -= ticker.deltaMS;
      if (whisperCooldownMs <= 0 && moveSpdWhisper > 0.32 && !awakeningActive && milestoneMsgMs <= 0) {
        whisperText.text = whisperPool[(Math.random() * whisperPool.length) | 0];
        whisperPhase = 1;
        whisperPhaseMs = 0;
      }
    } else if (whisperPhase === 1) {
      whisperPhaseMs += ticker.deltaMS;
      const k = smooth(Math.min(1, whisperPhaseMs / 1000));
      whisperText.alpha = k * 0.28;
      if (whisperPhaseMs >= 1000) {
        whisperPhase = 2;
        whisperPhaseMs = 0;
      }
    } else if (whisperPhase === 2) {
      whisperPhaseMs += ticker.deltaMS;
      whisperText.alpha = 0.28;
      if (whisperPhaseMs >= 700) {
        whisperPhase = 3;
        whisperPhaseMs = 0;
      }
    } else if (whisperPhase === 3) {
      whisperPhaseMs += ticker.deltaMS;
      const k = smooth(Math.min(1, whisperPhaseMs / 1000));
      whisperText.alpha = 0.28 * (1 - k);
      if (whisperPhaseMs >= 1000) {
        whisperPhase = 0;
        whisperCooldownMs = 20000 + Math.random() * 20000;
        whisperText.alpha = 0;
      }
    }

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
    if (oldLevel !== level) hintText.text = "The land leans toward you";
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
    const targetZoom = 0.66 - clamp(speed / 25, 0, 0.06);
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
      const r = Math.round(lerp(178, 255, vit));
      const g = Math.round(lerp(184, 255, vit));
      const b = Math.round(lerp(176, 255, vit));
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

    energyText.text = `Energy: ${Math.floor(energy)}`;
    levelText.text = `Level: ${level}`;
    if (!hasAwakened && worldLife >= 98.5 && worldLife < 100 && !awakeningActive) {
      hintText.text = "Almost whole again";
    } else if (weather.kind === "sunny") hintText.text = "Warm light feeds your spirit";
    else if (weather.kind === "rain") hintText.text = "Rain awakens sleeping life";
    else hintText.text = "Wind carries seeds of change";

    const barW = 260;
    const barH = 10;
    const bx = app.screen.width * 0.5 - barW * 0.5;
    const by = 14 + HUD_SHIFT_Y;
    const wlDisp = worldLife >= 100 ? 100 : Math.round(worldLife * 10) / 10;
    worldBarLabel.text = `World Restoration ${wlDisp}%`;
    worldBarLabel.x = bx + barW * 0.5 - worldBarLabel.width * 0.5;
    worldBarFill.clear();
    worldBarFill.roundRect(bx, by, barW * worldProgress, barH, 6).fill({ color: 0x8df0a7, alpha: 0.82 });

    if (awakeningActive) {
      milestoneText.alpha = awakeningMsgAlpha;
    } else if (milestoneMsgMs > 0) {
      milestoneMsgMs -= ticker.deltaMS;
      milestoneText.alpha = Math.min(1, milestoneMsgMs / 500);
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
    for (let i = 0; i < ghosts.length; i += 1) {
      const gp = toMini(ghosts[i].x, ghosts[i].y);
      miniMapDots.circle(gp.x, gp.y, 2.2).fill({ color: 0xb9efbf, alpha: 0.9 });
    }
  };
  app.ticker.add(onTick);

  const cleanup = () => {
    app.ticker.remove(onTick);
    app.renderer.off("resize", onResize);
    stage.off("pointermove", syncPointer);
    app.canvas.removeEventListener("pointermove", onCanvasPointerMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    flowers.forEach((f) => f.destroy());
    trailGlows.forEach((g) => g.destroy());
    bloomBursts.forEach((b) => b.destroy());
    awakeningWave.destroy();
    playerMotes.forEach((m) => m.destroy());
    lifeAuras.forEach((a) => a.destroy());
    ambientMotes.forEach((m) => m.destroy());
    essences.forEach((e) => e.destroy());
    rainDrops.forEach((r) => r.destroy());
    flowerTextures.forEach((t) => t.destroy(true));
    trailGlowTex.destroy(true);
    bgTex.destroy(true);
    noiseTexNear.destroy(true);
    noiseTexFar.destroy(true);
    spiritTexture.destroy(true);
    soulTex.destroy(true);
    essenceTex.destroy(true);
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
      flowPlayerLabel.text = s;
    },
  };
}
