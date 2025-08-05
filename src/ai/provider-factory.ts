/**
 * @file src/ai/provider-factory.ts
 * @description Creates an AI provider instance based on configuration.
 */

import { Profile } from '../config/schema.js';
import { AIProvider } from './providers/interface.js';
import { GeminiProvider } from './providers/gemini.js';
import { AnthropicProvider } from './providers/anthropic.js';

export function createAIProvider(profile: Profile, apiKey: string): AIProvider {
  const { provider = 'gemini', providers, temperature } = profile;

  const providerConfig = providers?.[provider.toLowerCase()];

  if (!providerConfig) {
    throw new Error(`Configuration for the active provider "${provider}" is missing in the profile.`);
  }

  const { generation: generationModel, embedding: embeddingModel, rateLimit } = providerConfig;
  
  if (!generationModel || !embeddingModel) {
    throw new Error(`Generation and/or embedding models are missing for the "${provider}" provider configuration.`);
  }

  switch (provider.toLowerCase()) {
    case 'gemini':
      return new GeminiProvider(apiKey, generationModel, embeddingModel, temperature, rateLimit);
    case 'anthropic':
      return new AnthropicProvider(apiKey, generationModel, temperature);
    default:
      throw new Error(`Unsupported AI provider: "${provider}"`);
  }
}