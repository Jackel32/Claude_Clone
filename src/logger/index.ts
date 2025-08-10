/**
 * @file src/logger/index.ts
 * @description Centralized pino logger configuration.
 */

import pino from 'pino';

// Define transport options based on the environment.
// This uses the modern transport option, which is recommended for pino v7+.
const transport = process.env.NODE_ENV !== 'production'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:h:MM:ss TT',
      },
    }
  : undefined;

/**
 * The application-wide logger instance.
 * In production, it logs JSON to stdout.
 * In development, it uses pino-pretty for human-readable output.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: transport,
});