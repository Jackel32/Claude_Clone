/**
 * @file src/codebase/scanner.ts
 * @description Scans a project directory for relevant files, respecting .gitignore and .kinchignore.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
// FIX: Use createRequire to bypass ESM import issues for the 'ignore' package.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ignore = require('ignore');

import { findGitRoot, isGitRepository, readFile } from '../fileops/index.js';

/**
 * Scans a project directory recursively and returns a list of all files,
 * respecting .gitignore and .kinchignore rules if present.
 * @param {string} projectRoot - The root directory of the project to scan.
 * @returns {Promise<string[]>} A list of absolute file paths.
 */
export async function scanProject(projectRoot: string): Promise<string[]> {
  const ig = ignore();
  
  // Always add default ignore patterns
  ig.add(['.git', 'node_modules', '.kinchignore']);

  // --- Read .gitignore ---
  const isGitRepo = await isGitRepository(projectRoot);
  if (isGitRepo) {
    const gitRoot = await findGitRoot(projectRoot);
    if (gitRoot) {
        const gitignorePath = path.join(gitRoot, '.gitignore');
        try {
          const gitignoreContent = await readFile(gitignorePath);
          ig.add(gitignoreContent);
        } catch (error) {
          // .gitignore not found, which is fine.
        }
    }
  }

  // --- Read .kinchignore (NEW) ---
  const kinchignorePath = path.join(projectRoot, '.kinchignore');
  try {
    const kinchignoreContent = await readFile(kinchignorePath);
    ig.add(kinchignoreContent);
  } catch (error) {
    // .kinchignore not found, which is also fine.
  }

  const files: string[] = [];
  const queue: string[] = [projectRoot];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            // Use a relative path from the project root for ignore checks
            const relativePath = path.relative(projectRoot, fullPath);

            if (ig.ignores(relativePath)) {
                continue;
            }

            if (entry.isDirectory()) {
                queue.push(fullPath);
            } else {
                files.push(fullPath);
            }
        }
    } catch (error) {
        // Ignore errors from directories we can't read (e.g., permissions)
    }
  }

  return files;
}
