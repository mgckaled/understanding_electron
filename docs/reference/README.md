# Referência técnica

Documentos de **consulta estável**: comparativos, medições, especificações externas e relatórios de investigação. Nem plano, nem história, nem tutorial.

| Documento | Data | Estado | O que responde |
|---|---|---|---|
| [Arte anterior — as skills do mill.tools](arte-anterior-milltools/README.md) | ago/2026 | ⛔ consumido | O que o projeto irmão já resolveu, o que convergiu sem cópia, o que vale trazer e para qual plano — e o que **não** trazer |
| [Brief para o Claude Design](brief-claude-design/README.md) | ago/2026 | ⛔ consumido | O prompt que leva as restrições do design system até a ferramenta externa que gera os protótipos — `@theme inline`, os tokens exatos, a D10.1 via `@utility`, e o que **não** vira utilidade. Registra também a fronteira: o que é trabalho dela e o que é deste repositório |
| [Handoff do Claude Design](handoff-ds-ago2026/README.md) | ago/2026 | ✅ vivo | O que voltou, curado de ~50 arquivos para dois: o protótipo das cinco extensões de interface (insumo do DS-3) e uma captura. O README lista **o que foi descartado e por quê** — incluindo a cópia dos tokens, que a regra de fonte única proíbe, e duas propostas do protótipo que foram recusadas |
| [Web Fetch, MCP e Thinking Mode](web-fetch-mcp-thinking/README.md) | ago/2026 | ✅ vivo, **escopo reduzido à Feature 1** | Guia gerado fora deste repositório, propondo três capacidades de chat via *tool calling* do Ollama. **Duas das três já foram consumidas, e por caminhos que ele não previa:** a Feature 3 (Thinking) pelo arco 21, que a entregou sem *tool calling* em provedor nenhum; a Feature 2 (MCP) pelo arco 23, que trocou MCP por **REST** (DM-0) — dona hoje é a skill [`ctx-7`](../../.claude/skills/ctx-7/SKILL.md). **Só a Feature 1 (busca web) segue viva**, como material de entrada do arco 22, que ainda não nasceu. ⚠️ A premissa comum às três — *tool calling* como espinha dorsal — já foi derrubada duas vezes; leia a Feature 1 sabendo disso |
| [Raciocínio visível — guia de implementação](reasoning/README.md) | 01–02/09/2026, auditado no R-6 (03/09/2026) | ✅ vivo | **Escopo reduzido pelo R-6 — não abrange mais 21-A/21-B.** O que já implementou (21-A/21-B: contrato IPC, rename `ThinkingMark`→`RespondingMark`, prova de que persistir não migra o banco) tem regra viva na skill [`ai`](../../.claude/skills/ai/SKILL.md) e narrativa em `HISTORY.md`. **O que este documento continua sendo o único dono de:** o desenho da migração do Gemini para a Interactions API (`steps[]`, `signature`, `thinking_summaries`) — trabalho ainda não implementado — e a proposta de cortes O-9 na trilha Observatório |
| [Context7 — guia de implementação do arco 23](context7/README.md) | 06–07/09/2026 | ⛔ consumido | **O dono do assunto é a skill [`ctx-7`](../../.claude/skills/ctx-7/SKILL.md)** desde o fechamento do arco (13/09/2026). O que sobra aqui é o *como chegamos lá*: as 32 decisões `DM-n` fechadas **antes de existir código** (com a errata do que a execução fez com cada uma), as sondas com data contra a API real, o desenho do painel de antes da tela existir, e a tabela dos onze cortes. Três anexos: [`api.md`](context7/api.md), [`decisoes.md`](context7/decisoes.md), [`painel.md`](context7/painel.md) |
| [Modelos — ficha técnica](models/README.md) | ago/2026 | ✅ vivo | Local (Ollama): peso, cache KV por faixa de contexto, capacidades e papel de cada modelo da frota; elegíveis, inviáveis e descartados, cada um com o fato que bloqueia. Nuvem (`cloud-optin.md`): seis candidatos — dois de primeira parte e quatro via provedor terceirizado — contexto, preço, teto de taxa do tier grátis, pesquisados, ainda sem integração |
| [Nuvem opt-in — guia de implementação](cloud-optin-implementation-guide/README.md) | ago/2026 | ⛔ consumido | Levantamento prévio do que falta construir para a fatia 3 do [plano 09](../plan/active/09-camada-de-ia.md) sair do papel — segredo, plumbing de provedor, tabela de capacidade chumbada, nível 3, cota/rate limit, formato de streaming por provedor. Marca cada item como decidido, questão em aberto ou não pesquisado; não é o plano em si |
| [Observatório — fundamentação da trilha O](observatory/README.md) | ago/2026 | ✅ vivo | O observatório do mill.tools lido no fonte (6 eixos, 13 painéis) e o que dele se transplanta; o inventário do que o crivo pode observar, cada item classificado por **custo** (Grátis · Barato · Acessível · Caro), **trabalho** (Leve · Moderado · Pesado) e **situação** (Disponível · Gatilhado · Inviável); o critério `crivo.db` vs. `observatory.db`; as regras de leveza do modal; e a sondagem de API que fundamenta os painéis. É o documento que cada plano `O-n` lê antes de nascer |
| [Ollama Cloud — sondagem e as 32 decisões](ollama-cloud/README.md) | 13/09/2026 (sondagem + refinamento) | ✅ vivo | **Material de entrada da trilha `N-3`, e o recorte dela em cinco cortes** — dois deles (a guarda de raciocínio e o popover de modelo em uma linha) **não tocam nuvem**, porque consertam o que já está quebrado antes de acrescentar. A faixa gratuita medida contra o serviço real em **76 requisições**: capacidades, contexto, velocidade (até **315 tok/s**, ~8× o melhor local) e cota. O adaptador `ollama.ts` serve quase inteiro. **Dois modelos entram, quatro saem** — `gemma4:31b` e `gpt-oss:120b`, cada rejeição com o seu motivo. ⚠️ **Os dois "defeitos da nuvem" acabaram sendo do app:** `format` nunca foi implementado em `gemini.ts`/`glm.ts` (logo `ai:propose` já é só-local, sem estar declarado), e `think: false` ignorado pelo `gpt-oss` é o **contrato documentado** — o app manda booleano onde o modelo só aceita nível. Traz também duas capacidades que o daemon local não tem — **busca web e extração de página** —, deixadas fora de propósito porque o dono é o pilar, não o provedor. Cinco anexos: [`decisoes.md`](ollama-cloud/decisoes.md) (as 32 `DNC-<n>`), [`api.md`](ollama-cloud/api.md), [`desempenho.md`](ollama-cloud/desempenho.md), [`capacidades.md`](ollama-cloud/capacidades.md), [`modelos.md`](ollama-cloud/modelos.md) |
| [Subproduto "Projetos" e RAG particionado](projetos-e-rag-por-projeto/README.md) | ago/2026 | ✅ vivo | Levantamento prévio de uma proposta sem compromisso: agrupar conversas, prompt de sistema e RAG por `project_id` (padrão Claude Projects/ChatGPT). Corrige a leitura inicial do teste de escopo, decompõe a proposta por custo, mede busca particionada vs. global, e marca o que ainda depende de verificação ao vivo |

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

**Uma pasta por referência.** Todo documento aqui é `<slug>/README.md`, nunca um `.md` solto na raiz de `reference/`. A pasta é o que deixa uma referência ganhar anexo — captura, protótipo, planilha de medição — sem que o anexo vire um segundo arquivo solto. O slug preserva o nome pelo qual a referência é citada, para que um `grep` pelo nome antigo ainda encontre o destino.

Todo documento aqui começa com **data** e **o que o motivou**. Referência sem data é armadilha: quem lê não sabe se ainda vale, e conferir custa mais que ter escrito.
