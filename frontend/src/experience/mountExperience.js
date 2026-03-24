import * as PIXI from "pixi.js";
import gsap from "gsap";
import {
  mountGame,
  createBackgroundTexture,
  createSpiritTexture,
  SPIRIT_LOOKS,
  normalizeSpiritLook,
} from "../Game.js";
import { createSpiritWardrobeScene } from "./spiritWardrobeScene.js";
import {
  loadPlayer,
  loadStats,
  saveGuestPlayer,
  saveSpiritLook,
  clearGuestSession,
  incrementBlooms,
  incrementWorldsAwakened,
  addTimePlayed,
  formatPlayTime,
  setGuestMode,
  setAccountMode,
  getStorageMode,
} from "../session/playerStore.js";
import { login, logout, subscribeAuth } from "../lib/auth.ts";
import { isSupabaseConfigured } from "../lib/supabaseClient.ts";
import { playSoftClick } from "../ui/softClick.js";

/** Softer, readable UI — Nunito reads friendlier than dense small Montserrat. */
const FONT_UI = "Nunito, Montserrat, system-ui, sans-serif";

const TEXT_STYLE_TITLE = {
  fill: 0xf4fff8,
  fontFamily: FONT_UI,
  fontSize: 46,
  fontWeight: "700",
  letterSpacing: 0.02,
  dropShadow: {
    alpha: 0.35,
    angle: Math.PI / 2,
    blur: 18,
    color: 0x7ab090,
    distance: 0,
  },
};

const TEXT_SOFT = {
  fill: 0xd8f0e4,
  fontFamily: FONT_UI,
  fontSize: 17,
  fontWeight: "500",
  lineHeight: 24,
};

/** Large primary CTA — bright, high-contrast (inspired by casual “battle” buttons). */
function makePrimaryBattleButton(label, w, h) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const t = new PIXI.Text({
    text: label,
    style: {
      fontFamily: FONT_UI,
      fontSize: 19,
      fontWeight: "700",
      fill: 0xffffff,
      dropShadow: { alpha: 0.25, angle: Math.PI / 2, blur: 6, color: 0x0a2818, distance: 1 },
    },
  });
  t.anchor.set(0.5);
  t.x = w * 0.5;
  t.y = h * 0.5;
  c.addChild(g);
  c.addChild(t);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new PIXI.Rectangle(0, 0, w, h);
  const draw = (hover) => {
    g.clear();
    const fill = hover ? 0x42d67a : 0x34b86a;
    const edge = hover ? 0xfff0d0 : 0xe8ffd8;
    g.roundRect(0, 0, w, h, 20).fill({ color: fill, alpha: 1 });
    g.roundRect(0, 0, w, h, 20).stroke({ width: 3, color: edge, alpha: hover ? 0.55 : 0.4 });
    g.roundRect(4, 4, w - 8, (h - 8) * 0.35, 14).fill({ color: 0xffffff, alpha: hover ? 0.14 : 0.1 });
  };
  draw(false);
  c.on("pointerover", () => {
    draw(true);
    gsap.to(c.scale, { x: 1.04, y: 1.04, duration: 0.22, ease: "power2.out" });
  });
  c.on("pointerout", () => {
    draw(false);
    gsap.to(c.scale, { x: 1, y: 1, duration: 0.22, ease: "power2.out" });
  });
  return { container: c, redraw: draw };
}

function makeRoundedButton(label, w, h) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const t = new PIXI.Text({ text: label, style: { ...TEXT_SOFT, fontSize: 16, fill: 0xecfff4 } });
  t.anchor.set(0.5);
  t.x = w * 0.5;
  t.y = h * 0.5;
  c.addChild(g);
  c.addChild(t);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new PIXI.Rectangle(0, 0, w, h);

  const draw = (hover) => {
    g.clear();
    const a = hover ? 0.42 : 0.28;
    g.roundRect(0, 0, w, h, 18).fill({ color: 0x2d544a, alpha: a });
    g.roundRect(0, 0, w, h, 18).stroke({ width: 1.5, color: 0xb5e8c8, alpha: hover ? 0.55 : 0.35 });
  };
  draw(false);
  c.on("pointerover", () => {
    draw(true);
    gsap.to(c.scale, { x: 1.03, y: 1.03, duration: 0.25, ease: "power2.out" });
  });
  c.on("pointerout", () => {
    draw(false);
    gsap.to(c.scale, { x: 1, y: 1, duration: 0.25, ease: "power2.out" });
  });
  return { container: c, redraw: draw };
}

/** Small square icon for corners (future: settings, events, etc.). */
function makeCornerChip(symbol) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const t = new PIXI.Text({
    text: symbol,
    style: { fontFamily: "Montserrat", fontSize: 18, fill: 0xe8fff0, fontWeight: "600" },
  });
  t.anchor.set(0.5);
  const s = 46;
  g.roundRect(0, 0, s, s, 12).fill({ color: 0x1a3d2c, alpha: 0.85 });
  g.roundRect(0, 0, s, s, 12).stroke({ width: 1, color: 0x9ed9b0, alpha: 0.35 });
  t.x = s * 0.5;
  t.y = s * 0.5;
  c.addChild(g);
  c.addChild(t);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new PIXI.Rectangle(0, 0, s, s);
  return c;
}

function fillWelcomePattern(g, w, h) {
  g.clear();
  const seed = 0x9e3779b9;
  let state = 12345 + Math.floor(w) * 17 + Math.floor(h) * 31;
  const rnd = () => {
    state = (state + seed) | 0;
    state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
    return state >>> 0;
  };
  for (let i = 0; i < 220; i += 1) {
    const x = (rnd() % 10000) / 10000;
    const y = (rnd() % 10000) / 10000;
    const r = 2 + (rnd() % 11);
    const a = 0.028 + (rnd() % 10) / 260;
    g.circle(x * w, y * h, r).fill({ color: 0xb8f5d0, alpha: a });
  }
}

