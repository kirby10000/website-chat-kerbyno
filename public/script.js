const socket = io();
let username = "";
let activeTab = null;
const tabs = {};
let groups = [];
let usernames = [];
const unreadCounts = {};
const deletedChats = new Set(); // <- NIEUW: bijhouden welke chats verwijderd zijn

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

// Audio notificatie
function playNotification() {
  const audio = document.getElementById("notifSound");
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

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
  // Bij opnieuw toevoegen: uit deleted halen!
  deletedChats.delete(room);
  socket.emit("join room", room);
  newRoomInput.value = "";
};

// Alleen JOUW groepen ontvangen
socket.on("joined room", (myRooms) => {
  groups = myRooms.filter(room => !usernames.includes(room) && !deletedChats.has(room));
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
  // Als chat verwijderd is, mag je niet verzenden
  if (deletedChats.has(activeTab)) return;
  socket.emit("chat message", { tab: activeTab, text });
  messageInput.value = "";
};

// Gebruikerslijst en usernames bijwerken
socket.on("all users", (users) => {
  usernames = users.map(u => u.name);
  renderUsers();
});

// Berichten ontvangen + ongelezen badge + melding
socket.on("chat message", (msg) => {
  // Als chat verwijderd is, negeer bericht
  if (deletedChats.has(msg.tab)) return;

  if (!tabs[msg.tab]) tabs[msg.tab] = [];
  tabs[msg.tab].push(msg);

  if (msg.tab === activeTab) {
    renderMessages();
    unreadCounts[msg.tab] = 0; // alles gelezen
  } else {
    unreadCounts[msg.tab] = (unreadCounts[msg.tab] || 0) + 1;
    renderGroups();
    renderUsers();
    playNotification();

    // Browser notificatie
    if (window.Notification && Notification.permission === "granted") {
      new Notification("Nieuw bericht in " + msg.tab, { body: msg.text });
    } else if (window.Notification && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
});

// Chat-tab wisselen
function switchTab(tab) {
  // Als chat verwijderd is, mag je niet openen
  if (deletedChats.has(tab)) return;
  activeTab = tab;
  chatHeader.textContent = tab;
  unreadCounts[tab] = 0;
  renderMessages();
  renderGroups();
  renderUsers();
  // Als het een chat was die eerder verwijderd was en je joint hem opnieuw: niet meer verwijderd
  deletedChats.delete(tab);
}

// Chat-item (gebruikt voor zowel gebruikers als groepen)
function createChatItem(name, isGroup = false) {
  // Als chat verwijderd is, niet tonen
  if (deletedChats.has(name)) return document.createComment("verwijderde chat");

  const li = document.createElement("li");
  li.classList.add("chat-item");
  if (name === activeTab) li.classList.add("active");

  // Naam (links)
  const span = document.createElement("span");
  span.textContent = name;
  span.style.flex = "1";
  span.style.cursor = "pointer";
  span.onclick = (e) => {
    if (deletedChats.has(name)) return; // niet openen!
    if (!tabs[name]) tabs[name] = [];
    switchTab(name);
    if (isGroup) {
      // Bij opnieuw openen via groep: verwijder uit deleted
      deletedChats.delete(name);
      socket.emit("join room", name);
    }
    closeAllMenus();
    e.stopPropagation();
  };

  // Ongelezen badge (rechts van naam)
  const badge = document.createElement("span");
  badge.className = "chat-unread-badge";
  if (unreadCounts[name] > 0) {
    badge.textContent = unreadCounts[name];
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

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
  const removeOption = document.createElement("div");
  removeOption.className = "chat-menu-option";
  removeOption.textContent = "Chat verwijderen";
  removeOption.onclick = function(e) {
    e.stopPropagation();
    // Voeg toe aan verwijderlijst
    deletedChats.add(name);
    // Haal uit groepen/tabbladen en ongelezen
    if (isGroup) {
      groups = groups.filter(g => g !== name);
      renderGroups();
    }
    delete tabs[name];
    delete unreadCounts[name];
    if (activeTab === name) {
      activeTab = null;
      chatHeader.textContent = "Geen chat geselecteerd";
      messagesDiv.innerHTML = "";
    }
    renderGroups();
    renderUsers();
    closeAllMenus();
  };
  chatMenu.appendChild(removeOption);

  // Samenstellen
  li.appendChild(span);
  li.appendChild(badge);
  li.appendChild(menuBtn);
  li.appendChild(chatMenu);

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
    const groupItem = createChatItem(room, true);
    if (groupItem) groupsList.appendChild(groupItem);
  });
}

// Gebruikers tonen (met badge)
function renderUsers() {
  allUsersList.innerHTML = "";
  usernames.forEach(name => {
    if (name === username) return;
    const userItem = createChatItem(name, false);
    if (userItem) allUsersList.appendChild(userItem);
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

// Vraag bij starten om notificatie rechten
if (window.Notification && Notification.permission !== "granted") {
  Notification.requestPermission();
}
