const express = require('express');
const app = express();
require('dotenv/config');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const authRouter = require('./routers/auth');
const userRouter = require('./routers/user');
const messageRouter = require('./routers/message');
const fileRouter = require('./routers/file');
const http = require('http');
const { Server } = require('socket.io');

app.use(express.json());
app.use(cors());
app.use('/upload_dp', express.static(path.join(__dirname, '../frontend/public/upload_dp')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URL)
.then(() => {console.log('Connected to MongoDB');} )
.catch((err) => {console.log(err);} );
     
app.use('/api/auth', authRouter);
app.use('/api', userRouter);
app.use('/api', messageRouter);
app.use('/api', fileRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://real-time-chating-app-fullstack-1.onrender.com',
    methods: ['GET', 'POST'],
  },
});


let onlineUsers = {};

io.on('connection', (socket) => {
  socket.on('add-user', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('online-users', Object.keys(onlineUsers));
  });

  socket.on('send-msg', (data) => {
    const sendToSocket = onlineUsers[data.to];
    if (sendToSocket) {
      io.to(sendToSocket).emit('msg-receive', {
        from: data.from,
        message: data.message,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileName: data.fileName,
      });
    }
  });

  socket.on('message-read', (data) => {
    const sendToSocket = onlineUsers[data.from];
    if (sendToSocket) {
      io.to(sendToSocket).emit('msg-read', { from: data.to });
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, id] of Object.entries(onlineUsers)) {
      if (id === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('online-users', Object.keys(onlineUsers));
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port - ${process.env.FRONTEND_URL}`);
});

