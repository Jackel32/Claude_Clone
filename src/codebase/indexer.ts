/**
 * @file src/codebase/indexer.ts
 * @description Caching mechanism for file analysis.
 */

import * as crypto from 'crypto';
import * as path from 'path';
// FIX: Use fs/promises directly for more control over error handling
import { promises as fs } from 'fs';
import { writeFile } from '../fileops/writer.js';
import { CACHE_DIR } from '../config/index.js';

const CACHE_FILE = path.join(CACHE_DIR, 'analysis_cache.json');

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
async function loadCache(): Promise<AnalysisCache> {
  // FIX: This new implementation specifically handles the ENOENT error silently.
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    // If the file doesn't exist, this is expected on the first run.
    // Return an empty object and don't log an error.
    if (error.code === 'ENOENT') {
      return {};
    }
    // For any other unexpected error, re-throw it so we know about it.
    throw error;
  }
}

/**
 * Saves the analysis cache to disk.
 * @param {AnalysisCache} cache - The cache object to save.
 */
async function saveCache(cache: AnalysisCache): Promise<void> {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Checks if a file has a valid, up-to-date analysis in the cache.
 * @param {string} filePath - The path of the file to check.
 * @returns {Promise<any | null>} The cached analysis if valid, otherwise null.
 */
export async function checkCache(filePath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = getHash(content);
    const cache = await loadCache();

    if (cache[filePath] && cache[filePath].hash === hash) {
      return cache[filePath].analysis;
    }
  } catch (error) {
    // File might have been deleted, etc.
  }
  return null;
}

/**
 * Updates the cache with a new analysis for a file.
 * @param {string} filePath - The path of the file to update.
 * @param {any} analysis - The new analysis result to store.
 */
export async function updateCache(filePath: string, analysis: any): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const hash = getHash(content);
  const cache = await loadCache();

  cache[filePath] = { hash, analysis };
  await saveCache(cache);
}