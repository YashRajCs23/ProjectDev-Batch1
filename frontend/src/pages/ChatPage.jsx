// src/pages/ChatPage.jsx — Fixed real-time + enhanced UI
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import RideLayout from "../components/common/RideLayout";

export default function ChatPage() {
  const { rideId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [ride, setRide] = useState(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Use ref for messages to avoid stale closure in socket handler
  const msgsRef = useRef([]);
  msgsRef.current = messages;

  useEffect(() => {
    // Load history
    api.get(`/chat/${rideId}`).then(({ data }) => {
      setMessages(data.messages || []);
    });
    api.get(`/rides/${rideId}`).then(({ data }) => setRide(data.ride));
  }, [rideId]);

  // Socket setup — separate from history load
  useEffect(() => {
    if (!socket) return;

    const handleMsg = (msg) => {
      setMessages(prev => {
        // Avoid duplicate messages
        if (prev.find(m => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    };

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on("receiveMessage", handleMsg);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    setConnected(socket.connected);

    // Join ride room
    socket.emit("joinRide", { rideId });

    return () => {
      socket.off("receiveMessage", handleMsg);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket, rideId]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const msg = input.trim();
    if (!msg || !socket) return;
    socket.emit("sendMessage", { rideId, message: msg });
    setInput("");
    inputRef.current?.focus();
  };

  const fmtTime = d => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <RideLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>

        {/* Header */}
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => nav(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>💬 Ride Chat</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>{ride?.pickup?.address?.substring(0, 25)}... → {ride?.drop?.address?.substring(0, 25)}...</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "var(--green)" : "var(--red)" }} />
            <span style={{ color: connected ? "var(--green)" : "var(--red)" }}>{connected ? "Live" : "Connecting..."}</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 3 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text3)", margin: "auto" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
              <div>Say hello to your {ride?.rideType === "SHARED" ? "group" : "driver"}!</div>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isMe = String(msg.senderId?._id) === String(user?.id);
            const isSystem = msg.messageType === "SYSTEM";
            const prev = messages[idx - 1];
            const showName = !isMe && !isSystem && String(prev?.senderId?._id) !== String(msg.senderId?._id);

            if (isSystem) return (
              <div key={msg._id || idx} style={{ textAlign: "center", fontSize: 11, color: "var(--text3)", padding: "6px 0" }}>{msg.message}</div>
            );

            return (
              <div key={msg._id || idx} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 1 }}>
                {showName && (
                  <span style={{ fontSize: 10, color: "var(--text3)", marginBottom: 3, marginLeft: 4 }}>
                    {msg.senderId?.name} · {msg.senderRole}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMe ? "row-reverse" : "row" }}>
                  <div style={{
                    maxWidth: 280, padding: "10px 14px",
                    borderRadius: isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                    background: isMe ? "var(--accent)" : "var(--surface2)",
                    color: isMe ? "#000" : "var(--text)",
                    fontSize: 14, lineHeight: 1.5,
                    border: isMe ? "none" : "1px solid var(--border)",
                    wordBreak: "break-word",
                  }}>
                    {msg.message}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text3)", whiteSpace: "nowrap", marginBottom: 2 }}>
                    {fmtTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message... (Enter to send)"
            rows={1}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 14, resize: "none", maxHeight: 80, overflowY: "auto", fontSize: 14 }}
          />
          <button onClick={send} disabled={!input.trim()}
            style={{ width: 44, height: 44, borderRadius: 14, background: input.trim() ? "var(--accent)" : "var(--surface2)", border: "none", color: input.trim() ? "#000" : "var(--text3)", fontSize: 20, cursor: input.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            ➤
          </button>
        </div>
      </div>
    </RideLayout>
  );
}
