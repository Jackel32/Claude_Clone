import { AppContext } from '../types.js';
import { queryVectorIndexRaw, getSymbolContent } from '../codebase/index.js';
import { constructChatPrompt } from '../ai/index.js';
import * as path from 'path';

// This is the core logic, decoupled from any UI
export async function getChatContext(query: string, context: AppContext): Promise<string> {
    const { logger, aiProvider, profile, args } = context;
    const projectRoot = path.resolve(args.path || profile.cwd || '.');
    const topK = profile.rag?.topK || 3;

    const symbolMatch = query.match(/(?:explain|what is|tell me about|show me)\s+(?:the\s+)?\`?(\w+)\`?/i);
    
    // First, always perform a vector search to find relevant files
    const vectorResults = await queryVectorIndexRaw(projectRoot, query, aiProvider, topK);

    if (symbolMatch && symbolMatch[1]) {
        const symbol = symbolMatch[1];
        logger.info(`Detected symbol request for: "${symbol}". Searching in relevant files...`);

        // Get the unique file paths from the vector search results
        const candidateFilePaths = [...new Set(vectorResults.map(r => String(r.item.metadata.filePath)))];
        
        for (const filePath of candidateFilePaths) {
            const symbolContent = await getSymbolContent(filePath, symbol);
            if (symbolContent) {
                logger.info(`Found exact symbol match for "${symbol}" in ${filePath}. Providing targeted context.`);
                // Return the exact symbol content, plus the other semantic results for broader context
                const otherResultsContent = vectorResults
                    .filter(r => r.item.metadata.filePath !== filePath)
                    .map(r => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
                    .join('\n\n');
                
                return `--- Definition for ${symbol} in ${filePath} ---\n${symbolContent}\n\n${otherResultsContent}`;
            }
        }
    }
    
    // If no exact symbol match is found, fall back to the formatted vector results
    if (vectorResults.length === 0) {
        return 'No relevant code context found in the vector database.';
    }
    return vectorResults
        .map(r => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
        .join('\n\n');
}