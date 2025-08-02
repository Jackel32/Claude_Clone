/**
 * @file src/logger/index.ts
 * @description Centralized pino logger configuration.
 */

// FIX: Use createRequire to bypass ESM import issues for these packages.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pino = require('pino');
const pretty = require('pino-pretty');

const transport = pretty({
  colorize: true,
  ignore: 'pid,hostname',
  translateTime: 'SYS:h:MM:ss TT',
});

/**
 * The application-wide logger instance.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, process.env.NODE_ENV !== 'production' ? transport : undefined);