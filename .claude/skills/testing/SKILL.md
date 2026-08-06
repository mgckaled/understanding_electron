---
name: testing
description: Estratégia de teste do data-lab — a pirâmide de cinco níveis e onde cada um roda, por que handlers de IPC precisam ser funções exportadas (não closures) para serem testáveis sem subir o Electron, a armadilha de importar 'electron' por valor em código testável, o mock de window.api derivado do contrato via satisfies, e o que não vale a pena testar. Use ao escrever um teste novo, decidir se algo precisa de mock, avaliar se um handler está estruturado de forma testável, ou julgar se vale perseguir cobertura em renderer/ ou main/.
---

# Testes — data-lab

> Escrito na fase [04](../../../docs/plan/implemented/04-testes-rapidos.md) do plano de fundação. Fonte completa, com o porquê de cada decisão: o documento linkado acima.

## A pirâmide tem cinco níveis, não três

| Nível | Onde | Ferramenta | Custo |
|---|---|---|---|
| 1 | `core/`, `shared/` | Vitest, ambiente `node` | ms |
| 2 | `renderer/` | Vitest, ambiente `jsdom` | ms |
| 3 | handlers do `main/` | Vitest, ambiente `node`, **sem Electron** | ms |
| 4 | app em desenvolvimento | Playwright | dezenas de s |
| 5 | app empacotado | Playwright | minutos |

Os níveis 1–3 rodam em `pnpm test` / `pnpm check:fast`, cabem no ciclo de edição. Os níveis 4–5 (fase 07) precisam subir o Electron de verdade e não entram nesse ciclo — a separação decide se o retorno cabe num *hook* de edição ou se fica lento a ponto de ser contornado.

Vitest usa `test.projects` **dentro de** `vitest.config.ts` (a API atual — `vitest.workspace.ts` está depreciado desde a 3.2, não usar mesmo aparecendo em tutorial recente), com dois projetos espelhando os dois `tsconfig`: `node` para `core/shared/main/workers`, `jsdom` (não `happy-dom` — mais completo, e um app de análise de dados vai testar tabela e rolagem) para `renderer/`. `coverage` fica só no root do `test`, nunca dentro de um projeto — o v8 provider coleta uma vez para a corrida inteira.

## O nível 3 é o que quase ninguém tem

Handler de IPC como closure (`ipcMain.handle('x', async (_e, args) => { /* lógica aqui */ })`) só é alcançável subindo o Electron inteiro — nasce direto no nível 4, cem vezes mais lento, e na prática fica sem teste nenhum.

Handler como **função exportada**, registrada por um `handle()` genérico (ver skill `architecture`), é chamável como função comum em Node puro. É a propriedade que mais paga do contrato tipado, e não era o objetivo declarado — é consequência. Vale o argumento quando aparecer a tentação de escrever "só este aqui" como closure.

## Armadilha: `electron` importado por valor quebra em teste, mesmo só como default

Fora do binário real, `node_modules/electron/index.js` faz `module.exports = getElectronPath()` — o pacote inteiro é uma *string*, não o objeto com `app`/`shell`/etc. Um handler como `openExternal(args, fn = shell.openExternal)` ainda tem `import { shell } from 'electron'` no topo do arquivo, e isso é processado pelo dep-optimizer do Vite mesmo que o valor nunca seja acessado nos testes — de forma não determinística: passou isolado, quebrou junto com outro teste que também importava `electron`, com um `SyntaxError` de interop ESM/CJS dependente de cache.

**A regra:** nenhum handler testável importa `electron` por valor — nem como default de parâmetro. O parâmetro fica obrigatório; só o composition root (`register-all.ts`, que nenhum teste alcança) importa `electron` de verdade e monta a chamada real.

## Armadilha: glob de `coverage.include` sem `/` inicial não é ancorado só à raiz

`coverage.include: ['src/shared/**']` foi pensado para pegar `src/shared/` (a raiz, contrato IPC). Quando a fase 05 criou `src/renderer/src/shared/ui/` (ver skill `design-system`), o mesmo glob passou a capturar os dois — os caminhos compartilham o segmento `shared/`, e o `picomatch` usado pelo coverage v8 não trata o padrão como ancorado ao início do path. Sintoma: um componente do renderer (sem meta de cobertura) aparecendo no relatório como se fosse `core/`/`shared/`, distorcendo a métrica em silêncio. Corrigido com `coverage.exclude: ['src/renderer/**']` — o default de `coverage.exclude` é array vazio, e as exclusões de proteção do próprio Vitest (setup/test/config files) são hardcoded e continuam aplicadas por cima, então isso não perde nada. Vale para qualquer par de pastas com segmento de nome compartilhado.

## O mock de `window.api` é derivado do tipo do contrato

```ts
const api = {
  app: { info: vi.fn() },
  shell: { openExternal: vi.fn() }
} satisfies Api
```

O `satisfies` é o ponto inteiro: quando o contrato ganha um método, o mock para de compilar — em `pnpm typecheck`, no mesmo segundo que o resto. Sem ele, o teste continua passando contra uma API antiga e a divergência só aparece em runtime, meses depois, como `undefined is not a function`. A fábrica mora em `test/api-mock.ts`, atrás de um alias `@test` declarado só no `vitest.config.ts` — não em `config/aliases.ts`, que também alimenta o build de produção do electron-vite.

## Cobertura só em `core/` e `shared/`, e "shared" inclui o que shared exporta de fato

| Camada | Meta |
|---|---|
| `core/`, `shared/` | 85% de linhas, imposto pelo Vitest |
| `main/`, `renderer/` | sem meta |

Perseguir número em `renderer/` produz teste de amarração (verifica classe CSS, quebra em toda mudança de layout, não pega bug). Perseguir número em `main/` produz mock do Electron, que testa o mock. Onde a amarração for complexa demais para ficar sem teste, extraia dela a lógica pura — não baixe a régua.

Dentro de `shared/`, nem tudo é lógica: um arquivo de só-constante (`APP_ID`) não tem o que testar além do valor em si — um teste trivial de igualdade é aceitável e barato de manter, não é o mesmo problema do teste de amarração do renderer (não quebra a cada mudança não relacionada). Já um schema Zod real (`argsSchema`) tem comportamento de verdade — validar/rejeitar payload — e merece teste que o exercite, não só que "a linha rodou".

## `pnpm build` não roda teste; `check:fast` é o portão

`build` continua `typecheck` + `electron-vite build`. Teste roda em `check:fast` (`typecheck && lint && test`), o único comando que o *hook* de edição (fase 08) e o pré-commit vão chamar — um lugar para manter alinhado, não três configs espalhadas. Meta: `check:fast` abaixo de 15s nesta altura do projeto: se já estiver mais lento, é hora de investigar antes de empilhar mais teste em cima.

## Globals do Vitest declarados manualmente no ESLint

`globals: true` no `vitest.config.ts` evita repetir `import { describe, it, expect } from 'vitest'` em todo arquivo. O ESLint precisa reconhecer os mesmos nomes como globals — declarados manualmente em `eslint.config.mjs` (`describe`, `it`, `test`, `expect`, `vi`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`), não importados do pacote `globals`: ele só está disponível de forma transitiva neste projeto, e usá-lo sem declarar em `package.json` seria a dependência fantasma que o `shamefullyHoist: true` já deixa como risco conhecido (ver skill `architecture`).
