#!/usr/bin/env node
import { parseArgs } from './commands/index.js';
import { logger } from './logger/index.js';
import { AppError } from './errors/index.js';
import { startMainMenu } from './app.js';
import { handleIndexCommand, handleChatCommand, handleTaskCommand } from './commands/handlers/index.js';
import { createAppContext } from './config/index.js';

async function main() {
  try {
    const args = await parseArgs();
    const context = await createAppContext(args);
    const command = args._[0];

    switch (command) {
      case 'menu':
        await startMainMenu();
        break;
      case 'index':
        await handleIndexCommand(context);
        break;
      case 'chat':
        await handleChatCommand(context);
        break;
      case 'task':
        await handleTaskCommand(context);
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof AppError) {
      logger.error(error.message);
    } else {
      logger.error(error, 'An unexpected error occurred');
    }
    process.exit(1);
  }
}

main();