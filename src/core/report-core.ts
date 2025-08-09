/**
 * @file src/core/report-core.ts
 * @description Core logic for the project report feature using a cached Map-Reduce strategy.
 */
import { AppContext } from '../types.js';
import { scanProject, ReportIndexer } from '../codebase/index.js';
import { constructFileSummaryPrompt, constructFinalReportPrompt } from '../ai/index.js';
import { AgentCallback } from './agent-core.js';
import * as path from 'path';
import { promises as fs } from 'fs';

const IMPORTANT_EXTENSIONS = ['.ts', '.js', '.py', '.cs', '.c', '.cpp', '.h', '.hpp'];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Filters the initial list of files to only include relevant source code for analysis.
 */
function filterFiles(allFiles: string[]): string[] {
    return allFiles.filter(file =>
        IMPORTANT_EXTENSIONS.includes(path.extname(file).toLowerCase()) &&
        !file.includes('.test.') && !file.includes('.spec.')
    );
}

/**
 * Processes a list of files, summarizing new/modified ones and retrieving others from cache.
 */
async function processFiles(files: string[], reportIndexer: ReportIndexer, context: AppContext, onUpdate: AgentCallback): Promise<string[]> {
    const { logger, aiProvider } = context;
    const summaries: string[] = [];
    const filesToResummarize: string[] = [];

    onUpdate({ type: 'thought', content: 'Checking for new and modified files for summarization...' });

    for (const filePath of files) {
        if (await reportIndexer.isEntryStale(filePath)) {
            filesToResummarize.push(filePath);
        } else {
            const entry = reportIndexer.getCache()[filePath];
            if (entry) summaries.push(`File: ${filePath}\nSummary: ${entry.summary}`);
        }
    }

    onUpdate({
        type: 'thought',
        content: `Using ${files.length - filesToResummarize.length} cached summaries, processing ${filesToResummarize.length} new/modified files.`
    });

    for (const filePath of filesToResummarize) {
        onUpdate({ type: 'action', content: `Summarizing ${path.basename(filePath)}...` });
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const summaryPrompt = constructFileSummaryPrompt(filePath, fileContent);
            const response = await aiProvider.invoke(summaryPrompt, false);
            const newSummary = response?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not summarize file.';
            const currentHash = reportIndexer.getHash(fileContent);

            reportIndexer.updateEntry(filePath, currentHash, newSummary);
            summaries.push(`File: ${filePath}\nSummary: ${newSummary}`);
            await sleep(1000); // Short delay to respect rate limits
        } catch (e) {
            logger.error(e, `Error summarizing file ${filePath}`);
            summaries.push(`File: ${filePath}\nSummary: Error during summarization.`);
        }
    }
    return summaries;
}

/**
 * Takes a collection of summaries and generates the final, high-level report.
 */
async function generateFinalReport(summaries: string[], context: AppContext, onUpdate: AgentCallback) {
    if (summaries.length === 0) {
        onUpdate({ type: 'finish', content: 'No file summaries were generated. Report cannot be created.' });
        return;
    }
    onUpdate({ type: 'thought', content: 'All files summarized. Generating final report...' });

    const combinedSummaries = summaries.join('\n\n---\n\n');
    const finalPrompt = constructFinalReportPrompt(combinedSummaries);
    const stream = await context.aiProvider.invoke(finalPrompt, true);

    onUpdate({ type: 'stream-start', content: '' });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const fullResponse = decoder.decode(value, { stream: true });
        try {
            const responseArray = JSON.parse(`[${fullResponse.replace(/}\s*{/g, '},{')}]`);
            for (const chunk of responseArray) {
                const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    onUpdate({ type: 'stream-chunk', content: text });
                    accumulatedText += text;
                }
            }
        } catch (e) {
            onUpdate({ type: 'stream-chunk', content: fullResponse });
            accumulatedText += fullResponse;
        }
    }
    
    onUpdate({ type: 'stream-end', content: '' });
    onUpdate({ type: 'finish', content: accumulatedText });
}

/**
 * Orchestrates the entire report generation process using a cached Map-Reduce strategy.
 */
export async function runReport(context: AppContext, onUpdate: AgentCallback) {
    const { logger, profile, args } = context;
    const projectRoot = path.resolve(args.path || profile.cwd || '.');
    const reportIndexer = new ReportIndexer(projectRoot);

    try {
        await reportIndexer.init();
        onUpdate({ type: 'thought', content: `Scanning project at ${projectRoot}...` });
        const allFiles = await scanProject(projectRoot);
        
        const currentFiles = filterFiles(allFiles);
        if (currentFiles.length === 0) {
            onUpdate({ type: 'finish', content: 'No relevant source files found to generate a report.' });
            return;
        }
        onUpdate({ type: 'thought', content: `Found ${currentFiles.length} key files to analyze.` });

        const cachedReportFiles = Object.keys(reportIndexer.getCache());
        const deletedFiles = cachedReportFiles.filter(file => !currentFiles.includes(file));
        if (deletedFiles.length > 0) {
            onUpdate({ type: 'thought', content: `Found ${deletedFiles.length} deleted files. Removing from report cache...` });
            reportIndexer.removeEntries(deletedFiles);
        }

        const summaries = await processFiles(currentFiles, reportIndexer, context, onUpdate);
        await generateFinalReport(summaries, context, onUpdate);

    } catch (error) {
        const err = error as Error;
        logger.error(err, 'Error running report');
        onUpdate({ type: 'error', content: `Failed to generate report: ${err.message}` });
    } finally {
        await reportIndexer.saveCache();
    }
}