---
name: architecture
description: Decisões estruturais do data-lab — fronteira de processo (main/preload/renderer/core/shared/workers), o que entra de SOLID, o contrato IPC (src/shared/ipc.ts, Result vs exceção, validação com zod, superfície de domínio), o sandbox do renderer e a fronteira de segurança, convenção de idioma, e o critério para decidir se algo é urgente ou pode esperar. Use ao criar ou consumir um canal IPC, decidir em que camada um arquivo vai, avaliar se uma dependência nova se justifica, mexer em webPreferences ou navegação da janela, ou julgar se uma decisão pode ser adiada. Não cobre tokens de design (skill design-system) nem estratégia de teste (skill testing) — ainda não escritas.
---

# Arquitetura — data-lab

> Escrito nas fases [00](../../../docs/plan/implemented/00-visao-geral.md), [01](../../../docs/plan/implemented/01-camadas-e-fronteiras.md), [02](../../../docs/plan/implemented/02-contrato-ipc.md), [03](../../../docs/plan/implemented/03-sandbox-e-seguranca.md) e [06](../../../docs/plan/implemented/06-primeira-feature.md) do plano de fundação — decisões que atravessam todas as fases, mais a estrutura real de pastas, a regra de importação, o contrato IPC, a fronteira de segurança do sandbox e o registro de jobs canceláveis, já em vigor. Fonte completa, com o porquê de cada decisão: os cinco documentos linkados acima, mais [`docs/HISTORY.md`](../../../docs/HISTORY.md) para as armadilhas de runtime que a fase 06 diagnosticou.

## O critério: o que é caro de desfazer

A pergunta que decide se algo é resolvido agora ou adiado não é "isto é importante?". É:

> Se eu adiar isto, quantos arquivos vou ter que tocar quando finalmente fizer?

**Caro de adiar (decida agora):** contrato IPC tipado · `Result` em vez de exceção na fronteira · cancelamento e progresso já no contrato · `sandbox: true` · tokens em fonte única · estrutura de camadas e regra de importação · `build:win` verde desde cedo.

**Barato de adiar (não decida agora):** Storybook, testes de componente exaustivos, estado global, i18n, sistema de plugins, atualização automática, virtualização de tabela — e, deliberadamente, o próprio DuckDB.

## Fronteira de processo é a arquitetura

Não existe camada inventada neste projeto. `main`, `preload` e `renderer` já são impostas pelo runtime do Electron, com globals diferentes e compilação separada. `core/`, `shared/` e `workers/` nomeiam o que sobra — e as seis já existem em `src/`:

```
src/
├── shared/     contrato e tipos de domínio. Conhecido pelos três processos.
├── core/       lógica pura. Sem electron, sem react.
├── main/       ciclo de vida, janelas, roteamento de IPC. Fino.
├── workers/    entrypoints de utilityProcess. Vazia até o DuckDB.
├── preload/    a única superfície exposta ao renderer.
└── renderer/   React.
```

**Não usar Clean Architecture** (entities/usecases/repositories). A justificativa dessas camadas é isolar de infraestrutura que pode mudar — e o DuckDB não vai ser trocado, ele é o produto. Um repositório sobre ele jogaria fora o que ele tem de bom.

## A tabela de importação é a lei

| Camada      | Pode importar                               | Nunca importa                                                     |
| ----------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `shared/`   | apenas `zod`                                | tudo o mais                                                       |
| `core/`     | `shared/`, stdlib do Node, libs puras       | `electron`, `react`, `main/`, `renderer/`, `preload/`, `workers/` |
| `main/`     | `shared/`, `core/`, `electron`              | `react`, `renderer/`, `preload/`                                  |
| `workers/`  | `shared/`, `core/`                          | `react`, `renderer/`, `main/`                                     |
| `preload/`  | `shared/` (somente tipos), `electron`       | `core/`, `main/`, `renderer/`                                     |
| `renderer/` | `shared/` (somente tipos), `core/`, `react` | `electron`, `main/`, `preload/`, `workers/`                       |

`preload/` não importa `core/` — deve ser fino a ponto de não ter o que testar, só traduz chamada em mensagem. `renderer/` não importa `electron` — o erro mais comum e mais silencioso em Electron, porque o TypeScript aceita (`electron` está em `devDependencies`, os tipos resolvem) e a falha só aparece em runtime, no navegador, como `require is not defined`.

**Verificada por lint, não só por revisão.** `no-restricted-imports` em `eslint.config.mjs`: um bloco para `src/shared/**` + `src/core/**` (nunca `electron`, nunca `react`, nunca camada acima), outro para `src/renderer/**` (nunca `electron` direto, nunca cruzar para `main/preload/workers`). Regra que só existe em documento é regra que se descobre violada em revisão, seis arquivos depois.

## Aliases, nunca caminho relativo entre camadas

