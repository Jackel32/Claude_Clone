/**
 * @file src/commands/handlers/generate.ts
 * @description Handler for the 'generate' command.
 */

import { queryVectorIndex } from '../../codebase/index.js';
import { constructGeneratePrompt } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import { extractCode } from './utils.js';

/**
 * Handles the logic for generating a new code snippet.
 * @param {AppContext} context - The application context.
 */
export async function handleGenerateCommand(context: AppContext): Promise<void> {
  const { logger, aiClient, args, profile } = context;
  const userPrompt = args.prompt;

  if (!userPrompt) {
    throw new Error('The --prompt option is required for the generate command.');
  }

  logger.info('Finding relevant code for context...');
  const topK = profile.rag?.topK || 3;
  const codeContext = await queryVectorIndex(userPrompt, aiClient, topK);

  logger.info('Generating code snippet...');
  const prompt = constructGeneratePrompt(userPrompt, codeContext);
  
  const response = await aiClient.getCompletion(prompt, false);
  const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawCode) {
    logger.error('Failed to generate code. The AI returned an empty response.');
    return;
  }

  const finalCode = extractCode(rawCode);

  logger.info('\n--- Generated Code ---');
  console.log(finalCode);
  logger.info('--- End of Code ---\n');
}