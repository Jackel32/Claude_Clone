/**
 * @file src/codebase/indexer.ts
 * @description Caching mechanism for file analysis.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { writeFile } from '../fileops/index.js';
import { getProjectCacheDir } from './cache-manager.js';
import { scanProject } from './scanner.js';
import { logger } from '../logger/index.js';

const VALID_EXTENSIONS = new Set(['.ts', '.js', '.jsx', '.tsx', '.py', '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.md', '.json', '.html', '.css']);

interface CacheEntry {
  hash: string;
  analysis: any;
}

type AnalysisCache = Record<string, CacheEntry>;

function getHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

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

export async function saveCache(projectRoot: string, cache: AnalysisCache): Promise<void> {
  const projectCacheDir = await getProjectCacheDir(projectRoot);
  const cacheFile = path.join(projectCacheDir, 'analysis_cache.json');
  await writeFile(cacheFile, JSON.stringify(cache, null, 2));
}

export async function checkCache(projectRoot: string, filePath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = getHash(content);
    const cache = await loadCache(projectRoot);
    if (cache[filePath] && cache[filePath].hash === hash) {
      return cache[filePath].analysis;
    }
  } catch (error) {
    // This can happen if a file is deleted between scanning and checking. It's safe to ignore.
  }
  return null;
}

export async function updateCache(projectRoot: string, filePath: string, analysis: any): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const hash = getHash(content);
  const cache = await loadCache(projectRoot);
  cache[filePath] = { hash, analysis };
  await saveCache(projectRoot, cache);
}

export async function isIndexUpToDate(projectRoot: string): Promise<boolean> {
    const allFiles = await scanProject(projectRoot);
    // FIX: Filter the files using the same logic as the indexer
    const files = allFiles.filter(file => VALID_EXTENSIONS.has(path.extname(file).toLowerCase()));

    if (files.length === 0) return true;

    const cache = await loadCache(projectRoot);

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            const hash = getHash(content);
            if (!cache[file] || cache[file].hash !== hash) {
                logger.debug(`isIndexUpToDate: Found out-of-date file -> ${file}`);
                return false;
            }
        } catch {
            logger.debug(`isIndexUpToDate: Could not read file, assuming out-of-date -> ${file}`);
            return false;
        }
    }

    return true;
}