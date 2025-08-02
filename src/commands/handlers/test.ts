/**
 * @file src/commands/handlers/test.ts
 * @description Handler for the 'test' command.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { getSymbolContextWithDependencies } from '../../codebase/index.js';
import { constructTestPrompt } from '../../ai/index.js';
import { extractCode } from './utils.js';
import { AppContext } from '../../types.js';
import inquirer from 'inquirer';

export async function handleTestCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args } = context;
  const { file: filePath, symbol, framework = 'jest', output } = args;

  if (!filePath || !symbol) {
    throw new Error('The `test` command requires a --file and a --symbol option.');
  }

  logger.info(`🔎 Finding context for symbol "${symbol}" in ${filePath}...`);
  const symbolContext = await getSymbolContextWithDependencies(symbol, path.dirname(filePath));

  if (!symbolContext) {
    logger.error(`Could not find symbol "${symbol}" in the project.`);
    return;
  }
  
  logger.info(`Generating ${framework} test for "${symbol}"...`);
  const prompt = constructTestPrompt(symbolContext, framework);
  const response = await aiProvider.invoke(prompt, false);
  const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawCode) {
    logger.error('Failed to generate test. The AI returned an empty response.');
    return;
  }

  const finalCode = extractCode(rawCode);
  const defaultFileName = path.basename(filePath).replace('.ts', '.test.ts');
  let outputPath = output;

  if (!outputPath) {
    const { savePath } = await inquirer.prompt([{
      type: 'input',
      name: 'savePath',
      message: 'Enter the path to save the new test file:',
      default: path.join(path.dirname(filePath), defaultFileName),
    }]);
    outputPath = savePath;
  }

  if (outputPath) {
    await fs.writeFile(outputPath, finalCode, 'utf-8');
    logger.info(`Test file successfully saved to ${outputPath}`);
  } else {
    logger.info('\n--- Generated Test ---');
    console.log(finalCode);
    logger.info('--- End of Test ---\n');
  }
}