function buildSideStrip() {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  for (let i = 0; i < 5; i += 1) {
    const y = i * 48;
    g.circle(18, y + 18, 16).fill({ color: 0x3a6b52, alpha: 0.38 });
    g.circle(18, y + 18, 16).stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
  }
  c.addChild(g);
  c.alpha = 0.88;
  return c;
}

/** Story-themed journeys (HUD + future rules hook on `id`). */
const GAME_MODES = [
  {
    id: "restoration",
    title: "Endless Restoration",
    desc: "Wander freely. Fill the world with life at your own pace.",
    foot: "∞  Open journey",
    accent: 0x3a7a9a,
    icon: "✧",
  },
  {
    id: "timed_bloom",
    title: "Timed Bloom",
    desc: "A focused session — a little more essence finds you along the way.",
    foot: "⏱  ~7 min",
    accent: 0x4a8eb8,
    icon: "🌿",
  },
  {
    id: "essence_hunt",
    title: "Essence Hunt",
    desc: "Seek rare spirits and wandering wonders across the map.",
    foot: "⏱  ~5 min",
    accent: 0xa09040,
    icon: "✦",
  },
  {
    id: "old_grove",
    title: "The Old Grove",
    desc: "Story path and seasonal tasks. Return when the path opens.",
    foot: "Soon",
    accent: 0x3a6b46,
    icon: "📜",
    disabled: true,
  },
];

/**
 * @param {(mode: typeof GAME_MODES[number]) => void} onPlay
 */
function makeModeCard(mode, onPlay) {
  const c = new PIXI.Container();
  const cw = 148;
  const ch = 228;
  const g = new PIXI.Graphics();
  const border = mode.disabled ? 0x5a7060 : mode.accent;
  g.roundRect(0, 0, cw, ch, 16).fill({ color: 0x0e1f16, alpha: 0.94 });
  g.roundRect(0, 0, cw, ch, 16).stroke({ width: 2, color: border, alpha: mode.disabled ? 0.28 : 0.5 });
  const icon = new PIXI.Text({
    text: mode.icon,
    style: { fontSize: 30, align: "center" },
  });
  icon.anchor.set(0.5);
  icon.x = cw * 0.5;
  icon.y = 28;
  const title = new PIXI.Text({
    text: mode.title,
    style: {
      fontFamily: "Montserrat",
      fontSize: 12,
      fontWeight: "700",
      fill: 0xffffff,
      align: "center",
      wordWrap: true,
      wordWrapWidth: cw - 14,
      lineHeight: 15,
    },
  });
  title.anchor.set(0.5, 0);
  title.x = cw * 0.5;
  title.y = 52;
  const desc = new PIXI.Text({
    text: mode.desc,
    style: {
      fontFamily: "Montserrat",
      fontSize: 9.5,
      fill: 0xc8e8d4,
      align: "center",
      wordWrap: true,
      wordWrapWidth: cw - 14,
      lineHeight: 13,
    },
  });
  desc.anchor.set(0.5, 0);
  desc.x = cw * 0.5;
  desc.y = 100;
  const foot = new PIXI.Text({
    text: mode.foot,
    style: { fontFamily: "Montserrat", fontSize: 10, fill: 0x9ec4ae },
  });
  foot.anchor.set(0.5);
  foot.x = cw * 0.5;
  foot.y = ch - 58;
  let playWrap;
  if (mode.disabled) {
    const pg = new PIXI.Graphics();
    pg.roundRect(8, ch - 44, cw - 16, 36, 12).fill({ color: 0x2a3a32, alpha: 0.9 });
    pg.roundRect(8, ch - 44, cw - 16, 36, 12).stroke({ width: 1, color: 0x6a8070, alpha: 0.35 });
    const pt = new PIXI.Text({
      text: "Soon",
      style: { fontFamily: "Montserrat", fontSize: 15, fontWeight: "700", fill: 0x8a9e92 },
    });
    pt.anchor.set(0.5);
    pt.x = cw * 0.5;
    pt.y = ch - 26;
    playWrap = new PIXI.Container();
    playWrap.addChild(pg);
    playWrap.addChild(pt);
    playWrap.eventMode = "none";
  } else {
    const btn = makePrimaryBattleButton("Play", cw - 16, 38);
    btn.container.x = 8;
    btn.container.y = ch - 44;
    btn.container.on("pointerdown", (e) => {
      e.stopPropagation();
      onPlay(mode);
    });
    playWrap = btn.container;
  }
  c.addChild(g);
  c.addChild(icon);
  c.addChild(title);
  c.addChild(desc);
  c.addChild(foot);
  c.addChild(playWrap);
  c.eventMode = "static";
  c.hitArea = new PIXI.Rectangle(0, 0, cw, ch);
  c.cursor = mode.disabled ? "default" : "pointer";
  return c;
}

/**
 * @param {HTMLElement} hostEl
 */
