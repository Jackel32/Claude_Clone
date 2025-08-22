/**
 * @file src/codebase/dependencies.ts
 * @description Analyzes and builds a dependency graph for the project.
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { scanProject } from './scanner.js';
import { listImportsInFile } from './ast.js';
import { getProjectCacheDir } from './cache-manager.js';
import { logger } from '../logger/index.js';

// Defines the structure of the dependency graph
export interface DependencyGraph {
  [filePath: string]: {
    imports: string[]; // List of files this file imports
    importedBy: string[]; // List of files that import this file
  };
}

/**
 * Builds a complete dependency graph for the entire project.
 * @param projectRoot The absolute path to the project's root.
 * @returns A promise that resolves to the dependency graph.
 */
export async function buildDependencyGraph(projectRoot: string): Promise<DependencyGraph> {
  logger.info('Building dependency graph...');
  const files = await scanProject(projectRoot);
  const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  const graph: DependencyGraph = {};

  // First pass: Initialize graph and find all imports
  for (const file of tsFiles) {
    if (!graph[file]) {
      graph[file] = { imports: [], importedBy: [] };
    }
    const rawImports = await listImportsInFile(file);
    const resolvedImports = rawImports
      .map((importPath: string) => {
        // Attempt to resolve the import relative to the current file
        const resolved = path.resolve(path.dirname(file), importPath);
        // Check for common extensions
        const extensions = ['.ts', '.js', '.json', '/index.ts', '/index.js'];
        for (const ext of extensions) {
          if (tsFiles.includes(resolved + ext)) {
            return resolved + ext;
          }
        }
        return null; // Could not resolve
      })
      .filter((p): p is string => p !== null);
    
    graph[file].imports = resolvedImports;
  }

  // Second pass: Populate the 'importedBy' arrays
  for (const filePath in graph) {
    for (const importedPath of graph[filePath].imports) {
      if (graph[importedPath]) {
        graph[importedPath].importedBy.push(filePath);
      }
    }
  }

  logger.info('Dependency graph built successfully.');
  return graph;
}

/**
 * Saves the dependency graph to a cache file.
 * @param projectRoot The root of the project.
 * @param graph The dependency graph to save.
 */
export async function saveDependencyGraph(projectRoot: string, graph: DependencyGraph): Promise<void> {
  const cacheDir = await getProjectCacheDir(projectRoot);
  const graphPath = path.join(cacheDir, 'dependency-graph.json');
  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
}

/**
 * Loads the dependency graph from the cache.
 * @param projectRoot The root of the project.
 * @returns The loaded dependency graph, or null if it doesn't exist.
 */
export async function loadDependencyGraph(projectRoot: string): Promise<DependencyGraph | null> {
  try {
    const cacheDir = await getProjectCacheDir(projectRoot);
    const graphPath = path.join(cacheDir, 'dependency-graph.json');
    const content = await fs.readFile(graphPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}