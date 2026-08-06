# 04 — Testes rápidos

**Depende de:** [02](02-contrato-ipc.md) · **Entrega:** Vitest com dois projetos, os níveis 1 a 3 da pirâmide, `check:fast`

---

## Por que esta fase existe

A pirâmide de testes de um app Electron tem cinco níveis, não três. Esta fase entrega os três primeiros — os que rodam em milissegundos e cabem no ciclo de edição. Os dois últimos, que precisam subir o Electron de verdade, ficam na [fase 07](../active/07-e2e-e-empacotamento.md).

| Nível | Onde | Ferramenta | Custo |
|---|---|---|---|
| 1 | `core/`, `shared/` | Vitest, ambiente `node` | ms |
| 2 | `renderer/` | Vitest, ambiente `jsdom` | ms |
| 3 | handlers do `main/` | Vitest, ambiente `node`, **sem Electron** | ms |
| 4 | app em desenvolvimento | Playwright | dezenas de s |
| 5 | app empacotado | Playwright | minutos |

A separação não é estética. É o que decide se o ciclo de retorno cabe num *hook* de edição ([fase 08](../active/08-automacao-e-registro.md)) ou se ele fica lento a ponto de passar a ser contornado.

## O nível 3 é o que quase ninguém tem

O nível 1 é óbvio e o 2 é conhecido de qualquer projeto React. O interessante é o terceiro.

Num projeto Electron típico, o handler é uma closure:

```ts
ipcMain.handle('dataset:scan', async (_e, args) => { /* toda a lógica aqui */ })
```

Esse código só é alcançável subindo o Electron inteiro — ou seja, ele nasce no nível 4, cem vezes mais lento, e na prática acaba sem teste nenhum.

A [fase 02](02-contrato-ipc.md) já resolveu isso por outro motivo. Como os handlers são funções exportadas e o `handle` é um registro genérico, `getAppInfo` e `openExternal` são chamadas como funções comuns, em Node puro. O `ipcMain` não aparece em nenhum arquivo de teste.

**Esta é a propriedade que mais paga do contrato tipado**, e ela não era o objetivo declarado — é consequência. Vale registrar, porque é o argumento a usar quando aparecer a tentação de escrever "só este aqui" como closure.

---

## Decisões tomadas

### D4.1 — Vitest com dois projetos, espelhando os dois `tsconfig`

O `CLAUDE.md` já explica por que `pnpm typecheck` roda dois projetos: main/preload e renderer vivem em ambientes diferentes, e checar só um dá falsa sensação de segurança.

O mesmo raciocínio vale para os testes, pela mesma razão física. Um projeto `node` e um projeto `web`, e `pnpm test` roda os dois.

> ⚠️ A API é `test.projects` **dentro do `vitest.config.ts`**. O arquivo separado `vitest.workspace.ts` está depreciado desde o Vitest 3.2 e será removido — não use, mesmo aparecendo em tutorial recente.

**Descartado:** Jest. O projeto já roda em Vite; Jest significaria uma segunda cadeia de transformação, com configuração própria de ESM e TypeScript, para o mesmo resultado.

### D4.2 — `jsdom`, não `happy-dom`

O `happy-dom` é mais rápido. O `jsdom` é mais completo, e um app de análise de dados vai testar tabela, medição de layout e rolagem — a área onde a diferença de completude aparece.

Reversível: são a mesma interface, trocar é uma linha no `vitest.config.ts`. Se o projeto `web` passar de alguns segundos, troque.

### D4.3 — Os aliases vêm do mesmo lugar do bundler

O `vitest.config.ts` importa `config/aliases.ts`, criado na [fase 01](01-camadas-e-fronteiras.md). Duplicar o mapa produziria o pior modo de falha possível: teste que passa e aplicação que quebra, ou o inverso, sem que nada aponte para a causa.

### D4.4 — O mock de `window.api` é derivado do tipo do contrato

```ts
const api = {
  app: { info: vi.fn() },
  shell: { openExternal: vi.fn() }
} satisfies Api
```

