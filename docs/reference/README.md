# Referência técnica

Documentos de **consulta estável**: comparativos, medições, especificações externas e relatórios de investigação. Nem plano, nem história, nem tutorial.

| Documento | Data | O que responde |
|---|---|---|
| [Arte anterior — as skills do mill.tools](arte-anterior-milltools.md) | ago/2026 | O que o projeto irmão já resolveu, o que convergiu sem cópia, o que vale trazer e para qual plano — e o que **não** trazer |
| [Sistema visual do claude.com](design-claude-com.md) | ago/2026 | Extrato de terceiro do **site de marketing** da Anthropic, com a leitura do crivo por cima: 6 de 13 pares reprovam AA, e o que transfere são cinco regras de forma, não a paleta |
| [Brief para o Claude Design](BRIEF-claude-design.md) | ago/2026 | O prompt que leva as restrições do design system até a ferramenta externa que gera os protótipos — `@theme inline`, os tokens exatos, a D10.1 via `@utility`, e o que **não** vira utilidade. Registra também a fronteira: o que é trabalho dela e o que é deste repositório |
| [Handoff do Claude Design](handoff-ds-ago2026/README.md) | ago/2026 | O que voltou, curado de ~50 arquivos para dois: o protótipo das cinco extensões de interface (insumo do DS-3) e uma captura. O README lista **o que foi descartado e por quê** — incluindo a cópia dos tokens, que a regra de fonte única proíbe, e duas propostas do protótipo que foram recusadas |
| [Web Fetch, MCP e Thinking Mode](web-fetch_mcp_thinking.md) | ago/2026 | Guia de implementação, gerado fora deste repositório, propondo três capacidades de chat via *tool calling* do Ollama — busca web, MCP (Context7) e modo de raciocínio. Origem dos planos 21–23 do arco (ver [`ESCOPO`](../ESCOPO.md#ferramentas-do-chat) e [`ROADMAP § 1`](../ROADMAP.md#1-a-sequência)) |
| [Modelos Ollama — ficha técnica](models/README.md) | ago/2026 | Peso, cache KV por faixa de contexto, capacidades e papel de cada modelo da frota; elegíveis, inviáveis e descartados, cada um com o fato que bloqueia e o que reabriria a análise |

---

## O que entra aqui

| Entra | Não entra |
|---|---|
| Comparativo entre bibliotecas ou formatos, com o racional da escolha | Trabalho a fazer → [`../plan/active/`](../plan/active/) |
| Medição de desempenho com metodologia e números | O que já foi feito → [`../HISTORY.md`](../HISTORY.md) |
| Resumo de especificação externa (formato de arquivo, API de terceiro) | Conceito para aprender → [`../study/`](../study/README.md) |
| Relatório de investigação que sobrevive à decisão que o motivou | Pendência → [`../ROADMAP.md`](../ROADMAP.md) |

A distinção que mais gera dúvida é com `study/`:

> **`study/` se lê uma vez para entender. `reference/` se consulta muitas vezes para lembrar.**

Um caderno explicando por que o Electron tem três processos é `study/`. Uma tabela de quais dialetos de CSV o DuckDB reconhece é `reference/`.

---

## Candidatos previstos

Não existem ainda; ficam anotados para que, quando surgirem, não acabem no lugar errado:

- **Medição de leitura de arquivo grande** — sai da validação manual da [fase 06](../plan/implemented/06-primeira-feature.md). Vira a linha de base contra a qual o DuckDB será comparado.
- **Dialetos e sujeira de CSV** — separadores, encodings, BOM, cabeçalho fora da primeira linha. Catálogo do que o app precisa reconhecer, com exemplo real de cada caso.
- **Peculiaridades do `.xlsx`** — planilhas múltiplas, células mescladas, tipo por célula, datas em serial, valor armazenado versus formatado. O [`ESCOPO.md`](../ESCOPO.md) registra o teto de memória; o detalhe do formato mora aqui.
- **Ficha técnica dos modelos de nuvem (`models/cloud-optin.md`)** — quando a fatia 3 da [camada de IA](../plan/active/09-camada-de-ia.md) tirar o opt-in de nuvem do papel (D15.9). Peso e cache KV não se aplicam (não há `num_ctx` a reservar num provedor remoto); o que entra é custo por token, limite de taxa e o que cada provedor expõe do parecido com `/api/show`.

---

## Regra ao adicionar

Todo documento aqui começa com **data** e **o que o motivou**. Referência sem data é armadilha: quem lê não sabe se ainda vale, e conferir custa mais que ter escrito.
