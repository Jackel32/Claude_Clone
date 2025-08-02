/**
 * @file Contains file writing utility functions.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Asynchronously writes content to a file.
 * It creates the directory structure if it doesn't exist.
 * @param filePath - The absolute or relative path to the file.
 * @param content - The string content to write to the file.
 * @returns A promise that resolves when the file has been written.
 * @throws An error if the file cannot be written.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`Error writing file to ${filePath}:`, error);
    throw error;
  }
}