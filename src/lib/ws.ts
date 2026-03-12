import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getWsBaseUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) {
    return `${window.location.origin}/ws`;
  }
  return `${base.replace(/\/$/, "")}/ws`;
}

export function getMessageSocket(): Socket {
  if (socket) {
    return socket;
  }

  socket = io(getWsBaseUrl(), {
    transports: ["websocket"],
  });

  return socket;
}

export function closeMessageSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
