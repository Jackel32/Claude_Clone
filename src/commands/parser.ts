/**
 * @file src/commands/parser.ts
 * @description Defines and parses the CLI arguments using yargs.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * Parses the command-line arguments.
 * @returns {Promise<any>} The parsed arguments object.
 */
export function parseArgs() {
  return yargs(hideBin(process.argv))
    .command(
      'init [path]',
      'Initialize a new project by creating a Kinch_Code.md file.',
      (y) => {
        return y.positional('path', {
          describe: 'The path to the codebase directory',
          type: 'string',
          default: '.',
        });
      }
    )
    .command(
      'index [path]',
      'Analyze and cache a codebase',
      (y) => {
        return y.positional('path', {
          describe: 'The path to the codebase directory',
          type: 'string',
          default: '.',
        });
      }
    )
    .command(
      'explain <files...>',
      'Explain code using the AI',
      (y) => {
        return y.positional('files', {
          describe: 'One or more files to use as context',
          type: 'string',
        });
      }
    )
    .command(
      'report',
      'Generates a high-level analysis report for the entire project'
    )
    .command('diff', 'Analyzes the changes in the last git commit')
    .command('chat', 'Starts a conversational session with the codebase')
    .command(
      'generate <type>',
      'Generates a new code snippet',
      (y) => {
        return y
          .positional('type', {
            describe: 'The type of code to generate (e.g., function, class, test)',
            type: 'string',
          })
          .option('prompt', {
            type: 'string',
            description: 'A detailed description of the code to generate',
            demandOption: true,
          })
          .option('output', {
            type: 'string',
            description: 'File path to save the generated code'
          });
      }
    )
    .command(
      'refactor <file>',
      'Refactors a specific file based on a prompt',
      (y) => {
        return y
          .positional('file', { describe: 'The file to refactor', type: 'string' })
          .option('prompt', {
            type: 'string',
            description: 'A detailed description of the desired refactoring',
            demandOption: true,
          });
      }
    )
    .command(
      'add-docs <file>',
      'Adds JSDoc comments to a file',
      (y) => {
        return y.positional('file', { describe: 'The file to document', type: 'string' });
      }
    )
    .command(
      'test <file>',
      'Generates a unit test for a specific function or class',
      (y) => {
        return y
          .positional('file', { describe: 'The file containing the code to test', type: 'string' })
          .option('symbol', { type: 'string', description: 'The name of the function/class to test', demandOption: true })
          .option('framework', { type: 'string', description: 'The test framework to use (e.g., jest, vitest)', default: 'jest' })
          .option('output', { type: 'string', description: 'File path to save the new test file' });
      }
    )
    .option('profile', {
      alias: 'p',
      type: 'string',
      description: 'The configuration profile to use',
    })
    .demandCommand(1, 'You must provide a valid command.')
    .help()
    .alias('h', 'help')
    .strict()
    .wrap(null)
    .argv;
}