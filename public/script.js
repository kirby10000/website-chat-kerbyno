const socket = io();
let username = "";
let activeTab = null;
const tabs = {};
let groups = [];
let allRooms = [];
let usernames = [];
const unreadCounts = {};
const deletedChats = new Set();

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
const notifSound = document.getElementById("notifSound");

// Notificatie geluid
function playNotification() {
  if (notifSound) {
    notifSound.currentTime = 0;
    notifSound.play();
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
  deletedChats.delete(room);
  socket.emit("join room", room);
  newRoomInput.value = "";
  if (!tabs[room]) tabs[room] = [];
  switchTab(room);
};

// Enter om te versturen
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
  if (deletedChats.has(activeTab)) return;
  socket.emit("chat message", { tab: activeTab, text });
  messageInput.value = "";
};

socket.on("all users", (users) => {
  usernames = users.map(u => u.name);
  renderUsers();
  renderGroups();
});

socket.on("joined room", (myRooms) => {
  allRooms = myRooms;
  renderGroups();
});

socket.on("chat message", (msg) => {
  if (deletedChats.has(msg.tab)) return;

  // Voor privé-chats: zorg dat de andere persoon in de gebruikerslijst staat
  // msg.tab is de naam van de andere persoon bij privé-chats
  if (!usernames.includes(msg.tab) && !allRooms.includes(msg.tab)) {
    // Nieuwe gebruiker ontdekt via privé-bericht, haal gebruikerslijst opnieuw op
    socket.emit("get users");
  }

  if (!tabs[msg.tab]) tabs[msg.tab] = [];
  tabs[msg.tab].push(msg);

  if (msg.tab === activeTab) {
    renderMessages();
    unreadCounts[msg.tab] = 0;
  } else {
    unreadCounts[msg.tab] = (unreadCounts[msg.tab] || 0) + 1;
    renderGroups();
    renderUsers();
    // Alleen melding als het niet je eigen bericht is:
    if (msg.user !== username) {
      playNotification();
      if (window.Notification && Notification.permission === "granted") {
        new Notification("Nieuw bericht in " + msg.tab, { body: msg.text });
      } else if (window.Notification && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }
});

function switchTab(tab) {
  if (deletedChats.has(tab)) return;
  activeTab = tab;
  chatHeader.textContent = tab;
  unreadCounts[tab] = 0;
  renderMessages();
  renderGroups();
  renderUsers();
  deletedChats.delete(tab);
  updatePongVisibility();
}

function createChatItem(name, isGroup = false) {
  if (deletedChats.has(name)) return document.createComment("verwijderde chat");

  const li = document.createElement("li");
  li.classList.add("chat-item");
  if (name === activeTab) li.classList.add("active");

  li.onclick = (e) => {
    if (
      e.target.closest(".chat-menu-btn") ||
      e.target.closest(".chat-menu") ||
      e.target.classList.contains("chat-menu-option")
    ) {
      return;
    }
    if (deletedChats.has(name)) return;
    if (!tabs[name]) tabs[name] = [];
    switchTab(name);
    if (isGroup) {
      deletedChats.delete(name);
      socket.emit("join room", name);
    }
    closeAllMenus();
  };

  const span = document.createElement("span");
  span.textContent = name;
  span.style.flex = "1";
  span.style.userSelect = "none";

  const badge = document.createElement("span");
  badge.className = "chat-unread-badge";
  if (unreadCounts[name] > 0) {
    badge.textContent = unreadCounts[name];
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  const menuBtn = document.createElement("button");
  menuBtn.className = "chat-menu-btn";
  menuBtn.innerHTML = "&#8942;";
  menuBtn.onclick = function(e) {
    e.stopPropagation();
    closeAllMenus();
    chatMenu.classList.toggle("active");
  };

  const chatMenu = document.createElement("div");
  chatMenu.className = "chat-menu";
  const removeOption = document.createElement("div");
  removeOption.className = "chat-menu-option";
  removeOption.textContent = "Chat verwijderen";
  removeOption.onclick = function(e) {
    e.stopPropagation();
    deletedChats.add(name);
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

function renderGroups() {
  groupsList.innerHTML = "";
  groups = allRooms.filter(room => !usernames.includes(room) && !deletedChats.has(room));
  groups.forEach(room => {
    const groupItem = createChatItem(room, true);
    if (groupItem) groupsList.appendChild(groupItem);
  });
}

function renderUsers() {
  allUsersList.innerHTML = "";
  usernames.forEach(name => {
    if (name === username) return;
    const userItem = createChatItem(name, false);
    if (userItem) allUsersList.appendChild(userItem);
  });
}

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

if (window.Notification && Notification.permission !== "granted") {
  Notification.requestPermission();
}

// ==================== PONG =========================

const pongContainer = document.querySelector('.pong-container');
const pongCanvas = document.getElementById('pongCanvas');
const pongInfo = document.querySelector('.pong-info');
const ctx = pongCanvas.getContext('2d');
let pongGame = null;
let pongInterval = null;
let pongRole = null;
let pongChatPartner = null;
let pongWanted = false;
let pongReady = false;
let pongRoom = null;
let pongYouInvited = false;

function resizePongCanvas() {
  const parent = pongContainer;
  if (!parent) return;
  let width = parent.offsetWidth * 0.95;
  let height = 250;
  width = Math.max(320, Math.min(width, 600));
  pongCanvas.width = Math.round(width);
  pongCanvas.height = Math.round(height);
}
window.addEventListener('resize', resizePongCanvas);

function updatePongVisibility() {
  if (typeof usernames === "undefined" || typeof activeTab === "undefined") return;
  if (activeTab && usernames.includes(activeTab)) {
    pongContainer.classList.remove('hidden');
    pongChatPartner = activeTab;
    pongRoom = pongGetRoomName();
    pongResetUI();
    setTimeout(() => { resizePongCanvas(); drawPong(); }, 50);
  } else {
    pongContainer.classList.add('hidden');
    stopPong();
    pongChatPartner = null;
    pongRoom = null;
  }
}

function pongGetRoomName() {
  if (!username || !pongChatPartner) return null;
  let ids = [username, pongChatPartner].sort();
  return 'pong_' + ids[0] + '_' + ids[1];
}

function pongResetUI() {
  pongWanted = false;
  pongReady = false;
  pongYouInvited = false;
  pongGame = null;
  pongRole = null;
  pongInfo.textContent = 'Klik om Pong te starten';
  pongContainer.classList.remove('pong-active');
  ctx.clearRect(0, 0, pongCanvas.width, pongCanvas.height);
}

pongContainer.addEventListener('click', function() {
  if (!pongChatPartner) return;
  if (pongReady) return;
  if (!pongWanted) {
    pongWanted = true;
    pongYouInvited = true;
    pongInfo.textContent = 'Wachten op tegenstander...';
    pongContainer.classList.add('pong-active');
    socket.emit('pong request', pongRoom, pongChatPartner);
    socket.emit('chat message', { tab: pongChatPartner, text: `${username} wil Pong spelen! Klik op het Pong-venster om te starten.` });
  }
});

socket.on('pong request', (room, partner) => {
  if (pongRoom !== room) return;
  if (pongWanted) {
    pongStart(partner, false);
    socket.emit('pong accept', room, partner);
  } else {
    pongInfo.textContent = `${partner} wil Pong spelen! Klik om te starten.`;
    pongContainer.classList.add('pong-active');
    pongYouInvited = false;
    pongContainer.onclick = function() {
      if (!pongReady) {
        pongWanted = true;
        pongContainer.classList.add('pong-active');
        pongInfo.textContent = 'Wachten op tegenstander...';
        pongStart(partner, false);
        socket.emit('pong accept', room, partner);
      }
    };
  }
});

socket.on('pong accept', (room, partner) => {
  if (pongRoom !== room) return;
  if (pongWanted && !pongReady) {
    pongStart(partner, true);
  }
});

function pongStart(otherName, youInvite) {
  pongReady = true;
  pongInfo.textContent = 'Spel gestart! Gebruik ↑/↓';
  pongContainer.classList.add('pong-active');
  pongContainer.onclick = null;
  if (youInvite) {
    pongRole = 'right';
  } else {
    pongRole = 'left';
  }
  socket.emit('pong join', pongRoom, pongRole);
  if (!pongInterval) pongInterval = setInterval(() => {
    if (pongGame) drawPong();
  }, 1000/60);
}

socket.on('pong state', (room, state) => {
  if (pongRoom === room) {
    pongGame = state;
    drawPong();
  }
});
socket.on('pong role', (role) => {
  pongRole = role;
});
socket.on('pong start', () => {
  pongInfo.textContent = 'Spel gestart! Gebruik ↑/↓';
});

// Gameover: show win/lose based on your role, then stop
socket.on('pong gameover', (room, winnerRole) => {
  if (pongRoom !== room) return;
  const youWin = pongRole && winnerRole === pongRole;
  pongInfo.textContent = youWin ? 'Je hebt gewonnen! 🎉' : 'Je hebt verloren. 😞';
  stopPong();
});

// Track welke keys ingedrukt zijn voor continue beweging
const pressedKeys = new Set();
let pongMoveInterval = null;

document.addEventListener('keydown', function(e){
  if (!pongGame || !pongRole || !pongReady) return;
  if (document.activeElement !== pongContainer && document.activeElement !== document.body) return;
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    if (pressedKeys.has(e.key)) return; // Al ingedrukt
    pressedKeys.add(e.key);
    // Eerste beweging direct
    socket.emit('pong move', pongRoom, pongRole, e.key === "ArrowUp" ? -1 : 1);
    // Continue beweging met interval
    if (pongMoveInterval) clearInterval(pongMoveInterval);
    pongMoveInterval = setInterval(() => {
      if (!pongGame || !pongRole || !pongReady) {
        clearInterval(pongMoveInterval);
        pongMoveInterval = null;
        pressedKeys.clear();
        return;
      }
      if (pressedKeys.has("ArrowUp")) socket.emit('pong move', pongRoom, pongRole, -1);
      if (pressedKeys.has("ArrowDown")) socket.emit('pong move', pongRoom, pongRole, 1);
    }, 20); // ~50 updates per seconde voor soepele beweging
  }
});

document.addEventListener('keyup', function(e){
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    pressedKeys.delete(e.key);
    if (pressedKeys.size === 0 && pongMoveInterval) {
      clearInterval(pongMoveInterval);
      pongMoveInterval = null;
    }
  }
});

function stopPong() {
  if (pongInterval) clearInterval(pongInterval);
  pongInterval = null;
  if (pongMoveInterval) clearInterval(pongMoveInterval);
  pongMoveInterval = null;
  pressedKeys.clear();
  pongGame = null;
  pongRole = null;
  pongReady = false;
  pongWanted = false;
  pongYouInvited = false;
  ctx.clearRect(0, 0, pongCanvas.width, pongCanvas.height);
  pongInfo.textContent = '';
  pongContainer.classList.remove('pong-active');
  pongContainer.onclick = null;
}

function drawPong() {
  if (!pongGame) return;
  resizePongCanvas();
  ctx.clearRect(0, 0, pongCanvas.width, pongCanvas.height);

  const w = pongCanvas.width;
  const h = pongCanvas.height;
  const scaleX = w / 400;
  const scaleY = h / 250;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  ctx.beginPath();
  ctx.arc(pongGame.ball.x, pongGame.ball.y, pongGame.ball.radius, 0, 2 * Math.PI);
  ctx.fillStyle = "#ff7f00";
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.fillRect(10, pongGame.left.y, pongGame.paddleW, pongGame.paddleH);
  ctx.fillRect(400-10-pongGame.paddleW, pongGame.right.y, pongGame.paddleW, pongGame.paddleH);

  ctx.font = "bold 28px Segoe UI";
  ctx.fillStyle = "#bbb";
  ctx.fillText(pongGame.left.score, 400/2-42, 40);
  ctx.fillText(pongGame.right.score, 400/2+24, 40);

  ctx.strokeStyle = "#eee";
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(400/2, 0);
  ctx.lineTo(400/2, 250);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

const origSwitchTab = switchTab;
switchTab = function(tab) {
  origSwitchTab(tab);
  updatePongVisibility();
};
if (typeof app !== "undefined" && app) {
  updatePongVisibility();
}
