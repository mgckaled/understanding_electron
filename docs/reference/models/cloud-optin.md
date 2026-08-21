# Modelos de nuvem — ficha técnica

**Data:** 20/08/2026. **Motivo:** as duas chaves (Google AI Studio e Z.ai) já estão em mãos, e a [D15.9 do plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) já tinha pesquisado os dois candidatos em 10/08/2026 "para que a pesquisa não se repita". Este arquivo substitui aquela tabela como fonte única — dados oficiais, com data de conferência, e sinalizando onde as fontes divergem. Ganhou quatro elegíveis via provedor terceirizado na mesma data, achados numa varredura mais ampla da indústria — o panorama completo dessa varredura (modelo de negócio, política de dado) mora em [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md), não aqui.

Companheiro deste arquivo: [`ollama-qualified.md`](ollama-qualified.md) e [`ollama-disqualified.md`](ollama-disqualified.md) (modelos locais), [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md) (panorama de provedores, fora do escopo de ficha técnica). Mapa da pasta: [`README.md`](README.md).

⚠️ **Nenhum dos seis modelos está integrado ao app hoje.** A fatia 3 do [plano de IA](../../plan/active/09-camada-de-ia.md) (nuvem opt-in) segue no backlog pelas quatro razões do D15.9 — sem sistema de segredo (regra em [`CLAUDE.md § Segurança`](../../../CLAUDE.md#segurança): mão única, `safeStorage`, "nenhum segredo existe ainda"), sem consumidor além do valor único `'ollama'` em `AiModel.provider`, e bloqueado pelo nível 3 do [`ESCOPO.md`](../../ESCOPO.md#documento-e-imagem-são-nível-3-por-construção) até os planos 16/17 fecharem documento e imagem localmente. Este documento é só a ficha técnica para quando a fatia 3 sair do papel — não uma integração pronta.

⚠️ **Os dois primeiros, por paridade com o mill.tools — não por teste de domínio.** `gemini-2.5-flash` e `glm-4.7-flash` são os mesmos já em uso no projeto irmão — não passaram pelo equivalente em nuvem do teste de domínio da D15.8 (candidato só entra se vencer o incumbente do mesmo papel), porque não há um "incumbente" de nuvem a vencer, é a primeira dupla. Os quatro elegíveis abaixo vieram de outro critério — uma varredura de indústria, não paridade com o mill.tools — e também não passaram pelo teste de domínio, pelo mesmo motivo. E a pesquisa desta sessão encontrou sinais de que **nenhum dos dois primeiros é a geração corrente do próprio provedor**: um resultado do GLM Coding Plan já cita `GLM-5.2` como carro-chefe e `GLM-4.7` como legado ainda mantido; um resultado de pricing do Gemini foi indexado sob o título "Gemini 3.6 Flash, 3.5 Flash-Lite & Pro". Não investigado a fundo porque estava fora do pedido desta rodada — **gatilho de revisão:** antes de integrar a fatia 3, checar se `glm-5.x-flash` ou um `gemini-3.x-flash` têm tier grátis igual ou melhor.

---

## Índice

1. [`gemini-2.5-flash`](#gemini-25-flash) (Google)
2. [`glm-4.7-flash`](#glm-47-flash) (Zai)

**Elegíveis, via provedor terceirizado**

3. [Kimi K2 (via Groq)](#kimi-k2-via-groq)
4. [Qwen3 32B (via Groq)](#qwen3-32b-via-groq)
5. [DeepSeek-V3.2 (via SambaNova)](#deepseek-v32-via-sambanova)
6. [GPT-OSS-120B (via Cerebras)](#gpt-oss-120b-via-cerebras)

---

## Metodologia

Nuvem não tem `/api/show`: não há modelo para baixar, sondar e devolver `model_info`. Todo número aqui vem da documentação oficial de cada provedor, buscada nesta data — e, ao contrário da tabela de KV cache (aritmética fixa sobre um `model_info` real), preço e teto de taxa são **decisão comercial do fornecedor**, que muda sem aviso e sem relação com o hardware de ninguém. A mesma ressalva já registrada no D15.9 vale aqui: *"buscar em runtime traria rede numa camada que a D9.2 mantém pura, e uma resposta de terceiro decidindo um portão de segurança"* — esta tabela é para **escrever o código com o número certo no dia em que a fatia 3 for construída**, não para o app consultar sozinho.

**Legenda de proveniência:** **oficial** (documentação do próprio provedor — `ai.google.dev`, `docs.z.ai`) · **terceiro** (agregador de preços/limites, usado só quando o provedor não publica o número, ou para conferir um número oficial ambíguo) · **medido** (chamada real contra a API, com resposta ou fatura registrada) — nenhuma entrada é "medido" ainda, porque nenhum dos dois modelos foi chamado pelo app.

⚠️ **Onde as fontes divergem, as duas ficam registradas** — não se escolhe uma por palpite. Marcado em cada caso abaixo.

---

## Comparativo rápido

Cobre só a dupla de primeira parte — os quatro elegíveis via provedor terceirizado têm tabela própria em cada subseção abaixo, não repetida aqui.

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

## Elegíveis, via provedor terceirizado

Diferença de proveniência que vale marcar antes das quatro fichas: `gemini-2.5-flash` e `glm-4.7-flash` acima são API **de primeira parte** — o mesmo fabricante responde pelo dado e pelo modelo. As quatro entradas abaixo são modelo de um laboratório rodando na infraestrutura de **outra** empresa (um provedor de inferência que vende chip, não modelo) — duas responsabilidades diferentes empilhadas, não uma. O porquê disso importar para segurança/dado, e o panorama completo de provedores pesquisados (incluindo os descartados), estão em [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md) — este documento não repete aquele, só aponta.

Analisados, sem bloqueio técnico encontrado, sem papel atribuído ainda — mesmo status de "elegível" que `ollama-qualified.md` usa para candidatos locais.

### Kimi K2 (via Groq)

Modelo da Moonshot AI (Kimi K2 Instruct, revisão `0905`), servido pela Groq em hardware LPU próprio. Endpoint `moonshotai/kimi-k2-instruct-0905`.

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto | 256.000 tokens | oficial (`console.groq.com`) |
| Arquitetura | MoE, ~1T parâmetros totais / ~32B ativos por token (número amplamente citado para o Kimi K2 original; não reconfirmado oficialmente para a revisão `0905` especificamente) | **não verificado nesta sessão** — não veio de nenhuma busca desta rodada, é conhecimento de treino recuperado por recall; reconferir contra a ficha de modelo da Moonshot antes de usar o número |
| Capacidades | *tool use*, *prompt caching*, foco em codificação agêntica | oficial |
| Preço pago (por 1M tokens) | entrada US$ 1,00 · saída US$ 3,00 | terceiro (agregador de preço, não achado na doc oficial de pricing da Groq) |
| Tier grátis — teto de taxa | **30 RPM / 6.000 TPM / 14.400 req/dia** — limite de **organização**, compartilhado entre todos os modelos da Groq, não específico deste | oficial |

**No app:** contexto de 256K supera até o `gemini-2.5-flash` em ordem de grandeza abaixo de 1M, e sobra folga para qualquer documento que o app processa hoje. A limitação real é a mesma de qualquer modelo grande na Groq: o teto de 14.400 requisições/dia é de conta, não deste modelo — outros modelos consumidos na mesma chave disputam a mesma cota.

### Qwen3 32B (via Groq)

Modelo da Alibaba (Qwen3, variante densa de 32B — **não** é MoE, diferente do Kimi K2 e do GPT-OSS abaixo), servido pela Groq. Endpoint `qwen/qwen3-32b`.

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto | 128.000 tokens | oficial |
| Arquitetura | densa, 32B parâmetros, todos ativos por token | **inferido** — o changelog da Groq descreve o modelo (contexto, `tool use`, modos de raciocínio) sem declarar dense vs. MoE; a leitura "densa" vem da ausência de sufixo estilo `-A22B` (convenção que o Qwen3 usa para variantes MoE), não de uma afirmação direta da fonte |
| Capacidades | *tool use*, modo JSON, alternância *thinking*/*non-thinking*, mais de 100 idiomas | oficial |
| Preço pago (por 1M tokens) | entrada US$ 0,29 · saída US$ 0,59 | oficial |
| Tier grátis — teto de taxa | mesmo limite de organização da Groq — 30 RPM / 6.000 TPM / 14.400 req/dia | oficial |

**No app:** é o único dos quatro elegíveis com alternância explícita de modo de raciocínio (`thinking`/`non-thinking`) exposta na chamada — mesma capacidade que o `qwen3:4b` local já tem, mas sem o custo de cache KV que torna aquele caro na frota Ollama (ver [`ollama-qualified.md`](ollama-qualified.md#qwen34b)), porque aqui quem paga o cache é a Groq, não a máquina do usuário. Suporte a mais de 100 idiomas é mais amplo do que o app precisa hoje (a conversa é majoritariamente em português), sem ser desvantagem.

### DeepSeek-V3.2 (via SambaNova)

Modelo da DeepSeek (V3.2, revisão *Preview*, com *DeepSeek Sparse Attention* — construído sobre o V3.1-Terminus), servido pela SambaNova em hardware RDU próprio.

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto | 128.000 tokens | terceiro (consistente entre duas fontes independentes) |
| Teto de saída | ~8.000 tokens | terceiro |
| Arquitetura | MoE — a família V3 é amplamente citada como 685B parâmetros totais / 37B ativos por token, mas **não confirmado oficialmente para o V3.2 especificamente**; a doc oficial da DeepSeek para o V3.2 fala em "*DeepSeek Sparse Attention*" sobre a base do V3.1-Terminus, sem repetir a contagem de parâmetros | terceiro |
| Tier grátis — teto de taxa | **20 RPM / 20 req/dia / 200.000 tokens/dia** — o mais apertado em requisições/dia de toda a pesquisa desta rodada, apesar do rótulo "*forever free*" da SambaNova | **terceiro** (`ayautomate.com`; a documentação oficial da SambaNova não foi consultada diretamente — só a página de planos/dashboard) |

⚠️ **20 requisições por dia não sustenta uma conversa** — é o teto mais restrito encontrado nesta rodada inteira, incluindo o Gemini free tier (250-500 RPD) já documentado. "*Forever free*" descreve permanência, não generosidade — são eixos independentes (mesmo ponto já registrado em [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md#3-provedores-de-inferência-terceirizados--panorama)).

**No app:** é o único caminho gratuito encontrado para um modelo da família DeepSeek — a API própria da DeepSeek não tem tier recorrente (só 5M tokens de bônus único, ver a ficha completa no documento de panorama). Mas com 20 req/dia, é inviável para qualquer uso real de conversa — serviria, no máximo, para validar uma resposta pontual, não para o app oferecer como opção no seletor de modelo.

### GPT-OSS-120B (via Cerebras)

Modelo da própria OpenAI (`gpt-oss-120b`), aberto sob licença Apache 2.0, servido pela Cerebras em hardware *wafer-scale* próprio.

> **Por que o nome "GPT-OSS":** "OSS" é a sigla de *open-source*/*open-weight* — a OpenAI lançou os pesos deste modelo (e do irmão menor, `gpt-oss-20b`) em 5 de agosto de 2025, sob licença Apache 2.0, marcando o retorno da empresa a modelo de peso aberto pela primeira vez desde o GPT-2. O nome é literal: é o "GPT [que é] Open Source [Software]" da própria OpenAI, para diferenciar da linha fechada (GPT-4o, GPT-5 etc.).

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto — tier grátis | 65.000 tokens | oficial (`inference-docs.cerebras.ai`) |
| Contexto — tier pago | 131.000 tokens | oficial |
| Teto de saída — grátis / pago | 32.000 / 40.000 tokens | oficial |
| Arquitetura | MoE, 117B parâmetros totais, **5,1B ativos por token** | oficial (ficha de modelo da própria OpenAI) |
| Capacidades | *tool use* nativo (busca web, execução de código Python), raciocínio — treinado com técnicas derivadas de modelos internos da OpenAI (o3 e sucessores) | oficial |
| Preço pago (por 1M tokens) | entrada US$ 0,35 · saída US$ 0,75 | terceiro (Context7 trouxe a estrutura de preço da Cerebras — "por milhão de tokens, com desconto por volume" — mas não os valores em dólar; número vindo de busca web, não confirmado direto na doc oficial) |
| Tier grátis — teto de taxa | 30 RPM / 60.000 TPM de entrada / 1.000.000 tokens/dia | oficial |

**No app:** único dos quatro elegíveis com origem **ocidental e peso aberto ao mesmo tempo** — os outros três são de laboratórios asiáticos (Moonshot, Alibaba, DeepSeek) hospedados nos EUA; este é da própria OpenAI, hospedado nos EUA. O teto de contexto do tier grátis (65k) é o menor desta lista de quatro, mas o teto de taxa (1M tokens/dia) é o mais alto — perfil de "muito volume, contexto moderado", o oposto do Kimi K2 acima.

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

**Elegíveis (Kimi K2, Qwen3 32B, DeepSeek-V3.2, GPT-OSS-120B):**

- [GroqDocs — modelos, rate limits, changelog](https://console.groq.com/docs/rate-limits) (oficial, via Context7)
- [Cerebras Inference — docs, gpt-oss, pricing](https://inference-docs.cerebras.ai/models/openai-oss) (oficial, via Context7)
- [Introducing gpt-oss — OpenAI](https://openai.com/index/introducing-gpt-oss/) · [gpt-oss-120b & gpt-oss-20b Model Card — OpenAI](https://openai.com/index/gpt-oss-model-card/) (oficial)
- [SambaNova Cloud — planos e dashboard](https://cloud.sambanova.ai/plans) (oficial)
- [DeepSeek-V3.2-Exp — anúncio oficial](https://api-docs.deepseek.com/news/news250929) (oficial — não detalha contagem de parâmetros)
- [DeepSeek-V3.2 (Preview) (SambaNova): Free Limits — ayautomate.com](https://www.ayautomate.com/free-models/sambanova-deepseek-v3-2) (terceiro — RPM/RPD/TPD e contexto)
- Panorama completo de provedores e política de dados: [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md)
