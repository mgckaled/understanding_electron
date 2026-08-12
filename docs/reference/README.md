# Referência técnica

Documentos de **consulta estável**: comparativos, medições, especificações externas e relatórios de investigação. Nem plano, nem história, nem tutorial.

| Documento | Data | O que responde |
|---|---|---|
| [Arte anterior — as skills do mill.tools](arte-anterior-milltools.md) | ago/2026 | O que o projeto irmão já resolveu, o que convergiu sem cópia, o que vale trazer e para qual plano — e o que **não** trazer |
| [Sistema visual do claude.com](design-claude-com.md) | ago/2026 | Extrato de terceiro do **site de marketing** da Anthropic, com a leitura do crivo por cima: 6 de 13 pares reprovam AA, e o que transfere são cinco regras de forma, não a paleta |
| [Brief para o Claude Design](BRIEF-claude-design.md) | ago/2026 | O prompt que leva as restrições do design system até a ferramenta externa que gera os protótipos — `@theme inline`, os tokens exatos, a D10.1 via `@utility`, e o que **não** vira utilidade. Registra também a fronteira: o que é trabalho dela e o que é deste repositório |
| [Handoff do Claude Design](handoff-ds-ago2026/README.md) | ago/2026 | O que voltou, curado de ~50 arquivos para dois: o protótipo das cinco extensões de interface (insumo do DS-3) e uma captura. O README lista **o que foi descartado e por quê** — incluindo a cópia dos tokens, que a regra de fonte única proíbe, e duas propostas do protótipo que foram recusadas |

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
- **Comparativo de modelos locais** — quando a camada de IA chegar, qual modelo do Ollama para qual papel, com custo de RAM medido nesta máquina.

---

## Regra ao adicionar

Todo documento aqui começa com **data** e **o que o motivou**. Referência sem data é armadilha: quem lê não sabe se ainda vale, e conferir custa mais que ter escrito.
