import { defineRoom, defineServer } from "colyseus";

import { NODE_ENV, PORT } from "./config";
import { GameRoom } from "./rooms/GameRoom";
import { PatchedBunWebSockets } from "./transport";

const server = defineServer({
  rooms: {
    game_room: defineRoom(GameRoom).filterBy(["matchSessionId"]),
  },

  transport: new PatchedBunWebSockets(),

  devMode: NODE_ENV !== "production",
});

server.listen(PORT).then(() => {
  process.stdout.write(
    `[game] Colyseus server listening on ws://localhost:${PORT}\n`
  );
});

export type { GameRoom };
export { server };
