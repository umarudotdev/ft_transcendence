import { defineRoom, defineServer } from "colyseus";

import { NODE_ENV, PORT } from "./config";
import { logger } from "./logger";
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
  logger
    .withMetadata({ port: PORT, nodeEnv: NODE_ENV })
    .info(`Colyseus server listening on ws://localhost:${PORT}`);
});

export type { GameRoom };
export { server };
