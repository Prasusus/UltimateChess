const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // To umožní, aby se k serveru připojila tvoje hra z GitHubu
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Hráč připojen:', socket.id);

    // Když přijde tah od hráče, pošli ho všem ostatním
    socket.on('chess-move', (moveData) => {
        socket.broadcast.emit('chess-move', moveData);
    });

    socket.on('disconnect', () => {
        console.log('Hráč odpojen');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server běží na portu ' + PORT);
});