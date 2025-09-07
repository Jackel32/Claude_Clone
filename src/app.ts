import inquirer from 'inquirer';
import { createAppContext } from './config/index.js';
import { logger } from './logger/index.js';
import {
  handleChatCommand,
  handleIndexCommand,
  handleTaskCommand,
  handleInitCommand,
  handleSetupCommand
} from './commands/handlers/index.js';

export async function startMainMenu(): Promise<void> {
  const baseContext = await createAppContext();
  const { profile } = baseContext;
  const cwd = profile.cwd;

  logger.info('Welcome to Kinch Code AI Assistant!');

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
          new inquirer.Separator(),
          'Setup Configuration',
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
      case 'Setup Configuration':
        await handleSetupCommand();
        break;
      case 'Exit':
        logger.info('Goodbye!');
        return;
    }
    await inquirer.prompt([{ type: 'input', name: 'enter', message: '\nPress Enter to continue...' }]);
  }
}