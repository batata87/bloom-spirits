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
import { StoreUI } from "./storeUI.js";
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
import { ensureAndLoadProfile, loadProfile, purchaseWithCreatures } from "../lib/profileService.ts";
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
  // Magical-garden texture: soft canopy haze + petal motes + faint vine arcs.
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 97) % w;
    const y = ((i * 173) % h) * 0.96;
    const rx = 28 + (i % 7) * 8;
    const ry = 18 + (i % 5) * 7;
    const col = i % 3 === 0 ? 0xa5deb8 : i % 3 === 1 ? 0xbbe7c7 : 0x96d2ac;
    g.ellipse(x, y, rx, ry).fill({ color: col, alpha: 0.02 + (i % 4) * 0.005 });
  }
  for (let i = 0; i < 300; i += 1) {
    const x = (i * 53.7) % w;
    const y = (i * 89.3) % h;
    const r = 1 + (i % 3) * 0.9;
    const col = i % 4 === 0 ? 0xf0ffd8 : i % 4 === 1 ? 0xfff2d8 : 0xd9ffd8;
    g.circle(x, y, r).fill({ color: col, alpha: 0.02 + (i % 5) * 0.008 });
  }
  for (let i = 0; i < 12; i += 1) {
    const y = h * (0.14 + (i / 12) * 0.72);
    g.moveTo(0, y + Math.sin(i * 1.7) * 8)
      .bezierCurveTo(w * 0.25, y - 22, w * 0.68, y + 16, w, y - 6)
      .stroke({ width: 1.2, color: 0xbceccf, alpha: 0.04 });
  }
}

