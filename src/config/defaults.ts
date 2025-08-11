/**
 * @file Provides the default configuration for the application.
 * This is used as a fallback and to create the initial config file.
 */

import { constructPlanPrompt } from '../ai/prompts.js';
import { Config } from './schema.js';

/**
 * The default configuration object.
 * This will be written to `~/.kinch-code/config.json` on first run if the file
 * does not exist.
 */
export const defaultConfig: Config = {
  defaultProfile: 'default',
  profiles: {
    default: {
      provider: 'gemini',
      providers: {
        gemini: {
          apiKey: 'YOUR_GOOGLE_API_KEY_HERE',
          generation: 'gemini-2.5-flash-lite',
          embedding: 'gemini-2.5-flash-embedding',
          rateLimit: {
            requestsPerMinute: 15,
            tokensPerMinute: 250000,
            requestsPerDay: 1000,
          },
        },
        anthropic: {
          apiKey: 'YOUR_ANTHROPIC_API_KEY_HERE',
          generation: 'claude-3-haiku-20240307',
          embedding: 'not-applicable',
          rateLimit: {
            requestsPerMinute: 20,
            tokensPerMinute: 200000,
            requestsPerDay: 1000,
          },
        },
      },
      temperature: 0.7,
      cwd: '.',
      rag: {
        topK: 3, // Default number of results to retrieve
      },
    },
  },
  languages: {
    typescript: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      testNameConvention: { suffix: '.test.ts' },
    },
    python: {
      extensions: ['.py'],
      testNameConvention: { prefix: 'test_' },
    },
    csharp: {
      extensions: ['.cs'],
      testNameConvention: { suffix: '.Tests.cs' },
    },
    java: {
      extensions: ['.java'],
      testNameConvention: { suffix: 'Test.java' },
    },
    cpp: {
      extensions: ['.cpp', '.h', '.hpp', '.idl'],
      testNameConvention: { suffix: 'Test.cpp' },
    },
    ada: {
      extensions: ['.adb', '.ads'],
      testNameConvention: { suffix: '.adb' },
    },
  },
  // ... configs for C/C++ and Ada
};