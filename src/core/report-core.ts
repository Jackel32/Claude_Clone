/**
 * @file src/core/report-core.ts
 * @description Core logic for the project report feature using a Map-Reduce strategy.
 */
import { AppContext } from '../types.js';
import { scanProject } from '../codebase/index.js';
import { constructFileSummaryPrompt, constructFinalReportPrompt } from '../ai/index.js';
import { AgentCallback } from './agent-core.js';
import * as path from 'path';
import { promises as fs } from 'fs';

const IMPORTANT_EXTENSIONS = ['.ts', '.js', '.py', '.cs', '.c', '.cpp', '.h', '.hpp'];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runReport(context: AppContext, onUpdate: AgentCallback) {
    const { logger, aiProvider, profile, args } = context;
    const projectRoot = path.resolve(args.path || profile.cwd || '.');

    try {
        onUpdate({ type: 'thought', content: `Scanning project at ${projectRoot}...` });
        const allFiles = await scanProject(projectRoot);

        // --- 1. FILTER STEP ---
        const filesToSummarize = allFiles.filter(file => 
            IMPORTANT_EXTENSIONS.includes(path.extname(file)) &&
            !file.includes('.test.') && !file.includes('.spec.')
        );

        if (filesToSummarize.length === 0) {
            onUpdate({ type: 'finish', content: 'No summarizable source files found.' });
            return;
        }
        
        onUpdate({ type: 'thought', content: `Found ${filesToSummarize.length} key files to analyze.` });
        
        // --- 2. MAP STEP ---
    const summaries: string[] = [];
    for (const filePath of filesToSummarize) {
        onUpdate({ type: 'action', content: `Summarizing ${path.basename(filePath)}...` });
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const summaryPrompt = constructFileSummaryPrompt(filePath, fileContent);
            const response = await aiProvider.invoke(summaryPrompt, false);
            const summary = response?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not summarize file.';
            summaries.push(`File: ${filePath}\nSummary: ${summary}`);
            
            // Add a 2-second delay between each file summary to avoid rate limiting
            await sleep(2000); 

        } catch (e) {
            logger.error(e, `Failed to summarize ${filePath}`);
            summaries.push(`File: ${filePath}\nSummary: Error during summarization.`);
        }
    }

        // --- 3. REDUCE STEP ---
        onUpdate({ type: 'thought', content: 'All files summarized. Generating final report...' });
        const combinedSummaries = summaries.join('\n\n---\n\n');
        const finalPrompt = constructFinalReportPrompt(combinedSummaries);
        const stream = await aiProvider.invoke(finalPrompt, true);
        
        // Stream the final response back
        onUpdate({ type: 'stream-start', content: '' }); // Signal start of final stream
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const fullResponse = decoder.decode(value, { stream: true });
            const responseArray = JSON.parse(fullResponse); // Assuming Gemini stream format
            for (const chunk of responseArray) {
                const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    onUpdate({ type: 'stream-chunk', content: text });
                    accumulatedText += text;
                }
            }
        }
        onUpdate({ type: 'stream-end', content: '' }); // Signal end of final stream
        onUpdate({ type: 'finish', content: accumulatedText });

    } catch (error) {
        onUpdate({ type: 'error', content: (error as Error).message });
    }
}