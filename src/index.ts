#!/usr/bin/env node

/**
 * @file The main entry point for the Kinch Code CLI application.
 */

import { parseArgs, executeCommand } from './commands';

/**
 * The main function that orchestrates the CLI execution.
 * It parses arguments, executes the corresponding command, and handles global errors.
 */
async function main() {
  try {
    const args = await parseArgs();
    await executeCommand(args);
  } catch (error: any) {
    console.error('\nAn unexpected error occurred:');
    console.error(error.message || error);
    process.exit(1);
  }
}

// Execute the main function
main();