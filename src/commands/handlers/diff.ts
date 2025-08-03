/**
 * @file src/commands/handlers/diff.ts
 * @description Interactive handler for the 'diff' command.
 */

import inquirer from 'inquirer'; // Use the standard import for inquirer@8
import { isGitRepository, getRecentCommits, getDiffBetweenCommits } from '../../fileops/index.js';
import { constructPrompt, processStream } from '../../ai/index.js';
import { AppContext } from '../../types.js';

async function selectCommit(message: string, commits: string[]): Promise<string | null> {
    const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message,
        pageSize: 15,
        choices: [...commits.map(c => {
            const [hash, author, date, msg] = c.split('|');
            return { name: `${hash} - ${msg} (${author}, ${date})`, value: hash };
        }), new inquirer.Separator(), { name: 'Back to menu', value: null }]
    }]);
    return choice;
}

/**
 * Handles analyzing git commits interactively.
 */
export async function handleDiffCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider } = context;

  if (!(await isGitRepository())) {
    throw new Error('This is not a git repository. The "diff" command requires git.');
  }
  
  const commits = await getRecentCommits('.');
  if (commits.length === 0) {
      logger.info('No commits found in this repository.');
      return;
  }

  const { mode } = await inquirer.prompt([{
      type: 'list',
      name: 'mode',
      message: 'Select a diff mode:',
      choices: [
          'Compare a single commit to its parent',
          'Compare two commits against each other',
          new inquirer.Separator(),
          'Back to menu'
      ]
  }]);

  let diffContent = '';
  const cwd = '.';

  if (mode === 'Compare a single commit to its parent') {
      const commitHash = await selectCommit('Select a commit to analyze:', commits);
      if (!commitHash) return;
      diffContent = await getDiffBetweenCommits(`${commitHash}~1`, commitHash, cwd);
  } else if (mode === 'Compare two commits against each other') {
      const startHash = await selectCommit('Select the START commit (older):', commits);
      if (!startHash) return;
      const endHash = await selectCommit('Select the END commit (newer):', commits);
      if (!endHash) return;
      diffContent = await getDiffBetweenCommits(startHash, endHash, cwd);
  } else {
      return; // User selected 'Back'
  }

  if (!diffContent.trim()) {
    logger.info('No changes found between the selected commits.');
    return;
  }
  
  const diffQuery = `Please act as a senior code reviewer. Analyze the following git diff and provide a summary of the changes. Focus on:
1.  **Purpose:** What is the main goal of these changes?
2.  **Key Changes:** What are the most significant parts of the diff?
3.  **Potential Issues:** Are there any potential bugs, style issues, or risks introduced?`;
  const prompt = constructPrompt(diffQuery, diffContent);
  
  try {
    logger.info('\n--- AI Diff Analysis ---');
    const stream = await aiProvider.invoke(prompt, true);
    await processStream(stream);
    logger.info('--- End of Analysis ---\n');
  } catch (error) {
    logger.error(error, 'AI API Error during diff command');
  }
}