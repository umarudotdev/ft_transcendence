/**
 * Patched BunWebSockets transport.
 *
 * Works around a bug in @colyseus/bun-websockets@0.17.7 where the
 * `onConnection` regex fails to extract the roomId from the URL because
 * `rawClient.data.url` includes query parameters (e.g. `?sessionId=...`)
 * and the regex uses a `$` anchor that doesn't account for them.
 *
 * The fix strips the query string from the URL before the parent's
 * `onConnection` runs, while leaving `searchParams` intact.
 */
// biome-ignore lint/suspicious/noExplicitAny: Bun ServerWebSocket typing
import { BunWebSockets, type TransportOptions } from "@colyseus/bun-websockets";

export class PatchedBunWebSockets extends BunWebSockets {
  constructor(options: TransportOptions = {}) {
    super(options);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Bun ServerWebSocket internal data
  protected async onConnection(rawClient: any) {
    // Strip query params from the URL string so the roomId regex matches.
    // searchParams are already stored separately in rawClient.data.searchParams.
    const qIdx = rawClient.data.url.indexOf("?");
    if (qIdx !== -1) {
      rawClient.data.url = rawClient.data.url.substring(0, qIdx);
    }
    return super.onConnection(rawClient);
  }
}
