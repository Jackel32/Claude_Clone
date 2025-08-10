/**
 * @file src/types.ts
 * @description Defines shared types and interfaces for the application.
 */

import { Profile } from './config/schema.js';
import { AIProvider } from './ai/providers/interface.js';
import { logger } from './logger/index.js';
/**
 * The application-wide logger type.
 * This creates a 'Logger' type alias from the imported 'PinoLogger' type.
 */
export type Logger = typeof logger;

/**
 * Defines the structure for a single message in a conversation.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * AppContext holds shared services and configuration that are passed
 * to command handlers, facilitating dependency injection.
 */
export interface AppContext {
  /** The fully resolved configuration profile. */
  profile: Profile;
  
  /** An instance of the AI provider. */
  aiProvider: AIProvider;

  /** The application's logger instance. */
  logger: Logger; // Now correctly uses the 'Logger' type alias
  
  /** The raw, parsed arguments from yargs. */
  args: any;
}