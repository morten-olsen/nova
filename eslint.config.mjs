import { FlatCompat } from '@eslint/eslintrc';
import importPlugin from 'eslint-plugin-import';
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: import.meta.dirname,
});

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [importPlugin.flatConfigs.recommended, importPlugin.flatConfigs.typescript],
    rules: {
      'import/no-unresolved': 'off',
      'import/extensions': ['error', 'ignorePackages'],
      'import/exports-last': 'error',
      'import/no-default-export': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'typeParameter', format: ['PascalCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          filter: { regex: '^__', match: false },
        },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'classProperty', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'classMethod', format: ['camelCase'] },
      ],
      complexity: ['error', 15],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration',
          message: 'Use arrow function syntax instead of function declarations',
        },
        {
          selector: 'PropertyDefinition[accessibility="private"]',
          message: 'Use # for private fields instead of the private keyword',
        },
        {
          selector: 'MethodDefinition[accessibility="private"]',
          message: 'Use # for private methods instead of the private keyword',
        },
      ],
    },
  },
  {
    // Module augmentation requires interface, not type
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },
  {
    // Config files typically need default exports
    files: ['**/*.config.ts', '**/*.config.mjs', '**/*.config.js', '**/vitest.workspace.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    // An android's entry point is defined by its default export: that is what
    // the CLI bundles a call to, and what the browser lab runs.
    files: ['docs/examples/**/*.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    // Repo scripts run under Node, not in a browser. Declared inline rather than
    // pulling in `globals` for two names.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    // The engine runs in Node, in the browser, and inside a Worker. Anything
    // platform-specific belongs behind a host-supplied interface — the
    // `ScriptRunner` split exists precisely because `node:vm` cannot follow the
    // engine into a browser.
    files: ['packages/game/src/**/*.ts', 'packages/match/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'packages/game must stay platform-neutral. Put Node-only code behind an interface and implement it in the host (see ScriptRunner).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/{web,ide}/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // Generated files
    files: ['**/routeTree.gen.ts'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-restricted-types': 'off',
      '@typescript-eslint/unified-signatures': 'off',
    },
  },
  {
    // Tests and migrations are naturally long
    files: ['**/*.test.ts', '**/*.test.tsx', '**/migrations/*.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  ...compat.extends('plugin:prettier/recommended'),
  {
    // Enforce braces for all control statements (Prettier disables it; restore)
    rules: {
      curly: ['error', 'all'],
    },
  },
  {
    // `out/` is Remotion's render target: video, stills, and a full webpack
    // bundle. Linting a bundle's single-line output is what makes an otherwise
    // fast lint look like it has hung.
    ignores: ['**/node_modules/', '**/dist/', '**/.task/', '**/out/'],
  },
);
