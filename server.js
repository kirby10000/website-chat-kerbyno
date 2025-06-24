const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const users = {};

function randomColor() {
  const colors = ["#ff6666", "#66ccff", "#66ff99", "#ffcc66", "#cc99ff", "#ff99cc"];
  return colors[Math.floor(Math.random() * colors.length)];
}

io.on("connection", (socket) => {
  console.log("Verbonden:", socket.id);

  socket.on("join", (name) => {
    users[socket.id] = { name, color: randomColor() };
    io.emit("update users", Object.values(users));
  });

  socket.on("chat message", (msg) => {
    const user = users[socket.id];
    if (user) {
      io.emit("chat message", {
        user: user.name,
        color: user.color,
        text: msg
      });
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("update users", Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
