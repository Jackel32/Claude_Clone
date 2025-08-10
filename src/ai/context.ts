/**
 * @file Functions for gathering and formatting context for the AI.
 */

import { readFile } from '../fileops/reader.js';
import { AgentCallback } from '../core/agent-core.js';
import * as path from 'path';

/**
 * Reads multiple files and formats their contents into a single string
 * using XML-like tags for clear separation.
 *
 * @param filePaths - An array of file paths to read.
 * @param onUpdate - A callback to report progress updates.
 * @returns A promise that resolves to a single string containing all file
 * contents, formatted for the AI prompt.
 */
export async function gatherFileContext(filePaths: string[], onUpdate: AgentCallback): Promise<string> {
  let contextString = '';

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    // Send an action update with the progress, now using the full relative path.
    onUpdate({ type: 'action', content: `Reading ${i + 1}/${filePaths.length}: ${filePath}` });
    try {
      const content = await readFile(filePath);
      contextString += `<file path="${filePath}">\n${content}\n</file>\n\n`;
    } catch (error) {
      contextString += `<file path="${filePath}">\n--- Error reading file ---\n</file>\n\n`;
    }
  }

  return contextString.trim();
}
