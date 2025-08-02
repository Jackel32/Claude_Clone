import { promises as fs } from 'fs';
import { constructDocsPrompt } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import { confirmAndApplyChanges, extractCode } from './utils.js';

export async function handleAddDocsCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args } = context;
  const filePath = args.file;

  if (!filePath) {
    throw new Error('The `add-docs` command requires a --file option.');
  }

  logger.info(`- Adding documentation to ${filePath}...`);
  const originalCode = await fs.readFile(filePath, 'utf-8');

  const prompt = constructDocsPrompt(originalCode);
  const response = await aiProvider.invoke(prompt, false);
  const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawCode) {
    logger.error('Failed to generate documentation. The AI returned an empty response.');
    return;
  }

  const finalCode = extractCode(rawCode);
  await confirmAndApplyChanges(filePath, originalCode, finalCode, context);
}