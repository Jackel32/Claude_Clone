import { AppContext } from '../../types.js';
import { runIndex, runInit } from '../../core/index-core.js';
import { AgentUpdate } from '../../core/agent-core.js';
import { logger } from '../../logger/index.js';

export async function handleIndexCommand(context: AppContext): Promise<void> {
  const cliProgress = await import('cli-progress');
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  let totalFiles = 0;
  let processedFiles = 0;

  const onUpdate = (update: AgentUpdate) => {
    switch (update.type) {
      case 'thought':
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
        }
        break;
      case 'finish':
        progressBar.update(totalFiles);
        progressBar.stop();
        logger.info(`\n✨ ${update.content}`);
        break;
      case 'error':
        progressBar.stop();
        logger.error(`\n❌ An error occurred: ${update.content}`);
        break;
    }
  };

  await runIndex(context, onUpdate);
}

export async function handleInitCommand(context: AppContext): Promise<void> {
  const cliProgress = await import('cli-progress');
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  let totalFiles = 0;
  let processedFiles = 0;

  const onUpdate = (update: AgentUpdate) => {
    switch (update.type) {
      case 'thought':
        progressBar.stop();
        logger.info(update.content);
        if (totalFiles > 0) progressBar.start(totalFiles, processedFiles);
        break;
      case 'action':
        if (update.content.startsWith('start-initialization')) {
          totalFiles = parseInt(update.content.split('|')[1], 10);
          progressBar.start(totalFiles, 0);
        } else if (update.content === 'file-processed') {
          processedFiles++;
          progressBar.update(processedFiles);
        }
        break;
      case 'finish':
        progressBar.update(totalFiles);
        progressBar.stop();
        logger.info(`\n✨ ${update.content}`);
        break;
      case 'error':
        progressBar.stop();
        logger.error(`\n❌ An error occurred: ${update.content}`);
        break;
    }
  };

  await runInit(context, onUpdate);
}