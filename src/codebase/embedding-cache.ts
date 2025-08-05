/**
 * @file src/codebase/embedding-cache.ts
 * @description Manages caching for vector embeddings to reduce API calls.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { getProjectCacheDir } from './cache-manager.js';

type EmbeddingCache = Record<string, number[]>;

function getChunkHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

async function loadEmbeddingCache(projectRoot: string): Promise<EmbeddingCache> {
    const projectCacheDir = await getProjectCacheDir(projectRoot);
    const cacheFile = path.join(projectCacheDir, 'embedding_cache.json');
    try {
        const content = await fs.readFile(cacheFile, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {};
    }
}

async function saveEmbeddingCache(projectRoot: string, cache: EmbeddingCache): Promise<void> {
    const projectCacheDir = await getProjectCacheDir(projectRoot);
    const cacheFile = path.join(projectCacheDir, 'embedding_cache.json');
    await fs.writeFile(cacheFile, JSON.stringify(cache));
}

export async function getEmbeddingFromCache(text: string, projectRoot: string): Promise<number[] | null> {
    const hash = getChunkHash(text);
    const cache = await loadEmbeddingCache(projectRoot);
    return cache[hash] || null;
}

export async function storeEmbeddingInCache(text: string, embedding: number[], projectRoot: string): Promise<void> {
    const hash = getChunkHash(text);
    const cache = await loadEmbeddingCache(projectRoot);
    cache[hash] = embedding;
    await saveEmbeddingCache(projectRoot, cache);
}