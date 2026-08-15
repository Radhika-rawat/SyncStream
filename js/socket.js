// ======================================================
// WATCH PARTY CLIENT
// socket.js
// ======================================================

// ===============================
// SOCKET.IO
// ===============================

const socket = io();

// ===============================
// URL PARAMETERS
// ===============================

const params = new URLSearchParams(window.location.search);

const username =
    params.get("username") || "Guest";

const isHost =
    params.get("host") === "true";

let roomId =
    params.get("room") ||
    params.get("roomName") ||
    "";

const roomName = roomId;
// ===============================
// DOM
// ===============================

const roomCode =
    document.getElementById("roomCode");

const participantList =
    document.getElementById("participantList");

const localVideo =
    document.getElementById("localVideo");

const remoteVideo =
    document.getElementById("remoteVideo");

const youtubeInput =
    document.getElementById("youtubeUrlField");

const youtubePlayer =
    document.getElementById("youtubeVideoPlayer");

const loadYoutubeVideoButton =
    document.getElementById("loadYoutubeVideoButton");

const sendChatButton =
    document.getElementById("sendChatButton");

const chatInput =
    document.getElementById("chatInputField");

const chatMessages =
    document.getElementById("chatMessagesDisplay");

const muteButton =
    document.getElementById("muteCallButton");

const endCallButton =
    document.getElementById("endCallButton");

// ===============================
// VARIABLES
// ===============================

let localStream = null;

let peerConnection = null;

let currentPeer = null;

let muted = false;

// ===============================
// RTC CONFIG
// ===============================

const rtcConfiguration = {

    iceServers: [

        {

            urls:

            "stun:stun.l.google.com:19302"

        }

    ]

};

// ===============================
// START CAMERA
// ===============================

// ===============================
// START CAMERA
// ===============================

async function startCamera() {

    if (!navigator.mediaDevices) {
        alert("MediaDevices API is not supported.");
        return;
    }

    try {

        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream;

        localVideo.onloadedmetadata = () => {

            localVideo.play();

        };

        console.log("Camera Started");

    } catch (err) {

        console.error(err);

        alert("Camera Permission Denied");

    }

}
// ===============================
// ROOM DISPLAY
// ===============================

function updateRoomCode(code){

    roomId = code;

    if(roomCode){

        roomCode.innerHTML = code;

    }

}

// ===============================
// CREATE ROOM
// ===============================

function createRoom(){

    socket.emit(

        "create-room",

        {

            username

        }

    );

}

// ===============================
// JOIN ROOM
// ===============================

function joinRoom(){

    socket.emit(

        "join-room",

        {

            roomId,

            username

        }

    );

}

// ===============================
// PAGE LOAD
// ===============================

window.addEventListener("load", async () => {

    console.log("Page Loaded");

    await startCamera();

    console.log("Joining room...");

    if (isHost) {

        createRoom();

    } else {

        joinRoom();

    }

});
// ===============================
// ROOM CREATED
// ===============================

socket.on(

"room-created",

data=>{

    updateRoomCode(

        data.roomId

    );
history.replaceState(
    {},
    "",
    `vc.html?host=true&username=${encodeURIComponent(username)}&room=${data.roomId}`
);

roomId = data.roomId;

}

);

// ===============================
// ROOM JOINED
// ===============================

socket.on(

"room-joined",

data=>{

    updateRoomCode(

        data.roomId

    );

}

);

// ===============================
// JOIN ERROR
// ===============================

socket.on(

"join-error",

data=>{

    alert(

        data.message

    );

}

);

console.log("Socket.js loaded");
// ======================================================
// PARTICIPANTS
// ======================================================

socket.on("room-users", (users) => {

    if (!participantList) return;

    participantList.innerHTML = "";

    users.forEach((user) => {

        const item = document.createElement("div");

        item.className = "participant";

        if (user.username === username) {

            item.innerHTML = `
                <span class="online-dot"></span>
                <span>${user.username} (You)</span>
            `;

        } else {

            item.innerHTML = `
                <span class="online-dot"></span>
                <span>${user.username}</span>

                <button
                    class="callButton"
                    data-id="${user.socketId}">

                    📞

                </button>
            `;

        }

        participantList.appendChild(item);

    });

    // Attach click events to all call buttons

    document.querySelectorAll(".callButton").forEach((button) => {

        button.onclick = () => {

            const peerId = button.dataset.id;

            startCall(peerId);

        };

    });

});


// ======================================================
// USER JOINED
// ======================================================

socket.on("user-joined", (user) => {

    addSystemMessage(`${user.username} joined the room.`);

});


// ======================================================
// USER LEFT
// ======================================================

socket.on("user-disconnected", (name) => {

    addSystemMessage(`${name} left the room.`);

});


// ======================================================
// SEND CHAT
// ======================================================

function sendChat(){

    const message = chatInput.value.trim();

    if(message==="") return;

    socket.emit("chat-message",{

        message

    });

    chatInput.value="";

}

if(sendChatButton){

    sendChatButton.onclick = sendChat;

}

