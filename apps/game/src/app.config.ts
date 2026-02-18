import { BunWebSockets } from "@colyseus/bun-websockets";
import { defineRoom, defineServer } from "colyseus";

import { NODE_ENV, PORT } from "./config";
import { GameRoom } from "./rooms/GameRoom";

const server = defineServer({
  rooms: {
    game_room: defineRoom(GameRoom).filterBy(["mode"]),
  },

  transport: new BunWebSockets(),

  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });
  },

  devMode: NODE_ENV !== "production",
});

server.listen(PORT).then(() => {
  process.stdout.write(
    `[game] Colyseus server listening on ws://localhost:${PORT}\n`
  );
});

export type { GameRoom };
export { server };
