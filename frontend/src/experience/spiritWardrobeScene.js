import * as PIXI from "pixi.js";
import gsap from "gsap";
import { createSpiritTexture } from "../Game.js";
import { SPIRIT_LOOK_COUNT, SPIRIT_LOOKS, normalizeSpiritLook } from "../sprites/spiritLooks.js";

/**
 * Immersive spirit selection: center hero, orbiting others, living background.
 * @param {import("pixi.js").Application} app
 * @param {{
 *   fontUi: string,
 *   playSoftClick: () => void,
 *   getSelectedLook: () => number,
 *   applySpiritLook: (i: number) => void,
 *   goWelcome: () => void,
 * }} ctx
 */
export function createSpiritWardrobeScene(app, ctx) {
  const { fontUi, playSoftClick, getSelectedLook, applySpiritLook, goWelcome } = ctx;

  const root = new PIXI.Container();
  root.sortableChildren = true;

  /** @type {PIXI.Sprite | null} */
  let bgSprite = null;
  let lastBgW = 0;
  let lastBgH = 0;

  const fogA = new PIXI.Graphics();
  const fogB = new PIXI.Graphics();
  const spores = new PIXI.Graphics();
  const lightSpot = new PIXI.Graphics();
  const orbitLayer = new PIXI.Container();
  const heroLayer = new PIXI.Container();
  const auraGlow = new PIXI.Graphics();
  const burstLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();

  let previewIndex = 0;
  /** @type {{ container: PIXI.Container, sprite: PIXI.Sprite, idx: number, baseX: number, baseY: number, phase: number, depth: number, hovered: boolean, hoverT: number }[]} */
  let orbitSlots = [];
  let orbitCx = 0;
  let orbitCy = 0;
  let orbitR = 0;

  const heroSprite = new PIXI.Sprite(createSpiritTexture(0));
  heroSprite.anchor.set(0.5);
  const ORBIT_SCALE = 0.34;
  const HERO_SCALE = ORBIT_SCALE * 2.5;

  const wrTitle = new PIXI.Text({
    text: "Choose your spirit",
    style: {
      fontFamily: fontUi,
      fontSize: 34,
      fontWeight: "700",
      fill: 0xf4fff8,
      dropShadow: { alpha: 0.35, angle: Math.PI / 2, blur: 16, color: 0x5a9070, distance: 0 },
    },
  });
  wrTitle.anchor.set(0.5);

  const wrSubtitle = new PIXI.Text({
    text: "Each form carries a different presence",
    style: {
      fontFamily: fontUi,
      fontSize: 17,
      fontWeight: "500",
      fill: 0xc8e8dc,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 420,
      lineHeight: 26,
    },
  });
  wrSubtitle.anchor.set(0.5);

  const centerName = new PIXI.Text({
    text: "",
    style: {
      fontFamily: fontUi,
      fontSize: 28,
      fontWeight: "700",
      fill: 0xf0fff6,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 520,
      lineHeight: 34,
    },
  });
  centerName.anchor.set(0.5);

  const centerPoetic = new PIXI.Text({
    text: "",
    style: {
      fontFamily: fontUi,
      fontSize: 16,
      fontWeight: "500",
      fill: 0xb8dcc8,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 480,
      lineHeight: 24,
    },
  });
  centerPoetic.anchor.set(0.5);

  const btnBecome = new PIXI.Container();
  const btnGlow = new PIXI.Graphics();
  const btnBecomeG = new PIXI.Graphics();
  const btnBecomeT = new PIXI.Text({
    text: "Become this spirit",
    style: {
      fontFamily: fontUi,
      fontSize: 18,
      fontWeight: "700",
      fill: 0xffffff,
    },
  });
  btnBecomeT.anchor.set(0.5);
  const BTN_W = 280;
  const BTN_H = 54;
  btnBecome.addChild(btnGlow);
  btnBecome.addChild(btnBecomeG);
  btnBecome.addChild(btnBecomeT);
  btnBecome.eventMode = "static";
  btnBecome.cursor = "pointer";
  btnBecome.hitArea = new PIXI.Rectangle(0, 0, BTN_W, BTN_H);

  function drawBecomeBtn(hover) {
    btnBecomeG.clear();
    btnGlow.clear();
    const fill = hover ? 0x4bc882 : 0x3daf72;
    btnBecomeG.roundRect(0, 0, BTN_W, BTN_H, 26).fill({ color: fill, alpha: 1 });
    btnBecomeG.roundRect(0, 0, BTN_W, BTN_H, 26).stroke({ width: 2, color: 0xe0ffe8, alpha: hover ? 0.55 : 0.4 });
    btnBecomeG.roundRect(4, 4, BTN_W - 8, 14, 10).fill({ color: 0xffffff, alpha: hover ? 0.2 : 0.12 });
    btnGlow.roundRect(-6, -6, BTN_W + 12, BTN_H + 12, 30).fill({ color: 0x8ef0b8, alpha: hover ? 0.22 : 0.14 });
  }
  drawBecomeBtn(false);
  btnBecomeT.x = BTN_W * 0.5;
  btnBecomeT.y = BTN_H * 0.5;

  btnBecome.on("pointerover", () => {
    drawBecomeBtn(true);
    gsap.to(btnBecome.scale, { x: 1.03, y: 1.03, duration: 0.25 });
  });
  btnBecome.on("pointerout", () => {
    drawBecomeBtn(false);
    gsap.to(btnBecome.scale, { x: 1, y: 1, duration: 0.25 });
  });
  btnBecome.on("pointerdown", () => {
    playSoftClick();
    pulseHeroGlow();
    burstParticles();
    applySpiritLook(normalizeSpiritLook(previewIndex));
    goWelcome();
  });

  heroLayer.addChild(auraGlow);
  heroLayer.addChild(heroSprite);
  uiLayer.addChild(wrTitle);
  uiLayer.addChild(wrSubtitle);
  uiLayer.addChild(centerName);
  uiLayer.addChild(centerPoetic);
  uiLayer.addChild(btnBecome);

  root.addChild(fogA);
  root.addChild(fogB);
  root.addChild(spores);
  root.addChild(lightSpot);
  root.addChild(orbitLayer);
  root.addChild(heroLayer);
  root.addChild(burstLayer);
  root.addChild(uiLayer);

  /** Background gradient texture (center bright). Rebuilt on resize only. */
  function ensureBg(w, h) {
    if (bgSprite && lastBgW === w && lastBgH === h) return;
    if (bgSprite) {
      bgSprite.destroy();
      root.removeChild(bgSprite);
    }
    const c = document.createElement("canvas");
    c.width = Math.max(64, Math.floor(w));
    c.height = Math.max(64, Math.floor(h));
    const g = c.getContext("2d");
    const cx = w * 0.5;
    const cy = h * 0.42;
    const rad = Math.max(w, h) * 0.72;
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, "rgba(185,235,200,0.42)");
    rg.addColorStop(0.35, "rgba(45,95,70,0.38)");
    rg.addColorStop(0.7, "rgba(18,48,38,0.55)");
    rg.addColorStop(1, "rgba(6,16,14,0.97)");
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    const tex = PIXI.Texture.from(c);
    bgSprite = new PIXI.Sprite(tex);
    bgSprite.width = w;
    bgSprite.height = h;
    root.addChildAt(bgSprite, 0);
    lastBgW = w;
    lastBgH = h;
  }

  let targetLightX = 0;
  let targetLightY = 0;
  let lightSmoothX = 0;
  let lightSmoothY = 0;

  function layoutFog(w, h, t) {
    fogA.clear();
    fogB.clear();
    const fx = w * 0.5 + Math.sin(t * 0.08) * 40;
    const fy = h * 0.35 + Math.cos(t * 0.06) * 30;
    fogA.ellipse(fx, fy, w * 0.45, h * 0.28).fill({ color: 0x8ec9a8, alpha: 0.06 });
    fogB.ellipse(w * 0.55 + Math.cos(t * 0.05) * 50, h * 0.6, w * 0.35, h * 0.22).fill({ color: 0x6a9880, alpha: 0.05 });
  }

  const sporeState = [];
  function initSpores(w, h) {
    sporeState.length = 0;
    spores.clear();
    for (let i = 0; i < 52; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1.2 + Math.random() * 2.2;
      const a = 0.08 + Math.random() * 0.12;
      sporeState.push({ x, y, r, a, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.12 });
      spores.circle(x, y, r).fill({ color: 0xc8f5d8, alpha: a });
    }
  }

  function tickSpores(w, h) {
    spores.clear();
    for (let i = 0; i < sporeState.length; i += 1) {
      const s = sporeState[i];
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < 0) s.x += w;
      if (s.x > w) s.x -= w;
      if (s.y < 0) s.y += h;
      if (s.y > h) s.y -= h;
      spores.circle(s.x, s.y, s.r).fill({ color: 0xd0f8e4, alpha: s.a });
    }
  }

  function drawAura() {
    auraGlow.clear();
    const r = 120;
    const g = auraGlow;
    for (let i = 3; i >= 0; i -= 1) {
      const a = 0.06 + i * 0.04;
      const rr = r + i * 28;
      g.circle(0, 0, rr).fill({ color: 0xb8f5d0, alpha: a * 0.35 });
    }
  }

  function pulseHeroGlow() {
    gsap.fromTo(
      auraGlow.scale,
      { x: 1, y: 1 },
      { x: 1.22, y: 1.22, duration: 0.35, ease: "power2.out", yoyo: true, repeat: 1 },
    );
  }

  function burstParticles() {
    burstLayer.removeChildren();
    const n = 18;
    for (let i = 0; i < n; i += 1) {
      const p = new PIXI.Graphics();
      const ang = (i / n) * Math.PI * 2;
      const dist = 90 + Math.random() * 40;
      p.circle(0, 0, 3 + Math.random() * 3).fill({ color: 0xe8ffd8, alpha: 0.85 });
      p.x = 0;
      p.y = 0;
      burstLayer.addChild(p);
      gsap.to(p, {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        alpha: 0,
        duration: 0.55,
        ease: "power2.out",
        onComplete: () => p.destroy(),
      });
    }
  }

  function updateHeroTexture() {
    const idx = normalizeSpiritLook(previewIndex);
    heroSprite.texture = createSpiritTexture(idx);
    heroSprite.scale.set(HERO_SCALE);
    const meta = SPIRIT_LOOKS[idx];
    centerName.text = meta?.label ?? "";
    centerPoetic.text = meta?.poeticLine ?? "";
    drawAura();
  }

  function clearOrbit() {
    orbitLayer.removeChildren();
    orbitSlots = [];
  }

  function buildOrbit(cx, cy, R) {
    clearOrbit();
    const others = [];
    for (let i = 0; i < SPIRIT_LOOK_COUNT; i += 1) {
      if (i !== previewIndex) others.push(i);
    }
    const n = others.length;
    for (let j = 0; j < n; j += 1) {
      const idx = others[j];
      const t = -Math.PI * 0.72 + (j / Math.max(1, n - 1)) * (Math.PI * 1.38);
      const baseX = cx + Math.cos(t) * R * 1.02;
      const baseY = cy + Math.sin(t) * R * 0.78;
      const depth = 0.52 + (j / Math.max(1, n - 1)) * 0.18;
      const container = new PIXI.Container();
      container.x = baseX;
      container.y = baseY;
      const spr = new PIXI.Sprite(createSpiritTexture(idx));
      spr.anchor.set(0.5);
      spr.scale.set(ORBIT_SCALE * (0.92 + depth * 0.08));
      spr.alpha = 0.52 + depth * 0.14;
      spr.tint = 0xd8d8ec;
      container.addChild(spr);
      container.eventMode = "static";
      container.cursor = "pointer";
      container.hitArea = new PIXI.Circle(0, 0, 56);
      const slot = { container, sprite: spr, idx, baseX, baseY, phase: Math.random() * Math.PI * 2, depth, hovered: false, hoverT: 0 };
      orbitSlots.push(slot);

      container.on("pointerover", () => {
        slot.hovered = true;
        gsap.killTweensOf(spr);
        gsap.to(spr, { alpha: 1, duration: 0.25 });
        gsap.to(spr.scale, {
          x: ORBIT_SCALE * 1.15 * (0.92 + depth * 0.08),
          y: ORBIT_SCALE * 1.15 * (0.92 + depth * 0.08),
          duration: 0.3,
          ease: "power2.out",
        });
      });
      container.on("pointerout", () => {
        slot.hovered = false;
        gsap.killTweensOf(spr);
        gsap.to(spr, { alpha: 0.52 + depth * 0.14, duration: 0.3 });
        gsap.to(spr.scale, {
          x: ORBIT_SCALE * (0.92 + depth * 0.08),
          y: ORBIT_SCALE * (0.92 + depth * 0.08),
          duration: 0.3,
        });
      });
      container.on("pointerdown", () => {
        playSoftClick();
        previewIndex = idx;
        pulseHeroGlow();
        burstParticles();
        updateHeroTexture();
        buildOrbit(orbitCx, orbitCy, orbitR);
      });

      orbitLayer.addChild(container);
    }
  }

  let heroBaseY = 0;
  /** @type {(() => void) | null} */
  let tickFn = null;

  function layoutScene() {
    const w = app.screen.width;
    const h = app.screen.height;
    root.hitArea = new PIXI.Rectangle(0, 0, w, h);

    ensureBg(w, h);
    initSpores(w, h);

    const cx = w * 0.5;
    const cy = h * 0.42;
    const R = Math.min(w, h) * 0.3;
    orbitCx = cx;
    orbitCy = cy;
    orbitR = R;
    heroBaseY = cy;
    heroLayer.x = cx;
    heroLayer.y = cy;
    burstLayer.x = cx;
    burstLayer.y = cy;

    targetLightX = cx;
    targetLightY = cy;
    lightSmoothX = cx;
    lightSmoothY = cy;

    updateHeroTexture();
    buildOrbit(cx, cy, R);

    wrTitle.x = cx;
    wrTitle.y = 52;
    wrSubtitle.x = cx;
    wrSubtitle.y = 96;
    wrSubtitle.style.wordWrapWidth = Math.min(460, w - 36);

    centerName.style.wordWrapWidth = Math.min(520, w - 40);
    centerPoetic.style.wordWrapWidth = Math.min(480, w - 40);

    centerName.x = cx;
    centerName.y = cy + 122;
    centerPoetic.x = cx;
    centerPoetic.y = centerName.y + Math.min(centerName.height, 72) * 0.5 + 20;

    btnBecome.x = cx - BTN_W * 0.5;
    btnBecome.y = Math.min(h - 80, centerPoetic.y + 44);

    layoutFog(w, h, performance.now() * 0.001);

    lightSpot.clear();
    lightSpot.circle(0, 0, 220).fill({ color: 0xe8ffe8, alpha: 0.055 });
    lightSpot.x = lightSmoothX;
    lightSpot.y = lightSmoothY;
  }

  root.eventMode = "static";
  root.on("pointermove", (e) => {
    const w = app.screen.width;
    const h = app.screen.height;
    const lx = e.global.x;
    const ly = e.global.y;
    const cx = w * 0.5;
    const cy = h * 0.42;
    targetLightX = cx + (lx - cx) * 0.18;
    targetLightY = cy + (ly - cy) * 0.14;
  });

  function onTick() {
    if (!root.visible || root.alpha < 0.01) return;
    const w = app.screen.width;
    const h = app.screen.height;
    const t = performance.now() * 0.001;

    lightSmoothX += (targetLightX - lightSmoothX) * 0.05;
    lightSmoothY += (targetLightY - lightSmoothY) * 0.05;
    lightSpot.x = lightSmoothX;
    lightSpot.y = lightSmoothY;

    tickSpores(w, h);
    layoutFog(w, h, t);

    heroLayer.y = heroBaseY + Math.sin(t * 0.85) * 7;
    const breathe = 1.035 + Math.sin(t * 1.1) * 0.015;
    heroSprite.scale.set(HERO_SCALE * breathe);

    orbitSlots.forEach((s, i) => {
      s.phase += 0.012;
      const hoverTarget = s.hovered ? 1 : 0;
      s.hoverT += (hoverTarget - s.hoverT) * 0.12;
      const driftX = Math.sin(s.phase + i * 0.7) * 5;
      const driftY = Math.cos(s.phase * 0.85) * 4;
      const nearX = s.baseX + (orbitCx - s.baseX) * 0.14;
      const nearY = s.baseY + (orbitCy - s.baseY) * 0.14;
      const targetX = (s.baseX + driftX) * (1 - s.hoverT) + nearX * s.hoverT;
      const targetY = (s.baseY + driftY) * (1 - s.hoverT) + nearY * s.hoverT;
      s.container.x += (targetX - s.container.x) * 0.2;
      s.container.y += (targetY - s.container.y) * 0.2;
    });

    btnGlow.alpha = 0.65 + Math.sin(t * 2.35) * 0.35;
  }

  return {
    root,
    layout: layoutScene,
    syncFromPlayer() {
      previewIndex = normalizeSpiritLook(getSelectedLook());
      updateHeroTexture();
      layoutScene();
    },
    startAnimations() {
      if (tickFn) app.ticker.remove(tickFn);
      tickFn = () => onTick();
      app.ticker.add(tickFn);
    },
    stopAnimations() {
      if (tickFn) {
        app.ticker.remove(tickFn);
        tickFn = null;
      }
      gsap.killTweensOf(auraGlow.scale);
      auraGlow.scale.set(1, 1);
    },
  };
}
