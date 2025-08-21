import { McpConfig, Profile } from '../config/schema.js';
import { AIProvider } from './providers/interface.js';
import { GeminiProvider } from './providers/gemini.js';
import { McpProvider } from './providers/mcp.js';
import { Logger } from '../types.js';

export function createAIProvider(profile: Profile, apiKey: string, logger: Logger): AIProvider {
  const { provider = 'gemini', providers, temperature } = profile;
  const activeProviderName = provider.toLowerCase();

  const providerConfig = providers?.[activeProviderName];

  if (!providerConfig) {
    throw new Error(`Configuration for the active provider "${provider}" is missing in the profile.`);
  }

  const { generation: generationModel, embedding: embeddingModel, rateLimit } = providerConfig;

  if (!generationModel || !embeddingModel) {
    throw new Error(`Generation and/or embedding models are missing for the "${provider}" provider configuration.`);
  }

  switch (activeProviderName) {
    case 'gemini':
      return new GeminiProvider(apiKey, generationModel, embeddingModel, temperature, logger);
    case 'mcp':
      return new McpProvider(apiKey, providerConfig as McpConfig, logger);
    default:
      throw new Error(`Unsupported AI provider: "${provider}"`);
  }
}