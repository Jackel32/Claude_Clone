/**
 * @file src/codebase/language-detector.ts
 * @description Detects programming languages in a project based on file extensions.
 */

import * as path from 'path';
import { scanProject } from './scanner.js';

// Mapping from file extensions to language identifiers
const EXTENSION_TO_LANGUAGE: { [key: string]: string } = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'typescript', // Often in TS projects
    '.jsx': 'typescript',
    '.py': 'python',
    '.cs': 'csharp',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.adb': 'ada',
    '.ads': 'ada',
};

/**
 * Scans a project directory and returns a unique list of detected programming languages.
 * @param projectRoot The root directory of the project to scan.
 * @returns A promise that resolves to an array of language identifier strings.
 */
export async function detectProjectLanguages(projectRoot: string): Promise<string[]> {
    const files = await scanProject(projectRoot);
    const detectedLanguages = new Set<string>();

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (EXTENSION_TO_LANGUAGE[ext]) {
            detectedLanguages.add(EXTENSION_TO_LANGUAGE[ext]);
        }
    }

    return Array.from(detectedLanguages);
}
