/**
 * @file src/commands/handlers/chat.ts
 * @description Handler for the 'chat' command with a persistent, stable session.
 */

import * as readline from 'readline';
import * as path from 'path';
import * as crypto from 'crypto';
import { constructChatPrompt, processStream } from '../../ai/index.js';
import { AppContext, ChatMessage } from '../../types.js';
import { getIndexer } from '../../codebase/indexer.js';
import { handleIndexCommand } from './index-command.js';
import { queryVectorIndexRaw } from '../../codebase/index.js';
import { getHistory, saveHistory } from '../../core/db.js';

function createSessionId(projectRoot: string): string {
  return crypto.createHash('sha256').update(projectRoot).digest('hex');
}

export async function handleChatCommand(context: AppContext): Promise<void> {
  const { logger, profile, args, aiProvider } = context;
  const projectRoot = String(profile.cwd);
  const sessionId = createSessionId(projectRoot);

  let indexer = await getIndexer(projectRoot);

  // --- Indexing Check ---
  while (!(await indexer.isIndexUpToDate())) {
    const { default: inquirer } = await import('inquirer');
    const { shouldIndex } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldIndex',
        message: 'The codebase index is incomplete. Index now?',
        default: true,
    }]);
    if (shouldIndex) {
        await handleIndexCommand(context);
        indexer = await getIndexer(projectRoot);
    } else {
        logger.info('Chat session cancelled.');
        return;
    }
  }
  
  const conversationHistory: ChatMessage[] = await getHistory(sessionId);

  // --- This Promise wrapper is key to keeping the process alive ---
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
        rl.close(); // This triggers the 'close' event below
        return;
      }

      logger.info('🤔 AI is thinking...');
      try {
        const topK = profile.rag?.topK || 3;
        const vectorResults = await queryVectorIndexRaw(projectRoot, line, aiProvider, topK);
        let contextStr = 'No relevant code context found.';
        if (vectorResults.length > 0) {
            contextStr = vectorResults
                .map(r => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
                .join('\n\n');
        }
        
        conversationHistory.push({ role: 'user', content: line });
        const prompt = constructChatPrompt(conversationHistory, contextStr);
        
        logger.info('🤖 Assistant:');
        const stream = await aiProvider.invoke(prompt, true);
        const fullResponse = await processStream(stream);
        conversationHistory.push({ role: 'assistant', content: fullResponse });

        await saveHistory(sessionId, conversationHistory);

      } catch (e) {
        logger.error(e, 'An error occurred during the chat turn');
      }
      
      // After all async work is done, re-prompt the user
      rl.prompt();

    }).on('close', () => {
      // This event is only triggered by rl.close() or Ctrl+C
      logger.info('Chat session ended.');
      resolve(); // This allows the Node.js process to finally exit.
    });
  });
}