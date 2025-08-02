/**
 * @file Manages API key retrieval.
 */

import { getProfile } from '../config';

/**
 * Retrieves the API key for a given profile.
 * The function follows a specific order of precedence:
 * 1. `ANTHROPIC_API_KEY` environment variable.
 * 2. `apiKey` field in the specified configuration profile.
 *
 * @param profileName - The name of the configuration profile to check.
 * @returns The resolved API key.
 * @throws An error if no API key can be found.
 */
export async function getApiKey(profileName?: string): Promise<string> {
  // 1. Check environment variable
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    return envKey;
  }

  // 2. Check configuration file
  const profile = await getProfile(profileName);
  if (profile.apiKey && profile.apiKey !== 'YOUR_API_KEY_HERE') {
    return profile.apiKey;
  }

  // 3. If no key is found, throw an error
  throw new Error(
    'API key not found. Please set the ANTHROPIC_API_KEY environment variable or add it to your config file at ~/.kinch-code/config.json'
  );
}