/**
 * @file The client for interacting with the custom AI backend.
 */

import { getApiKey } from '../auth';

// IMPORTANT: Modify this URL to point to your custom AI backend's endpoint.
const API_ENDPOINT_URL = 'https://api.custom-ai-provider.com/v1/completions';

const MAX_CALLS_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Manages API call timestamps for rate limiting.
 */
const apiCallTimestamps: number[] = [];

/**
 * Enforces a simple in-memory rate limit.
 * @throws An error if the rate limit is exceeded.
 */
function enforceRateLimit() {
  const now = Date.now();
  
  // Remove timestamps older than the window
  while (apiCallTimestamps.length > 0 && apiCallTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    apiCallTimestamps.shift();
  }

  if (apiCallTimestamps.length >= MAX_CALLS_PER_MINUTE) {
    const waitTime = Math.ceil((apiCallTimestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
  }

  apiCallTimestamps.push(now);
}

/**
 * Represents the client for making requests to the AI model.
 */
export class AIClient {
  private apiKey: string = '';
  private profileName?: string;

  /**
   * Constructs an AIClient instance.
   * @param profileName - The configuration profile to use for this client.
   */
  constructor(profileName?: string) {
    this.profileName = profileName;
  }

  /**
   * Initializes the client by fetching the API key.
   * Must be called before making API requests.
   */
  async initialize(): Promise<void> {
    this.apiKey = await getApiKey(this.profileName);
  }

  /**
   * Sends a prompt to the AI backend and gets a completion.
   * @param prompt - The prompt to send to the AI.
   * @param stream - Whether to request a streaming response.
   * @returns A promise that resolves to the API response.
   */
  async getCompletion(prompt: string, stream: boolean = true): Promise<Response> {
    if (!this.apiKey) {
      throw new Error('AIClient not initialized. Call initialize() before making requests.');
    }
    
    enforceRateLimit();

    const body = {
      model: 'your-custom-model/v1', // This could be dynamically set from config
      prompt: prompt,
      stream: stream,
      max_tokens_to_sample: 100000,
    };

    const response = await fetch(API_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01' // Example header
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    return response;
  }
}