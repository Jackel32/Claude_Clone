/**
 * @file src/codebase/cache-manager.ts
 * @description Manages project-specific cache directories.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { CACHE_DIR } from '../config/index.js';

/**
 * Generates a stable, unique ID for a project based on its root path.
 * @param projectRoot The absolute path to the project's root.
 * @returns A SHA256 hash representing the project ID.
 */
function getProjectId(projectRoot: string): string {
  return crypto.createHash('sha256').update(projectRoot).digest('hex').substring(0, 16);
}

/**
 * Gets the path to the dedicated cache directory for a specific project.
 * Ensures the directory exists.
 * @param projectRoot The absolute path to the project's root.
 * @returns The path to the project's cache directory.
 */
export async function getProjectCacheDir(projectRoot: string): Promise<string> {
  const projectId = getProjectId(projectRoot);
  const projectCacheDir = path.join(CACHE_DIR, projectId);
  await fs.mkdir(projectCacheDir, { recursive: true });
  return projectCacheDir;
}