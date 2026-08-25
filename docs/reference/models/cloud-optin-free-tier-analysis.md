# Provedores de IA em nuvem — panorama de free tiers, modelo de negócio e risco de dado

**Data:** 20/08/2026. **Motivo:** ao pesquisar candidatos de nuvem além dos dois já documentados (`gemini-2.5-flash`, `glm-4.7-flash`), a varredura se ampliou para "todas as grandes e médias empresas da indústria de IA, inclusive as chinesas" e depois para uma pergunta mais funda — qual é a lógica sustentável por trás de oferecer inferência de graça, existe risco de segurança nisso, e quem treina com o dado enviado. Este documento registra esse levantamento **na íntegra**, mesmo sem virar referência direta de desenvolvimento agora — é conhecimento caro de reconstruir (dúzias de buscas, políticas de privacidade lidas uma a uma) e barato de perder se não escrito.

**Isto não é o dono da ficha técnica dos candidatos.** Os três modelos integrados ao app (`gemini-3.5-flash-lite`, `gemini-3.7-flash`, `glm-4.7-flash`) e os quatro elegíveis via provedor terceirizado continuam em [`cloud-optin.md`](cloud-optin.md) — este arquivo é o panorama que explica *por trás* daquelas fichas, não substitui nenhuma. Mapa da pasta: [`README.md`](README.md).

---

## Índice

