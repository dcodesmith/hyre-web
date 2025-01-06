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

const logger = pino(transport);

export default logger;
