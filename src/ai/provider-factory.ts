/**
 * @file src/ai/provider-factory.ts
 * @description Creates an AI provider instance based on configuration.
 */

import { Profile, ProviderConfig } from '../config/schema.js';
import { AIProvider } from './providers/interface.js';
import { GeminiProvider } from './providers/gemini.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { Logger } from '../types.js';

export function createAIProvider(profile: Profile, apiKey: string, logger: Logger): AIProvider {
  const { provider = 'gemini', providers, temperature } = profile;
  const activeProviderName = provider.toLowerCase();

  // 1. Find the configuration for the currently active provider.
  const providerConfig = providers?.[activeProviderName];

  if (!providerConfig) {
    throw new Error(`Configuration for the active provider "${provider}" is missing in the profile.`);
  }

  const { generation: generationModel, embedding: embeddingModel, rateLimit } = providerConfig;
  
  if (!generationModel || !embeddingModel) {
    throw new Error(`Generation and/or embedding models are missing for the "${provider}" provider configuration.`);
  }

  // 2. Create the correct provider instance with its specific models and settings.
  switch (activeProviderName) {
    case 'gemini':
      return new GeminiProvider(apiKey, generationModel, embeddingModel, temperature, logger, rateLimit);
    case 'anthropic':
      // This is a placeholder, but it shows how you would add another provider.
      return new AnthropicProvider(apiKey, generationModel);
    default:
      throw new Error(`Unsupported AI provider: "${provider}"`);
  }
}