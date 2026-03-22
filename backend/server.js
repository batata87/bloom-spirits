const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
const MAX_ROOM_SIZE = 50;
const WORLD_SIZE = 6500;
const TICK_RATE = 30;
const MAX_TRAIL_POINTS_PER_PLAYER = 1400;
const TRAIL_STEP_DIST = 8;
const MAX_BUDS = 20;
const BUD_SPAWN_BATCH = 4;
const BUD_MARGIN = 90;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();
const spectatorsBySocket = new Map();

function randomIn(min, max) {
  return min + Math.random() * (max - min);
}

function createSynapse(type) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x: randomIn(120, WORLD_SIZE - 120),
    y: randomIn(120, WORLD_SIZE - 120),
    type,
    value: randomIn(0.9, 2.4),
  };
}

function randomSynapseType() {
  const roll = Math.random();
  if (roll < 0.55) return "basic";
  if (roll < 0.73) return "blue";
  if (roll < 0.9) return "red";
  return "purple";
}

function createRoom(id) {
  const room = {
    id,
    players: new Map(),
    buds: [],
    blueFlowers: [],
    bounds: {
      minX: WORLD_SIZE * 0.5 - 400,
      maxX: WORLD_SIZE * 0.5 + 400,
      minY: WORLD_SIZE * 0.5 - 400,
      maxY: WORLD_SIZE * 0.5 + 400,
    },
  };
  const nowMs = Date.now();
  // Seed initial buds.
  for (let i = 0; i < MAX_BUDS; i += 1) room.buds.push(createBud(nowMs));
  return room;
}

function getOrCreateRoom() {
  for (const room of rooms.values()) {
    if (room.players.size < MAX_ROOM_SIZE) return room;
  }
  const id = `room-${rooms.size + 1}`;
  const room = createRoom(id);
  rooms.set(id, room);
  return room;
}

function createPlayer(id, name = "Processor") {
  return {
    id,
    name,
    x: randomIn(WORLD_SIZE * 0.35, WORLD_SIZE * 0.65),
    y: randomIn(WORLD_SIZE * 0.35, WORLD_SIZE * 0.65),
    angle: 0,
    speed: 185,
    alive: true,
    score: 0,
    bornAt: Date.now(),
    opacity: 1,
    radius: 14,
    trail: [],
    lastAbsorbAt: 0,
    input: {
      targetX: 0,
      targetY: 0,
      steeringWeight: 1,
    },
  };
}

