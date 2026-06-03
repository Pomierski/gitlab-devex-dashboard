import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    extends: [tseslint.configs.base],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      curly: ['error', 'all'],
    },
  },
  prettier,
  {
    ignores: ['dist/', '.astro/', 'node_modules/'],
  },
);
