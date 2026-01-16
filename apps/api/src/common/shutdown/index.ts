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

const shutdownLogger = logger.child("shutdown");

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
    shutdownLogger.debug({ action: "handler_registered", handlerName: name });
  }

  /**
   * Unregister a cleanup handler by name.
   */
  unregister(name: string): void {
    const index = this.handlers.findIndex((h) => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
      shutdownLogger.debug({
        action: "handler_unregistered",
        handlerName: name,
      });
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
      shutdownLogger.info({
        action: "initiated",
        signal,
        message: `Received ${signal}, starting graceful shutdown`,
      });
      this.shutdown(signal);
    };

    process.on("SIGTERM", () => handleSignal("SIGTERM"));
    process.on("SIGINT", () => handleSignal("SIGINT"));

    shutdownLogger.debug({
      action: "initialized",
      message: "Signal handlers registered",
    });
  }

  /**
   * Execute graceful shutdown.
   * Stops accepting new connections, runs cleanup handlers, then exits.
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      shutdownLogger.warn({ action: "already_shutting_down", signal });
      return;
    }

    this.isShuttingDown = true;

    // Mark as shutting down for health checks
    setShuttingDown(true);

    // Set a hard timeout for the entire shutdown process
    const forceExitTimer = setTimeout(() => {
      shutdownLogger.error({
        action: "force_exit",
        message: `Shutdown timeout exceeded (${env.SHUTDOWN_TIMEOUT_MS}ms), forcing exit`,
      });
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);

    try {
      // Stop accepting new connections immediately
      if (this.server) {
        this.server.stop();
        shutdownLogger.info({
          action: "server_stopped",
          message: "Server stopped accepting connections",
        });
      }

      // Run cleanup handlers in reverse order (LIFO)
      const reversedHandlers = [...this.handlers].reverse();

      for (const { name, handler, timeoutMs } of reversedHandlers) {
        shutdownLogger.info({ action: "handler_starting", handlerName: name });

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

          shutdownLogger.info({
            action: "handler_completed",
            handlerName: name,
          });
        } catch (error) {
          shutdownLogger.error(
            {
              action: "handler_failed",
              handlerName: name,
            },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      clearTimeout(forceExitTimer);

      shutdownLogger.info({
        action: "complete",
        message: "Graceful shutdown completed",
      });

      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);

      shutdownLogger.error(
        { action: "error", message: "Error during shutdown" },
        error instanceof Error ? error : new Error(String(error))
      );

      process.exit(1);
    }
  }
}

export const shutdownManager = new ShutdownManager();
