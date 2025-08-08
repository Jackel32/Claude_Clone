/**
 * @file src/fileops/vcs.ts
 * @description Utilities for interacting with the version control system (Git).
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process'; // Only spawn is needed now
import { logger } from '../logger/index.js';

/**
 * A robust helper for running any git command using spawn.
 * @param args An array of string arguments for the git command.
 * @returns {Promise<string>} The stdout from the command.
 */
function runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const git = spawn('git', args, { cwd });
        let stdout = '';
        let stderr = '';

        git.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        git.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        git.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`Git command failed with code ${code}: ${stderr.trim()}`));
            }
        });

        git.on('error', (err) => {
            reject(err);
        });
    });
}

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
 * Fetches the last 20 commits from the repository in a formatted list.
 * @returns {Promise<string[]>} A list of formatted commit strings.
 */
export async function getRecentCommits(cwd: string): Promise<string[]> {
  try {
    const output = await runGitCommand(['log', '--pretty=format:%h|%an|%ar|%s', '-n', '20'], cwd);
    if (!output) {
        return [];
    }
    return output.split('\n');
  } catch (error) {
    logger.error(error, "Failed to execute 'git log' command");
    return [];
  }
}

/**
 * Gets the diff between two commit hashes.
 * @param {string} startHash The older commit hash.
 * @param {string} endHash The newer commit hash.
 * @returns {Promise<string>} The output of the git diff command.
 */
export async function getDiffBetweenCommits(startHash: string, endHash: string, cwd: string): Promise<string> {
  try {
    return await runGitCommand(['diff', startHash, endHash], cwd);
  } catch (error: any) {
    if (error.message.includes('unknown revision')) {
        throw new Error(`Could not get diff. One of the commits may be invalid.`);
    }
    throw error;
  }
}

/**
 * Clones a git repository into a specified local path using a Personal Access Token.
 * @param repoUrl The HTTPS URL of the repository (e.g., https://github.com/user/repo.git).
 * @param pat The Personal Access Token for authentication.
 * @param localPath The local directory to clone the repo into.
 */
export async function cloneRepo(repoUrl: string, pat: string, localPath: string): Promise<void> {
    // Inject the PAT into the URL for authentication
    const authedUrl = repoUrl.replace('https://', `https://oauth2:${pat}@`);
    await runGitCommand(['clone', authedUrl, localPath], '.');
}

/**
 * Fetches all local and remote branches from the repository.
 * @param cwd The directory of the git repository.
 * @returns A list of branch names.
 */
export async function getBranches(cwd: string): Promise<string[]> {
    try {
        const output = await runGitCommand(['branch', '-a'], cwd);
        if (!output) return [];
        // Clean up the git branch output
        return output.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.includes('->')) // Filter out the HEAD pointer
            .map(line => line.replace(/^\*\s*/, '')); // Remove the '*' from the current branch
    } catch (error) {
        logger.error(error, "Failed to execute 'git branch' command");
        return [];
    }
}

/**
 * Gets the diff between two branches.
 * @param baseBranch The base branch (e.g., 'main').
 * @param compareBranch The branch with the new changes (e.g., 'feature/new-login').
 * @param cwd The directory of the git repository.
 * @returns The output of the git diff command.
 */
export async function getDiffBetweenBranches(baseBranch: string, compareBranch: string, cwd: string): Promise<string> {
    // The '...' syntax shows changes on compareBranch since it diverged from baseBranch
    return await runGitCommand(['diff', `${baseBranch}...${compareBranch}`], cwd);
}