/**
 * @file src/commands/handlers/diff.ts
 * @description Handler for the 'diff' command.
 */

import { isGitRepository, getLatestCommitDiff } from '../../fileops/vcs.js';
import { constructPrompt } from '../../ai/prompts.js';
import { processStream } from '../../ai/response.js';
import { AppContext } from '../../types.js';

/**
 * Handles analyzing the latest git commit diff.
 * @param {AppContext} context - The application context.
 */
export async function handleDiffCommand(context: AppContext): Promise<void> {
  const { logger, aiClient } = context;

  if (!(await isGitRepository())) {
    throw new Error('This is not a git repository. The "diff" command requires git.');
  }

  logger.info('Analyzing changes from the last commit...');
  const diffContent = await getLatestCommitDiff();

  if (!diffContent.trim()) {
    logger.info('No changes found in the last commit.');
    return;
  }

  const diffQuery = `Please act as a senior code reviewer. Analyze the following git diff and provide a summary of the changes. Focus on:
1.  **Purpose:** What is the main goal of these changes?
2.  **Key Changes:** What are the most significant parts of the diff?
3.  **Potential Issues:** Are there any potential bugs, style issues, or risks introduced?`;

  const prompt = constructPrompt(diffQuery, diffContent);

  try {
    logger.info('\n--- AI Diff Analysis ---');
    const stream = await aiClient.getCompletion(prompt, true);
    await processStream(stream);
    logger.info('--- End of Analysis ---\n');
  } catch (error) {
    logger.error(error, 'AI API Error during diff command');
  }
}