`@shared`, `@core`, `@renderer`. Declarados uma vez em `config/aliases.ts` e importados pelos três blocos do `electron.vite.config.ts` e pelos dois `tsconfig` — `@renderer` só existe no `tsconfig.web.json`, porque `main/` e `workers/` não devem importar do renderer. Sem alias único, `src/renderer/src/features/x/hooks/useY.ts` importaria o contrato como `../../../../../shared/ipc`, e qualquer arquivo que se mova quebra a contagem de pontos.

## SOLID entra parcial, não em bloco

| Princípio | Veredicto                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------- |
| SRP       | já coberto pela régua de coesão e tamanho — não soma nada além dela                                   |
| OCP       | **descartado** — dono do repositório, com git; ponto de extensão especulativo é retrabalho antecipado |
| LSP       | quase inaplicável — união discriminada e composição cobrem os casos                                   |
| ISP       | **adotado** — é o argumento contra expor `invoke(canal, args)` genérico no preload                    |
| DIP       | **adotado**, na forma nativa da linguagem: parâmetro de função tipado. Sem container de DI            |

## Erro é dado, não exceção

Se um handler do main lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado com `Error invoking remote method` — classe, propriedades customizadas e stack original se perdem no _structured clone_. Um `QuerySyntaxError { line, column }` chegaria ao React como texto inútil.

| Situação                                                        | Convenção                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Arquivo não existe · SQL com erro de sintaxe · usuário cancelou | **`Result`** — dado de domínio, a UI precisa reagir               |
| Payload fora do schema · bug no handler                         | **Exceção** — defeito de programação, deve doer no console em dev |

`Result<T, E = AppError>` é `{ ok: true; value: T } | { ok: false; error: E }`, com `AppError` uma união discriminada por `kind` (`not-found`, `permission`, `blocked`, `cancelled`, `timeout`, `unavailable`, `upstream`, `unknown`). Canal que não tem como falhar (`app:info`) não retorna `Result` — embrulhar tudo treina a equipe a ignorar o `ok`.

## Contrato: um mapa de canais, dois consumidores

`src/shared/ipc.ts` declara `Channel → { args, result }` uma vez; `main` tipa os handlers contra ele, `preload` tipa as chamadas contra ele. Nenhum dos dois escreve o nome do canal duas vezes, e o preload é o **único** arquivo que referencia tanto `IpcContract` (o fio, `'app:info'`) quanto `Api` (a interface, `api.app.info`) — divergência entre os dois é erro de compilação nesse único lugar.

O renderer recebe uma superfície de domínio, nunca um `invoke` genérico:

```ts
window.api.app.info() // sim
window.api.invoke('app:info') // não — reintroduz a superfície larga do template
```

`src/main/ipc/registry.ts` é o único arquivo que conhece `ipcMain.handle`; handlers nascem como funções exportadas em `src/main/features/<x>/handlers.ts`, nunca como closures dentro do registro — é o que os torna alcançáveis por teste em Node puro, sem subir o Electron.

## Validação: zod nos argumentos, nunca na saída

`renderer → main` passa por `zod` (schemas em `shared/ipc.ts`, tipos derivados via `z.infer` — nunca escritos em paralelo). `main → renderer` não passa: o main é código próprio rodando privilegiado, e validar a própria saída é desconfiar de si mesmo ao custo de latência em todo resultado.

## Jobs e eventos: declarados na fase 02, implementados na fase 06

`JobId` nasce no **renderer** (`crypto.randomUUID()`), nunca devolvido pelo main — o usuário cancela antes de a promessa resolver, e um id que só chega na resposta não deixa o que cancelar na janela em que isso importa. `JobEvent` é união por `type` (`progress`, `chunk`, `log`); a variante `progress` é a única com consumidor hoje, as outras duas (resposta em fluxo, linha de pipeline) são reserva deliberada — três linhas agora contra um segundo mecanismo de eventos depois.

Listener de evento do main **nunca** vaza o `IpcRendererEvent` para o renderer — carrega `event.sender`, referência viva ao `webContents`. O callback do renderer recebe só o payload; toda assinatura devolve uma função de cancelamento.

O canal do evento (`job:event`) **não** entra em `IpcContract`/`argsSchema` — `handle()` faz `argsSchema[channel]` para todo canal ali, e `job:event` nunca passa por `ipcMain.handle`, só por `webContents.send`. Seu nome mora em `src/shared/channels.ts`, não em `src/shared/ipc.ts` — motivo na próxima seção.

`src/main/jobs.ts` guarda um `Map<JobId, AbortController>` module-level, com `create`/`cancel`/`finish`. `finish` roda no `finally` do handler, sempre, por qualquer via de término — um `Map` que só cresce é vazamento silencioso, que teste nenhum pega sozinho (nenhum teste abre quarenta jobs seguidos). Progresso é emitido a todas as janelas (`BrowserWindow.getAllWindows()`), não endereçado ao remetente — o `handle()` genérico só entrega argumentos ao handler, nunca o `IpcMainInvokeEvent`, e é essa restrição que mantém o handler testável em Node puro; o preço é não saber quem chamou. Gatilho de revisão: a segunda janela do app.

