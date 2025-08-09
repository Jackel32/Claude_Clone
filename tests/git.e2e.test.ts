import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { initializeParser } from '../src/codebase/ast.js';

const execAsync = promisify(exec);
const git = async (command: string, cwd: string) => await execAsync(`git ${command}`, { cwd });

describe('Git Endpoints API', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    const testRepoDir = path.resolve(process.cwd(), 'tests/temp-git-repo');

    beforeAll(async () => {
        await fs.rm(testRepoDir, { recursive: true, force: true });
        await fs.mkdir(testRepoDir, { recursive: true });

        await git('init', testRepoDir);
        await git('config user.name "Test User"', testRepoDir);
        await git('config user.email "test@example.com"', testRepoDir);
        
        await fs.writeFile(path.join(testRepoDir, 'file.txt'), 'initial content');
        await git('add .', testRepoDir);
        await git('commit -m "Initial commit"', testRepoDir);

        await fs.writeFile(path.join(testRepoDir, 'file.txt'), 'updated content');
        await git('add .', testRepoDir);
        await git('commit -m "Second commit"', testRepoDir);

        await git('checkout -b feature-branch', testRepoDir);
        await fs.writeFile(path.join(testRepoDir, 'feature-file.txt'), 'new feature');
        await git('add .', testRepoDir);
        await git('commit -m "Feature commit"', testRepoDir);
        await git('checkout -', testRepoDir);

        await initializeParser();
        server = await startServer();
        agent = request(server);
        await agent.post('/api/set-active-project').send({ projectPath: testRepoDir });
    }, 40000);

    afterAll(async () => {
        await stopServer();
        await fs.rm(testRepoDir, { recursive: true, force: true });
    }, 30000);

    it('should fetch the list of recent commits', async () => {
        const response = await agent.get('/api/commits').expect(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(3);
        expect(response.body[0]).toContain('Feature commit');
        expect(response.body[1]).toContain('Second commit');
        expect(response.body[2]).toContain('Initial commit');
    });

    it('should fetch the diff between two commits', async () => {
        const commits = await agent.get('/api/commits');
        const commit2Hash = commits.body[1].split('|')[0];
        const commit1Hash = commits.body[2].split('|')[0];
        const response = await agent.post('/api/diff')
            .send({ startCommit: commit1Hash, endCommit: commit2Hash })
            .expect(200);
        expect(response.body.patch).toContain('-initial content');
        expect(response.body.patch).toContain('+updated content');
    }, 20000);

    it('should fetch the diff between two branches', async () => {
        const branchesResponse = await agent.get('/api/branches').expect(200);
        const mainBranch = branchesResponse.body.find(b => b.includes('main') || b.includes('master'));
        const response = await agent.post('/api/diff')
            .send({ baseBranch: mainBranch, compareBranch: 'feature-branch' })
            .expect(200);
        expect(response.body.patch).toContain('+++ b/feature-file.txt');
        expect(response.body.patch).toContain('+new feature');
    }, 20000);
});