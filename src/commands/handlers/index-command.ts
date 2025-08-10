/**
 * @file src/commands/handlers/index-command.ts
 * @description A simple wrapper that runs the core indexing logic for the CLI.
 */

import { AppContext } from '../../types.js';
import { runIndex, runInit } from '../../core/index-core.js';
import { AgentUpdate } from '../../core/agent-core.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { constructInitPrompt, gatherFileContext } from '../../ai/index.js';
import { scanProject } from '../../codebase/index.js';
import * as cliProgress from 'cli-progress';
import { logger } from '../../logger/index.js';

/**
 * Handles the CLI UI for indexing a codebase.
 * @param {AppContext} context - The application context.
 */
export async function handleIndexCommand(context: AppContext): Promise<void> {
  const progressBar = new cliProgress.SingleBar({
    format: '{bar} | {percentage}% || {task}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  }, cliProgress.Presets.shades_classic);
  
  let totalFiles = 0;
  let processedFiles = 0;

  const onUpdate = (update: AgentUpdate) => {
    switch (update.type) {
      case 'thought':
        // Stop the bar to print a thought, then restart it if needed
        progressBar.stop();
        logger.info(update.content);
        if (totalFiles > 0) progressBar.start(totalFiles, processedFiles);
        break;

      case 'action':
        if (update.content.startsWith('start-indexing')) {
            totalFiles = parseInt(update.content.split('|')[1], 10);
            progressBar.start(totalFiles, 0);
        } else if (update.content === 'file-processed') {
            processedFiles++;
            progressBar.update(processedFiles);
        } else if (update.content.trim().startsWith('chunk')) {
            // Update the text to show chunk progress for the current file
            progressBar.update(processedFiles, { task: update.content.trim() });
        }
        break;

      case 'finish':
        progressBar.update(totalFiles, { task: 'Completed!' }); // Make sure bar is full
        progressBar.stop();
        logger.info(`\n✨ ${update.content}`);
        break;

      case 'error':
        progressBar.stop();
        logger.error(`\n❌ An error occurred during indexing: ${update.content}`);
        break;
    }
  };

  await runIndex(context, onUpdate);
}

export async function handleInitCommand(context: AppContext): Promise<void> {
  const { logger } = context;
  
  const onUpdate = (update: AgentUpdate) => {
    switch (update.type) {
      case 'thought':
        process.stdout.write('\n'); // Newline before thought
        logger.info(`[AI] ${update.content}`);
        break;
      case 'action':
        // Keep this on one line
        process.stdout.write(`\r[INFO] ${update.content}`);
        break;
      case 'stream-start':
        process.stdout.write('\n\n--- AI Response ---\n');
        break;
      case 'stream-chunk':
        process.stdout.write(update.content);
        break;
      case 'stream-end':
        process.stdout.write('\n--- End of Response ---\n\n');
        break;
      case 'finish':
        logger.info(update.content);
        break;
      case 'error':
        process.stdout.write('\n');
        logger.error(`An error occurred during initialization: ${update.content}`);
        break;
    }
  };

  await runInit(context, onUpdate);
}