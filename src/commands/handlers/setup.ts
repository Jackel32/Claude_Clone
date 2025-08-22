/**
 * @file src/commands/handlers/setup.ts
 * @description Handler for the interactive 'setup' command.
 */

import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../logger/index.js';
import { defaultConfig } from '../../config/defaults.js';
import { Config } from '../../config/schema.js';

const CONFIG_DIR = path.join(os.homedir(), '.claude-code');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

async function loadConfig(): Promise<Config> {
  try {
    const fileContent = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(fileContent) as Config;
  } catch (error) {
    // If config doesn't exist, start with the default
    return JSON.parse(JSON.stringify(defaultConfig));
  }
}

async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function handleSetupCommand(): Promise<void> {
  logger.info('Welcome to the Kinch Code setup wizard!');
  
  const config = await loadConfig();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider would you like to use by default?',
      choices: ['gemini'], // Removed 'anthropic' as it's not fully supported
      default: config.profiles.default?.provider || 'gemini',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: (answers) => `Please enter your API key for ${answers.provider}:`,
      mask: '*',
    },
    {
        type: 'list',
        name: 'model',
        message: 'Which generation model would you like to use?',
        choices: (answers) => {
            if (answers.provider === 'gemini') {
                return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
            }
            // Fallback for other providers if added later
            return [];
        },
        default: (answers: { provider: string }) => {
            const providerDefaults = defaultConfig.profiles.default.providers?.[answers.provider];
            return providerDefaults?.generation || '';
        }
    },
    {
        type: 'list',
        name: 'embeddingModel',
        message: 'Which embedding model would you like to use for codebase indexing?',
        choices: (answers) => {
            if (answers.provider === 'gemini') {
                return ['gemini-embedding-001', 'embedding-001', 'gemini-1.5-flash-embedding'];
            }
        },
        default: (answers: { provider: string }) => {
            const providerDefaults = defaultConfig.profiles.default.providers?.[answers.provider];
            return providerDefaults?.embedding;
        },
        when: (answers) => answers.provider === 'gemini', // Only ask for Gemini
    }
  ]);

  // Update the configuration
  config.defaultProfile = 'default';
  if (!config.profiles.default) {
    config.profiles.default = {};
  }
  if (!config.profiles.default.providers) {
      config.profiles.default.providers = {};
  }
  
  const providerKey = answers.provider as 'gemini';

  if (!config.profiles.default.providers[providerKey]) {
      config.profiles.default.providers[providerKey] = {};
  }
  
  config.profiles.default.provider = answers.provider;
  config.profiles.default.providers[providerKey]!.apiKey = answers.apiKey;
  config.profiles.default.providers[providerKey]!.generation = answers.model;
  config.profiles.default.providers[providerKey]!.embedding = answers.embeddingModel;

  await saveConfig(config);

  logger.info('✅ Configuration saved successfully!');
  logger.info(`Your settings have been written to: ${CONFIG_PATH}`);
}