type LogLevel = "info" | "warn" | "error" | "debug";

export function logMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const formatted = JSON.stringify(payload);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(formatted);
      }
      break;
    default:
      console.log(formatted);
      break;
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => logMessage("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => logMessage("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => logMessage("error", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => logMessage("debug", msg, ctx),
};
