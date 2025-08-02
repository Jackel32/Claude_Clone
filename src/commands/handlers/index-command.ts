/**
 * @file src/commands/handlers/index-command.ts
 * @description Handler for the 'index' command.
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { scanProject } from '../../codebase/scanner.js';
import { checkCache, updateCache } from '../../codebase/indexer.js';
import { vectorIndex, updateVectorIndex } from '../../codebase/vectorizer.js';
import { AppContext } from '../../types.js';
import * as cliProgress from 'cli-progress';

/**
 * Handles the logic for indexing a codebase into the vector DB.
 * @param {AppContext} context - The application context.
 */
export async function handleIndexCommand(context: AppContext): Promise<void> {
  const { logger, aiClient, args } = context;
  const projectPath = path.resolve(args.path || '.');
  
  logger.info(`Scanning project at ${projectPath}...`);
  const files = await scanProject(projectPath);
  logger.info(`Found ${files.length} files to analyze.`);

  logger.info('Ensuring vector index exists...');
  if (!(await vectorIndex.isIndexCreated())) {
    await vectorIndex.createIndex();
    logger.info('Vector index created.');
  }

  const filesToIndex: string[] = [];
  for (const file of files) {
    const cachedAnalysis = await checkCache(file);
    if (!cachedAnalysis) {
      filesToIndex.push(file);
    }
  }

  if (filesToIndex.length === 0) {
    logger.info(`\nCodebase is already up-to-date.`);
    return;
  }

  logger.info(`Vectorizing ${filesToIndex.length} new or modified files...`);

  // Create and start the progress bar
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(filesToIndex.length, 0);

  for (const file of filesToIndex) {
    const content = await fs.readFile(file, 'utf-8');
    await updateVectorIndex(file, content, aiClient);
    await updateCache(file, { vectorizedAt: new Date().toISOString() });
    progressBar.increment();
  }

  progressBar.stop();
  logger.info(`\nSuccessfully vectorized ${filesToIndex.length} files.`);
}