O `satisfies` é o ponto inteiro. Quando o contrato ganhar um método, **o mock para de compilar** — em `pnpm typecheck`, junto com o resto, no mesmo segundo.

Sem ele, o teste continua passando contra uma versão antiga da API e a divergência só aparece em runtime, meses depois, como `undefined is not a function`.

### D4.5 — Meta de cobertura só em `core/` e `shared/`

| Camada | Meta |
|---|---|
| `core/`, `shared/` | 85% de linhas, imposto pelo `vitest` |
| `main/`, `renderer/` | sem meta |

Perseguir número em `renderer/` produz teste de amarração: verifica que o `div` tem a classe certa, quebra em toda mudança de layout e não pega bug nenhum. Perseguir número em `main/` produz mock do Electron, que testa o mock.

É a mesma regra do projeto Python: lógica pura ganha teste, amarração não. Onde a amarração for complexa demais para ficar sem teste, o caminho é extrair dela a lógica pura — não é baixar a régua.

### D4.6 — `pnpm build` não roda testes

O `build` continua sendo `typecheck` + `electron-vite build`. Os testes rodam em `check:fast`, que é o que o *hook* de edição e o pré-commit chamam.

Misturar os dois torna o build lento sem tornar nada mais seguro: se o `check:fast` passou no commit, rodar de novo no build não descobre nada.

---

## Passos

### Passo 1 — Instalar e configurar

```bash
pnpm add -D vitest @vitest/coverage-v8 jsdom \
            @testing-library/react @testing-library/dom \
            @testing-library/jest-dom @testing-library/user-event
```

Crie `vitest.config.ts` na raiz, importando `aliases` de `config/aliases.ts` e declarando dois projetos:

| Projeto | `environment` | `include` |
|---|---|---|
| `node` | `node` | `src/{core,shared,main,workers}/**/*.test.ts` |
| `web` | `jsdom` | `src/renderer/**/*.test.{ts,tsx}` |

O projeto `web` recebe um `setupFiles` apontando para `test/setup-renderer.ts`, que importa `@testing-library/jest-dom/vitest` e registra um `afterEach(cleanup)`.

Configure `coverage` com `provider: 'v8'`, `include` limitado a `src/core/**` e `src/shared/**`, e `thresholds.lines: 85`.

Acrescente ao `package.json`:

```jsonc
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"check:fast": "npm run typecheck && npm run lint && npm run test"
```

> 🔍 O `check:fast` é um único comando por design. É o que o *hook* da [fase 08](../active/08-automacao-e-registro.md) vai chamar, e um comando é mais fácil de manter alinhado do que três espalhados por configurações diferentes.

**Aceite:** `pnpm test` roda e reporta zero testes nos dois projetos — sem erro de configuração.
**Commit:** `chore(testes): configura Vitest com projetos node e web`

### Passo 2 — Ensinar o ESLint sobre arquivos de teste

Arquivos `*.test.ts` em `src/core/` importam utilitários do Vitest e, eventualmente, precisam de liberdade que a regra da [fase 01](01-camadas-e-fronteiras.md) não dá. Some a isso que o `describe`/`it` globais precisam ser reconhecidos.

Acrescente ao `eslint.config.mjs` um bloco para `**/*.test.{ts,tsx}` e `test/**` que desligue as restrições relevantes, e ative `globals: true` no `vitest.config.ts` para evitar o import repetido em todo arquivo.

Verifique com um teste trivial que o lint fica limpo nos dois projetos.

**Aceite:** `pnpm lint` limpo com um arquivo de teste presente.
**Commit:** `chore(lint): reconhece arquivos de teste`

### Passo 3 — Nível 3: os handlers do main

Os primeiros testes de verdade, porque provam a propriedade arquitetural.

`src/main/features/shell/handlers.test.ts` — `openExternal` recebe o `shell.openExternal` por parâmetro (DIP, D2 da [visão geral](../active/00-visao-geral.md)), então o teste passa uma função falsa e verifica:

| Entrada | Esperado |
|---|---|
| `https://electronjs.org` | `{ ok: true }`, e a função falsa foi chamada uma vez |
| `http://localhost:5173` | `{ ok: true }` |
| `file:///C:/Windows/System32` | `{ ok: false, error.kind === 'blocked' }`, e a falsa **não** foi chamada |
| `javascript:alert(1)` | idem |

