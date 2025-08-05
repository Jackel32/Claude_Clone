/**
 * @file src/ai/providers/gemini.ts
 * @description Implements the AIProvider interface for Google's Gemini API.
 */

import { AIProvider } from './interface.js';
import { RateLimiter } from '../rate-limiter.js';
import { ProviderConfig } from '../../config/schema.js';
import { getEmbeddingFromCache, storeEmbeddingInCache } from '../../codebase/embedding-cache.js';


// Note: The rate-limiting logic would also move here.
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private generationModel: string;
  private embeddingModel: string;
  private temperature: number;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, generationModel: string, embeddingModel: string, temperature: number = 0.7, rateLimit?: ProviderConfig['rateLimit']) {
    this.apiKey = apiKey;
    this.generationModel = generationModel;
    this.embeddingModel = embeddingModel;
    this.temperature = temperature;
    this.rateLimiter = new RateLimiter(
      rateLimit?.requestsPerMinute || 60,
      rateLimit?.tokensPerMinute || 1000000
    );
  }

  async invoke(prompt: string, stream: boolean): Promise<any> {
    // Wait for permission from the rate limiter
    await this.rateLimiter.acquire(prompt);

    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const endpoint = `${API_BASE_URL}/${this.generationModel}:${action}?key=${this.apiKey}`;
    
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: this.temperature },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error(`API Rate Limit Exceeded (429). Please wait and try again.`);
        }
        const errorBody = await response.json().catch(() => ({ error: { message: 'Failed to parse error response.' } }));
        throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message}`);
    }
    return stream ? response.body : response.json();
  }

  async embed(text: string, projectRoot: string): Promise<number[]> {
     const cachedEmbedding = await getEmbeddingFromCache(text, projectRoot);
    if (cachedEmbedding) {
        return cachedEmbedding;
    }

    // Wait for permission from the rate limiter
    await this.rateLimiter.acquire(text);

    const endpoint = `${API_BASE_URL}/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
    
    const body = { content: { parts: [{ text }] } };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Embedding request failed: ${errorBody.error?.message}`);
    }
    const result = await response.json();
    return result.embedding.values;
  }
}