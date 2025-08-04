/**
 * @file src/codebase/tree.ts
 * @description Builds a hierarchical JSON representation of the project's file structure.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ignore = require('ignore');
import { findGitRoot, isGitRepository, readFile } from '../fileops/index.js';
import { listSymbolsInFile } from './ast.js';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
}

async function getIgnoreFilter(projectRoot: string) {
  const ig = ignore();
  ig.add(['.git', 'node_modules', 'dist']);

  if (await isGitRepository(projectRoot)) {
    const gitRoot = await findGitRoot(projectRoot);
    if (gitRoot) {
      const gitignorePath = path.join(gitRoot, '.gitignore');
      try {
        const gitignoreContent = await readFile(gitignorePath);
        ig.add(gitignoreContent);
      } catch (e) {}
    }
  }
  return ig;
}

export async function buildFileTree(startPath: string): Promise<FileTreeNode> {
  const ig = await getIgnoreFilter(startPath);
  const stats = await fs.stat(startPath);
  const rootNode: FileTreeNode = {
    name: path.basename(startPath),
    path: startPath,
    type: stats.isDirectory() ? 'folder' : 'file',
    children: [],
  };

  async function recurse(currentPath: string, node: FileTreeNode) {
    if (!node.children) return;

    const entries = await fs.readdir(currentPath);
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const relativePath = path.relative(startPath, fullPath);

      if (ig.ignores(relativePath)) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      const childNode: FileTreeNode = {
        name: entry,
        path: fullPath,
        type: stats.isDirectory() ? 'folder' : 'file',
      };

      if (stats.isDirectory()) {
        childNode.children = [];
        await recurse(fullPath, childNode);
      }
      
      node.children.push(childNode);
    }
  }

  await recurse(startPath, rootNode);
  return rootNode;
}

/**
 * Builds a hierarchical file tree containing only files with testable symbols.
 * @param startPath The root path to start scanning from.
 * @returns A FileTreeNode or null if no testable files are found.
 */
export async function buildTestableFileTree(startPath: string): Promise<FileTreeNode | null> {
    const ig = await getIgnoreFilter(startPath);

    async function recurse(currentPath: string): Promise<FileTreeNode | null> {
        const stats = await fs.stat(currentPath);
        const name = path.basename(currentPath);
        const relativePath = path.relative(startPath, currentPath);

        if (relativePath && ig.ignores(relativePath)) {
            return null;
        }

        if (stats.isDirectory()) {
            const children = (await fs.readdir(currentPath))
                .map(child => recurse(path.join(currentPath, child)));

            const resolvedChildren = (await Promise.all(children)).filter(c => c !== null) as FileTreeNode[];
            
            if (resolvedChildren.length > 0) {
                return { name, path: currentPath, type: 'folder', children: resolvedChildren };
            }
        } else if (stats.isFile() && currentPath.endsWith('.ts')) {
            const symbols = await listSymbolsInFile(currentPath);
            if (symbols.length > 0) {
                return { name, path: currentPath, type: 'file' };
            }
        }
        return null;
    }

    return recurse(startPath);
}