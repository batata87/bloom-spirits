# Neural.io Prototype

Multiplayer web prototype inspired by Worms-style gameplay with a futuristic AI Core theme.

## Stack

- Frontend: React + Vite + Canvas (`frontend`)
- Backend: Node.js + Express + Socket.io (`backend`)

## Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

## Current Features

- Real-time multiplayer sync through Socket.io
- Auto room allocation (up to 50 players per room)
- Live leaderboard ("Top Processors")
- Spectator mode via `?spectate=room-id`
- Synapse buffs:
  - Blue: Deep Learning (more zoom out)
  - Red: Overclock bonus
  - Purple: temporary encryption (invulnerability + opacity)
- Glitch zones (invert controls / speed burst)
- Dynamic camera zoom by growth
- Overclock key with `Space`
- Left-click boost with length cost
- Particle glitch explosion on player destroy
