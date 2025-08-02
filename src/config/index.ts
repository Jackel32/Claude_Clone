/**
 * @file Manages loading, creating, and accessing configuration files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Config, Profile } from './schema';
import { defaultConfig } from './defaults';
import { writeFile } from '../fileops';

const CONFIG_DIR = path.join(os.homedir(), '.kinch-code');
const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

let loadedConfig: Config | null = null;

/**
 * Ensures that the configuration directory and a default config file exist.
 * Also ensures the cache directory exists.
 */
async function ensureConfigExists(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    try {
      await fs.access(CONFIG_FILE_PATH);
    } catch {
      // Config file doesn't exist, so create it with defaults.
      console.log(`Creating default configuration at: ${CONFIG_FILE_PATH}`);
      await writeFile(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
    }
  } catch (error) {
    console.error('Failed to create or access configuration directory:', error);
    process.exit(1);
  }
}

/**
 * Loads the configuration from `~/.kinch-code/config.json`.
 * @param forceReload - If true, re-reads the config file from disk.
 * @returns The loaded configuration object.
 */
async function loadConfig(forceReload: boolean = false): Promise<Config> {
  if (loadedConfig && !forceReload) {
    return loadedConfig;
  }

  await ensureConfigExists();
  try {
    const fileContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    loadedConfig = JSON.parse(fileContent) as Config;
    return loadedConfig;
  } catch (error) {
    console.error(`Error reading or parsing configuration file at ${CONFIG_FILE_PATH}.`);
    console.error('Please ensure it is valid JSON. Using default configuration as a fallback.');
    return defaultConfig;
  }
}

/**
 * Gets the cache directory path.
 * @returns The absolute path to the cache directory.
 */
export function getCacheDir(): string {
    return CACHE_DIR;
}

/**
 * Retrieves a specific profile from the configuration, merged with defaults.
 * @param profileName - The name of the profile to retrieve. If not provided,
 * the default profile is used.
 * @returns The requested profile configuration.
 */
export async function getProfile(profileName?: string): Promise<Profile> {
  const config = await loadConfig();
  const targetProfileName = profileName || config.defaultProfile;
  const defaultProfileSettings = config.profiles[config.defaultProfile] || {};
  const targetProfileSettings = config.profiles[targetProfileName] || {};

  if (!config.profiles[targetProfileName]) {
    console.warn(`Warning: Profile "${targetProfileName}" not found. Falling back to default profile settings.`);
  }

  return {
    ...defaultConfig.profiles.default, // Base defaults
    ...defaultProfileSettings,        // User's default profile settings
    ...targetProfileSettings,          // Specific profile settings
  };
}