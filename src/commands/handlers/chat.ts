/**
 * @file src/commands/handlers/chat.ts
 * @description Handler for the 'chat' command (RAG).
 */

import * as readline from 'readline';
import { queryVectorIndex, getSymbolContextWithDependencies } from '../../codebase/index.js';
import { constructChatPrompt, AIClient, processStream } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import ora from 'ora';

// The static 'import ora from "ora";' line is removed from here.

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function classifyQuery(query: string, client: AIClient): Promise<'CODE' | 'GENERAL'> {
  const prompt = `Is the following user query asking about specific code implementation in their project, or is it a general programming, conceptual, or conversational question? Answer with only the single word 'CODE' or 'GENERAL'.\n\nQuery: "${query}"`;
  
  const response = await client.getCompletion(prompt, false);
  const classification = response?.candidates?.[0]?.content?.parts?.[0]?.text.trim().toUpperCase();

  return classification === 'CODE' ? 'CODE' : 'GENERAL';
}

/**
 * Starts a conversational chat session with the codebase.
 * @param {AppContext} context - The application context.
 */
export async function handleChatCommand(context: AppContext): Promise<void> {
  const { logger, aiClient, profile } = context;

  logger.info('Starting chat session... (Ask about code or have a general conversation)');
  logger.info('Type "exit" or press Ctrl+C to quit.');

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

    const spinner = ora('Thinking...').start();
    try {
      let contextStr = '';
      const queryType = await classifyQuery(line, aiClient);
      
      spinner.text = `Query classified as: ${queryType}`;

      if (queryType === 'CODE') {
        const symbolMatch = line.match(/(?:explain|what is|tell me about)\s+\`?(\w+)\`?/i);
        if (symbolMatch && symbolMatch[1]) {
          const symbol = symbolMatch[1];
          spinner.text = `Looking for symbol "${symbol}" and its dependencies...`;
          const definitionContext = await getSymbolContextWithDependencies(symbol, '.');
          if (definitionContext) {
            logger.info(`Found context for "${symbol}".`);
            contextStr = definitionContext;
          }
        }
        if (!contextStr) {
          spinner.text = 'Performing vector search...';
          contextStr = await queryVectorIndex(line, aiClient, topK);
        }
      } else {
        logger.info('Skipping RAG for general query.');
        contextStr = "No specific code context is relevant for this query.";
      }
      
      conversationHistory.push({ role: 'user', content: line });
      const prompt = constructChatPrompt(conversationHistory, contextStr);
      
      spinner.text = 'Waiting for AI response...';
      const stream = await aiClient.getCompletion(prompt, true);
      
      spinner.succeed('Assistant:');
      const fullResponse = await processStream(stream);
      conversationHistory.push({ role: 'assistant', content: fullResponse });

    } catch (e) {
      spinner.fail('An error occurred');
      logger.error(e);
    }

    rl.prompt();
  }).on('close', () => {
    logger.info('Chat session ended.');
    process.exit(0);
  });
}