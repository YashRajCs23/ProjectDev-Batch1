// src/components/common/CallOverlay.jsx
// FIXED: separate pendingOfferRef, works on both rider and driver sides
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";

export default function CallOverlay({ rideId, myRole }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const myName = user?.name || myRole;

  const [callState, setCallState]   = useState("idle"); // idle|calling|ringing|active|ended
  const [remoteInfo, setRemoteInfo] = useState(null);
  const [muted, setMuted]           = useState(false);
  const [duration, setDuration]     = useState(0);

  const pcRef           = useRef(null);   // RTCPeerConnection
  const localStreamRef  = useRef(null);
  const remoteAudioRef  = useRef(null);
  const pendingOfferRef = useRef(null);   // SDP offer from caller (stored until user answers)
  const pendingIceRef   = useRef([]);     // ICE candidates before remoteDesc set
  const timerRef        = useRef(null);

  // ── Create peer connection ──────────────────────────────
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit("iceCandidate", { rideId, candidate });
      }
    };
    pc.ontrack = ({ streams }) => {
      if (remoteAudioRef.current && streams[0]) {
        remoteAudioRef.current.srcObject = streams[0];
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("active");
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        cleanup(false);
      }
    };
    return pc;
  }, [socket, rideId]);

  const cleanup = useCallback((emit = true) => {
    if (emit && socket) socket.emit("callEnd", { rideId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    clearInterval(timerRef.current);
    setCallState("idle");
    setDuration(0);
    setMuted(false);
    setRemoteInfo(null);
  }, [socket, rideId]);

  const getMic = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  };

  // ── Start outgoing call ─────────────────────────────────
  const startCall = async () => {
    if (!socket) return alert("Not connected. Please wait.");
    try {
      const stream = await getMic();
      const pc = createPC();
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      setCallState("calling");
      socket.emit("callOffer", {
        rideId,
        offer,
        callerName: myName,
        callerRole: myRole,
      });
    } catch (e) {
      if (e.name === "NotAllowedError") {
        alert("Microphone access denied. Please allow mic in browser settings and try again.");
      } else {
        alert("Could not start call: " + e.message);
      }
      setCallState("idle");
    }
  };

  // ── Answer incoming call ────────────────────────────────
  const answerCall = async () => {
    const offer = pendingOfferRef.current;
    if (!offer) return;
    try {
      const stream = await getMic();
      const pc = createPC();
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Apply buffered ICE candidates
      for (const c of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingIceRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("callAnswer", { rideId, answer });
      setCallState("active");
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      alert("Could not answer call: " + e.message);
      setCallState("idle");
    }
  };

  const rejectCall = () => {
    if (socket) socket.emit("callReject", { rideId });
    pendingOfferRef.current = null;
    setCallState("idle");
    setRemoteInfo(null);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const enabled = muted;
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = enabled; });
      setMuted(!enabled);
    }
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── Socket listeners ────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Always join the ride room so we receive call events
    socket.emit("joinRide", { rideId });

    const onIncoming = ({ offer, callerName, callerRole }) => {
      pendingOfferRef.current = offer;
      setRemoteInfo({ name: callerName, role: callerRole });
      setCallState("ringing");
    };

    const onAnswered = async ({ answer }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          for (const c of pendingIceRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          pendingIceRef.current = [];
        } catch {}
      }
    };

    const onIce = async ({ candidate }) => {
      if (pcRef.current?.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingIceRef.current.push(candidate);
      }
    };

    const onEnded   = () => cleanup(false);
    const onReject  = () => { setCallState("idle"); setRemoteInfo(null); };

    socket.on("callIncoming",  onIncoming);
    socket.on("callAnswered",  onAnswered);
    socket.on("iceCandidate",  onIce);
    socket.on("callEnded",     onEnded);
    socket.on("callRejected",  onReject);

    return () => {
      socket.off("callIncoming",  onIncoming);
      socket.off("callAnswered",  onAnswered);
      socket.off("iceCandidate",  onIce);
      socket.off("callEnded",     onEnded);
      socket.off("callRejected",  onReject);
    };
  }, [socket, rideId, cleanup]);

  // ── Render: idle state = just a button ─────────────────
  if (callState === "idle") {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
        <button onClick={startCall}
          style={{ flex: 1, padding: "9px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, color: "var(--green)", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📞 Call
        </button>
      </>
    );
  }

  // ── Full-screen overlay for calling/ringing/active ──────
  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, flexDirection: "column", gap: 28 }}>

        {/* Avatar ring */}
        <div style={{
          width: 100, height: 100, borderRadius: "50%",
          background: "var(--surface2)",
          border: `4px solid ${callState === "active" ? "var(--green)" : "var(--accent)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 48,
          boxShadow: callState === "active" ? "0 0 0 0 transparent" : "0 0 0 12px rgba(245,197,24,0.15)",
          animation: callState !== "active" ? "ringPulse 1.8s ease-out infinite" : "none",
        }}>
          {remoteInfo?.role === "DRIVER" ? "👨" : callState === "calling" ? "👤" : "👩"}
        </div>

        {/* Name & status */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            {remoteInfo?.name || (callState === "calling" ? "Calling..." : myRole === "RIDER" ? "Driver" : "Rider")}
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)" }}>
            {callState === "calling" && "📞 Ringing..."}
            {callState === "ringing" && `📲 Incoming call from ${remoteInfo?.role}`}
            {callState === "active"  && `🔴 ${fmt(duration)}`}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 20 }}>
          {callState === "ringing" && (
            <>
              <RoundBtn color="var(--green)" onClick={answerCall}>✅<br/><span style={{fontSize:11}}>Answer</span></RoundBtn>
              <RoundBtn color="var(--red)"   onClick={rejectCall}>❌<br/><span style={{fontSize:11}}>Decline</span></RoundBtn>
            </>
          )}
          {callState === "active" && (
            <RoundBtn color={muted ? "var(--red)" : "rgba(255,255,255,0.15)"} onClick={toggleMute}>
              {muted ? "🔇" : "🎙️"}<br/><span style={{fontSize:11}}>{muted ? "Unmute" : "Mute"}</span>
            </RoundBtn>
          )}
          {callState !== "ringing" && (
            <RoundBtn color="var(--red)" onClick={() => cleanup(true)}>
              📵<br/><span style={{fontSize:11}}>End</span>
            </RoundBtn>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ringPulse {
          0%   { box-shadow: 0 0 0 0   rgba(245,197,24,0.4); }
          70%  { box-shadow: 0 0 0 20px rgba(245,197,24,0);   }
          100% { box-shadow: 0 0 0 0   rgba(245,197,24,0);    }
        }
      `}</style>
    </>
  );
}

const RoundBtn = ({ children, onClick, color }) => (
  <button onClick={onClick}
    style={{ width: 80, height: 80, borderRadius: "50%", background: color, border: "none", color: "#fff", fontWeight: 700, fontSize: 22, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.3, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
    {children}
  </button>
);
