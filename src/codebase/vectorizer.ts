/**
 * @file src/codebase/vectorizer.ts
 * @description Handles creating and querying the vector database.
 */

import * as path from 'path';
import { LocalIndex, QueryResult } from 'vectra';
import { AgentCallback } from '../core/agent-core.js';
import { AIProvider } from '../ai/providers/interface.js';
import { VectorIndexError } from '../errors/index.js';
import { getProjectCacheDir } from './cache-manager.js';

const indexInstances: Map<string, LocalIndex> = new Map();

/**
 * Splits code into manageable, overlapping chunks.
 * @param {string} content - The file content.
 * @returns {string[]} An array of text chunks.
 */
function chunkText(content: string): string[] {
  const chunks: string[] = [];
  const lines = content.split('\n');
  const chunkSize = 50; // 50 lines per chunk
  const overlap = 10;   // 10 lines of overlap

  for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
    const chunk = lines.slice(i, i + chunkSize).join('\n');
    chunks.push(chunk);
  }
  return chunks;
}

export async function getVectorIndex(projectRoot: string): Promise<LocalIndex> {
    if (indexInstances.has(projectRoot)) {
        return indexInstances.get(projectRoot)!;
    }
    const projectCacheDir = await getProjectCacheDir(projectRoot);
    const indexPath = path.join(projectCacheDir, 'vector_index');
    return new LocalIndex(indexPath);
}

/**
 * Creates and stores vector embeddings for a file.
 * @param {string} projectRoot - The path of the file being indexed.
 * @param {string} content - The content of the file.
 * @param {AIProvider} client - The AI client to generate embeddings.
 */
export async function updateVectorIndex(
    projectRoot: string,
    filePath: string,
    content: string,
    client: AIProvider,
    onUpdate: AgentCallback // Add the onUpdate callback parameter
): Promise<void> {
    const vectorIndex = await getVectorIndex(projectRoot);
    if (!(await vectorIndex.isIndexCreated())) {
        await vectorIndex.createIndex();
    }
    
    const chunks = chunkText(content);
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        // Report progress for the current chunk
        onUpdate({ type: 'action', content: `    chunk ${i + 1}/${chunks.length}...` });

        const vector = await client.embed(chunk, projectRoot);
        await vectorIndex.upsertItem({
            vector,
            metadata: { filePath, chunk: i + 1, content: chunk },
        });
    }
}

/**
 * Checks if a vector index has been created for a specific project.
 * @param projectRoot The root of the project to check.
 * @returns {Promise<boolean>} True if the index exists, false otherwise.
 */
export async function isIndexCreated(projectRoot: string): Promise<boolean> {
    const vectorIndex = await getVectorIndex(projectRoot);
    return await vectorIndex.isIndexCreated();
}

/**
 * Queries the vector index and returns the raw result objects.
 * @param projectRoot The root of the project to search in.
 * @param query The user's question.
 * @param client The AI provider.
 * @param topK The number of results to retrieve.
 * @returns An array of raw QueryResult objects.
 */
export async function queryVectorIndexRaw(projectRoot: string, query: string, client: AIProvider, topK: number): Promise<QueryResult[]> {
    const indexExists = await isIndexCreated(projectRoot);
    if (!indexExists) {
        throw new VectorIndexError('Vector index not found. Please run "claude-code index" first.');
    }
    const vectorIndex = await getVectorIndex(projectRoot);
    const queryVector = await client.embed(query, projectRoot);
    return await vectorIndex.queryItems(queryVector, topK);
}

/**
 * Queries the vector index to find relevant context.
 * @param {string} projectRoot - The path of the project root.
 * @param {string} query - The user's question.
 * @param {AIProvider} client - The AI client.
 * @param {number} topK - The number of results to retrieve.
 * @returns {Promise<string>} The retrieved context string.
 */
export async function queryVectorIndex(projectRoot: string, query: string, client: AIProvider, topK: number): Promise<string> {
    const results = await queryVectorIndexRaw(projectRoot, query, client, topK);

    if (results.length === 0) {
        return 'No relevant code context found in the vector database.';
    }

    return results
        .map((r: QueryResult) => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
        .join('\n\n');
}