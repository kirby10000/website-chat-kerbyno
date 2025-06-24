const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const rooms = {}; // { roomName: { socketId: {name, color} } }

function randomColor() {
  const colors = ["#ff6666", "#66ccff", "#66ff99", "#ffcc66", "#cc99ff", "#ff99cc"];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  // Stuur lijst met bestaande rooms
  socket.emit("room list", Object.keys(rooms));

  socket.on("join", ({ username, room }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = {};
    rooms[room][socket.id] = { name: username, color: randomColor() };

    updateRoomUsers(room);

    socket.on("chat message", ({ room, text }) => {
      const user = rooms[room]?.[socket.id];
      if (user) {
        io.to(room).emit("chat message", {
          user: user.name,
          color: user.color,
          text,
        });
      }
    });

    socket.on("disconnect", () => {
      if (rooms[room]) {
        delete rooms[room][socket.id];
        if (Object.keys(rooms[room]).length === 0) {
          delete rooms[room]; // verwijder lege kamers
        } else {
          updateRoomUsers(room);
        }
      }
    });
  });

  function updateRoomUsers(room) {
    const users = Object.values(rooms[room] || {});
    io.to(room).emit("update users", users);
    io.emit("room list", Object.keys(rooms));
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
