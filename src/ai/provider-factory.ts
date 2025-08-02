/**
 * @file src/ai/provider-factory.ts
 * @description Creates an AI provider instance based on configuration.
 */

import { Profile } from '../config/schema.js';
import { AIProvider } from './providers/interface.js';
import { GeminiProvider } from './providers/gemini.js';
import { AnthropicProvider } from './providers/anthropic.js';

export function createAIProvider(profile: Profile, apiKey: string): AIProvider {
  const { provider = 'gemini', model, temperature } = profile;

  if (!model) {
    throw new Error('No AI model specified in the current profile.');
  }

  switch (provider.toLowerCase()) {
    case 'gemini':
      return new GeminiProvider(apiKey, model, temperature);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model, temperature);
    default:
      throw new Error(`Unsupported AI provider: "${provider}"`);
  }
}