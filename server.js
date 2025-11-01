const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const PORT = process.env.PORT || 3000;

// Prefer serving static assets from 'public' if present; otherwise also serve project root
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
app.use(express.static(__dirname));

// Serve index.html on root; prefer public/index.html when available
app.get("/", (req, res) => {
  const publicIndex = path.join(publicDir, "index.html");
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  const indexPath = path.join(__dirname, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>Chat</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/style.css" />
  </head>
  <body><div>Indexbestand niet gevonden op deploy. Basis UI geladen.</div>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/script.js"></script>
  </body></html>`);
});

// Optional health endpoint for deploy platforms
app.get("/health", (req, res) => res.status(200).send("ok"));

let users = new Map(); // socket.id -> {name}
let rooms = new Set(); // group names
let pongGames = {};    // roomname -> pongstate

function createPongState() {
  return {
    ball: { x: 200, y: 125, radius: 10, vx: 3, vy: 2 },
    left: { y: 100, score: 0, vy: 0 },
    right: { y: 100, score: 0, vy: 0 },
    paddleW: 10,
    paddleH: 60
  };
}

io.on("connection", (socket) => {
  socket.on("register", (name) => {
    users.set(socket.id, { name });
    sendUsers();
  });

  socket.on("get users", sendUsers);
  function sendUsers() {
    const uniqueUsers = [...new Set([...users.values()].map(u => u.name))];
    io.emit("all users", uniqueUsers.map(name => ({ name })));
  }

  socket.on("get rooms", () => {
    socket.emit("joined room", Array.from(rooms));
  });

  socket.on("join room", (room) => {
    rooms.add(room);
    socket.join(room);
    io.emit("joined room", Array.from(rooms));
  });

  socket.on("chat message", (data) => {
    // data: {tab, text}
    const sender = users.get(socket.id);
    if (!sender) return;
    const msg = {
      tab: data.tab,
      user: sender.name,
      text: data.text,
      color: "#ff7f00"
    };

    if (rooms.has(data.tab)) {
      // GROEPSCHAT: stuur naar iedereen in de room (ook jezelf)
      io.to(data.tab).emit("chat message", msg);
    } else if (data.tab !== sender.name) {
      // PRIVÉCHAT: stuur naar jezelf en de ander
      // Voor de sender: msg.tab = data.tab (naam van ontvanger) ✓
      // Voor de ontvanger: msg.tab moet de naam van de sender zijn!
      let receiverSockets = [];
      for (let [id, u] of users.entries()) {
        if (u.name === data.tab) receiverSockets.push(id);
      }
      // Bericht naar ontvanger(s) - met tab = sender naam
      const receiverMsg = {
        tab: sender.name,  // Voor ontvanger: tab is de naam van de sender
        user: sender.name,
        text: data.text,
        color: "#ff7f00"
      };
      receiverSockets.forEach(id => {
        io.to(id).emit("chat message", receiverMsg);
      });
      // Naar jezelf - met tab = ontvanger naam (zoals het werd verstuurd)
      socket.emit("chat message", msg);
    }
    // Geen io.emit(), geen fallback
  });

  // ----- PONG EVENTS -----
  socket.on('pong request', (room, partner) => {
    socket.join(room);
    for (let [id, u] of users.entries()) {
      if (u.name === partner && id !== socket.id) {
        io.to(id).emit('pong request', room, users.get(socket.id).name);
      }
    }
  });

  socket.on('pong accept', (room, partner) => {
    socket.join(room);
    for (let [id, u] of users.entries()) {
      if (u.name === partner && id !== socket.id) {
        io.to(id).emit('pong accept', room, users.get(socket.id).name);
      }
    }
    pongGames[room] = createPongState();
    io.in(room).emit('pong start');
    io.in(room).emit('pong state', room, pongGames[room]);
  });

  socket.on('pong join', (room, role) => {
    socket.join(room);
    socket.emit('pong role', role);
    if (pongGames[room]) socket.emit('pong state', room, pongGames[room]);
  });

  socket.on('pong move', (room, role, dir) => {
    if (!pongGames[room]) return;
    let paddle = role === 'left' ? pongGames[room].left : pongGames[room].right;
    paddle.y += dir * 8; // Kleiner stap voor soepelere beweging
    paddle.y = Math.max(0, Math.min(250 - pongGames[room].paddleH, paddle.y));
    io.in(room).emit('pong state', room, pongGames[room]);
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    sendUsers();
  });
});

// Pong ticker
setInterval(() => {
  for (const room in pongGames) {
    let g = pongGames[room];
    // Apply paddle velocities for smooth movement
    if (typeof g.left.vy === 'number') {
      g.left.y = Math.max(0, Math.min(250 - g.paddleH, g.left.y + g.left.vy));
    }
    if (typeof g.right.vy === 'number') {
      g.right.y = Math.max(0, Math.min(250 - g.paddleH, g.right.y + g.right.vy));
    }
    g.ball.x += g.ball.vx;
    g.ball.y += g.ball.vy;
    // Bounce boven/onder
    if (g.ball.y < g.ball.radius || g.ball.y > 250 - g.ball.radius) g.ball.vy *= -1;
    // Paddle collision
    if (
      g.ball.x - g.ball.radius < 20 &&
      g.ball.y > g.left.y &&
      g.ball.y < g.left.y + g.paddleH
    ) {
      g.ball.vx *= -1;
      g.ball.x = 20 + g.ball.radius;
    }
    if (
      g.ball.x + g.ball.radius > 380 &&
      g.ball.y > g.right.y &&
      g.ball.y < g.right.y + g.paddleH
    ) {
      g.ball.vx *= -1;
      g.ball.x = 380 - g.ball.radius;
    }
    // Score + win condition at 10 points
    if (g.ball.x < 0) { g.right.score++; }
    if (g.ball.x > 400) { g.left.score++; }
    // Check win
    if (g.left.score >= 10 || g.right.score >= 10) {
      const winner = g.left.score >= 10 ? 'left' : 'right';
      io.in(room).emit('pong gameover', room, winner);
      delete pongGames[room];
      continue;
    }
    // Reset rally after a score
    if (g.ball.x < 0 || g.ball.x > 400) {
      Object.assign(g, { ...createPongState(), left: { ...g.left }, right: { ...g.right } });
    }
    io.in(room).emit('pong state', room, g);
  }
}, 40);

http.listen(PORT, () => console.log("Server gestart op poort", PORT));
