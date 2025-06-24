const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const users = {}; // socket.id => { name, color, rooms: Set }
const pastelColors = [
  "#AEE4FF", "#BDF5D7", "#FFF5B7", "#FFD6C4", "#E6D6FF", "#FFC9DE"
];

function getRandomColor() {
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

// Hulpfunctie om privé-kamernaam te maken (alfabetisch)
function makePrivateRoomName(u1, u2) {
  return [u1, u2].sort().join("_");
}

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  socket.on("register", (name) => {
    users[socket.id] = { name, color: getRandomColor(), rooms: new Set() };
    io.emit("all users", Object.values(users).map(u => ({ name: u.name, color: u.color })));
  });

  socket.on("join room", (room) => {
    if (!users[socket.id]) return;
    socket.join(room);
    users[socket.id].rooms.add(room);
    console.log(`${users[socket.id].name} heeft ${room} betreden`);
  });

  socket.on("leave room", (room) => {
    if (!users[socket.id]) return;
    socket.leave(room);
    users[socket.id].rooms.delete(room);
    console.log(`${users[socket.id].name} heeft ${room} verlaten`);
  });

  socket.on("chat message", ({ tab, text }) => {
    const user = users[socket.id];
    if (user && text.trim()) {
      // Stuur alleen naar die room
      io.to(tab).emit("chat message", {
        tab,
        user: user.name,
        text,
        color: user.color
      });
    }
  });

  // Maak een privé-chat tussen 2 gebruikers
  socket.on("start private chat", (otherUsername) => {
    const user = users[socket.id];
    if (!user) return;

    // Vind socket.id van andere gebruiker
    const otherSocketId = Object.keys(users).find(id => users[id].name === otherUsername);
    if (!otherSocketId) return;

    const roomName = makePrivateRoomName(user.name, otherUsername);

    // Join beide sockets in die room
    socket.join(roomName);
    users[socket.id].rooms.add(roomName);

    io.sockets.sockets.get(otherSocketId)?.join(roomName);
    users[otherSocketId].rooms.add(roomName);

    // Stuur naar deze client en andere dat ze de privé room hebben
    socket.emit("private chat started", roomName, otherUsername);
    io.to(otherSocketId).emit("private chat started", roomName, user.name);
  });

  socket.on("get users", () => {
    socket.emit("all users", Object.values(users).map(u => ({ name: u.name, color: u.color })));
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
