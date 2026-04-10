// src/pages/ChatPage.jsx
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
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get(`/chat/${rideId}`).then(({ data }) => setMessages(data.messages || []));
    api.get(`/rides/${rideId}`).then(({ data }) => setRide(data.ride));

    if (socket) {
      socket.emit("joinRide", { rideId });
      socket.on("receiveMessage", (msg) => setMessages((m) => [...m, msg]));
    }
    return () => { socket?.off("receiveMessage"); };
  }, [rideId, socket]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!input.trim() || !socket) return;
    socket.emit("sendMessage", { rideId, message: input.trim() });
    setInput("");
  };

  return (
    <RideLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => nav(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontWeight: 700 }}>💬 Ride Chat</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>{ride?.pickup?.address?.substring(0, 30)} → {ride?.drop?.address?.substring(0, 30)}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text3)", margin: "auto" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
              <div>Start the conversation!</div>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = String(msg.senderId?._id) === String(user?.id);
            const isSystem = msg.messageType === "SYSTEM";
            if (isSystem) return <div key={msg._id} style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", padding: "4px 0" }}>{msg.message}</div>;
            return (
              <div key={msg._id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 2 }}>
                <div style={{ maxWidth: 340, padding: "10px 14px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? "var(--accent)" : "var(--surface2)", color: isMe ? "#000" : "var(--text)", fontSize: 14, fontWeight: isMe ? 500 : 400 }}>
                  {!isMe && <div style={{ fontSize: 11, color: isMe ? "#0005" : "var(--text3)", marginBottom: 3 }}>{msg.senderId?.name}</div>}
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "14px 20px", display: "flex", gap: 10 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..." style={{ flex: 1, padding: "11px 14px", borderRadius: 14 }} />
          <button onClick={send} disabled={!input.trim()}
            style={{ padding: "11px 18px", background: input.trim() ? "var(--accent)" : "var(--surface2)", border: "none", borderRadius: 14, color: input.trim() ? "#000" : "var(--text3)", fontSize: 18, cursor: input.trim() ? "pointer" : "not-allowed" }}>
            ➤
          </button>
        </div>
      </div>
    </RideLayout>
  );
}
