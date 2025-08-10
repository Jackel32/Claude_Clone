/**
 * @file src/commands/handlers/generate.ts
 * @description Handler for the 'generate' command.
 */

import { promises as fs } from 'fs';
import * as path from 'path'; // Import the path module
import { queryVectorIndex } from '../../codebase/index.js';
import { constructGeneratePrompt } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import { extractCode } from './utils.js';
import { logger } from '../../logger/index.js';

/**
 * Handles the logic for generating a new code snippet.
 * @param {AppContext} context - The application context.
 */
export async function handleGenerateCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args, profile } = context;
  const { prompt: userPrompt, output: outputPath } = args;

  if (!userPrompt) {
    throw new Error('The --prompt option is required for the generate command.');
  }

  // Determine the correct project root to analyze
  const projectRoot = path.resolve(args.path || profile.cwd || '.');

  logger.info(`🔎 Finding relevant code for context in ${projectRoot}...`);
  const topK = profile.rag?.topK || 3;
  // Pass the projectRoot to the queryVectorIndex function
  const codeContext = await queryVectorIndex(projectRoot, userPrompt, aiProvider, topK);

  logger.info('🤖 Generating code snippet...');
  const prompt = constructGeneratePrompt(userPrompt, codeContext);

  const response = await aiProvider.invoke(prompt, false);
  const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawCode) {
    logger.error('Failed to generate code. The AI returned an empty response.');
    return;
  }

  const finalCode = extractCode(rawCode);

  if (outputPath) {
    await fs.writeFile(outputPath, finalCode, 'utf-8');
    logger.info(`✅ Code successfully saved to ${outputPath}`);
  } else {
    logger.info('\n--- Generated Code ---');
    logger.info(finalCode);
    logger.info('--- End of Code ---\n');
  }
}