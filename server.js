const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let users = new Map(); // socket.id -> {name}
let rooms = new Set();

io.on('connection', socket=>{
    // REGISTER
    socket.on('register', name=>{
        users.set(socket.id,{name});
        sendUsers();
    });

    // GET USERS
    socket.on('get users', sendUsers);
    function sendUsers(){
        const uniqueUsers = [...new Set([...users.values()].map(u=>u.name))];
        io.emit('all users', uniqueUsers.map(name=>({name})));
    }

    // GET ROOMS
    socket.on('get rooms', ()=> socket.emit('joined room', Array.from(rooms)));

    // JOIN ROOM
    socket.on('join room', room=>{
        rooms.add(room);
        socket.join(room);
        io.emit('joined room', Array.from(rooms));
    });

    // CHAT MESSAGE
    socket.on('chat message', data=>{
        const sender = users.get(socket.id);
        if(!sender) return;
        const msg = { tab: data.tab, user: sender.name, text: data.text, color:'#ff7f00' };

        if(rooms.has(data.tab)){
            io.to(data.tab).emit('chat message', msg);
        } else {
            // PRIVÉ: naar ontvanger(s)
            let receiverSockets=[];
            for(let [id,u] of users.entries()){ if(u.name===data.tab && id!==socket.id) receiverSockets.push(id); }
            receiverSockets.forEach(id=> io.to(id).emit('chat message', msg));
            socket.emit('chat message', msg); // afzender
        }
    });

    socket.on('disconnect', ()=>{
        users.delete(socket.id);
        sendUsers();
    });
});

http.listen(PORT, ()=> console.log('Server gestart op poort', PORT));
