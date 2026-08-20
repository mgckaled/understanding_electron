# Modelos de nuvem — ficha técnica

**Data:** 20/08/2026. **Motivo:** as duas chaves (Google AI Studio e Z.ai) já estão em mãos, e a [D15.9 do plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) já tinha pesquisado os dois candidatos em 10/08/2026 "para que a pesquisa não se repita". Este arquivo substitui aquela tabela como fonte única — dados oficiais, com data de conferência, e sinalizando onde as fontes divergem.

Companheiro deste arquivo: [`ollama-qualified.md`](ollama-qualified.md) e [`ollama-disqualified.md`](ollama-disqualified.md) (modelos locais). Mapa da pasta: [`README.md`](README.md).

⚠️ **Nenhum dos dois modelos está integrado ao app hoje.** A fatia 3 do [plano de IA](../../plan/active/09-camada-de-ia.md) (nuvem opt-in) segue no backlog pelas quatro razões do D15.9 — sem sistema de segredo (regra em [`CLAUDE.md § Segurança`](../../../CLAUDE.md#segurança): mão única, `safeStorage`, "nenhum segredo existe ainda"), sem consumidor além do valor único `'ollama'` em `AiModel.provider`, e bloqueado pelo nível 3 do [`ESCOPO.md`](../../ESCOPO.md#documento-e-imagem-são-nível-3-por-construção) até os planos 16/17 fecharem documento e imagem localmente. Este documento é só a ficha técnica para quando a fatia 3 sair do papel — não uma integração pronta.

⚠️ **Escolhidos por paridade com o mill.tools, não por teste de domínio.** Os dois candidatos são os mesmos já em uso no projeto irmão — não passaram pelo equivalente em nuvem do teste de domínio da D15.8 (candidato só entra se vencer o incumbente do mesmo papel), porque não há um "incumbente" de nuvem a vencer, é a primeira dupla. E a pesquisa desta sessão encontrou sinais de que **nenhum dos dois é a geração corrente do próprio provedor**: um resultado do GLM Coding Plan já cita `GLM-5.2` como carro-chefe e `GLM-4.7` como legado ainda mantido; um resultado de pricing do Gemini foi indexado sob o título "Gemini 3.6 Flash, 3.5 Flash-Lite & Pro". Não investigado a fundo porque estava fora do pedido desta rodada — **gatilho de revisão:** antes de integrar a fatia 3, checar se `glm-5.x-flash` ou um `gemini-3.x-flash` têm tier grátis igual ou melhor.

---

## Índice

1. [`gemini-2.5-flash`](#gemini-25-flash) (Google)
2. [`glm-4.7-flash`](#glm-47-flash) (Zai)

---

## Metodologia

Nuvem não tem `/api/show`: não há modelo para baixar, sondar e devolver `model_info`. Todo número aqui vem da documentação oficial de cada provedor, buscada nesta data — e, ao contrário da tabela de KV cache (aritmética fixa sobre um `model_info` real), preço e teto de taxa são **decisão comercial do fornecedor**, que muda sem aviso e sem relação com o hardware de ninguém. A mesma ressalva já registrada no D15.9 vale aqui: *"buscar em runtime traria rede numa camada que a D9.2 mantém pura, e uma resposta de terceiro decidindo um portão de segurança"* — esta tabela é para **escrever o código com o número certo no dia em que a fatia 3 for construída**, não para o app consultar sozinho.

**Legenda de proveniência:** **oficial** (documentação do próprio provedor — `ai.google.dev`, `docs.z.ai`) · **terceiro** (agregador de preços/limites, usado só quando o provedor não publica o número, ou para conferir um número oficial ambíguo) · **medido** (chamada real contra a API, com resposta ou fatura registrada) — nenhuma entrada é "medido" ainda, porque nenhum dos dois modelos foi chamado pelo app.

⚠️ **Onde as fontes divergem, as duas ficam registradas** — não se escolhe uma por palpite. Marcado em cada caso abaixo.

---

## Comparativo rápido

| | `gemini-2.5-flash` | `glm-4.7-flash` |
|---|---|---|
| Provedor | Google (AI Studio / Gemini API) | Z.ai (portal internacional — **não** `open.bigmodel.cn`) |
| Arquitetura | fechada, não publicada | MoE 30B-A3B (31B parâmetros totais), jan/2026, pesos publicados (open-weight) |
| Contexto de entrada | 1.048.576 tokens | 200.000 tokens (oficial; terceiros citam 202.752–203.000) |
| Teto de saída | 65.536 tokens | 128.000 tokens (oficial) — terceiros mostram 16.384 como teto de alguns provedores intermediários |
| Conhecimento até | janeiro/2025 | não publicado |
| Modalidades de entrada | texto, imagem, vídeo, áudio | texto |
| `tools` / saída estruturada / `thinking` | sim / sim / sim | sim / sim / sim (alternável) |
| Tier grátis | entrada e saída grátis, com teto de taxa (ver abaixo) | **completamente grátis** — 1 concorrência |
| Tier pago | US$ 0,30 / US$ 2,50 por milhão de tokens (entrada/saída) | não se aplica ao `-flash` — variantes maiores (`glm-4.7`, `glm-5.3`) são pagas |

---

## `gemini-2.5-flash`

Provedor Google, endpoint `gemini-2.5-flash`. Descrição oficial: "melhor relação preço-desempenho para tarefas de baixa latência e alto volume que exigem raciocínio".

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto de entrada | 1.048.576 tokens | oficial |
| Teto de saída | 65.536 tokens (inclui tokens de "pensamento") | oficial |
| Conhecimento até | janeiro/2025 | oficial |
| Arquitetura | fechada, não publicada | oficial |
| Modalidades de entrada | texto, imagem, vídeo, áudio — saída só texto | oficial |
| Capacidades | `tools` (function calling), saída estruturada, `thinking` (raciocínio nativo, orçável), *context caching*, execução de código, *grounding* (Google Search, Google Maps), Batch API | oficial |
| Preço pago (por 1M tokens) | entrada US$ 0,30 (texto/imagem/vídeo) ou US$ 1,00 (áudio) · saída US$ 2,50 · *cache*: leitura US$ 0,03 (texto/imagem/vídeo) ou US$ 0,10 (áudio), armazenamento US$ 1,00/hora | oficial |
| Tier grátis — entrada/saída | **grátis**, incluindo tokens de pensamento | oficial |
| Tier grátis — teto de taxa | 10 RPM, 250.000 TPM; RPD **250** (D15.9 + agregador de mar/2026) **ou 500** (agregador sem data) — divergem | **terceiro** — a doc oficial (`ai.google.dev/.../rate-limits`) parou de publicar tabela fixa, direciona ao console do AI Studio |

**Não confiar em nenhum dos dois números de RPD sem checar o console do AI Studio no dia em que a chave for usada de verdade** — é por projeto, não uma constante do modelo.

**Uso do dado no tier grátis:** diferente do pago, prompts do tier grátis **podem ser usados pelo Google para melhorar produtos**. Nota de privacidade relevante porque a fronteira de nível 3 do app é sobre o dado **sair da máquina** — aqui ele sairia para treinamento, não só para inferência.

**No app:** é o único candidato de nuvem que **enxerga imagem** — e o [`ESCOPO.md`](../../ESCOPO.md#documento-e-imagem-são-nível-3-por-construção) bloqueia justamente imagem na nuvem. Tensão já registrada no D15.9, sem solução: um usuário verá um modelo capaz de ver, com o anexo recusado, até a regra do nível 3 ser revisitada (ela é sobre *sair da máquina*, não sobre *o usuário anexar conscientemente* — a leitura escrita hoje é a primeira, não a segunda). Fora de imagem, é o candidato de **contexto generoso**: 1M tokens dispensa resumo ou RAG para a maioria dos documentos que o app processa. Mas o teto de 10 RPM o torna inviável para qualquer coisa parecida com uso contínuo — serve para consulta pontual, não para uma conversa longa batendo na API a cada mensagem.

---

## `glm-4.7-flash`

Provedor Z.ai (Zhipu), endpoint `glm-4.7-flash`. Posicionamento oficial: "leve, completamente grátis" ("lightweight, completely free").

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto de entrada | 200.000 tokens (arredondado pela doc oficial; agregadores de terceiros mostram 202.752–203.000) | oficial |
| Teto de saída | 128.000 tokens — **discrepância**: agregadores como OpenRouter mostram 16.384 como teto prático, provavelmente um limite do provedor intermediário, não da Z.ai direto | oficial |
| Conhecimento até | não publicado | — |
| Arquitetura | MoE 30B-A3B (31B parâmetros totais), lançado jan/2026, pesos publicados (open-weight) | **terceiro** — herdado do D15.9, não reconferido nesta sessão |
| Modalidades de entrada | texto — visão é um modelo separado (`glm-4.6v-flash`/`glm-4.7v`, fora desta ficha) | oficial |
| Capacidades | `tools` (function calling), saída estruturada, `thinking` (alternável, "enabled"/"disabled") | oficial |
| Preço | **grátis** em toda categoria (entrada, entrada em cache, armazenamento de cache, saída) | oficial |
| Tier grátis — teto de taxa | **1 concorrência** | **terceiro** — consistente entre a pesquisa do D15.9 (10/08/2026) e agregadores de terceiros, mas a `docs.z.ai` não confirma o número diretamente (a página de preços não lista concorrência) |

Um agregador terceiro, sem confirmação oficial, cita ~1 req/s e ~1.000 req/dia como efeito prático da concorrência de 1 — não incluído na tabela por ser inferência de terceiro sobre outro número de terceiro, não uma medida independente.

⚠️ **Portal certo:** a chave sai do portal **internacional** (`z.ai/model-api` → `docs.z.ai`), não de `open.bigmodel.cn` (portal doméstico chinês, termos e faturamento diferentes) — mesma advertência já registrada no `README.md` do mill.tools (projeto irmão, mesmo desenvolvedor).

**No app:** contexto de 200K é generoso o bastante para qualquer arquivo que o app processa hoje sem precisar resumir, e sem visão nem áudio a esbarrar na regra do nível 3 sobre imagem — texto puro é nível 1/2, sempre livre. **Não ver imagem** é, aqui, uma vantagem de simplicidade: nenhuma tensão equivalente à do `gemini-2.5-flash`. A limitação real é a concorrência de 1 — o app não pode disparar duas chamadas simultâneas contra este modelo (ex.: um passo do pipeline de dados narrando enquanto a conversa responde outra pergunta) sem enfileirar, o mesmo tipo de restrição de "um modelo residente por vez" que já disciplina o Ollama nesta máquina ([`CLAUDE.md`](../../../CLAUDE.md#ambiente-de-desenvolvimento)), por um motivo diferente (fila do provedor, não RAM local).

---

## Fontes

Buscadas em 20/08/2026 — preço e teto de taxa de provedor de nuvem envelhecem sem aviso; reconferir antes de codificar a fatia 3.

- [Gemini API — Pricing](https://ai.google.dev/gemini-api/docs/pricing) (oficial)
- [Gemini API — Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) (oficial — sem tabela fixa, direciona ao console)
- [Gemini API — Models (gemini-2.5-flash)](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) (oficial)
- [GLM-4.7 — Overview](https://docs.z.ai/guides/llm/glm-4.7) (oficial)
- [Z.ai — Pricing](https://docs.z.ai/guides/overview/pricing) (oficial)
- [Gemini API Free Tier Rate Limits — AI Prompt Generator Hub](https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits) (terceiro, sem data — RPD 500)
- [Gemini API Free Tier Complete Guide — AI Free API](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-complete-guide) (terceiro, mar/2026 — RPD 250)
- [Z.ai Released GLM-4.7-Flash Weights and API — ToolNavs](https://toolnavs.com/en/article/1100-zai-released-glm-47-flash-weights-and-api-free-tier-1-concurrency-and-launched-f) (terceiro — confirma 1 concorrência)
