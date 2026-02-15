import {
  handleMessage,
  registerClient,
  startLoop,
  stopLoop,
  unregisterClient,
} from "./loop";

const PORT = Number(process.env.GAME_SERVER_PORT) || 9944;

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    // Upgrade WebSocket requests
    if (server.upgrade(req)) {
      return; // Upgraded successfully
    }

    // Health check endpoint
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      registerClient(ws);
      console.log("[game-server] Client connected");
    },
    message(ws, message) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(
          typeof message === "string"
            ? message
            : new TextDecoder().decode(message)
        );
      } catch {
        return;
      }
      handleMessage(ws, parsed);
    },
    close(ws) {
      unregisterClient(ws);
      console.log("[game-server] Client disconnected");
    },
  },
});

startLoop();

console.log(`[game-server] Listening on port ${server.port}`);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[game-server] SIGTERM received, shutting down...");
  stopLoop();
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[game-server] SIGINT received, shutting down...");
  stopLoop();
  server.stop();
  process.exit(0);
});
