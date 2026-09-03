---
name: testing
description: Estratégia de teste do crivo — a pirâmide de cinco níveis, por que handler de IPC precisa ser função exportada (não closure), a armadilha de importar 'electron' por valor em código testável, os limites do jsdom (não implementa `<dialog>`, nem tempo real), e a verificação real do que vai para dentro do `app.asar`. Use ao escrever um teste, decidir se algo precisa de mock, se um comportamento exige o app real, escrever um spec E2E, ou julgar se vale perseguir cobertura em renderer/main. Não cobre política de Result vs exceção (skill ipc) nem regra de importação (skill architecture).
---

# Testes — crivo

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

Handler como **função exportada**, registrada por um `handle()` genérico (skill [`ipc`](../ipc/SKILL.md)), é chamável como função comum em Node puro. É a propriedade que mais paga do contrato tipado, e não era o objetivo declarado — é consequência. Vale o argumento quando aparecer a tentação de escrever "só este aqui" como closure.

⚠️ **Nenhum handler testável importa `electron` por valor — nem como default de parâmetro.** Fora do binário, `node_modules/electron/index.js` exporta uma *string*. Só o composition root (`register-all.ts`, que nenhum teste alcança) importa o pacote real.

⚠️ **E a provocação óbvia para isso dá falso negativo** — o import **não** lança, o export nomeado só vira `undefined`, então sabotar um handler assim deixa a suíte verde. O que reprova é `expect(handler.length).toBe(1)`: `Function.length` conta os parâmetros antes do primeiro default. Medido no O-1, ver [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md).

## Níveis 4–5: Playwright dirige o Electron de verdade

`_electron.launch({ args: ['.'] })` lança o app contra o `main` do `package.json` (`./out/main/index.js`) — precisa de `pnpm build` antes, nunca roda contra o dev server do Vite. `electronApp.firstWindow()` devolve a `Page`; **dois `evaluate` diferentes, dois contextos diferentes**: `electronApp.evaluate(({ dialog }) => ...)` roda no processo **main** (é como se estuba `dialog.showOpenDialog` — funciona porque o handler real lê a propriedade dentro do corpo da função, late-bound, não capturada no registro), `page.evaluate(() => window...)` roda no **renderer**.

`security-boundary.spec.ts` (o teste mais valioso da fase: pega um `sandbox: false` reintroduzido por merge distraído) precisa da lib `DOM` no `tsconfig.e2e.json` só para tipar o `window` do callback — o cast fica dentro do `evaluate`, nunca alargando o tsconfig com a global augmentation do preload, porque o ponto do teste é justamente verificar globals sem tipo.

`playwright.config.ts` com dois `projects` (`dev`: `e2e/dev/**`, roda contra `out/`; `packaged`: `e2e/packaged/**`, roda contra `dist/win-unpacked/`) e `workers: 1` — instâncias paralelas do Electron brigam pelo mesmo `userData`.

Nível 5 usa `electron-playwright-helpers`: `findLatestBuild('dist')` + `parseElectronApp(buildDir)`. A doc do pacote descreve a convenção como `out/<nome>-<plataforma>`, mas a função na prática aceita qualquer nome de pasta cujo split por hífen contenha um token de plataforma reconhecido — `win-unpacked` (saída padrão do `electron-builder --dir` no Windows) bate, porque contém `win`. Confirmado lendo `find_parse_builds.js` antes de escrever o teste, não supondo pela doc.

## Um teste que passa com o defeito presente não estava provando nada

A regra vale em todos os cinco níveis, e é mais fácil de violar do que parece — dois casos reais do projeto:

- Um teste de "modelo com visão" passava contra uma implementação **errada** (buscar chave por sufixo `.context_length`), só porque o Ollama calhava de devolver as chaves numa ordem favorável. O caso certo não provava a regra; provava a ordem — o `readInfo` real e a armadilha completa são da skill [`ai`](../ai/SKILL.md).
- Um teste "não escreve `numCtx` quando não há janela" passava porque o campo nem é renderizado nesse estado, logo nada dispara `blur` — **o código antigo também passaria**. Nasceu vacuoso e foi removido.

- Um teste de "o atalho **não** dispara com `Ctrl+Shift+B`" passava com a guarda de modificador **removida**. Asserção síncrona de **ausência** logo depois do evento é vacuosa por construção: o estado mudaria no tique seguinte e a consulta já teria respondido "não há nada". **A forma que prova** é afirmar o **estado final** de algo que o efeito indesejado teria invertido — aqui, disparar o atalho de verdade em seguida e exigir que o painel abra, já que um disparo espúrio o teria deixado fechado.

**O procedimento que fecha isso:** veja o teste **vermelho** antes de deixá-lo verde — removendo a correção, sabotando a entrada, ou escrevendo-o antes do conserto. Se você não viu falhar, não sabe o que ele mede.

**Prove o smoke test antes de confiar nele.** Sabote `files` no `electron-builder.yml` (`'!out/preload/**'`), reempacote, rode — precisa falhar (`#root` vazio, `window.api` nunca aparece, timeout). Reverta a linha, reempacote, confirme verde. Um teste de fumaça que passa incondicionalmente é pior que nenhum.

## Limites de ambiente de teste — seis casos, provados caros

Forma comum aos cinco: **o ambiente de teste tem padrões, e padrão é decisão silenciosa.** Quando o comportamento depende de tempo real de chegada, layout ou motor de CSS, jsdom não prova nada — só a verificação ao vivo prova. Cada um citável por título em [`docs/ARMADILHAS.md`](../../../docs/ARMADILHAS.md):

