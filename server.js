// ✅ server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const users = {}; // socket.id => { name, color }
const userColors = {};
const colorList = [
  "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5856d6", "#af52de", "#ff2d55"
];

function getRandomColor() {
  return colorList[Math.floor(Math.random() * colorList.length)];
}

io.on("connection", (socket) => {
  socket.on("register", (name) => {
    const color = getRandomColor();
    users[socket.id] = { name, color };
    userColors[name] = color;
    io.emit("all users", Object.values(users));
  });

  socket.on("join room", (room) => {
    socket.join(room);
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