if(chatInput){

    chatInput.addEventListener("keydown",(e)=>{

        if(e.key==="Enter"){

            sendChat();

        }

    });

}


// ======================================================
// RECEIVE CHAT
// ======================================================

socket.on("chat-message",(data)=>{

    addChatMessage(

        data.username,

        data.message

    );

});


// ======================================================
// ADD CHAT MESSAGE
// ======================================================

function addChatMessage(sender,message){

    const div = document.createElement("div");

    div.innerHTML=

    `<strong>${sender}</strong><br>${message}`;

    chatMessages.appendChild(div);

    chatMessages.scrollTop=

    chatMessages.scrollHeight;

}


// ======================================================
// SYSTEM MESSAGE
// ======================================================

function addSystemMessage(message){

    const div=document.createElement("div");

    div.style.color="#35d07f";

    div.style.marginBottom="10px";

    div.innerHTML="📢 "+message;

    chatMessages.appendChild(div);

}
// ======================================================
// WEBRTC VIDEO CALLING
// ======================================================

// Create Peer Connection
function createPeerConnection(peerId) {

    currentPeer = peerId;

    peerConnection = new RTCPeerConnection(rtcConfiguration);

    // Add local stream tracks
    if (localStream) {

        localStream.getTracks().forEach(track => {

            peerConnection.addTrack(track, localStream);

        });

    }

    // Receive remote stream
    peerConnection.ontrack = (event) => {

        if (remoteVideo) {

            remoteVideo.srcObject = event.streams[0];

        }

    };

    // Send ICE candidates
    peerConnection.onicecandidate = (event) => {

        if (event.candidate) {

            socket.emit("icecandidate", {

                to: currentPeer,

                candidate: event.candidate

            });

        }

    };

    peerConnection.onconnectionstatechange = () => {

        console.log("Connection State:", peerConnection.connectionState);

    };

    return peerConnection;

}

// ======================================================
// START CALL
// ======================================================

async function startCall(peerId) {

    const pc = createPeerConnection(peerId);

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socket.emit("offer", {

        from: socket.id,

        to: peerId,

        offer: pc.localDescription

    });

}

// ======================================================
// RECEIVE OFFER
// ======================================================

socket.on("offer", async (data) => {

    const pc = createPeerConnection(data.from);

    await pc.setRemoteDescription(

        new RTCSessionDescription(data.offer)

    );

    const answer = await pc.createAnswer();

    await pc.setLocalDescription(answer);

    socket.emit("answer", {

        from: socket.id,

        to: data.from,

        answer: pc.localDescription

    });

});

// ======================================================
// RECEIVE ANSWER
// ======================================================

socket.on("answer", async (data) => {

    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(

        new RTCSessionDescription(data.answer)

    );

});

// ======================================================
// RECEIVE ICE CANDIDATE
// ======================================================

socket.on("icecandidate", async (data) => {

    if (!peerConnection) return;

    try {

        await peerConnection.addIceCandidate(

            new RTCIceCandidate(data.candidate)

        );

    }

    catch(err){

        console.error(err);

    }

});

// ======================================================
// END CALL
// ======================================================

function endCurrentCall(){

    if(peerConnection){

        peerConnection.close();

        peerConnection = null;

    }

    if(remoteVideo){

        remoteVideo.srcObject = null;

    }

}

if(endCallButton){

    endCallButton.onclick = ()=>{

        if(currentPeer){

            socket.emit("end-call",{

                to:currentPeer

            });

        }

        endCurrentCall();

    }

}

socket.on("end-call",()=>{

    endCurrentCall();

});

// ======================================================
// MUTE / UNMUTE
// ======================================================

if(muteButton){

    muteButton.onclick=()=>{

        if(!localStream) return;

        muted=!muted;

        localStream.getAudioTracks().forEach(track=>{

            track.enabled=!muted;

        });

        muteButton.innerHTML=

        muted ? "🔇 Unmute"

              : "🎤 Mute";

    }

};
// ======================================================
// YOUTUBE
// ======================================================

// Extract YouTube Video ID

function getYoutubeId(url){

    const regExp =

    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;

    const match = url.match(regExp);

    return match ? match[1] : null;

}


// ======================================================
// LOAD VIDEO BUTTON
// ======================================================

if(loadYoutubeVideoButton){

    loadYoutubeVideoButton.onclick=()=>{

        const url=

        youtubeInput.value.trim();

        const videoId=

        getYoutubeId(url);

        if(!videoId){

            alert("Invalid YouTube URL");

            return;

        }

        loadYoutubeVideo(videoId,0);

        socket.emit(

            "sync-youtube-video",

            {

                videoId,

                timestamp:0

            }

        );

    };

}


// ======================================================
// LOAD VIDEO
// ======================================================

function loadYoutubeVideo(videoId,time=0){

   youtubePlayer.src =
`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${location.origin}&autoplay=1&start=${Math.floor(time)}`;

}


// ======================================================
// RECEIVE VIDEO
// ======================================================

socket.on(

"sync-youtube-video",

(data)=>{

    loadYoutubeVideo(

        data.videoId,

        data.timestamp

    );

}

);


