/**
 * @file Utilities for interacting with Version Control Systems (VCS), primarily Git.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Checks if a given directory is the root of a Git repository.
 * @param dirPath - The directory path to check. Defaults to the current working directory.
 * @returns A promise that resolves to true if it is a Git repository, false otherwise.
 */
export async function isGitRepository(dirPath: string = process.cwd()): Promise<boolean> {
  try {
    const gitDirStat = await fs.stat(path.join(dirPath, '.git'));
    return gitDirStat.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Finds the root directory of the Git repository by traversing up from a starting path.
 * @param startPath - The path to start searching from. Defaults to the current working directory.
 * @returns A promise that resolves to the root directory path, or null if not found.
 */
export async function findGitRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const systemRoot = path.parse(currentPath).root;

  while (currentPath !== systemRoot) {
    if (await isGitRepository(currentPath)) {
      return currentPath;
    }
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) { // Reached the top without finding it
        break;
    }
    currentPath = parentPath;
  }
  
  // Final check at the very root for cases like '/'
  if (await isGitRepository(currentPath)) {
      return currentPath;
  }

  return null;
}