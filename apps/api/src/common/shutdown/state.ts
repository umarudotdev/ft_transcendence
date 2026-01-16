/**
 * Shutdown state shared between shutdown manager and health checks.
 * Isolated to avoid circular dependencies.
 */
let isShuttingDown = false;

export function getShuttingDown(): boolean {
  return isShuttingDown;
}

export function setShuttingDown(value: boolean): void {
  isShuttingDown = value;
}