// ======================================================
// PLAY VIDEO
// ======================================================

socket.on(

"play-video",

(time)=>{

    youtubePlayer.contentWindow.postMessage(

        JSON.stringify({

            event:"command",

            func:"seekTo",

            args:[time,true]

        }),

        "*"

    );

    youtubePlayer.contentWindow.postMessage(

        JSON.stringify({

            event:"command",

            func:"playVideo"

        }),

        "*"

    );

}

);


// ======================================================
// PAUSE VIDEO
// ======================================================

socket.on(

"pause-video",

(time)=>{

    youtubePlayer.contentWindow.postMessage(

        JSON.stringify({

            event:"command",

            func:"seekTo",

            args:[time,true]

        }),

        "*"

    );

    youtubePlayer.contentWindow.postMessage(

        JSON.stringify({

            event:"command",

            func:"pauseVideo"

        }),

        "*"

    );

}

);


// ======================================================
// SEEK VIDEO
// ======================================================

socket.on(

"seek-video",

(time)=>{

    youtubePlayer.contentWindow.postMessage(

        JSON.stringify({

            event:"command",

            func:"seekTo",

            args:[time,true]

        }),

        "*"

    );

}

);


// ======================================================
// ROOM STATE
// ======================================================

socket.on(

"room-state",

(state)=>{

    if(

        state.videoType==="youtube"

        &&

        state.videoUrl

    ){

        loadYoutubeVideo(

            state.videoUrl,

            state.currentTime

        );

    }

}

);

// ======================================================
// LOCAL VIDEO UPLOAD
// ======================================================

// ======================================================
// VIDEO UPLOAD
// ======================================================

const uploadVideoInput =
    document.getElementById("uploadVideoInput");

const uploadVideoButton =
    document.getElementById("uploadVideoButton");

const uploadedVideoPlayer =
    document.getElementById("uploadedVideoPlayer");

if (uploadVideoButton) {

    uploadVideoButton.onclick = () => {

        uploadVideoInput.click();

    };

}

if (uploadVideoInput) {

    uploadVideoInput.onchange = async () => {

        const file = uploadVideoInput.files[0];

        if (!file) return;

        const formData = new FormData();

        formData.append("video", file);

        try {

            const response = await fetch("/upload", {

                method: "POST",

                body: formData

            });

            const result = await response.json();

            if (!result.success) {

                alert("Upload failed.");

                return;

            }

            uploadedVideoPlayer.src = result.videoUrl;

            uploadedVideoPlayer.style.display = "block";

            youtubePlayer.style.display = "none";

            uploadedVideoPlayer.load();

            socket.emit("video-uploaded", {

                path: result.videoUrl

            });

        } catch (err) {

            console.error(err);

            alert("Video upload failed.");

        }

    };

}


// ========================================
// Upload Button
// ========================================

if(uploadVideoButton){

    uploadVideoButton.onclick=()=>{

        uploadVideoInput.click();

    };

}


// ========================================
// Video Selected
// ========================================

if(uploadVideoInput){

    uploadVideoInput.onchange=()=>{

        const file=

            uploadVideoInput.files[0];

        if(!file) return;

        const url=

            URL.createObjectURL(file);

        uploadedVideoPlayer.src=url;

        uploadedVideoPlayer.style.display="block";

        youtubePlayer.style.display="none";

        uploadedVideoPlayer.load();

        socket.emit(

            "video-uploaded",

            {

                name:file.name

            }

        );

    };

}


// ========================================
// Receive Upload Event
// ========================================

socket.on("video-uploaded", (path) => {

    uploadedVideoPlayer.src = path;

    uploadedVideoPlayer.style.display = "block";

    youtubePlayer.style.display = "none";

    uploadedVideoPlayer.load();

});

// ======================================================
// FINAL INITIALIZATION
// ======================================================

// Connection Successful
socket.on("connect", () => {

    console.log("=================================");
    console.log("Connected to Server");
    console.log("Socket ID :", socket.id);
    console.log("=================================");

});

// Connection Error
socket.on("connect_error", (error) => {

    console.error("Connection Error:", error);

});

// Disconnected
socket.on("disconnect", () => {

    console.log("Disconnected from server.");

    if (remoteVideo) {

        remoteVideo.srcObject = null;

    }

});

// Reconnected
socket.io.on("reconnect", () => {

    console.log("Reconnected.");

    if (roomId) {

        socket.emit("join-room", {

            roomId,
            username

        });

    }

});

// ======================================================
// CLEANUP
// ======================================================

window.addEventListener("beforeunload", () => {

    // Stop camera

    if (localStream) {

        localStream.getTracks().forEach(track => {

            track.stop();

        });

    }

    // Close Peer Connection

    if (peerConnection) {

        peerConnection.close();

    }

});

// ======================================================
// DEBUG INFO
// ======================================================

console.log("=================================");
console.log("Watch Party Client Loaded");
console.log("Username :", username);
console.log("Room :", roomId);
console.log("Host :", isHost);
console.log("=================================");