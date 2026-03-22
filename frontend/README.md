# Bloom Spirits (Pixi + React)

## Run the dev server

From **this folder** (`frontend/`):

```bash
npm install
npm run dev
```

Open the URL Vite prints (default in this project: **http://localhost:5174/**).

> **Important:** The repo root has a different canvas prototype (`../index.html`). Narrative work lives only in **`frontend/src/Game.js`**. Always use **`npm run dev` inside `frontend/`**.

## Seeing the narrative layer

1. You should see the **Bloom Spirits** welcome screen (title + **Start as Guest** / **Login**).
2. Click **Start as Guest** (or log in and **Enter**). The game view must be active — the new HUD is **not** shown on the welcome screen.
3. In-game, look for the top bar: **“World Restoration”** and the %.
4. **Whispers** only appear while **moving**, after roughly **20–40 seconds** between lines — they are subtle (low opacity).

If something looks stale: stop the dev server, run `npm run dev` again, then **hard refresh** the tab (Ctrl+Shift+R).
