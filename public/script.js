const socket = io();
let username = "";

while (!username) {
  username = prompt("Wat is je naam?");
}

// Stuur je naam naar de server
socket.emit("join", username);

// Bericht versturen
function sendMessage() {
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();
  if (msg !== "") {
    socket.emit("chat message", msg);
    input.value = "";
  }
}

// Ontvang een bericht
socket.on("chat message", ({ user, color, text }) => {
  const p = document.createElement("p");
  p.textContent = `${user}: ${text}`;
  p.style.backgroundColor = color;
  document.getElementById("messages").appendChild(p);
});

// Update gebruikerslijst
socket.on("update users", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";
  for (const user of users) {
    const li = document.createElement("li");
    li.textContent = user.name;
    li.style.backgroundColor = user.color;
    list.appendChild(li);
  }
});