function makeWelcomeFlowerTexture(variant) {
  const W = 96;
  const H = 96;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const cx = W * 0.5;
  const cy = H * 0.45;
  const themes = [
    { petalHi: "#ff6eb4", petalLo: "#ff9ec8", edge: "#c83878", center: "#fff8c8" },
    { petalHi: "#ffd040", petalLo: "#ffe888", edge: "#d09010", center: "#fffef0" },
    { petalHi: "#7ab0ff", petalLo: "#c8dcff", edge: "#4070c8", center: "#f4f8ff" },
    { petalHi: "#ff9078", petalLo: "#ffc0b0", edge: "#d85840", center: "#fff0e8" },
    { petalHi: "#e868c8", petalLo: "#c8a0ff", edge: "#9030a0", center: "#fff5ff" },
  ];
  const t = themes[variant % themes.length];
  const nPetals = 6 + (variant % 3);
  const rx = 8 + (variant % 2);
  const ry = 16 + (variant % 3);
  for (let i = 0; i < nPetals; i += 1) {
    const a = (i / nPetals) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -ry - 6, 0, 6);
    g.addColorStop(0, t.petalHi);
    g.addColorStop(0.55, t.petalLo);
    g.addColorStop(1, t.edge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -12, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const cg = ctx.createRadialGradient(cx, cy - 1, 0, cx, cy, 11);
  cg.addColorStop(0, t.center);
  cg.addColorStop(0.8, t.edge);
  cg.addColorStop(1, t.edge);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(c);
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
  const triggerPlay = (e) => {
    if (mode.disabled) return;
    e?.stopPropagation?.();
    onPlay(mode);
  };
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
    btn.container.on("pointerdown", triggerPlay);
    btn.container.on("pointertap", triggerPlay);
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
  if (!mode.disabled) {
    c.on("pointerdown", triggerPlay);
    c.on("pointertap", triggerPlay);
  }
  return c;
}

/**
 * @param {HTMLElement} hostEl
 */
export async function mountExperience(hostEl) {
  const app = new PIXI.Application();
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  await app.init({
    resizeTo: hostEl,
    background: "#19382a",
    antialias: true,
    autoDensity: true,
    resolution: dpr,
  });
  app.ticker.maxFPS = 30;
  hostEl.appendChild(app.canvas);

  const gameRoot = new PIXI.Container();
  const welcomeRoot = new PIXI.Container();
  const wardrobeRoot = new PIXI.Container();
  const modeSelectRoot = new PIXI.Container();
  const profileRoot = new PIXI.Container();
  const storeRoot = new PIXI.Container();
  const accountTopBar = new PIXI.Container();
  const accountTopBarBg = new PIXI.Graphics();
  const accountTopBarText = new PIXI.Text({
    text: "",
    style: { fontFamily: FONT_UI, fontSize: 12, fontWeight: "700", fill: 0xeafff0 },
  });
  accountTopBarText.anchor.set(1, 0.5);
  accountTopBar.addChild(accountTopBarBg);
  accountTopBar.addChild(accountTopBarText);
  accountTopBar.visible = false;
  const btnStore = makeRoundedButton("Store", 96, 32);
  btnStore.container.visible = false;
  const btnProfileQuick = makeRoundedButton("Profile", 96, 32);
  btnProfileQuick.container.visible = true;
  const gitShaRaw = typeof import.meta.env.VITE_GIT_SHA === "string" ? import.meta.env.VITE_GIT_SHA : "";
  const appVersionRaw = typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : "";
  const buildVersionRaw =
    (gitShaRaw && gitShaRaw !== "dev" ? gitShaRaw.slice(0, 7) : "") ||
    (appVersionRaw && appVersionRaw !== "0.0.0" ? appVersionRaw : "") ||
    "dev";
  const versionLabel = new PIXI.Text({
    text: `v${String(buildVersionRaw).replace(/^v/i, "")}`,
    style: {
      fontFamily: FONT_UI,
      fontSize: 11,
      fontWeight: "600",
      fill: 0xe6f6ea,
      letterSpacing: 0.02,
    },
  });
  versionLabel.anchor.set(1, 1);
  versionLabel.alpha = 0.56;

  app.stage.addChild(gameRoot);
  app.stage.addChild(welcomeRoot);
  app.stage.addChild(wardrobeRoot);
  app.stage.addChild(modeSelectRoot);
  app.stage.addChild(profileRoot);
  app.stage.addChild(storeRoot);
  app.stage.addChild(accountTopBar);
  app.stage.addChild(btnStore.container);
  app.stage.addChild(btnProfileQuick.container);
  app.stage.addChild(versionLabel);

  let active = "welcome";
  /** @type {{ magical_creatures: number, inventory: string[] } | null} */
  let accountProfile = null;
  let accountUserId = null;

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

  let gameApi = {
    setPaused: () => {},
    setSpiritLook: () => {},
    setPlayerLabel: () => {},
    setGameMode: () => {},
    cleanup: () => {},
  };
  let gameReady = false;
  let mountGameTask = null;
  let mountGameError = null;
  const startMountGame = () => {
    mountGameError = null;
    mountGameTask = mountGame(hostEl, {
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
    })
      .then((api) => {
        gameApi = api;
        gameReady = true;
        gameApi.setSpiritLook(selectedSpiritLook);
        gameApi.setPlayerLabel(loadPlayer()?.name ?? initialGuest?.name ?? "Guest");
        gameApi.setPaused(active !== "game");
      })
      .catch((e) => {
        mountGameError = e;
        console.error("[Bloom Spirits] mountGame failed; continuing with welcome-only fallback", e);
        gameReady = false;
      });
    return mountGameTask;
  };
  startMountGame();
  try {
    await Promise.race([
      mountGameTask,
      new Promise((resolve) => {
        window.setTimeout(resolve, 1200);
      }),
    ]);
  } catch (e) {
    console.error("[Bloom Spirits] mountGame bootstrap race failed", e);
  }

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
    accountProfile = null;
    accountUserId = null;
    accountTopBar.visible = false;
    btnStore.container.visible = false;
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

  function refreshAccountTopBar() {
    if (!accountProfile) {
      accountTopBar.visible = false;
      return;
    }
    accountTopBar.visible = true;
    accountTopBarText.text = `Magical Creatures ${Math.floor(accountProfile.magical_creatures || 0)}`;
    const padX = 10;
    const padY = 6;
    const w = accountTopBarText.width + padX * 2;
    const h = 26;
    accountTopBarBg.clear();
    accountTopBarBg.roundRect(0, 0, w, h, 10).fill({ color: 0x0e2218, alpha: 0.8 });
    accountTopBarBg.roundRect(0, 0, w, h, 10).stroke({ width: 1, color: 0x9dd8b2, alpha: 0.35 });
    accountTopBarText.x = w - padX;
    accountTopBarText.y = h * 0.5;
    accountTopBar.x = app.screen.width - 14 - w;
    accountTopBar.y = 12;
  }

  function refreshAuthButtons() {
    const loggedIn = getStorageMode() === "account";
    btnLogin.container.visible = !loggedIn;
    btnStore.container.visible = true;
    btnProfileQuick.container.visible = active === "welcome";
    refreshAccountTopBar();
  }

  const storeUi = new StoreUI(app, {
    fontUi: FONT_UI,
    onClose: () => {},
    onBuyCreature: async (itemId) => {
      if (getStorageMode() !== "account") {
        window.alert("Please login with Google to make purchases.");
        return;
      }
      try {
        await purchaseWithCreatures(itemId);
        if (accountUserId) {
          accountProfile = await loadProfile(accountUserId);
          storeUi.setProfile(accountProfile);
          refreshAccountTopBar();
          storeUi.setStatus("Purchased successfully.", 0xcff7d6);
        } else {
          storeUi.setStatus("Signed-in user not found.", 0xffd1d1);
        }
      } catch (e) {
        console.error("[Bloom Spirits] Creature purchase failed", e);
        storeUi.setStatus("Purchase failed. Need more magical creatures?", 0xffd1d1);
      }
    },
    onBuyUsd: async () => {
      if (getStorageMode() !== "account") {
        window.alert("Please login with Google to make purchases.");
        return;
      }
      console.log("Redirecting to Stripe...");
      storeUi.setStatus("Redirecting to Stripe...", 0xcde4ff);
    },
  });
  storeRoot.addChild(storeUi.root);
  btnStore.container.on("pointerdown", () => {
    playSoftClick();
    storeUi.setProfile(accountProfile);
    storeUi.setStatus("");
    storeUi.open();
  });
  btnProfileQuick.container.on("pointerdown", () => {
    playSoftClick();
    showScreen("profile");
  });

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
  const welcomeFlowersLayer = new PIXI.Container();
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
  wSubtitle.visible = false;
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
  wSupportLine.visible = false;
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
  welcomeMoveHint.visible = false;

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
  const btnLogin = makeRoundedButton("Login", 260, 44);
  const welcomeHintSeen = window.localStorage?.getItem("bloom_welcome_hint_seen") === "1";
  let showWelcomeMoveHint = !welcomeHintSeen;
  if (!showWelcomeMoveHint) welcomeMoveHint.visible = false;

  const welcomeSporesState = [];
  const welcomeFlowerTextures = [0, 1, 2, 3, 4].map((v) => makeWelcomeFlowerTexture(v));
  const welcomeFlowerSprites = [];
  const welcomePointer = { x: app.screen.width * 0.5, y: app.screen.height * 0.5 };
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
  function initWelcomeFlowers(w, h) {
    for (let i = 0; i < welcomeFlowerSprites.length; i += 1) {
      welcomeFlowerSprites[i].destroy();
    }
    welcomeFlowerSprites.length = 0;
    welcomeFlowersLayer.removeChildren();
    const count = Math.max(64, Math.min(132, ((w * h) / 18000) | 0));
    for (let i = 0; i < count; i += 1) {
      const s = new PIXI.Sprite(welcomeFlowerTextures[(Math.random() * welcomeFlowerTextures.length) | 0]);
      s.anchor.set(0.5);
      s.x = Math.random() * w;
      s.y = Math.random() * h;
      s._baseX = s.x;
      s._baseY = s.y;
      s._phase = Math.random() * Math.PI * 2;
      s._vx = (Math.random() - 0.5) * 0.045;
      s._vy = (Math.random() - 0.5) * 0.03;
      s._depth = 0.2 + Math.random() * 0.8;
      s._baseScale = (0.16 + Math.random() * 0.3) * (0.65 + s._depth * 0.6);
      s.scale.set(s._baseScale);
      s.alpha = 0.1 + s._depth * 0.24;
      s.rotation = Math.random() * Math.PI * 2;
      s.tint = Math.random() < 0.2 ? 0xf8ffe8 : 0xffffff;
      welcomeFlowersLayer.addChild(s);
      welcomeFlowerSprites.push(s);
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
    for (let i = 0; i < welcomeFlowerSprites.length; i += 1) {
      const f = welcomeFlowerSprites[i];
      f._phase += 0.006;
      f._baseX += f._vx;
      f._baseY += f._vy;
      const dx = welcomePointer.x - f._baseX;
      const dy = welcomePointer.y - f._baseY;
      const d = Math.hypot(dx, dy);
      const react = Math.max(0, 1 - d / 190);
      const swayX = Math.sin(f._phase) * (2.2 + f._depth * 2.8);
      const swayY = Math.cos(f._phase * 0.9) * (1.8 + f._depth * 2.2);
      f.x = f._baseX + swayX - dx * react * 0.05;
      f.y = f._baseY + swayY - dy * react * 0.05;
      f.rotation += 0.0005 + f._depth * 0.0009;
      const pulse = Math.sin(f._phase * 1.4) * 0.5 + 0.5;
      f.alpha = 0.08 + f._depth * 0.2 + pulse * 0.07 + react * 0.12;
      const scaleBoost = 1 + react * 0.16;
      f.scale.set(f._baseScale * (0.94 + pulse * 0.08) * scaleBoost);
      if (f._baseX < -28) f._baseX = w + 28;
      if (f._baseX > w + 28) f._baseX = -28;
      if (f._baseY < -28) f._baseY = h + 28;
      if (f._baseY > h + 28) f._baseY = -28;
    }
  }
  app.ticker.add(tickWelcomeAtmosphere);
  welcomeRoot.eventMode = "static";
  welcomeRoot.on("pointermove", (e) => {
    welcomePointer.x = e.global.x;
    welcomePointer.y = e.global.y;
  });

  welcomeRoot.addChild(wBg);
  welcomeRoot.addChild(wPattern);
  welcomeRoot.addChild(welcomeSpiritOrb);
  welcomeRoot.addChild(welcomeSpiritCore);
  welcomeRoot.addChild(welcomeCenterLight);
  welcomeRoot.addChild(welcomeFogA);
  welcomeRoot.addChild(welcomeFogB);
  welcomeRoot.addChild(welcomeFlowersLayer);
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
    btnLogin.container.alpha = 0.75;
  }

  refreshWelcomeProfile();

  // —— Journey mode picker (after “Enter the world” / sign-in) ——
  const msBackdrop = new PIXI.Graphics();
  msBackdrop.eventMode = "none";
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
      void startJourney(m.id, m.title);
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
  modeSelectRoot.eventMode = "static";
  modeSelectRoot.interactiveChildren = true;
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
      void startJourney("restoration", "Endless Restoration");
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

  // Backdrop is non-interactive so it cannot swallow card clicks.
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
  const btnBack = makeRoundedButton("Back to Home", 200, 44);
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
    btnSpiritWardrobe.x = w * 0.5 - 110;
    btnSpiritWardrobe.y = Math.min(titleBottom + 30, h - 224);
    const ctaY = Math.min(btnSpiritWardrobe.y + 52, h - 156);
    btnEnterWrap.x = w * 0.5 - 158;
    btnEnterWrap.y = ctaY;
    welcomeMoveHint.x = w * 0.5;
    welcomeMoveHint.y = ctaY + 90;
    welcomeMoveHint.visible = false;
    btnLogin.container.x = w * 0.5 - 130;
    btnLogin.container.y = Math.min(h - 44, welcomeMoveHint.y + 34);
    initWelcomeSpores(w, h);
    initWelcomeFlowers(w, h);

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
    versionLabel.x = w - 10;
    versionLabel.y = h - 8;
    accountTopBar.x = w - 14 - accountTopBar.width;
    accountTopBar.y = 12;
    btnStore.container.x = 14;
    btnStore.container.y = 12;
    btnProfileQuick.container.x = 14;
    btnProfileQuick.container.y = 50;
    storeUi.layout();
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
    btnProfileQuick.container.visible = name === "welcome";

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

  async function startJourney(modeId = "restoration", modeTitle = "Endless Restoration") {
    if (!gameReady) {
      try {
        await mountGameTask;
      } catch {}
    }
    if (!gameReady) {
      try {
        gameRoot.removeChildren();
      } catch {}
      try {
        await startMountGame();
      } catch {}
    }
    if (!gameReady) {
      const extra = mountGameError?.message ? `\n\n${String(mountGameError.message)}` : "";
      window.alert(`The world is still waking up. Please try again in a moment.${extra}`);
      showScreen("welcome");
      return;
    }
    try {
      gameApi.setGameMode(modeId, modeTitle);
    } catch (e) {
      console.error("[Bloom Spirits] setGameMode failed", e);
    }
    hideModeSelectInstant();
    enterGame();
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
    // Temporary hard-fail-safe: go straight to playable mode.
    void startJourney("restoration", "Endless Restoration");
  });
  btnLogin.container.on("pointerdown", () => {
    playSoftClick();
    void (async () => {
      const { error } = await login();
      if (error) {
        console.error("[Bloom Spirits] Google sign-in failed", error);
        window.alert("Google login is unavailable right now. Please verify Supabase env variables in this deployment.");
      }
    })();
  });

  btnBack.container.on("pointerdown", () => {
    playSoftClick();
    showScreen("welcome");
  });
  btnLogoutP.container.on("pointerdown", () => {
    void onLogoutClick();
  });

  welcomeRoot.alpha = 1;
  layoutFlowScreens();
  showScreen("welcome");
  let authBootstrapped = false;
  const bootFallbackTimer = window.setTimeout(() => {
    if (authBootstrapped) return;
    welcomeRoot.alpha = 1;
    layoutFlowScreens();
    showScreen("welcome");
  }, 1800);

  const unsubAuth = subscribeAuth(async (event, session) => {
    if (event === "INITIAL_SESSION") {
      authBootstrapped = true;
      window.clearTimeout(bootFallbackTimer);
      if (session?.user) {
        try {
          await setAccountMode(session.user);
          accountUserId = session.user.id;
          accountProfile = await ensureAndLoadProfile(session.user);
          selectedSpiritLook = normalizeSpiritLook(loadPlayer()?.spiritLook);
          gameApi.setSpiritLook(selectedSpiritLook);
          refreshWardrobeSelection();
          gameApi.setPlayerLabel(loadPlayer()?.name ?? "Spirit");
          refreshAuthButtons();
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
        accountProfile = null;
        refreshAuthButtons();
        welcomeRoot.alpha = 1;
        layoutFlowScreens();
        showScreen("welcome");
      }
      return;
    }
    if (event === "SIGNED_IN" && session?.user) {
      try {
        await setAccountMode(session.user);
        accountUserId = session.user.id;
        accountProfile = await ensureAndLoadProfile(session.user);
        selectedSpiritLook = normalizeSpiritLook(loadPlayer()?.spiritLook);
        gameApi.setSpiritLook(selectedSpiritLook);
        refreshWardrobeSelection();
        gameApi.setPlayerLabel(loadPlayer()?.name ?? "Spirit");
        refreshAuthButtons();
        openModeSelect();
      } catch (e) {
        console.error("[Bloom Spirits] Sign-in failed", e);
      }
    }
    if (event === "SIGNED_OUT") {
      accountProfile = null;
      accountUserId = null;
      refreshAuthButtons();
      resetToWelcome();
    }
  });

  if (!isSupabaseConfigured) {
    authBootstrapped = true;
    window.clearTimeout(bootFallbackTimer);
    welcomeRoot.alpha = 1;
    layoutFlowScreens();
    showScreen("welcome");
  }
  refreshAuthButtons();

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
    welcomeRoot.removeAllListeners("pointermove");
    window.removeEventListener("keydown", onEscapeWardrobe);
    window.clearTimeout(bootFallbackTimer);
    unsubAuth();
    app.renderer.off("resize", layoutFlowScreens);
    for (let i = 0; i < welcomeFlowerTextures.length; i += 1) welcomeFlowerTextures[i].destroy(true);
    gameApi.cleanup();
    app.destroy(true, { children: true, texture: true });
  };

  return { cleanup, showScreen, getActiveScreen: () => active };
}
