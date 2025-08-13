/**
 * @file Contains file reading utility functions.
 */

import * as fs from 'fs/promises';

/**
 * Asynchronously reads the content of a file.
 * @param filePath - The absolute or relative path to the file.
 * @returns A promise that resolves to the file's content as a UTF-8 string.
 * @throws An error if the file cannot be read (e.g., permissions, not found).
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}
