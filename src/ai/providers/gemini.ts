/**
 * @file src/ai/providers/gemini.ts
 * @description Implements the AIProvider interface for Google's Gemini API.
 */

import { AIProvider } from './interface.js';

// Note: The rate-limiting logic would also move here.
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private temperature: number;

  constructor(apiKey: string, model: string, temperature: number = 0.7) {
    this.apiKey = apiKey;
    this.model = model;
    this.temperature = temperature;
  }

  async invoke(prompt: string, stream: boolean): Promise<any> {
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const endpoint = `${API_BASE_URL}/${this.model}:${action}?key=${this.apiKey}`;
    
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

  async embed(text: string): Promise<number[]> {
    const embeddingModel = 'text-embedding-004'; 
    const endpoint = `${API_BASE_URL}/${embeddingModel}:embedContent?key=${this.apiKey}`;
    
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