/**
 * @file Routes parsed commands to their appropriate handlers.
 */

import { handleExplainCommand, handleIndexCommand } from './handlers';

/**
 * Acts as a router to execute the correct command handler based on parsed arguments.
 * @param args - The parsed arguments object from yargs.
 */
export async function executeCommand(args: any): Promise<void> {
  const command = args._[0];

  switch (command) {
    case 'explain':
      await handleExplainCommand({
        files: args.files || [],
        profile: args.profile,
      });
      break;
    
    case 'index':
      await handleIndexCommand({
        path: args.path,
        profile: args.profile,
      });
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Use "kinch-code --help" for a list of available commands.');
      process.exit(1);
  }
}