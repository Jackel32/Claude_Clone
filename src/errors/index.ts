/**
 * @file src/errors/index.ts
 * @description Defines custom error types for the application.
 */

/**
 * Base class for application-specific errors.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error related to configuration issues.
 */
export class ConfigError extends AppError {}

/**
 * A specific configuration error for a missing API key.
 */
export class ApiKeyError extends ConfigError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error related to the vector database index.
 */
export class VectorIndexError extends AppError {}