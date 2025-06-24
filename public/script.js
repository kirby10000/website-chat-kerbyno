const socket = io();
let username = "";
let activeTab = null;
const tabs = {};
let groups = [];
let usernames = [];

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

// Ontvang alleen JOUW groepen
socket.on("joined room", (myRooms) => {
  groups = myRooms.filter(room => !usernames.includes(room));
  renderGroups();
});

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

// Gebruikerslijst en usernames bijwerken
socket.on("all users", (users) => {
  usernames = users.map(u => u.name);
  allUsersList.innerHTML = "";
  users.forEach(u => {
    if (u.name === username) return;
    allUsersList.appendChild(createChatItem(u.name, false));
  });
});

// Berichten ontvangen
socket.on("chat message", (msg) => {
  if (!tabs[msg.tab]) tabs[msg.tab] = [];
  tabs[msg.tab].push(msg);
  if (msg.tab === activeTab) renderMessages();
  // Alleen kamer toevoegen aan groepen als het GEEN gebruikersnaam is:
  if (!groups.includes(msg.tab) && !usernames.includes(msg.tab)) {
    groups.push(msg.tab);
    renderGroups();
  }
});

// Chat-tab wisselen
function switchTab(tab) {
  activeTab = tab;
  chatHeader.textContent = tab;
  renderMessages();
}

// Chat-item (gebruikt voor zowel gebruikers als groepen)
function createChatItem(name, isGroup = false) {
  const li = document.createElement("li");
  li.classList.add("chat-item");
  if (name === activeTab) li.classList.add("active");

  // Naam (links)
  const span = document.createElement("span");
  span.textContent = name;
  span.style.flex = "1";
  span.style.cursor = "pointer";
  span.onclick = (e) => {
    if (!tabs[name]) tabs[name] = [];
    switchTab(name);
    if (isGroup) socket.emit("join room", name);
    closeAllMenus();
    e.stopPropagation();
  };

  // 3-stipjes knop (rechts)
  const menuBtn = document.createElement("button");
  menuBtn.className = "chat-menu-btn";
  menuBtn.innerHTML = "&#8942;";
  menuBtn.onclick = function(e) {
    e.stopPropagation();
    closeAllMenus();
    chatMenu.classList.toggle("active");
  };

  // Opties-menu
  const chatMenu = document.createElement("div");
  chatMenu.className = "chat-menu";

  // Chat verwijderen optie
  const removeOption = document.createElement("div");
  removeOption.className = "chat-menu-option";
  removeOption.textContent = "Chat verwijderen";
  removeOption.onclick = function(e) {
    e.stopPropagation();
    if (isGroup) {
      groups = groups.filter(g => g !== name);
      renderGroups();
    }
    delete tabs[name];
    if (activeTab === name) {
      activeTab = null;
      chatHeader.textContent = "Geen chat geselecteerd";
      messagesDiv.innerHTML = "";
    }
    closeAllMenus();
  };

  chatMenu.appendChild(removeOption);

  // Samenstellen
  li.appendChild(span);
  li.appendChild(menuBtn);
  li.appendChild(chatMenu);

  // Sluit menu bij verlaten
  li.addEventListener("mouseleave", closeAllMenus);

  return li;
}

function closeAllMenus() {
  document.querySelectorAll(".chat-menu.active").forEach(menu => menu.classList.remove("active"));
}

// Groepen tonen
function renderGroups() {
  groupsList.innerHTML = "";
  groups.forEach(room => {
    groupsList.appendChild(createChatItem(room, true));
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
