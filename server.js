const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const rooms = {}; // { roomName: { socketId: {name, color} } }
const users = {}; // { socketId: {name, color, room} }

function randomColor() {
  const colors = ["#ff6666", "#66ccff", "#66ff99", "#ffcc66", "#cc99ff", "#ff99cc"];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  socket.on("join", ({ username, room }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = {};
    const color = randomColor();
    rooms[room][socket.id] = { name: username, color };
    users[socket.id] = { name: username, color, room };

    updateRoomUsers(room);

    socket.on("chat message", ({ room, text }) => {
      const user = rooms[room]?.[socket.id];
      if (user) {
        io.to(room).emit("chat message", {
          user: user.name,
          color: user.color,
          text,
          room,
          type: "room",
        });
      }
    });

    socket.on("private message", ({ toSocketId, text }) => {
      const fromUser = users[socket.id];
      const toUser = users[toSocketId];
      if (!fromUser || !toUser) return;
      // Stuur naar ontvanger en afzender voor weergave
      io.to(toSocketId).emit("private message", {
        from: fromUser.name,
        fromId: socket.id,
        toId: toSocketId,
        color: fromUser.color,
        text,
      });
      socket.emit("private message", {
        from: fromUser.name,
        fromId: socket.id,
        toId: toSocketId,
        color: fromUser.color,
        text,
      });
    });

    socket.on("disconnect", () => {
      if (rooms[users[socket.id]?.room]) {
        const room = users[socket.id].room;
        delete rooms[room][socket.id];
        delete users[socket.id];
        if (Object.keys(rooms[room]).length === 0) {
          delete rooms[room];
        } else {
          updateRoomUsers(room);
        }
      }
    });
  });

  socket.on("request all users", () => {
    const allUsers = [];
    for (const [roomName, roomUsers] of Object.entries(rooms)) {
      for (const [socketId, userData] of Object.entries(roomUsers)) {
        allUsers.push({ name: userData.name, room: roomName, socketId });
      }
    }
    socket.emit("all users", allUsers);
  });

  socket.on("request rooms", () => {
    socket.emit("room list", Object.keys(rooms));
  });

  socket.on("create room", (roomName) => {
    if (!rooms[roomName]) {
      rooms[roomName] = {};
      io.emit("room list", Object.keys(rooms));
    }
  });

  function updateRoomUsers(room) {
    const usersInRoom = Object.entries(rooms[room] || {}).map(([socketId, user]) => ({
      ...user,
      socketId,
    }));
    io.to(room).emit("update users", usersInRoom);
    io.emit("room list", Object.keys(rooms));
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
