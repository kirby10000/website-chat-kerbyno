const socket = io();
let username = "";

// Naam overlay logica
function submitUsername() {
  const input = document.getElementById("usernameInput");
  const name = input.value.trim();
  if (name) {
    username = name;
    document.getElementById("usernameOverlay").style.display = "none";
    socket.emit("join", username);
  }
}

// Enter voor naam
document.getElementById("usernameInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    submitUsername();
  }
});

// Bericht versturen met knop of enter
const messageInput = document.getElementById("messageInput");

function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg !== "") {
    socket.emit("chat message", msg);
    messageInput.value = "";
  }
}

messageInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// Berichten ontvangen
socket.on("chat message", ({ user, color, text }) => {
  const p = document.createElement("p");
  p.textContent = `${user}: ${text}`;
  p.style.backgroundColor = color;
  document.getElementById("messages").appendChild(p);
});

// Gebruikerslijst bijwerken
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
