# Modelos de nuvem — ficha técnica

**Data:** 20/08/2026. **Motivo:** as duas chaves (Google AI Studio e Z.ai) já estão em mãos, e a [D15.9 do plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) já tinha pesquisado os dois candidatos em 10/08/2026 "para que a pesquisa não se repita". Este arquivo substitui aquela tabela como fonte única — dados oficiais, com data de conferência, e sinalizando onde as fontes divergem. Ganhou quatro elegíveis via provedor terceirizado na mesma data, achados numa varredura mais ampla da indústria — o panorama completo dessa varredura (modelo de negócio, política de dado) mora em [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md), não aqui.

Companheiro deste arquivo: [`ollama-qualified.md`](ollama-qualified.md) e [`ollama-disqualified.md`](ollama-disqualified.md) (modelos locais), [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md) (panorama de provedores, fora do escopo de ficha técnica). Mapa da pasta: [`README.md`](README.md).

✅ **GLM e Gemini estão integrados desde N-1-B/N-1-C** — o texto abaixo, que dizia "nenhum dos seis modelos está integrado", ficou desatualizado assim que as duas trilhas fecharam; corrigido em N-1-C. Os quatro elegíveis via provedor terceirizado (Groq/Cerebras/SambaNova) continuam fora do app — essa é a trilha **N-2**, sem arquivo ainda (`ROADMAP § 1`).

✅ **Gatilho de revisão já cumprido para o Gemini, ainda aberto para o GLM.** Esta ficha avisava, na pesquisa original: *"antes de integrar a fatia 3, checar se `glm-5.x-flash` ou um `gemini-3.x-flash` têm tier grátis igual ou melhor"* — um resultado de pricing do Gemini já tinha sido indexado sob o título "Gemini 3.6 Flash, 3.5 Flash-Lite & Pro", e a pesquisa não tinha ido a fundo. N-1-C foi essa checagem para o Gemini: a família 3.x existe, tem tier grátis medido (RPD 20–500 a depender do modelo, `notes/nuvem/gemini.md`, 25/08/2026) e substituiu `gemini-2.5-flash` por completo — ver `gemini-3.5-flash-lite`/`gemini-3.7-flash` abaixo. O GLM continua em `glm-4.7-flash`: o sinal de que `GLM-5.2` é o carro-chefe corrente (GLM Coding Plan) não foi reconferido nesta sessão — gatilho de revisão permanece aberto só para esse lado.

---

## Índice

