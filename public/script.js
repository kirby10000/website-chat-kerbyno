const socket = io();
let username="", currentTab=null;
let chatHistory={}, unread={}, usersList=[], groupsListArr=[];

const loginScreen=document.getElementById('loginScreen');
const usernameInput=document.getElementById('usernameInput');
const enterChat=document.getElementById('enterChat');
const app=document.querySelector('.app');
const allUsersList=document.getElementById('allUsersList');
const groupsList=document.getElementById('groupsList');
const messages=document.getElementById('messages');
const chatHeader=document.getElementById('chatHeader');
const messageInput=document.getElementById('messageInput');
const sendBtn=document.getElementById('sendBtn');
const notifSound=document.getElementById('notifSound');

// LOGIN
enterChat.onclick=()=>{
  const name=usernameInput.value.trim();
  if(!name) return;
  username=name;
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  socket.emit('register', name);
  socket.emit('get users');
  socket.emit('get rooms');
};

// CREATE ROOM
document.getElementById('createRoom').onclick=()=>{
  const room=document.getElementById('newRoomInput').value.trim();
  if(!room) return;
  socket.emit('join room', room);
  document.getElementById('newRoomInput').value='';
};

// SEND MESSAGE
sendBtn.onclick=sendMessage;
messageInput.addEventListener('keydown', e=>{
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); }
});

function sendMessage(){
  const text=messageInput.value.trim();
  if(!text||!currentTab) return;
  socket.emit('chat message',{tab:currentTab,text});
  messageInput.value='';
}

// SOCKET EVENTS
socket.on('all users', users=>{
  usersList=users.map(u=>u.name).filter(u=>u!==username);
  renderUsers();
});

socket.on('joined room', rooms=>{
  groupsListArr=rooms.filter(r=>!usersList.includes(r));
  renderGroups();
});

socket.on('chat message', msg=>{
  if(!chatHistory[msg.tab]) chatHistory[msg.tab]=[];
  chatHistory[msg.tab].push(msg);

  if(msg.tab!==currentTab){
    unread[msg.tab]=(unread[msg.tab]||0)+1;
    updateBadge(msg.tab);
    if(msg.user!==username) notifSound.play();
    return;
  }
  appendMessage(msg);
  unread[msg.tab]=0;
  updateBadge(msg.tab);
});

// RENDER USERS & GROUPS
function renderUsers(){
  allUsersList.innerHTML='';
  usersList.forEach(u=>{
    const li=document.createElement('li');
    li.className='chat-item';
    li.textContent=u;
    li.onclick=()=>selectTab(u);
    const badge=document.createElement('span');
    badge.className='chat-unread-badge';
    li.appendChild(badge);
    allUsersList.appendChild(li);
  });
}

function renderGroups(){
  groupsList.innerHTML='';
  groupsListArr.forEach(r=>{
    const li=document.createElement('li');
    li.className='chat-item';
    li.textContent=r;
    li.onclick=()=>selectTab(r);
    const badge=document.createElement('span');
    badge.className='chat-unread-badge';
    li.appendChild(badge);
    groupsList.appendChild(li);
  });
}

function updateBadge(tab){
  const all=[...allUsersList.children,...groupsList.children];
  all.forEach(li=>{
    if(li.firstChild.textContent===tab){
      const badge=li.querySelector('.chat-unread-badge');
      badge.textContent=unread[tab]||'';
      badge.style.display=unread[tab]? 'inline-block':'none';
    }
  });
}

// SELECT TAB
function selectTab(tab){
  currentTab=tab;
  chatHeader.textContent=tab;
  messages.innerHTML='';
  if(chatHistory[tab]) chatHistory[tab].forEach(appendMessage);
  unread[tab]=0; updateBadge(tab);
}

// APPEND MESSAGE
function appendMessage(msg){
  const div=document.createElement('div');
  div.className='message';
  div.innerHTML=`<span class="sender">${msg.user}</span>${msg.text}`;
  messages.appendChild(div);
  messages.scrollTop=messages.scrollHeight;
}
