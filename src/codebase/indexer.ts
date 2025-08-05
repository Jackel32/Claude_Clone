/**
 * @file src/codebase/indexer.ts
 * @description Caching mechanism for file analysis.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { writeFile } from '../fileops/writer.js';
import { getProjectCacheDir } from './cache-manager.js';
import { scanProject } from './scanner.js';

interface CacheEntry {
  hash: string;
  analysis: any;
}

type AnalysisCache = Record<string, CacheEntry>;

/**
 * Computes the SHA256 hash of a string.
 * @param {string} content - The content to hash.
 * @returns {string} The hex-encoded SHA256 hash.
 */
function getHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Loads the analysis cache from disk.
 * @returns {Promise<AnalysisCache>} The loaded cache object.
 */
export async function loadCache(projectRoot: string): Promise<AnalysisCache> {
  const projectCacheDir = await getProjectCacheDir(projectRoot);
  const cacheFile = path.join(projectCacheDir, 'analysis_cache.json');
  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * Saves the analysis cache to disk.
 * @param {AnalysisCache} cache - The cache object to save.
 */
export async function saveCache(projectRoot: string, cache: AnalysisCache): Promise<void> {
  const projectCacheDir = await getProjectCacheDir(projectRoot);
  const cacheFile = path.join(projectCacheDir, 'analysis_cache.json');
  await writeFile(cacheFile, JSON.stringify(cache, null, 2));
}

/**
 * Checks if a file has a valid, up-to-date analysis in the cache.
 * @param {string} filePath - The path of the file to check.
 * @returns {Promise<any | null>} The cached analysis if valid, otherwise null.
 */
export async function checkCache(projectRoot: string, filePath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = getHash(content);
    const cache = await loadCache(projectRoot); // Pass projectRoot
    if (cache[filePath] && cache[filePath].hash === hash) {
      return cache[filePath].analysis;
    }
  } catch (error) {}
  return null;
}

/**
 * Updates the cache with a new analysis for a file.
 * @param {string} filePath - The path of the file to update.
 * @param {any} analysis - The new analysis result to store.
 */
export async function updateCache(projectRoot: string, filePath: string, analysis: any): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const hash = getHash(content);
  const cache = await loadCache(projectRoot); // Pass projectRoot
  cache[filePath] = { hash, analysis };
  await saveCache(projectRoot, cache); // Pass projectRoot
}

/**
 * Checks if all files in a project are present and up-to-date in the cache.
 * @param projectRoot The root of the project to check.
 * @returns True if the index is complete and up-to-date, false otherwise.
 */
export async function isIndexUpToDate(projectRoot: string): Promise<boolean> {
    const files = await scanProject(projectRoot);
    if (files.length === 0) return true; // An empty project is up-to-date

    // Check a sample of files to speed things up, or check all for full accuracy.
    // Here we check all files.
    for (const file of files) {
        const isFileInCache = await checkCache(projectRoot, file);
        if (!isFileInCache) {
            // As soon as we find one file that is not up-to-date, we know.
            return false;
        }
    }

    return true;
}