/**
 * @file src/codebase/vectorizer.ts
 * @description Handles creating and querying the vector database.
 */

import * as path from 'path';
import { LocalIndex, QueryResult } from 'vectra';
import { CACHE_DIR } from '../config/index.js';
import { AIProvider } from '../ai/providers/interface.js';
import { VectorIndexError } from '../errors/index.js';

// Initialize the vector index, storing it in the cache directory
export const vectorIndex = new LocalIndex(path.join(CACHE_DIR, 'vector_index'));

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

/**
 * Creates and stores vector embeddings for a file.
 * @param {string} filePath - The path of the file being indexed.
 * @param {string} content - The content of the file.
 * @param {AIProvider} client - The AI client to generate embeddings.
 */
export async function updateVectorIndex(filePath: string, content: string, client: AIProvider): Promise<void> {
  const chunks = chunkText(content);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.trim()) continue;

    const vector = await client.embed(chunk);
    await vectorIndex.upsertItem({
      vector,
      metadata: { filePath, chunk: i + 1, content: chunk },
    });
  }
}

/**
 * Queries the vector index to find relevant context.
 * @param {string} query - The user's question.
 * @param {AIProvider} client - The AI client.
 * @param {number} topK - The number of results to retrieve.
 * @returns {Promise<string>} The retrieved context string.
 */
export async function queryVectorIndex(query: string, client: AIProvider, topK: number): Promise<string> {
  if (!(await vectorIndex.isIndexCreated())) {
    throw new VectorIndexError('Vector index not found. Please run "claude-code index" first.');
  }

  const queryVector = await client.embed(query);
  const results = await vectorIndex.queryItems(queryVector, topK);

  if (results.length === 0) {
    return 'No relevant code context found in the vector database.';
  }

  return results
    .map((r: QueryResult) => `--- From ${r.item.metadata.filePath} ---\n${r.item.metadata.content}`)
    .join('\n\n');
}