/**
 * @file src/commands/handlers/index-command.ts
 * @description Handler for the 'index' command.
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { scanProject } from '../../codebase/scanner.js';
import { checkCache, updateCache, loadCache, saveCache } from '../../codebase/indexer.js';
import { updateVectorIndex, getVectorIndex } from '../../codebase/vectorizer.js';
import { AppContext } from '../../types.js';
import * as cliProgress from 'cli-progress';

/**
 * Handles the logic for indexing a codebase into the vector DB.
 * @param {AppContext} context - The application context.
 */
export async function handleIndexCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider, args } = context;
  const projectRoot = path.resolve(args.path || '.');
  
  logger.info(`🔍 Scanning project at ${projectRoot}...`);
  const currentFiles = await scanProject(projectRoot);
  logger.info(`Found ${currentFiles.length} files to analyze.`);

  logger.info('Checking for deleted files to remove from cache...');
  const cache = await loadCache(projectRoot);
  const cachedFiles = Object.keys(cache);
  const deletedFiles = cachedFiles.filter(file => !currentFiles.includes(file));

  if (deletedFiles.length > 0) {
      logger.warn(`Found ${deletedFiles.length} deleted files. Removing from cache...`);
      deletedFiles.forEach(file => delete cache[file]);
      await saveCache(projectRoot, cache);

      logger.warn('Rebuilding vector index to remove deleted file data...');
      const vectorIndex = await getVectorIndex(projectRoot);
      // Check if index exists before trying to delete
      if (await vectorIndex.isIndexCreated()) {
        await vectorIndex.deleteIndex();
      }
  }

  const filesToIndex: string[] = [];
  logger.info('Checking for new and modified files...');
  for (const file of currentFiles) {
    const cachedAnalysis = await checkCache(projectRoot, file);
    if (!cachedAnalysis) {
      filesToIndex.push(file);
    }
  }

 if (filesToIndex.length === 0) {
    logger.info(`\n✨ Codebase is already up-to-date.`);
    return;
  }

  logger.info(`⚙️  Vectorizing ${filesToIndex.length} new or modified files...`);

  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(filesToIndex.length, 0);

  for (const file of filesToIndex) {
    try {
        const content = await fs.readFile(file, 'utf-8');
        await updateVectorIndex(projectRoot, file, content, aiProvider);
        await updateCache(projectRoot, file, { vectorizedAt: new Date().toISOString() });
    } catch (error) {
        logger.warn(`Could not process file ${file}: ${(error as Error).message}`);
    }
    progressBar.increment();
  }

  progressBar.stop();
  logger.info(`\n✨ Successfully vectorized ${filesToIndex.length} files.`);
}