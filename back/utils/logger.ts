const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

class Logger {
  private level: LogLevelType;

  constructor() {
    const envLevel =
      process.env.LOG_LEVEL?.toUpperCase() as keyof typeof LogLevel;
    this.level = LogLevel[envLevel] ?? LogLevel.INFO;
  }

  private log(level: LogLevelType, message: string, ...args: any[]) {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LogLevel).find(
      (key) => LogLevel[key as keyof typeof LogLevel] === level,
    );

    const prefix = `[${timestamp}] [${levelName}]`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(prefix, message, ...args);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, ...args);
        break;
      default:
        console.log(prefix, message, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

export const logger = new Logger();
