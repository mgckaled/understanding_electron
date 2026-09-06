---
name: architecture
description: Decisões estruturais do crivo — fronteira de processo, regra de importação, estrutura do renderer, sandbox e o critério "caro de desfazer". Use ao decidir em que camada um arquivo vai, compor tela nova na casca, avaliar dependência nova, mexer em webPreferences/navegação, ou julgar se uma decisão pode esperar. Não cobre IPC (skill ipc), tokens (skill design-system) nem teste (skill testing).
---

# Arquitetura — crivo

## O critério: o que é caro de desfazer

A pergunta que decide se algo é resolvido agora ou adiado não é "isto é importante?". É:

> Se eu adiar isto, quantos arquivos vou ter que tocar quando finalmente fizer?

**Caro de adiar (decida agora):** contrato IPC tipado · `Result` em vez de exceção na fronteira · cancelamento e progresso já no contrato · `sandbox: true` · tokens em fonte única · estrutura de camadas e regra de importação · `build:win` verde desde cedo.

**Barato de adiar (não decida agora):** Storybook, testes de componente exaustivos, estado global, i18n, sistema de plugins, atualização automática. Virtualização de tabela e o motor DuckDB **saíram desta lista** ao entrarem em produção: o [`ESCOPO.md`](../../../docs/ESCOPO.md) ordena que nenhuma etapa materialize o resultado completo em JavaScript — toda pré-visualização é página ou amostra —, o que torna os dois consequência direta da regra, não mais adiável.

## Fronteira de processo é a arquitetura

Não existe camada inventada neste projeto. `main`, `preload` e `renderer` já são impostas pelo runtime do Electron, com globals diferentes e compilação separada. `core/`, `shared/` e `workers/` nomeiam o que sobra — e as seis já existem em `src/`:

```
src/
├── shared/     contrato e tipos de domínio. Conhecido pelos três processos.
├── core/       lógica pura. Sem electron, sem react.
├── main/       ciclo de vida, janelas, roteamento de IPC. Fino.
│   └── db/     node:sqlite: abertura, escada de migração, transação
├── workers/    entrypoints de utilityProcess. Hoje: DuckDB (skill data).
├── preload/    a única superfície exposta ao renderer.
└── renderer/   React.
```

`workers/duckdb/` é hoje o único entrypoint: motor, contrato interno e o veredito Arrow-vs-JSON são da skill [`data`](../data/SKILL.md).

`main/db/` não importa `electron`: `openDatabase()` recebe o caminho por parâmetro, e quem resolve `app.getPath('userData')` é o composition root. É a mesma aplicação de DIP que torna os handlers testáveis — todo o armazenamento roda contra `:memory:` em Node puro. `registerAll()` **retorna o `close` do banco**, e `main/index.ts` o liga em `will-quit`: o registro cuida da costura, o índice cuida do ciclo de vida, e fechar limpo é o que consolida `-wal`/`-shm` de volta no arquivo.

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

## Dentro do renderer há três pastas, e a casca não importa de `features/` (D13.1)

`src/renderer/src/` tem `shared/ui/` (um de cada primitivo reusável), `features/` (uma por assunto) e `app/`, que não é nenhum dos dois: **existe uma só e não tem domínio.** Ali moram `AppShell` (o grid de regiões), `Sidebar` (o chrome: três regiões e rodapé, **controlada** — quem segura `collapsed` é o `App.tsx`) e `sidebarSpace.ts` (quando a casca recolhe a sidebar sozinha, DF3C.2).

```
app/AppShell.tsx        grid de regiões — recebe sidebar e main por slot
app/Sidebar.tsx         chrome: nav · conteúdo · rodapé (controlada)
app/sidebarSpace.ts     o único estado de casca: sidebar recolhida
features/<assunto>/     uma por assunto
App.tsx                 composição — quem entra em qual slot, e a casca
```

