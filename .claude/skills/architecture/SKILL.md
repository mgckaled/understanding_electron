---
name: architecture
description: Decisões estruturais do crivo — fronteira de processo, regra de importação, estrutura do renderer, sandbox e o critério "caro de desfazer". Use ao decidir em que camada um arquivo vai, compor tela nova na casca, avaliar dependência nova, mexer em webPreferences/navegação, ou julgar se uma decisão pode esperar. Não cobre IPC (skill ipc), tokens (skill design-system) nem teste (skill testing).
---

# Arquitetura — crivo

> Escrito nas fases [00](../../../docs/plan/implemented/00-visao-geral.md), [01](../../../docs/plan/implemented/01-camadas-e-fronteiras.md), [02](../../../docs/plan/implemented/02-contrato-ipc.md), [03](../../../docs/plan/implemented/03-sandbox-e-seguranca.md) e [06](../../../docs/plan/implemented/06-primeira-feature.md) do plano de fundação — decisões que atravessam todas as fases, mais a estrutura real de pastas, a regra de importação, o contrato IPC, a fronteira de segurança do sandbox e o registro de jobs canceláveis, já em vigor. **Estendida na fase 13** (pasta `app/`, D13.1) **e na fase 14** (`main/db/`, `registerAll()` fechando o ciclo de vida do banco), **e pelos planos 16–18** (o padrão tipo-sem-canal de `MessagePart`, o gatilho do `shamefullyHoist` cumprido no 18-A). Fonte completa, com o porquê de cada decisão: os cinco documentos linkados acima, mais [`docs/HISTORY.md`](../../../docs/HISTORY.md) para as armadilhas de runtime que a fase 06 diagnosticou.

## O critério: o que é caro de desfazer

A pergunta que decide se algo é resolvido agora ou adiado não é "isto é importante?". É:

> Se eu adiar isto, quantos arquivos vou ter que tocar quando finalmente fizer?

**Caro de adiar (decida agora):** contrato IPC tipado · `Result` em vez de exceção na fronteira · cancelamento e progresso já no contrato · `sandbox: true` · tokens em fonte única · estrutura de camadas e regra de importação · `build:win` verde desde cedo.

**Barato de adiar (não decida agora):** Storybook, testes de componente exaustivos, estado global, i18n, sistema de plugins, atualização automática. Virtualização de tabela e o motor DuckDB **saíram desta lista** ao entrarem em produção (planos 18-A a 18-F): o [`ESCOPO.md`](../../../docs/ESCOPO.md) hoje ordena que nenhuma etapa materialize o resultado completo em JavaScript — toda pré-visualização é página ou amostra —, o que torna os dois consequência direta da regra, não mais adiável.

## Fronteira de processo é a arquitetura

Não existe camada inventada neste projeto. `main`, `preload` e `renderer` já são impostas pelo runtime do Electron, com globals diferentes e compilação separada. `core/`, `shared/` e `workers/` nomeiam o que sobra — e as seis já existem em `src/`:

```
src/
├── shared/     contrato e tipos de domínio. Conhecido pelos três processos.
├── core/       lógica pura. Sem electron, sem react.
├── main/       ciclo de vida, janelas, roteamento de IPC. Fino.
│   └── db/     node:sqlite: abertura, escada de migração, transação (fase 14)
├── workers/    entrypoints de utilityProcess. Hoje: DuckDB (skill data).
├── preload/    a única superfície exposta ao renderer.
└── renderer/   React.
```

`workers/duckdb/` é hoje o único entrypoint: motor, contrato interno e o veredito Arrow-vs-JSON são donos da skill [`data`](../data/SKILL.md), que aponta de volta para cá quanto a camadas e regra de importação.

`main/db/` não importa `electron`: `openDatabase()` recebe o caminho por parâmetro, e quem resolve `app.getPath('userData')` é o composition root. É a mesma aplicação de DIP que torna os handlers testáveis — todo o armazenamento roda contra `:memory:` em Node puro. Desde a fase 14 `registerAll()` **retorna o `close` do banco**, e `main/index.ts` o liga em `will-quit`: o registro cuida da costura, o índice cuida do ciclo de vida, e fechar limpo é o que consolida `-wal`/`-shm` de volta no arquivo.

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

