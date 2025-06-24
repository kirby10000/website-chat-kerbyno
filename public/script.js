const socket = io();

const loginScreen = document.getElementById("loginScreen");
const enterChatBtn = document.getElementById("enterChat");
const usernameInput = document.getElementById("usernameInput");
const app = document.querySelector(".app");

const newRoomInput = document.getElementById("newRoomInput");
const createRoomBtn = document.getElementById("createRoom");
const roomList = document.getElementById("roomList");
const userList = document.getElementById("userList");

const chatTabs = document.getElementById("chatTabs");
const chatHeader = document.getElementById("chatHeader");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let username = null;
let activeTab = null;
const tabs = {};
const joinedRooms = new Set();

// Inloggen
enterChatBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  if (!name) return alert("Typ een naam in.");
  username = name;
  socket.emit("register", username);
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
  socket.emit("get users");
  socket.emit("get joined rooms");
});

// Groep maken of joinen
createRoomBtn.addEventListener("click", () => {
  const room = newRoomInput.value.trim();
  if (!room) return;
  socket.emit("join room", room);
  if (!tabs[room]) addChatTab(room);
  setActiveTab(room);
  newRoomInput.value = "";
});

// Bericht verzenden
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

// Tabs beheren
function addChatTab(name) {
  if (tabs[name]) return;
  tabs[name] = [];
  const tab = document.createElement("div");
  tab.classList.add("chat-tab");
  tab.textContent = name;
  tab.addEventListener("click", () => setActiveTab(name));
  chatTabs.appendChild(tab);
}

function setActiveTab(name) {
  activeTab = name;
  chatHeader.textContent = name;
  Array.from(chatTabs.children).forEach(tab => {
    tab.classList.toggle("active", tab.textContent === name);
  });
  renderMessages();
}

// Berichten tonen
function renderMessages() {
  messagesDiv.innerHTML = "";
  if (!tabs[activeTab]) return;
  tabs[activeTab].forEach(msg => {
    const div = document.createElement("div");
    div.classList.add("message");
    div.style.backgroundColor = msg.color || "#dbeeff";
    div.textContent = `${msg.user}: ${msg.text}`;
    messagesDiv.appendChild(div);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Gebruikerslijst
socket.on("all users", users => {
  userList.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.name;
    li.style.backgroundColor = u.color;
    li.addEventListener("click", () => {
      if (u.name === username) return;
      socket.emit("start private chat", u.name);
    });
    userList.appendChild(li);
  });
});

// Groepenlijst
socket.on("joined rooms", rooms => {
  roomList.innerHTML = "";
  rooms.forEach(room => {
    joinedRooms.add(room);
    const li = document.createElement("li");
    li.textContent = room;
    li.addEventListener("click", () => {
      if (!tabs[room]) addChatTab(room);
      setActiveTab(room);
    });
    roomList.appendChild(li);
  });
});

// Bericht ontvangen
socket.on("chat message", ({ tab, user, text, color }) => {
  if (!tabs[tab]) addChatTab(tab);
  tabs[tab].push({ user, text, color });
  if (tab === activeTab) renderMessages();
});

// Privéchat
socket.on("private chat started", (roomName, otherUser) => {
  if (!tabs[roomName]) addChatTab(roomName);
  setActiveTab(roomName);
  socket.emit("join room", roomName);
});
