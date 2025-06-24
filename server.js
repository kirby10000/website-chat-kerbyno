const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const users = {}; // socket.id => { name, color }
const pastelColors = [
  "#AEE4FF", "#BDF5D7", "#FFF5B7", "#FFD6C4", "#E6D6FF", "#FFC9DE"
];

function getRandomColor() {
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  socket.on("register", (name) => {
    users[socket.id] = { name, color: getRandomColor() };
    io.emit("all users", Object.values(users));
  });

  socket.on("join room", (room) => {
    socket.join(room);
    console.log(`${users[socket.id].name} heeft ${room} betreden`);
  });

  socket.on("chat message", ({ tab, text }) => {
    const user = users[socket.id];
    if (user && text.trim()) {
      io.emit("chat message", {
        tab,
        user: user.name,
        text,
        color: user.color
      });
    }
  });

  socket.on("get users", () => {
    socket.emit("all users", Object.values(users));
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("all users", Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
