const socket = io();
let username = "";
let activeTab = null;
const tabs = {};         // { tabName: [messages] }
let groups = [];
let usernames = [];
const unreadCounts = {};
const deletedChats = new Set();

// DOM elementen
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

// ================= Notificaties =================
function playNotification() {
    if (notifSound) {
        notifSound.currentTime = 0;
        notifSound.play();
    }
}

// ================= Login =================
function startChat() {
    const name = usernameInput.value.trim();
    if (!name) return alert("Voer je naam in");
    username = name;
    socket.emit("register", username);
    socket.emit("get users");
    socket.emit("get rooms");

    // Verberg login, laat chat zien
    loginScreen.style.display = "none";
    app.classList.remove("hidden");
}

enterChat.addEventListener("click", startChat);
usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") startChat();
});

// ================= Chat =================
// Nieuwe groep aanmaken
createRoomBtn.onclick = () => {
    const room = newRoomInput.value.trim();
    if (!room) return;
    deletedChats.delete(room);
    socket.emit("join room", room);
    newRoomInput.value = "";
};

// Verzenden met Enter
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
    const msg = { tab: activeTab, text };
    socket.emit("chat message", msg);
    messageInput.value = "";
};

// ================= Socket Events =================
socket.on("all users", (users) => {
    // filter jezelf eruit
    usernames = users.map(u => u.name).filter(n => n !== username);
    renderUsers();
});

socket.on("joined room", (myRooms) => {
    groups = myRooms.filter(room => !deletedChats.has(room));
    renderGroups();
});

socket.on("chat message", (msg) => {
    if (deletedChats.has(msg.tab)) return;
    if (!tabs[msg.tab]) tabs[msg.tab] = [];
    tabs[msg.tab].push(msg);

    if (msg.tab === activeTab) {
        renderMessages();
        unreadCounts[msg.tab] = 0;
    } else {
        unreadCounts[msg.tab] = (unreadCounts[msg.tab] || 0) + 1;
        renderGroups();
        renderUsers();
        // notificatie alleen voor berichten van anderen
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

// ================= Tabs =================
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
        ) return;

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
    const chatMenu = document.createElement("div");
    chatMenu.className = "chat-menu";
    menuBtn.onclick = function(e) {
        e.stopPropagation();
        closeAllMenus();
        chatMenu.classList.toggle("active");
    };

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
    groups.forEach(room => {
        const groupItem = createChatItem(room, true);
        if (groupItem) groupsList.appendChild(groupItem);
    });
}

function renderUsers() {
    allUsersList.innerHTML = "";
    usernames.forEach(name => {
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

// ================= Notificatie permissie =================
if (window.Notification && Notification.permission !== "granted") {
    Notification.requestPermission();
}

// ================= PONG =================
// ... Je originele Pong code blijft hier, geen aanpassing nodig

// Update tab functie om Pong te tonen/verbergen
const origSwitchTab = switchTab;
switchTab = function(tab) {
    origSwitchTab(tab);
    updatePongVisibility();
};
if (typeof app !== "undefined" && app) {
    updatePongVisibility();
}
