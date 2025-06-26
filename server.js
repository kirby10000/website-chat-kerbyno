const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let users = new Map(); // socket.id -> {name}
let rooms = new Set(); // group names
let pongGames = {};    // roomname -> pongstate

function createPongState() {
  return {
    ball: { x: 200, y: 125, radius: 10, vx: 3, vy: 2 },
    left: { y: 100, score: 0 },
    right: { y: 100, score: 0 },
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
      io.to(data.tab).emit("chat message", msg);
    } else {
      // privéchat: tab is de naam van de ontvanger
      // zoek socket id van de ontvanger
      let receiverId = null;
      for (let [id, u] of users.entries()) {
        if (u.name === data.tab) receiverId = id;
      }
      // stuur bericht naar de ontvanger én naar jezelf
      if (receiverId) io.to(receiverId).emit("chat message", msg);
      socket.emit("chat message", msg);
    }
  });

  // ----- PONG EVENTS -----
  socket.on('pong request', (room, partner) => {
    socket.join(room);
    // Vind de socket van de partner
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
    paddle.y += dir * 15;
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
    // Score
    if (g.ball.x < 0) { g.right.score++; Object.assign(g, createPongState()); }
    if (g.ball.x > 400) { g.left.score++; Object.assign(g, createPongState()); }
    io.in(room).emit('pong state', room, g);
  }
}, 40);

http.listen(PORT, () => console.log("Server gestart op poort", PORT));