`src/renderer/src/` tem `shared/ui/` (um de cada primitivo reusável), `features/` (uma por assunto) e — desde a fase 13 — `app/`, que não é nenhum dos dois: **existe uma só e não tem domínio.** Ali moram `AppShell` (o grid de regiões) e `Sidebar` (o chrome: recolher, três regiões, rodapé).

```
app/AppShell.tsx        grid de regiões — recebe sidebar e main por slot
app/Sidebar.tsx         chrome: recolher, nav · conteúdo · rodapé
features/<assunto>/     uma por assunto
App.tsx                 só composição — quem entra em qual slot
```

> **`app/` nunca importa de `features/`.** Quem compõe é o `App.tsx`. É a regra que faz a casca sobreviver ao arco: tela de configurações, bloco de passos revisáveis e o que vier entram por composição, sem tocar o fonte da casca — e a régua de tamanho de componente do [`CLAUDE.md`](../../../CLAUDE.md) nunca é gasta com ela.

**Slot não é ponto de extensão.** Um `AppShell` que recebe `main` como prop tem exatamente o mesmo número de linhas que um que renderiza a conversa direto — é o mesmo código, menos acoplado. A distinção que impede isto de virar OCP disfarçado está em [`docs/HISTORY.md`](../../../docs/HISTORY.md) § *flexibilidade é forma de dado e slot*: **slot é a recusa a fixar**, não um recurso a demonstrar. Não invente uma segunda tela para provar que o slot funciona.

**Entre `features/` a importação é livre**, e acontece: `conversation` lê `useSettings()` de `features/settings/` porque a chamada ao modelo precisa do teto de threads da máquina. O que a tabela acima restringe é travessia de **processo**, não vizinhança dentro do renderer. Gatilho de revisão em [`ROADMAP § 2`](../../../docs/ROADMAP.md): a sexta fatia em `features/` troca o `no-restricted-imports` por `eslint-plugin-boundaries`.

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

## Erro é dado, não exceção — dono é a skill `ipc`

A régua completa (quando é `Result`, quando é exceção, a forma de `AppError`) mora na skill [`ipc`](../ipc/SKILL.md) § *`Result` ou exceção*. Aqui fica só o porquê estrutural: se um handler do main lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado com `Error invoking remote method` — classe, propriedades customizadas e stack original se perdem no _structured clone_. É esse limite de processo que torna erro esperado dado, não exceção, na fronteira do IPC.

## Contrato IPC: dono é a skill `ipc`

O contrato (`src/shared/ipc.ts`), a superfície `window.api`, a régua de `Result` vs exceção, a validação com zod, o wrapper `handle()`, os eventos e o payload binário **saíram daqui em ago/2026** para a skill [`ipc`](../ipc/SKILL.md), quando o vigésimo canal disparou o gatilho que o [`ROADMAP § 2`](../../../docs/ROADMAP.md) tinha declarado. Não há resumo aqui: fato duplicado é o que a regra de fonte única existe para evitar.

O que fica nesta skill, porque é de camada e não de contrato:

⚠️ **Tipo em `shared/ipc.ts` não implica canal.** `Conversation`/`Message`/`MessagePart` entraram na fase 13 **sem schema zod e sem canal**, de propósito: schema existe para validar payload de IPC, e não havia IPC ainda. O que se decide cedo é a **forma do dado** que atravessa camadas; o canal nasce quando alguém o chama — e chamou: `MessagePart` ganhou schema zod completo e canal próprio por variante (`dataset:attach`, `document:attach`, `image:attach`) nos planos 16 e 17. O princípio segue valendo para o próximo tipo que entrar assim. Ver [`docs/HISTORY.md`](../../../docs/HISTORY.md) § *flexibilidade é forma de dado e slot*.

## Jobs: o registro cancelável

`src/main/jobs.ts` guarda um `Map<JobId, AbortController>` module-level, com `create`/`cancel`/`finish`. `finish` roda no `finally` do handler, sempre, por qualquer via de término — um `Map` que só cresce é vazamento silencioso, que teste nenhum pega sozinho (nenhum teste abre quarenta jobs seguidos).

`JobEvent` é união por `type` (`progress`, `chunk`, `log`); `progress` e `chunk` têm consumidor, `log` é reserva deliberada — três linhas agora contra um segundo mecanismo de eventos depois. Quem transporta o evento, e as duas armadilhas disso, são da skill [`ipc`](../ipc/SKILL.md).

