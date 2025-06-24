const socket = io();
let username = "";
let activeTab = null;
const tabs = {};
let groups = [];

const loginScreen = document.getElementById("loginScreen");
const enterChat = document.getElementById("enterChat");
const usernameInput = document.getElementById("usernameInput");
const app = document.querySelector(".app");
const allUsersList = document.getElementById("allUsersList");
const newRoomInput = document.getElementById("newRoomInput");
const createRoomBtn = document.getElementById("createRoom");
const chatHeader = document.getElementById("chatHeader");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const groupsList = document.getElementById("groupsList");

// Login
enterChat.onclick = () => {
  const name = usernameInput.value.trim();
  if (!name) return;
  username = name;
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
  socket.emit("register", name);
  socket.emit("get users");
  socket.emit("get rooms");
};

// Groep aanmaken/joinen
createRoomBtn.onclick = () => {
  const room = newRoomInput.value.trim();
  if (!room) return;
  socket.emit("join room", room);
  newRoomInput.value = "";
};

// Enter om te versturen (Shift+Enter ondersteunt geen nieuwe regels)
messageInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// Verzenden knop
sendBtn.onclick = () => {
  const text = messageInput.value.trim();
  if (!text || !activeTab) return;
  socket.emit("chat message", { tab: activeTab, text });
  messageInput.value = "";
};

// Ontvang bericht
socket.on("chat message", (msg) => {
  if (!tabs[msg.tab]) tabs[msg.tab] = [];
  tabs[msg.tab].push(msg);
  if (msg.tab === activeTab) renderMessages();
  if (!groups.includes(msg.tab) && msg.tab !== username) {
    groups.push(msg.tab);
    renderGroups();
  }
});

// Ontvang gebruikerslijst
socket.on("all users", (users) => {
  allUsersList.innerHTML = "";
  users.forEach(u => {
    if (u.name === username) return;
    const li = document.createElement("li");
    li.classList.add("chat-item");
    li.textContent = u.name;
    li.onclick = () => {
      if (!tabs[u.name]) tabs[u.name] = [];
      switchTab(u.name);
    };
    allUsersList.appendChild(li);
  });
});

// Ontvang groepenlijst
socket.on("all rooms", (serverGroups) => {
  groups = serverGroups;
  renderGroups();
});

// Wissel van chat-tab
function switchTab(tab) {
  activeTab = tab;
  chatHeader.textContent = tab;
  renderMessages();
  if (!groups.includes(tab) && tab !== username) {
    groups.push(tab);
    renderGroups();
  }
}

// Groepen tonen
function renderGroups() {
  groupsList.innerHTML = "";
  groups.forEach(room => {
    const li = document.createElement("li");
    li.classList.add("chat-item");
    if (room === activeTab) li.classList.add("active");
    li.textContent = room;
    li.onclick = () => {
      if (!tabs[room]) tabs[room] = [];
      switchTab(room);
      socket.emit("join room", room);
    };
    groupsList.appendChild(li);
  });
}

// Berichten tonen
function renderMessages() {
  messagesDiv.innerHTML = "";
  if (!tabs[activeTab]) return;
  tabs[activeTab].forEach(msg => {
    const div = document.createElement("div");
    div.classList.add("message");

    const sender = document.createElement("div");
    sender.classList.add("sender");
    sender.textContent = msg.user;
    sender.style.color = msg.color || "#ff7f00";

    const content = document.createElement("div");
    content.textContent = msg.text;

    div.appendChild(sender);
    div.appendChild(content);
    messagesDiv.appendChild(div);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
