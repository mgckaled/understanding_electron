# 01 — Camadas e fronteiras

**Depende de:** nada · **Entrega:** estrutura de pastas, aliases nos três ambientes, regra de importação verificada pelo ESLint

---

## Por que esta fase existe

O scaffold tem três pastas — `main`, `preload`, `renderer` — e nenhum lugar para código que não pertence a nenhuma delas.

Considere uma função que recebe o cabeçalho de um CSV e infere o tipo de cada coluna. Ela não é UI, não é ciclo de vida de janela e não é ponte de IPC. É lógica pura. Onde ela mora?

Sem uma resposta, ela vai morar onde foi usada primeiro. Se foi usada no main, vira função no main — e no dia em que a inferência precisar rodar no `utilityProcess`, ou aparecer numa pré-visualização no renderer, o código está preso num processo que não pode ser importado de nenhum dos outros.

O mesmo vale para o tipo do resultado dessa inferência, que precisa ser conhecido pelos três processos ao mesmo tempo.

**São duas pastas faltando, e as duas são a base de tudo o que vem depois.**

Há uma vantagem específica do Electron aqui que vale nomear. No projeto Python, `core/` puro é disciplina — nada além da revisão impede um `import flet` lá dentro. Aqui a fronteira é **física**: os processos têm globals diferentes e já compilam sob `tsconfig` separados. Parte da regra é verificável por máquina, e esta fase existe para fazer a outra parte também ser.

---

## Decisões tomadas

### D1.1 — Seis pastas em `src/`

```
src/
├── shared/     contrato e tipos de domínio. Conhecido pelos três processos.
├── core/       lógica pura. Sem electron, sem react.
├── main/       ciclo de vida, janelas, roteamento de IPC. Fino.
├── workers/    entrypoints de utilityProcess. Vazia por ora.
├── preload/    a única superfície exposta ao renderer.
└── renderer/   React.
```

`workers/` nasce vazia com um `.gitkeep`. Criar a pasta agora custa nada e evita que, no dia do DuckDB, o entrypoint acabe em `main/` "por enquanto".

**Descartado:** juntar `shared/` e `core/`. São coisas diferentes — `shared/` é vocabulário (tipos, contrato, constantes) e é importado por todo mundo; `core/` é comportamento e nem sempre é necessário nos dois lados. Manter separado deixa a regra de importação mais simples e o bundle do renderer menor.

### D1.2 — A tabela de importação é a lei

| Camada | Pode importar | Nunca importa |
|---|---|---|
| `shared/` | apenas `zod` (fase 02) | tudo o mais |
| `core/` | `shared/`, stdlib do Node, libs puras | `electron`, `react`, `main/`, `renderer/`, `preload/`, `workers/` |
| `main/` | `shared/`, `core/`, `electron` | `react`, `renderer/`, `preload/` |
| `workers/` | `shared/`, `core/` | `react`, `renderer/`, `main/` |
| `preload/` | `shared/` (somente tipos), `electron` | `core/`, `main/`, `renderer/` |
| `renderer/` | `shared/` (somente tipos), `core/`, `react` | `electron`, `main/`, `preload/`, `workers/` |

Duas linhas merecem explicação.

**`preload/` não importa `core/`.** O preload deve ser fino a ponto de não ter o que testar — ele traduz chamada em mensagem, e nada mais. Se lógica entrar ali, ela fica no lugar mais difícil de testar do projeto inteiro. A partir da fase 03 ele também roda em ambiente restrito, o que reforça a regra por outro caminho.

**`renderer/` não importa `electron`.** Óbvio, mas é o erro mais comum em projeto Electron — e o mais silencioso, porque o TypeScript aceita (`electron` está em `devDependencies`, os tipos resolvem) e a falha só aparece em runtime, no navegador, como `require is not defined`.

### D1.3 — Aliases em vez de caminhos relativos

`@shared`, `@core` e `@renderer`. Sem eles, `src/renderer/src/features/x/hooks/useY.ts` importa o contrato como `../../../../../shared/ipc` — e qualquer arquivo que se mova quebra a contagem de pontos.

O alias `@renderer` já existe. Os outros dois precisam ser declarados em **quatro lugares**: os três blocos do `electron.vite.config.ts` e os dois `tsconfig`. Para não divergirem, ficam num módulo único importado por todos.

### D1.4 — `paths` sem `baseUrl`

O `tsconfig.web.json` tem `"baseUrl": "."`. O `CLAUDE.md` já registra que esse campo é uma das remoções do TypeScript 6 e que `paths` funciona sem ele desde o TS 4.1.

Como estamos mexendo nos dois `tsconfig` de qualquer forma, o custo de resolver isso agora é zero — e um ponto de quebra mapeado deixa de existir antes de a migração começar.

### D1.5 — A regra de importação é verificada pelo ESLint, não pela revisão

Regra que só existe em documento é regra que se descobre violada em revisão de código, seis arquivos depois. A regra `no-restricted-imports` do ESLint, aplicada por glob de arquivo, transforma a tabela acima em erro de lint.

**Descartado:** `eslint-plugin-boundaries`. Faz mais (slice não importa slice, camadas ordenadas), mas é dependência nova para resolver um problema que ainda não temos — só há uma feature planejada. A regra nativa cobre as fronteiras de processo, que são as que importam agora. Revisitar quando `features/` passar de cinco.

---

## Passos

### Passo 1 — Criar as pastas e o módulo de aliases

