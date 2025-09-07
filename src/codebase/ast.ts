/**
 * @file src/codebase/ast.ts
 * @description Provides a universal, multi-language Abstract Syntax Tree (AST) parser using Tree-sitter.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import Parser from 'tree-sitter';
//import Ada from 'tree-sitter-ada';
import { createRequire } from 'module';
import { logger } from '../logger/index.js';
const require = createRequire(import.meta.url);

const ts = require('tree-sitter-typescript/bindings/node');
const Python = require('tree-sitter-python/bindings/node');
//const CSharp = require('tree-sitter-c-sharp/bindings/node');
const C = require('tree-sitter-c/bindings/node');
const Cpp = require('tree-sitter-cpp/bindings/node'); 

const parser = new Parser();
const languageConfig: Record<string, { language: any, symbolQuery: string, importQuery?: string }> = {};
let isParserInitialized = false;

/**
 * Initializes the Tree-sitter parser and loads all language grammars and queries.
 * This should run only once when the application starts up.
 */
export async function initializeParser(): Promise<void> {
    if (isParserInitialized) return;
    logger.info('Initializing Tree-sitter parsers...');

    const jsTsSymbolQuery = `
      [(function_declaration name: (identifier) @symbol.name) @symbol.node]
      [(class_declaration name: (type_identifier) @symbol.name) @symbol.node]
      [(method_definition name: (property_identifier) @symbol.name) @symbol.node]
    `;
    const jsTsImportQuery = `
      (import_statement source: (string_fragment) @import.path)
      (import_require_clause source: (string_fragment) @import.path)
    `;

    languageConfig['.ts'] = { language: ts.typescript, symbolQuery: jsTsSymbolQuery, importQuery: jsTsImportQuery };
    languageConfig['.tsx'] = { language: ts.tsx, symbolQuery: jsTsSymbolQuery, importQuery: jsTsImportQuery };
    languageConfig['.js'] = { language: ts.typescript, symbolQuery: jsTsSymbolQuery, importQuery: jsTsImportQuery };

    languageConfig['.py'] = {
        language: Python,
        symbolQuery: `
          [(function_definition name: (identifier) @symbol.name) @symbol.node]
          [(class_definition name: (identifier) @symbol.name) @symbol.node]`
    };
    // languageConfig['.cs'] = {
        // language: CSharp,
        // symbolQuery: `
        // [(method_declaration name: (identifier) @symbol.name) @symbol.node]
        // [(class_declaration name: (identifier) @symbol.name) @symbol.node]
        // [(struct_declaration name: (identifier) @symbol.name) @symbol.node]
        // [(interface_declaration name: (identifier) @symbol.name) @symbol.node]`
    // };
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
    // languageConfig['.ada'] = { 
        // language: Ada,
        // symbolQuery: `
          // [(subprogram_body (subprogram_specification "procedure" (defining_program_unit_name (identifier) @symbol.name))) @symbol.node]
          // [(subprogram_body (subprogram_specification "function" (defining_program_unit_name (identifier) @symbol.name))) @symbol.node]
          // [(package_body (package_specification "package" "body" (defining_program_unit_name (identifier) @symbol.name))) @symbol.node]`
    // };

    const extensionAliases: Record<string, string[]> = {
        '.js': ['.mjs', '.cjs'],
        '.tsx': ['.jsx'],
        '.py': ['.pyi', '.pyx', '.pyd', '.pyw'],
        '.cpp': ['.h', '.hpp', '.hxx', '.cxx', '.cc', '.cppm', '.c++', '.h++', '.idl'],
        '.cs': ['.csx'],
        '.ada': ['.ads', '.adb']
    };

    for (const primaryExt in extensionAliases) {
        if (languageConfig[primaryExt]) {
            const aliases = extensionAliases[primaryExt];
            for (const alias of aliases) {
                languageConfig[alias] = languageConfig[primaryExt];
            }
        }
    }

    isParserInitialized = true;
    logger.info('Tree-sitter parsers initialized.');
}

async function getLanguageConfig(filePath: string) {
    if (!isParserInitialized) await initializeParser();
    const extension = path.extname(filePath).toLowerCase();
    return languageConfig[extension];
}

/**
 * Lists all import paths in a given file.
 * @param {string} filePath - The absolute path to the source file.
 * @returns {Promise<string[]>} A list of raw import paths found in the file.
 */
export async function listImportsInFile(filePath: string): Promise<string[]> {
    const config = await getLanguageConfig(filePath);
    if (!config?.language || !config.importQuery) {
        return [];
    }
    
    try {
        parser.setLanguage(config.language);
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const tree = parser.parse(sourceCode);
        const query = new Parser.Query(config.language, config.importQuery);
        const matches = query.captures(tree.rootNode);
        
        return matches
            .filter((m: any) => m.name === 'import.path')
            .map((m: any) => m.node.text.replace(/['"`]/g, '')); // Remove quotes
    } catch (e) {
        logger.error(e, `Failed to query imports in ${filePath}`);
        return [];
    }
}

/**
 * Lists all functions and classes in a given file, regardless of language.
 * @param {string} filePath - The absolute path to the source file.
 * @returns {Promise<string[]>} A list of symbol names found in the file.
 */
export async function listSymbolsInFile(filePath: string): Promise<string[]> {
    const config = await getLanguageConfig(filePath);
    if (!config || !config.language) {
      logger.warn(`No language configuration for "${path.basename(filePath)}", skipping symbol analysis.`);
      return [];
    }
    
    try {
        parser.setLanguage(config.language);
    } catch (e) {
        logger.error(e, `Failed to set language for ${filePath}. The grammar may be incompatible.`);
        return [];
    }
    
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(sourceCode);
    
    try {
      const query = new Parser.Query(config.language, config.symbolQuery);
      const matches = query.captures(tree.rootNode);
      return matches
          .filter((m: any) => m.name === 'symbol.name')
          .map((m: any) => m.node.text);
    } catch (e) {
      logger.error(e, `Failed to query symbols in ${filePath}`);
      return [];
    }
}

/**
 * Finds and returns the full source text of a specific symbol in a file.
 * @param filePath The path to the source file.
 * @param symbolName The name of the symbol to find.
 * @returns The source code of the symbol, or null if not found.
 */
export async function getSymbolContent(filePath: string, symbolName: string): Promise<string | null> {
    const config = await getLanguageConfig(filePath);
    if (!config || !config.language) return null;

    parser.setLanguage(config.language);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(sourceCode);

    try {
      const query = new Parser.Query(config.language, config.symbolQuery);
      const matches = query.captures(tree.rootNode);

      for (const match of matches) {
          if (match.name === 'symbol.name' && match.node.text === symbolName) {
              const nodeMatch = matches.find(m => 
                  m.name === 'symbol.node' && 
                  m.node.startIndex <= match.node.startIndex && 
                  m.node.endIndex >= match.node.endIndex
              );
              if (nodeMatch) return nodeMatch.node.text;
          }
      }
    } catch (e) {
      logger.error(e, `Failed to get content for symbol "${symbolName}" in ${filePath}`);
    }
    return null;
}