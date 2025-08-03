/**
 * @file src/core/refactor-core.ts
 * @description Core logic for the refactor feature.
 */

import { promises as fs } from 'fs';
import { constructRefactorPrompt } from '../ai/index.js';
import { extractCode } from '../commands/handlers/utils.js';
import { AppContext } from '../types.js';

/**
 * Generates a refactored version of a file based on a user prompt.
 * @param filePath The path to the file to refactor.
 * @param userPrompt The user's refactoring instructions.
 * @param context The application context.
 * @returns The new, refactored content of the file.
 */
export async function runRefactor(filePath: string, userPrompt: string, context: AppContext): Promise<string> {
    const { logger, aiProvider } = context;
    logger.info(`- Refactoring ${filePath}...`);
    const originalCode = await fs.readFile(filePath, 'utf-8');
    
    const prompt = constructRefactorPrompt(userPrompt, originalCode);
    const response = await aiProvider.invoke(prompt, false);
    const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawCode) {
        throw new Error('Failed to refactor. The AI returned an empty response.');
    }
    return extractCode(rawCode);
}