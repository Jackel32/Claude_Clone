/**
 * @file src/commands/handlers/report.ts
 * @description Handler for the 'report' command.
 */

import { scanProject } from '../../codebase/scanner.js';
import { gatherFileContext, constructPrompt, processStream } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import { AgentUpdate } from '../../core/agent-core.js';

/**
 * Handles the logic for generating a full codebase report.
 * @param {AppContext} context - The application context.
 */
export async function handleReportCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider } = context;

  logger.info('Scanning project to generate report...');
  const files = await scanProject('.');
  
  if (files.length === 0) {
    logger.info('No files found to analyze.');
    return;
  }

  logger.info(`Gathering context from ${files.length} files... (This may take a moment)`);
  const onUpdate = (update: AgentUpdate) => {
      if (update.type === 'action') {
          // Use process.stdout.write to keep it on one line
          process.stdout.write(`\r${update.content}`);
      }
  };
  const fileContext = await gatherFileContext(files, onUpdate);
  process.stdout.write('\n'); // Newline after finishing

  const reportQuery = `Analyze the entire codebase provided in the context and generate a high-level technical report. The report should include:
1.  **Overall Architecture:** A brief description of the project's structure.
2.  **Key Components:** Identify the main modules/directories and describe their responsibilities.
3.  **Data Flow:** Explain how a typical command flows through the application.
4.  **Potential Improvements:** Suggest 1-2 areas for potential refactoring.`;
  
  logger.info('Constructing prompt and calling AI for analysis...');
  const prompt = constructPrompt(reportQuery, fileContext);
  
  try {
    logger.info('\n--- AI Codebase Report ---');
    const stream = await aiProvider.invoke(prompt, true);
    await processStream(stream);
    logger.info('--- End of Report ---\n');
  } catch (error) {
    logger.error(error, 'AI API Error during report command');
  }
}
