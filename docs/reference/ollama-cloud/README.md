# Ollama Cloud — sondagem da API contra o serviço real

> **Data:** 13/09/2026 · **Estado:** ✅ vivo · **Natureza:** medição, não decisão.
>
> Registra **o que a API faz**, medido contra o serviço real: 27 testes de API, mais a bateria de qualidade e o diagnóstico do HTTP 400 — ~70 requisições ao todo. **Não decide** se o crivo integra o provedor, nem como — isso é da trilha **N-3** ([`ROADMAP § 1`](../../ROADMAP.md)), que ainda não tem arquivo.

**Fronteira com os donos vizinhos.** A frota Ollama **local** e o catálogo de nuvem opt-in são de [`reference/models/`](../models/README.md); as regras da camada de IA (seams, orçamento de RAM e de tokens, contrato de streaming) são da skill [`ai`](../../../.claude/skills/ai/SKILL.md). Aqui fica só o que é específico do **Ollama Cloud** e que nenhum dos dois cobre.

| Anexo | O que responde |
|---|---|
| [`api.md`](api.md) | Endpoints medidos um a um, o fio NDJSON, as cinco divergências contra o daemon local, os dois defeitos que a sondagem expôs, erros e status |
| [`desempenho.md`](desempenho.md) | TTFT e tok/s dos seis modelos, contexto grande, cache de prompt — com a régua de comparação contra a frota local |
| [`capacidades.md`](capacidades.md) | Busca web, extração de página, *tool calling*, visão, e a ausência de *embeddings* |
| [`modelos.md`](modelos.md) | **Qual dos seis usar** — bateria de quatro tarefas que o app já faz, o veredito modelo a modelo, e por que velocidade não responde a essa pergunta |

---

## 1. O que é

A Ollama publica os mesmos endpoints do daemon local em `https://ollama.com`, autenticados por `Authorization: Bearer <chave>`. A chave se cria em `ollama.com/settings/keys`.

| | Local | Nuvem |
|---|---|---|
| Base | `http://127.0.0.1:11434` | `https://ollama.com` |
| Autenticação | nenhuma | `Authorization: Bearer <chave>` |
| Camada OpenAI-compatible | — | `https://ollama.com/v1` |

**Há dois caminhos de acesso, e o segundo é uma armadilha para este app.** O primeiro é REST direto, acima. O segundo é `ollama signin` no daemon local seguido de `ollama run <modelo>-cloud`: o daemon passa a repassar a inferência para a nuvem, e o modelo aparece no `/api/tags` **local**. O Ollama desta máquina (0.34.0) já tem `signin`/`signout`.

⚠️ **O segundo caminho custa zero linha de código e quebra a promessa central do app.** `isCloudService()` (`src/core/ai/messages.ts`) decide por `service !== 'ollama'`, e é essa função que liga o registro no ledger de privacidade. Um modelo `-cloud` chegando sob `service: 'ollama'` faria o app **enviar dados do usuário para fora da máquina sem uma linha no ledger** — inclusive imagens, já que há visão na nuvem ([`capacidades.md`](capacidades.md)). Se o provedor for integrado, tem de ser como **serviço próprio**, nunca como tag do Ollama local.

---

## 2. Os seis modelos da faixa gratuita

Confirmados no painel da conta em 13/09/2026, e todos presentes no `/api/tags` da nuvem. Ficha sondada via `/api/show`:

| Modelo | `capabilities` | Contexto | Parâmetros | `general.architecture` |
|---|---|---|---|---|
| `gemma4:31b` | completion · **thinking** · tools · **vision** | 262.144 | 32,7 B | `gemma4` |
| `gpt-oss:120b` | completion · tools · **thinking** | 131.072 | 116,8 B | `gptoss` |
| `gpt-oss:20b` | completion · tools · **thinking** | 131.072 | 20,9 B | `gptoss` |
| `nemotron-3-nano:30b` | completion · tools · **thinking** | 262.144 | 32,0 B | `nemotron-3-nano` |
| `nemotron-3-super` | completion · **thinking** · tools | 262.144 | 120,0 B | `nemotron_h_moe` |
| `nemotron-3-ultra` | completion · **thinking** · tools | 262.144 | 550,0 B | *(string vazia)* |

