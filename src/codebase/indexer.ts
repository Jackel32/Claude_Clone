/**
 * @file src/codebase/indexer.ts
 * @description Caching mechanism for file analysis. Refactored for performance and maintainability.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { writeFile } from '../fileops/index.js';
import { getProjectCacheDir } from './cache-manager.js';
import { scanProject } from './scanner.js'; // Added import
import { logger } from '../logger/index.js';

// Added constant for use in isIndexUpToDate
const VALID_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.md', '.json', '.html', '.css']);

interface CacheEntry {
  hash: string;
  analysis: any;
}

type AnalysisCache = Record<string, CacheEntry>;

function getHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export class Indexer {
  private projectRoot: string;
  private cachePath: string | null = null;
  private cache: AnalysisCache = {};

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async init(): Promise<void> {
    // ... (init method remains the same)
    const projectCacheDir = await getProjectCacheDir(this.projectRoot);
    this.cachePath = path.join(projectCacheDir, 'analysis_cache.json');
    
    try {
      const content = await fs.readFile(this.cachePath, 'utf-8');
      this.cache = JSON.parse(content);
      logger.info(`Loaded ${Object.keys(this.cache).length} entries from cache.`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info('No existing cache file found. Starting with an empty cache.');
        this.cache = {};
      } else {
        logger.error(`Error loading cache file at ${this.cachePath}:`, error);
        throw error;
      }
    }
  }

  async saveCache(): Promise<void> {
    // ... (saveCache method remains the same)
    if (!this.cachePath) {
        throw new Error("Indexer not initialized. Call init() before saving.");
    }
    await writeFile(this.cachePath, JSON.stringify(this.cache, null, 2));
    logger.info(`Successfully saved ${Object.keys(this.cache).length} entries to cache.`);
  }

  async updateEntry(filePath: string, analysis: any): Promise<void> {
    // ... (updateEntry method remains the same)
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = getHash(content);
        this.cache[filePath] = { hash, analysis };
    } catch(error: any) {
        logger.error(`Failed to update cache entry for ${filePath}:`, error);
    }
  }

  // --- Start of Corrected/Added Section ---

  /**
   * Checks if the entire index is up-to-date by scanning all project files
   * and comparing them against the in-memory cache.
   */
  async isIndexUpToDate(): Promise<boolean> {
    logger.info(`Checking if index is up to date for project: ${this.projectRoot}`);
    const allFiles = await scanProject(this.projectRoot);
    const files = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));

    if (files.length === 0) {
      logger.info('No relevant files to check, index is considered up to date.');
      return true;
    }
    
    for (const file of files) {
      if (await this.isEntryStale(file)) {
        logger.info(`Change detected (or file not in cache): ${file}`);
        return false;
      }
    }

    logger.info('Index is up to date.');
    return true;
  }

  getCache(): AnalysisCache {
    // ... (getCache method remains the same)
    return this.cache;
  }

  removeEntries(filePaths: string[]): void {
    // ... (removeEntries method remains the same)
    for (const filePath of filePaths) {
      delete this.cache[filePath];
    }
    logger.info(`Removed ${filePaths.length} entries from in-memory cache.`);
  }

  async isEntryStale(filePath: string): Promise<boolean> {
    const entry = this.cache[filePath];
    if (!entry) return true; // File is new

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const currentHash = getHash(content);

      // --- Add this logging block ---
      if (entry.hash !== currentHash) {
        logger.warn(`Hash mismatch detected for: ${filePath}`);
        logger.debug(`  -> Cached Hash:  ${entry.hash}`);
        logger.debug(`  -> Current Hash: ${currentHash}`);
        return true; // File has been modified
      }
      // --- End of logging block ---

      return false; // Hashes match, entry is not stale
    } catch {
      return true; // File is unreadable or deleted, treat as stale
    }
  }
}