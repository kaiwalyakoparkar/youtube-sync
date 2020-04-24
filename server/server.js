require("dotenv").config();
require("./models/dbInit");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const router = require("./routes/router");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
  updateDuration,
  setUrl,
  upvote
} = require("./controllers/users");

app
  .use(cors())
  .use(express.json())
  .use(express.urlencoded({ extended: true }));

io.on("connect", (socket) => {
  socket.on("join", ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });
    if (error) return callback(error);

    socket.join(user.room);

    socket.emit("message", {
      user: "admin",
      text: `${user.name}, welcome to room ${user.room}.`,
    });
    socket.broadcast
      .to(user.room)
      .emit("message", { user: "admin", text: `${user.name} has joined!` });

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    io.to(user.room).emit("adminCheck", { isAdmin: user.admin });

    socket.on("handlePlayPause", ({ playing, duration }, callback) => {
      console.log(socket.id);
      const user = getUser(socket.id);
      console.log(user);
      /*  if (!user.admin) return; */
      if (user.admin) {
        updateDuration(duration);
        io.to(user.room).emit("playerHandler", { playing, duration });
      }
      callback();
    })


    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit("message", { user: user.name, text: message });

    callback();
  });

  socket.on("sendUrl", ({ url, room }, callback) => {
    const user = getUser(socket.id);
    const { error, dbUrl } = setUrl({ url, room });
    if (error) return callback(error)
    io.to(room).emit("clientUrl", dbUrl);

    callback();
  });

  socket.on("upvote", ({ selUrl, room }, callback) => {

    const { name } = getUser(socket.id);
    const { error, dbUrl } = upvote({ selUrl, room });
    if (error) return callback(error)
    io.to(room).emit("upvoteToast", { name, selUrl });
    callback();
  });



  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("message", {
        user: "Admin",
        text: `${user.name} has left.`,
      });
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

app.use("/api", router);

app.use((req, res, next) => {
  const error = new Error(`${req.originalUrl} is not a route`);
  res.status(404);
  next(error);
});
app.use((error, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    error: error.message,
  });
});

server.listen(process.env.PORT || 5000, () =>
  console.log(`Server has started.`)
);
