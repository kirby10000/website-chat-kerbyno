const socket = io();

const messages = document.getElementById("messages");
const input = document.getElementById("messageInput");

function sendMessage() {
  const msg = input.value.trim();
  if (msg !== "") {
    socket.emit("chat message", msg);
    input.value = "";
  }
}

socket.on("chat message", (msg) => {
  const p = document.createElement("p");
  p.textContent = msg;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
});
