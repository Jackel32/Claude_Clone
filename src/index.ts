#!/usr/bin/env node
import { logger } from './logger/index.js';
import { startMainMenu } from './app.js'; // Import our new main loop

/**
 * The main entry point for the application.
 */
async function main() {
  try {
    // Start the interactive menu instead of parsing args
    await startMainMenu();
  } catch (error) {
    logger.error(error, 'An unexpected error occurred and the application has to exit.');
    process.exit(1);
  }
}

main();