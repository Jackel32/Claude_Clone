import { AppContext } from '../types.js';
import { queryVectorIndex, getSymbolContent } from '../codebase/index.js';
import { constructChatPrompt } from '../ai/index.js';
import * as path from 'path';

// This is the core logic, decoupled from any UI
export async function getChatContext(query: string, context: AppContext): Promise<string> {
    const { logger, aiProvider, profile } = context;
    let contextStr = '';
    const topK = profile.rag?.topK || 3;

    const symbolMatch = query.match(/(?:explain|what is|tell me about)\s+\`?(\w+)\`?/i);
    if (symbolMatch && symbolMatch[1]) {
        const symbol = symbolMatch[1];
        logger.info(`Looking for symbol: ${symbol}...`);
        // This is a simplified search. A real implementation would need the file path.
        // For now, we'll assume we can't find it and fall back to vector search.
        // A more advanced version would ask the user for the file.
        contextStr = await queryVectorIndex(query, aiProvider, topK);
    } else {
        contextStr = await queryVectorIndex(query, aiProvider, topK);
    }
    
    return contextStr;
}