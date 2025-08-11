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
    // Map branch strings to the object format required by the new inquirer version.
    const choices = [
        ...branches.map(branch => ({ name: branch, value: branch })), 
        new inquirer.Separator(), 
        { name: 'Back to menu', value: null }
    ];

    const { choice } = await inquirer.prompt({
        type: 'list',
        name: 'choice',
        message,
        pageSize: 15,
        choices: choices
    });
    return choice;
}

/**
 * Handles analyzing the diff between two git branches.
 * @param {AppContext} context - The application context.
 */
export async function handleBranchesCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args } = context;
  const cwd = args.path || '.';

  if (!(await isGitRepository(cwd))) {
    throw new Error('This is not a git repository. The "branches" command requires git.');
  }
  
  const branches = await getBranches(cwd);
  if (branches.length < 2) {
      logger.info('You need at least two branches to run a comparison.');
      return;
  }

  logger.info('Select two branches to compare their differences.');
  
  const baseBranch = await selectBranch('Select the BASE branch (e.g., main or develop):', branches);
  if (!baseBranch) return;

  const remainingBranches = branches.filter(b => b !== baseBranch);
  const compareBranch = await selectBranch('Select the COMPARE branch (e.g., your feature branch):', remainingBranches);
  if (!compareBranch) return;

  const diffContent = await getDiffBetweenBranches(baseBranch, compareBranch, cwd);

  if (!diffContent.trim()) {
    logger.info(`No changes found between ${baseBranch} and ${compareBranch}.`);
    return;
  }
  
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