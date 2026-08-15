---
name: testing
description: Estratégia de teste do crivo — a pirâmide de cinco níveis e onde cada um roda, por que handlers de IPC precisam ser funções exportadas (não closures) para serem testáveis sem subir o Electron, a armadilha de importar 'electron' por valor em código testável, o mock de window.api derivado do contrato via satisfies, os limites do jsdom (não implementa dialog; defeito que depende de layout ou de tempo real de chegada só se prova ao vivo), Playwright/_electron para os níveis 4-5 e a emulação de prefers-color-scheme que o padrão dele impõe, a verificação real do que vai para dentro do app.asar, e o que não vale a pena testar. Use ao escrever um teste novo, decidir se algo precisa de mock, decidir se um comportamento é verificável em jsdom ou exige o app real, avaliar se um handler está estruturado de forma testável, escrever um spec E2E, ajustar o files do electron-builder.yml, ou julgar se vale perseguir cobertura em renderer/ ou main/.
---

# Testes — crivo

> Escrito nas fases [04](../../../docs/plan/implemented/04-testes-rapidos.md) e [07](../../../docs/plan/implemented/07-e2e-e-empacotamento.md) do plano de fundação. Fonte completa, com o porquê de cada decisão: os dois documentos linkados acima.

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

Handler como **função exportada**, registrada por um `handle()` genérico (ver skill `architecture`), é chamável como função comum em Node puro. É a propriedade que mais paga do contrato tipado, e não era o objetivo declarado — é consequência. Vale o argumento quando aparecer a tentação de escrever "só este aqui" como closure.

## Níveis 4–5: Playwright dirige o Electron de verdade

`_electron.launch({ args: ['.'] })` lança o app contra o `main` do `package.json` (`./out/main/index.js`) — precisa de `pnpm build` antes, nunca roda contra o dev server do Vite. `electronApp.firstWindow()` devolve a `Page`; **dois `evaluate` diferentes, dois contextos diferentes**: `electronApp.evaluate(({ dialog }) => ...)` roda no processo **main** (é como se estuba `dialog.showOpenDialog` — funciona porque o handler real lê a propriedade dentro do corpo da função, late-bound, não capturada no registro), `page.evaluate(() => window...)` roda no **renderer**. `fronteira.spec.ts`/`security-boundary.spec.ts` (o teste mais valioso da fase: pega um `sandbox: false` reintroduzido por merge distraído) precisa da lib `DOM` no `tsconfig.e2e.json` só para tipar o `window` do callback — o cast fica dentro do `evaluate`, nunca alargando o tsconfig com a global augmentation do preload, porque o ponto do teste é justamente verificar globals sem tipo.

`playwright.config.ts` com dois `projects` (`dev`: `e2e/dev/**`, roda contra `out/`; `packaged`: `e2e/packaged/**`, roda contra `dist/win-unpacked/`) e `workers: 1` — instâncias paralelas do Electron brigam pelo mesmo `userData`.

Nível 5 usa `electron-playwright-helpers`: `findLatestBuild('dist')` + `parseElectronApp(buildDir)`. A doc do pacote descreve a convenção como `out/<nome>-<plataforma>`, mas a função na prática aceita qualquer nome de pasta cujo split por hífen contenha um token de plataforma reconhecido — `win-unpacked` (saída padrão do `electron-builder --dir` no Windows) bate, porque contém `win`. Confirmado lendo `find_parse_builds.js` antes de escrever o teste, não supondo pela doc.

**Prove o smoke test antes de confiar nele.** Sabote `files` no `electron-builder.yml` (`'!out/preload/**'`), reempacote, rode — precisa falhar (`#root` vazio, `window.api` nunca aparece, timeout). Reverta a linha, reempacote, confirme verde. Um teste de fumaça que passa incondicionalmente é pior que nenhum.

## O jsdom não é um navegador, e três coisas da fase 13 provaram isso caro

