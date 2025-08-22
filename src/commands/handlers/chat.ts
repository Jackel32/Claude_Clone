/**
 * @file src/commands/handlers/chat.ts
 * @description Handler for the 'chat' command with a persistent, stable session.
 */

import * as readline from 'readline';
import * as path from 'path';
import * as crypto from 'crypto';
import { constructChatPrompt, processStream } from '../../ai/index.js';
import { AppContext, ChatMessage } from '../../types.js';
import { getIndexer, Indexer } from '../../codebase/indexer.js';
import { handleIndexCommand } from './index-command.js';
import { queryVectorIndexRaw, getSymbolContent } from '../../codebase/index.js';
import { getHistory, saveHistory } from '../../core/db.js';
import { DependencyGraph, loadDependencyGraph } from '../../codebase/dependencies.js';

/**
 * Extracts potential function or class names from a user's query.
 * Looks for words in backticks or single/double quotes.
 * @param query The user's input line.
 * @returns An array of potential symbol names.
 */
function extractPotentialSymbols(query: string): string[] {
    const symbolRegex = /[`'"](\w+)[`'"]/g;
    const matches = query.matchAll(symbolRegex);
    return Array.from(matches, m => m[1]);
}

/**
 * Finds the file path for a given symbol using the indexer's cache.
 * @param symbolName The name of the symbol to find.
 * @param indexer The indexer instance.
 * @returns The file path or null if not found.
 */
function findFileForSymbol(symbolName: string, indexer: Indexer): string | null {
    const cache = indexer.getCache();
    for (const filePath in cache) {
        if (cache[filePath].analysis.symbols?.includes(symbolName)) {
            return filePath;
        }
    }
    return null;
}

function createSessionId(projectRoot: string): string {
  return crypto.createHash('sha256').update(projectRoot).digest('hex');
}

export async function handleChatCommand(context: AppContext): Promise<void> {
  const { logger, profile, args, aiProvider } = context;
  const projectRoot = path.resolve(args.path || profile.cwd || '.');
  const sessionId = createSessionId(projectRoot);

  let indexer = await getIndexer(projectRoot);
  let depGraph: DependencyGraph | null = await loadDependencyGraph(projectRoot);

  // --- Indexing Check ---
  while (!(await indexer.isIndexUpToDate()) || !depGraph) {
    const { default: inquirer } = await import('inquirer');
    const { shouldIndex } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldIndex',
        message: 'The codebase index is incomplete or out of date. Index now?',
        default: true,
    }]);
    if (shouldIndex) {
        await handleIndexCommand(context);
        indexer = await getIndexer(projectRoot);
        depGraph = await loadDependencyGraph(projectRoot);
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
        let directHitContext = '';
        const potentialSymbols = extractPotentialSymbols(line);

        if (potentialSymbols.length > 0) {
            logger.info(`Found potential symbols: ${potentialSymbols.join(', ')}`);
            for (const symbol of potentialSymbols) {
                const filePath = findFileForSymbol(symbol, indexer);
                if (filePath) {
                    const symbolContent = await getSymbolContent(filePath, symbol);
                    if (symbolContent) {
                        directHitContext += `--- User specifically mentioned "${symbol}". Providing its direct source code and dependency information ---\n`;
                        
                        // Add Dependency Info
                        if (depGraph && depGraph[filePath]) {
                            const importedBy = depGraph[filePath].importedBy;
                            if (importedBy.length > 0) {
                                directHitContext += `(File: ${filePath})\n(Imported by: ${importedBy.map(f => path.basename(f)).join(', ')})\n\n`;
                            }
                        }

                        directHitContext += `<file path="${filePath}">\n${symbolContent}\n</file>\n\n`;
                    }
                }
            }
        }

        const topK = profile.rag?.topK || 3;
        const vectorResults = await queryVectorIndexRaw(projectRoot, line, aiProvider, topK);
        
        let vectorContext = 'No relevant code context found from vector search.';
        if (vectorResults.length > 0) {
            vectorContext = vectorResults
                .map(r => {
                    const filePath = r.item.metadata.filePath as string;
                    let dependencyInfo = '';
                    if (depGraph && depGraph[filePath]?.importedBy.length > 0) {
                        dependencyInfo = `\n(Imported by: ${depGraph[filePath].importedBy.map(f => path.basename(f)).join(', ')})`;
                    }
                    return `--- From ${filePath} ${dependencyInfo}---\n${r.item.metadata.content}`;
                })
                .join('\n\n');
        }
        
        const finalContext = (directHitContext + vectorContext).trim();
        
        conversationHistory.push({ role: 'user', content: line });
        const prompt = constructChatPrompt(conversationHistory, finalContext);
        
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
