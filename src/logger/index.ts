/**
 * @file src/logger/index.ts
 * @description Centralized pino logger configuration.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pino = require('pino');

let transport;
if (process.env.NODE_ENV !== 'production') {
  const pretty = require('pino-pretty');
  transport = pretty({
    colorize: true,
    ignore: 'pid,hostname',
    translateTime: 'SYS:h:MM:ss TT',
  });
}

/**
 * The application-wide logger instance.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, transport); // Pass the transport, which will be undefined in production.