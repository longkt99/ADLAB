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
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // ============================================
  // Global rules for app code: no-console
  // ============================================
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['scripts/**', 'lib/log.ts', 'node_modules/**'],
    rules: {
      // Enforce no-console in app code - use lib/log.ts instead
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