> 🔍 Se `openExternal` ainda chamar `shell.openExternal` diretamente do import, ajuste-o para receber a função por parâmetro. Não é mudança de escopo — é a decisão D2 da visão geral aplicada no primeiro lugar em que ela é necessária. O `register-all.ts` passa a implementação real.

`src/main/features/app/handlers.test.ts` — `getAppInfo` devolve as chaves esperadas. Teste raso de propósito: o valor vem do runtime, o que importa é o formato.

**Aceite:** `pnpm test` verde, e nenhum arquivo de teste importa `electron`.
**Commit:** `test(main): cobre os handlers de app e shell sem subir o Electron`

### Passo 4 — Nível 2: o renderer com a API falsa

Crie `test/api-mock.ts` exportando uma fábrica que devolve um objeto `satisfies Api` com todos os métodos como `vi.fn()`, e uma função que o instala em `window.api`.

Escreva `src/renderer/src/components/Versions.test.tsx` cobrindo três casos: enquanto carrega, depois de resolver, e quando o canal rejeita.

O terceiro é o mais valioso e o mais esquecido. Ele é a primeira vez que o projeto exercita o caminho de erro da interface — e é o que a [fase 05](05-design-tokens.md) vai transformar num componente reutilizável.

**Aceite:** três testes verdes; `pnpm typecheck` limpo (o `satisfies` bate com o contrato).
**Commit:** `test(renderer): cobre Versions com a API falsa derivada do contrato`

### Passo 5 — Nível 1: reservado

`core/` ainda está vazia — a primeira função pura nasce na [fase 06](../active/06-primeira-feature.md), e é lá que este nível ganha conteúdo.

O que fazer agora é apenas garantir que a infraestrutura o alcança: crie `src/core/result.ts` com dois auxiliares (`ok(value)` e `err(error)`) que constroem o `Result` da [fase 02](02-contrato-ipc.md), e um teste trivial para eles.

São cinco linhas úteis — os handlers vão usá-las — e provam que o projeto `node` alcança `src/core/` e que a cobertura é medida ali.

**Aceite:** `pnpm test:coverage` mostra `src/core/result.ts` com 100% e não reclama do limite.
**Commit:** `test(core): auxiliares de Result e primeira medição de cobertura`

---

## Critério de aceite da fase

```bash
pnpm check:fast     # typecheck + lint + testes, tudo verde
pnpm test:coverage  # limite de 85% respeitado em core/ e shared/
```

E uma verificação de tempo: **`pnpm check:fast` deve terminar em menos de 15 segundos** nesta altura do projeto. Se já estiver mais lento, investigue agora — a [fase 08](../active/08-automacao-e-registro.md) vai colocá-lo no ciclo de edição, e um ciclo lento é um ciclo contornado.

---

## O que fica para depois

- **Níveis 4 e 5** — [fase 07](../active/07-e2e-e-empacotamento.md), depois de existir uma feature que valha percorrer de ponta a ponta.
- **Testes de `utilityProcess`** — quando existir. A regra já está decidida: teste a função pura de `core/`, não o processo. O *shim* de mensageria ganha um teste de nível 4.
- **Storybook** — fora de escopo. Enquanto os primitivos couberem numa tela, ele custa mais manutenção do que entrega.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-06 | 1–5 | concluída | Duas armadilhas subiram para o HISTORY.md: import de `electron` no arquivo do handler (mesmo só como default de parâmetro) quebra em teste Node puro; `types` explícito no tsconfig remove a inclusão implícita de `@types/node`. `pnpm check:fast` só falha por um erro de lint pré-existente em `.claude/hooks/guard.mjs` (fase 08, não tocado) — isolando os arquivos desta fase, tudo limpo. `pnpm typecheck && pnpm test` ~9s. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [03 — Sandbox e segurança](03-sandbox-e-seguranca.md) · **Índice:** [README](../active/README.md) · **Próximo:** [05 — Design tokens](05-design-tokens.md)
