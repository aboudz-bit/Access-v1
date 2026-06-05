let remoteVideoEl: HTMLVideoElement | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;

let pc: RTCPeerConnection | null = null;
let ws: WebSocket | null = null;

function attachRemote() {
  if (remoteVideoEl && remoteStream) {
    remoteVideoEl.srcObject = remoteStream;
  }
}

export function setRemoteVideoEl(el: HTMLVideoElement | null) {
  remoteVideoEl = el;
  attachRemote();
}

export function setLocalStream(stream: MediaStream | null) {
  localStream = stream;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function startWebRTC(sessionId: number, role: string) {
  stopWebRTC();

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${window.location.host}/api/ws?sessionId=${sessionId}&role=${encodeURIComponent(role)}`;
  ws = new WebSocket(url);

  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }

  pc.ontrack = (e) => {
    remoteStream = e.streams[0] ?? null;
    attachRemote();
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
    }
  };

  const isInitiator = role === "user";

  ws.onopen = () => {
    ws?.send(JSON.stringify({ type: "join" }));
  };

  ws.onmessage = async (ev) => {
    if (!pc) return;
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    try {
      if (msg.type === "ready" && isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws?.send(JSON.stringify({ type: "offer", sdp: offer }));
      } else if (msg.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws?.send(JSON.stringify({ type: "answer", sdp: answer }));
      } else if (msg.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.type === "ice" && msg.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    } catch (err) {
      console.error("WebRTC signaling error", err);
    }
  };
}

export function stopWebRTC() {
  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.close();
    pc = null;
  }
  if (ws) {
    ws.onmessage = null;
    ws.onopen = null;
    try {
      ws.close();
    } catch {
      // ignore
    }
    ws = null;
  }
  remoteStream = null;
}
