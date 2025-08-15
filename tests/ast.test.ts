import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { promises as fs } from 'fs';
import { listSymbolsInFile, initializeParser } from '../src/codebase/ast';

describe('Multi-language AST Symbol Parsing', () => {

    beforeAll(async () => {
        // Ensure the parsers are initialized before any tests run
        await initializeParser();
    });

    // Test for Python
    it('should correctly list symbols in a Python file', async () => {
        const pyFilePath = path.resolve(process.cwd(), 'tests/fixtures/python-sample/main.py');
        const symbols = await listSymbolsInFile(pyFilePath);
        expect(symbols).toEqual(expect.arrayContaining(['Greeter', 'say_hello']));
    });

    // Test for C#
    it('should correctly list symbols in a C# file', async () => {
        const csFilePath = path.resolve(process.cwd(), 'tests/fixtures/csharp-sample/main.cs');
        const symbols = await listSymbolsInFile(csFilePath);
        expect(symbols).toEqual(expect.arrayContaining(['HelloWorld', 'Main', 'SayHello']));
    });

    // Test for C++
    it('should correctly list symbols in a C++ file', async () => {
        const cppFilePath = path.resolve(process.cwd(), 'tests/fixtures/cpp-sample/main.cpp');
        const symbols = await listSymbolsInFile(cppFilePath);
        expect(symbols).toEqual(expect.arrayContaining(['MyClass', 'myFunction']));
    });

    // Test for Ada
    it('should correctly list symbols in an Ada file', async () => {
        const adaFilePath = path.resolve(process.cwd(), 'tests/fixtures/ada-sample/main.adb');
        const symbols = await listSymbolsInFile(adaFilePath);
        expect(symbols).toEqual(expect.arrayContaining(['Hello', 'Hello.World']));
    });
});
