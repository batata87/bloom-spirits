import * as PIXI from "pixi.js";
import { BlurFilter } from "pixi.js";
import gsap from "gsap";
import { mountGame, createBackgroundTexture } from "../Game.js";
import {
  loadPlayer,
  loadStats,
  saveGuestPlayer,
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

const TEXT_STYLE_TITLE = {
  fill: 0xe8fff0,
  fontFamily: "Montserrat, Georgia, serif",
  fontSize: 42,
  fontWeight: "600",
  dropShadow: {
    alpha: 0.45,
    angle: Math.PI / 2,
    blur: 12,
    color: 0xa8f0c8,
    distance: 0,
  },
};

const TEXT_SOFT = {
  fill: 0xc8e8d4,
  fontFamily: "Montserrat",
  fontSize: 14,
  fontWeight: "500",
};

function makeRoundedButton(label, w, h) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const t = new PIXI.Text({ text: label, style: { ...TEXT_SOFT, fontSize: 15, fill: 0xe8fff0 } });
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
    const a = hover ? 0.38 : 0.22;
    g.roundRect(0, 0, w, h, 14).fill({ color: 0x3a6b52, alpha: a });
    g.roundRect(0, 0, w, h, 14).stroke({ width: 1, color: 0x9ed9b0, alpha: hover ? 0.45 : 0.22 });
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
  const profileRoot = new PIXI.Container();

  app.stage.addChild(gameRoot);
  app.stage.addChild(welcomeRoot);
  app.stage.addChild(profileRoot);

  let active = "welcome";

  const gameApi = await mountGame(hostEl, {
    app,
    gameParent: gameRoot,
    flowPlayerName: loadPlayer()?.name ?? "Guest",
    onFlowProfile: () => {
      playSoftClick();
      showScreen("profile");
    },
    onFlowLogout: () => {
      void onLogoutClick();
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

  function resetToWelcome() {
    setGuestMode();
    clearGuestSession();
    gameApi.setPlayerLabel("Guest");
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
  wBg.filters = [new BlurFilter({ strength: 3 })];
  const wDim = new PIXI.Graphics();
  const title = new PIXI.Text({ text: "Bloom Spirits", style: TEXT_STYLE_TITLE });
  title.anchor.set(0.5);

  const btnGuest = makeRoundedButton("Enter as guest", 220, 48);
  const btnLogin = makeRoundedButton("Enter with email", 220, 48);

  welcomeRoot.addChild(wBg);
  welcomeRoot.addChild(wDim);
  welcomeRoot.addChild(title);
  welcomeRoot.addChild(btnGuest.container);
  welcomeRoot.addChild(btnLogin.container);

  if (!isSupabaseConfigured) {
    btnLogin.container.visible = false;
  }

  // —— Profile ——
  const pBgTex = createBackgroundTexture(app.screen.width * 1.5, app.screen.height * 1.5);
  const pBg = new PIXI.Sprite(pBgTex);
  pBg.anchor.set(0.5);
  pBg.filters = [new BlurFilter({ strength: 2.5 })];
  const pDim = new PIXI.Graphics();
  const pName = new PIXI.Text({ text: "", style: { ...TEXT_STYLE_TITLE, fontSize: 32 } });
  pName.anchor.set(0.5);
  const pStats = new PIXI.Text({
    text: "",
    style: { ...TEXT_SOFT, fontSize: 14, align: "center", lineHeight: 24 },
  });
  pStats.anchor.set(0.5);
  const btnBack = makeRoundedButton("Back to Game", 200, 44);
  const btnLogoutP = makeRoundedButton("Leave the world", 200, 44);

  profileRoot.addChild(pBg);
  profileRoot.addChild(pDim);
  profileRoot.addChild(pName);
  profileRoot.addChild(pStats);
  profileRoot.addChild(btnBack.container);
  profileRoot.addChild(btnLogoutP.container);
  profileRoot.visible = false;
  profileRoot.alpha = 0;

  function layoutFlowScreens() {
    const w = app.screen.width;
    const h = app.screen.height;
    wBg.x = w * 0.5;
    wBg.y = h * 0.5;
    wBg.width = w * 1.5;
    wBg.height = h * 1.5;
    wDim.clear();
    wDim.rect(0, 0, w, h).fill({ color: 0x0f2418, alpha: 0.42 });
    title.x = w * 0.5;
    title.y = h * 0.22;
    const guestY = isSupabaseConfigured ? h * 0.48 : h * 0.5;
    btnGuest.container.x = w * 0.5 - 110;
    btnGuest.container.y = guestY;
    btnLogin.container.x = w * 0.5 - 110;
    btnLogin.container.y = h * 0.48 + 58;

    pBg.x = w * 0.5;
    pBg.y = h * 0.5;
    pBg.width = w * 1.5;
    pBg.height = h * 1.5;
    pDim.clear();
    pDim.rect(0, 0, w, h).fill({ color: 0x0f2418, alpha: 0.48 });
    pName.x = w * 0.5;
    pName.y = h * 0.28;
    pStats.x = w * 0.5;
    pStats.y = h * 0.42;
    btnBack.container.x = w * 0.5 - 100;
    btnBack.container.y = h * 0.62;
    btnLogoutP.container.x = w * 0.5 - 100;
    btnLogoutP.container.y = h * 0.62 + 54;
  }

  function refreshProfileText() {
    const pl = loadPlayer();
    const st = loadStats();
    pName.text = pl?.name ?? "Guest";
    pStats.text = `Worlds Restored: ${st.worldsAwakened}\nTotal Blooms: ${st.totalBlooms}\nTime Played: ${formatPlayTime(st.timePlayedMs)}`;
  }

  function showScreen(name) {
    const dur = 0.5;
    const ease = "power2.inOut";
    active = name;

    if (name === "welcome") {
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
    } else if (name === "game") {
      welcomeRoot.visible = true;
      gsap.to(welcomeRoot, { alpha: 0, duration: dur, ease, onComplete: () => { welcomeRoot.visible = false; } });
      gsap.to(profileRoot, { alpha: 0, duration: dur * 0.55, ease, onComplete: () => { profileRoot.visible = false; } });
      gameRoot.visible = true;
      gsap.to(gameRoot, { alpha: 1, duration: dur, ease });
      gameApi.setPaused(false);
    } else if (name === "profile") {
      refreshProfileText();
      profileRoot.visible = true;
      gsap.to(profileRoot, { alpha: 1, duration: dur, ease });
      gameApi.setPaused(true);
    }
  }

  function enterGame() {
    showScreen("game");
  }

  btnGuest.container.on("pointerdown", () => {
    playSoftClick();
    setGuestMode();
    saveGuestPlayer({ name: "Guest", isGuest: true });
    gameApi.setPlayerLabel("Guest");
    enterGame();
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
          gameApi.setPlayerLabel(loadPlayer()?.name ?? "Spirit");
          welcomeRoot.visible = false;
          welcomeRoot.alpha = 0;
          layoutFlowScreens();
          enterGame();
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
        gameApi.setPlayerLabel(loadPlayer()?.name ?? "Spirit");
        modal.classList.remove("visible");
        enterGame();
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

  layoutFlowScreens();
  app.renderer.on("resize", layoutFlowScreens);

  const cleanup = () => {
    unsubAuth();
    app.renderer.off("resize", layoutFlowScreens);
    gameApi.cleanup();
    modal.remove();
    app.destroy(true, { children: true, texture: true });
  };

  return { cleanup, showScreen, getActiveScreen: () => active };
}
