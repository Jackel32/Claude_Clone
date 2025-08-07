/**
 * @file src/commands/handlers/index-command.ts
 * @description A simple wrapper that runs the core indexing logic for the CLI.
 */

import { AppContext } from '../../types.js';
import { runIndex } from '../../core/index-core.js';
import { AgentUpdate } from '../../core/agent-core.js';

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

  // This is a final check to ensure the file counter is updated after each file is fully processed
  // This part of the logic has been moved inside the onUpdate handler to be more reactive.
}