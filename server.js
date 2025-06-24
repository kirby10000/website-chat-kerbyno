const express = require("express");
const app = express();
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

app.use(express.static("public"));

const users = {};
const pastelColors = [
  "#AEE4FF", "#BDF5D7", "#FFF5B7", "#FFD6C4", "#E6D6FF", "#FFC9DE"
];

function getRandomColor() {
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

function privateRoomName(a, b) {
  return [a, b].sort().join("_");
}

io.on("connection", socket => {
  socket.on("register", name => {
    users[socket.id] = { name, color: getRandomColor(), rooms: new Set() };
    io.emit("all users", Object.values(users).map(u => ({ name: u.name, color: u.color })));
  });

  socket.on("join room", room => {
    if (!users[socket.id]) return;
    socket.join(room);
    users[socket.id].rooms.add(room);
  });

  socket.on("chat message", ({ tab, text }) => {
    const user = users[socket.id];
    if (user && text.trim()) {
      io.to(tab).emit("chat message", {
        tab,
        user: user.name,
        text,
        color: user.color
      });
    }
  });

  socket.on("start private chat", otherUser => {
    const me = users[socket.id];
    if (!me) return;
    const otherId = Object.keys(users).find(id => users[id].name === otherUser);
    if (!otherId) return;
    const room = privateRoomName(me.name, otherUser);
    socket.join(room);
    users[socket.id].rooms.add(room);
    io.to(otherId).emit("private chat started", room, me.name);
    io.sockets.sockets.get(otherId)?.join(room);
    users[otherId].rooms.add(room);
    socket.emit("private chat started", room, otherUser);
  });

  socket.on("get users", () => {
    socket.emit("all users", Object.values(users).map(u => ({ name: u.name, color: u.color })));
  });

  socket.on("get joined rooms", () => {
    const user = users[socket.id];
    if (user) {
      socket.emit("joined rooms", Array.from(user.rooms));
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("all users", Object.values(users).map(u => ({ name: u.name, color: u.color })));
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