1. [A lógica financeira-sustentável dos free tiers](#1-a-lógica-financeira-sustentável-dos-free-tiers)
2. [APIs diretas das fabricantes — panorama](#2-apis-diretas-das-fabricantes--panorama)
3. [Provedores de inferência terceirizados — panorama](#3-provedores-de-inferência-terceirizados--panorama)
4. [Coleta de dados: quem treina com seu prompt](#4-coleta-de-dados-quem-treina-com-seu-prompt)
5. [Risco de segurança específico para o crivo](#5-risco-de-segurança-específico-para-o-crivo)
6. [Fontes](#6-fontes)

---

## 1. A lógica financeira-sustentável dos free tiers

Nenhum desses tiers grátis existe por filantropia — cada categoria de empresa tem um motivo estrutural diferente, e o motivo prevê o comportamento melhor do que o marketing de cada uma.

**Groq, Cerebras e SambaNova são fabricantes de chip, não empresas de modelo.** O produto que sustenta cada uma é o silício de inferência — o LPU da Groq, o wafer-scale engine da Cerebras, o RDU da SambaNova — vendido ou alugado para empresas, governos e provedores de nuvem. A API pública, grátis ou barata, é uma **vitrine de velocidade**: a alegação central de cada uma é "nosso chip é dramaticamente mais rápido que GPU para inferência", e a forma mais barata e convincente de provar isso é deixar qualquer desenvolvedor sentir a diferença na prática, sem fricção de cartão de crédito. O tier grátis é geração de demanda e prova de conceito viva para o hardware — não o produto em si. A Groq, inclusive, fechou em dez/2025 um licenciamento não-exclusivo de ~US$20 bilhões da arquitetura do LPU com a própria NVIDIA, o que deixa claro que o negócio real é a propriedade intelectual do chip, não as chamadas de API.

**A NVIDIA persegue dois objetivos ao mesmo tempo, e isso muda o cálculo.** Ela também vende hardware (é a maior fornecedora de GPU do mundo), mas está construindo agressivamente um segundo pilar de receita em software/IA corporativa (CUDA, NIM, AI Enterprise). O tier grátis do `build.nvidia.com` funciona como funil para esse ecossistema — **e também**, de forma explícita na própria política de privacidade (seção 4), como fonte de dado de treino para os modelos proprietários da própria NVIDIA. É uma motivação dupla que nenhum dos três fabricantes de chip de inferência pura tem.

**O OpenRouter não fabrica nada — é um roteador/marketplace.** A receita vem de uma margem sobre o tráfego **pago** que passa pela plataforma, mais provável arranjo comercial com provedores que quer distribuição para o público de desenvolvedores que o OpenRouter já tem. Os modelos gratuitos são, pela própria definição do serviço, uma **troca explícita**: acesso sem custo em troca do prompt do usuário servir de treino para o provedor por trás daquele modelo específico — é assim que aquele provedor "paga" a capacidade de servir de graça, e é assim que o OpenRouter ganha tráfego que fortalece sua posição de mercado.

**Os laboratórios de modelo (Google, Z.ai, Mistral, Alibaba, DeepSeek, Moonshot) têm uma lógica diferente das três anteriores**, mais parecida com aquisição de usuário clássica de produto de consumo/desenvolvedor: o tier grátis (quando existe, e existe cada vez menos de forma recorrente — ver seção 2) serve para gerar adoção da própria marca de modelo, criar dependência de ecossistema (SDK, ferramentas, comunidade) e, no caso dos tiers que **admitem treinar com o dado do usuário** (Gemini incluso — já registrado em `cloud-optin.md`), também alimentar a próxima geração do próprio modelo. É a mesma lógica do "se o produto é grátis, o produto é você" aplicada a inferência.

---

## 2. APIs diretas das fabricantes — panorama

Pesquisado em 20/08/2026. Cobre grandes e médias empresas ocidentais e chinesas, além das duas já com ficha completa em `cloud-optin.md`.

| Provedor | Tier grátis recorrente? | Detalhe |
|---|---|---|
| **Google (Gemini)** | ✅ — ver [`cloud-optin.md`](cloud-optin.md#gemini-35-flash-lite) | O mais generoso desta categoria — `gemini-3.5-flash-lite`/`gemini-3.7-flash`, 1M de contexto |
| **Z.ai (GLM)** | ✅ — ver [`cloud-optin.md`](cloud-optin.md#glm-47-flash) | `glm-4.7-flash` completamente grátis, mas 1 concorrência |
| **Mistral AI** | ⚠️ parcial | Tier "Experiment" com cap de ~1B tokens/mês, mas explicitamente "para avaliação, não produção"; rate limits exatos não publicados publicamente (só no console) |
| **Alibaba Qwen (DashScope)** | ❌ enfraqueceu | O tier grátis recorrente **foi descontinuado em abr/2026**. Hoje é só uma cota de 90 dias, 1M tokens por modelo, restrita ao endpoint de Singapura — o endpoint chinês (Pequim) não tem cota grátis nenhuma |
| **DeepSeek** | ❌ | Bônus único de 5M tokens no cadastro (sem cartão), sem reposição — depois disso é 100% pago |
| **Kimi (Moonshot AI)** | ❌ | Sem tier grátis de API — só o chat web (`kimi.com`) é grátis; a API exige recarga mínima de US$1 |
| **xAI (Grok)** | ❌ | US$25 de crédito único no cadastro + até US$150/mês **trocando dado do usuário** por crédito adicional (programa de compartilhamento de dado) — não é "grátis", é uma troca explícita |
| **OpenAI** | ❌, instável | Relatos conflitantes — alguns dizem que ainda existe crédito automático de US$5, outros que foi descontinuado em meados de 2025. Sem tier permanente confirmado |
| **Anthropic** | ❌ | ~US$5 de crédito único no cadastro, sem cartão. Programas maiores existem (Claude for Open Source, Startup Program), mas exigem qualificação, não é acesso padrão |
| **Baidu (ERNIE)** | ✅ tecnicamente, ⚠️ inacessível | `ERNIE-Speed-8K`/`ERNIE-Lite-8K` são descritos como "permanentemente grátis, sem limite de tokens" (limitado por QPS, 50 req/s) — mas o acesso internacional é muito restrito: a maioria não consegue nem se cadastrar sem telefone da China continental, e a documentação é majoritariamente em chinês |
| **MiniMax** | ❌ | Só créditos promocionais de cadastro; sem tier grátis recorrente para os modelos de texto |
| **01.AI (Yi)** | ❓ incerto | Pesquisa de jun/2026 não achou tier grátis atual documentado; referências a um antigo "Yi-Light" grátis não aparecem mais no catálogo oficial — status pouco claro, não confirmado como ativo |

**A síntese que motivou a seção 3:** nenhum dos grandes laboratórios chineses (Qwen, DeepSeek, Kimi) tem hoje um tier grátis recorrente e generoso na própria API. O acesso grátis a esses modelos, quando existe, vem de terceiros que hospedam o peso aberto — o que é exatamente o caso de DeepSeek, Qwen e Kimi K2 nas fichas da seção seguinte.

---

## 3. Provedores de inferência terceirizados — panorama

Estes não são fabricantes de modelo — hospedam pesos abertos (de qualquer origem, incluindo os laboratórios chineses da seção 2) na própria infraestrutura de chip.

| Provedor | Tier grátis | Rate limits (grátis) | Modelos relevantes hospedados |
|---|---|---|---|
| **Groq** | Recorrente, sem cartão | 30 RPM / 6.000 TPM / 14.400 req/dia — limite de organização, compartilhado entre todos os modelos | Llama, Mistral Saba, **Qwen 3, Kimi K2**, GPT-OSS |
| **Cerebras** | Recorrente, sem cartão | 30 RPM / 60.000 TPM de entrada / 1.000.000 tokens/dia — confirmado via documentação oficial (Context7), contexto de 65k no grátis (131k no pago) | GPT-OSS-120B, GLM-4.7, Gemma |
| **SambaNova Cloud** | "Forever free", sem cartão | **20 RPM / 20 req/dia / 200.000 tokens/dia** — bem mais restrito em requisições/dia que Groq ou Cerebras, apesar do rótulo "forever free" | **DeepSeek**, Llama, Gemma |
| **NVIDIA NIM** (`build.nvidia.com`) | Sem cartão, sem expiração clara (rate-limit, não crédito) | 40 RPM | 100+ modelos: **DeepSeek, Qwen**, Llama, Mistral, Nemotron — mas ver seção 4, é o único desta lista que treina com o dado |
| **OpenRouter** | ~25-29 modelos grátis, lista **instável** (muda constantemente) | ~20 RPM / 200 req/dia típico | Variado — hoje **nenhum** modelo DeepSeek, Mistral ou Gemini está grátis lá, ao contrário do que guias desatualizados ainda repetem |

⚠️ **"Forever free" não é sinônimo de generoso.** A SambaNova anuncia o tier como permanente, mas 20 requisições por dia é o limite mais apertado desta tabela — mais restrito até que o Gemini free tier (250-500 RPD) documentado em `cloud-optin.md`. Rótulo de marketing e generosidade de cota são eixos independentes.

---

## 4. Coleta de dados: quem treina com seu prompt

A pergunta que decide se um destes provedores é sequer cogitável para um app que leva privacidade a sério, verificada política por política, não por marketing.

| Provedor | Treina com seu prompt? | Retenção | Fonte |
|---|---|---|---|
| **Groq** | **Não** — proibido por política de serviço, regra idêntica para tier grátis e pago | Sem retenção permanente por padrão; logs de erro/abuso retidos até 30 dias | `console.groq.com/docs/your-data`, `groq.com/privacy-policy` |
| **Cerebras** | **Não** | Sem retenção — política declara que dado, modelo e saída "nunca são armazenados, logados ou reusados" | `cerebras.ai/privacy-policy`, `cloud.cerebras.ai/privacy` |
| **SambaNova** | **Não**, segundo política publicada | "SambaCloud nunca vê ou coleta prompts do usuário" — a própria comunidade oficial recomenda reconferir termos por conta/tier, prática saudável de se levar a sério | `sambanova.ai/privacy-policy`, fórum oficial da comunidade |
| **NVIDIA NIM** (tier grátis) | **⚠️ Sim, explicitamente** | Todo input/output do tier grátis é registrado e usado para treinar e melhorar os modelos proprietários da NVIDIA — o próprio texto da política avisa para **não enviar nada confidencial** | Política de privacidade da NVIDIA, citada em análises de terceiros |
| **OpenRouter** (modelos `:free`) | **Depende — mas o padrão é treinar** | A troca padrão dos modelos `:free` é acesso grátis por dado de treino do provedor por trás do modelo. Existe *toggle* de Zero Data Retention (ZDR) e configuração separada para free/pago — mas isso é opt-out manual, não o padrão | `openrouter.ai/privacy`, `openrouter.ai/docs/guides/privacy/provider-logging` |

**A NVIDIA quebra o padrão dos outros três fabricantes de chip de um jeito que importa.** Groq, Cerebras e SambaNova não precisam do dado do usuário — o negócio deles é silício, e treinar custaria risco regulatório sem benefício de receita. A NVIDIA está numa posição diferente: constrói um pilar de software/IA próprio (Nemotron, NIM), e o tier grátis parece financiar isso também com dado, não só com marketing de velocidade.

---

## 5. Risco de segurança específico para o crivo

Duas camadas, e a segunda é a que a maioria dos comparativos de free tier não menciona.

**Camada 1 — a regra que o `ESCOPO.md` já tem não muda com o provedor.** Desde a revisão de escopo (5ª, ago/2026), o nível 3 (documento/imagem, conteúdo integral) é opt-in em qualquer provedor, sem bloqueio adicional na nuvem — a escolha do que sai da máquina é do usuário, não do app julgando por ele. Isso vale igual para qualquer um destes provedores, exatamente como já vale hoje para `gemini-3.5-flash-lite`/`gemini-3.7-flash`/`glm-4.7-flash`. Trocar de provedor não move essa fronteira — ela é do usuário, não do app.

**Camada 2 — usar um provedor terceirizado significa confiar em duas partes, não uma.** Com Gemini ou GLM, o mesmo fabricante responde pelo dado *e* pelo modelo — uma única cadeia de responsabilidade. Com, por exemplo, DeepSeek rodando na infraestrutura da SambaNova, o usuário confia na SambaNova para o tratamento do dado (política verificada: não coleta) **e**, separadamente, confia no que a DeepSeek colocou dentro do próprio modelo — proveniência dos dados de treino, viés, escolhas de ajuste de segurança — sem que a política de dado do hospedeiro diga qualquer coisa sobre isso. São duas responsabilidades diferentes, empilhadas uma sobre a outra, e a política de privacidade de quem hospeda nunca cobre a segunda.

**Consequência prática, não uma regra nova:** Groq, Cerebras e SambaNova têm política de dado defensável para o padrão que o crivo já usa (nível 1/2, nunca a linha) — o NVIDIA NIM, no tier grátis, é candidato a exclusão direta pelo próprio aviso da política deles. OpenRouter só entraria com o *toggle* de ZDR ligado manualmente, nunca no padrão da conta. Nenhuma destas observações é uma decisão de arquitetura tomada — é o material bruto para quando a fatia 3 do [plano de IA](../../plan/active/09-camada-de-ia.md) tirar isso do papel.

---

## 6. Fontes

Buscadas em 20/08/2026 — preço, cota e política de dado de provedor de nuvem envelhecem sem aviso; reconferir antes de decidir qualquer coisa a partir daqui.

**Modelo de negócio e generalidades:**
- [Groq's Business Model, Part 1: Inference API — Chipstrat](https://www.chipstrat.com/p/groqs-business-model-part-1-inference)
- [Groq revenue, valuation & funding — Sacra](https://sacra.com/c/groq/)

**Política de dados (fonte oficial de cada provedor):**
- [Groq — Your Data in GroqCloud](https://console.groq.com/docs/your-data) · [Groq Privacy Policy](https://groq.com/privacy-policy)
- [Cerebras Systems Privacy Policy](https://www.cerebras.ai/privacy-policy) · [Cerebras Cloud Privacy](https://cloud.cerebras.ai/privacy)
- [SambaNova Privacy Policy](https://sambanova.ai/privacy-policy) · [Comunidade SambaNova — privacidade no developer tier](https://community.sambanova.ai/t/privacy-data-use-in-developer-tier/899)
- [NVIDIA NIM: Free AI Model APIs (With a Major Privacy Catch) — Stork.AI](https://www.stork.ai/blog/nvidias-free-ai-the-hidden-cost)
- [OpenRouter Privacy Policy](https://openrouter.ai/privacy) · [OpenRouter — Provider Logging / Data Retention](https://openrouter.ai/docs/guides/privacy/provider-logging)

**Pricing e free tier, por provedor:**
- [Mistral AI Free Tier — PricePerToken](https://pricepertoken.com/endpoints/mistral/free)
- [DashScope Qwen API Pricing 2026 — yangmao.ai](https://yangmao.ai/en/providers/qwen/)
- [DeepSeek API Pricing July 2026 — NxCode](https://www.nxcode.io/resources/news/deepseek-api-pricing-complete-guide-2026)
- [Kimi K2.5 Pricing 2026 — NxCode](https://www.nxcode.io/resources/news/kimi-k2-5-pricing-plans-api-costs-2026)
- [xAI Grok API Pricing 2026 — AI Free API](https://www.aifreeapi.com/en/posts/xai-grok-api-pricing)
- [OpenAI Free Credits 2026 — Dmytro Klymentiev](https://klymentiev.com/blog/openai-free-credits)
- [Claude Free Credits 2026 — Dmytro Klymentiev](https://klymentiev.com/blog/claude-free-credits)
- [Baidu Qianfan API — Permanently Free — GetFreeAI](https://getfreeai.net/en/services/api/baidu/)
- [MiniMax M2.7 API Pricing 2026 — ofox.ai](https://ofox.ai/blog/minimax-m2-api-pricing-comparison-2026/)
- [Groq API Free Tier Limits 2026 — Grizzly Peak Software](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb)
- [Cerebras Inference — documentação oficial (Context7 / inference-docs.cerebras.ai)](https://inference-docs.cerebras.ai/models/openai-oss)
- [SambaNova Cloud Developer Tier Is Live! — SambaNova Blog](https://sambanova.ai/blog/sambanova-cloud-developer-tier-is-live)
- [DeepSeek-V3.2 (Preview) (SambaNova): Free Limits — ayautomate.com](https://www.ayautomate.com/free-models/sambanova-deepseek-v3-2)
- [NVIDIA Build Free API 2026 — yangmao.ai](https://yangmao.ai/en/providers/nvidia-build/)
- [Together AI Free Credits 2026 — Get AI Perks](https://www.getaiperks.com/en/ai/together-ai-free-credits-2026)
- [OpenRouter Free Models 2026 — TeamDay](https://www.teamday.ai/blog/best-free-ai-models-openrouter-2026)
