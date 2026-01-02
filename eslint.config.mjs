import { dirname } from 'path';
import { fileURLToPath } from 'url';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // ============================================
  // Base TypeScript + React configuration
  // ============================================
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // React 19 doesn't require importing React
      'react/react-in-jsx-scope': 'off',
      // Allow underscore-prefixed unused vars (common pattern for intentionally unused params)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // ============================================
  // Global rules for app code: no-console (allow console.log in app/lib)
  // ============================================
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['scripts/**', 'lib/log.ts', 'node_modules/**', 'app/**', 'lib/**', 'components/**'],
    rules: {
      // Enforce no-console in non-app code - use lib/log.ts instead
      'no-console': ['error', {
        allow: ['warn', 'error'],
      }],
    },
  },

  // ============================================
  // Exceptions: Scripts directory
  // ============================================
  {
    files: ['scripts/**/*.{js,mjs,ts}'],
    rules: {
      'no-console': 'off',
    },
  },

  // ============================================
  // Exceptions: Logger module
  // ============================================
  {
    files: ['lib/log.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // ============================================
  // Exceptions: Test files - relax strict rules
  // ============================================
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts'],
    rules: {
      // Tests often need console for debugging and assertions
      'no-console': 'off',
      // Tests often use any for mocking and flexible assertions
      '@typescript-eslint/no-explicit-any': 'warn',
      // Tests may assign to module for mocking
      '@next/next/no-assign-module-variable': 'off',
    },
  },

  // ============================================
  // Exceptions: Studio, quality, orchestrator - dev console.log behind NODE_ENV check
  // ============================================
  {
    files: [
      'app/**/*.tsx',
      'app/**/*.ts',
      'lib/**/*.ts',
      'components/**/*.tsx',
    ],
    rules: {
      // These modules use conditional console.log for dev debugging and API error logging
      'no-console': ['error', { allow: ['warn', 'error', 'log', 'info', 'debug', 'group', 'groupEnd', 'table'] }],
    },
  },

  // ============================================
  // Exceptions: Styled-jsx support
  // ============================================
  {
    files: ['**/*.tsx'],
    rules: {
      // styled-jsx uses jsx property
      'react/no-unknown-property': ['error', { ignore: ['jsx'] }],
    },
  },

  // ============================================
  // Global ignores
  // ============================================
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
    ],
  },
);
