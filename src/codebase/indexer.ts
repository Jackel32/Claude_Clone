/**
 * @file Manages caching of file analysis to avoid re-processing unchanged files.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { getCacheDir } from '../config';
import { readFile, writeFile } from '../fileops';

const CACHE_FILE = 'analysis_cache.json';

interface CacheEntry {
  hash: string;
  analysis: any; // Could be a more specific type for analysis results
  timestamp: number;
}

interface AnalysisCache {
  [filePath: string]: CacheEntry;
}

/**
 * Computes the SHA256 hash of a file's content.
 * @param content - The content of the file.
 * @returns The SHA256 hash as a hex string.
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Loads the entire analysis cache from the disk.
 * @returns A promise that resolves to the `AnalysisCache` object.
 */
async function loadCache(): Promise<AnalysisCache> {
  const cachePath = path.join(getCacheDir(), CACHE_FILE);
  try {
    const content = await readFile(cachePath);
    return JSON.parse(content) as AnalysisCache;
  } catch (error) {
    // Cache file doesn't exist or is invalid, return empty cache
    return {};
  }
}

/**
 * Saves the entire analysis cache to the disk.
 * @param cache - The `AnalysisCache` object to save.
 * @returns A promise that resolves when the cache is saved.
 */
async function saveCache(cache: AnalysisCache): Promise<void> {
  const cachePath = path.join(getCacheDir(), CACHE_FILE);
  await writeFile(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Checks if a valid, up-to-date analysis exists in the cache for a given file.
 * @param filePath - The absolute path of the file to check.
 * @returns A promise that resolves to the cached analysis if valid, otherwise null.
 */
export async function checkCache(filePath: string): Promise<any | null> {
  const cache = await loadCache();
  const entry = cache[filePath];
  if (!entry) {
    return null;
  }

  try {
    const content = await readFile(filePath);
    const currentHash = computeHash(content);
    if (currentHash === entry.hash) {
      return entry.analysis; // Cache hit
    }
  } catch (error) {
    // File might have been deleted, treat as cache miss
    return null;
  }
  
  return null; // Cache miss (hash mismatch)
}

/**
 * Updates the cache with a new analysis for a given file.
 * @param filePath - The absolute path of the file being updated.
 * @param analysis - The new analysis result to store.
 * @returns A promise that resolves when the cache has been updated.
 */
export async function updateCache(filePath: string, analysis: any): Promise<void> {
  const cache = await loadCache();
  try {
    const content = await readFile(filePath);
    const hash = computeHash(content);
    cache[filePath] = {
      hash,
      analysis,
      timestamp: Date.now(),
    };
    await saveCache(cache);
  } catch(error) {
    console.error(`Failed to update cache for ${filePath}`, error);
  }
}