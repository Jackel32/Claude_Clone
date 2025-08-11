import { AppContext } from '../../types.js';
import { handleFileModificationCommand } from './utils.js';
import { constructRefactorPrompt } from '../../ai/index.js';

export async function handleRefactorCommand(context: AppContext): Promise<void> {
  const { args } = context;
  const userPrompt = args.prompt;

  if (!userPrompt) {
    throw new Error('The `refactor` command requires a --prompt option.');
  }

  await handleFileModificationCommand(
    context,
    'Refactoring',
    (originalCode) => constructRefactorPrompt(userPrompt, originalCode)
  );
}