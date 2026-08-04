---
name: architecture
description: Decisões estruturais do data-lab — fronteira de processo (main/preload/renderer/core/shared/workers), o que entra de SOLID, erro como dado no IPC, convenção de idioma, e o critério para decidir se algo é urgente ou pode esperar. Use ao criar um canal IPC novo, decidir em que camada um arquivo vai, avaliar se uma dependência nova se justifica, ou julgar se uma decisão pode ser adiada. Não cobre tokens de design (skill design-system) nem estratégia de teste (skill testing) — ainda não escritas.
---

# Arquitetura — data-lab

> Escrito nas fases [00](../../../docs/plan/active/00-visao-geral.md) e [01](../../../docs/plan/implemented/01-camadas-e-fronteiras.md) do plano de fundação — decisões que atravessam todas as fases, mais a estrutura real de pastas e a regra de importação, já em vigor. Cresce quando as fases [02](../../../docs/plan/active/02-contrato-ipc.md) (contrato IPC), [03](../../../docs/plan/active/03-sandbox-e-seguranca.md) (sandbox) e [06](../../../docs/plan/active/06-primeira-feature.md) (primeira feature) forem implementadas. Fonte completa, com o porquê de cada decisão: `docs/plan/active/00-visao-geral.md` e `docs/plan/implemented/01-camadas-e-fronteiras.md`.

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
| `shared/`   | apenas `zod` (fase 02)                      | tudo o mais                                                       |
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

Toda operação que atravessa main↔renderer retorna união discriminada (`Result`), nunca lança para o outro lado. Payload fora do schema é a exceção deliberada — isso **lança**, porque é bug de programação, não falha esperada. Contrato completo (ainda não implementado): [`docs/plan/active/02-contrato-ipc.md`](../../../docs/plan/active/02-contrato-ipc.md).

## Convenção de idioma

Identificadores, comentários, docstrings e logs em inglês. Português só em texto visível ao usuário e em mensagens de erro que chegam cruas à interface. Documentos de planejamento e estudo são português — são leitura, não código.

## Dependência nova pede justificativa registrada, nunca em silêncio

Toda dependência nova entra na fase que a introduz, com a alternativa descartada e o porquê. Não entram por padrão: Tailwind, biblioteca de componentes, container de DI, gerenciador de estado global. Registro das já decididas: [`docs/HISTORY.md`](../../../docs/HISTORY.md).

## `src/main/index.ts` não cresce

É ciclo de vida e criação de janela — nada além disso. Handler de IPC vive em `src/main/features/<x>/`, registrado por um wrapper genérico. Lógica de negócio ali dentro fica intestável e imóvel, e mover para `utilityProcess` depois vira reescrita, não refatoração. Régua de tamanho (quando `main/features/` existir): [`CLAUDE.md`](../../../CLAUDE.md).

## Mapa de dependência entre fases

```
01 camadas ──► 02 contrato ──┬─► 03 sandbox ─────────────┐
                             │                           │
                             └─► 04 testes ──► 05 tokens ─┴─► 06 feature ──► 07 e2e ──► 08 automação
```

A fase 05 (tokens) é a de posição mais flexível — estruturalmente só precisa da 01. Pode ser antecipada para logo depois dela, adiando apenas a verificação contra a 04.