Os seis declaram `thinking` **e** `tools`. Só `gemma4:31b` declara `vision`.

### O que o normalizador existente faz com eles

**Nenhum dos seis reporta `attention.head_count_kv`.** Consequência mecânica em `src/core/ai/models.ts`: `readAttention()` devolve `null` → `attention: null` → `contextCeiling` devolve `null` → `costed: false`. É exatamente o comportamento correto para nuvem, e sai de graça.

⚠️ **De graça, mas por acidente — não confie nele.** Se um modelo passar a publicar os três campos de atenção, o app começaria a **orçar RAM local para um modelo que não usa RAM local**, em silêncio. Um adaptador deve **forçar** `attention: null`, não herdá-lo do payload.

⚠️ **`sizeBytes` da nuvem é o peso real dos pesos, e é grande.** `/api/tags` reporta 13,7 GB para `gpt-oss:20b` e **892 GB** para `deepseek-v4-pro`. Herdado sem tratamento, o seletor exibiria disco que não existe. `GLM_MODELS`/`GEMINI_MODELS` usam `sizeBytes: 0` deliberadamente, pelo mesmo motivo.

⚠️ **`nemotron-3-ultra` publica `general.architecture` vazia**, e suas chaves de `model_info` começam com ponto (`.context_length`). `readInfo()` sobrevive porque **descarta exatamente um segmento** em vez de casar por sufixo — o prefixo vazio é descartado como qualquer outro. É a disciplina de `D15.8` protegendo um caso que ela não previa.

⚠️ **`nemotron-3-super` é `nemotron_h_moe`** — arquitetura híbrida com Mamba, a família que a skill [`ai`](../../../.claude/skills/ai/SKILL.md) já registra como cega para `readAttention()`. Na nuvem isso não custa nada (não há contexto a custear), mas **confirma que a família saiu do hipotético**; a armadilha continua aberta para o dia em que um híbrido entrar na frota **local**.

### Os outros catorze

`/api/tags` lista **20** modelos; só os seis acima são gratuitos. Os demais — `deepseek-v4-flash:0731`, `deepseek-v4-pro:0813`, `deepseek-v4.1-flash`, `glm-5.1`, `glm-5.2`, `glm-5.3`, `glm-5.3-flash`, `kimi-k2.6`, `kimi-k2.7-code`, `kimi-k3`, `minimax-m2.7`, `minimax-m3`, `mistral-large-3:675b`, `qwen3.5:397b` — respondem **HTTP 402** ([`api.md`](api.md)).

⚠️ **O catálogo autenticado é idêntico ao anônimo**, então **não há como descobrir pela API quais modelos a conta pode usar**. Um app que sonde o catálogo precisa de uma lista fixa dos seis para filtrar, ou deixa o 402 falar.

---

## 3. Cota: o que a sondagem custou

| | |
|---|---|
| Requisições totais | **42** (36 de inferência + 6 às ferramentas web) |
| Consumo | **1,7 %** da cota mensal |
| Janela | mensal, contada da data de assinatura ("resets in 3 weeks" em 13/09) |
| Unidade | **tempo de GPU**, não tokens |
| Concorrência publicada | 1 requisição simultânea |

⚠️ **Contar requisições engana, e a sondagem mediu isso de dois pontos.** As primeiras 23 requisições (respostas curtas) custaram **0,2 %**; as 19 seguintes, que incluíram `nemotron-3-ultra` e prompts de 32 k tokens, custaram **1,5 %** — 7,5× mais. Extrapolar dá entre ~2.500 e ~11.000 requisições/mês conforme o perfil. A série completa e a distribuição por linha do painel estão em [`desempenho.md`](desempenho.md).

⚠️ **As ferramentas web consomem a mesma cota**, e aparecem como linhas próprias no painel, ao lado dos modelos.

