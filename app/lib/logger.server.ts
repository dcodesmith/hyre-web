import pino from "pino";

const transport =
  process.env.NODE_ENV !== "production"
    ? {
        level: process.env.NODE_ENV === "development" ? "debug" : "info",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "yyyy-mm-dd HH:MM:ss",
          },
        },
      }
    : undefined;

const baseLogger = pino(transport);

// Create a wrapper that handles multiple arguments
// Pino expects: logger.info(object, message) or logger.info(message)
const logger = {
  ...baseLogger,
  info: (msg: string | object, data?: unknown) => {
    if (typeof msg === "string" && data !== undefined) {
      baseLogger.info(data, msg); // Pino: object first, then message
    } else if (typeof msg === "string") {
      baseLogger.info(msg); // Pass string directly
    } else {
      baseLogger.info(msg); // Pass object directly
    }
  },
  warn: (msg: string | object, data?: unknown) => {
    if (typeof msg === "string" && data !== undefined) {
      baseLogger.warn(data, msg); // Pino: object first, then message
    } else if (typeof msg === "string") {
      baseLogger.warn(msg);
    } else {
      baseLogger.warn(msg);
    }
  },
  error: (msg: string | object, data?: unknown) => {
    if (typeof msg === "string" && data !== undefined) {
      baseLogger.error(data, msg); // Pino: object first, then message
    } else if (typeof msg === "string") {
      baseLogger.error(msg);
    } else {
      baseLogger.error(msg);
    }
  },
  debug: (msg: string | object, data?: unknown) => {
    if (typeof msg === "string" && data !== undefined) {
      baseLogger.debug(data, msg); // Pino: object first, then message
    } else if (typeof msg === "string") {
      baseLogger.debug(msg);
    } else {
      baseLogger.debug(msg);
    }
  },
};

export default logger;
