const socket = io();

const loginScreen = document.getElementById("loginScreen");
const enterChatBtn = document.getElementById("enterChat");
const usernameInput = document.getElementById("usernameInput");
const app = document.querySelector(".app");

const newRoomInput = document.getElementById("newRoomInput");
const createRoomBtn = document.getElementById("createRoom");
const chatList = document.getElementById("chatList");

const chatHeader = document.getElementById("chatHeader");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let username = null;
let activeTab = null;
const tabs = {};
const joinedRooms = new Set();

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

createRoomBtn.addEventListener("click", () => {
  const room = newRoomInput.value.trim();
  if (!room) return;
  socket.emit("join room", room);
  if (!tabs[room]) addChatTab(room, true);
  setActiveTab(room);
  newRoomInput.value = "";
});

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

function addChatTab(name, isRoom = false, color = "#ccc") {
  if (tabs[name]) return;
  tabs[name] = [];
  const li = document.createElement("li");
  li.textContent = name;
  li.style.backgroundColor = color;
  li.dataset.name = name;
  li.classList.add("chat-item");
  li.addEventListener("click", () => setActiveTab(name));
  chatList.appendChild(li);
}

function setActiveTab(name) {
  activeTab = name;
  chatHeader.textContent = name;
  document.querySelectorAll(".chat-item").forEach(li => {
    li.classList.toggle("active", li.dataset.name === name);
  });
  renderMessages();
}

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

socket.on("all users", users => {
  users.forEach(u => {
    if (u.name === username) return;
    if (!tabs[u.name]) addChatTab(u.name, false, u.color);
  });
});

socket.on("joined rooms", rooms => {
  rooms.forEach(room => {
    joinedRooms.add(room);
    if (!tabs[room]) addChatTab(room, true);
  });
});

socket.on("chat message", ({ tab, user, text, color }) => {
  if (!tabs[tab]) addChatTab(tab, false, color);
  tabs[tab].push({ user, text, color });
  if (tab === activeTab) renderMessages();
});

socket.on("private chat started", (roomName, otherUser) => {
  if (!tabs[roomName]) addChatTab(roomName);
  setActiveTab(roomName);
  socket.emit("join room", roomName);
});
