/**
 * @file Functions for gathering and formatting context for the AI.
 */

import { readFile } from '../fileops/reader.js';

/**
 * Reads multiple files and formats their contents into a single string
 * using XML-like tags for clear separation.
 *
 * @param filePaths - An array of file paths to read.
 * @returns A promise that resolves to a single string containing all file
 * contents, formatted for the AI prompt.
 */
export async function gatherFileContext(filePaths: string[]): Promise<string> {
  let contextString = '';

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath);
      contextString += `<file path="${filePath}">\n${content}\n</file>\n\n`;
    } catch (error) {
      contextString += `<file path="${filePath}">\n--- Error reading file ---\n</file>\n\n`;
    }
  }

  return contextString.trim();
}