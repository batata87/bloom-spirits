import * as PIXI from "pixi.js";

function makeButton(text, width, height, onPress, fontUi) {
  const root = new PIXI.Container();
  const bg = new PIXI.Graphics();
  const label = new PIXI.Text({
    text,
    style: { fontFamily: fontUi, fontSize: 13, fontWeight: "700", fill: 0xf6fff8 },
  });
  label.anchor.set(0.5);
  label.x = width * 0.5;
  label.y = height * 0.5;
  const draw = (hover) => {
    bg.clear();
    bg.roundRect(0, 0, width, height, 10).fill({ color: hover ? 0x2f6a50 : 0x24533f, alpha: 0.95 });
    bg.roundRect(0, 0, width, height, 10).stroke({ width: 1, color: 0xb4e2c5, alpha: hover ? 0.62 : 0.42 });
  };
  draw(false);
  root.addChild(bg);
  root.addChild(label);
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = new PIXI.Rectangle(0, 0, width, height);
  root.on("pointerover", () => draw(true));
  root.on("pointerout", () => draw(false));
  root.on("pointerdown", (e) => {
    e.stopPropagation();
    onPress();
  });
  return root;
}

export class StoreUI {
  constructor(app, { fontUi, onClose, onBuyCreature, onBuyUsd }) {
    this.app = app;
    this.onClose = onClose;
    this.onBuyCreature = onBuyCreature;
    this.onBuyUsd = onBuyUsd;
    this.profile = null;
    this.activeTab = "bazaar";

    this.root = new PIXI.Container();
    this.root.visible = false;
    this.root.alpha = 0;

    this.backdrop = new PIXI.Graphics();
    this.backdrop.eventMode = "static";
    this.backdrop.on("pointerdown", () => this.close());
    this.root.addChild(this.backdrop);

    this.panel = new PIXI.Graphics();
    this.root.addChild(this.panel);

    this.title = new PIXI.Text({
      text: "Store",
      style: { fontFamily: fontUi, fontSize: 28, fontWeight: "700", fill: 0xf2fff7 },
    });
    this.root.addChild(this.title);

    this.currency = new PIXI.Text({
      text: "Magical Creatures 0",
      style: { fontFamily: fontUi, fontSize: 13, fontWeight: "700", fill: 0xdaf3e4 },
    });
    this.root.addChild(this.currency);

    this.status = new PIXI.Text({
      text: "",
      style: { fontFamily: fontUi, fontSize: 12, fontWeight: "600", fill: 0xd0ead8 },
    });
    this.root.addChild(this.status);

    this.closeBtn = makeButton("Close", 74, 30, () => this.close(), fontUi);
    this.root.addChild(this.closeBtn);

    this.tabBazaar = makeButton("Spirit Bazaar", 152, 34, () => this.setTab("bazaar"), fontUi);
    this.tabVault = makeButton("Celestial Vault", 152, 34, () => this.setTab("vault"), fontUi);
    this.root.addChild(this.tabBazaar);
    this.root.addChild(this.tabVault);

    this.bazaarSection = new PIXI.Container();
    this.vaultSection = new PIXI.Container();
    this.root.addChild(this.bazaarSection);
    this.root.addChild(this.vaultSection);

    this.buildBazaar(fontUi);
    this.buildVault(fontUi);
  }

  buildCard(w, h, title, subtitle) {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.roundRect(0, 0, w, h, 14).fill({ color: 0x13281d, alpha: 0.95 });
    g.roundRect(0, 0, w, h, 14).stroke({ width: 1, color: 0x9fd6b3, alpha: 0.42 });
    c.addChild(g);
    const t = new PIXI.Text({
      text: title,
      style: { fontFamily: "Nunito, Montserrat, system-ui, sans-serif", fontSize: 18, fontWeight: "800", fill: 0xf5fff9 },
    });
    t.x = 16;
    t.y = 14;
    const s = new PIXI.Text({
      text: subtitle,
      style: { fontFamily: "Nunito, Montserrat, system-ui, sans-serif", fontSize: 13, fontWeight: "600", fill: 0xbfdcca },
    });
    s.x = 16;
    s.y = 44;
    c.addChild(t);
    c.addChild(s);
    return c;
  }

  buildBazaar(fontUi) {
    const card = this.buildCard(360, 172, "Ancient Owl Spirit", "Companion spirit");
    const price = new PIXI.Text({
      text: "Cost: 1000 Magical Creatures",
      style: { fontFamily: fontUi, fontSize: 13, fontWeight: "700", fill: 0xffe8a8 },
    });
    price.x = 16;
    price.y = 86;
    const buy = makeButton("Buy with Creatures", 180, 36, async () => {
      this.status.text = "Purchasing...";
      await this.onBuyCreature("spirit_companion_owl");
    }, fontUi);
    buy.x = 16;
    buy.y = 118;
    card.addChild(price);
    card.addChild(buy);
    this.bazaarSection.addChild(card);
  }

  buildVault(fontUi) {
    const card = this.buildCard(360, 172, "Eternal Bloom", "Premium cosmetic");
    const price = new PIXI.Text({
      text: "Cost: $2 USD",
      style: { fontFamily: fontUi, fontSize: 13, fontWeight: "700", fill: 0xc2e4ff },
    });
    price.x = 16;
    price.y = 86;
    const buy = makeButton("Buy with Card", 140, 36, async () => {
      this.status.text = "Redirecting to Stripe...";
      await this.onBuyUsd("eternal_bloom");
    }, fontUi);
    buy.x = 16;
    buy.y = 118;
    card.addChild(price);
    card.addChild(buy);
    this.vaultSection.addChild(card);
  }

  setProfile(profile) {
    this.profile = profile;
    const count = Math.floor(profile?.magical_creatures || 0);
    this.currency.text = `Magical Creatures ${count}`;
  }

  setStatus(text, color = 0xd0ead8) {
    this.status.text = text;
    this.status.style.fill = color;
  }

  setTab(tab) {
    this.activeTab = tab;
    this.bazaarSection.visible = tab === "bazaar";
    this.vaultSection.visible = tab === "vault";
  }

  open() {
    this.root.visible = true;
    this.root.alpha = 1;
    this.setTab(this.activeTab);
    this.layout();
  }

  close() {
    this.root.visible = false;
    this.root.alpha = 0;
    this.onClose?.();
  }

  layout() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.backdrop.clear();
    this.backdrop.rect(0, 0, w, h).fill({ color: 0x06130d, alpha: 0.74 });
    const pw = Math.min(440, w - 28);
    const ph = Math.min(360, h - 32);
    const px = Math.floor((w - pw) * 0.5);
    const py = Math.floor((h - ph) * 0.5);
    this.panel.clear();
    this.panel.roundRect(px, py, pw, ph, 18).fill({ color: 0x0d1f16, alpha: 0.96 });
    this.panel.roundRect(px, py, pw, ph, 18).stroke({ width: 1.5, color: 0xa3dbb6, alpha: 0.42 });

    this.title.x = px + 16;
    this.title.y = py + 12;
    this.currency.x = px + pw - this.currency.width - 16;
    this.currency.y = py + 20;
    this.closeBtn.x = px + pw - 90;
    this.closeBtn.y = py + ph - 42;

    this.tabBazaar.x = px + 16;
    this.tabBazaar.y = py + 58;
    this.tabVault.x = px + 176;
    this.tabVault.y = py + 58;

    this.bazaarSection.x = px + 16;
    this.bazaarSection.y = py + 102;
    this.vaultSection.x = px + 16;
    this.vaultSection.y = py + 102;
    this.status.x = px + 16;
    this.status.y = py + ph - 34;
  }
}
