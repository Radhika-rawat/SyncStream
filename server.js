const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const rooms = {};

// ============================
// FILE UPLOAD SETUP
// ============================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {

    console.log("User Connected:", socket.id);
    // ============================
// VIDEO UPLOADED
// ============================

socket.on("video-uploaded", ({ path }) => {

    if (!socket.roomId) return;

    io.to(socket.roomId).emit("video-uploaded", path);

});

    // ============================
    // CREATE ROOM
    // ============================
    socket.on("create-room", ({ username }) => {

        const roomId = generateRoomId();

        rooms[roomId] = {
            users: [],
            videoType: "",
            videoUrl: "",
            currentTime: 0,
            isPlaying: false
        };

        rooms[roomId].users.push({
            socketId: socket.id,
            username
        });

        socket.join(roomId);

        socket.roomId = roomId;
        socket.username = username;

        socket.emit("room-created", {
            roomId
        });

        io.to(roomId).emit(
            "room-users",
            rooms[roomId].users
        );
    });

    // ============================
    // JOIN ROOM
    // ============================
    socket.on("join-room", ({ roomId, username }) => {

        roomId = roomId.toUpperCase();

        if (!rooms[roomId]) {

            socket.emit("join-error", {
                message: "Room not found."
            });

            return;
        }

        rooms[roomId].users.push({
            socketId: socket.id,
            username
        });

        socket.join(roomId);

        socket.roomId = roomId;
        socket.username = username;

        socket.emit("room-joined", {
            roomId
        });

        io.to(roomId).emit(
            "room-users",
            rooms[roomId].users
        );

        socket.to(roomId).emit(
            "user-joined",
            { username }
        );

        socket.emit(
            "room-state",
            rooms[roomId]
        );
    });

    // ============================
    // CHAT
    // ============================
    socket.on("chat-message", ({ message }) => {

        if (!socket.roomId) return;

        io.to(socket.roomId).emit(
            "chat-message",
            {
                username: socket.username,
                message
            }
        );
    });

    // ============================
    // OFFER
    // ============================
    socket.on("offer", (data) => {

        io.to(data.to).emit("offer", data);

    });

    // ============================
    // ANSWER
    // ============================
    socket.on("answer", (data) => {

        io.to(data.to).emit("answer", data);

    });

    // ============================
    // ICE
    // ============================
    socket.on("icecandidate", (data) => {

        io.to(data.to).emit(
            "icecandidate",
            {
                from: socket.id,
                candidate: data.candidate
            }
        );

    });

    // ============================
    // END CALL
    // ============================
    socket.on("end-call", (data) => {

        io.to(data.to).emit("end-call");

    });

    // ============================
    // YOUTUBE SYNC
    // ============================
    socket.on("sync-youtube-video", ({ videoId, timestamp }) => {

        if (!socket.roomId) return;

        rooms[socket.roomId].videoType = "youtube";
        rooms[socket.roomId].videoUrl = videoId;
        rooms[socket.roomId].currentTime = timestamp;

        io.to(socket.roomId).emit(
            "sync-youtube-video",
            {
                videoId,
                timestamp
            }
        );
    });

    socket.on("play-video", (timestamp) => {

        if (!socket.roomId) return;

        rooms[socket.roomId].isPlaying = true;
        rooms[socket.roomId].currentTime = timestamp;

        socket.to(socket.roomId).emit(
            "play-video",
            timestamp
        );
    });

    socket.on("pause-video", (timestamp) => {

        if (!socket.roomId) return;

        rooms[socket.roomId].isPlaying = false;
        rooms[socket.roomId].currentTime = timestamp;

        socket.to(socket.roomId).emit(
            "pause-video",
            timestamp
        );
    });

    socket.on("seek-video", (timestamp) => {

        if (!socket.roomId) return;

        rooms[socket.roomId].currentTime = timestamp;

        socket.to(socket.roomId).emit(
            "seek-video",
            timestamp
        );
    });

    // ============================
    // DISCONNECT
    // ============================
    socket.on("disconnect", () => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId]) return;

        rooms[roomId].users =
            rooms[roomId].users.filter(
                u => u.socketId !== socket.id
            );

        io.to(roomId).emit(
            "room-users",
            rooms[roomId].users
        );

        socket.to(roomId).emit(
            "user-disconnected",
            socket.username
        );

        if (rooms[roomId].users.length === 0) {
            delete rooms[roomId];
        }

        console.log("Disconnected:", socket.id);
    });

});

// ============================
// UPLOAD VIDEO API
// ============================

app.post("/upload", upload.single("video"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false
        });
    }

    res.json({
        success: true,
        videoUrl: "/uploads/" + req.file.filename
    });

});

server.listen(3000, () => {

    console.log("=================================");
    console.log("WatchParty Server Started");
    console.log("http://localhost:3000");
    console.log("=================================");

});