1. [`gemini-3.5-flash-lite`](#gemini-35-flash-lite) (Google)
2. [`gemini-3.7-flash`](#gemini-37-flash) (Google)
3. [`glm-4.7-flash`](#glm-47-flash) (Zai)

**Elegíveis, via provedor terceirizado**

4. [Kimi K2 (via Groq)](#kimi-k2-via-groq)
5. [Qwen3 32B (via Groq)](#qwen3-32b-via-groq)
6. [DeepSeek-V3.2 (via SambaNova)](#deepseek-v32-via-sambanova)
7. [GPT-OSS-120B (via Cerebras)](#gpt-oss-120b-via-cerebras)

---

## Metodologia

Nuvem não tem `/api/show`: não há modelo para baixar, sondar e devolver `model_info`. Todo número aqui vem da documentação oficial de cada provedor, buscada nesta data — e, ao contrário da tabela de KV cache (aritmética fixa sobre um `model_info` real), preço e teto de taxa são **decisão comercial do fornecedor**, que muda sem aviso e sem relação com o hardware de ninguém. A mesma ressalva já registrada no D15.9 vale aqui: *"buscar em runtime traria rede numa camada que a D9.2 mantém pura, e uma resposta de terceiro decidindo um portão de segurança"* — esta tabela é para **escrever o código com o número certo no dia em que a fatia 3 for construída**, não para o app consultar sozinho.

**Legenda de proveniência:** **oficial** (documentação do próprio provedor — `ai.google.dev`, `docs.z.ai`) · **terceiro** (agregador de preços/limites, usado só quando o provedor não publica o número, ou para conferir um número oficial ambíguo) · **medido** (chamada real contra a API, com resposta ou fatura registrada) — as duas fichas do Gemini já têm entradas **medidas** desde N-1-C (RPM/TPM/RPD lidos no console pelo usuário, `thinkingLevel` testado ao vivo contra os dois modelos).

⚠️ **Onde as fontes divergem, as duas ficam registradas** — não se escolhe uma por palpite. Marcado em cada caso abaixo.

---

## Comparativo rápido

Cobre só o trio integrado — os quatro elegíveis via provedor terceirizado têm tabela própria em cada subseção abaixo, não repetida aqui.

| | `gemini-3.5-flash-lite` | `gemini-3.7-flash` | `glm-4.7-flash` |
|---|---|---|---|
| Provedor | Google (AI Studio / Gemini API) | Google (AI Studio / Gemini API) | Z.ai (portal internacional — **não** `open.bigmodel.cn`) |
| Arquitetura | fechada, não publicada | fechada, não publicada | MoE 30B-A3B (31B parâmetros totais), jan/2026, pesos publicados (open-weight) |
| Contexto de entrada | 1.048.576 tokens | 1.048.576 tokens | 200.000 tokens (oficial; terceiros citam 202.752–203.000) |
| Teto de saída | 65.536 tokens | 65.536 tokens | 128.000 tokens (oficial) — terceiros mostram 16.384 como teto de alguns provedores intermediários |
| Modalidades de entrada | texto, imagem, vídeo, áudio, PDF | texto, imagem, vídeo, áudio, PDF | texto |
| `tools` / saída estruturada / `thinking` | sim / sim / sim (`thinkingLevel`, sem `minimal` confirmado como válido para os dois — ver N-1-C) | sim / sim / sim (`thinkingLevel`; `minimal` **rejeitado** por este modelo, medido — usar `low`) | sim / sim / sim (alternável, `enabled`/`disabled`) |
| Tier grátis — teto de taxa | 15 RPM · 250.000 TPM · **500 RPD** | 5 RPM · 250.000 TPM · **20 RPD** | 1 concorrência (sem RPM/TPM/RPD publicados) |
| Tier pago | US$ 0,30 / US$ 2,50 por milhão de tokens (entrada/saída) | US$ 0,30 / US$ 2,50 por milhão de tokens (entrada/saída) | não se aplica ao `-flash` — variantes maiores (`glm-4.7`, `glm-5.3`) são pagas |

---

## `gemini-3.5-flash-lite`

Provedor Google, endpoint `gemini-3.5-flash-lite`. Integrado em N-1-C como o modelo de **uso diário**: 500 RPD sustenta dezenas de conversas por dia (a 1 requisição por pergunta, medido lendo o código — ver `core/ai/models.ts`).

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto de entrada | 1.048.576 tokens | oficial — página de modelo, `ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite` |
| Teto de saída | 65.536 tokens | oficial |
| Modalidades de entrada | texto, imagem, vídeo, áudio, PDF — saída só texto | oficial |
| Capacidades | `tools` (function calling), saída estruturada, `thinking` (`thinkingConfig.thinkingLevel`) | oficial (Context7) |
| Tier grátis — teto de taxa | **15 RPM · 250.000 TPM · 500 RPD** | **medido** — usuário, console do Google AI Studio, 25/08/2026 (`notes/nuvem/gemini.md`) — mais forte que a proveniência "terceiro" que este arquivo usava para a geração 2.5 |

**No app:** o candidato de conversa longa — RPD alto o bastante para não ser o gargalo do dia a dia. `thinkingLevel: 'low'` (não `'minimal'`, ver o adaptador Gemini) é o mais baixo confirmado ao vivo para os dois modelos 3.x integrados; não há um "desligado" real nesta família, diferente do GLM.

---

## `gemini-3.7-flash`

Provedor Google, endpoint `gemini-3.7-flash`. Integrado em N-1-C como o modelo de **raciocínio mais forte** da dupla — 20 RPD, ~4 conversas de 5 perguntas por dia.

| Campo | Valor | Proveniência |
|---|---|---|
| Contexto de entrada | 1.048.576 tokens | oficial — página de modelo, `ai.google.dev/gemini-api/docs/models/gemini-3.7-flash` |
| Teto de saída | 65.536 tokens | oficial |
| Modalidades de entrada | texto, imagem, vídeo, áudio, PDF — saída só texto | oficial |
| Capacidades | `tools`, saída estruturada, `thinking` (`thinkingLevel`: **não aceita `minimal`** — HTTP 400 "Thinking level MINIMAL is not supported for this model", medido em N-1-C; usa `low`, o mesmo nível do `gemini-3.5-flash-lite`) | oficial + medido |
| Tier grátis — teto de taxa | **5 RPM · 250.000 TPM · 20 RPD** | **medido** — usuário, console do Google AI Studio, 25/08/2026 |

**Uso do dado no tier grátis:** prompts do tier grátis **podem ser usados pelo Google para melhorar produtos** (herdado da geração 2.5, não reconferido especificamente para 3.7 nesta sessão). Nota de privacidade relevante porque a fronteira de nível 3 do app é sobre o dado **sair da máquina** — aqui ele sairia para treinamento, não só para inferência.

**No app:** vê imagem — e o [`ESCOPO.md`](../../ESCOPO.md#documento-e-imagem-são-nível-3-por-construção) bloqueia justamente imagem na nuvem, sem exceção. A tensão (Peça D do guia de implementação) é a mesma que a pesquisa original registrava para `gemini-2.5-flash`, agora correta para a família 3.x inteira. **Medido em N-1-C, não suposto:** este modelo especificamente retornou HTTP 503 "high demand" duas vezes e um timeout numa terceira tentativa na mesma sessão em que `gemini-3.5-flash-lite` respondeu de primeira com a chamada idêntica — sinal de disponibilidade mais instável no momento da medição, não um defeito do adaptador (mesmo código, mesmo shape de requisição). Vale checar de novo antes de contar com ele para uma demonstração ao vivo.

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

Buscadas em 20/08/2026 — preço e teto de taxa de provedor de nuvem envelhecem sem aviso; reconferir antes de codificar a fatia 3. As entradas do Gemini abaixo foram **reconferidas em N-1-C (25/08/2026)** contra a família 3.x, que substituiu `gemini-2.5-flash` por completo — mantidas aqui por continuarem descrevendo a plataforma (pricing, rate-limits) mesmo com o modelo trocado.

- [Gemini API — Pricing](https://ai.google.dev/gemini-api/docs/pricing) (oficial)
- [Gemini API — Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) (oficial — sem tabela fixa, direciona ao console)
- [Gemini API — Models (gemini-3.5-flash-lite)](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) (oficial, N-1-C)
- [Gemini API — Models (gemini-3.7-flash)](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash) (oficial, N-1-C)
- [Gemini API — thinking, thinkingLevel](https://ai.google.dev/gemini-api/docs/generate-content/thinking) (oficial, via Context7, N-1-C)
- [GLM-4.7 — Overview](https://docs.z.ai/guides/llm/glm-4.7) (oficial)
- [Z.ai — Pricing](https://docs.z.ai/guides/overview/pricing) (oficial)
- `notes/nuvem/gemini.md` — RPM/TPM/RPD dos oito modelos 2.x/3.x do console Google AI Studio, lidos pelo usuário em 25/08/2026 (**medido**, N-1-C)
- [Z.ai Released GLM-4.7-Flash Weights and API — ToolNavs](https://toolnavs.com/en/article/1100-zai-released-glm-47-flash-weights-and-api-free-tier-1-concurrency-and-launched-f) (terceiro — confirma 1 concorrência)

**Elegíveis (Kimi K2, Qwen3 32B, DeepSeek-V3.2, GPT-OSS-120B):**

- [GroqDocs — modelos, rate limits, changelog](https://console.groq.com/docs/rate-limits) (oficial, via Context7)
- [Cerebras Inference — docs, gpt-oss, pricing](https://inference-docs.cerebras.ai/models/openai-oss) (oficial, via Context7)
- [Introducing gpt-oss — OpenAI](https://openai.com/index/introducing-gpt-oss/) · [gpt-oss-120b & gpt-oss-20b Model Card — OpenAI](https://openai.com/index/gpt-oss-model-card/) (oficial)
- [SambaNova Cloud — planos e dashboard](https://cloud.sambanova.ai/plans) (oficial)
- [DeepSeek-V3.2-Exp — anúncio oficial](https://api-docs.deepseek.com/news/news250929) (oficial — não detalha contagem de parâmetros)
- [DeepSeek-V3.2 (Preview) (SambaNova): Free Limits — ayautomate.com](https://www.ayautomate.com/free-models/sambanova-deepseek-v3-2) (terceiro — RPM/RPD/TPD e contexto)
- Panorama completo de provedores e política de dados: [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md)
