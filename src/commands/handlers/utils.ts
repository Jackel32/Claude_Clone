/**
 * @file src/commands/handlers/utils.ts
 * @description Utility functions for command handlers.
 */

import { promises as fs } from 'fs';
import * as diff from 'diff';
import { AppContext } from '../../types.js';
import { scanProject } from '../../codebase/index.js';
import inquirer from 'inquirer';

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
  changes.split('\n').forEach((line: string) => {
    if (line.startsWith('+') && !line.startsWith('+++')) console.log('\x1b[32m%s\x1b[0m', line);
    else if (line.startsWith('-') && !line.startsWith('---')) console.log('\x1b[31m%s\x1b[0m', line);
    else console.log(line);
  });
  logger.info('--- End of Changes ---');

  const { apply } = await inquirer.prompt([
    { type: 'confirm', name: 'apply', message: 'Apply these changes?', default: false },
  ]);

  if (apply) {
    await fs.writeFile(filePath, newContent, 'utf-8');
    logger.info(`✅ Changes applied to ${filePath}`);
  } else {
    logger.info('Changes discarded.');
  }
}

/**
 * Prompts the user to select a file from the project using a standard list.
 * @param message The message to display to the user.
 * @param context The application context.
 * @returns {Promise<string | null>} The path to the selected file.
 */
export async function promptForFile(message: string, context: AppContext): Promise<string | null> {
  const { logger } = context;
  logger.info('🔍 Scanning for project files (respecting .gitignore)...');
  const files = await scanProject('.');
  files.unshift('.. (Back to Main Menu)');

  const { filePath } = await inquirer.prompt([
    {
      type: 'list',
      name: 'filePath',
      message: message,
      choices: files,
      pageSize: 20,
    },
  ]);

  if (filePath === '.. (Back to Main Menu)') {
    return null;
  }
  return filePath;
}

/**
 * Finds and extracts a JSON object or array from a larger string.
 * @param {string} rawResponse - The raw response from the AI.
 * @returns {string} The extracted JSON string.
 */
export function extractJson(rawResponse: string): string {
    const markdownMatch = rawResponse.match(/```(?:json)?\n([\s\S]+?)\n```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }
    const firstBrace = rawResponse.indexOf('{');
    const firstBracket = rawResponse.indexOf('[');
    let start = -1;
    if (firstBrace === -1) start = firstBracket;
    else if (firstBracket === -1) start = firstBrace;
    else start = Math.min(firstBrace, firstBracket);
    if (start === -1) throw new Error("No JSON object or array found in the AI's response.");

    const lastBrace = rawResponse.lastIndexOf('}');
    const lastBracket = rawResponse.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);
    if (end === -1 || end < start) throw new Error("Valid JSON object or array could not be extracted.");
    
    return rawResponse.substring(start, end + 1).trim();
}