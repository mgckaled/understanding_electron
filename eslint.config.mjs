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
                'Importação para camada acima. Ver docs/plan/active/01-camadas-e-fronteiras.md.'
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
  eslintConfigPrettier
)
