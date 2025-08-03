/**
 * @file src/core/test-core.ts
 * @description Core logic for the test generation feature.
 */

import { getSymbolContextWithDependencies } from '../codebase/index.js';
import { constructTestPrompt } from '../ai/index.js';
import { extractCode } from '../commands/handlers/utils.js';
import { AppContext } from '../types.js';
import * as path from 'path';

/**
 * Generates a unit test for a specific symbol in a file.
 * @param filePath The path to the file containing the symbol.
 * @param symbol The name of the function/class to test.
 * @param framework The testing framework to use.
 * @param context The application context.
 * @returns The content of the generated test file.
 */
export async function runTestGeneration(filePath: string, symbol: string, framework: string, context: AppContext): Promise<string> {
    const { logger, aiProvider } = context;
    logger.info(`🔎 Finding context for symbol "${symbol}" in ${filePath}...`);
    const symbolContext = await getSymbolContextWithDependencies(symbol, path.dirname(filePath));

    if (!symbolContext) {
        throw new Error(`Could not find symbol "${symbol}" in the project.`);
    }
    
    logger.info(`🤖 Generating ${framework} test for "${symbol}"...`);
    const prompt = constructTestPrompt(symbolContext, framework);
    const response = await aiProvider.invoke(prompt, false);
    const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawCode) {
        throw new Error('Failed to generate test. The AI returned an empty response.');
    }
    return extractCode(rawCode);
}