O nível 2 cobre muito, e a linha onde ele para não é óbvia. Três achados, em ordem de quanto custam se descobertos tarde:

**1. Existe defeito que só existe onde ele não é testável.** A lista de mensagens que acompanha o texto do modelo perdia uma corrida real: o DOM despacha `scroll` de forma **assíncrona**, então um token que chega antes do evento faz o efeito ler `pinned` desatualizado e desfazer a rolagem do usuário. Em jsdom não há cadência de token nem layout — `scrollHeight` e `clientHeight` são zero —, então **nenhum teste de nível 2 poderia ter pego**. A regra que sai disto: quando o comportamento depende de *tempo real de chegada* ou de *layout*, a verificação ao vivo (Playwright dirigindo o app com o Ollama no ar) não é reforço, é o **único** nível que prova. Diagnóstico completo em [`docs/HISTORY.md`](../../../docs/HISTORY.md).

**2. O jsdom não implementa `<dialog>`.** No 30.0.1, `HTMLDialogElement` é subclasse **vazia** de `HTMLElement` — sem `show`, sem `showModal`, sem `close`, e sem flag (lido em `lib/jsdom/living/nodes/HTMLDialogElement-impl.js`, não no changelog). O sintoma é `TypeError: node.showModal is not a function` matando o arquivo inteiro. Há um polyfill mínimo em `test/setup-renderer.ts`, e o que ele **não** substitui está escrito nele: camada superior, foco preso, `Esc`, `closedby` e `::backdrop` não têm equivalente, e asseverá-los ali seria testar o shim.

**3. O jsdom não aplica CSS, então nível 2 clica em botão escondido.** As ações de cada linha da lista de conversas são `visibility: hidden` até o `:hover`. O nível 2 encontra e clica sem hesitar; o Playwright respeita visibilidade e espera até estourar. Toda a família — revelar no hover, `display: none` por media query, elemento fora do viewport — é invisível abaixo do nível 4, e o sintoma imita "o dado não foi criado". Conserto: `hover()` na linha antes. Detalhe adjacente do mesmo spec: `getByRole('button', { name: título })` casa também com "Renomear \<título\>", porque o `aria-label` contém o título — **`exact: true` é obrigatório em lista com ações por linha.**

**4. O Playwright emula `prefers-color-scheme`, e o padrão dele é `'light'`.** Não é "não interfere" — é emular claro ativamente, por CDP, e essa emulação **ganha do `nativeTheme.themeSource`**: o main reporta `shouldUseDarkColors: true` e o renderer continua respondendo claro. Consequência que vale saber antes de escrever qualquer spec sobre cor: **nenhum e2e deste repositório exercita o tema escuro.** Para verificar tema, `page.emulateMedia({ colorScheme: 'dark' })`.

**5. O jsdom não roda o motor de animação do CSS, e não entrega `animationiteration`/`animationend` ao React.** Medido ao testar a marca "pensando" ([F-1](../../../docs/plan/implemented/F-1-marca-pensando.md)): `window.AnimationEvent` é `undefined`, e mesmo um `Event('animationiteration', { bubbles: true })` disparado à mão via `dispatchEvent` não chega ao `onAnimationIteration` de um componente React — confirmado com um componente de uma linha, sem `@keyframes` real nem CSS nenhum envolvido, então não é sobre o CSS não carregar. Regra: teste de nível 2 que precisa provar um handler de evento de animação chama a função **diretamente** (via `renderHook`, se o handler mora num hook), nunca via `fireEvent.animation*`; se o handler for interno a um componente sem hook extraível, essa parte só se prova ao vivo.

Forma comum às cinco: **o ambiente de teste tem padrões, e padrão é decisão silenciosa.** Para saber o que ele suporta, leia o `lib/` instalado — a matriz do jsdom é grande o bastante para dar a impressão errada por omissão.

## O que persiste é testado contra o banco real, nunca contra uma fake

