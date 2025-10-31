const socket = io();

// ELEMENTS
const loginScreen = document.getElementById('loginScreen');
const usernameInput = document.getElementById('usernameInput');
const enterChat = document.getElementById('enterChat');
const app = document.querySelector('.app');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');
const chatHeader = document.getElementById('chatHeader');
const allUsersList = document.getElementById('allUsersList');
const groupsList = document.getElementById('groupsList');
const newRoomInput = document.getElementById('newRoomInput');
const createRoomBtn = document.getElementById('createRoom');
const pongContainer = document.querySelector('.pong-container');
const pongCanvas = document.getElementById('pongCanvas');
const pongCtx = pongCanvas.getContext('2d');
const pongInfo = document.querySelector('.pong-info');
const notifSound = document.getElementById('notifSound');

let username = '';
let currentTab = '';
let pongState = null;
let pongRole = '';

// LOGIN
enterChat.onclick = () => {
  const name = usernameInput.value.trim();
  if (!name) return;
  username = name;
  socket.emit('register', username);
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
};

usernameInput.addEventListener('keypress', e => { if(e.key==='Enter') enterChat.click(); });

// SEND CHAT
sendBtn.onclick = sendMessage;
messageInput.addEventListener('keypress', e => { if(e.key==='Enter') sendMessage(); });
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentTab) return;
  socket.emit('chat message', { tab: currentTab, text });
  messageInput.value = '';
}

// RENDER USERS
socket.on('all users', users => {
  allUsersList.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.name;
    li.classList.add('chat-item');
    li.onclick = () => selectTab(u.name);
    allUsersList.appendChild(li);
  });
});

// RENDER ROOMS
socket.on('joined room', rooms => {
  groupsList.innerHTML = '';
  rooms.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    li.classList.add('chat-item');
    li.onclick = () => selectTab(r);
    groupsList.appendChild(li);
  });
});

// CREATE ROOM
createRoomBtn.onclick = () => {
  const room = newRoomInput.value.trim();
  if (!room) return;
  socket.emit('join room', room);
  newRoomInput.value = '';
};

// SELECT TAB
function selectTab(tab) {
  currentTab = tab;
  chatHeader.textContent = tab;
  messages.innerHTML = '';
  pongContainer.classList.add('hidden');
  if (tab.startsWith('PONG-')) {
    pongContainer.classList.remove('hidden');
  }
}

// RECEIVE MESSAGE
socket.on('chat message', msg => {
  if (msg.tab !== currentTab) return; 
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<span class="sender">${msg.user}</span>${msg.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  if (Notification.permission==='granted') new Notification(`${msg.user}: ${msg.text}`);
  notifSound.play();
});

// ----- PONG -----
let keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; movePaddle(); });
document.addEventListener('keyup', e => { keys[e.key] = false; });

function movePaddle() {
  if (!pongRole) return;
  let dir = 0;
  if (keys['ArrowUp'] || keys['w']) dir=-1;
  if (keys['ArrowDown'] || keys['s']) dir=1;
  if (dir!==0) socket.emit('pong move', currentTab, pongRole, dir);
}

socket.on('pong state', (room, state) => {
  if (currentTab!==room) return;
  pongState = state;
  drawPong();
});

socket.on('pong role', role => pongRole=role);

function drawPong() {
  if (!pongState) return;
  const g = pongState;
  pongCtx.clearRect(0,0,pongCanvas.width,pongCanvas.height);
  pongCtx.fillStyle='black';
  pongCtx.fillRect(10,g.left.y,g.paddleW,g.paddleH);
  pongCtx.fillRect(pongCanvas.width-20,g.right.y,g.paddleW,g.paddleH);
  pongCtx.beginPath();
  pongCtx.arc(g.ball.x,g.ball.y,g.ball.radius,0,2*Math.PI);
  pongCtx.fillStyle='black';
  pongCtx.fill();
  pongInfo.textContent=`${g.left.score} : ${g.right.score}`;
}
