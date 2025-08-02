/**
 * @file src/commands/executor.ts
 * @description Creates the AppContext and routes commands to handlers.
 */

import { handleExplainCommand, handleIndexCommand, handleReportCommand,
        handleDiffCommand, handleChatCommand, handleGenerateCommand,
        handleRefactorCommand, handleAddDocsCommand, handleTestCommand  } from './handlers/index.js';
import { getProfile } from '../config/index.js';
import { getApiKey } from '../auth/index.js';
import { createAIProvider } from '../ai/provider-factory.js';
import { logger } from '../logger/index.js';
import { AppContext } from '../types.js';

/**
 * Executes a command based on the parsed arguments.
 * @param {any} args - The parsed arguments from yargs.
 */
export async function executeCommand(args: any): Promise<void> {
  // --- Create the shared AppContext here ---
  const profile = await getProfile(args.profile);
  const apiKey = await getApiKey(args.profile);

  const aiProvider = createAIProvider(profile, apiKey);

  const context: AppContext = {
    profile,
    aiProvider,
    logger,
    args,
  };
  // -----------------------------------------

  const command = args._[0];

  switch (command) {
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
    case 'refactor':
      await handleRefactorCommand(context);
      break;
    case 'add-docs':
      await handleAddDocsCommand(context);
      break;
    case 'test':
      await handleTestCommand(context);
      break;
    default:
      logger.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}