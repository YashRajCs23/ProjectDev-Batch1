// src/pages/ChatPage.jsx — Fixed real-time: stable listeners, no duplicate messages
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import RideLayout from "../components/common/RideLayout";
import CallOverlay from "../components/common/CallOverlay";

export default function ChatPage() {
  const { rideId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [ride, setRide]         = useState(null);
  const [connected, setConnected] = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const seenIds    = useRef(new Set()); // Track message IDs to prevent duplicates

  // ── Load history once ───────────────────────────────────
  useEffect(() => {
    api.get(`/chat/${rideId}`).then(({ data }) => {
      const msgs = data.messages || [];
      msgs.forEach(m => seenIds.current.add(String(m._id)));
      setMessages(msgs);
    });
    api.get(`/rides/${rideId}`).then(({ data }) => setRide(data.ride)).catch(() => {});
  }, [rideId]);

  // ── Socket: join room + listen for messages ─────────────
  useEffect(() => {
    if (!socket) return;

    setConnected(socket.connected);
    socket.emit("joinRide", { rideId });

    const onMsg = (msg) => {
      const id = String(msg._id);
      if (seenIds.current.has(id)) return; // ignore duplicate
      seenIds.current.add(id);
      setMessages(prev => [...prev, msg]);
    };

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    // Remove any old listeners before adding new ones
    socket.off("receiveMessage");
    socket.on("receiveMessage", onMsg);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("receiveMessage", onMsg);
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, rideId]);

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const msg = input.trim();
    if (!msg) return;
    if (!socket?.connected) { alert("Not connected. Please wait a moment."); return; }
    socket.emit("sendMessage", { rideId, message: msg });
    setInput("");
    inputRef.current?.focus();
  };

  const fmtTime = d => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const myId    = String(user?._id || user?.id || "");

  return (
    <RideLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => nav(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>💬 Ride Chat</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {ride?.pickup?.address?.split(",")[0]} → {ride?.drop?.address?.split(",")[0]}
            </div>
          </div>
          {/* Call button in chat header */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {ride && <CallOverlay rideId={rideId} myRole={user?.role === "DRIVER" ? "DRIVER" : "RIDER"} />}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "var(--green)" : "var(--red)" }} />
              <span style={{ fontSize: 11, color: connected ? "var(--green)" : "var(--red)" }}>
                {connected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text3)", margin: "auto" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
              <div style={{ fontSize: 14 }}>Start the conversation!</div>
            </div>
          )}

          {messages.map((msg, idx) => {
            const senderId = String(msg.senderId?._id || msg.senderId);
            const isMe     = senderId === myId;
            const isSystem = msg.messageType === "SYSTEM";
            const prev     = messages[idx - 1];
            const showName = !isMe && !isSystem && String(prev?.senderId?._id || prev?.senderId) !== senderId;

            if (isSystem) return (
              <div key={msg._id || idx} style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", padding: "5px 0" }}>
                {msg.message}
              </div>
            );

            return (
              <div key={msg._id || idx} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 1 }}>
                {showName && (
                  <span style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2, marginLeft: 4 }}>
                    {msg.senderId?.name} · {msg.senderRole}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 5, flexDirection: isMe ? "row-reverse" : "row" }}>
                  <div style={{
                    maxWidth: 300, padding: "9px 13px",
                    borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    background: isMe ? "var(--accent)" : "var(--surface2)",
                    color: isMe ? "#000" : "var(--text)",
                    fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                    border: isMe ? "none" : "1px solid var(--border)",
                  }}>
                    {msg.message}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2, whiteSpace: "nowrap" }}>
                    {fmtTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "11px 14px", display: "flex", gap: 10, flexShrink: 0 }}>
          <input ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message... (Enter to send)"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 12, fontSize: 14, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)" }}
          />
          <button onClick={send} disabled={!input.trim()}
            style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() ? "var(--accent)" : "var(--surface2)", border: "none", color: input.trim() ? "#000" : "var(--text3)", fontSize: 20, cursor: input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ➤
          </button>
        </div>
      </div>
    </RideLayout>
  );
}
