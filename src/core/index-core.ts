/**
 * @file src/core/index-core.ts
 * @description Core logic for the indexing feature, refactored for performance.
 */
import * as path from 'path';
import { promises as fs } from 'fs';
import { Indexer } from '../codebase/indexer.js'; // Use the new Indexer class
import { scanProject } from '../codebase/scanner.js';
import { updateVectorIndex, getVectorIndex } from '../codebase/vectorizer.js';
import { AppContext } from '../types.js';
import { AgentCallback } from './agent-core.js';
import { logger } from '../logger/index.js';  

const VALID_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.md', '.json', '.html', '.css']);
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

export async function runIndex(context: AppContext, onUpdate: AgentCallback) {
  const { logger, aiProvider, args, profile } = context;
  const projectRoot = path.resolve(args.path || profile.cwd || '.');
  const indexer = new Indexer(projectRoot);

  try {
    await indexer.init();
    
    onUpdate({ type: 'thought', content: `Scanning project at ${projectRoot}...` });
    const allFiles = await scanProject(projectRoot);
    const currentFiles = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));
    onUpdate({ type: 'thought', content: `Found ${currentFiles.length} relevant files.` });
    
    // --- Efficiently Handle Deleted Files ---
    const cachedFiles = Object.keys(indexer.getCache());
    const deletedFiles = cachedFiles.filter(file => !currentFiles.includes(file));

    if (deletedFiles.length > 0) {
      onUpdate({ type: 'thought', content: `Found ${deletedFiles.length} deleted files. Removing from cache and vector index...` });
      indexer.removeEntries(deletedFiles);
      const vectorIndex = await getVectorIndex(projectRoot);
      if (await vectorIndex.isIndexCreated()) {
        await vectorIndex.deleteIndex(); // Simple strategy: delete vector index if any file is removed
      }
    }

    // --- Efficiently Find New and Modified Files ---
    const filesToIndex: string[] = [];
    onUpdate({ type: 'thought', content: 'Checking for new and modified files...' });
    for (const file of currentFiles) {
      if (await indexer.isEntryStale(file)) {
        filesToIndex.push(file);
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
        onUpdate({ type: 'error', content: `Could not process file ${file}: ${(error as Error).message}` });
      }
    }

    // --- Save Everything Once at the End ---
    await indexer.saveCache();
    onUpdate({ type: 'finish', content: 'Indexing complete. You can now chat with the codebase.' });
    logger.info('runIndex: Indexing finished.');
  } catch (error) {
    onUpdate({ type: 'error', content: (error as Error).message });
  }
}