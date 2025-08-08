/**
 * @file src/commands/handlers/branches.ts
 * @description Interactive handler for comparing git branches.
 */

import inquirer from 'inquirer';
import { isGitRepository, getBranches, getDiffBetweenBranches } from '../../fileops/index.js';
import { constructDiffAnalysisPrompt, processStream } from '../../ai/index.js';
import { AppContext } from '../../types.js';

/**
 * Prompts the user to select a branch from a list.
 * @param message The message to display to the user.
 * @param branches A simple array of branch name strings.
 * @returns The selected branch name, or null if the user cancels.
 */
async function selectBranch(message: string, branches: string[]): Promise<string | null> {
    const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message,
        pageSize: 15,
        // Inquirer can directly use an array of strings as choices.
        choices: [...branches, new inquirer.Separator(), { name: 'Back to menu', value: null }]
    }]);
    return choice;
}

/**
 * Handles analyzing the diff between two git branches.
 * @param {AppContext} context - The application context.
 */
export async function handleBranchesCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args } = context;
  const cwd = args.path || '.';

  // 1. Verify it's a git repository
  if (!(await isGitRepository(cwd))) {
    throw new Error('This is not a git repository. The "branches" command requires git.');
  }
  
  // 2. Get all available branches
  const branches = await getBranches(cwd);
  if (branches.length < 2) {
      logger.info('You need at least two branches to run a comparison.');
      return;
  }

  logger.info('Select two branches to compare their differences.');
  
  // 3. Prompt user to select the base branch
  const baseBranch = await selectBranch('Select the BASE branch (e.g., main or develop):', branches);
  if (!baseBranch) return; // User selected 'Back'

  // 4. Prompt user to select the compare branch
  const remainingBranches = branches.filter(b => b !== baseBranch);
  const compareBranch = await selectBranch('Select the COMPARE branch (e.g., your feature branch):', remainingBranches);
  if (!compareBranch) return;

  // 5. Get the diff between the two branches
  const diffContent = await getDiffBetweenBranches(baseBranch, compareBranch, cwd);

  if (!diffContent.trim()) {
    logger.info(`No changes found between ${baseBranch} and ${compareBranch}.`);
    return;
  }
  
  // 6. Send the diff to the AI for analysis and stream the response
  const analysisPrompt = constructDiffAnalysisPrompt(diffContent);
  
  try {
    logger.info(`\n--- AI Analysis of changes in ${compareBranch} relative to ${baseBranch} ---`);
    const stream = await aiProvider.invoke(analysisPrompt, true);
    await processStream(stream);
    logger.info('--- End of Analysis ---\n');
  } catch (error) {
    logger.error(error, 'AI API Error during branch analysis');
  }
}