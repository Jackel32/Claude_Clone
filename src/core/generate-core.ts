/**
 * @file src/core/generate-core.ts
 * @description Core logic for the code generation feature.
 */

import { queryVectorIndex } from '../codebase/index.js';
import { constructGeneratePrompt } from '../ai/index.js';
import { AppContext } from '../types.js';
import { extractCode } from '../commands/handlers/utils.js';
import * as path from 'path';

/**
 * Generates a new code snippet based on a user prompt and relevant context.
 * @param userPrompt The user's instructions for what to generate.
 * @param context The application context.
 * @returns The generated code snippet as a string.
 */
export async function runGenerate(userPrompt: string, context: AppContext): Promise<string> {
    const { logger, aiProvider, profile, args } = context;
    const projectRoot = path.resolve(args.path || profile.cwd || '.');
    const topK = profile.rag?.topK || 3;

    logger.info(`🔎 Finding relevant code for context in ${projectRoot}...`);
    const codeContext = await queryVectorIndex(projectRoot, userPrompt, aiProvider, topK);

    logger.info('🤖 Generating code snippet...');
    const prompt = constructGeneratePrompt(userPrompt, codeContext);

    const response = await aiProvider.invoke(prompt, false);
    const rawCode = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawCode) {
        throw new Error('Failed to generate code. The AI returned an empty response.');
    }

    return extractCode(rawCode);
}