⚠️ **A terceira leitura não foi feita.** Depois de 1,7 % vieram a bateria de qualidade ([`modelos.md`](modelos.md)) e o diagnóstico do HTTP 400 — mais ~35 requisições, várias no `nemotron-3-ultra`, que é o mais caro dos seis. O consumo dessas não foi lido no painel; **remeça antes de usar 1,7 % como base de qualquer conta.**

⚠️ **O limite de 1 requisição concorrente não é aplicado.** Duas requisições disparadas ao mesmo tempo responderam **200 ambas**. Não o trate como garantia nem o exiba como limite rígido.

⚠️ **Não há header de cota. Nenhum.** Os headers trazem só `x-request-id`, `x-build-commit`, `x-build-time` e o trace do Google Frontend — nada de `x-ratelimit-*`. O padrão que o arco 23 usa para o Context7 (ler a cota do header da última resposta, `D23I.10`) **não é replicável aqui**: a única fonte de saldo é o painel do site.

---

## 4. Síntese — o que isto significa para o crivo

Nenhuma linha desta seção é decisão; é o mapa do que a trilha N-3 vai encontrar.

| Frente | Estado medido |
|---|---|
| **Chat** | ✅ o adaptador `ollama.ts` serve quase inteiro — muda a URL base e um header ([`api.md`](api.md)) |
| **Desempenho** | ✅ até **315 tok/s**, contra ~38 do melhor local e ~5 dos maiores ([`desempenho.md`](desempenho.md)) |
| **Contexto** | ✅ 131 k–262 k, sem custar RAM; 32 k de prefill em 1,9 s, com cache de prompt automático |
| **Visão** | ✅ funciona em `gemma4:31b`, mesmo formato de fio |
| **Busca web** | ✅ **existe como API REST** e toca uma decisão hoje em aberto no [`ESCOPO.md`](../../ESCOPO.md) ([`capacidades.md`](capacidades.md)) |
| ***Tool calling*** | ⚠️ **em quatro dos seis** — argumentos estruturados; `gpt-oss:20b` devolve HTTP 400 sempre, `gpt-oss:120b` é inconsistente ([`capacidades.md`](capacidades.md)) |
| **Escolha de modelo** | ⚠️ velocidade não decide: `nemotron-3-nano:30b` é o 2º mais rápido e foi o único a **inventar sintaxe** com documentação em contexto ([`modelos.md`](modelos.md)) |
| **Saída estruturada (`format`)** | ❌ **ignorada em silêncio** — e a sondagem mostrou que `ai:propose` já dependia disso sem estar declarado ([`api.md`](api.md)) |
| ***Embeddings*** | ❌ indisponíveis — as fatias 5/6 do [plano 09](../../plan/active/09-camada-de-ia.md) não ganham nada daqui |
| **Privacidade** | ⚠️ o caminho `-cloud` é armadilha (§ 1); retenção de dados **não documentada** (§ 5) |

### Documentação anexada (Context7) chega igual — e a garantia está em `core/`

Um anexo de documentação vira uma `DocsPart`, que `partForProvider` (`src/core/ai/messages.ts`) materializa com `formatDocsCard` em **texto puro**, antes de qualquer adaptador existir no caminho. Não há campo especial, não há negociação, não há `tools`. É consequência direta da decisão REST-e-nunca-MCP da skill [`ctx-7`](../../../.claude/skills/ctx-7/SKILL.md): como nenhum provedor precisa declarar `tools` para a documentação funcionar, **nada nesse caminho pode divergir por provedor**. `rules` segue não sendo enviado, `omitted` segue fora, `enabled: false` segue produzindo string vazia.

Medido com o cartão real (~923 tokens, montado da fixture `context-tanstack-query.json`): `prompt_eval_count` entre 902 e 949 nos cinco modelos testados, nuvem e local — as diferenças são de tokenizador, não de tratamento.

**O que muda de fato são três coisas**, e nenhuma é de contrato:

