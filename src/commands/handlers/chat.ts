/**
 * @file src/commands/handlers/chat.ts
 * @description Handler for the 'chat' command (RAG).
 */

import * as readline from 'readline';
import * as path from 'path';
import { getChatContext } from '../../core/chat-core.js';
import { constructChatPrompt, processStream } from '../../ai/index.js';
import { AppContext, ChatMessage } from '../../types.js';
import { isIndexCreated } from '../../codebase/vectorizer.js';
import { handleIndexCommand } from './index-command.js';
import { isIndexUpToDate } from '../../codebase/indexer.js';
import inquirer from 'inquirer';

/**
 * Starts a conversational chat session with the codebase.
 */
export async function handleChatCommand(context: AppContext): Promise<void> {
  const { logger, profile, args } = context;
  const projectRoot = path.resolve(args.path || profile.cwd || '.');
  const projectContext = { ...context, args: { ...args, path: projectRoot } };

  // 1. Check if the index exists before starting.
  if (!(await isIndexUpToDate(projectRoot))) {
    logger.warn(`Project index is incomplete or out-of-date for: ${projectRoot}`);
    const { shouldIndex } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldIndex',
      message: 'The codebase index is incomplete. Would you like to update it now? (Recommended)',
      default: true,
    }]);

    if (shouldIndex) {
      await handleIndexCommand(projectContext);
    } else {
      logger.info('Chat session cancelled. Please run the index command to proceed.');
      return;
    }
  }

  // 3. Proceed to the chat session.
  const { default: ora } = await import('ora');

  return new Promise((resolve) => {
    logger.info('Starting chat session... (Type "exit" or press Ctrl+C to quit)');

    const conversationHistory: ChatMessage[] = [];
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
        const contextStr = await getChatContext(line, projectContext);
        
        conversationHistory.push({ role: 'user', content: line });
        const prompt = constructChatPrompt(conversationHistory, contextStr);
        
        spinner.text = 'Waiting for AI response...';
        const stream = await projectContext.aiProvider.invoke(prompt, true);
        
        spinner.succeed('🤖 Assistant:');
        const fullResponse = await processStream(stream);
        conversationHistory.push({ role: 'assistant', content: fullResponse });

      } catch (e) {
        spinner.fail('An error occurred');
        logger.error(e);
      }

      rl.prompt();
    }).on('close', () => {
      logger.info('Chat session ended.');
      resolve(); 
    });
  });
}