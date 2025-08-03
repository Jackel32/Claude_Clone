import { AppContext } from '../types.js';
import { queryVectorIndex, getSymbolContextWithDependencies } from '../codebase/index.js';
import { constructChatPrompt } from '../ai/index.js';

// This is the core logic, decoupled from any UI
export async function getChatContext(query: string, context: AppContext): Promise<string> {
    const { logger, aiProvider, profile } = context;
    let contextStr = '';
    const topK = profile.rag?.topK || 3;

    const symbolMatch = query.match(/(?:explain|what is|tell me about)\s+\`?(\w+)\`?/i);
    if (symbolMatch && symbolMatch[1]) {
        const symbol = symbolMatch[1];
        logger.info(`Looking for symbol: ${symbol}...`);
        const definitionContext = await getSymbolContextWithDependencies(symbol, '.');
        if (definitionContext) {
            logger.info(`Found context for "${symbol}".`);
            contextStr = definitionContext;
        }
    }

    if (!contextStr) {
        logger.info('No specific symbol found, using vector search...');
        contextStr = await queryVectorIndex(query, aiProvider, topK);
    }
    
    return contextStr;
}