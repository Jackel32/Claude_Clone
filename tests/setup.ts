/**
 * @file tests/setup.ts
 * @description Global setup file for Vitest. This runs once before all test suites.
 */
import { initializeParser } from '../src/codebase/ast.js';

// This function is automatically called by Vitest because of the --setup-files config.
export async function setup() {
  console.log('--- Running Global Test Setup ---');
  await initializeParser();
  console.log('--- Global Test Setup Complete ---');
}
