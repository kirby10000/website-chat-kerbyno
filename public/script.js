// =====================
// SERVER MET CHAT & PONG
// =====================
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const users = {};
const userRooms = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
  // -- Chat registratie --
  socket.on('register', (name) => {
    users[socket.id] = { name };
    io.emit('all users', Object.values(users));
  });

  socket.on('get users', () => {
    socket.emit('all users', Object.values(users));
  });

  socket.on('get rooms', () => {
    const rooms = Object.keys(userRooms);
    socket.emit('joined room', rooms);
  });

  socket.on('join room', (room) => {
    socket.join(room);
    userRooms[room] = userRooms[room] || [];
    if (!userRooms[room].includes(socket.id)) userRooms[room].push(socket.id);
    socket.emit('joined room', Object.keys(userRooms));
  });

  socket.on('chat message', (msg) => {
    if (!users[socket.id]) return;
    let tab = msg.tab;
    let user = users[socket.id].name;
    let color = "#ff7f00";
    let text = msg.text;
    io.emit('chat message', { user, text, tab, color });
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) delete users[socket.id];
    Object.keys(userRooms).forEach(room => {
      userRooms[room] = userRooms[room].filter(id => id !== socket.id);
      if (userRooms[room].length === 0) delete userRooms[room];
    });
    io.emit('all users', Object.values(users));
    // PONG disconnect
    Object.keys(pongRooms).forEach(room => {
      let g = pongRooms[room];
      for (const r of ['left','right']) {
        if (g.players[r] === socket.id) g.players[r] = null;
      }
      if ((!g.players.left && !g.players.right) && g.interval) {
        clearInterval(g.interval);
        delete pongRooms[room];
      }
    });
  });

  // ========== PONG ==========
  socket.on('pong request', (room, partnerName) => {
    let targetId = Object.entries(users).find(([sid, u]) => u.name === partnerName)?.[0];
    if (targetId) {
      io.to(targetId).emit('pong request', room, users[socket.id].name);
    }
  });
  socket.on('pong accept', (room, partnerName) => {
    let targetId = Object.entries(users).find(([sid, u]) => u.name === partnerName)?.[0];
    if (targetId) {
      io.to(targetId).emit('pong accept', room, users[socket.id].name);
    }
  });

  socket.on('pong join', (room, role) => {
    socket.join(room);
    if (!pongRooms[room]) {
      pongRooms[room] = {
        room,
        left: { y: 90, score: 0 },
        right: { y: 90, score: 0 },
        ball: { x: 200, y: 125, vx: 3, vy: 2, radius: 9 },
        paddleH: 60,
        paddleW: 10,
        width: 400,
        height: 250,
        running: true,
        players: {},
        lastUpdate: Date.now()
      };
    }
    pongRooms[room].players[role] = socket.id;
    socket.emit('pong role', role);

    if (!pongRooms[room].interval) {
      pongRooms[room].interval = setInterval(() => updatePongRoom(room), 1000/60);
    }
    io.to(room).emit('pong start');
  });

  socket.on('pong move', (room, role, dir) => {
    let g = pongRooms[room];
    if (!g) return;
    let speed = 5;
    if (role === "left") g.left.y = Math.max(0, Math.min(g.height - g.paddleH, g.left.y + dir*speed));
    if (role === "right") g.right.y = Math.max(0, Math.min(g.height - g.paddleH, g.right.y + dir*speed));
  });
});

const pongRooms = {};
function updatePongRoom(room) {
  let g = pongRooms[room];
  if (!g || !g.running) return;
  g.ball.x += g.ball.vx;
  g.ball.y += g.ball.vy;
  if (g.ball.y < g.ball.radius || g.ball.y > g.height - g.ball.radius) g.ball.vy *= -1;
  if (
    g.ball.x - g.ball.radius < 10 + g.paddleW &&
    g.ball.y > g.left.y &&
    g.ball.y < g.left.y + g.paddleH
  ) {
    g.ball.vx = Math.abs(g.ball.vx);
  }
  if (
    g.ball.x + g.ball.radius > g.width-10-g.paddleW &&
    g.ball.y > g.right.y &&
    g.ball.y < g.right.y + g.paddleH
  ) {
    g.ball.vx = -Math.abs(g.ball.vx);
  }
  if (g.ball.x < 0) {
    g.right.score++; resetPongBall(g, -1);
  }
  if (g.ball.x > g.width) {
    g.left.score++; resetPongBall(g, +1);
  }
  io.to(room).emit('pong state', room, g);
}
function resetPongBall(g, dir) {
  g.ball.x = g.width/2;
  g.ball.y = g.height/2;
  g.ball.vx = (dir || (Math.random()<0.5?-1:1)) * (2.3 + Math.random()*2.2);
  g.ball.vy = (Math.random()<0.5?-1:1) * (2.0 + Math.random()*2.5);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server gestart op http://localhost:${PORT}`);
});
