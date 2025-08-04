/**
 * @file src/codebase/ast.ts
 * @description Provides a universal, multi-language Abstract Syntax Tree (AST) parser using Tree-sitter.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import C from 'tree-sitter-c';
import Cpp from 'tree-sitter-cpp';
import CSharp from 'tree-sitter-c-sharp';
// import Java from 'tree-sitter-java';
// import Ada from 'tree-sitter-ada';

const parser = new Parser();

const languageConfig: Record<string, { language: any, symbolQuery: string }> = {
    '.ts': {
        language: TypeScript.typescript,
        symbolQuery: `
          [(function_declaration name: (identifier) @symbol.name) @symbol.node]
          [(class_declaration name: (type_identifier) @symbol.name) @symbol.node]`
    },
    '.py': {
        language: Python,
        symbolQuery: `
          [(function_definition name: (identifier) @symbol.name) @symbol.node]
          [(class_definition name: (identifier) @symbol.name) @symbol.node]`
    },
    '.c': {
        language: C,
        symbolQuery: `(function_declarator declarator: (identifier) @symbol.name) @symbol.node`
    },
    '.cpp': {
        language: Cpp,
        symbolQuery: `
          [(function_declarator declarator: (identifier) @symbol.name) @symbol.node]
          [(class_specifier name: (type_identifier) @symbol.name) @symbol.node]`
    },
    '.cs': {
        language: CSharp,
        symbolQuery: `
          [(method_declaration name: (identifier) @symbol.name) @symbol.node]
          [(class_declaration name: (identifier) @symbol.name) @symbol.node]`
    },
    // '.java': {
    //     language: Java.java,
    //     symbolQuery: `
    //       [(method_declaration name: (identifier) @symbol.name) @symbol.node]
    //       [(class_declaration name: (identifier) @symbol.name) @symbol.node]`
    // },
    // '.ada': {
    //     language: Ada.ada,
    //     symbolQuery: `
    //       [(function_declaration name: (identifier) @symbol.name) @symbol.node]
    //       [(class_declaration name: (identifier) @symbol.name) @symbol.node]`
    // }
};

// Map extensions to their main language config
languageConfig['.tsx'] = languageConfig['.ts'];
languageConfig['.js'] = languageConfig['.ts'];
languageConfig['.jsx'] = languageConfig['.ts'];
languageConfig['.h'] = languageConfig['.c'];
languageConfig['.hpp'] = languageConfig['.cpp'];

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
    
    const query = config.language.query(config.symbolQuery);
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
 */export async function getSymbolContent(filePath: string, symbolName: string): Promise<string | null> {
    const config = getLanguageConfig(filePath);
    if (!config) return null;

    parser.setLanguage(config.language);
    const sourceCode = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(sourceCode);
    if (!tree) return null;

    const query = config.language.query(config.symbolQuery);
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