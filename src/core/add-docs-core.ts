/**
 * @file src/core/add-docs-core.ts
 * @description Core logic for the add-docs feature.
 */
import { promises as fs } from 'fs';
import { constructDocsPrompt } from '../ai/index.js';
import { extractCode } from '../commands/handlers/utils.js';
import { AppContext } from '../types.js';

/**
 * Generates documentation for a given file.
 * @param filePath The path to the file to document.
 * @param context The application context.
 * @returns The new, documented content of the file.
 */
export async function runAddDocs(filePath: string, context: AppContext): Promise<string> {
    const { logger, aiProvider } = context;

    logger.info(`- Adding documentation to ${filePath}...`);
    const originalCode = await fs.readFile(filePath, 'utf-8');

    const prompt = constructDocsPrompt(originalCode);
    const response = await aiProvider.invoke(prompt, false);
    const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawCode) {
        throw new Error('Failed to generate documentation. The AI returned an empty response.');
    }

    return extractCode(rawCode);
}