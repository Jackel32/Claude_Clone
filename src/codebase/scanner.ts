import { promises as fs } from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ignore = require('ignore');

export async function scanProject(projectRoot: string): Promise<string[]> {
  const ig = ignore();
  ig.add(['.git', 'node_modules', '.kinchignore']);

  const kinchignorePath = path.join(projectRoot, '.kinchignore');
  try {
    const kinchignoreContent = await fs.readFile(kinchignorePath, 'utf-8');
    ig.add(kinchignoreContent);
  } catch (error) {
    // .kinchignore not found, which is also fine.
  }

  const files: string[] = [];
  const queue: string[] = [projectRoot];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(projectRoot, fullPath);

            if (ig.ignores(relativePath)) {
                continue;
            }

            if (entry.isDirectory()) {
                queue.push(fullPath);
            } else {
                files.push(fullPath);
            }
        }
    } catch (error) {
        // Ignore errors from directories we can't read
    }
  }

  return files;
}