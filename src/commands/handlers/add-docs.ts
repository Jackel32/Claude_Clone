import { AppContext } from '../../types.js';
import { handleFileModificationCommand } from './utils.js';
import { constructDocsPrompt } from '../../ai/index.js';

export async function handleAddDocsCommand(context: AppContext): Promise<void> {
  await handleFileModificationCommand(
    context,
    'Adding documentation to',
    (originalCode) => constructDocsPrompt(originalCode)
  );
}