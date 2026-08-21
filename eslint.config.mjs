import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    files: ['src/shared/**/*.ts', 'src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message: 'shared/ e core/ são puros — o acesso ao Electron fica em main/ ou preload/.'
            },
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'shared/ e core/ são puros — React só no renderer.'
            },
            {
              group: ['@renderer/*', '**/main/**', '**/preload/**', '**/workers/**'],
              message:
                'Importação para camada acima. Ver docs/plan/implemented/01-camadas-e-fronteiras.md.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message: 'O renderer fala com o main pelo preload. Ver src/shared/ipc.ts.'
            },
            {
              group: ['**/main/**', '**/preload/**', '**/workers/**'],
              message:
                'Importação através da fronteira de processo. Só tipos de @shared atravessam.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.tsx'],
    rules: {
      // eslint-plugin-react checks JSX props against a hand-maintained list of
      // DOM properties, and that list lags the platform. `closedby` on <dialog>
      // (light dismiss) is in Chromium since 134, is declared in @types/react,
      // and is confirmed present in the Chromium 148 this Electron embeds — the
      // plugin simply has not caught up. Listing it here beats a per-line
      // disable: the next platform attribute lands in one place instead of
      // scattering suppressions through components.
      'react/no-unknown-property': ['error', { ignore: ['closedby'] }]
    }
  },
  {
    files: ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  {
    // The Claude Code hooks and the disposable scripts/ tooling are plain
    // JavaScript — they cannot carry a TypeScript return annotation, and this
    // project's explicit-function-return-type does not accept the JSDoc
    // form. Relaxing the rule for these files is narrower than teaching the
    // central parser about checkJs, which is what a real fix would require.
    files: ['.claude/hooks/**/*.mjs', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