> **`app/` nunca importa de `features/`.** Quem compõe é o `App.tsx`. É a regra que faz a casca sobreviver ao arco: tela de configurações, bloco de passos revisáveis e o que vier entram por composição, sem tocar o fonte da casca — e a régua de tamanho de componente do [`CLAUDE.md`](../../../CLAUDE.md) nunca é gasta com ela.

**Slot não é ponto de extensão.** Um `AppShell` que recebe `main` como prop tem exatamente o mesmo número de linhas que um que renderiza a conversa direto — é o mesmo código, menos acoplado. **Slot é a recusa a fixar**, não um recurso a demonstrar: não invente uma segunda tela para provar que o slot funciona. A distinção que impede isto de virar OCP disfarçado está em [`HISTORY-archive.md`](../../../docs/HISTORY-archive.md) § *flexibilidade é forma de dado e slot* (`DT7`).

**Entre `features/` a importação é livre**, e acontece: `conversation` lê `useSettings()` de `features/settings/` porque a chamada ao modelo precisa do teto de threads da máquina. O que a tabela acima restringe é travessia de **processo**, não vizinhança dentro do renderer. ⚠️ **O gatilho da sexta fatia disparou no E-1-B** (`artifact`, `attachment`, `conversation`, `draft`, `panel`, `settings`) e **está aberto**: trocar o `no-restricted-imports` por `eslint-plugin-boundaries` é dependência nova, então passa pela régua abaixo e por um plano próprio — [`ROADMAP § 2`](../../../docs/ROADMAP.md).

⚠️ **`features/panel/` é a fatia mais nova e a mais estranha: ela não tem domínio, tem uma região.** Guarda **qual inquilino ocupa a faixa da direita**, e nada além disso; `artifact` e `draft` guardam a própria seleção e pedem a região. Fica em `features/` e não em `app/` porque a casca não importa de `features/` (D13.1), e `panel` precisa ser importada pelas duas. O ganho é que "só um painel aberto por vez" vira estado **inexpressável** em vez de regra que dois lugares têm de lembrar (DE1B.1).

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

## O contrato IPC é da skill `ipc` — inclusive o porquê de erro ser dado

`src/shared/ipc.ts`, a superfície `window.api`, `Result` vs exceção, a validação com zod, o wrapper `handle()`, os eventos e o payload binário: skill [`ipc`](../ipc/SKILL.md). Não há resumo aqui — fato duplicado é o que a regra de fonte única existe para evitar.

O que fica nesta skill, porque é de camada e não de contrato:

⚠️ **Tipo em `shared/ipc.ts` não implica canal.** `Conversation`/`Message`/`MessagePart` entraram **sem schema zod e sem canal**, de propósito: schema existe para validar payload de IPC, e não havia IPC ainda. O que se decide cedo é a **forma do dado** que atravessa camadas; o canal nasce quando alguém o chama — e chamou: `MessagePart` ganhou schema completo e canal por variante (`dataset:attach`, `document:attach`, `image:attach`). O princípio segue valendo para o próximo tipo que entrar assim. Ver [`HISTORY-archive.md`](../../../docs/HISTORY-archive.md) § *flexibilidade é forma de dado e slot* (`DT7`).

## Jobs: o registro cancelável

`src/main/jobs.ts` guarda um `Map<JobId, AbortController>` module-level, com `create`/`cancel`/`finish`. `finish` roda no `finally` do handler, sempre, por qualquer via de término — um `Map` que só cresce é vazamento silencioso, que teste nenhum pega sozinho (nenhum teste abre quarenta jobs seguidos).

`JobEvent` é união por `type` (`progress`, `chunk`, `log`); `progress` e `chunk` têm consumidor, `log` é reserva deliberada — três linhas agora contra um segundo mecanismo de eventos depois. Quem transporta o evento, e as duas armadilhas disso, são da skill [`ipc`](../ipc/SKILL.md).

⚠️ **Cancelar um stream não fecha o stream.** `readline.Interface.close()` só libera o controle do `readline` sobre o `input` — o `fs.ReadStream` subjacente segue lendo do disco depois de um `break` no `for await`, a menos que `stream.destroy()` seja chamado também. Medido, não suposto: [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md).

