/**
 * @file Defines the TypeScript interfaces for the application's configuration.
 */

/**
 * Represents the settings for a single AI interaction profile.
 * This allows for different configurations (e.g., different models, API keys)
 * for different tasks or projects.
 */
export interface Profile {
  /** The API key for the AI backend. Can be overridden by environment variables. */
  apiKey?: string;

  /** The specific AI model to use for this profile. */
  model?: string;

  /** The sampling temperature for the AI model, controlling creativity. */
  temperature?: number;
}

/**
 * Represents the entire configuration structure for the application.
 */
export interface Config {
  /** The name of the profile to use by default. */
  defaultProfile: string;

  /** A map of profile names to their specific configurations. */
  profiles: {
    [key: string]: Profile;
  };
}