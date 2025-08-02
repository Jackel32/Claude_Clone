/**
 * @file src/app.ts
 * @description The main interactive menu loop for the application.
 */

import { getProfile } from './config/index.js';
import { getApiKey } from './auth/index.js';
import { createAIProvider } from './ai/provider-factory.js';
import { logger } from './logger/index.js';
import { AppContext } from './types.js';
import { 
  handleChatCommand, 
  handleIndexCommand, 
  handleDiffCommand, 
  handleReportCommand,
  handleGenerateCommand,
  handleRefactorCommand,
  handleAddDocsCommand,
  handleTestCommand,
  promptForFile 
} from './commands/handlers/index.js';
import inquirer from 'inquirer';

/**
 * The main application loop that presents the interactive menu.
 */
export async function startMainMenu(): Promise<void> {

  // Create the shared application context once at the start.
  const profile = await getProfile();
  const apiKey = await getApiKey();
  const aiProvider = createAIProvider(profile, apiKey);

  const baseContext: Omit<AppContext, 'args'> = {
    profile,
    aiProvider,
    logger,
  };

  logger.info('Welcome to Kinch Code AI Assistant!');

  // The main loop
  while (true) {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'What would you like to do?',
        choices: [
          'Chat with the codebase',
          'Update codebase index',
          'Analyze Git commits (interactive)',
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
      case 'Chat with the codebase':
        await handleChatCommand({ ...baseContext, args: {} });
        break;

      case 'Update codebase index':
        await handleIndexCommand({ ...baseContext, args: {} });
        break;
      
      case 'Analyze Git commits (interactive)':
        await handleDiffCommand({ ...baseContext, args: {} });
        break;
      
      case 'Generate a high-level project report':
        await handleReportCommand({ ...baseContext, args: {} });
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