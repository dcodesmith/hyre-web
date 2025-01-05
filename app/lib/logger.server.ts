import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "yyyy-mm-dd HH:MM:ss",
    },
  },
});

export default logger;
