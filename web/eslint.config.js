// ESLint — admin panel. Qatlamlar (Feature-Sliced Design) chegarasi
// `boundaries` bilan majburiy: routes → features → entities → shared,
// faqat pastga import (ARXITEKTURA 10-bo'lim, CONTRIBUTING 5-bo'lim).
import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const layer = (type) => ({ element: { type } })
const anyLayer = (types) => ({ element: { types: { anyOf: types } } })

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'src/routeTree.gen.ts',
    'src/shared/api/database.types.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      jsxA11y.flatConfigs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-refresh': reactRefresh, boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'routes', pattern: 'src/routes' },
        { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'entities', pattern: 'src/entities/*', capture: ['entity'] },
        { type: 'shared', pattern: 'src/shared' },
      ],
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: layer('app'),
              allow: { to: anyLayer(['app', 'routes', 'features', 'entities', 'shared']) },
            },
            {
              from: layer('routes'),
              allow: { to: anyLayer(['routes', 'features', 'entities', 'shared']) },
            },
            { from: layer('features'), allow: { to: anyLayer(['entities', 'shared']) } },
            { from: layer('entities'), allow: { to: layer('shared') } },
            { from: layer('shared'), allow: { to: layer('shared') } },
          ],
        },
      ],
    },
  },
  {
    // shadcn/ui primitivlari — vendored kod (`shadcn add` bilan yangilanadi).
    // Ularni qo'lda "tozalash" keyingi yangilanishlarni buzadi, shuning uchun
    // faqat shu qoidalar yumshatiladi. A11y ishlatish joyida ta'minlanadi
    // (masalan <Label htmlFor>), input-group bosishi — faqat sichqoncha qulayligi.
    files: ['src/shared/ui/**/*.tsx', 'src/shared/hooks/**/*.ts'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
])
