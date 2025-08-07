/**
 * @file src/core/index-core.ts
 * @description Core logic for the indexing feature.
 */
import * as path from 'path';
import { promises as fs } from 'fs';
import { scanProject, checkCache, updateCache, loadCache, saveCache } from '../codebase/index.js';
import { updateVectorIndex, getVectorIndex } from '../codebase/vectorizer.js';
import { AppContext } from '../types.js';
import { AgentCallback } from './agent-core.js';

const VALID_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.md', '.json', '.html', '.css']);
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

export async function runIndex(context: AppContext, onUpdate: AgentCallback) {
    const { logger, aiProvider, args, profile } = context;
    const projectRoot = path.resolve(args.path || profile.cwd || '.');

    try {
        onUpdate({ type: 'thought', content: `Scanning project at ${projectRoot}...` });
        const allFiles = await scanProject(projectRoot);
        const currentFiles = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));
        onUpdate({ type: 'thought', content: `Found ${currentFiles.length} files to analyze.` });

        const cache = await loadCache(projectRoot);
        const cachedFiles = Object.keys(cache);
        const deletedFiles = cachedFiles.filter(file => !currentFiles.includes(file));

        if (deletedFiles.length > 0) {
            onUpdate({ type: 'thought', content: `Found ${deletedFiles.length} deleted files. Removing from cache...` });
            deletedFiles.forEach(file => delete cache[file]);
            await saveCache(projectRoot, cache);
            const vectorIndex = await getVectorIndex(projectRoot);
            if (await vectorIndex.isIndexCreated()) {
                await vectorIndex.deleteIndex();
            }
        }

        const filesToIndex: string[] = [];
        onUpdate({ type: 'thought', content: 'Checking for new and modified files...' });
        for (const file of currentFiles) {
            const cachedAnalysis = await checkCache(projectRoot, file);
            logger.debug({ file, isCached: !!cachedAnalysis }, 'runIndex: checkCache result');
            if (!cachedAnalysis) {
                filesToIndex.push(file);
            }
        }

        if (filesToIndex.length === 0) {
            onUpdate({ type: 'finish', content: 'Codebase is already up-to-date.' });
            return;
        }

        onUpdate({ type: 'thought', content: `Vectorizing ${filesToIndex.length} new or modified files...` });
        onUpdate({ type: 'action', content: `start-indexing|${filesToIndex.length}` });

        for (let i = 0; i < filesToIndex.length; i++) {
            const file = filesToIndex[i];
            onUpdate({ type: 'thought', content: `Processing ${path.basename(file)} (${i + 1}/${filesToIndex.length})` });
            try {
                const stats = await fs.stat(file);
                if (stats.size > MAX_FILE_SIZE_BYTES) {
                    logger.warn(`Skipping large file: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                    continue; // Skip to the next file
                }

                const content = await fs.readFile(file, 'utf-8');
                await updateVectorIndex(projectRoot, file, content, aiProvider, onUpdate);
                await updateCache(projectRoot, file, { vectorizedAt: new Date().toISOString() });
            } catch (error) {
                 onUpdate({ type: 'error', content: `Could not process file ${file}: ${(error as Error).message}` });
            }
        }

        onUpdate({ type: 'finish', content: `Successfully vectorized ${filesToIndex.length} files.` });
    } catch (error) {
        onUpdate({ type: 'error', content: (error as Error).message });
    }
}