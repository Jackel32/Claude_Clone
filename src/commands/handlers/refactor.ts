import { promises as fs } from 'fs';
import { constructRefactorPrompt } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import { confirmAndApplyChanges, extractCode } from './utils.js';

export async function handleRefactorCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args } = context;
  const filePath = args.file;
  const userPrompt = args.prompt;

  if (!filePath || !userPrompt) {
    throw new Error('The `refactor` command requires a --file and a --prompt option.');
  }

  logger.info(`- Refactoring ${filePath}...`);
  const originalCode = await fs.readFile(filePath, 'utf-8');
  
  const prompt = constructRefactorPrompt(userPrompt, originalCode);
  const response = await aiProvider.invoke(prompt, false);
  const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawCode) {
    logger.error('Failed to refactor. The AI returned an empty response.');
    return;
  }

  const finalCode = extractCode(rawCode);
  await confirmAndApplyChanges(filePath, originalCode, finalCode, context);
}