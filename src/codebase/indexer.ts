import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { getProjectCacheDir } from './cache-manager.js';
import { scanProject } from './scanner.js';
import { logger } from '../logger/index.js';
import { isIndexCreated } from './vectorizer.js';

const VALID_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.md', '.json', '.html', '.css']);

interface CacheEntry { 
  hash: string; 
  analysis: {
    vectorizedAt?: string;
    symbols?: string[];
  }; 
}
type AnalysisCache = Record<string, CacheEntry>;

function getHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const indexerInstances: Map<string, Indexer> = new Map();

export class Indexer {
  private projectRoot: string;
  private cachePath: string | null = null;
  private cache: AnalysisCache = {};

  constructor(projectRoot: string) { this.projectRoot = projectRoot; }

  async init(): Promise<void> {
    const projectCacheDir = await getProjectCacheDir(this.projectRoot);
    this.cachePath = path.join(projectCacheDir, 'analysis_cache.json');
    try {
      const content = await fs.readFile(this.cachePath, 'utf-8');
      this.cache = JSON.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') { throw error; }
      this.cache = {};
    }
  }

  async saveCache(): Promise<void> {
    if (!this.cachePath) throw new Error("Indexer not initialized.");
    await fs.writeFile(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  async updateEntry(filePath: string, analysis: any): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = getHash(content);
      // Ensure analysis object exists
      if (!this.cache[filePath]) {
        this.cache[filePath] = { hash, analysis: {} };
      }
      this.cache[filePath].hash = hash;
      this.cache[filePath].analysis = { ...this.cache[filePath].analysis, ...analysis };
    } catch (error: any) {
      logger.error(`Failed to update cache entry for ${filePath}:`, error);
    }
  }

  async isIndexUpToDate(): Promise<boolean> {
    if (!(await isIndexCreated(this.projectRoot))) return false;
    const allFiles = await scanProject(this.projectRoot);
    const files = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));
    const cachedFiles = Object.keys(this.cache);
    if (files.length !== cachedFiles.length) return false;
    for (const file of files) {
      if (await this.isEntryStale(file)) return false;
    }
    return true;
  }

  getCache(): AnalysisCache { return this.cache; }

  removeEntries(filePaths: string[]): void {
    filePaths.forEach(filePath => delete this.cache[filePath]);
  }

  async isEntryStale(filePath: string): Promise<boolean> {
    const entry = this.cache[filePath];
    if (!entry) return true;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return entry.hash !== getHash(content);
    } catch {
      return true;
    }
  }
}

export async function getIndexer(projectRoot: string): Promise<Indexer> {
  if (indexerInstances.has(projectRoot)) {
    return indexerInstances.get(projectRoot)!;
  }
  const newIndexer = new Indexer(projectRoot);
  await newIndexer.init();
  indexerInstances.set(projectRoot, newIndexer);
  return newIndexer;
}