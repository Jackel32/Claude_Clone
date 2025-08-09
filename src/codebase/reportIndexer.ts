/**
 * @file src/codebase/reportIndexer.ts
 * @description Manages a persistent cache for AI-generated file summaries.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../logger/index.js';
import { getProjectCacheDir } from './cache-manager.js';

interface ReportEntry {
  hash: string;
  summary: string;
  timestamp: number;
}

type ReportAnalysisCache = { [filePath: string]: ReportEntry };

/**
 * Manages the caching of file summaries to avoid re-summarizing unchanged files.
 */
export class ReportIndexer {
  private projectRoot: string;
  private cacheFilePath: string = '';
  private cache: ReportAnalysisCache = {};

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Loads the report cache from disk for the current project.
   * This must be called before any other methods.
   */
  async init(): Promise<void> {
    const projectCacheDir = await getProjectCacheDir(this.projectRoot);
    this.cacheFilePath = path.join(projectCacheDir, 'report-cache.json');
    
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      this.cache = JSON.parse(data);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(error, `Error loading report cache`);
      }
      this.cache = {};
    }
  }

  getHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Saves the current in-memory cache to a file on disk.
   */
  async saveCache(): Promise<void> {
    try {
      await fs.writeFile(this.cacheFilePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      logger.error(error, `Error saving report cache`);
    }
  }

  /**
   * Retrieves the current in-memory cache.
   * @returns The cache object.
   */
  getCache(): ReportAnalysisCache {
    return this.cache;
  }

  /**
   * Checks if a file's summary in the cache is stale (file is new, modified, or deleted).
   * @param filePath The absolute path to the file.
   * @returns True if the file needs to be re-summarized, false otherwise.
   */
  async isEntryStale(filePath: string): Promise<boolean> {
    const entry = this.cache[filePath];
    if (!entry) return true; // File is new to the cache

    try {
      const stats = await fs.stat(filePath);
      // Check timestamp first for a quick check
      if (stats.mtimeMs > entry.timestamp) {
        // If modified, verify with a hash for certainty
        const content = await fs.readFile(filePath, 'utf-8');
        const currentHash = this.getHash(content);
        return entry.hash !== currentHash;
      }
      return false; // Not stale
    } catch (e: any) {
      if (e.code === 'ENOENT') return true; // File was deleted
      logger.error(e, `Error checking staleness for ${filePath}`);
      return true; // Error, assume stale to be safe
    }
  }

  /**
   * Updates or adds an entry to the in-memory cache.
   * @param filePath The path of the file.
   * @param hash The content hash of the file.
   * @param summary The AI-generated summary.
   */
  updateEntry(filePath: string, hash: string, summary: string): void {
    this.cache[filePath] = { hash, summary, timestamp: Date.now() };
  }

  /**
   * Removes a list of entries from the in-memory cache.
   * @param filePaths An array of file paths to remove.
   */
  removeEntries(filePaths: string[]): void {
    for (const filePath of filePaths) {
      delete this.cache[filePath];
    }
    logger.info(`Removed ${filePaths.length} stale entries from report cache.`);
  }
}