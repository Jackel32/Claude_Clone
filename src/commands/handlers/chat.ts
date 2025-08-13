/**
 * @file src/commands/handlers/chat.ts
 * @description Handler for the 'chat' command with auto-indexing and persistent history.
 */

import * as readline from 'readline';
import * as path from 'path';
import * as crypto from 'crypto'; // Import crypto for hashing
import { constructChatPrompt, processStream } from '../../ai/index.js';
import { AppContext, ChatMessage } from '../../types.js';
import { getIndexer } from '../../codebase/indexer.js';
import { handleIndexCommand } from './index-command.js';
import { queryVectorIndexRaw, getSymbolContent } from '../../codebase/index.js';
// Import the database functions
import { getHistory, saveHistory } from '../../core/db.js';

/**
 * Creates a unique session ID from the project path.
 */
function createSessionId(projectRoot: string): string {
  return crypto.createHash('sha256').update(projectRoot).digest('hex');
}

/**
 * Starts a conversational chat session with the codebase.
 */
export async function handleChatCommand(context: AppContext): Promise<void> {
  const { logger, profile, args, aiProvider } = context;
  const projectRoot = path.resolve(args.path || profile.cwd || '.');
  const projectContext = { ...context, args: { ...args, path: projectRoot } };
  const sessionId = createSessionId(projectRoot);

  let indexer = await getIndexer(projectRoot);

  // (Indexing logic remains the same...)
  while (!(await indexer.isIndexUpToDate())) {
    logger.warn(`Project index is incomplete or out-of-date for: ${projectRoot}`);
    const { default: inquirer } = await import('inquirer');
    const { shouldIndex } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldIndex',
        message: 'The codebase index is incomplete. Would you like to update it now? (Recommended)',
        default: true,
    }]);

    if (shouldIndex) {
        await handleIndexCommand(projectContext);
        indexer = await getIndexer(projectRoot);
    } else {
        logger.info('Chat session cancelled. Please run the index command to proceed.');
        return;
    }
  }

  const { default: ora } = await import('ora');
  const conversationHistory: ChatMessage[] = await getHistory(sessionId); // Load history

  return new Promise((resolve) => {
    if (conversationHistory.length > 0) {
        logger.info('Resuming previous chat session...');
    }
    logger.info('Starting chat session... (Type "exit" or press Ctrl+C to quit)');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    rl.on('line', async (line: string) => {
      if (line.trim().toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      const spinner = ora('🤔 AI is thinking...').start();
      try {
        const topK = profile.rag?.topK || 3;
        const vectorResults = await queryVectorIndexRaw(projectRoot, line, aiProvider, topK);
        let contextStr = 'No relevant code context found in the vector database.';
        if (vectorResults.length > 0) {
            contextStr = vectorResults
                .map(r => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
                .join('\n\n');
        }
        
        conversationHistory.push({ role: 'user', content: line });
        const prompt = constructChatPrompt(conversationHistory, contextStr);
        spinner.text = 'Waiting for AI response...';
        const stream = await projectContext.aiProvider.invoke(prompt, true);
        spinner.succeed('🤖 Assistant:');
        const fullResponse = await processStream(stream);
        conversationHistory.push({ role: 'assistant', content: fullResponse });

        await saveHistory(sessionId, conversationHistory); // Save history after each turn

      } catch (e) {
        spinner.fail('An error occurred');
        logger.error(e);
      }

      rl.prompt();
    }).on('close', async () => {
      await saveHistory(sessionId, conversationHistory); // Final save on exit
      logger.info('Chat session ended.');
      resolve(); 
    });
  });
}