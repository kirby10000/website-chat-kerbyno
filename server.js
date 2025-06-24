// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Een gebruiker is verbonden.");

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg); // Stuur naar iedereen
  });

  socket.on("disconnect", () => {
    console.log("Een gebruiker is weg.");
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});
