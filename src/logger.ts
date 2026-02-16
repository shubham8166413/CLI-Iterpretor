import winston from "winston";

const defaultLevel = process.env.LOG_LEVEL || "info";

const baseLogger = winston.createLogger({
  level: defaultLevel,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

winston.addColors({
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
});

export function createLogger(module: string): winston.Logger {
  return baseLogger.child({ module });
}

export default baseLogger;