const socket = io();
let username = '';
let currentTab = '';
let tabs = {}; // tab -> messages[]
let unreadCounts = {}; // tab -> #unread

// DOM
const loginScreen = document.getElementById('loginScreen');
const usernameInput = document.getElementById('usernameInput');
const enterChat = document.getElementById('enterChat');
const app = document.querySelector('.app');
const allUsersList = document.getElementById('allUsersList');
const groupsList = document.getElementById('groupsList');
const chatHeader = document.getElementById('chatHeader');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newRoomInput = document.getElementById('newRoomInput');
const createRoomBtn = document.getElementById('createRoom');
const notifSound = document.getElementById('notifSound');

enterChat.addEventListener('click', () => {
    const val = usernameInput.value.trim();
    if(!val) return alert('Voer je naam in');
    username = val;
    socket.emit('register', username);
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
});

createRoomBtn.addEventListener('click', () => {
    const room = newRoomInput.value.trim();
    if(!room) return;
    socket.emit('join room', room);
    newRoomInput.value = '';
});

// SEND MESSAGE
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => { if(e.key==='Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if(!text || !currentTab) return;
    socket.emit('chat message', { tab: currentTab, text });
    messageInput.value = '';
}

// RECEIVE USERS
socket.on('all users', users => {
    allUsersList.innerHTML = '';
    users.filter(u => u.name !== username).forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.name;
        li.className='chat-item';
        li.addEventListener('click', () => openTab(u.name));
        if(unreadCounts[u.name]) addBadge(li, unreadCounts[u.name]);
        allUsersList.appendChild(li);
    });
});

// RECEIVE ROOMS
socket.on('joined room', rooms => {
    groupsList.innerHTML = '';
    rooms.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        li.className='chat-item';
        li.addEventListener('click', () => openTab(r));
        if(unreadCounts[r]) addBadge(li, unreadCounts[r]);
        groupsList.appendChild(li);
    });
});

// RECEIVE MESSAGE
socket.on('chat message', msg => {
    if(!tabs[msg.tab]) tabs[msg.tab] = [];
    tabs[msg.tab].push(msg);

    // Badge
    if(currentTab!==msg.tab){
        unreadCounts[msg.tab] = (unreadCounts[msg.tab]||0)+1;
        updateBadges();
        notifSound.play();
    }

    if(currentTab===msg.tab) renderMessages();
});

// OPEN TAB
function openTab(tab){
    currentTab = tab;
    chatHeader.textContent = tab;
    if(!tabs[tab]) tabs[tab]=[];
    unreadCounts[tab]=0;
    updateBadges();
    renderMessages();
}

// RENDER MESSAGES
function renderMessages(){
    messagesDiv.innerHTML='';
    tabs[currentTab].forEach(m=>{
        const div = document.createElement('div');
        div.className='message';
        div.innerHTML=`<div class="sender">${m.user}</div>${m.text}`;
        messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// BADGES
function addBadge(li, count){
    let span = li.querySelector('.chat-unread-badge');
    if(!span){
        span = document.createElement('span');
        span.className='chat-unread-badge';
        li.appendChild(span);
    }
    span.textContent = count;
    span.style.display = count>0?'inline-block':'none';
}
function updateBadges(){
    document.querySelectorAll('.chat-item').forEach(li=>{
        const tab = li.textContent.replace(/\d+$/,'').trim();
        const count = unreadCounts[tab]||0;
        addBadge(li, count);
    });
}

// INITIAL DATA
socket.emit('get users');
socket.emit('get rooms');
