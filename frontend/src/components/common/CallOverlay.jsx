// src/components/common/CallOverlay.jsx
// Full WebRTC in-app voice call between rider and driver
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../../context/SocketContext";

export default function CallOverlay({ rideId, myName, myRole }) {
  const { socket } = useSocket();
  const [callState, setCallState]     = useState("idle"); // idle|calling|ringing|active|ended
  const [remoteInfo, setRemoteInfo]   = useState(null);   // { name, role }
  const [muted, setMuted]             = useState(false);
  const [duration, setDuration]       = useState(0);

  const pcRef        = useRef(null);  // RTCPeerConnection
  const localStream  = useRef(null);
  const remoteAudio  = useRef(null);
  const timerRef     = useRef(null);
  const pendingCands = useRef([]);    // ICE candidates buffered before remoteDesc set

  // ── WebRTC helpers ──────────────────────────────────────
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket?.emit("iceCandidate", { rideId, candidate });
    };

    pc.ontrack = ({ streams }) => {
      if (remoteAudio.current) remoteAudio.current.srcObject = streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("active");
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        endCall(false);
      }
    };

    return pc;
  }, [socket, rideId]);

  const getMic = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.current = stream;
    return stream;
  };

  const addTracks = (pc, stream) => {
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  };

  // ── Initiate call ───────────────────────────────────────
  const startCall = async () => {
    try {
      const stream = await getMic();
      const pc = createPC();
      pcRef.current = pc;
      addTracks(pc, stream);

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      setCallState("calling");
      socket?.emit("callOffer", { rideId, offer, callerId: myRole, callerName: myName, callerRole: myRole });
    } catch (e) {
      alert("Microphone access needed for calls. Please allow mic access.");
      setCallState("idle");
    }
  };

  // ── Answer incoming call ────────────────────────────────
  const answerCall = async (offer) => {
    try {
      const stream = await getMic();
      const pc = createPC();
      pcRef.current = pc;
      addTracks(pc, stream);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Apply buffered candidates
      for (const c of pendingCands.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCands.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      setCallState("active");
      socket?.emit("callAnswer", { rideId, answer });
    } catch (e) {
      setCallState("idle");
    }
  };

  // ── End / reject call ───────────────────────────────────
  const endCall = useCallback((emitEvent = true) => {
    if (emitEvent) socket?.emit("callEnd", { rideId });

    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    pcRef.current?.close();
    pcRef.current = null;

    clearInterval(timerRef.current);
    setCallState("idle");
    setDuration(0);
    setRemoteInfo(null);
    pendingCands.current = [];
  }, [socket, rideId]);

  const rejectCall = () => {
    socket?.emit("callReject", { rideId });
    setCallState("idle");
    setRemoteInfo(null);
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => { t.enabled = muted; });
      setMuted(m => !m);
    }
  };

  const fmtDur = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Socket events ───────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ offer, callerName, callerRole }) => {
      setRemoteInfo({ name: callerName, role: callerRole });
      setCallState("ringing");
      // Auto-store offer to use when answering
      pcRef._pendingOffer = offer;
    };

    const onAnswered = async ({ answer }) => {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const c of pendingCands.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCands.current = [];
      }
    };

    const onIce = async ({ candidate }) => {
      if (pcRef.current?.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCands.current.push(candidate);
      }
    };

    const onEnded = () => endCall(false);
    const onRejected = () => { setCallState("idle"); setRemoteInfo(null); };

    socket.on("callIncoming",  onIncoming);
    socket.on("callAnswered",  onAnswered);
    socket.on("iceCandidate",  onIce);
    socket.on("callEnded",     onEnded);
    socket.on("callRejected",  onRejected);

    return () => {
      socket.off("callIncoming",  onIncoming);
      socket.off("callAnswered",  onAnswered);
      socket.off("iceCandidate",  onIce);
      socket.off("callEnded",     onEnded);
      socket.off("callRejected",  onRejected);
    };
  }, [socket, endCall]);

  // ── UI ──────────────────────────────────────────────────
  if (callState === "idle") {
    return (
      <>
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: "none" }} />
        <button onClick={startCall}
          style={{ flex: 1, padding: "10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, color: "var(--green)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📞 Call
        </button>
      </>
    );
  }

  // Fullscreen overlay for active call states
  return (
    <>
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: "none" }} />

      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, flexDirection: "column", gap: 24 }}>

        {/* Avatar */}
        <div style={{ width: 90, height: 90, borderRadius: "50%", background: "var(--accent-dim)", border: `3px solid ${callState === "active" ? "var(--green)" : "var(--accent)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, animation: callState !== "active" ? "pulse 1.5s infinite" : "none" }}>
          {remoteInfo?.role === "DRIVER" ? "👨" : "👩"}
        </div>

        {/* Name & status */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            {remoteInfo?.name || (callState === "calling" ? "Calling..." : myRole === "RIDER" ? "Driver" : "Rider")}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
            {callState === "calling"  && "📞 Calling..."}
            {callState === "ringing"  && "📲 Incoming call"}
            {callState === "active"   && `🔴 ${fmtDur(duration)}`}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
          {callState === "ringing" && (
            <CallBtn color="var(--green)" onClick={() => answerCall(pcRef._pendingOffer)}>✅ Answer</CallBtn>
          )}
          {callState === "active" && (
            <CallBtn color={muted ? "var(--red)" : "rgba(255,255,255,0.2)"} onClick={toggleMute}>
              {muted ? "🔇 Unmute" : "🎙️ Mute"}
            </CallBtn>
          )}
          <CallBtn color="var(--red)" onClick={() => callState === "ringing" ? rejectCall() : endCall()}>
            {callState === "ringing" ? "❌ Decline" : "📵 End"}
          </CallBtn>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,197,24,0.4)}50%{box-shadow:0 0 0 20px rgba(245,197,24,0)}}`}</style>
    </>
  );
}

const CallBtn = ({ children, onClick, color }) => (
  <button onClick={onClick}
    style={{ padding: "14px 28px", background: color, border: "none", borderRadius: 40, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", minWidth: 120 }}>
    {children}
  </button>
);
