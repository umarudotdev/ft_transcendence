import { defineRoom, defineServer } from "colyseus";

import { NODE_ENV, PORT } from "./config";
import { logger } from "./logger";
import { GameRoom } from "./rooms/GameRoom";
import { PlaygroundRoom } from "./rooms/PlaygroundRoom";
import { PatchedBunWebSockets } from "./transport";

const server = defineServer({
  rooms: {
    game_room: defineRoom(GameRoom).filterBy(["matchSessionId"]),
    playground: defineRoom(PlaygroundRoom),
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
