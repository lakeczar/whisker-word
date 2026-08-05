import { useEffect, useRef, useState } from "react";
import type { RoomView } from "../shared/types";
import { getRoomState, issueSocketTicket, socketUrl } from "./api";

export type ConnectionState = "connecting" | "live" | "polling" | "offline";

export function useRoom(code: string, token: string | null) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let pollTimer: number | undefined;
    let retry = 0;

    const poll = async () => {
      try {
        const next = await getRoomState(code, token);
        if (!disposed) {
          setRoom(next);
          setError(null);
          if (!socket || socket.readyState !== WebSocket.OPEN) setConnection("polling");
        }
      } catch (caught) {
        if (!disposed) {
          setConnection(navigator.onLine ? "offline" : "offline");
          setError(caught instanceof Error ? caught.message : "The room is unavailable.");
        }
      }
    };

    const connect = async () => {
      if (disposed) return;
      setConnection("connecting");
      try {
        await poll();
        const ticket = await issueSocketTicket(code, token);
        if (disposed) return;
        socket = new WebSocket(socketUrl(code, ticket));
        socket.addEventListener("open", () => {
          retry = 0;
          if (!disposed) setConnection("live");
        });
        socket.addEventListener("message", (event) => {
          if (event.data === "pong") return;
          try {
            const message = JSON.parse(String(event.data)) as { type?: string; room?: RoomView };
            if (!disposed && message.type === "room" && message.room) {
              setRoom(message.room);
              setError(null);
              setConnection("live");
            }
          } catch {
            // Ignore malformed frames and keep the last safe room snapshot.
          }
        });
        socket.addEventListener("close", () => {
          if (disposed) return;
          setConnection("polling");
          const delay = Math.min(1_000 * 2 ** retry, 10_000);
          retry += 1;
          reconnectTimer = window.setTimeout(connect, delay);
        });
        socket.addEventListener("error", () => socket?.close());
      } catch (caught) {
        if (disposed) return;
        setConnection(navigator.onLine ? "polling" : "offline");
        setError(caught instanceof Error ? caught.message : "Live updates are reconnecting.");
        reconnectTimer = window.setTimeout(connect, Math.min(1_000 * 2 ** retry++, 10_000));
      }
    };

    pollTimer = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) void poll();
    }, 5_000);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible" && (!socket || socket.readyState > WebSocket.OPEN)) void connect();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    void connect();

    return () => {
      disposed = true;
      socket?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [code, token]);

  return { room, connection, error, setRoom };
}
