import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'consistent-return': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // Rules that apply only to non-test files
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*', '**/__tests__/**'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Exempt unrefactored modules and UI view wrappers from strict line-length limits
    files: [
      'src/server/repositories/**',
      'src/server/routes/**',
      'src/server/services/reminderEngine.ts',
      'src/web/views/**',
      'src/web/components/**',
    ],
    rules: {
      complexity: 'off',
      'max-depth': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // no-magic-numbers for server services (ignore 0, 1, -1, array indexes)
    files: ['src/server/services/**/*.ts'],
    ignores: ['**/*.test.*', '**/__tests__/**'],
    rules: {
      'no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', 'public/**'],
  },
);
