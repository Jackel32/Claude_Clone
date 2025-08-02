/**
 * @file Scans a project directory for relevant files, respecting .gitignore.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { default as ignore, Ignore } from 'ignore';
import { readFile } from '../fileops';

const ALWAYS_IGNORED = ['.git', 'node_modules'];

/**
 * Creates an ignore filter instance, loading rules from a .gitignore file if present.
 * @param projectRoot - The root directory of the project.
 * @returns A promise that resolves to an `ignore` instance.
 */
async function getIgnoreFilter(projectRoot: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(ALWAYS_IGNORED);

  const gitignorePath = path.join(projectRoot, '.gitignore');
  try {
    const gitignoreContent = await readFile(gitignorePath);
    ig.add(gitignoreContent);
  } catch (error) {
    // .gitignore not found or unreadable, which is fine.
  }
  return ig;
}

/**
 * Recursively scans a project directory and returns a list of all non-ignored files.
 * @param projectRoot - The absolute path to the root of the project to scan.
 * @returns A promise that resolves to an array of absolute file paths.
 */
export async function scanProject(projectRoot: string): Promise<string[]> {
  const fileList: string[] = [];
  const ig = await getIgnoreFilter(projectRoot);

  async function recursiveScan(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(projectRoot, fullPath);

        if (ig.ignores(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await recursiveScan(fullPath);
        } else if (entry.isFile()) {
          fileList.push(fullPath);
        }
      }
    } catch (err) {
        console.error(`Could not read directory: ${currentDir}`, err);
    }
  }

  await recursiveScan(projectRoot);
  return fileList;
}