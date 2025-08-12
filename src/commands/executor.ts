/**
 * @file src/commands/executor.ts
 * @description Creates the AppContext and routes commands to handlers.
 */

import { handleExplainCommand, handleIndexCommand, handleReportCommand,
        handleDiffCommand, handleChatCommand, handleGenerateCommand,
        handleInitCommand    } from './handlers/index.js';
import { createAppContext } from '../config/index.js';
import { logger } from '../logger/index.js';

/**
 * Executes a command based on the parsed arguments.
 * @param {any} args - The parsed arguments from yargs.
 */
export async function executeCommand(args: any): Promise<void> {
  const context = await createAppContext(args);
  const command = args._[0];

  switch (command) {
    case 'init':
      await handleInitCommand(context);
      break;
    case 'index':
      await handleIndexCommand(context);
      break;
    case 'explain':
      await handleExplainCommand(context);
      break;
    case 'report':
      await handleReportCommand(context);
      break;
    case 'diff':
      await handleDiffCommand(context);
      break;
    case 'chat':
      await handleChatCommand(context);
      break;
    case 'generate':
      await handleGenerateCommand(context);
      break;
    default:
      logger.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}