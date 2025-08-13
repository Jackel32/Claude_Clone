/**
 * @file src/codebase/vectorizer.ts
 * @description Handles creating, managing, and querying the project-specific vector database.
 */

import * as path from 'path';
import { LocalIndex, QueryResult } from 'vectra';
import { AgentCallback } from '../core/agent-core.js';
import { AIProvider } from '../ai/providers/interface.js';
import { VectorIndexError } from '../errors/index.js';
import { getProjectCacheDir } from './cache-manager.js';

// Manages singleton LocalIndex instances per project root to avoid redundant initializations.
const indexInstances: Map<string, LocalIndex> = new Map();
// Caches the "created" state of an index to avoid repeated disk checks.
const createdIndexState: Map<string, boolean> = new Map();

/**
 * Explicitly sets the in-memory cache for the index's "created" state.
 * This is used to prevent race conditions after creating or deleting an index.
 * @param {string} projectRoot - The root directory of the project.
 * @param {boolean} state - The state to set (true for created, false for not created).
 */
export function setIndexCreatedState(projectRoot: string, state: boolean): void {
    createdIndexState.set(projectRoot, state);
}

/**
 * Splits a string of text or code into manageable, overlapping chunks suitable for embedding.
 * This ensures that semantic context is not lost at chunk boundaries.
 * @param {string} content - The file content to be chunked.
 * @returns {string[]} An array of text chunks.
 */
function chunkText(content: string): string[] {
  const chunks: string[] = [];
  const lines = content.split('\n');
  const chunkSize = 50; // The number of lines per chunk.
  const overlap = 10;   // The number of lines to overlap between chunks.

  for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
    const chunk = lines.slice(i, i + chunkSize).join('\n');
    chunks.push(chunk);
  }
  return chunks;
}

/**
 * Retrieves the singleton vector index instance for a given project.
 * If an instance doesn't exist, it initializes one.
 * @param {string} projectRoot - The absolute path to the project's root directory.
 * @returns {Promise<LocalIndex>} A promise that resolves to the LocalIndex instance.
 */
export async function getVectorIndex(projectRoot: string): Promise<LocalIndex> {
    if (indexInstances.has(projectRoot)) {
        return indexInstances.get(projectRoot)!;
    }
    const projectCacheDir = await getProjectCacheDir(projectRoot);
    const indexPath = path.join(projectCacheDir, 'vector_index');
    
    const newIndex = new LocalIndex(indexPath);
    
    // Wrap the createIndex method to update our in-memory state cache.
    const originalCreateIndex = newIndex.createIndex.bind(newIndex);
    newIndex.createIndex = async (): Promise<void> => {
        await originalCreateIndex();
        setIndexCreatedState(projectRoot, true);
    };

    // Wrap the deleteIndex method to update our in-memory state cache.
    const originalDeleteIndex = newIndex.deleteIndex.bind(newIndex);
    newIndex.deleteIndex = async (): Promise<void> => {
        await originalDeleteIndex();
        setIndexCreatedState(projectRoot, false);
    };

    indexInstances.set(projectRoot, newIndex);
    return newIndex;
}

/**
 * Chunks file content, generates vector embeddings, and upserts them into the vector index.
 * @param {string} projectRoot - The root directory of the project.
 * @param {string} filePath - The path of the file being indexed.
 * @param {string} content - The content of the file.
 * @param {AIProvider} client - The AI client used to generate embeddings.
 * @param {AgentCallback} onUpdate - A callback to report progress.
 */
export async function updateVectorIndex(
    projectRoot: string,
    filePath: string,
    content: string,
    client: AIProvider,
    onUpdate: AgentCallback
): Promise<void> {
    const vectorIndex = await getVectorIndex(projectRoot);
    if (!(await isIndexCreated(projectRoot))) {
        await vectorIndex.createIndex();
    }
    
    const chunks = chunkText(content);
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        onUpdate({ type: 'action', content: `chunk ${i + 1}/${chunks.length}...` });

        const vector = await client.embed(chunk, projectRoot);
        await vectorIndex.upsertItem({
            vector,
            metadata: { filePath, chunk: i + 1, content: chunk },
        });
    }
}

/**
 * Checks if a vector index has been created for a specific project, using an in-memory cache.
 * @param {string} projectRoot - The root directory of the project to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the index exists.
 */
export async function isIndexCreated(projectRoot: string): Promise<boolean> {
    if (createdIndexState.has(projectRoot)) {
        return createdIndexState.get(projectRoot)!;
    }

    // If not in cache, check the disk once and store the result for subsequent calls.
    const vectorIndex = await getVectorIndex(projectRoot);
    const onDisk = await vectorIndex.isIndexCreated();
    setIndexCreatedState(projectRoot, onDisk);
    return onDisk;
}

/**
 * Queries the vector index and returns the raw result objects.
 * @param {string} projectRoot - The root of the project to search in.
 * @param {string} query - The user's natural language query.
 * @param {AIProvider} client - The AI provider for generating the query embedding.
 * @param {number} topK - The number of top results to retrieve.
 * @returns {Promise<QueryResult[]>} A promise that resolves to an array of raw QueryResult objects.
 */
export async function queryVectorIndexRaw(projectRoot: string, query: string, client: AIProvider, topK: number): Promise<QueryResult[]> {
    if (!(await isIndexCreated(projectRoot))) {
        throw new VectorIndexError('Vector index not found. Please run the "index" command first.');
    }
    const vectorIndex = await getVectorIndex(projectRoot);
    const queryVector = await client.embed(query, projectRoot);
    return await vectorIndex.queryItems(queryVector, "default", topK);
}

/**
 * Queries the vector index and formats the results into a single string for context.
 * @param {string} projectRoot - The root directory of the project.
 * @param {string} query - The user's natural language question.
 * @param {AIProvider} client - The AI client for generating embeddings.
 * @param {number} topK - The number of top results to retrieve.
 * @returns {Promise<string>} A promise that resolves to the formatted context string.
 */
export async function queryVectorIndex(projectRoot: string, query: string, client: AIProvider, topK: number): Promise<string> {
    const results = await queryVectorIndexRaw(projectRoot, query, client, topK);

    if (results.length === 0) {
        return 'No relevant code context found in the vector database.';
    }

    return results
        .map((r) => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
        .join('\n\n');
}