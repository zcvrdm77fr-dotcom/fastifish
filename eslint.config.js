export default [
  {
    ignores: [
      'node_modules/**',
      'vendor/**',
      'inland-depth/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-unreachable': 'error'
    }
  }
];
