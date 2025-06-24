const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

const users = {}; // socket.id => { name, color }
const colorList = [
  "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5856d6", "#af52de", "#ff2d55"
];

function getRandomColor() {
  return colorList[Math.floor(Math.random() * colorList.length)];
}

io.on("connection", (socket) => {
  socket.join(socket.id); // Eigen room voor privéberichten
  socket.myRooms = new Set(); // Lokaal bijhouden welke rooms deze socket joined heeft

  socket.on("register", (name) => {
    const color = getRandomColor();
    users[socket.id] = { name, color };
    io.emit("all users", Object.values(users));
    // geen rooms sturen
  });

  socket.on("join room", (room) => {
    socket.join(room);
    socket.myRooms.add(room);
    socket.emit("joined room", Array.from(socket.myRooms)); // stuur alleen deze gebruiker zijn eigen rooms
  });

  socket.on("get rooms", () => {
    socket.emit("joined room", Array.from(socket.myRooms));
  });

  socket.on("chat message", ({ tab, text }) => {
    const user = users[socket.id];
    if (user && text.trim()) {
      const isPrivate = Object.values(users).some(u => u.name === tab);
      if (isPrivate) {
        const target = Object.entries(users).find(([sid, u]) => u.name === tab);
        if (target) {
          const [targetSocketId] = target;
          io.to(targetSocketId).emit("chat message", {
            tab: user.name,
            user: user.name,
            text,
            color: user.color
          });
          socket.emit("chat message", {
            tab: tab,
            user: user.name,
            text,
            color: user.color
          });
        }
      } else {
        io.to(tab).emit("chat message", {
          tab,
          user: user.name,
          text,
          color: user.color
        });
      }
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
