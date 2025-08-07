/**
 * @file src/core/add-docs-core.ts
 * @description Core logic for the add-docs feature.
 */
import { constructDocsPrompt } from '../ai/index.js';
import { extractCode } from '../commands/handlers/utils.js';
import { AppContext } from '../types.js';

/**
 * Generates documentation for a given file's content.
 * @param originalContent The original content of the file.
 * @param context The application context.
 * @returns The new, documented content of the file.
 */
export async function runAddDocs(originalContent: string, context: AppContext): Promise<string> {
    const { logger, aiProvider } = context;

    logger.info(`- Generating documentation...`);
    
    const prompt = constructDocsPrompt(originalContent);
    const response = await aiProvider.invoke(prompt, false);
    const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawCode) {
        throw new Error('Failed to generate documentation. The AI returned an empty response.');
    }

    return extractCode(rawCode);
}