## Sandbox: renderer sem Node, preload é bundle único

`sandbox: true` no `webPreferences`, ao lado de `contextIsolation: true` e `nodeIntegration: false` explícitos. Os três já eram padrão do Electron antes de virarem linha escrita — o motivo de escrever mesmo assim é leitura: um comentário curto no ponto de aplicação distingue "padrão seguro" de "ninguém pensou nisso", e uma alteração acidental aparece no diff. Estado completo da fronteira: tabela no [`CLAUDE.md`](../../../CLAUDE.md#segurança).

Com o sandbox ligado, o preload perde o `require` completo — sobra um polyfill limitado, sem capacidade de carregar múltiplos arquivos do próprio código. Por isso o preload é, e continua sendo, **um arquivo único**: `externalizeDepsPlugin()` nunca entra no bloco `preload` do `electron.vite.config.ts`. Ele existe para deixar dependência fora do bundle e resolvida por `require` em runtime — exatamente o que o preload sandboxed não sabe fazer.

⚠️ **O bloco `main` tem o plugin pelo motivo oposto, e com uma exceção nomeada.** Ali as dependências **são** externalizadas — `require(pkg)` em runtime —, o que é certo para binário nativo e errado para pacote **ESM-only**: rollup usa o resultado do `require` direto como export padrão, e o `require(esm)` do Node 24 devolve o *namespace*, então chega `{ default }` em vez da função e o app morre ao carregar. A família `remark` entra em `exclude` por isso (DE1D.9), e `scripts/check-main-bundle.mjs` guarda a regressão — nenhum nível de teste alcança o bundle construído.

**É por isso que `preload/` importa `shared/` só por tipo, e essa restrição já mordeu uma vez** — o defeito, o sintoma (janela vazia, sem erro no terminal) e a regra que dele decorre são da skill [`ipc`](../ipc/SKILL.md).

Navegação para fora da origem do app é negada por padrão (`will-navigate`, ao lado do `setWindowOpenHandler` que já negava janela nova), com uma única exceção em desenvolvimento: o HMR do Vite precisa navegar dentro da própria origem do servidor.

⚠️ **`shamefullyHoist: false`** no `pnpm-workspace.yaml` — desligado no 18-A, e desligar expôs uma dependência fantasma (`@types/hast`, hoisted sem estar declarada). Toda dependência usada precisa estar declarada em `package.json`; contar com hoist acidental quebra aqui.

## Convenção de idioma

Identificadores, comentários, docstrings e logs em inglês, sem exceção de escopo — vale para variável local e parâmetro tanto quanto para export público. Português só em texto visível ao usuário e em mensagens de erro que chegam cruas à interface.

⚠️ Documentos de planejamento e estudo são português — são leitura, não código — e **essa diferença de idioma não se transfere**: trecho de código citado dentro de um `.md` segue a regra do código, não a do documento ao redor. Revise o idioma antes de transcrever qualquer exemplo de um plano para um arquivo fonte.

## Dependência nova pede justificativa registrada, nunca em silêncio

Toda dependência nova entra na fase que a introduz, com a alternativa descartada e o porquê. Não entram por padrão: biblioteca de componentes, container de DI, gerenciador de estado global. Registro das já decididas: [`HISTORY.md`](../../../docs/HISTORY.md); as em uso, [`CLAUDE.md`](../../../CLAUDE.md) § Stack fixada.

## `src/main/index.ts` não cresce

É ciclo de vida e criação de janela — nada além disso. Handler de IPC vive em `src/main/features/<x>/handlers.ts`, registrado por `src/main/ipc/register-all.ts` via o wrapper `handle()` de `src/main/ipc/registry.ts`. Lógica de negócio dentro de `index.ts` fica intestável e imóvel, e mover para `utilityProcess` depois vira reescrita, não refatoração. Régua de tamanho: [`CLAUDE.md`](../../../CLAUDE.md).
