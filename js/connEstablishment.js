
const uuidValidator = /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i

// const signalingHost = "http://109.123.154.206/stage/peer-messenger"
const signalingHost = "http://localhost:8080"

// let uid = sessionStorage.getItem('uid');
// if (!uid || !uid.match(uuidValidator)) {
//     uid = self.crypto.randomUUID();
//     sessionStorage.setItem('uid', uid)
// }

let uid = self.crypto.randomUUID();

let user = {
    userID: uid,
    passHash: "abcde"
}

let token;
let subscriptionID;

let login = async () => {
    let response = await fetch(signalingHost+"/login", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify(user)
    });
    if (!response.ok) {
        console.log(response.status);
        return
    }
    
    let result = await response.json();
    token = result.token;
    console.log("token is here: ", token);
}

let joinChannel = async (channelName, messageHandler, remoteStream) => {
    let response = await fetch(signalingHost+"/channel/join", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': token
        },
        body: JSON.stringify({
            channelName: channelName
        })
    })
    if (!response.ok) {
        console.log(response.status);
        return
    }

    let result = await response.json();
    subscriptionID = result.subscriptionID
    console.log("subscriptionID is here: ", subscriptionID);

    collectAsync(messageHandler);
    sendMetricResolution(channelName, remoteStream);
}

let leaveChannel = async (channelName) => {
    let response = await fetch(signalingHost+"/channel/leave", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': token
        },
        body: JSON.stringify({
            channelName: channelName
        })
    })
    if (!response.ok) {
        console.log(response.status);
        return
    }

    let result = await response.json();
    if (result.status != "OK") {
        console.log(result.status)
    }
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

let collectAsync = async (messageHandler) => { 
    let url = signalingHost+"/channel/collect?subscriptionID=" + subscriptionID;
    let req = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': token
        },
    }
    while (true) {
        await delay(1000);

        let response = await fetch(url, req);
        if (!response.ok) {
            console.log(response.status);
            continue;
        }

        let result = await response.json();
        if (!result.entities || result.entities.length == 0) {
            continue;
        }
        result.entities.forEach(entity => {
            messageHandler(entity);
        });
    }
    
}

let sendMetricResolution = async (channelName, remoteStream) => {
    let url = signalingHost+"/metrics/resolution";
    let req = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
        },
        
    }

    while (true) {
        await delay(1000);
        let tracks = remoteStream.getVideoTracks();
        if (!tracks || !tracks[0]) {
            continue;
        }

        let dto = tracks[0].getSettings();
        dto.roomName = channelName;

        req.body = JSON.stringify(dto);

        let response = await fetch(url, req);
        if (!response.ok) {
            console.log(response.status);
            continue;
        }
    }
}

let sendMessage = async (channelName, sentUserID, message) => {
    let response = await fetch(signalingHost+"/peer/send", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': token
        },
        body: JSON.stringify({
            channelName: channelName,
            destinationUserID: sentUserID,
            message: message
        })
    })
    if (!response.ok) {
        console.log(response.status);
        return
    }

    console.log("message sent!")
}