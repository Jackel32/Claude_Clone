/**
 * @file src/ai/providers/gemini.ts
 * @description Implements the AIProvider interface for Google's Gemini API.
 */

import { AIProvider } from './interface.js';
import { ProviderConfig } from '../../config/schema.js';
import { getEmbeddingFromCache, storeEmbeddingInCache } from '../../codebase/embedding-cache.js';
import { RateLimiter } from '../rate-limiter.js';
import { Logger } from '../../types.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private generationModel: string;
  private embeddingModel: string;
  private temperature: number;
  private rateLimiter: RateLimiter;
  private logger: Logger;

    constructor(apiKey: string, generationModel: string, embeddingModel: string, temperature: number = 0.7, logger: Logger, rateLimit?: ProviderConfig['rateLimit']) {
    this.apiKey = apiKey;
    this.generationModel = generationModel;
    this.embeddingModel = embeddingModel;
    this.temperature = temperature;
    this.logger = logger;
    this.rateLimiter = new RateLimiter(
            rateLimit?.requestsPerMinute || 15,
            rateLimit?.tokensPerMinute || 250000,
            rateLimit?.requestsPerDay || 1000,
            logger
        );
  }

    invoke(prompt: string, stream: boolean): Promise<any> {
        return this.rateLimiter.schedule(() => this.makeRequestWithRetry(prompt, stream), prompt);
    }

    embed(text: string, projectRoot: string): Promise<number[]> {
        return this.rateLimiter.schedule(() => this.makeEmbeddingRequestWithRetry(text, projectRoot), text);
    }

    private async makeRequestWithRetry(prompt: string, stream: boolean): Promise<any> {
        const MAX_RETRIES = 5;
        const INITIAL_DELAY_MS = 5000;

        for (let i = 0; i < MAX_RETRIES; i++) {
            const action = stream ? 'streamGenerateContent' : 'generateContent';
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.generationModel}:${action}?key=${this.apiKey}`;
            
            const body = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: this.temperature },
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                return stream ? response.body : response.json();
            }

            if (response.status === 429 && i < MAX_RETRIES - 1) {
                const delay = INITIAL_DELAY_MS * Math.pow(2, i);
                this.logger.warn(`API Rate Limit Exceeded. Retrying in ${delay}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
            }

            const err = await response.json().catch(() => ({ error: { message: 'Unknown error with non-JSON response' } }));
            throw new Error(`API request failed with status ${response.status}: ${err.error?.message}`);
        }
        throw new Error(`API request failed after ${MAX_RETRIES} retries.`);
    }

    private async makeEmbeddingRequestWithRetry(text: string, projectRoot: string): Promise<number[]> {
        const cachedEmbedding = await getEmbeddingFromCache(text, projectRoot);
        if (cachedEmbedding) {
            return cachedEmbedding;
        }

        const MAX_RETRIES = 5;
        const INITIAL_DELAY_MS = 5000;

        for (let i = 0; i < MAX_RETRIES; i++) {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
            const body = { content: { parts: [{ text }] } };
            const response = await fetch(endpoint, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(body),
            });

            if (response.ok) {
                const result = await response.json();
                const embedding = result.embedding.values;
                await storeEmbeddingInCache(text, embedding, projectRoot);
                return embedding;
            }

            if (response.status === 429 && i < MAX_RETRIES - 1) {
                const delay = INITIAL_DELAY_MS * Math.pow(2, i);
                this.logger.warn(`Embedding API Rate Limit Exceeded. Retrying in ${delay}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
            }

            const errorBody = await response.json().catch(() => ({ error: { message: 'Unknown embedding error with non-JSON response' } }));
            throw new Error(`Embedding request failed: ${errorBody.error?.message}`);
        }
        throw new Error(`Embedding request failed after ${MAX_RETRIES} retries.`);
    }
}
