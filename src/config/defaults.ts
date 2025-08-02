/**
 * @file Provides the default configuration for the application.
 * This is used as a fallback and to create the initial config file.
 */

import { Config } from './schema';

/**
 * The default configuration object.
 * This will be written to `~/.kinch-code/config.json` on first run if the file
 * does not exist.
 */
export const defaultConfig: Config = {
  defaultProfile: 'default',
  profiles: {
    default: {
      apiKey: 'YOUR_API_KEY_HERE', // User should replace this
      model: 'your-custom-model/v1',
      temperature: 0.5,
    },
  },
};