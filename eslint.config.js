import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Applies recommended configurations from ESLint and the TypeScript plugin
  ...tseslint.configs.recommended,
  
  // Custom configuration object
  {
    ignores: [
      'dist/',
      'grammars/',
      'public/app.js' // It's better to lint the source TS, not the bundled JS
    ],
    // ------------------------------------
    languageOptions: {
      globals: {
        ...globals.node, // Enables Node.js global variables
      },
    },
    rules: {
      // This is our custom rule to disallow 'console.log' and 'console.info'
      'no-console': ['error', { allow: ['warn', 'error'] }],
      
      // A helpful rule to warn about unused variables
      '@typescript-eslint/no-unused-vars': 'warn',

      // Temporarily disable the 'no-explicit-any' rule so we can focus on one thing at a time
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);