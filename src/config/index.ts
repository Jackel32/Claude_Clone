/**
 * @file src/config/index.ts
 * @description Manages loading and accessing application configuration asynchronously.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Config, Profile } from './schema.js';
import { defaultConfig } from './defaults.js';
import { ConfigError } from '../errors/index.js';
import { createAIProvider } from '../ai/provider-factory.js';
import { logger } from '../logger/index.js';
import { AppContext } from '../types.js';

const CONFIG_DIR = path.join(os.homedir(), '.claude-code');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

let loadedConfig: Config | null = null;
let appContextCache: Omit<AppContext, 'args'> | null = null;

/**
 * Asynchronously ensures the configuration directory and files exist.
 */
async function ensureConfigExists(): Promise<void> {
  const checkAndCreate = async (dirPath: string) => {
    try {
      await fs.stat(dirPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  };

  await checkAndCreate(CONFIG_DIR);
  await checkAndCreate(CACHE_DIR);

  try {
    await fs.stat(CONFIG_PATH);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    } else {
      throw error;
    }
  }
}

async function getConfig(): Promise<Config> {
    if (loadedConfig) {
        return loadedConfig;
    }

    await ensureConfigExists();
    const fileContent = await fs.readFile(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(fileContent) as Partial<Config>;

    const mergedConfig: Config = {
        ...defaultConfig,
        ...userConfig,
        profiles: {
            ...defaultConfig.profiles,
            ...(userConfig.profiles || {}),
        },
    };
    
    loadedConfig = mergedConfig;
    return loadedConfig;
}


/**
 * Gets the configuration for a specific profile.
 * @param {string} [profileName] - The name of the profile to get. Defaults to the `defaultProfile`.
 * @returns {Promise<Profile>} The fully resolved profile settings.
 */
export async function getProfile(profileName?: string): Promise<Profile> {
  const config = await getConfig();
  const targetProfileName = profileName || config.defaultProfile;
  const defaultProfileSettings = config.profiles.default || {};
  const targetProfileSettings = config.profiles[targetProfileName];

  if (!targetProfileSettings) {
    throw new ConfigError(`Profile "${targetProfileName}" not found in config file at ${CONFIG_PATH}`);
  }

  return { ...defaultProfileSettings, ...targetProfileSettings };
}

/**
 * Creates and caches the application context, including the AI provider.
 * This is the single source of truth for app-wide configuration.
 * @returns {Promise<Omit<AppContext, 'args'>>} The application context.
 */
export async function getAppContext(): Promise<Omit<AppContext, 'args'>> {
    if (appContextCache) {
        return appContextCache;
    }

    const profile = await getProfile();
    const activeProviderName = profile.provider?.toLowerCase() || 'gemini';
    const providerConfig = profile.providers?.[activeProviderName];

    let apiKey: string | undefined;

    // 1. Prioritize environment variables
    if (activeProviderName === 'gemini') {
        apiKey = process.env.GOOGLE_API_KEY;
    } else if (activeProviderName === 'anthropic') {
        apiKey = process.env.ANTHROPIC_API_KEY;
    }

    // 2. Fallback to the key in the config file
    if (!apiKey) {
        apiKey = providerConfig?.apiKey;
    }

    // 3. Validate the API key
    if (!apiKey || apiKey.includes('YOUR_API_KEY_HERE') || apiKey.trim() === '') {
        throw new ConfigError(
            `API key for provider "${activeProviderName}" is missing or invalid. 
            Please set it in your environment (e.g., GOOGLE_API_KEY) or in the config file: ${CONFIG_PATH}`
        );
    }

    const aiProvider = createAIProvider(profile, apiKey, logger);

    appContextCache = {
        profile,
        aiProvider,
        logger,
    };

    return appContextCache;
}