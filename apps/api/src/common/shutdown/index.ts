import { env } from "../../env";
import { logger } from "../logger";
import { setShuttingDown } from "./state";

type CleanupHandler = () => Promise<void> | void;

interface RegisteredHandler {
  name: string;
  handler: CleanupHandler;
  timeoutMs: number;
}

// Use generic server interface for compatibility
interface StoppableServer {
  stop(): void;
}

const shutdownLogger = logger.child().withContext({ module: "shutdown" });

/**
 * Graceful shutdown manager.
 * Handles SIGTERM/SIGINT signals and coordinates cleanup of resources.
 */
class ShutdownManager {
  private handlers: RegisteredHandler[] = [];
  private server: StoppableServer | null = null;
  private isShuttingDown = false;

  /**
   * Register a cleanup handler to be called during shutdown.
   * Handlers are called in reverse registration order (LIFO).
   */
  register(name: string, handler: CleanupHandler, timeoutMs = 5000): void {
    this.handlers.push({ name, handler, timeoutMs });
    shutdownLogger
      .withMetadata({ action: "handler_registered", handlerName: name })
      .debug("Handler registered");
  }

  /**
   * Unregister a cleanup handler by name.
   */
  unregister(name: string): void {
    const index = this.handlers.findIndex((h) => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
      shutdownLogger
        .withMetadata({ action: "handler_unregistered", handlerName: name })
        .debug("Handler unregistered");
    }
  }

  /**
   * Register the HTTP server for graceful shutdown.
   */
  registerServer(server: StoppableServer): void {
    this.server = server;
  }

  /**
   * Initialize signal handlers for graceful shutdown.
   * Should be called once at application startup.
   */
  initialize(): void {
    const handleSignal = (signal: string) => {
      shutdownLogger
        .withMetadata({ action: "initiated", signal })
        .info(`Received ${signal}, starting graceful shutdown`);
      this.shutdown(signal);
    };

    process.on("SIGTERM", () => handleSignal("SIGTERM"));
    process.on("SIGINT", () => handleSignal("SIGINT"));

    shutdownLogger
      .withMetadata({ action: "initialized" })
      .debug("Signal handlers registered");
  }

  /**
   * Execute graceful shutdown.
   * Stops accepting new connections, runs cleanup handlers, then exits.
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      shutdownLogger
        .withMetadata({ action: "already_shutting_down", signal })
        .warn("Already shutting down");
      return;
    }

    this.isShuttingDown = true;

    // Mark as shutting down for health checks
    setShuttingDown(true);

    // Set a hard timeout for the entire shutdown process
    const forceExitTimer = setTimeout(() => {
      shutdownLogger
        .withMetadata({ action: "force_exit" })
        .error(
          `Shutdown timeout exceeded (${env.SHUTDOWN_TIMEOUT_MS}ms), forcing exit`
        );
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);

    try {
      // Stop accepting new connections immediately
      if (this.server) {
        this.server.stop();
        shutdownLogger
          .withMetadata({ action: "server_stopped" })
          .info("Server stopped accepting connections");
      }

      // Run cleanup handlers in reverse order (LIFO)
      const reversedHandlers = [...this.handlers].reverse();

      for (const { name, handler, timeoutMs } of reversedHandlers) {
        shutdownLogger
          .withMetadata({ action: "handler_starting", handlerName: name })
          .info("Starting handler");

        try {
          await Promise.race([
            Promise.resolve(handler()),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Handler ${name} timed out after ${timeoutMs}ms`)
                  ),
                timeoutMs
              )
            ),
          ]);

          shutdownLogger
            .withMetadata({ action: "handler_completed", handlerName: name })
            .info("Handler completed");
        } catch (error) {
          shutdownLogger
            .withMetadata({ action: "handler_failed", handlerName: name })
            .withError(
              error instanceof Error ? error : new Error(String(error))
            )
            .error("Handler failed");
        }
      }

      clearTimeout(forceExitTimer);

      shutdownLogger
        .withMetadata({ action: "complete" })
        .info("Graceful shutdown completed");

      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);

      shutdownLogger
        .withMetadata({ action: "error" })
        .withError(error instanceof Error ? error : new Error(String(error)))
        .error("Error during shutdown");

      process.exit(1);
    }
  }
}

export const shutdownManager = new ShutdownManager();
