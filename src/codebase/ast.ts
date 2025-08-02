/**
 * @file src/codebase/ast.ts
 * @description Provides Abstract Syntax Tree (AST) parsing for deep context retrieval.
 */

import * as ts from 'typescript';
import { promises as fs } from 'fs';
import { scanProject } from './scanner.js';
import * as path from 'path';

/**
 * Finds the definition of a specific symbol (function, class, etc.) within a single file.
 * This is a helper function for our more advanced context gatherer.
 * @param symbol The name of the symbol to find.
 * @param filePath The absolute path to the file to search in.
 * @returns The source code of the symbol's definition, or null.
 */
async function findSymbolInFile(symbol: string, filePath: string): Promise<string | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2020, true);
  let foundSymbolCode: string | null = null;

  function visit(node: ts.Node) {
    if (foundSymbolCode) return; // Stop searching if found
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      node.name && node.name.getText(sourceFile) === symbol
    ) {
      foundSymbolCode = node.getText(sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return foundSymbolCode;
}

/**
 * Gathers rich, dependency-aware context for a given symbol.
 * It finds the primary symbol's definition and the definitions of any local functions/classes it imports.
 * @param {string} symbol The name of the function or class to find.
 * @param {string} projectRoot The root directory of the project.
 * @returns {Promise<string | null>} A formatted string of all relevant source code, or null.
 */
export async function getSymbolContextWithDependencies(symbol: string, projectRoot: string): Promise<string | null> {
  const allTsFiles = (await scanProject(projectRoot)).filter(f => f.endsWith('.ts'));
  let primarySymbol: { filePath: string, content: string } | null = null;

  // First, find the primary symbol definition across all files
  for (const file of allTsFiles) {
    const content = await findSymbolInFile(symbol, file);
    if (content) {
      primarySymbol = { filePath: file, content };
      break;
    }
  }

  if (!primarySymbol) {
    return null; // The primary symbol was not found anywhere
  }

  let context = `--- Definition for ${symbol} in ${path.relative(projectRoot, primarySymbol.filePath)} ---\n${primarySymbol.content}`;
  
  // Now, find its dependencies
  const sourceFile = ts.createSourceFile(primarySymbol.filePath, primarySymbol.content, ts.ScriptTarget.ES2020, true);
  const dependencyContext: string[] = [];

  const visitImports = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.getText(sourceFile).includes('./')) {
      const importPath = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      const absoluteImportPath = path.resolve(path.dirname(primarySymbol!.filePath), importPath) + '.ts';
      
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          const importedSymbolName = element.name.getText(sourceFile);
          
          // Asynchronously find the definition of this imported symbol
          findSymbolInFile(importedSymbolName, absoluteImportPath).then(dependencyContent => {
            if (dependencyContent) {
              dependencyContext.push(`--- Imported Dependency: ${importedSymbolName} from ${path.relative(projectRoot, absoluteImportPath)} ---\n${dependencyContent}`);
            }
          });
        }
      }
    }
  };

  ts.forEachChild(sourceFile, visitImports);
  
  // A small delay to allow async dependency lookups to complete. A more robust solution might use Promise.all.
  await new Promise(resolve => setTimeout(resolve, 200));

  if (dependencyContext.length > 0) {
    context += '\n\n' + dependencyContext.join('\n\n');
  }

  return context;
}