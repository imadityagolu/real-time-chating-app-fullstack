const express = require('express');
const app = express();
require('dotenv/config');
const cors = require('cors');
const mongoose = require('mongoose');
const authRouter = require('./routers/auth');
const userRouter = require('./routers/user');
const messageRouter = require('./routers/message');
const http = require('http');
const { Server } = require('socket.io');

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URL)
.then(() => {console.log('Connected to MongoDB');} )
.catch((err) => {console.log(err);} );
     
app.use('/api/auth', authRouter);
app.use('/api', userRouter);
app.use('/api', messageRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
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
  console.log(`Server is running on port - http://localhost:${process.env.PORT}`);
});

