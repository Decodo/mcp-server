import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      'curly': ['error', 'all'],
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
      'prefer-arrow-callback': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration',
          message: 'Use arrow functions instead of function declarations.',
        },
      ],
    },
  },
  {
    ignores: ['build/**', 'node_modules/**', 'jest.config.ts'],
  }
);
