import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    ignores: ["build/**", "dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        process: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      // [OK] Only the two stable hooks rules per the frozen plan (Phase 0):
      // rules-of-hooks (crash-class) + exhaustive-deps (re-render loops).
      // The v7-only experimental rules (immutability/purity/refs/
      // set-state-in-effect/preserve-manual-memoization) stay off.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // [OK] Belt-and-braces: bot + Cloud Functions run on node, so resolve
    // node env globals explicitly even though the main block already covers
    // these extensions. Keeps console/process/fetch/setTimeout/
    // AbortController as defined globals here.
    files: ['discord-bot/**', 'functions/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