- `scroll` é assíncrono — jsdom não tem cadência de token nem layout, nenhum teste de nível 2 poderia ter pego. § *O evento `scroll` é assíncrono*.
- `<dialog>` não é implementado — `HTMLDialogElement` é subclasse vazia. § *O jsdom não implementa `<dialog>`*.
- CSS não é aplicado — nível 2 clica em botão `visibility: hidden` que só o `:hover` revela. § *Teste de nível 2 clica em botão que o CSS esconde*. ⚠️ **Mas o que a ausência de CSS impede é menos do que parece:** *classe* é atribuída normalmente. No E-2-B, editor e prévia emitem as classes `.tok-*` do destaque de sintaxe sob jsdom — o que **não** se prova é a cor delas. Antes de declarar algo "só ao vivo", verifique se a asserção pode ser feita sobre a classe em vez do estilo; eu havia escrito no plano que o editor não era testável, e metade dele era.
- `prefers-color-scheme` — Playwright emula `'light'` por padrão, ganha do `nativeTheme`. § *O Playwright emula `prefers-color-scheme: light`*.
- Eventos de animação não chegam ao React — `window.AnimationEvent` é `undefined`. § *`animationiteration` borbulha de 14 filhos*.
- CodeMirror **lança ao montar** — mede texto por `Range`/`elementFromPoint`, que o jsdom não implementa; e digitação real (`contenteditable` + `beforeinput`) segue fora de alcance mesmo com os mocks. § *CodeMirror não monta sob jsdom*.

## O que persiste é testado contra o banco real, nunca contra uma fake

Duas peças, e as duas seguem o princípio do `satisfies Api` — **derivar em vez de duplicar**.

Os handlers de `conversation:*` e `settings:*` recebem o banco por parâmetro, então o **nível 3** os chama como funções comuns contra `:memory:`: sem Electron, sem mock dele. E o mock de `window.api` do **nível 2** não os reimplementa: `test/store-api.ts` monta as duas superfícies delegando aos mesmos handlers, sobre um `:memory:` por teste (`node:sqlite` funciona sob o ambiente `jsdom`, que continua sendo Node por baixo). Sem isso, todo teste sobre trocar de conversa, renomear ou manter histórico ficaria vazio — e uma fake escrita à mão teria de repetir ordenação por `updated_at`, o `COALESCE` do título, a cascata e o merge de configurações, com liberdade para divergir em silêncio. Contrapartida assumida: defeito de handler deixa vermelhos também os testes do renderer.

**O que nem isso alcança é o processo morrer.** `e2e/dev/persistence.spec.ts` fecha o `electronApp` e lança de novo — a única prova de que a escrita sobreviveu. Ele exige `--user-data-dir` numa pasta temporária por corrida (o e2e roda contra o `%APPDATA%` real, e um spec que limpasse para começar do zero apagaria o histórico de quem desenvolve), e a **primeira** asserção confere `app.getPath('userData')` antes de qualquer escrita. Atenção ao arrumar: os outros specs ainda lançam sem a flag; hoje é inofensivo porque nenhum deles escreve conversa.

## Duas armadilhas de empacotamento e configuração

- **`electron-builder` empacota direto do disco, não do que o git rastreia** — verificação real é `pnpm dlx @electron/asar list dist/win-unpacked/resources/app.asar`, nunca leitura de glob. § *`app.asar` empacotava `.claude/settings.local.json`*.
- **Glob de `coverage.include` sem `/` inicial não é ancorado à raiz** — mesmo segmento de nome compartilhado (`shared/`) captura a pasta errada. § *Glob de `coverage.include` sem `/` inicial*.

Ambas em [`docs/ARMADILHAS.md`](../../../docs/ARMADILHAS.md).

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

## O bundle do main tem um teste, e ele não é um teste

`scripts/check-main-bundle.mjs` carrega `out/main/index.js` com `electron` esbulhado, no fim do `pnpm build`. Existe porque **os cinco níveis rodam o fonte sob ESM** e o bundle do main é **CJS com dependências externalizadas**: um pacote ESM-only chega lá como `{ default }` em vez da função, e o app morre ao carregar sem nenhum outro sinal. Mesma família do `asar list` — verificação do **artefato**, não do código. Diagnóstico em [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md) § *Pacote ESM-only chega ao bundle CJS*.

## `pnpm build` não roda teste; `check:fast` é o portão

`build` continua `typecheck` + `electron-vite build`. Teste roda em `check:fast` (`typecheck && lint && test`), o único comando que o *hook* de edição e o pré-commit chamam — um lugar para manter alinhado, não três configs espalhadas.

⚠️ **A duração e a contagem de testes NÃO moram aqui.** O dono é o [`ROADMAP § 2`](../../../docs/ROADMAP.md), que guarda a série inteira de medições — e a série é o que dá sentido a um número isolado. Uma segunda lista aqui envelheceria calada, como já envelheceu: até ago/2026 esta seção afirmava "452 testes" quando eram 832. **Remeça, não copie.** O achado estável, esse sim, fica: a maior fatia do tempo é `environment` (a subida do jsdom, uma por arquivo), não as asserções — o que redireciona a investigação de otimização.

## Globals do Vitest declarados manualmente no ESLint

`globals: true` no `vitest.config.ts` evita repetir `import { describe, it, expect } from 'vitest'` em todo arquivo. O ESLint precisa reconhecer os mesmos nomes como globals — declarados manualmente em `eslint.config.mjs` (`describe`, `it`, `test`, `expect`, `vi`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`), não importados do pacote `globals`: ele só está disponível de forma transitiva neste projeto, e usá-lo sem declarar em `package.json` seria uma dependência fantasma. Com `shamefullyHoist: false` (desligado no 18-A) esse risco é real e já mordeu uma vez — `@types/hast` resolvia só por hoist acidental. Ver skill [`architecture`](../architecture/SKILL.md).
