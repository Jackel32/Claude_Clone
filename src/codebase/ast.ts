/**
 * @file src/codebase/ast.ts
 * @description Provides a universal, multi-language Abstract Syntax Tree (AST) parser using Tree-sitter.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import Parser from 'tree-sitter';
import Ada from 'tree-sitter-ada';

import { createRequire } from 'module';
import { logger } from '../logger/index.js';
const require = createRequire(import.meta.url);

const TypeScript = require('tree-sitter-typescript/bindings/node');
const Python = require('tree-sitter-python/bindings/node');
const CSharp = require('tree-sitter-c-sharp/bindings/node');
const C = require('tree-sitter-c/bindings/node');
const Cpp = require('tree-sitter-cpp/bindings/node'); 

const parser = new Parser();
const languageConfig: Record<string, { language: any, symbolQuery: string }> = {};

/**
 * Initializes the Tree-sitter parser and loads all language grammars and queries.
 * This should run only once when the application starts up.
 */
export async function initializeParser(): Promise<void> {
        if (Object.keys(languageConfig).length > 0) return; // Already initialized

    logger.info('Initializing Tree-sitter parsers...');
    
    // The Parser class itself is imported directly.
    // The language grammars are loaded via require.

    languageConfig['.ts'] = {
        language: TypeScript,
        symbolQuery: `
          [(function_declaration name: (identifier) @symbol.name) @symbol.node]
          [(lexical_declaration (variable_declarator name: (identifier) @symbol.name value: [(arrow_function) (function)])) @symbol.node]
          [(class_declaration name: (type_identifier) @symbol.name) @symbol.node]
          [(interface_declaration name: (type_identifier) @symbol.name) @symbol.node]`
    };
    languageConfig['.py'] = {
        language: Python,
        symbolQuery: `
          [(function_definition name: (identifier) @symbol.name) @symbol.node]
          [(class_definition name: (identifier) @symbol.name) @symbol.node]`
    };
    languageConfig['.cs'] = {
        language: CSharp,
        symbolQuery: `
        [(method_declaration name: (identifier) @symbol.name) @symbol.node]
        [(class_declaration name: (identifier) @symbol.name) @symbol.node]
        [(struct_declaration name: (identifier) @symbol.name) @symbol.node]
        [(interface_declaration name: (identifier) @symbol.name) @symbol.node]`
    };
    languageConfig['.c'] = {
        language: C,
        symbolQuery: `(function_declarator declarator: (identifier) @symbol.name) @symbol.node`
    };
    languageConfig['.cpp'] = {
        language: Cpp,
        symbolQuery: `
          [(function_declarator declarator: (identifier) @symbol.name) @symbol.node]
          [(class_specifier name: (type_identifier) @symbol.name) @symbol.node]
          [(struct_specifier name: (type_identifier) @symbol.name) @symbol.node]`
    };
    languageConfig['.ada'] = { 
        language: Ada,
        symbolQuery: `
          [(subprogram_body (subprogram_specification "procedure" (defining_program_unit_name (identifier) @symbol.name))) @symbol.node]
          [(subprogram_body (subprogram_specification "function" (defining_program_unit_name (identifier) @symbol.name))) @symbol.node]
          [(package_body (package_specification "package" "body" (defining_program_unit_name (identifier) @symbol.name))) @symbol.node]`
    };

    const extensionAliases: Record<string, string[]> = {
        '.ts': ['.tsx', '.js', '.jsx', '.mjs', '.cjs'],
        '.py': ['.pyi', '.pyx', '.pyd', '.pyw'],
        '.cpp': ['.h', '.hpp', '.hxx', '.cxx', '.cc', '.cppm', '.c++', '.h++', '.idl'],
        '.cs': ['.csx'],
        '.ada': ['.ads', '.adb']
    };

    // Populate the languageConfig with aliases
    for (const primaryExt in extensionAliases) {
        const aliases = extensionAliases[primaryExt];
        for (const alias of aliases) {
            languageConfig[alias] = languageConfig[primaryExt];
        }
    }

    logger.info('Tree-sitter parsers initialized for all supported languages.');
}

function getLanguageConfig(filePath: string) {
    const extension = path.extname(filePath);
    return languageConfig[extension];
}

/**
 * Lists all functions and classes in a given file, regardless of language.
 * @param {string} filePath - The absolute path to the source file.
 * @returns {Promise<string[]>} A list of symbol names found in the file.
 */
export async function listSymbolsInFile(filePath: string): Promise<string[]> {
    const config = getLanguageConfig(filePath);
    if (!config) return [];
    
    parser.setLanguage(config.language);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(sourceCode);
    if (!tree) return [];
    
    const query = new Parser.Query(config.language, config.symbolQuery);
    const matches = query.captures(tree.rootNode);
    
    return matches
        .filter((m: any) => m.name === 'symbol.name')
        .map((m: any) => m.node.text);
}

/**
 * Finds and returns the full source text of a specific symbol in a file.
 * @param filePath The path to the source file.
 * @param symbolName The name of the symbol to find.
 * @returns The source code of the symbol, or null if not found.
 */
export async function getSymbolContent(filePath: string, symbolName: string): Promise<string | null> {
    const config = getLanguageConfig(filePath);
    if (!config) return null;

    parser.setLanguage(config.language);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(sourceCode);
    if (!tree) return null;

    const query = new Parser.Query(config.language, config.symbolQuery);
    const matches = query.captures(tree.rootNode);

    for (let i = 0; i < matches.length; i++) {
        if (matches[i].name === 'symbol.name' && matches[i].node.text === symbolName) {
            if (matches[i + 1] && matches[i + 1].name === 'symbol.node') {
                return matches[i + 1].node.text;
            }
        }
    }
    return null;
}