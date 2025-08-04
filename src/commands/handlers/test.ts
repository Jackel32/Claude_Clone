import { AppContext } from '../../types.js';
import { runTestGeneration } from '../../core/test-core.js';
import { confirmAndApplyChanges } from './utils.js';
import * as path from 'path';
import inquirer from 'inquirer';

export async function handleTestCommand(context: AppContext): Promise<void> {
  const { args } = context;
  const { file: filePath, symbol, framework = 'jest', output } = args;

  if (!filePath || !symbol) {
    throw new Error('The `test` command requires a --file and a --symbol option.');
  }

  const newContent = await runTestGeneration(filePath, symbol, framework, context);
  
  let outputPath = output;
  if (!outputPath) {
    const defaultFileName = path.basename(filePath).replace('.ts', '.test.ts');
    const { savePath } = await inquirer.prompt([{
      type: 'input',
      name: 'savePath',
      message: 'Enter the path to save the new test file:',
      default: path.join(path.dirname(filePath), defaultFileName),
    }]);
    outputPath = savePath;
  }

  if (outputPath) {
    // We can use confirmAndApplyChanges to write the new file
    await confirmAndApplyChanges(outputPath, '', newContent, context);
  }
}