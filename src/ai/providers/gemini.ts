import { AIProvider } from './interface.js';
import { Logger } from '../../types.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private generationModel: string;
  private embeddingModel: string;
  private temperature: number;
  private logger: Logger;

  constructor(apiKey: string, generationModel: string, embeddingModel: string, temperature: number = 0.7, logger: Logger) {
    this.apiKey = apiKey;
    this.generationModel = generationModel;
    this.embeddingModel = embeddingModel;
    this.temperature = temperature;
    this.logger = logger;
  }

  invoke(prompt: string, stream: boolean): Promise<any> {
    return this.makeRequestWithRetry(prompt, stream);
  }

  embed(text: string, projectRoot: string): Promise<number[]> {
    return this.makeEmbeddingRequestWithRetry(text, projectRoot);
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
        return result.embedding.values;
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