function createBud(nowMs) {
  const value = randomIn(0.9, 1.4);
  return {
    id: `${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
    x: randomIn(BUD_MARGIN, WORLD_SIZE - BUD_MARGIN),
    y: randomIn(BUD_MARGIN, WORLD_SIZE - BUD_MARGIN),
    value,
    bornAt: nowMs,
  };
}

function ensureBuds(room, nowMs) {
  const missing = MAX_BUDS - room.buds.length;
  if (missing <= 0) return;
  const toSpawn = Math.min(BUD_SPAWN_BATCH, missing);
  for (let i = 0; i < toSpawn; i += 1) {
    room.buds.push(createBud(nowMs));
  }
}

function updatePlayer(room, p, dt, nowMs) {
  if (!p.alive) return;

  // Smooth steering: follow the mouse target with gradual rotation.
  const targetAngle = Math.atan2(p.input.targetY - p.y, p.input.targetX - p.x);
  let diff = targetAngle - p.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  p.angle += diff * Math.min(1, dt * 7.0);

  p.x += Math.cos(p.angle) * p.speed * dt;
  p.y += Math.sin(p.angle) * p.speed * dt;

  // Keep inside the world bounds (soft margin).
  p.x = Math.max(60, Math.min(WORLD_SIZE - 60, p.x));
  p.y = Math.max(60, Math.min(WORLD_SIZE - 60, p.y));

  // Trail creation (progressively more complex over time).
  const lastPoint = p.trail.length ? p.trail[p.trail.length - 1] : null;
  const dx = lastPoint ? p.x - lastPoint.x : 0;
  const dy = lastPoint ? p.y - lastPoint.y : 0;
  const distSq = dx * dx + dy * dy;
  if (!lastPoint || distSq >= TRAIL_STEP_DIST * TRAIL_STEP_DIST) {
    const ageSec = (nowMs - p.bornAt) / 1000;
    const level = Math.max(0, Math.min(1, ageSec / 45)) * Math.min(1, p.trail.length / 850);
    p.trail.push({ x: p.x, y: p.y, t: nowMs, level });

    if (p.trail.length > MAX_TRAIL_POINTS_PER_PLAYER) {
      p.trail.splice(0, p.trail.length - MAX_TRAIL_POINTS_PER_PLAYER);
    }
    room.bounds.minX = Math.min(room.bounds.minX, p.x);
    room.bounds.maxX = Math.max(room.bounds.maxX, p.x);
    room.bounds.minY = Math.min(room.bounds.minY, p.y);
    room.bounds.maxY = Math.max(room.bounds.maxY, p.y);
  }

  // Bud collection (core goal).
  const absorbDist = p.radius + 18;
  const absorbDistSq = absorbDist * absorbDist;
  if (room.buds && room.buds.length) {
    const collected = [];
    for (let i = room.buds.length - 1; i >= 0; i -= 1) {
      const b = room.buds[i];
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy > absorbDistSq) continue;

      collected.push(b);
      room.buds.splice(i, 1);
    }

    if (collected.length) {
      p.score += 10 * collected.length;

      for (const b of collected) {
        room.blueFlowers.push({
          id: `flower-${p.id}-${b.id}`,
          x: b.x,
          y: b.y,
          bornAt: nowMs,
        });
      }

      io.to(room.id).emit("budsCollected", {
        collectorId: p.id,
        points: collected.map((b) => ({ x: b.x, y: b.y, value: b.value })),
      });
    }
  }
}

function leaderboardFor(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

function roomSnapshot(room) {
  return {
    roomId: room.id,
    worldSize: WORLD_SIZE,
    bounds: room.bounds,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      angle: p.angle,
      radius: p.radius,
      score: p.score,
      alive: p.alive,
      opacity: p.opacity,
      trail: p.trail,
    })),
    buds: room.buds.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      value: b.value,
      bornAt: b.bornAt,
    })),
    blueFlowers: room.blueFlowers,
    leaderboard: leaderboardFor(room),
  };
}

io.on("connection", (socket) => {
  // eslint-disable-next-line no-console
  console.log(`[socket] connected: ${socket.id}`);
  socket.onAny((event, ...args) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] event: ${event} args=${JSON.stringify(args).slice(0, 120)}`);
  });
  socket.on("joinGame", ({ name }) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] joinGame from ${socket.id} name=${name}`);
    const room = getOrCreateRoom();
    const player = createPlayer(socket.id, name);
    player.input.targetX = player.x;
    player.input.targetY = player.y;
    player.trail.push({ x: player.x, y: player.y, t: Date.now(), level: 0 });
    room.players.set(socket.id, player);
    socket.join(room.id);
    socket.data.roomId = room.id;
    io.to(socket.id).emit("joined", {
      id: socket.id,
      roomId: room.id,
      worldSize: WORLD_SIZE,
    });
  });

  socket.on("joinSpectator", ({ roomId }) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] joinSpectator from ${socket.id} roomId=${roomId}`);
    const room = rooms.get(roomId);
    if (!room) return;
    spectatorsBySocket.set(socket.id, roomId);
    socket.join(room.id);
    io.to(socket.id).emit("spectatorJoined", { roomId });
  });

  socket.on("input", (payload) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.input = {
      targetX: payload.targetX ?? p.input.targetX,
      targetY: payload.targetY ?? p.input.targetY,
    };
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomId);
    if (room) {
      room.players.delete(socket.id);
      if (room.players.size === 0) rooms.delete(room.id);
    }
    spectatorsBySocket.delete(socket.id);
  });
});

setInterval(() => {
    for (const room of rooms.values()) {
    const nowMs = Date.now();
    for (const p of room.players.values())
      updatePlayer(room, p, 1 / TICK_RATE, nowMs);
    ensureBuds(room, nowMs);
    io.to(room.id).emit("state", roomSnapshot(room));
  }
}, 1000 / TICK_RATE);

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/rooms", (_, res) => {
  const list = [...rooms.values()].map((r) => ({
    id: r.id,
    players: r.players.size,
  }));
  res.json({ rooms: list });
});

server.listen(PORT, () => {
  console.log(`Neural.io backend running on http://localhost:${PORT}`);
});
