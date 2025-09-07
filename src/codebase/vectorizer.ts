/**
 * @file src/codebase/vectorizer.ts
 * @description Handles creating, managing, and querying the project-specific vector database using AST-based semantic chunking.
 */

import * as path from 'path';
import { LocalIndex, QueryResult } from 'vectra';
import { AgentCallback } from '../core/agent-core.js';
import { AIProvider } from '../ai/providers/interface.js';
import { VectorIndexError } from '../errors/index.js';
import { getProjectCacheDir } from './cache-manager.js';
import { listSymbolsInFile, getSymbolContent } from './ast.js';
import { logger } from '../logger/index.js';

// Manages singleton LocalIndex instances per project root.
const indexInstances: Map<string, LocalIndex> = new Map();
// Caches the "created" state of an index.
//const createdIndexState: Map<string, boolean> = new Map();

/**
 * Explicitly sets the in-memory cache for the index's "created" state.
 * This is used to prevent race conditions after creating or deleting an index.
 * @param {string} projectRoot - The root directory of the project.
 * @param {boolean} state - The state to set (true for created, false for not created).
 */
export function setIndexCreatedState(projectRoot: string, state: boolean): void {
    //createdIndexState.set(projectRoot, state);
}

/**
 * Splits code into semantically meaningful chunks using the Abstract Syntax Tree (AST).
 * Each chunk will be a complete function, class, or other top-level symbol.
 * @param {string} filePath - The absolute path to the file being chunked.
 * @param {string} content - The file content to be chunked.
 * @returns {Promise<string[]>} An array of semantically complete code chunks.
 */
async function chunkText(filePath: string, content: string): Promise<string[]> {
  const chunks: string[] = [];
  // Get all top-level symbols (functions, classes, etc.) from the file.
  const symbols = await listSymbolsInFile(filePath);

  for (const symbolName of symbols) {
    // Get the full source code for that symbol.
    const symbolContent = await getSymbolContent(filePath, symbolName);
    if (symbolContent) {
      chunks.push(symbolContent);
    }
  }
  
  // If no symbols were found (e.g., a simple script or markdown file),
  // fall back to treating the whole file as a single chunk.
  if (chunks.length === 0 && content.trim()) {
      chunks.push(content);
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
    logger.trace({ projectRoot }, 'getVectorIndex: Function called.');
    if (indexInstances.has(projectRoot)) {
        logger.trace({ projectRoot }, 'getVectorIndex: Returning cached instance.');
        return indexInstances.get(projectRoot)!;
    }

    logger.trace({ projectRoot }, 'getVectorIndex: Creating new LocalIndex instance.');
    const projectCacheDir = await getProjectCacheDir(projectRoot);
    const indexPath = path.join(projectCacheDir, 'vector_index');
    
    const newIndex = new LocalIndex(indexPath);
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
): Promise<string[]> {
    logger.trace({ filePath, projectRoot }, 'updateVectorIndex: Starting update for file.');
    
    const vectorIndex = await getVectorIndex(projectRoot);
    const createdVectorIds: string[] = [];
    
    logger.trace({ projectRoot }, 'updateVectorIndex: Checking if index is created...');
    const indexExists = await vectorIndex.isIndexCreated();
    logger.trace({ projectRoot, indexExists }, 'updateVectorIndex: Index created status.');

    if (!indexExists) {
        logger.trace({ projectRoot }, 'updateVectorIndex: Index not found. Creating index...');
        await vectorIndex.createIndex();
        logger.trace({ projectRoot }, 'updateVectorIndex: Index creation complete.');
    }
    
    const chunks = await chunkText(filePath, content);
    logger.trace({ filePath, chunkCount: chunks.length }, 'updateVectorIndex: Text chunking complete.');

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        onUpdate({ type: 'action', content: `chunk ${i + 1}/${chunks.length}...` });
        const vector = await client.embed(chunk, projectRoot);

        logger.trace({ filePath, chunk: `${i + 1}/${chunks.length}` }, 'updateVectorIndex: Upserting item into index...');
        const upsertedItem = await vectorIndex.upsertItem({ // The upsertItem method should return the item with its ID
            vector,
            metadata: { filePath, chunk: i + 1, content: chunk },
        });

        if (upsertedItem && upsertedItem.id) {
            createdVectorIds.push(upsertedItem.id);
        }
        logger.trace({ filePath, chunk: `${i + 1}/${chunks.length}` }, 'updateVectorIndex: Upsert complete.');
    }
    return createdVectorIds;
}

/**
 * Deletes items from the vector index by their IDs.
 * @param {string} projectRoot - The root of the project.
 * @param {string[]} ids - An array of vector IDs to delete.
 */
export async function deleteVectorsByIds(projectRoot: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    logger.trace({ count: ids.length }, 'deleteVectorsByIds: Deleting vectors.');
    const vectorIndex = await getVectorIndex(projectRoot);
    if (await vectorIndex.isIndexCreated()) {
        for (const id of ids) {
            await vectorIndex.deleteItem(id);
        }
        logger.trace({ count: ids.length }, 'deleteVectorsByIds: Deletion complete.');
    }
}

/**
 * Checks if a vector index has been created for a specific project, using an in-memory cache.
 * @param {string} projectRoot - The root directory of the project to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the index exists.
 */
export async function isIndexCreated(projectRoot: string): Promise<boolean> {
    const vectorIndex = await getVectorIndex(projectRoot);
    return await vectorIndex.isIndexCreated();
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