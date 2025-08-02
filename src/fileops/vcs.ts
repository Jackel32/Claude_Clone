import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec for async/await syntax
const execAsync = promisify(exec);

/**
 * Checks if a directory is a Git repository by looking for a .git directory.
 * @param {string} [startPath=''] - The path to start checking from. Defaults to the current working directory.
 * @returns {Promise<boolean>} True if it's a Git repository, false otherwise.
 */
export async function isGitRepository(startPath: string = '.'): Promise<boolean> {
  const gitRoot = await findGitRoot(startPath);
  return !!gitRoot;
}

/**
 * Finds the root directory of the Git repository by traversing up from a starting path.
 * @param {string} [startPath=''] - The path to start searching from.
 * @returns {Promise<string | null>} The path to the Git root, or null if not found.
 */
export async function findGitRoot(startPath: string = '.'): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  while (currentPath !== path.parse(currentPath).root) {
    const gitPath = path.join(currentPath, '.git');
    try {
      const stats = await fs.stat(gitPath);
      if (stats.isDirectory()) {
        return currentPath;
      }
    } catch (error) {
      // ignore error, means file/dir doesn't exist
    }
    currentPath = path.dirname(currentPath);
  }
  return null;
}

/**
 * Executes `git diff HEAD~1 HEAD` to get the changes from the last commit.
 * @returns {Promise<string>} The output of the git diff command.
 */
export async function getLatestCommitDiff(): Promise<string> {
  try {
    const { stdout } = await execAsync('git diff HEAD~1 HEAD');
    return stdout;
  } catch (error: any) {
    if (error.message.includes('unknown revision')) {
        throw new Error('Could not get diff. This might be the first commit in the repository.');
    }
    throw error;
  }
}