const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const userMap = {}; // socketId -> { name, room, color }

function randomColor() {
  const colors = ["#ff6666", "#66ccff", "#66ff99", "#ffcc66", "#cc99ff", "#ff99cc"];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  socket.on("get rooms", () => {
    const uniqueRooms = [...new Set(Object.values(userMap).map(u => u.room))];
    socket.emit("room list", uniqueRooms);
  });

  socket.on("join", ({ username, room }) => {
    socket.join(room);
    const color = randomColor();
    userMap[socket.id] = { name: username, room, color };

    updateRoomUsers(room);

    socket.on("chat message", ({ room, text }) => {
      io.to(room).emit("chat message", {
        user: username,
        color,
        text
      });
    });

    socket.on("private message", ({ to, text }) => {
      const from = userMap[socket.id]?.name;
      if (from && to) {
        io.to(to).emit("private message", { from, text });
      }
    });

    socket.on("disconnect", () => {
      const info = userMap[socket.id];
      if (info) {
        delete userMap[socket.id];
        updateRoomUsers(info.room);
      }
    });
  });

  function updateRoomUsers(room) {
    const users = [];
    for (const [id, info] of Object.entries(userMap)) {
      if (info.room === room) {
        users.push({ id, name: info.name, color: info.color });
      }
    }
    io.to(room).emit("update users", users);
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`✅ Server draait op http://localhost:${PORT}`);
});