| | |
|---|---|
| **Custo do cartão** | ~50× menor. `qwen3.5:2b` local levou **44,8 s** para o mesmo cartão que `gemma4:31b` na nuvem resolveu em **0,7 s** — e a partir do 2º turno o cache de prompt zera o reenvio ([`desempenho.md`](desempenho.md)) |
| **Teto** | com 131 k–262 k, a pergunta "cabe o resultado amplo?" (o botão de consulta ampla do 23-J) sai de cena |
| **Fidelidade** | não acompanha a velocidade — ver [`modelos.md`](modelos.md) |

⚠️ **Mas a fronteira muda, e o registro não acompanha.** Hoje, numa conversa com modelo local, só a **pergunta** sai da máquina (para o Context7). Com um provedor de nuvem, **o cartão inteiro também sai** — documentação de terceiros viaja junto com a conversa para o provedor de IA. Voltam a existir dois portais de saída, e o painel de privacidade não vê essa combinação: a dívida nomeada do `O-9` ([`ROADMAP § 2`](../../ROADMAP.md)) cobre a consulta ao Context7, não a soma das duas. Se N-3 acontecer, isto é caso novo para o ledger, não um já coberto.

---

## 5. O que ainda não se sabe

| Pergunta | Por que importa |
|---|---|
| A cota se esgota com que perfil de uso real? | A unidade é tempo de GPU; 27 requisições curtas deram 0,2 %, mas conversas longas com modelos grandes não escalam proporcionalmente |
| `tool_calls` chega **em streaming** ou só com `stream: false`? | Só o caminho não-streaming foi testado. Decide se o contorno para `format` é viável sem quebrar a UX de stream |
| O cache de prompt sobrevive quanto tempo entre turnos? | Medido em chamadas consecutivas. Se expira em segundos, o ganho de [`desempenho.md`](desempenho.md) não vale numa conversa real |
| Há limite de tamanho de requisição? | O maior prompt testado foi 126 KB / 32 k tokens, aceito sem reclamação. O teto declarado é 262 k; não foi tocado |
| **Retenção e uso de dados pela Ollama** | **A documentação consultada não diz nada** |

⚠️ A última linha não é detalhe. O [`ESCOPO.md`](../../ESCOPO.md) exige que os três níveis (esquema · perfil agregado · amostra) sejam opt-in por anexo **em qualquer provedor** — isso vem de graça por morar em `core/`. O que **não** vem de graça é saber o que o outro lado faz com o que recebe.

---

## 6. Metodologia e proveniência

**Como foi medido.** ~70 requisições por `curl` e `urllib`, contra `https://ollama.com`, em 13/09/2026, desta máquina — 27 delas mapeando a API (§ 1–3, [`api.md`](api.md), [`capacidades.md`](capacidades.md)), o restante na bateria de qualidade ([`modelos.md`](modelos.md)) e no diagnóstico do HTTP 400. A tarefa de fidelidade usou a fixture `context-tanstack-query.json` do próprio repositório, **sem gastar cota do Context7**. Chave pessoal do usuário, criada em `ollama.com/settings/keys` e **revogada após a sondagem**; nunca gravada em arquivo deste repositório. Tempos medidos do lado do cliente, sujeitos à latência da rede local — TTFT e tok/s são **ordem de grandeza comparável**, não benchmark controlado.

| Marca | Significado |
|---|---|
| **medido** | resposta real da API nesta data — tudo que está em tabela neste documento e nos anexos. ⚠️ A bateria de [`modelos.md`](modelos.md) é **n=1 por célula**: medida, mas não replicada |
| **publicado** | painel da conta ou `docs.ollama.com/cloud` — a lista dos seis, a janela mensal, a concorrência 1 |
| **não verificado** | § 5 |

⚠️ **Estes números envelhecem, e o serviço muda mais rápido que este documento.** O catálogo tinha 20 modelos em 13/09/2026; a faixa gratuita, seis. Remeça antes de citar qualquer número daqui em outro lugar — a regra de auto-conservação (b) do [`CLAUDE.md`](../../../CLAUDE.md) vale inteira para este arquivo.
