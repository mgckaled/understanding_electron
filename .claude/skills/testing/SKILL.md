---
name: testing
description: Estratégia de teste do crivo — a pirâmide de cinco níveis, por que handler de IPC precisa ser função exportada (não closure), a armadilha de importar 'electron' por valor em código testável, os limites do jsdom (não implementa `<dialog>`, nem tempo real), e a verificação real do que vai para dentro do `app.asar`. Use ao escrever um teste, decidir se algo precisa de mock, se um comportamento exige o app real, escrever um spec E2E, ou julgar se vale perseguir cobertura em renderer/main. Não cobre política de Result vs exceção (skill ipc) nem regra de importação (skill architecture).
---

# Testes — crivo

> Escrito nas fases [04](../../../docs/plan/implemented/04-testes-rapidos.md) e [07](../../../docs/plan/implemented/07-e2e-e-empacotamento.md) do plano de fundação. **Estendida na fase 08** (hook de edição chamando `check:fast`), **na fase 14** (o que persiste testado contra banco real, nunca fake) **e em R-2** (`check:fast` remedido). Fonte completa, com o porquê de cada decisão: os dois documentos linkados acima, mais [`docs/HISTORY.md`](../../../docs/HISTORY.md) para o que veio depois.

## A pirâmide tem cinco níveis, não três

| Nível | Onde | Ferramenta | Custo |
|---|---|---|---|
| 1 | `core/`, `shared/` | Vitest, ambiente `node` | ms |
| 2 | `renderer/` | Vitest, ambiente `jsdom` | ms |
| 3 | handlers do `main/` | Vitest, ambiente `node`, **sem Electron** | ms |
| 4 | app em desenvolvimento | Playwright | dezenas de s |
| 5 | app empacotado | Playwright | minutos |

Os níveis 1–3 rodam em `pnpm test` / `pnpm check:fast`, cabem no ciclo de edição. Os níveis 4–5 precisam subir o Electron de verdade e não entram nesse ciclo — a separação decide se o retorno cabe num *hook* de edição ou se fica lento a ponto de ser contornado.

Vitest usa `test.projects` **dentro de** `vitest.config.ts` (a API atual — `vitest.workspace.ts` está depreciado desde a 3.2, não usar mesmo aparecendo em tutorial recente), com dois projetos espelhando os dois `tsconfig`: `node` para `core/shared/main/workers`, `jsdom` (não `happy-dom` — mais completo, e um app de análise de dados vai testar tabela e rolagem) para `renderer/`. `coverage` fica só no root do `test`, nunca dentro de um projeto — o v8 provider coleta uma vez para a corrida inteira.

## O nível 3 é o que quase ninguém tem

Handler de IPC como closure (`ipcMain.handle('x', async (_e, args) => { /* lógica aqui */ })`) só é alcançável subindo o Electron inteiro — nasce direto no nível 4, cem vezes mais lento, e na prática fica sem teste nenhum.

Handler como **função exportada**, registrada por um `handle()` genérico (ver skill `ipc`), é chamável como função comum em Node puro. É a propriedade que mais paga do contrato tipado, e não era o objetivo declarado — é consequência. Vale o argumento quando aparecer a tentação de escrever "só este aqui" como closure.

## Níveis 4–5: Playwright dirige o Electron de verdade

`_electron.launch({ args: ['.'] })` lança o app contra o `main` do `package.json` (`./out/main/index.js`) — precisa de `pnpm build` antes, nunca roda contra o dev server do Vite. `electronApp.firstWindow()` devolve a `Page`; **dois `evaluate` diferentes, dois contextos diferentes**: `electronApp.evaluate(({ dialog }) => ...)` roda no processo **main** (é como se estuba `dialog.showOpenDialog` — funciona porque o handler real lê a propriedade dentro do corpo da função, late-bound, não capturada no registro), `page.evaluate(() => window...)` roda no **renderer**. `fronteira.spec.ts`/`security-boundary.spec.ts` (o teste mais valioso da fase: pega um `sandbox: false` reintroduzido por merge distraído) precisa da lib `DOM` no `tsconfig.e2e.json` só para tipar o `window` do callback — o cast fica dentro do `evaluate`, nunca alargando o tsconfig com a global augmentation do preload, porque o ponto do teste é justamente verificar globals sem tipo.

`playwright.config.ts` com dois `projects` (`dev`: `e2e/dev/**`, roda contra `out/`; `packaged`: `e2e/packaged/**`, roda contra `dist/win-unpacked/`) e `workers: 1` — instâncias paralelas do Electron brigam pelo mesmo `userData`.

Nível 5 usa `electron-playwright-helpers`: `findLatestBuild('dist')` + `parseElectronApp(buildDir)`. A doc do pacote descreve a convenção como `out/<nome>-<plataforma>`, mas a função na prática aceita qualquer nome de pasta cujo split por hífen contenha um token de plataforma reconhecido — `win-unpacked` (saída padrão do `electron-builder --dir` no Windows) bate, porque contém `win`. Confirmado lendo `find_parse_builds.js` antes de escrever o teste, não supondo pela doc.