**Cancelar um stream não fecha o stream.** `readline.Interface.close()` só libera o controle do `readline` sobre o `input` — o `fs.ReadStream` subjacente segue lendo do disco depois de um `break` no `for await`, a menos que `stream.destroy()` seja chamado também. Medido, não suposto: ver [`docs/HISTORY.md`](../../../docs/HISTORY.md) § armadilhas.

## Sandbox: renderer sem Node, preload é bundle único

`sandbox: true` no `webPreferences`, ao lado de `contextIsolation: true` e `nodeIntegration: false` explícitos. Os três já eram padrão do Electron antes de virarem linha escrita — o motivo de escrever mesmo assim é leitura: um comentário curto no ponto de aplicação distingue "padrão seguro" de "ninguém pensou nisso" para quem abrir o arquivo daqui a seis meses, e uma alteração acidental aparece no diff.

Com o sandbox ligado, o preload perde o `require` completo — sobra um polyfill limitado, sem capacidade de carregar múltiplos arquivos do próprio código. Por isso o preload é, e continua sendo, **um arquivo único**: `externalizeDepsPlugin()` nunca entra no bloco `preload` do `electron.vite.config.ts`. Ele existe para deixar dependência fora do bundle e resolvida por `require` em runtime — exatamente o que o preload sandboxed não sabe fazer.

**É por isso que `preload/` importa `shared/` só por tipo (ver a tabela acima), e essa restrição já mordeu uma vez.** `src/shared/ipc.ts` importa `zod` como valor (para `argsSchema`); quando a fase 06 importou uma constante de lá **por valor** (`JOB_EVENT_CHANNEL`, precisava existir em runtime para `ipcRenderer.on`), isso arrastou `zod` para o bundle do preload — que o build deixa como `require('zod')` externo não resolvido. O preload falhou ao carregar, `window.api` ficou `undefined`, e a janela abriu **vazia, sem nenhum erro no terminal** onde `pnpm dev` roda; o erro só aparece no DevTools da própria janela (F12). Nem `typecheck`, nem `lint`, nem `test` pegam isso — nenhum executa o bundle do preload dentro do sandbox real. Corrigido com `src/shared/channels.ts`, um arquivo em `shared/` sem nenhuma dependência externa. Regra prática: valor novo que o preload vai consumir de `shared/` nasce num arquivo que não importa nada de fora — nunca reaproveitar um arquivo que já importa uma lib só porque o tipo relacionado mora lá.

Navegação para fora da origem do app é negada por padrão (`will-navigate`, ao lado do `setWindowOpenHandler` que já negava janela nova), com uma única exceção em desenvolvimento: o HMR do Vite precisa navegar dentro da própria origem do servidor.

`shamefullyHoist: true` no `pnpm-workspace.yaml` segue registrado como pendência deliberada, não esquecimento — gatilho de revisão é a instalação do primeiro módulo nativo, o DuckDB. Estado completo da fronteira: tabela em [`CLAUDE.md`](../../../CLAUDE.md).

## Convenção de idioma

Identificadores, comentários, docstrings e logs em inglês, sem exceção de escopo — vale para variável local e parâmetro tanto quanto para export público. Português só em texto visível ao usuário e em mensagens de erro que chegam cruas à interface. Documentos de planejamento e estudo são português — são leitura, não código — e essa diferença de idioma não se transfere: trecho de código citado dentro de um `.md` segue a regra do código, não a do documento ao redor, então revise o idioma antes de transcrever qualquer exemplo de um plano para um arquivo fonte.

## Dependência nova pede justificativa registrada, nunca em silêncio

Toda dependência nova entra na fase que a introduz, com a alternativa descartada e o porquê. Não entram por padrão: Tailwind, biblioteca de componentes, container de DI, gerenciador de estado global. Registro das já decididas: [`docs/HISTORY.md`](../../../docs/HISTORY.md).

## `src/main/index.ts` não cresce

É ciclo de vida e criação de janela — nada além disso. Handler de IPC vive em `src/main/features/<x>/handlers.ts`, registrado por `src/main/ipc/register-all.ts` via o wrapper `handle()` de `src/main/ipc/registry.ts`. Lógica de negócio dentro de `index.ts` fica intestável e imóvel, e mover para `utilityProcess` depois vira reescrita, não refatoração. Régua de tamanho: [`CLAUDE.md`](../../../CLAUDE.md).

## Mapa de dependência entre fases

```
01 camadas ──► 02 contrato ──┬─► 03 sandbox ─────────────┐
                             │                           │
                             └─► 04 testes ──► 05 tokens ─┴─► 06 feature ──► 07 e2e ──► 08 automação
```

A fase 05 (tokens) é a de posição mais flexível — estruturalmente só precisa da 01. Pode ser antecipada para logo depois dela, adiando apenas a verificação contra a 04.
