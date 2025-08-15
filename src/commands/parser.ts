import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export function parseArgs() {
  return yargs(hideBin(process.argv))
    .command('index [path]', 'Analyze and cache a codebase', (y) => {
      return y.positional('path', {
        describe: 'The path to the codebase directory',
        type: 'string',
        default: '.',
      })
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Force a full re-index of the entire codebase, ignoring the cache.',
        default: false,
      });
    })
    .command('report', 'Generates a high-level analysis report for the entire project')
    .command('chat', 'Starts a conversational session with the codebase')
    .command('task', 'Execute a task (AI Agent Mode)')
    .command('menu', 'Show the interactive main menu')
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