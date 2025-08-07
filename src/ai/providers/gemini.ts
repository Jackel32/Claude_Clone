/**
 * @file src/ai/providers/gemini.ts
 * @description Implements the AIProvider interface for Google's Gemini API.
 */

import { AIProvider } from './interface.js';
import { ProviderConfig } from '../../config/schema.js';
import { getEmbeddingFromCache, storeEmbeddingInCache } from '../../codebase/embedding-cache.js';
import { RateLimiter } from '../rate-limiter.js';
import { Logger } from 'pino';

// Note: The rate-limiting logic would also move here.
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private generationModel: string;
  private embeddingModel: string;
  private temperature: number;
  private rateLimiter: RateLimiter;

    constructor(apiKey: string, generationModel: string, embeddingModel: string, temperature: number = 0.7, logger: Logger, rateLimit?: ProviderConfig['rateLimit']) {
    this.apiKey = apiKey;
    this.generationModel = generationModel;
    this.embeddingModel = embeddingModel;
    this.temperature = temperature;
    this.rateLimiter = new RateLimiter(
            rateLimit?.requestsPerMinute || 60,
            rateLimit?.tokensPerMinute || 1000000,
            logger
        );
  }

    invoke(prompt: string, stream: boolean): Promise<any> {
        // Wrap the entire API call logic in the scheduler
        return this.rateLimiter.schedule(() => {
            const action = stream ? 'streamGenerateContent' : 'generateContent';
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.generationModel}:${action}?key=${this.apiKey}`;
            
            const body = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: this.temperature },
            };

            return fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(response => {
                if (!response.ok) {
                    if (response.status === 429) {
                        throw new Error(`API Rate Limit Exceeded (429).`);
                    }
                    return response.json().then(err => {
                        throw new Error(`API request failed with status ${response.status}: ${err.error?.message}`);
                    });
                }
                return stream ? response.body : response.json();
            });
        }, prompt);
    }

    embed(text: string, projectRoot: string): Promise<number[]> {
        // Also wrap the embed call
        return this.rateLimiter.schedule(async () => {
            const cachedEmbedding = await getEmbeddingFromCache(text, projectRoot);
            if (cachedEmbedding) {
                return cachedEmbedding;
            }
            
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
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
            const embedding = result.embedding.values;
            await storeEmbeddingInCache(text, embedding, projectRoot);
            return embedding;
        }, text);
    }
}