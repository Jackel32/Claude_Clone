/**
 * @file Contains file reading utility functions.
 */

import * as fs from 'fs/promises';

/**
 * Asynchronously reads the content of a file.
 * @param filePath - The absolute or relative path to the file.
 * @returns A promise that resolves to the file's content as a UTF-8 string.
 * @throws An error if the file cannot be read.
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error);
    throw error;
  }
}