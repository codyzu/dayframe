import eslintPluginAstro from 'eslint-plugin-astro';

/**
@type {import('xo').FlatXoConfig}
*/
const config = [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.wrangler/**',
      'playwright-report/**',
      'test-results/**',
      '.vscode/**',
      'docs/technical-specification.md',
    ],
  },
  {
    space: 2,
    prettier: true,
    semicolon: true,
    rules: {
      'import-x/extensions': 'off',
      // Prettier removes redundant arithmetic parentheses; let it own this formatting.
      '@stylistic/no-mixed-operators': 'off',
      // M1 tooling gate deliberately pins exact runtime and dependency versions.
      'package-json/dependency-version-range': 'off',
      'package-json/prefer-engines-range': 'off',
      // Worker binding names and external API option names are contracts.
      '@typescript-eslint/naming-convention': 'off',
    },
  },
  {
    files: ['**/*.astro'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {case: 'pascalCase', checkDirectories: false},
      ],
      'n/file-extension-in-import': 'off',
    },
  },
  {
    files: ['src/pages/**/*.astro'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {case: 'kebabCase', checkDirectories: false},
      ],
    },
  },
  // Retain broad browser compatibility instead of requiring Iterator helpers.
  {
    files: ['src/lib/photos/**/*.ts'],
    rules: {
      'unicorn/prefer-iterator-to-array': 'off',
      'no-await-in-loop': 'off',
    },
  },
  {files: ['tests/**/*.ts'], rules: {'no-await-in-loop': 'off'}},
  {files: ['scripts/**/*.mjs'], rules: {'unicorn/no-process-exit': 'off'}},
  {files: ['astro.config.mjs'], rules: {'new-cap': 'off'}},
  {
    files: ['package.json'],
    rules: {
      'package-json/dependency-version-range': 'off',
      'package-json/prefer-engines-range': 'off',
    },
  },
  {
    files: ['src/lib/offline/navigation-worker.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.navigation.json',
      },
    },
  },
  ...eslintPluginAstro.configs['flat/recommended'],
];
export default config;
