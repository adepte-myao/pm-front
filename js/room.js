let localStream;
let remoteStream;
let peerConnection;
let deviceId;

const servers = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
        }
    ]
}

let urlParams = new URLSearchParams(window.location.search);
let channelName = urlParams.get('room');

if (!channelName) {
    window.location = 'lobby.html';
}

let localTrack = []
let remoteUsers = {}

// let joinRoomInit = async () => {
//     join(roomID, uid);

//     on('user joined', processUserJoined)
//     on('user left', processUserLeft)

//     joinStream()
// }

// let joinStream = async (conn) => {
//     localTrack = await navigator.mediaDevices.getUserMedia(constraints);

//     let player = `
//     <div class="video__container" id="user-container-${uid}">
//         <video class="video-player" id="user-${uid}" autoplay playsinline></video>
//     </div>`;

//     document.getElementById('streams__container').insertAdjacentHTML('beforeend', player);

//     document.getElementById(`user-${uid}`).srcObject = localTrack;

//     localTrack.getTracks().forEach((track) => {
//         conn.addTrack(track, localTrack);
//     });
// }

// let processUserJoined = async (user, conn) => {
//     remoteUsers[user.id] = user;

    // let player = document.getElementById(`user-container-${user.id}`)
    // if (!player) {
    //     player = `
    //         <div class="video__container" id="user-container-${user.id}">
    //             <video class="video-player" id="user-${user.id}" autoplay playsinline></video>
    //         </div>`;

    //     document.getElementById('streams__container').insertAdjacentHTML('beforeend', player);
//     }

//     remoteStream = new MediaStream();

//     conn.ontrack = (event) => {
//         event.streams[0].getTracks().forEach((track) => {
//             remoteStream.addTrack(track);
//         });
//     }

//     document.getElementById(`user-${user.id}`).srcObject = remoteStream;
// }

// let processUserLeft = async (user) => {
//     delete remoteUsers[user.id];

//     document.getElementById(`user-conteiner-${user.id}`).remove()
// }



// joinRoomInit();

///////////////////////////////////

let init = async () => {
    let available = await navigator.mediaDevices.enumerateDevices();
    available = available.filter((info) => info.kind == 'videoinput')
    console.log(available);
    let cameraId = Math.round(Math.random()* (available.length-1));
    let deviceId = available[cameraId].deviceId;

    let constraints = {
        video: {
            deviceId : {exact: deviceId},
            width: {min: 640, ideal: 1920, max: 1920},
            height: {min: 480, ideal: 1080, max: 1080}
        }, 
        audio: true
    }

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("user-1").srcObject = localStream;

    initPeerConnecttion();

    await login();
    await joinChannel(channelName, handleMessage, remoteStream);

    await toggleMic();
}

let handleMessage = async (event) => {
    switch (event.actionType) {
        case "user joined":
            console.log("got message: ", event.actionType);
            await handleUserJoin(event);
            break;
        case "user left":
            console.log("got message: ", event.actionType);
            await handleUserLeft(event);
            break;
        case "message":
            await handleUserMessage(event);
            break;
        default:
            console.log("who are you, ", event.actionType);
    }
}
  
let handleUserJoin = async (eventData) => {
    let sentID = eventData.userID;
    let offer = await createOffer(peerConnection, sentID);
    await sendMessage(channelName, sentID, {messageType: 'offer', content: offer});
}

let handleUserLeft = async (eventData) => {
    document.getElementById("user-2").style.display = 'none'
    document.getElementById("user-1").classList.remove('smallFrame');
}

let handleUserMessage = async (eventData) => {
    console.log("got custom message: ", eventData.data.messageType);
    switch (eventData.data.messageType){
        case "offer":
            await handleOffer(eventData.data.content, eventData.userID);
            break;
        case "answer":
            await handleAnswer(eventData.data.content)
            break;
        case "candidate":
            await handleIceCandidate(eventData.data.content);
            break;
        default:
            console.log("user what did you sent me???");
    }
}

let handleOffer = async (offer, remoteID) => {
    console.log("handling offer");
    await peerConnection.setRemoteDescription({
            type: offer.type,
            sdp: offer.sdp
    });

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await sendMessage(channelName, remoteID, {messageType: 'answer', content: answer});

    document.getElementById("user-2").srcObject = remoteStream;
    document.getElementById("user-2").style.display = 'block';

    document.getElementById("user-1").classList.add('smallFrame');
}

let handleAnswer = async (answer) => {
    console.log("handling answer");
    console.log(answer);
    await peerConnection.setRemoteDescription({
        type: answer.type,
        sdp: answer.sdp
    });

    document.getElementById("user-2").srcObject = remoteStream;
    document.getElementById("user-2").style.display = 'block';

    document.getElementById("user-1").classList.add('smallFrame');
}

let handleIceCandidate = async (candidate) => {
    console.log(candidate);
    await peerConnection.addIceCandidate(candidate);
}

let initPeerConnecttion = async () => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {  
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        console.log(event)

        remoteStream.addTrack(event.track);
        console.log(remoteStream.getVideoTracks());
    }
}

let createOffer = async (peerConnection, sentID) => {
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            await sendMessage(channelName, sentID, {messageType: 'candidate', content: event.candidate});
        }
    }

    return offer;
}

let leave = async () => {
    leaveChannel(channelName);
    peerConnection.close();
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');

    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgba(255, 80, 80, 1.0)';
    } else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgba(26, 16, 128, .9)';
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');

    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgba(255, 80, 80, 1.0)';
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgba(26, 16, 128, .9)';
    }
}

window.addEventListener('beforeunload', leave);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();