export async function mountExperience(hostEl) {
  const app = new PIXI.Application();
  await app.init({
    resizeTo: hostEl,
    background: "#19382a",
    antialias: true,
    autoDensity: true,
  });
  app.ticker.maxFPS = 30;
  hostEl.appendChild(app.canvas);

  const gameRoot = new PIXI.Container();
  const welcomeRoot = new PIXI.Container();
  const wardrobeRoot = new PIXI.Container();
  const modeSelectRoot = new PIXI.Container();
  const profileRoot = new PIXI.Container();

  app.stage.addChild(gameRoot);
  app.stage.addChild(welcomeRoot);
  app.stage.addChild(wardrobeRoot);
  app.stage.addChild(modeSelectRoot);
  app.stage.addChild(profileRoot);

  let active = "welcome";

  const makeGuestName = () => `Guest-${1000 + Math.floor(Math.random() * 9000)}`;
  const isGenericGuestName = (name) => /^(guest|guest[-_ ]?\d*)$/i.test((name || "").trim());
  const ensureGuestIdentity = () => {
    const current = loadPlayer();
    if (current?.name && !isGenericGuestName(current.name)) return current;
    const spiritLook = normalizeSpiritLook(current?.spiritLook ?? 0);
    const generated = { name: makeGuestName(), isGuest: true, spiritLook };
    saveGuestPlayer(generated);
    return generated;
  };
  const initialGuest = ensureGuestIdentity();

  let selectedSpiritLook = normalizeSpiritLook(initialGuest?.spiritLook);

  const gameApi = await mountGame(hostEl, {
    app,
    gameParent: gameRoot,
    flowPlayerName: initialGuest?.name ?? "Guest",
    spiritLookId: selectedSpiritLook,
    onFlowProfile: () => {
      playSoftClick();
      showScreen("profile");
    },
    onFlowLogout: () => {
      void onLogoutClick();
    },
    onFlowFeedback: () => {
      playSoftClick();
      const url = import.meta.env.VITE_FEEDBACK_URL;
      if (typeof url === "string" && url.length > 0) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      window.open(`mailto:?subject=${encodeURIComponent("Bloom game feedback")}`, "_blank");
    },
    onBloom: () => {
      void incrementBlooms(1);
    },
    onWorldAwaken: () => {
      void incrementWorldsAwakened();
    },
    onSessionTime: (ms) => {
      void addTimePlayed(ms);
    },
  });

  gameApi.setPaused(true);
  gameRoot.alpha = 0;
  gameRoot.visible = false;

  /** Set after welcome profile card is built (updates avatar + look label). */
  let refreshWelcomeProfile = () => {};
  /** Wardrobe no longer uses a grid; keep hook for session sync (no-op). */
  let refreshWardrobeSelection = () => {};

  function applySpiritLook(i) {
    const id = normalizeSpiritLook(i);
    selectedSpiritLook = id;
    gameApi.setSpiritLook(id);
    refreshWelcomeProfile();
    refreshWardrobeSelection();
    void saveSpiritLook(id);
  }

  function resetToWelcome() {
    hideModeSelectInstant();
    setGuestMode();
    clearGuestSession();
    const guest = ensureGuestIdentity();
    selectedSpiritLook = normalizeSpiritLook(guest?.spiritLook ?? 0);
    gameApi.setSpiritLook(0);
    refreshWelcomeProfile();
    refreshWardrobeSelection();
    gameApi.setPlayerLabel(guest?.name ?? "Guest");
    gameApi.setPaused(true);
    gameRoot.alpha = 0;
    gameRoot.visible = false;
    showScreen("welcome");
  }

  async function onLogoutClick() {
    playSoftClick();
    if (getStorageMode() === "account") {
      await logout();
      return;
    }
    resetToWelcome();
  }

  // —— Welcome ——
  const wBgTex = createBackgroundTexture(app.screen.width * 1.5, app.screen.height * 1.5);
  const wBg = new PIXI.Sprite(wBgTex);
  wBg.anchor.set(0.5);
  const wPattern = new PIXI.Graphics();
  const wDim = new PIXI.Graphics();
  const welcomeSpiritOrb = new PIXI.Graphics();
  const welcomeSpiritCore = new PIXI.Graphics();
  const welcomeCenterLight = new PIXI.Graphics();
  const welcomeFogA = new PIXI.Graphics();
  const welcomeFogB = new PIXI.Graphics();
  const welcomeSpores = new PIXI.Graphics();
  /** Soft blobs at the bottom so the screen feels less empty / harsh. */
  const welcomeFooterSoft = new PIXI.Graphics();
  const title = new PIXI.Text({
    text: "Bloom Spirits",
    style: {
      ...TEXT_STYLE_TITLE,
      fontSize: 56,
      fontWeight: "700",
      letterSpacing: 0.045,
      dropShadow: { alpha: 0.26, angle: Math.PI / 2, blur: 16, color: 0xa6f3c8, distance: 0 },
    },
  });
  title.anchor.set(0.5);
  const wSubtitle = new PIXI.Text({
    text: "A gentle spirit grows brighter when it moves... but life truly blooms together.",
    style: {
      ...TEXT_SOFT,
      fontSize: 18,
      fill: 0xd0ebe0,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 560,
      lineHeight: 40,
    },
  });
  wSubtitle.anchor.set(0.5);
  wSubtitle.alpha = 0.78;
  const wSupportLine = new PIXI.Text({
    text: "Explore, leave gifts, meet friends, and watch your garden grow - each step matters.",
    style: {
      ...TEXT_SOFT,
      fontSize: 14,
      fill: 0xc7e4d7,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 620,
      lineHeight: 24,
    },
  });
  wSupportLine.anchor.set(0.5);
  wSupportLine.alpha = 0.68;
  const welcomeMoveHint = new PIXI.Text({
    text: "Where you move, life begins",
    style: {
      fontFamily: FONT_UI,
      fontSize: 14,
      fontWeight: "500",
      fill: 0xc8e4d8,
      letterSpacing: 0.01,
      align: "center",
    },
  });
  welcomeMoveHint.anchor.set(0.5);
  welcomeMoveHint.alpha = 0.62;

  const btnSpiritWardrobe = new PIXI.Container();
  const btnSpiritWardrobeBg = new PIXI.Graphics();
  const btnSpiritWardrobeText = new PIXI.Text({
    text: "Change your look",
    style: { fontFamily: FONT_UI, fontSize: 16, fontWeight: "600", fill: 0xd9efe3 },
  });
  btnSpiritWardrobeText.anchor.set(0.5);
  btnSpiritWardrobeBg.roundRect(0, 0, 220, 38, 19).fill({ color: 0xffffff, alpha: 0.08 });
  btnSpiritWardrobe.addChild(btnSpiritWardrobeBg);
  btnSpiritWardrobe.addChild(btnSpiritWardrobeText);
  btnSpiritWardrobeText.x = 110;
  btnSpiritWardrobeText.y = 19;
  btnSpiritWardrobe.eventMode = "static";
  btnSpiritWardrobe.cursor = "pointer";
  btnSpiritWardrobe.hitArea = new PIXI.Rectangle(0, 0, 220, 38);
  btnSpiritWardrobe.on("pointerover", () => {
    btnSpiritWardrobeBg.clear();
    btnSpiritWardrobeBg.roundRect(0, 0, 220, 38, 19).fill({ color: 0xffffff, alpha: 0.14 });
    gsap.to(btnSpiritWardrobe.scale, { x: 1.02, y: 1.02, duration: 0.2, ease: "power2.out" });
  });
  btnSpiritWardrobe.on("pointerout", () => {
    btnSpiritWardrobeBg.clear();
    btnSpiritWardrobeBg.roundRect(0, 0, 220, 38, 19).fill({ color: 0xffffff, alpha: 0.08 });
    gsap.to(btnSpiritWardrobe.scale, { x: 1, y: 1, duration: 0.2, ease: "power2.out" });
  });
  btnSpiritWardrobe.on("pointerdown", () => {
    playSoftClick();
    showScreen("wardrobe");
  });

  const profileCard = new PIXI.Container();
  const profileCardBg = new PIXI.Graphics();
  const welcomeAvatar = new PIXI.Sprite(createSpiritTexture(selectedSpiritLook));
  welcomeAvatar.anchor.set(0.5);
  welcomeAvatar.scale.set(0.62);
  const profileCardHint = new PIXI.Text({
    text: "Your spirit",
    style: { fontFamily: FONT_UI, fontSize: 11, fill: 0xa8d4c4, fontWeight: "600", letterSpacing: 0.04 },
  });
  const profileCardLook = new PIXI.Text({
    text: SPIRIT_LOOKS[normalizeSpiritLook(selectedSpiritLook)]?.label ?? "Plain Seed",
    style: { fontFamily: FONT_UI, fontSize: 17, fill: 0xf4fff8, fontWeight: "700" },
  });
  refreshWelcomeProfile = () => {
    const idx = normalizeSpiritLook(selectedSpiritLook);
    welcomeAvatar.texture = createSpiritTexture(idx);
    profileCardLook.text = SPIRIT_LOOKS[idx]?.label ?? "Plain Seed";
  };
  profileCard.addChild(profileCardBg);
  profileCard.addChild(welcomeAvatar);
  profileCard.addChild(profileCardHint);
  profileCard.addChild(profileCardLook);

  const btnEnter = makePrimaryBattleButton("Enter the world", 316, 66);
  const btnEnterWrap = new PIXI.Container();
  const btnEnterGlow = new PIXI.Graphics();
  btnEnterGlow.ellipse(158, 35, 190, 38).fill({ color: 0xacf6ce, alpha: 0.2 });
  btnEnterWrap.addChild(btnEnterGlow);
  btnEnterWrap.addChild(btnEnter.container);
  let welcomeCtaHover = 0;
  let welcomeCtaHoverTarget = 0;
  btnEnter.container.on("pointerover", () => {
    welcomeCtaHoverTarget = 1;
    gsap.to(btnEnter.container.scale, { x: 1.03, y: 1.03, duration: 0.22, ease: "power2.out" });
  });
  btnEnter.container.on("pointerout", () => {
    welcomeCtaHoverTarget = 0;
    gsap.to(btnEnter.container.scale, { x: 1, y: 1, duration: 0.22, ease: "power2.out" });
  });
  const btnLogin = makeRoundedButton("Continue with email", 260, 44);
  const welcomeHintSeen = window.localStorage?.getItem("bloom_welcome_hint_seen") === "1";
  let showWelcomeMoveHint = !welcomeHintSeen;
  if (!showWelcomeMoveHint) welcomeMoveHint.visible = false;

  const welcomeSporesState = [];
  function initWelcomeSpores(w, h) {
    welcomeSporesState.length = 0;
    for (let i = 0; i < 66; i += 1) {
      welcomeSporesState.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1.1 + Math.random() * 2.5,
        a: 0.05 + Math.random() * 0.12,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.12,
      });
    }
  }
  function tickWelcomeAtmosphere() {
    if (active !== "welcome" || !welcomeRoot.visible) return;
    const w = app.screen.width;
    const h = app.screen.height;
    const t = performance.now() * 0.001;
    welcomeCtaHover += (welcomeCtaHoverTarget - welcomeCtaHover) * 0.08;
    const pulse = 1 + Math.sin(t * 2) * 0.02;
    btnEnterWrap.scale.set(1.02 * pulse);
    btnEnterGlow.alpha = 0.16 + welcomeCtaHover * 0.16 + Math.sin(t * 1.8) * 0.03;
    welcomeSpiritOrb.clear();
    welcomeSpiritCore.clear();
    const orbX = w * 0.5;
    const orbY = h * 0.45 + Math.sin(t * 0.7) * 8;
    const orbPulse = 1 + Math.sin(t * 1.15) * 0.05;
    welcomeSpiritOrb.circle(orbX, orbY, Math.min(w, h) * 0.13 * orbPulse).fill({ color: 0xcfffe2, alpha: 0.1 + welcomeCtaHover * 0.03 });
    welcomeSpiritOrb.circle(orbX, orbY, Math.min(w, h) * 0.08 * orbPulse).fill({ color: 0xe8fff2, alpha: 0.16 + welcomeCtaHover * 0.04 });
    welcomeSpiritCore.circle(orbX, orbY, Math.min(w, h) * 0.026 * orbPulse).fill({ color: 0xf7fff8, alpha: 0.72 });
    welcomeCenterLight.clear();
    welcomeCenterLight.circle(w * 0.5, h * 0.41, Math.min(w, h) * 0.28).fill({ color: 0xc8ffd8, alpha: 0.09 + welcomeCtaHover * 0.05 });
    welcomeFogA.clear();
    welcomeFogB.clear();
    welcomeFogA.ellipse(w * 0.5 + Math.sin(t * 0.08) * 24, h * 0.36, w * 0.38, h * 0.2).fill({ color: 0x9ccfb0, alpha: 0.06 });
    welcomeFogB.ellipse(w * 0.54 + Math.cos(t * 0.06) * 30, h * 0.56, w * 0.3, h * 0.18).fill({ color: 0x78aa8e, alpha: 0.05 });
    welcomeSpores.clear();
    const cx = w * 0.5;
    const cy = h * 0.56;
    for (let i = 0; i < welcomeSporesState.length; i += 1) {
      const s = welcomeSporesState[i];
      s.x += s.vx + (cx - s.x) * (0.0008 + welcomeCtaHover * 0.0014);
      s.y += s.vy + (cy - s.y) * (0.0007 + welcomeCtaHover * 0.0012);
      if (s.x < 0) s.x += w;
      if (s.x > w) s.x -= w;
      if (s.y < 0) s.y += h;
      if (s.y > h) s.y -= h;
      welcomeSpores.circle(s.x, s.y, s.r).fill({ color: 0xd6ffe6, alpha: s.a });
    }
  }
  app.ticker.add(tickWelcomeAtmosphere);

  welcomeRoot.addChild(wBg);
  welcomeRoot.addChild(wPattern);
  welcomeRoot.addChild(welcomeSpiritOrb);
  welcomeRoot.addChild(welcomeSpiritCore);
  welcomeRoot.addChild(welcomeCenterLight);
  welcomeRoot.addChild(welcomeFogA);
  welcomeRoot.addChild(welcomeFogB);
  welcomeRoot.addChild(welcomeSpores);
  welcomeRoot.addChild(wDim);
  welcomeRoot.addChild(welcomeFooterSoft);
  welcomeRoot.addChild(title);
  welcomeRoot.addChild(wSubtitle);
  welcomeRoot.addChild(wSupportLine);
  welcomeRoot.addChild(btnSpiritWardrobe);
  welcomeRoot.addChild(btnEnterWrap);
  welcomeRoot.addChild(welcomeMoveHint);
  welcomeRoot.addChild(btnLogin.container);

  if (!isSupabaseConfigured) {
    btnLogin.container.visible = false;
  }

  refreshWelcomeProfile();

  // —— Journey mode picker (after “Enter the world” / sign-in) ——
  const msBackdrop = new PIXI.Graphics();
  msBackdrop.eventMode = "static";
  msBackdrop.cursor = "pointer";
  const msTitle = new PIXI.Text({
    text: "Choose your journey",
    style: { ...TEXT_STYLE_TITLE, fontSize: 30, align: "center" },
  });
  msTitle.anchor.set(0.5);
  const msSubtitle = new PIXI.Text({
    text: "Pick a mood for this visit — you can always come back.",
    style: { ...TEXT_SOFT, fontSize: 15, fill: 0xc4e6d8, align: "center", wordWrap: true, wordWrapWidth: 440 },
  });
  msSubtitle.anchor.set(0.5);
  const msClose = new PIXI.Container();
  const msCloseG = new PIXI.Graphics();
  msCloseG.circle(0, 0, 18).fill({ color: 0x8a3038, alpha: 0.95 });
  msCloseG.circle(0, 0, 18).stroke({ width: 1.5, color: 0xffc8c8, alpha: 0.35 });
  const msCloseX = new PIXI.Text({
    text: "✕",
    style: { fontFamily: "Montserrat", fontSize: 16, fill: 0xfff0f0, fontWeight: "700" },
  });
  msCloseX.anchor.set(0.5);
  msClose.addChild(msCloseG);
  msClose.addChild(msCloseX);
  msClose.eventMode = "static";
  msClose.cursor = "pointer";
  msClose.hitArea = new PIXI.Circle(0, 0, 22);

  const msCardsRow = new PIXI.Container();
  GAME_MODES.forEach((mode) => {
    const card = makeModeCard(mode, (m) => {
      playSoftClick();
      gameApi.setGameMode(m.id, m.title);
      modeSelectRoot.visible = false;
      modeSelectRoot.alpha = 0;
      enterGame();
    });
    msCardsRow.addChild(card);
  });

  modeSelectRoot.addChild(msBackdrop);
  modeSelectRoot.addChild(msTitle);
  modeSelectRoot.addChild(msSubtitle);
  modeSelectRoot.addChild(msCardsRow);
  modeSelectRoot.addChild(msClose);
  modeSelectRoot.visible = false;
  modeSelectRoot.alpha = 0;
  modeSelectRoot.sortableChildren = true;
  msTitle.zIndex = 2;
  msSubtitle.zIndex = 2;
  msCardsRow.zIndex = 2;
  msClose.zIndex = 3;
  msBackdrop.zIndex = 0;

  function layoutModeSelect() {
    const w = app.screen.width;
    const h = app.screen.height;
    msBackdrop.clear();
    msBackdrop.rect(0, 0, w, h).fill({ color: 0x061208, alpha: 0.78 });
    msTitle.x = w * 0.5;
    msTitle.y = 52;
    msSubtitle.x = w * 0.5;
    msSubtitle.y = 92;
    msSubtitle.style.wordWrapWidth = Math.min(420, w - 40);
    msClose.x = w - 28;
    msClose.y = 28;
    const pad = 14;
    const gap = 10;
    const n = GAME_MODES.length;
    const maxRowW = w - pad * 2;
    const grid = w < 520;
    const cardBaseW = 148;
    const cardBaseH = 228;
    if (grid) {
      const cols = 2;
      const innerW = maxRowW - gap;
      const scale = Math.min(1, innerW / (cols * cardBaseW + gap));
      const cardW = cardBaseW * scale;
      const rowW = cols * cardW + gap;
      const rowH = cardBaseH * scale + gap;
      const row1X = (w - rowW) * 0.5;
      const y0 = Math.min(120, h * 0.16);
      for (let i = 0; i < n; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const card = /** @type {PIXI.Container} */ (msCardsRow.children[i]);
        card.scale.set(scale);
        card.x = row1X + col * (cardW + gap);
        card.y = y0 + row * rowH;
      }
    } else {
      const totalW = n * cardBaseW + (n - 1) * gap;
      const scale = Math.min(1, maxRowW / totalW);
      const rowW = n * cardBaseW * scale + (n - 1) * gap;
      const startX = (w - rowW) * 0.5;
      const y0 = Math.min(140, h * 0.22);
      for (let i = 0; i < n; i += 1) {
        const card = /** @type {PIXI.Container} */ (msCardsRow.children[i]);
        card.scale.set(scale);
        card.x = startX + i * (cardBaseW * scale + gap);
        card.y = y0;
      }
    }
  }

  function openModeSelect() {
    layoutModeSelect();
    modeSelectRoot.visible = true;
    gsap.to(modeSelectRoot, { alpha: 1, duration: 0.38, ease: "power2.out" });
  }

  function hideModeSelectInstant() {
    modeSelectRoot.visible = false;
    modeSelectRoot.alpha = 0;
  }

  function dismissModeSelect() {
    playSoftClick();
    if (getStorageMode() === "account") {
      gameApi.setGameMode("restoration", "Endless Restoration");
      hideModeSelectInstant();
      enterGame();
      return;
    }
    gsap.to(modeSelectRoot, {
      alpha: 0,
      duration: 0.35,
      ease: "power2.inOut",
      onComplete: () => {
        hideModeSelectInstant();
      },
    });
  }

  msBackdrop.on("pointerdown", () => dismissModeSelect());
  msClose.on("pointerdown", (e) => {
    e.stopPropagation();
    dismissModeSelect();
  });

  // —— Profile ——
  const pBgTex = createBackgroundTexture(app.screen.width * 1.5, app.screen.height * 1.5);
  const pBg = new PIXI.Sprite(pBgTex);
  pBg.anchor.set(0.5);
  const pFrame = new PIXI.Graphics();
  const pDim = new PIXI.Graphics();
  const pName = new PIXI.Text({ text: "", style: { ...TEXT_STYLE_TITLE, fontSize: 32 } });
  pName.anchor.set(0.5);
  const pStats = new PIXI.Text({
    text: "",
    style: { ...TEXT_SOFT, fontSize: 14, align: "center", lineHeight: 24 },
  });
  pStats.anchor.set(0.5);
  const pSpiritHint = new PIXI.Text({
    text: "Your form",
    style: { ...TEXT_SOFT, fontSize: 12, letterSpacing: 0.05 },
  });
  pSpiritHint.anchor.set(0.5);
  const btnBack = makeRoundedButton("Back to Game", 200, 44);
  const btnLogoutP = makeRoundedButton("Leave the world", 200, 44);

  profileRoot.addChild(pBg);
  profileRoot.addChild(pFrame);
  profileRoot.addChild(pDim);
  profileRoot.addChild(pName);
  profileRoot.addChild(pStats);
  profileRoot.addChild(pSpiritHint);
  profileRoot.addChild(btnBack.container);
  profileRoot.addChild(btnLogoutP.container);
  profileRoot.visible = false;
  profileRoot.alpha = 0;

  const btnWardrobeFromProfile = makeRoundedButton("Change your look", 260, 46);
  btnWardrobeFromProfile.container.on("pointerdown", () => {
    playSoftClick();
    showScreen("wardrobe");
  });
  profileRoot.addChild(btnWardrobeFromProfile.container);

  // —— Spirit wardrobe (immersive) ——
  const wrDim = new PIXI.Graphics();
  /** @type {ReturnType<typeof createSpiritWardrobeScene> | null} */
  let wardScene = null;

  function layoutWardrobe() {
    const w = app.screen.width;
    const h = app.screen.height;
    wrDim.clear();
    wrDim.rect(0, 0, w, h).fill({ color: 0x040a08, alpha: 0.32 });
    wardScene?.layout();
  }

  wardrobeRoot.addChild(wrDim);
  wardrobeRoot.visible = false;
  wardrobeRoot.alpha = 0;

  wardScene = createSpiritWardrobeScene(app, {
    fontUi: FONT_UI,
    playSoftClick,
    getSelectedLook: () => selectedSpiritLook,
    applySpiritLook,
    goWelcome: () => {
      wardScene?.stopAnimations();
      showScreen("welcome");
    },
  });
  wardrobeRoot.addChild(wardScene.root);

  function layoutFlowScreens() {
    const w = app.screen.width;
    const h = app.screen.height;
    wBg.x = w * 0.5;
    wBg.y = h * 0.5;
    wBg.width = w * 1.5;
    wBg.height = h * 1.5;
    fillWelcomePattern(wPattern, w, h);
    wPattern.alpha = 0.22;
    wDim.clear();
    wDim.rect(0, 0, w, h).fill({ color: 0x0c1812, alpha: 0.16 });
    welcomeFooterSoft.clear();
    for (let i = 0; i < 14; i += 1) {
      const t = (i / 14) * Math.PI * 2;
      const fx = w * 0.5 + Math.cos(t) * (w * 0.42) + Math.sin(t * 2) * 18;
      const fy = h - 55 + Math.sin(t * 1.5) * 22;
      const rx = 48 + (i % 4) * 12;
      const ry = 20 + (i % 3) * 6;
      welcomeFooterSoft
        .ellipse(fx, fy, rx, ry)
        .fill({ color: 0xa8f0c8, alpha: 0.045 + (i % 5) * 0.012 });
    }
    welcomeFooterSoft.alpha = 0.95;
    const edgePad = 16;
    const cardW = Math.min(200, Math.max(148, w * 0.44));
    const cardH = 86;
    profileCardBg.clear();
    profileCardBg.roundRect(0, 0, cardW, cardH, 20).fill({ color: 0x122a20, alpha: 0.58 });
    profileCardBg.roundRect(0, 0, cardW, cardH, 20).stroke({ width: 1.5, color: 0xb0e4c8, alpha: 0.35 });
    welcomeAvatar.x = Math.min(46, cardW * 0.28);
    welcomeAvatar.y = cardH * 0.5;
    profileCardHint.x = Math.min(88, cardW * 0.52);
    profileCardHint.y = 16;
    profileCardLook.x = profileCardHint.x;
    profileCardLook.y = 38;
    const profileTop = edgePad + 4;
    profileCard.x = edgePad;
    profileCard.y = profileTop;
    const titleCenterY = Math.max(84, h * 0.18);
    title.x = w * 0.5;
    title.y = titleCenterY;
    const titleScale = w < 420 ? 0.74 : w < 520 ? 0.84 : w < 700 ? 0.92 : 1;
    title.scale.set(titleScale);
    wSubtitle.x = w * 0.5;
    wSubtitle.style.wordWrapWidth = Math.min(560, w - 36);
    const titleBottom = title.y + title.height * 0.5;
    const subtitleGap = 30;
    wSubtitle.y = titleBottom + subtitleGap + wSubtitle.height * 0.5;
    wSupportLine.x = w * 0.5;
    wSupportLine.style.wordWrapWidth = Math.min(620, w - 52);
    const subtitleBottom = wSubtitle.y + wSubtitle.height * 0.5;
    const supportGap = 16;
    wSupportLine.y = subtitleBottom + supportGap + wSupportLine.height * 0.5;
    btnSpiritWardrobe.x = w * 0.5 - 110;
    btnSpiritWardrobe.y = Math.min(wSupportLine.y + wSupportLine.height * 0.5 + 24, h - 224);
    const ctaY = Math.min(btnSpiritWardrobe.y + 52, h - 156);
    btnEnterWrap.x = w * 0.5 - 158;
    btnEnterWrap.y = ctaY;
    welcomeMoveHint.x = w * 0.5;
    welcomeMoveHint.y = ctaY + 90;
    welcomeMoveHint.visible = showWelcomeMoveHint;
    btnLogin.container.x = w * 0.5 - 130;
    btnLogin.container.y = Math.min(h - 50, welcomeMoveHint.y + 28);
    initWelcomeSpores(w, h);

    pBg.x = w * 0.5;
    pBg.y = h * 0.5;
    pBg.width = w * 1.5;
    pBg.height = h * 1.5;
    pDim.clear();
    pDim.rect(0, 0, w, h).fill({ color: 0x0a1a12, alpha: 0.32 });
    pFrame.clear();
    const pm = 20;
    pFrame.roundRect(pm, pm, w - pm * 2, h - pm * 2, 22).stroke({ width: 1.2, color: 0xc8f0d8, alpha: 0.28 });
    pName.x = w * 0.5;
    pName.y = h * 0.22;
    pStats.x = w * 0.5;
    pStats.y = h * 0.34;
    pSpiritHint.x = w * 0.5;
    pSpiritHint.y = h * 0.46;
    btnWardrobeFromProfile.container.x = w * 0.5 - 130;
    btnWardrobeFromProfile.container.y = h * 0.52;
    btnBack.container.x = w * 0.5 - 100;
    btnBack.container.y = h * 0.62;
    btnLogoutP.container.x = w * 0.5 - 100;
    btnLogoutP.container.y = h * 0.62 + 54;
    layoutWardrobe();
  }

  function refreshProfileText() {
    const pl = loadPlayer();
    const st = loadStats();
    pName.text = pl?.name ?? "Guest";
    const lookIdx = normalizeSpiritLook(pl?.spiritLook);
    const lookName = SPIRIT_LOOKS[lookIdx]?.label ?? "Plain Seed";
    pStats.text = `Form: ${lookName}\nWorlds Restored: ${st.worldsAwakened}\nTotal Blooms: ${st.totalBlooms}\nTime Played: ${formatPlayTime(st.timePlayedMs)}`;
  }

  function showScreen(name) {
    const dur = 0.5;
    const ease = "power2.inOut";
    active = name;

    if (name === "welcome") {
      wardScene?.stopAnimations();
      hideModeSelectInstant();
      refreshWelcomeProfile();
      refreshWardrobeSelection();
      wardrobeRoot.visible = false;
      wardrobeRoot.alpha = 0;
      welcomeRoot.visible = true;
      gsap.to(welcomeRoot, { alpha: 1, duration: dur, ease });
      gsap.to(profileRoot, { alpha: 0, duration: dur * 0.55, ease, onComplete: () => { profileRoot.visible = false; } });
      gsap.to(gameRoot, {
        alpha: 0,
        duration: dur * 0.65,
        ease,
        onComplete: () => {
          gameRoot.visible = false;
        },
      });
      gameApi.setPaused(true);
    } else if (name === "wardrobe") {
      hideModeSelectInstant();
      refreshWardrobeSelection();
      wardScene?.syncFromPlayer();
      layoutWardrobe();
      wardScene?.startAnimations();
      wardrobeRoot.visible = true;
      gsap.to(wardrobeRoot, { alpha: 1, duration: dur, ease });
      welcomeRoot.visible = true;
      gsap.to(welcomeRoot, { alpha: 0, duration: dur * 0.55, ease, onComplete: () => { welcomeRoot.visible = false; } });
      gsap.to(profileRoot, { alpha: 0, duration: dur * 0.55, ease, onComplete: () => { profileRoot.visible = false; } });
      gameApi.setPaused(true);
    } else if (name === "game") {
      hideModeSelectInstant();
      wardScene?.stopAnimations();
      wardrobeRoot.visible = false;
      wardrobeRoot.alpha = 0;
      welcomeRoot.visible = true;
      gsap.to(welcomeRoot, { alpha: 0, duration: dur, ease, onComplete: () => { welcomeRoot.visible = false; } });
      gsap.to(profileRoot, { alpha: 0, duration: dur * 0.55, ease, onComplete: () => { profileRoot.visible = false; } });
      gameRoot.visible = true;
      gsap.to(gameRoot, { alpha: 1, duration: dur, ease });
      gameApi.setPaused(false);
    } else if (name === "profile") {
      wardScene?.stopAnimations();
      wardrobeRoot.visible = false;
      wardrobeRoot.alpha = 0;
      selectedSpiritLook = normalizeSpiritLook(loadPlayer()?.spiritLook);
      gameApi.setSpiritLook(selectedSpiritLook);
      refreshProfileText();
      profileRoot.visible = true;
      gsap.to(profileRoot, { alpha: 1, duration: dur, ease });
      gameApi.setPaused(true);
    }
  }

  function enterGame() {
    showScreen("game");
  }

  btnEnter.container.on("pointerdown", () => {
    playSoftClick();
    showWelcomeMoveHint = false;
    welcomeMoveHint.visible = false;
    try {
      window.localStorage?.setItem("bloom_welcome_hint_seen", "1");
    } catch {}
    setGuestMode();
    const guest = ensureGuestIdentity();
    saveGuestPlayer({ name: guest.name, isGuest: true, spiritLook: selectedSpiritLook });
    gameApi.setPlayerLabel(guest.name);
    gameApi.setSpiritLook(selectedSpiritLook);
    openModeSelect();
  });
  btnLogin.container.on("pointerdown", () => {
    playSoftClick();
    openLoginModal();
  });

  btnBack.container.on("pointerdown", () => {
    playSoftClick();
    showScreen("game");
  });
  btnLogoutP.container.on("pointerdown", () => {
    void onLogoutClick();
  });

  const modal = document.createElement("div");
  modal.className = "bloom-login-modal";
  modal.innerHTML = `
    <div class="bloom-login-inner">
      <label for="bloom-email">Where should we open the door?</label>
      <input id="bloom-email" type="email" maxlength="320" placeholder="you@example.com" autocomplete="email" />
      <p class="bloom-login-hint" hidden></p>
      <div class="bloom-login-actions">
        <button type="button" class="bloom-btn bloom-enter">Send the way</button>
        <button type="button" class="bloom-btn bloom-cancel">Not now</button>
      </div>
    </div>
  `;
  hostEl.appendChild(modal);
  const emailEl = modal.querySelector("#bloom-email");
  const hintEl = modal.querySelector(".bloom-login-hint");

  const submitEmail = async () => {
    playSoftClick();
    const email = (emailEl.value || "").trim();
    if (!email) {
      emailEl.focus();
      return;
    }
    hintEl.hidden = true;
    const { error } = await login(email);
    if (error) {
      hintEl.textContent = "That didn't work. Try again in a moment.";
      hintEl.hidden = false;
      return;
    }
    hintEl.textContent = "There's a path in your inbox. Follow it when you're ready.";
    hintEl.hidden = false;
  };

  modal.querySelector(".bloom-enter").addEventListener("click", () => {
    void submitEmail();
  });
  emailEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void submitEmail();
  });
  modal.querySelector(".bloom-cancel").addEventListener("click", () => {
    playSoftClick();
    modal.classList.remove("visible");
    hintEl.hidden = true;
  });

  function openLoginModal() {
    modal.classList.add("visible");
    emailEl.value = "";
    hintEl.hidden = true;
    setTimeout(() => emailEl.focus(), 80);
  }

  welcomeRoot.alpha = 0;

  const unsubAuth = subscribeAuth(async (event, session) => {
    if (event === "INITIAL_SESSION") {
      if (session?.user) {
        try {
          await setAccountMode(session.user);
          selectedSpiritLook = normalizeSpiritLook(loadPlayer()?.spiritLook);
          gameApi.setSpiritLook(selectedSpiritLook);
          refreshWardrobeSelection();
          gameApi.setPlayerLabel(loadPlayer()?.name ?? "Spirit");
          welcomeRoot.visible = false;
          welcomeRoot.alpha = 0;
          layoutFlowScreens();
          openModeSelect();
        } catch (e) {
          console.error("[Bloom Spirits] Session load failed", e);
          welcomeRoot.alpha = 1;
          layoutFlowScreens();
          showScreen("welcome");
        }
      } else {
        welcomeRoot.alpha = 1;
        layoutFlowScreens();
        showScreen("welcome");
      }
      return;
    }
    if (event === "SIGNED_IN" && session?.user) {
      try {
        await setAccountMode(session.user);
        selectedSpiritLook = normalizeSpiritLook(loadPlayer()?.spiritLook);
        gameApi.setSpiritLook(selectedSpiritLook);
        refreshWardrobeSelection();
        gameApi.setPlayerLabel(loadPlayer()?.name ?? "Spirit");
        modal.classList.remove("visible");
        openModeSelect();
      } catch (e) {
        console.error("[Bloom Spirits] Sign-in failed", e);
      }
    }
    if (event === "SIGNED_OUT") {
      resetToWelcome();
    }
  });

  if (!isSupabaseConfigured) {
    welcomeRoot.alpha = 1;
    layoutFlowScreens();
    showScreen("welcome");
  }

  function onEscapeWardrobe(e) {
    if (e.key !== "Escape" || active !== "wardrobe") return;
    e.preventDefault();
    playSoftClick();
    showScreen("welcome");
  }
  window.addEventListener("keydown", onEscapeWardrobe);

  layoutFlowScreens();
  app.renderer.on("resize", layoutFlowScreens);

  const cleanup = () => {
    app.ticker.remove(tickWelcomeAtmosphere);
    window.removeEventListener("keydown", onEscapeWardrobe);
    unsubAuth();
    app.renderer.off("resize", layoutFlowScreens);
    gameApi.cleanup();
    modal.remove();
    app.destroy(true, { children: true, texture: true });
  };

  return { cleanup, showScreen, getActiveScreen: () => active };
}