**Prove o smoke test antes de confiar nele.** Sabote `files` no `electron-builder.yml` (`'!out/preload/**'`), reempacote, rode — precisa falhar (`#root` vazio, `window.api` nunca aparece, timeout). Reverta a linha, reempacote, confirme verde. Um teste de fumaça que passa incondicionalmente é pior que nenhum.

## Limites de ambiente de teste — cinco casos, provados caros

Forma comum aos cinco: **o ambiente de teste tem padrões, e padrão é decisão silenciosa.** Quando o comportamento depende de tempo real de chegada, layout ou motor de CSS, jsdom não prova nada — só a verificação ao vivo prova. Cada um já citável por título em [`docs/HISTORY.md`](../../../docs/HISTORY.md) § Armadilhas:

- `scroll` é assíncrono — jsdom não tem cadência de token nem layout, nenhum teste de nível 2 poderia ter pego. § *O evento `scroll` é assíncrono*.
- `<dialog>` não é implementado — `HTMLDialogElement` é subclasse vazia. § *O jsdom não implementa `<dialog>`*.
- CSS não é aplicado — nível 2 clica em botão `visibility: hidden` que só o `:hover` revela. § *Teste de nível 2 clica em botão que o CSS esconde*.
- `prefers-color-scheme` — Playwright emula `'light'` por padrão, ganha do `nativeTheme`. § *O Playwright emula `prefers-color-scheme: light`*.
- Eventos de animação não chegam ao React — `window.AnimationEvent` é `undefined`. § *`animationiteration` borbulha de 14 filhos*.

## O que persiste é testado contra o banco real, nunca contra uma fake

Duas peças da fase 14, e as duas seguem o princípio do `satisfies Api` — **derivar em vez de duplicar**.

Os handlers de `conversation:*` e `settings:*` recebem o banco por parâmetro, então o **nível 3** os chama como funções comuns contra `:memory:`: sem Electron, sem mock dele. E o mock de `window.api` do **nível 2** não os reimplementa: `test/store-api.ts` monta as duas superfícies delegando aos mesmos handlers, sobre um `:memory:` por teste (`node:sqlite` funciona sob o ambiente `jsdom`, que continua sendo Node por baixo). Sem isso, todo teste sobre trocar de conversa, renomear ou manter histórico ficaria vazio — e uma fake escrita à mão teria de repetir ordenação por `updated_at`, o `COALESCE` do título, a cascata e o merge de configurações, com liberdade para divergir em silêncio. Contrapartida assumida: defeito de handler deixa vermelhos também os testes do renderer.

**O que nem isso alcança é o processo morrer.** `e2e/dev/persistence.spec.ts` fecha o `electronApp` e lança de novo — a única prova de que a escrita sobreviveu. Ele exige `--user-data-dir` numa pasta temporária por corrida (o e2e roda contra o `%APPDATA%` real, e um spec que limpasse para começar do zero apagaria o histórico de quem desenvolve), e a **primeira** asserção confere `app.getPath('userData')` antes de qualquer escrita. Atenção ao arrumar: os outros specs ainda lançam sem a flag; hoje é inofensivo porque nenhum deles escreve conversa.

## Três armadilhas medidas, com dono no `HISTORY.md`

- **`electron-builder` empacota direto do disco, não do que o git rastreia** — verificação real é `pnpm dlx @electron/asar list dist/win-unpacked/resources/app.asar`, nunca leitura de glob. § *`app.asar` empacotava `.claude/settings.local.json`*.
- **`electron` importado por valor quebra em teste, mesmo só como default de parâmetro** — handler testável nunca importa o pacote real; só o composition root (`register-all.ts`) importa. § *Import de `electron` no arquivo do handler quebra em teste Node puro*.
- **Glob de `coverage.include` sem `/` inicial não é ancorado à raiz** — mesmo segmento de nome compartilhado (`shared/`) captura a pasta errada. § *Glob de `coverage.include` sem `/` inicial*.

Todas em [`docs/HISTORY.md`](../../../docs/HISTORY.md) § Armadilhas.

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

`build` continua `typecheck` + `electron-vite build`. Teste roda em `check:fast` (`typecheck && lint && test`), o único comando que o *hook* de edição (fase 08) e o pré-commit vão chamar — um lugar para manter alinhado, não três configs espalhadas. **Estava em 15–19s ao fim da fase 14** (28 arquivos, 207 testes), com a maior fatia em `environment` — a subida do jsdom, uma por arquivo —, não as asserções; a medição redireciona a investigação, não o número em si. **Remedido em ago/2026** (R-2, `pnpm check:fast`): 49 arquivos, 452 testes, e a suíte já passou da meta original de 15s. Gatilho e número atualizado ficam só no [`ROADMAP § 2`](../../../docs/ROADMAP.md); não abra uma segunda lista aqui.

## Globals do Vitest declarados manualmente no ESLint

`globals: true` no `vitest.config.ts` evita repetir `import { describe, it, expect } from 'vitest'` em todo arquivo. O ESLint precisa reconhecer os mesmos nomes como globals — declarados manualmente em `eslint.config.mjs` (`describe`, `it`, `test`, `expect`, `vi`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`), não importados do pacote `globals`: ele só está disponível de forma transitiva neste projeto, e usá-lo sem declarar em `package.json` seria a dependência fantasma que o `shamefullyHoist: true` já deixa como risco conhecido (ver skill `architecture`).
