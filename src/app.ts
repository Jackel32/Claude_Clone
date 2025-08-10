/**
 * @file src/app.ts
 * @description The main interactive menu loop for the application.
 */

import inquirer from 'inquirer';
import { getAppContext } from './config/index.js';
import { logger } from './logger/index.js';
import {
  handleChatCommand,
  handleIndexCommand,
  handleDiffCommand,
  handleBranchesCommand,
  handleReportCommand,
  handleGenerateCommand,
  handleRefactorCommand,
  handleAddDocsCommand,
  handleTestCommand,
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
  // Create the shared application context once using the new centralized function.
  const baseContext = await getAppContext();
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
          'Refactor a file',
          'Add documentation to a file',
          'Generate a unit test',
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
      
      case 'Refactor a file':
        const fileToRefactor = await promptForFile('Select the file to refactor:', { ...baseContext, args: {} });
        if (!fileToRefactor) continue; // If null, go back to main menu

        const { prompt } = await inquirer.prompt([
          { type: 'input', name: 'prompt', message: 'Enter your refactoring instructions:' },
        ]);
        await handleRefactorCommand({ ...baseContext, args: { file: fileToRefactor, prompt } });
        break;
        
      case 'Add documentation to a file':
        const fileToDocument = await promptForFile('Select the file to document:', { ...baseContext, args: {} });
        if (!fileToDocument) continue; // If null, go back to main menu
        
        await handleAddDocsCommand({ ...baseContext, args: { file: fileToDocument } });
        break;

      case 'Generate a unit test':
        const fileToTest = await promptForFile('Select the file containing the symbol to test:', { ...baseContext, args: {} });
        if (!fileToTest) continue; // If null, go back to main menu
        
        const testAnswers = await inquirer.prompt([
            { type: 'input', name: 'symbol', message: 'Enter the name of the function/class to test:' },
            { type: 'input', name: 'framework', message: 'Enter the testing framework (e.g., jest, vitest):', default: 'jest' },
        ]);
        await handleTestCommand({ ...baseContext, args: { ...testAnswers, file: fileToTest } });
        break;

      case 'Exit':
        logger.info('Goodbye!');
        return;
    }
    // Pause for readability before showing the menu again
    await inquirer.prompt([{ type: 'input', name: 'enter', message: '\nPress Enter to continue...' }]);
  }
}
