/**
 * @file src/ai/client.ts
 * @description A client for interacting with the Google Gemini AI backend.
 */

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CALLS_PER_MINUTE = 20;

const requestTimestamps: number[] = [];

/**
 * Enforces a simple in-memory rate limit.
 * @throws {Error} If the rate limit is exceeded.
 */
function checkRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= MAX_CALLS_PER_MINUTE) {
    throw new Error('Rate limit exceeded (20 calls/minute). Please wait a moment before trying again.');
  }
}

/**
 * Records a new API call for rate limiting.
 */
function recordApiCall() {
  requestTimestamps.push(Date.now());
}

export class AIClient {
  private apiKey: string;
  private model: string;
  private temperature: number;

  constructor(apiKey: string, model: string, temperature: number = 0.7) {
    this.apiKey = apiKey;
    this.model = model;
    this.temperature = temperature;
  }

  /**
   * Sends a prompt to the Gemini API backend and gets a completion.
   * @param {string} prompt - The prompt to send.
   * @param {boolean} stream - Whether to stream the response.
   * @returns {Promise<any>} The response body, either as JSON or a ReadableStream.
   */
  async getCompletion(prompt: string, stream: boolean): Promise<any> {
    checkRateLimit();

    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const endpoint = `${API_BASE_URL}/${this.model}:${action}?key=${this.apiKey}`;
    
    // Gemini API has a different request structure
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.temperature,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    recordApiCall();

    if (!response.ok) {
      const errorBody = await response.json();
      const errorMessage = errorBody.error?.message || 'Unknown API error';
      throw new Error(`API request failed with status ${response.status}: ${errorMessage}`);
    }

    return stream ? response.body : response.json();
  }

  /**
   * Generates a vector embedding for a given text.
   * @param {string} text - The text to embed.
   * @returns {Promise<number[]>} The vector embedding.
   */
  async getEmbedding(text: string): Promise<number[]> {
    // Note: You should use a dedicated embedding model, like 'text-embedding-004'
    const embeddingModel = 'text-embedding-004'; 
    const endpoint = `${API_BASE_URL}/${embeddingModel}:embedContent?key=${this.apiKey}`;
    
    const body = {
      content: { parts: [{ text }] },
    };

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