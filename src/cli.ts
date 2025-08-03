#!/usr/bin/env node
import { parseArgs, executeCommand } from './commands/index.js';
import { logger } from './logger/index.js';
import { AppError } from './errors/index.js';

/**
 * The main entry point for the command-line argument based CLI.
 */
async function main() {
  try {
    const args = await parseArgs();
    await executeCommand(args);
  } catch (error) {
    if (error instanceof AppError) {
      // For our custom errors, just log the message for a cleaner output
      logger.error(error.message);
    } else {
      // For unexpected errors, log the full error object
      logger.error(error, 'An unexpected error occurred');
    }
    process.exit(1);
  }
}

main();