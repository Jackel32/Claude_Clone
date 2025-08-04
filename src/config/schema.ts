/**
 * @file src/config/schema.ts
 * @description Defines the TypeScript interfaces for the application configuration.
 */

/**
 * Represents the settings for a single AI profile.
 */
export interface Profile {
  /** The API key for the AI service. */
  apiKey?: string;
  /** The specific AI model to use (e.g., 'gemini-1.5-flash'). */
  model?: string;
  /** The sampling temperature for the AI model (0.0 - 1.0). */
  temperature?: number;
  /** The provider for the AI model. */
  provider?: string;
  /** Settings related to Retrieval-Augmented Generation (RAG). */
  rag?: {
    /** The number of top results to retrieve from the vector index. */
    topK?: number;
  };
}

export interface LanguageConfig {
  extensions: string[];
  testNameConvention: {
    suffix?: string; // e.g., ".test.ts"
    prefix?: string; // e.g., "test_"
  };
}

/**
 * Represents the main configuration structure.
 */
export interface Config {
  /** The name of the profile to use by default. */
  defaultProfile: string;
  /** A map of profile names to their specific settings. */
  profiles: {
    [key: string]: Profile;
  };
  /**
   * A map of language names to their specific configurations.
   */
  languages: {
    [languageName: string]: LanguageConfig;
  };
}