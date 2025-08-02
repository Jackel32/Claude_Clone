/**
 * @file src/app.ts
 * @description The main interactive menu loop for the application.
 */

import { getProfile } from './config/index.js';
import { getApiKey } from './auth/index.js';
import { AIClient } from './ai/index.js';
import { logger } from './logger/index.js';
import { AppContext } from './types.js';
import { 
  handleChatCommand, 
  handleIndexCommand, 
  handleDiffCommand, 
  handleReportCommand,
  handleGenerateCommand,
  handleRefactorCommand,
  handleAddDocsCommand
} from './commands/handlers/index.js';

/**
 * The main application loop that presents the interactive menu.
 */
export async function startMainMenu(): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  // Create the shared application context once at the start.
  const profile = await getProfile();
  const apiKey = await getApiKey();
  if (!profile.model) throw new Error('Model not configured.');
  const aiClient = new AIClient(apiKey, profile.model, profile.temperature);
  
  let baseContext: Omit<AppContext, 'args'> = {
    profile,
    aiClient,
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
          'Analyze last Git commit (diff)',
          'Generate a high-level project report',
          'Generate a new code snippet',
          'Refactor a file',
          'Add documentation to a file',
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
      
      case 'Analyze last Git commit (diff)':
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
        const refactorAnswers = await inquirer.prompt([
          { type: 'input', name: 'file', message: 'Enter the path to the file to refactor:' },
          { type: 'input', name: 'prompt', message: 'Enter your refactoring instructions:' },
        ]);
        await handleRefactorCommand({ ...baseContext, args: refactorAnswers });
        break;
        
      case 'Add documentation to a file':
        const docsAnswers = await inquirer.prompt([
          { type: 'input', name: 'file', message: 'Enter the path to the file to document:' },
        ]);
        await handleAddDocsCommand({ ...baseContext, args: docsAnswers });
        break;

      case 'Exit':
        logger.info('Goodbye!');
        return;
    }
    // Pause for readability before showing the menu again
    await inquirer.prompt([{ type: 'input', name: 'enter', message: '\nPress Enter to continue...' }]);
  }
}