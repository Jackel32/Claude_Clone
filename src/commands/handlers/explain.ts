/**
 * @file src/commands/handlers/explain.ts
 * @description Handler for the 'explain' command.
 */

import { gatherFileContext, constructPrompt, processStream } from '../../ai/index.js';
import { AppContext } from '../../types.js';

/**
 * Handles the logic for explaining a piece of code.
 * @param {AppContext} context - The application context.
 */
export async function handleExplainCommand(context: AppContext): Promise<void> {
  // Destructure dependencies from the context object
  const { aiClient, logger, args } = context;
  const { files } = args;

  if (!files || files.length === 0) {
    throw new Error('You must specify at least one file to explain.');
  }

  const userQuery = args._.slice(1).join(' ');
  if (!userQuery) {
    throw new Error('You must provide a question to ask the AI.');
  }

  logger.info('Gathering context from files...');
  const fileContext = await gatherFileContext(files);

  logger.info('Constructing prompt and calling AI...');
  const prompt = constructPrompt(userQuery, fileContext);
  
  try {
    const stream = await aiClient.getCompletion(prompt, true);
    await processStream(stream);
  } catch (error) {
    logger.error(error, 'AI API Error during explain command');
  }
}