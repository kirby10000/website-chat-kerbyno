const socket = io();

const loginScreen = document.getElementById("loginScreen");
const enterChatBtn = document.getElementById("enterChat");
const usernameInput = document.getElementById("usernameInput");
const app = document.querySelector(".app");

const newRoomInput = document.getElementById("newRoomInput");
const createRoomBtn = document.getElementById("createRoom");
const allUsersList = document.getElementById("allUsersList");

const chatTabs = document.getElementById("chatTabs");
const chatHeader = document.getElementById("chatHeader");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let username = null;
let activeTab = null; // naam van actieve chat tab
const tabs = {}; // tabnaam => array met berichten

// Start chat na naam invoer
enterChatBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("Typ alsjeblieft een naam in.");
    return;
  }
  username = name;
  socket.emit("register", username);

  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");

  socket.emit("get users");
});

// Nieuwe groep aanmaken
createRoomBtn.addEventListener("click", () => {
  const room = newRoomInput.value.trim();
  if (!room) return;
  if (tabs[room]) {
    alert("Deze groep bestaat al.");
    return;
  }
  tabs[room] = [];
  addChatTab(room);
  setActiveTab(room);
  socket.emit("join room", room);
  newRoomInput.value = "";
});

// Bericht sturen
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeTab) return;
  socket.emit("chat message", { tab: activeTab, text });
  messageInput.value = "";
}

// Maak chat tab aan in UI
function addChatTab(name) {
  if (tabs[name]) return; // tab bestaat al
  tabs[name] = [];
  const tab = document.createElement("div");
  tab.classList.add("chat-tab");
  tab.textContent = name;
  tab.addEventListener("click", () => setActiveTab(name));
  chatTabs.appendChild(tab);
}

// Activeer chat tab
function setActiveTab(name) {
  activeTab = name;
  chatHeader.textContent = name;
  Array.from(chatTabs.children).forEach(tab => {
    tab.classList.toggle("active", tab.textContent === name);
  });
  renderMessages();
}

// Toon berichten van actieve tab
function renderMessages() {
  messagesDiv.innerHTML = "";
  if (!activeTab || !tabs[activeTab]) {
    messagesDiv.textContent = "Geen chat geselecteerd.";
    return;
  }
  tabs[activeTab].forEach(msg => {
    const div = document.createElement("div");
    div.classList.add("message");
    div.style.backgroundColor = msg.color || "#dbeeff";
    div.textContent = `${msg.user}: ${msg.text}`;
    messagesDiv.appendChild(div);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Update gebruikerslijst
socket.on("all users", users => {
  allUsersList.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.name;
    li.style.backgroundColor = u.color || "#ccc";
    li.style.cursor = "pointer";
    li.title = "Klik om privéchat te starten";

    // Privéchat starten als je op een naam klikt
    li.addEventListener("click", () => {
      if (u.name === username) return; // Niet met jezelf
      socket.emit("start private chat", u.name);
    });

    allUsersList.appendChild(li);
  });
});

// Nieuwe chat berichten ontvangen
socket.on("chat message", ({ tab, user, text, color }) => {
  if (!tabs[tab]) {
    addChatTab(tab);
  }
  tabs[tab].push({ user, text, color });
  if (tab === activeTab) renderMessages();
});

// Privéchat is gestart (ontvangen van server)
socket.on("private chat started", (roomName, otherUsername) => {
  if (!tabs[roomName]) {
    addChatTab(roomName);
  }
  setActiveTab(roomName);
  socket.emit("join room", roomName);
});
