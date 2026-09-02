# Referência técnica

Documentos de **consulta estável**: comparativos, medições, especificações externas e relatórios de investigação. Nem plano, nem história, nem tutorial.

| Documento | Data | Estado | O que responde |
|---|---|---|---|
| [Arte anterior — as skills do mill.tools](arte-anterior-milltools.md) | ago/2026 | ⛔ consumido | O que o projeto irmão já resolveu, o que convergiu sem cópia, o que vale trazer e para qual plano — e o que **não** trazer |
| [Brief para o Claude Design](BRIEF-claude-design.md) | ago/2026 | ⛔ consumido | O prompt que leva as restrições do design system até a ferramenta externa que gera os protótipos — `@theme inline`, os tokens exatos, a D10.1 via `@utility`, e o que **não** vira utilidade. Registra também a fronteira: o que é trabalho dela e o que é deste repositório |
| [Handoff do Claude Design](handoff-ds-ago2026/README.md) | ago/2026 | ✅ vivo | O que voltou, curado de ~50 arquivos para dois: o protótipo das cinco extensões de interface (insumo do DS-3) e uma captura. O README lista **o que foi descartado e por quê** — incluindo a cópia dos tokens, que a regra de fonte única proíbe, e duas propostas do protótipo que foram recusadas |
| [Web Fetch, MCP e Thinking Mode](web-fetch_mcp_thinking.md) | ago/2026 | ✅ vivo | Guia de implementação, gerado fora deste repositório, propondo três capacidades de chat via *tool calling* do Ollama — busca web, MCP (Context7) e modo de raciocínio. Origem dos planos 21–23 do arco (ver [`ESCOPO`](../ESCOPO.md#ferramentas-do-chat) e [`ROADMAP § 1`](../ROADMAP.md#1-a-sequência)). **A seção "Feature 3 — Thinking Mode" está superada pelo guia abaixo** para o arco 21 especificamente; as Features 1/2 (busca web, MCP) seguem vivas para os arcos 22/23 |
| [Raciocínio visível — guia de implementação](reasoning/README.md) | 01–02/09/2026 | ✅ vivo | Levantamento profundo do arco 21 (contrato IPC, os três provedores com fonte primária de cada API, riscos medidos e a medir, o rename `ThinkingMark`→`RespondingMark` do F-1, a prova de que persistir raciocínio não custa migração, e a proposta de cortes 21-A/21-B + O-9 na trilha Observatório). Marca cada item como decidido, questão em aberto ou risco a validar ao vivo; não é o plano em si |
| [Modelos — ficha técnica](models/README.md) | ago/2026 | ✅ vivo | Local (Ollama): peso, cache KV por faixa de contexto, capacidades e papel de cada modelo da frota; elegíveis, inviáveis e descartados, cada um com o fato que bloqueia. Nuvem (`cloud-optin.md`): seis candidatos — dois de primeira parte e quatro via provedor terceirizado — contexto, preço, teto de taxa do tier grátis, pesquisados, ainda sem integração |
| [Nuvem opt-in — guia de implementação](cloud-optin-implementation-guide.md) | ago/2026 | ⛔ consumido | Levantamento prévio do que falta construir para a fatia 3 do [plano 09](../plan/active/09-camada-de-ia.md) sair do papel — segredo, plumbing de provedor, tabela de capacidade chumbada, nível 3, cota/rate limit, formato de streaming por provedor. Marca cada item como decidido, questão em aberto ou não pesquisado; não é o plano em si |
| [Observatório — fundamentação da trilha O](observatory/README.md) | ago/2026 | ✅ vivo | O observatório do mill.tools lido no fonte (6 eixos, 13 painéis) e o que dele se transplanta; o inventário do que o crivo pode observar, cada item classificado por **custo** (Grátis · Barato · Acessível · Caro), **trabalho** (Leve · Moderado · Pesado) e **situação** (Disponível · Gatilhado · Inviável); o critério `crivo.db` vs. `observatory.db`; as regras de leveza do modal; e a sondagem de API que fundamenta os painéis. É o documento que cada plano `O-n` lê antes de nascer |
| [Subproduto "Projetos" e RAG particionado](projetos-e-rag-por-projeto.md) | ago/2026 | ✅ vivo | Levantamento prévio de uma proposta sem compromisso: agrupar conversas, prompt de sistema e RAG por `project_id` (padrão Claude Projects/ChatGPT). Corrige a leitura inicial do teste de escopo, decompõe a proposta por custo, mede busca particionada vs. global, e marca o que ainda depende de verificação ao vivo |

> **A coluna Estado.** `⛔ consumido` = o documento cumpriu a função para que foi escrito (levantamento que virou plano, prompt que foi usado, arte anterior já varrida). Continua aqui, buscável por `Grep`, mas **não é fonte de regra** — o que dele valeu já está no dono, e ler o arquivo inteiro paga tokens para reler o que já foi decidido. Não foi movido para uma pasta `archive/` de propósito: mover quebraria 13 links de registro em `plan/implemented/` e `HISTORY.md`, e o efeito de leitura vem do aviso, não do caminho.

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

---

## Regra ao adicionar

Todo documento aqui começa com **data** e **o que o motivou**. Referência sem data é armadilha: quem lê não sabe se ainda vale, e conferir custa mais que ter escrito.
