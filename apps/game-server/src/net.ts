import type { ServerWebSocket } from "bun";

import type { ServerMessage } from "./types";

const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
}

export function getClients(): ReadonlySet<ServerWebSocket<unknown>> {
  return clients;
}

export function broadcast(payload: string): void {
  for (const ws of clients) {
    ws.send(payload);
  }
}

export function broadcastMessage(
  message: Exclude<ServerMessage, { type: "state" }>
): void {
  if (clients.size === 0) return;
  const payload = JSON.stringify(message);
  broadcast(payload);
}

export function sendTo(ws: ServerWebSocket<unknown>, payload: string): void {
  ws.send(payload);
}