Crie `src/shared/`, `src/core/` e `src/workers/`, cada uma com um `.gitkeep`.

Crie `config/aliases.ts` na raiz:

```ts
import { resolve } from 'node:path'

export const aliases = {
  '@shared': resolve('src/shared'),
  '@core': resolve('src/core'),
  '@renderer': resolve('src/renderer/src')
}
```

> 🔍 A pasta é `config/` e não `build/` porque `build/` já é o `buildResources` do electron-builder — ícones e entitlements. Misturar configuração de bundler com recurso de instalador confunde os dois.

Registre os aliases nos três ambientes do `electron.vite.config.ts`. Os blocos `main` e `preload` hoje estão vazios (`{}`) e passam a ter `resolve.alias`. O bloco `renderer` troca o objeto literal pelo importado.

Adicione `paths` ao `tsconfig.node.json` (que hoje não tem nenhum) e ajuste o do `tsconfig.web.json`, **removendo o `baseUrl`** e usando caminhos relativos explícitos:

```jsonc
"paths": {
  "@shared/*": ["./src/shared/*"],
  "@core/*":   ["./src/core/*"],
  "@renderer/*": ["./src/renderer/src/*"]   // só no tsconfig.web.json
}
```

Amplie o `include` dos dois:

- `tsconfig.node.json` → acrescentar `src/shared/**/*`, `src/core/**/*`, `src/workers/**/*` e `config/**/*`
- `tsconfig.web.json` → acrescentar `src/shared/**/*` e `src/core/**/*`

> ⚠️ `shared/` e `core/` passam a ser incluídos nos **dois** projetos. Isso é intencional e já acontece hoje com `src/preload/*.d.ts`. Como o script de typecheck roda com `--composite false`, não há conflito de projeto composto.

**Aceite:** `pnpm typecheck` limpo, `pnpm dev` abre a janela.
**Commit:** `chore(estrutura): cria camadas shared/core/workers e unifica aliases`

### Passo 2 — Provar que os aliases funcionam nos três ambientes

Alias configurado errado só se descobre no primeiro import real, que pode ser semanas depois. Prove agora, com o menor arquivo possível.

Crie `src/shared/meta.ts`:

```ts
export const APP_ID = 'data-lab'
```

Importe-o com `@shared/meta` em `src/main/index.ts` e em `src/renderer/src/App.tsx`, use o valor em algum lugar visível (o `setAppUserModelId` do main serve; um atributo no JSX serve), rode `pnpm dev` e confirme.

Depois de confirmado, **mantenha** os imports — o `setAppUserModelId('com.electron')` que veio do template é placeholder e usar a constante real já melhora o estado atual.

**Aceite:** `pnpm typecheck` limpo, janela abre, sem erro no console do DevTools.
**Commit:** `chore(estrutura): valida resolução de alias nos três ambientes`

### Passo 3 — Transformar a tabela de importação em regra de lint

Acrescente ao `eslint.config.mjs`, depois dos blocos existentes e **antes** do `eslintConfigPrettier` (que precisa continuar por último):

```js
{
  files: ['src/shared/**/*.ts', 'src/core/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['electron', 'electron/*'],
          message: 'shared/ e core/ são puros — o acesso ao Electron fica em main/ ou preload/.' },
        { group: ['react', 'react-dom', 'react/*'],
          message: 'shared/ e core/ são puros — React só no renderer.' },
        { group: ['@renderer/*', '**/main/**', '**/preload/**', '**/workers/**'],
          message: 'Importação para camada acima. Ver docs/planning/active/01-camadas-e-fronteiras.md.' }
      ]
    }]
  }
},
{
  files: ['src/renderer/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['electron', 'electron/*'],
          message: 'O renderer fala com o main pelo preload. Ver src/shared/ipc.ts.' },
        { group: ['**/main/**', '**/preload/**', '**/workers/**'],
          message: 'Importação através da fronteira de processo. Só tipos de @shared atravessam.' }
      ]
    }]
  }
}
```

Verifique que a regra realmente morde: escreva `import { app } from 'electron'` num arquivo de `src/core/`, rode `pnpm lint`, confirme o erro, desfaça.

> 🔍 `no-restricted-imports` na versão nativa também bloqueia `import type`. Se algum dia for preciso abrir exceção para tipo, troque pela variante `@typescript-eslint/no-restricted-imports`, que aceita `allowTypeImports: true` — o `typescript-eslint` já está carregado via `@electron-toolkit/eslint-config-ts`, então não é dependência nova.

**Aceite:** `pnpm lint` limpo com o código real; erro reproduzível com a violação de teste.
**Commit:** `chore(lint): aplica a regra de importação entre camadas`

---

## Critério de aceite da fase

```bash
pnpm typecheck   # limpo nos dois projetos
pnpm lint        # limpo
pnpm dev         # janela abre, sem erro no console
```

E, manualmente: um import via `@shared/*` resolvendo em `main`, `preload` e `renderer`.

---

## O que fica para depois

- **`eslint-plugin-boundaries`** — quando `features/` passar de cinco slices.
- **Régua de tamanho de arquivo** — os arquivos ainda não existem. Entra no `CLAUDE.md` na fase 08, quando houver base para calibrar os números.
- **`src/workers/`** — permanece vazia até o DuckDB.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| — | — | não iniciada | — |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [00 — Visão geral](00-visao-geral.md) · **Índice:** [README](README.md) · **Próximo:** [02 — Contrato IPC](02-contrato-ipc.md)
