/**
 * @file src/types.ts
 * @description Defines shared types and interfaces for the application.
 */

// FIX: Point the import to `config/schema.ts` where Profile is exported.
import { Profile } from './config/schema.js';
import { AIClient } from './ai/client.js';
import { Logger } from 'pino';

/**
 * AppContext holds shared services and configuration that are passed
 * to command handlers, facilitating dependency injection.
 */
export interface AppContext {
  /** The fully resolved configuration profile. */
  profile: Profile;
  
  /** An instance of the AI client. */
  aiClient: AIClient;
  
  /** The application's logger instance. */
  logger: Logger;
  
  /** The raw, parsed arguments from yargs. */
  args: any;
}