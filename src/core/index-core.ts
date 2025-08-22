/**
 * @file src/core/index-core.ts
 * @description Core logic for the indexing feature, refactored for performance.
 */
import * as path from 'path';
import { promises as fs } from 'fs';
import { getIndexer } from '../codebase/indexer.js';
import { scanProject } from '../codebase/scanner.js';
import { updateVectorIndex, getVectorIndex, setIndexCreatedState } from '../codebase/vectorizer.js';
import { AppContext } from '../types.js';
import { AgentCallback } from './agent-core.js';
import { logger } from '../logger/index.js';
import { buildDependencyGraph, saveDependencyGraph } from '../codebase/dependencies.js';
import { constructInitBatchPrompt, constructInitFinalPrompt,
         constructInitPrompt, gatherFileContext } from '../ai/index.js';

const VALID_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.md', '.json', '.html', '.css']);
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

export async function runIndex(context: AppContext, onUpdate: AgentCallback) {
  const { logger, aiProvider, args, profile } = context;
  const projectRoot = path.resolve(args.path || profile.cwd || '.');
  const indexer = await getIndexer(projectRoot);

  try {
    const vectorIndex = await getVectorIndex(projectRoot);
    if (!(await vectorIndex.isIndexCreated())) {
        onUpdate({ type: 'thought', content: 'Vector index not found. Creating new vector index...' });
        await vectorIndex.createIndex();
        setIndexCreatedState(projectRoot, true);
    }

    onUpdate({ type: 'thought', content: `Scanning project at ${projectRoot}...` });
    const allFiles = await scanProject(projectRoot);
    const currentFiles = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));
    onUpdate({ type: 'thought', content: `Found ${currentFiles.length} relevant files.` });

    // --- Efficiently Handle Deleted Files ---
    const cachedFiles = Object.keys(indexer.getCache());
    const deletedFiles = cachedFiles.filter(file => !currentFiles.includes(file));
    let filesToIndex: string[] = [];

    if (deletedFiles.length > 0) {
      onUpdate({ type: 'thought', content: `Found ${deletedFiles.length} deleted files. A full re-index is required.` });
      indexer.removeEntries(deletedFiles);
      const vectorIndex = await getVectorIndex(projectRoot);
      if (await vectorIndex.isIndexCreated()) {
        await vectorIndex.deleteIndex();
      }
      filesToIndex = [...currentFiles]; // Re-index everything
    } else {
      // --- Efficiently Find New and Modified Files ---
      onUpdate({ type: 'thought', content: 'Checking for new and modified files...' });
      for (const file of currentFiles) {
        if (await indexer.isEntryStale(file)) {
          filesToIndex.push(file);
        }
      }
    }

    if (filesToIndex.length === 0) {
      onUpdate({ type: 'finish', content: 'Codebase is already up-to-date.' });
      await indexer.saveCache(); // Save potential deletions even if no new files
      return;
    }

    // --- Process Only the Files That Changed ---
    onUpdate({ type: 'thought', content: `Indexing ${filesToIndex.length} new or modified files...` });

    onUpdate({ type: 'action', content: `start-indexing|${filesToIndex.length}` });

    const failedFiles: string[] = [];

    for (let i = 0; i < filesToIndex.length; i++) {
      const file = filesToIndex[i];
      onUpdate({ type: 'thought', content: `Processing ${path.basename(file)} (${i + 1}/${filesToIndex.length})` });
      try {
        const stats = await fs.stat(file);
        if (stats.size > MAX_FILE_SIZE_BYTES) {
          logger.warn(`Skipping large file: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        await updateVectorIndex(projectRoot, file, content, aiProvider, onUpdate);
        await indexer.updateEntry(file, { vectorizedAt: new Date().toISOString() }); // Updates IN-MEMORY cache
        onUpdate({ type: 'action', content: 'file-processed' });
      } catch (error) {
        const errorMessage = `Could not process file ${file}: ${(error as Error).message}`;
        onUpdate({ type: 'error', content: errorMessage });
        failedFiles.push(file);
      }
    }

    if (failedFiles.length > 0) {
        onUpdate({ type: 'thought', content: `\nFailed to process ${failedFiles.length} files:\n- ${failedFiles.join('\n- ')}` });
    }

    // --- Build and save the dependency graph ---
    onUpdate({ type: 'thought', content: 'Building dependency graph...' });
    const depGraph = await buildDependencyGraph(projectRoot);
    await saveDependencyGraph(projectRoot, depGraph);
    onUpdate({ type: 'thought', content: 'Dependency graph saved.' });

    // --- Save Everything Once at the End ---
    await indexer.saveCache();
    onUpdate({ type: 'finish', content: 'Indexing complete. You can now chat with the codebase.' });
    logger.info('runIndex: Indexing finished.');
  } catch (error) {
    onUpdate({ type: 'error', content: (error as Error).message });
  }
}

export async function runInit(context: AppContext, onUpdate: AgentCallback): Promise<void> {
  const { logger, aiProvider, args, profile } = context;
  const projectRoot = path.resolve(args.path || profile.cwd || '.');
  
  try {
    onUpdate({ type: 'thought', content: `Initializing project at ${projectRoot}...` });

    onUpdate({ type: 'thought', content: 'Scanning project files...' });
    const allFiles = await scanProject(projectRoot);
    
    const files = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));

    if (files.length === 0) {
      onUpdate({ type: 'finish', content: 'No relevant files found to analyze. Kinch_Code.md not created.' });
      return;
    }

    onUpdate({ type: 'thought', content: `Gathering context from ${files.length} relevant files...` });
    
    onUpdate({ type: 'action', content: `start-initialization|${files.length}` });
    let fileContext = '';
    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            fileContext += `<file path="${file}">\n${content}\n</file>\n\n`;
        } catch (error) {
            fileContext += `<file path="${file}">\n--- Error reading file ---\n</file>\n\n`;
        }
        onUpdate({ type: 'action', content: 'file-processed' });
    }
    fileContext = fileContext.trim();
    // --- END MODIFICATION ---

    // --- BATCHING LOGIC ---
    const CHAR_LIMIT = 100000; // Character limit per batch
    const contextChunks = [];
    for (let i = 0; i < fileContext.length; i += CHAR_LIMIT) {
        contextChunks.push(fileContext.substring(i, i + CHAR_LIMIT));
    }

    const summaries: string[] = [];
    if (contextChunks.length > 1) {
        onUpdate({ type: 'thought', content: `Context is large, splitting into ${contextChunks.length} batches for analysis.` });

        for (let i = 0; i < contextChunks.length; i++) {
            onUpdate({ type: 'action', content: `Analyzing batch ${i + 1} of ${contextChunks.length}...` });
            const batchPrompt = constructInitBatchPrompt(contextChunks[i]);
            const response = await aiProvider.invoke(batchPrompt, false); // Not streaming this part
            const summary = response?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (summary) {
                summaries.push(summary);
            } else {
                logger.warn(`Batch ${i + 1} did not return a summary.`);
            }
        }
        onUpdate({ type: 'thought', content: 'All batches analyzed. Synthesizing summaries into the final Kinch_Code.md file...' });
    } else {
        onUpdate({ type: 'thought', content: 'Generating Kinch_Code.md content with AI...' });
    }
    
    const finalPrompt = contextChunks.length > 1 
        ? constructInitFinalPrompt(summaries.join('\n---\n'))
        : constructInitPrompt(fileContext); // Use original prompt if only one chunk
    
    const stream = await aiProvider.invoke(finalPrompt, true);
    onUpdate({ type: 'stream-start', content: '' });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    // Step 1: Read the entire stream into a single string.
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value, { stream: true });
    }
    
    // Step 2: Now that we have the full string, robustly parse it.
    let accumulatedText = '';
    if (fullResponse) {
        try {
            // Attempt to parse the entire response as a JSON array
            const responseArray = JSON.parse(fullResponse);
            for (const chunk of responseArray) {
                const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    onUpdate({ type: 'stream-chunk', content: text });
                    accumulatedText += text;
                }
            }
        } catch (e) {
            // If parsing the whole thing fails, fall back to finding individual objects
            logger.warn('Could not parse stream as a single JSON array, attempting to parse individual objects.');
            const jsonObjects = fullResponse.match(/{[\s\S]*?}/g);
            if (jsonObjects) {
                for (const jsonObjStr of jsonObjects) {
                    try {
                        const chunk = JSON.parse(jsonObjStr);
                        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            onUpdate({ type: 'stream-chunk', content: text });
                            accumulatedText += text;
                        }
                    } catch (parseErr) {
                        logger.warn({ err: parseErr, jsonObjStr }, 'Failed to parse a JSON-like chunk from the stream.');
                    }
                }
            }
        }
        
        // If no valid JSON content was extracted by either method, treat the whole response as raw text.
        if (!accumulatedText && !fullResponse.includes('candidates')) {
            logger.warn('Stream did not contain valid JSON parts, treating as raw text.');
            onUpdate({ type: 'stream-chunk', content: fullResponse });
            accumulatedText = fullResponse;
        }
    }
    
    onUpdate({ type: 'stream-end', content: '' });
    const kinchCodeMd = accumulatedText;

    if (!kinchCodeMd.trim()) {
      throw new Error('Failed to generate Kinch_Code.md. The AI returned an empty response.');
    }
    
    onUpdate({ type: 'thought', content: 'Writing Kinch_Code.md to disk...' });
    await fs.writeFile(path.join(projectRoot, 'Kinch_Code.md'), kinchCodeMd, 'utf-8');
    onUpdate({ type: 'finish', content: '✅ Successfully created Kinch_Code.md' });

  } catch (error) {
     onUpdate({ type: 'error', content: (error as Error).message });
  }
}