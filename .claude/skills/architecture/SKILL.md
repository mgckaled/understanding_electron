---
name: architecture
description: Decisões estruturais do data-lab — fronteira de processo (main/preload/renderer/core/shared/workers), o que entra de SOLID, erro como dado no IPC, convenção de idioma, e o critério para decidir se algo é urgente ou pode esperar. Use ao criar um canal IPC novo, decidir em que camada um arquivo vai, avaliar se uma dependência nova se justifica, ou julgar se uma decisão pode ser adiada. Não cobre tokens de design (skill design-system) nem estratégia de teste (skill testing) — ainda não escritas.
---

# Arquitetura — data-lab

> Início da skill, escrito na fase 00 do plano de fundação — decisões que atravessam todas as fases, registradas antes de qualquer camada existir em código. Cresce quando as fases [01](../../../docs/plan/active/01-camadas-e-fronteiras.md) (camadas e fronteiras), [02](../../../docs/plan/active/02-contrato-ipc.md) (contrato IPC), [03](../../../docs/plan/active/03-sandbox-e-seguranca.md) (sandbox) e [06](../../../docs/plan/active/06-primeira-feature.md) (primeira feature) forem implementadas. Fonte completa, com o porquê de cada decisão: [`docs/plan/active/00-visao-geral.md`](../../../docs/plan/active/00-visao-geral.md).

## O critério: o que é caro de desfazer

A pergunta que decide se algo é resolvido agora ou adiado não é "isto é importante?". É:

> Se eu adiar isto, quantos arquivos vou ter que tocar quando finalmente fizer?

**Caro de adiar (decida agora):** contrato IPC tipado · `Result` em vez de exceção na fronteira · cancelamento e progresso já no contrato · `sandbox: true` · tokens em fonte única · estrutura de camadas e regra de importação · `build:win` verde desde cedo.

**Barato de adiar (não decida agora):** Storybook, testes de componente exaustivos, estado global, i18n, sistema de plugins, atualização automática, virtualização de tabela — e, deliberadamente, o próprio DuckDB.

## Fronteira de processo é a arquitetura

Não existe camada inventada neste projeto. `main`, `preload` e `renderer` já são impostas pelo runtime do Electron, com globals diferentes e compilação separada. `core/`, `shared/` e `workers/` apenas nomeiam o que sobra.

**Não usar Clean Architecture** (entities/usecases/repositories). A justificativa dessas camadas é isolar de infraestrutura que pode mudar — e o DuckDB não vai ser trocado, ele é o produto. Um repositório sobre ele jogaria fora o que ele tem de bom.

## SOLID entra parcial, não em bloco

| Princípio | Veredicto |
|---|---|
| SRP | já coberto pela régua de coesão e tamanho — não soma nada além dela |
| OCP | **descartado** — dono do repositório, com git; ponto de extensão especulativo é retrabalho antecipado |
| LSP | quase inaplicável — união discriminada e composição cobrem os casos |
| ISP | **adotado** — é o argumento contra expor `invoke(canal, args)` genérico no preload |
| DIP | **adotado**, na forma nativa da linguagem: parâmetro de função tipado. Sem container de DI |

## Erro é dado, não exceção

Se um handler do main lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado com `Error invoking remote method` — classe, propriedades customizadas e stack original se perdem no *structured clone*. Um `QuerySyntaxError { line, column }` chegaria ao React como texto inútil.

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
