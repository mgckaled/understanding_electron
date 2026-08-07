# Plano de fundação — encerrado (ago/2026)

As oito fases de fundação estão **concluídas e arquivadas** em [`../implemented/`](../implemented/). Este diretório (`active/`) é o backlog vivo do [ciclo de vida de plano](../../README.md); a fundação saiu dele, e o que resta aqui é o próximo plano ainda não executável.

> Plano em `implemented/` é registro histórico, não fonte viva. Se o repositório contradisser um plano arquivado, o **repositório ganha**. A fonte viva de cada assunto está na tabela de fonte única do [`README de docs`](../../README.md).

---

## O que a fundação entregou

Do scaffold do electron-vite a uma base pronta para a camada de dados. Uma linha por fase; o "por quê" de cada uma está em [`HISTORY.md`](../../HISTORY.md), e o documento completo em [`implemented/`](../implemented/).

| # | Entrega |
|---|---|
| [00](../implemented/00-visao-geral.md) | Visão geral: o critério "caro de desfazer" e as decisões globais D1–D6 |
| [01](../implemented/01-camadas-e-fronteiras.md) | Seis camadas em `src/`, com a regra de importação verificada por ESLint |
| [02](../implemented/02-contrato-ipc.md) | Contrato IPC tipado, `Result`, preload estreito, registro de handlers |
| [03](../implemented/03-sandbox-e-seguranca.md) | `sandbox: true`, superfície mínima, fronteira de segurança fixada |
| [04](../implemented/04-testes-rapidos.md) | Vitest em dois projetos, níveis 1–3 da pirâmide |
| [05](../implemented/05-design-tokens.md) | `tokens.css`, primitivos, densidade de desktop, `StateView` |
| [06](../implemented/06-primeira-feature.md) | `open-dataset` de ponta a ponta, com progresso e cancelamento |
| [07](../implemented/07-e2e-e-empacotamento.md) | Playwright em dev e contra o instalador |
| [08](../implemented/08-automacao-e-registro.md) | Hooks de verificação, `CLAUDE.md` pós-fundação, três skills, este arquivamento |

As decisões estruturais viraram as skills [`architecture`](../../../.claude/skills/architecture/SKILL.md), [`design-system`](../../../.claude/skills/design-system/SKILL.md) e [`testing`](../../../.claude/skills/testing/SKILL.md) — carregadas quando o assunto aparece, em vez de ocuparem contexto em toda sessão.

---

## O que ficou adiado

Cada adiamento tem um **evento** que o reabre, não uma data. A lista consolidada é dona de [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão) — não se repete aqui, para não envelhecer em dois lugares. Os de maior alcance: `shamefullyHoist: false` quando o DuckDB entrar, `eslint-plugin-boundaries` na sexta fatia de `features/`, uma skill própria de IPC no vigésimo canal, e o `check:fast` a investigar antes de empilhar mais teste — agora ele roda a cada resposta, no `Stop` hook da fase 08.

---

## Onde o trabalho continua

- **Camada de dados** — DuckDB em `utilityProcess`, Arrow, tabela virtualizada: [`study/05-proximos-passos.md`](../../study/05-proximos-passos.md) é o próximo passo real.
- **Camada de IA e ML** — decisões já tomadas, ainda não executável: [`09-camada-de-ia.md`](09-camada-de-ia.md), que segue neste diretório por ser o único plano ainda aberto.
- **A sequência até o produto** do [`ESCOPO.md`](../../ESCOPO.md) está no [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência).
