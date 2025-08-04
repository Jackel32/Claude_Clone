/**
 * @file src/commands/handlers/chat.ts
 * @description Handler for the 'chat' command (RAG).
 */

import * as readline from 'readline';
import { queryVectorIndex } from '../../codebase/index.js';
import { constructChatPrompt, AIProvider, processStream } from '../../ai/index.js';
import { AppContext, ChatMessage } from '../../types.js';
import ora from 'ora';

async function classifyQuery(query: string, client: AIProvider): Promise<'CODE' | 'GENERAL'> {
  const prompt = `Is the following user query asking about specific code implementation in their project, or is it a general programming, conceptual, or conversational question? Answer with only the single word 'CODE' or 'GENERAL'.\n\nQuery: "${query}"`;
  
  const response = await client.invoke(prompt, false);
  const classification = response?.candidates?.[0]?.content?.parts?.[0]?.text.trim().toUpperCase();

  return classification === 'CODE' ? 'CODE' : 'GENERAL';
}

/**
 * Starts a conversational chat session with the codebase.
 */
export async function handleChatCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, profile } = context;

  return new Promise((resolve) => {
    logger.info('Starting chat session... (Type "exit" or press Ctrl+C to quit)');

    const topK = profile.rag?.topK || 3;
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
        // FIX: Simplified to use only vector search for context
        const contextStr = await queryVectorIndex(line, aiProvider, topK);
        
        conversationHistory.push({ role: 'user', content: line });
        const prompt = constructChatPrompt(conversationHistory, contextStr);
        
        spinner.text = 'Waiting for AI response...';
        const stream = await aiProvider.invoke(prompt, true);
        
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