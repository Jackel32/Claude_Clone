/**
 * @file src/auth/tokens.ts
 * @description Handles retrieving API keys.
 */

import { getProfile } from '../config/index.js';
import { ApiKeyError } from '../errors/index.js';

/**
 * Retrieves the API key for the Google AI Platform.
 * @param {string} [profileName] - The configuration profile to use as a fallback.
 * @returns {Promise<string>} The API key.
 * @throws {ApiKeyError} If no API key can be found.
 */
export async function getApiKey(profileName?: string): Promise<string> {
  const envKey = process.env.GOOGLE_API_KEY;
  if (envKey) {
    return envKey;
  }

  const profile = await getProfile(profileName);
  if (profile.apiKey && profile.apiKey !== 'YOUR_GOOGLE_API_KEY_HERE') {
    return profile.apiKey;
  }
  
  throw new ApiKeyError(
    'API key not found. Please set the GOOGLE_API_KEY environment variable or add the key to your config file at ~/.claude-code/config.json'
  );
}