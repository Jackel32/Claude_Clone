/**
 * @file Provides the default configuration for the application.
 * This is used as a fallback and to create the initial config file.
 */

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
      apiKey: 'AIzaSyDACYbCDEAtTELSFcTahQsezKfh4ul5Bfw',
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      rag: {
        topK: 3, // Default number of results to retrieve
      },
    },
  },
};