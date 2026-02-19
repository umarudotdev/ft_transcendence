import { PinoTransport } from "@loglayer/transport-pino";
import { getSimplePrettyTerminal } from "@loglayer/transport-simple-pretty-terminal";
import { LogLayer, type LogLevelType } from "loglayer";
import { pino } from "pino";
import { serializeError } from "serialize-error";

export interface LoggerConfig {
  level?: string;
  pretty?: boolean;
  serviceName?: string;
}

export function createLogger(config: LoggerConfig = {}) {
  const isDev = config.pretty ?? process.env.NODE_ENV === "development";
  const level = (config.level ?? "info") as LogLevelType;

  const transport = isDev
    ? getSimplePrettyTerminal({ runtime: "node", level })
    : new PinoTransport({ logger: pino({ level }) });

  const log = new LogLayer({
    errorSerializer: serializeError,
    transport,
  });

  return config.serviceName
    ? log.withContext({ service: config.serviceName })
    : log;
}

export type { ILogLayer } from "loglayer";
