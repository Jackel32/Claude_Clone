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

const CONFIG_DIR = path.join(os.homedir(), '.claude-code');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

let loadedConfig: Config | null = null;

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

/**
 * Gets the configuration for a specific profile, using an in-memory cache.
 * @param {string} [profileName] - The name of the profile to get. Defaults to the `defaultProfile`.
 * @returns {Promise<Profile>} The fully resolved profile settings.
 */
export async function getProfile(profileName?: string): Promise<Profile> {
  if (loadedConfig) {
    const targetProfileName = profileName || loadedConfig.defaultProfile;
    const defaultProfileSettings = loadedConfig.profiles.default || {};
    const targetProfileSettings = loadedConfig.profiles[targetProfileName];

    if (!targetProfileSettings) {
      throw new Error(`Profile "${targetProfileName}" not found in config file.`);
    }
    return { ...defaultProfileSettings, ...targetProfileSettings };
  }

  // If not cached, read from disk.
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
  
  // Populate the cache for subsequent calls.
  loadedConfig = mergedConfig;

  const targetProfileName = profileName || mergedConfig.defaultProfile;
  const defaultProfileSettings = mergedConfig.profiles.default || {};
  const targetProfileSettings = mergedConfig.profiles[targetProfileName];

  if (!targetProfileSettings) {
    throw new ConfigError(`Profile "${targetProfileName}" not found in config file at ${CONFIG_PATH}`);
  }

  return { ...defaultProfileSettings, ...targetProfileSettings };
}