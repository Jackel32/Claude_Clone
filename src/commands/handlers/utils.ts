/**
 * @file src/commands/handlers/utils.ts
 * @description Utility functions for command handlers.
 */

import { promises as fs } from 'fs';
import * as diff from 'diff';
import { AppContext } from '../../types.js';

/**
 * Extracts code from a markdown block (e.g., ```typescript\n...\n```).
 * @param {string} rawResponse - The raw response from the AI.
 * @returns {string} The extracted code.
 */
export function extractCode(rawResponse: string): string {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]+?)\n```/;
  const match = rawResponse.match(codeBlockRegex);
  return match ? match[1].trim() : rawResponse.trim();
}

/**
 * Shows a diff of changes to the user and prompts for confirmation before writing to a file.
 * @param filePath The path to the file to be modified.
 * @param originalContent The original content of the file.
 * @param newContent The new, modified content.
 * @param context The application context.
 */
export async function confirmAndApplyChanges(filePath: string, originalContent: string, newContent: string, context: AppContext): Promise<void> {
  const { logger } = context;
  
  logger.info('\n--- Proposed Changes ---');
  
  const changes = diff.createPatch(filePath, originalContent, newContent, '', '');
  
  changes.split('\n').forEach(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      console.log('\x1b[32m%s\x1b[0m', line); // Green
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      console.log('\x1b[31m%s\x1b[0m', line); // Red
    } else {
      console.log(line);
    }
  });

  logger.info('--- End of Changes ---');

  const { default: inquirer } = await import('inquirer');
  const { apply } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'apply',
      message: 'Apply these changes?',
      default: false,
    },
  ]);

  if (apply) {
    await fs.writeFile(filePath, newContent, 'utf-8');
    logger.info(`Changes applied to ${filePath}`);
  } else {
    logger.info('Changes discarded.');
  }
}