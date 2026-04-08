import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(rootDir, 'tsconfig.eslint.json');

const typeAwareRules = {
  ...tseslint.configs.recommended.rules,
  ...tseslint.configs['recommended-type-checked'].rules,
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-console': ['error', { allow: ['error'] }]
};

const baseTypeScriptConfig = {
  parser: tsParser,
  parserOptions: {
    project,
    tsconfigRootDir: rootDir,
    sourceType: 'module',
    ecmaVersion: 'latest'
  }
};

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ...baseTypeScriptConfig,
      globals: globals.node
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...typeAwareRules,
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      ...baseTypeScriptConfig,
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...typeAwareRules,
      'no-unused-vars': 'off'
    }
  }
];
