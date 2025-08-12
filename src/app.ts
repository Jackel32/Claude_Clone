/**
 * @file src/app.ts
 * @description The main interactive menu loop for the application.
 */

import inquirer from 'inquirer';
import { createAppContext } from './config/index.js';
import { logger } from './logger/index.js';
import {
  handleChatCommand,
  handleIndexCommand,
  handleDiffCommand,
  handleBranchesCommand,
  handleReportCommand,
  handleGenerateCommand,
  handleTaskCommand,
  promptForFile,
  handleInitCommand
} from './commands/handlers/index.js';

/**
 * The main application loop that presents the interactive menu.
 *
 * This function initializes the application context, including user profile, API key,
 * and AI provider, and then enters a loop to display a main menu to the user.
 * It handles user choices by invoking various command handlers.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the user chooses to exit the application.
 */
export async function startMainMenu(): Promise<void> {
  const baseContext = await createAppContext();
  const { profile } = baseContext;
  const cwd = profile.cwd || '.';

  logger.info('Welcome to Kinch Code AI Assistant!');

  // The main loop
  while (true) {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'What would you like to do?',
        choices: [
          'Initialize Project',
          'Execute a Task (AI Agent Mode)',
          new inquirer.Separator(),
          'Chat with the codebase',
          'Update codebase index',
          'Analyze Git commits',
          'Analyze Git Branches',
          'Generate a high-level project report',
          new inquirer.Separator(),
          'Generate a new code snippet',
          new inquirer.Separator(),
          'Exit',
        ],
      },
    ]);

    switch (choice) {
      case 'Initialize Project':
        await handleInitCommand({ ...baseContext, args: {} });
        break;

      case 'Execute a Task (AI Agent Mode)':
        await handleTaskCommand({ ...baseContext, args: {} });
        break;
        
      case 'Chat with the codebase':
        await handleChatCommand({ ...baseContext, args: { path: cwd } });
        break;

      case 'Update codebase index':
        await handleIndexCommand({ ...baseContext, args: { path: cwd } });
        break;
      
      case 'Analyze Git commits':
        await handleDiffCommand({ ...baseContext, args: { path: cwd } });
        break;
      
      case 'Analyze Git Branches':
        await handleBranchesCommand({ ...baseContext, args: { path: cwd } });
        break;

      case 'Generate a high-level project report':
        await handleReportCommand({ ...baseContext, args: { path: cwd } });
        break;
      
      case 'Generate a new code snippet':
        const genAnswers = await inquirer.prompt([
          { type: 'input', name: 'type', message: 'What type of code to generate (e.g., function, class)?' },
          { type: 'input', name: 'prompt', message: 'Enter a detailed prompt for the code:' },
        ]);
        await handleGenerateCommand({ ...baseContext, args: genAnswers });
        break;      

      case 'Exit':
        logger.info('Goodbye!');
        return;
    }
    // Pause for readability before showing the menu again
    await inquirer.prompt([{ type: 'input', name: 'enter', message: '\nPress Enter to continue...' }]);
  }
}
