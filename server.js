const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();

const distPath = path.join(__dirname, 'dist');

// Tímto řekneš serveru, aby poslal soubory hry (ze složky dist) prohlížeči
app.use(express.static(distPath));

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

// Fallback pro SPA - pokud se nenajde soubor (např. při refresh), vrátí index.html
// Toto také vyřeší chybu "Cannot GET /", pokud existuje index.html
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('CHYBA: Soubor index.html nebyl nalezen ve složce dist. Spusťte "npm run build".');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server běží na portu ' + PORT);
});