Duas peças da fase 14, e as duas seguem o princípio do `satisfies Api` — **derivar em vez de duplicar**.

Os handlers de `conversation:*` e `settings:*` recebem o banco por parâmetro, então o **nível 3** os chama como funções comuns contra `:memory:`: sem Electron, sem mock dele. E o mock de `window.api` do **nível 2** não os reimplementa: `test/store-api.ts` monta as duas superfícies delegando aos mesmos handlers, sobre um `:memory:` por teste (`node:sqlite` funciona sob o ambiente `jsdom`, que continua sendo Node por baixo). Sem isso, todo teste sobre trocar de conversa, renomear ou manter histórico ficaria vazio — e uma fake escrita à mão teria de repetir ordenação por `updated_at`, o `COALESCE` do título, a cascata e o merge de configurações, com liberdade para divergir em silêncio. Contrapartida assumida: defeito de handler deixa vermelhos também os testes do renderer.

**O que nem isso alcança é o processo morrer.** `e2e/dev/persistence.spec.ts` fecha o `electronApp` e lança de novo — a única prova de que a escrita sobreviveu. Ele exige `--user-data-dir` numa pasta temporária por corrida (o e2e roda contra o `%APPDATA%` real, e um spec que limpasse para começar do zero apagaria o histórico de quem desenvolve), e a **primeira** asserção confere `app.getPath('userData')` antes de qualquer escrita. Atenção ao arrumar: os outros specs ainda lançam sem a flag; hoje é inofensivo porque nenhum deles escreve conversa.

## Armadilha grave: `electron-builder` empacota direto do disco, não do que o git rastreia

`app.asar` não sabe o que está no `.gitignore` — ele empacota tudo que sobrevive ao filtro `files`, de onde estiver no disco. `.claude/settings.local.json` está no `.gitignore` (guarda a API key pessoal do MCP Context7) e mesmo assim vazava para dentro do instalador, porque `files` nunca excluía `.claude/`. Junto vazavam `coverage/`, `docs/`, `e2e/`, `scripts/`, `test/`, `test-results/`, `playwright-report/` e os configs de teste. Verificação real, não leitura de glob: `pnpm dlx @electron/asar list dist/win-unpacked/resources/app.asar | grep <candidato>` — antes e depois de qualquer mudança em `files`. `.gitignore` e `files` respondem perguntas diferentes (o que entra no histórico vs. o que entra no que o usuário instala) e nada as sincroniza automaticamente; todo tipo novo de arquivo local-only exige revisar as duas.

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

`build` continua `typecheck` + `electron-vite build`. Teste roda em `check:fast` (`typecheck && lint && test`), o único comando que o *hook* de edição (fase 08) e o pré-commit vão chamar — um lugar para manter alinhado, não três configs espalhadas. Meta: `check:fast` abaixo de 15s nesta altura do projeto: se já estiver mais lento, é hora de investigar antes de empilhar mais teste em cima. **Estava em 15–19s ao fim da fase 14** (28 arquivos, 207 testes — 35 testes a mais que a fase 13 e nenhum segundo a mais, porque os novos são de ambiente `node`), e a medição redireciona a investigação: a maior fatia é `environment` — a subida do jsdom, uma por arquivo —, não as asserções. Gatilho e número em [`ROADMAP § 2`](../../../docs/ROADMAP.md); não abra uma segunda lista aqui.

## Globals do Vitest declarados manualmente no ESLint

`globals: true` no `vitest.config.ts` evita repetir `import { describe, it, expect } from 'vitest'` em todo arquivo. O ESLint precisa reconhecer os mesmos nomes como globals — declarados manualmente em `eslint.config.mjs` (`describe`, `it`, `test`, `expect`, `vi`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`), não importados do pacote `globals`: ele só está disponível de forma transitiva neste projeto, e usá-lo sem declarar em `package.json` seria a dependência fantasma que o `shamefullyHoist: true` já deixa como risco conhecido (ver skill `architecture`).