**Cancelar um stream não fecha o stream.** `readline.Interface.close()` só libera o controle do `readline` sobre o `input` — o `fs.ReadStream` subjacente segue lendo do disco depois de um `break` no `for await`, a menos que `stream.destroy()` seja chamado também. Medido, não suposto: ver [`docs/HISTORY.md`](../../../docs/HISTORY.md) § armadilhas.

## Sandbox: renderer sem Node, preload é bundle único

`sandbox: true` no `webPreferences`, ao lado de `contextIsolation: true` e `nodeIntegration: false` explícitos. Os três já eram padrão do Electron antes de virarem linha escrita — o motivo de escrever mesmo assim é leitura: um comentário curto no ponto de aplicação distingue "padrão seguro" de "ninguém pensou nisso" para quem abrir o arquivo daqui a seis meses, e uma alteração acidental aparece no diff.

Com o sandbox ligado, o preload perde o `require` completo — sobra um polyfill limitado, sem capacidade de carregar múltiplos arquivos do próprio código. Por isso o preload é, e continua sendo, **um arquivo único**: `externalizeDepsPlugin()` nunca entra no bloco `preload` do `electron.vite.config.ts`. Ele existe para deixar dependência fora do bundle e resolvida por `require` em runtime — exatamente o que o preload sandboxed não sabe fazer.

**É por isso que `preload/` importa `shared/` só por tipo (ver a tabela acima), e essa restrição já mordeu uma vez** — o defeito, o sintoma (janela vazia, sem erro no terminal) e a regra que dele decorre são da skill [`ipc`](../ipc/SKILL.md).

Navegação para fora da origem do app é negada por padrão (`will-navigate`, ao lado do `setWindowOpenHandler` que já negava janela nova), com uma única exceção em desenvolvimento: o HMR do Vite precisa navegar dentro da própria origem do servidor.

`shamefullyHoist: false` no `pnpm-workspace.yaml` — o gatilho de revisão (instalação do primeiro módulo nativo, o DuckDB) disparou e foi cumprido no plano [`18-A`](../../../docs/plan/implemented/18-A-motor-e-worker.md): desligar expôs uma dependência fantasma (`@types/hast`, hoisted sem estar declarada), corrigida na mesma sessão. Estado completo da fronteira: tabela em [`CLAUDE.md`](../../../CLAUDE.md).

## Convenção de idioma

Identificadores, comentários, docstrings e logs em inglês, sem exceção de escopo — vale para variável local e parâmetro tanto quanto para export público. Português só em texto visível ao usuário e em mensagens de erro que chegam cruas à interface. Documentos de planejamento e estudo são português — são leitura, não código — e essa diferença de idioma não se transfere: trecho de código citado dentro de um `.md` segue a regra do código, não a do documento ao redor, então revise o idioma antes de transcrever qualquer exemplo de um plano para um arquivo fonte.

## Dependência nova pede justificativa registrada, nunca em silêncio

Toda dependência nova entra na fase que a introduz, com a alternativa descartada e o porquê. Não entram por padrão: biblioteca de componentes, container de DI, gerenciador de estado global. Tailwind seguiu essa mesma regra até a trilha DS decidir por ele em ago/2026 — hoje é stack fixada, registrada no [`CLAUDE.md`](../../../CLAUDE.md). Registro das já decididas: [`docs/HISTORY.md`](../../../docs/HISTORY.md).

## `src/main/index.ts` não cresce

É ciclo de vida e criação de janela — nada além disso. Handler de IPC vive em `src/main/features/<x>/handlers.ts`, registrado por `src/main/ipc/register-all.ts` via o wrapper `handle()` de `src/main/ipc/registry.ts`. Lógica de negócio dentro de `index.ts` fica intestável e imóvel, e mover para `utilityProcess` depois vira reescrita, não refatoração. Régua de tamanho: [`CLAUDE.md`](../../../CLAUDE.md).

## Mapa de dependência entre fases

> Registro histórico — as fases 01–08 estão concluídas; o mapa documenta a ordem que orientou a execução, não uma orientação ativa.

```
01 camadas ──► 02 contrato ──┬─► 03 sandbox ─────────────┐
                             │                           │
                             └─► 04 testes ──► 05 tokens ─┴─► 06 feature ──► 07 e2e ──► 08 automação
```

A fase 05 (tokens) é a de posição mais flexível — estruturalmente só precisa da 01. Pode ser antecipada para logo depois dela, adiando apenas a verificação contra a 04.
