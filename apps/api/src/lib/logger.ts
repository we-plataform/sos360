import { pino, type LoggerOptions } from 'pino';

// Use process.env directly to avoid circular dependency with env.ts
// IMPORTANT: pino-pretty is a devDependency and NOT available in production
// Never try to use it in production - it will crash the server
const isProduction = process.env.NODE_ENV === 'production';

// Build logger options based on environment
const loggerOptions: LoggerOptions = {
  level: isProduction ? 'info' : 'debug',
  redact: ['password', 'passwordHash', 'refreshToken', 'accessToken', 'authorization'],
};

// Only add transport in development (pino-pretty is devDependency)
if (!isProduction) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
}

export const logger = pino(loggerOptions);
