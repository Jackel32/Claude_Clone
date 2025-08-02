/**
 * @file Defines the CLI command structure and argument parsing using yargs.
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * Parses command-line arguments and defines the CLI interface.
 * @returns The parsed arguments object provided by yargs.
 */
export function parseArgs() {
  return yargs(hideBin(process.argv))
    .command(
      'explain [files...]',
      'Explain one or more code files',
      (yargs) => {
        return yargs.positional('files', {
          describe: 'A list of files to be explained by the AI',
          type: 'string',
        });
      }
    )
    .command(
      'index [path]',
      'Analyze and cache a codebase',
      (yargs) => {
        return yargs.positional('path', {
          describe: 'The path to the project directory to index',
          type: 'string',
          default: '.',
        });
      }
    )
    .option('profile', {
      alias: 'p',
      type: 'string',
      description: 'The configuration profile to use',
    })
    .demandCommand(1, 'You must provide a valid command.')
    .help()
    .alias('help', 'h')
    .strict()
    .argv;
}