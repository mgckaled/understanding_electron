# Ollama Cloud — a API, endpoint a endpoint

> Anexo de [`README.md`](README.md). Tudo aqui é **medido** contra `https://ollama.com` em 13/09/2026. Contexto, fronteira e metodologia estão no README.

---

## 1. Endpoints

| Endpoint | Sem chave | Com chave | Observação |
|---|---|---|---|
| `GET /api/tags` | **200** | 200 | Resposta **idêntica** nos dois casos: 20 modelos. Não informa quais são gratuitos |
| `POST /api/show` | **200** | 200 | Traz `capabilities` e `model_info` completos |
| `GET /api/version` | 200 | 200 | Devolve `{"version":"0.0.0"}` **com ou sem chave** |
| `POST /api/chat` | — | 200 | NDJSON idêntico ao local (§ 2) |
| `POST /api/embed` | — | **401** | `{"error": "unauthorized"}` — indisponível |
| `GET /api/ps` | — | **401** | `{"error": "unauthorized"}` |
| `POST /api/web_search` | — | 200 | [`capacidades.md`](capacidades.md) |
| `POST /api/web_fetch` | — | 200 | [`capacidades.md`](capacidades.md) |

⚠️ **O catálogo é público — e isso é uma vantagem real.** `/api/tags` e `/api/show` respondem sem credencial nenhuma, então um `ModelsFn` para este provedor poderia ser **sondado**, com `capabilities` e teto de contexto **medidos**, em vez de escrito à mão como `GLM_MODELS`/`GEMINI_MODELS` (`src/core/ai/models.ts`) são hoje por não haver o que sondar. Seria o primeiro provedor de nuvem do app com catálogo real.

⚠️ **Mas `/api/version` responder 200 sem chave desqualifica o ping como prova de credencial.** A régua da skill [`ai`](../../../.claude/skills/ai/SKILL.md) — *"disponível" significa "há chave guardada", nunca um ping* — vale aqui **apesar** de o ping ser tecnicamente possível, e não por ele ser impossível como em Gemini/GLM.

---

## 2. O fio: o que o adaptador existente já cobre

`src/main/features/ai/providers/ollama.ts` foi escrito contra o daemon local. Medido contra a nuvem, **o parser serve sem uma linha de mudança**:

| Item | Nuvem |
|---|---|
| Transporte | NDJSON, um objeto por linha — idêntico |
| `message.thinking` | campo **irmão** de `content`, streamado antes dele — idêntico |
| `message.content` | idêntico |
| Linha final | `done: true` + `done_reason` — idêntico |
| `prompt_eval_count` / `eval_count` | **presentes** e corretos |
| Papel `system` dentro de `messages` | **funciona** |
| Campo `images` (base64) | **funciona** |
| `options.num_thread` / `options.num_ctx` | **aceitos sem erro** (e ignorados) |

O que muda para falar com a nuvem: a URL base e um header. Nada mais no caminho de chat. Um adaptador de nuvem deve **parametrizar** `ollama.ts` por host e headers, não duplicar as 272 linhas dele.

Amostra real do stream (`gpt-oss:20b`, `think: true`, 513 linhas):

```
{"model":"gpt-oss:20b","message":{"role":"assistant","content":"","thinking":"The"},"done":false}
{"model":"gpt-oss:20b","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop",
 "total_duration":5616542785,"prompt_eval_count":72,"eval_count":521}
```

---

## 3. As cinco divergências contra o daemon local

| # | Divergência | Consequência |
|---|---|---|
| **1** | **`format` é ignorado** — JSON Schema e `"json"`, em `/api/chat` **e** em `/v1/chat/completions` com `response_format: {type:"json_schema", strict:true}`. HTTP 200, resposta em markdown livre | § 4.1 |
| **2** | **`think: false` é ignorado pela família `gpt-oss`** | § 4.2 |
| **3** | **Faltam as durações nativas.** Só `total_duration`; sem `load_duration`, `prompt_eval_duration`, `eval_duration` | `nativeDurations()` devolveria `{}`. O painel Desempenho degrada (todos os campos são opcionais). `total_duration` — que a nuvem manda e o app hoje não lê — é o substituto natural |
| **4** | **`options.num_ctx` é ignorado.** `num_ctx: 256` com prompt de 1.508 tokens: `prompt_eval_count` voltou **1.508** inteiro | Confirma que `costed: false` já é o tratamento certo. E há um **ganho de segurança**: não existe aqui o descarte silencioso do começo do prompt que o Ollama local faz — a nuvem usa o contexto nativo do modelo |
| **5** | **`/api/ps` responde 401** | `LoadedFn` devolve lista vazia e `UnloadFn` é no-op, como nos demais provedores de nuvem. Resposta verdadeira, não recurso faltando |

Corolário de (4): **`done_reason: 'length'` nunca ocorrerá por janela cheia neste provedor**, porque não há janela a encher. (`options.num_predict` **é** respeitado e produz `'length'` — mas o app nunca o envia.) O motivo de parada `'context-exhausted'` fica inalcançável aqui.

---

## 4. Os dois defeitos que a sondagem expôs

### 4.1 `format` não existe na nuvem — e `ai:propose` já dependia disso em silêncio

Testado em quatro modelos e nas três formas possíveis. **Todos** devolveram prosa em markdown com HTTP 200:

| Caminho | Modelos | Resultado |
|---|---|---|
| `/api/chat` + `format: {JSON Schema}` | `gpt-oss:20b`, `gpt-oss:120b`, `gemma4:31b`, `nemotron-3-nano:30b` | markdown livre nos quatro |
| `/api/chat` + `format: "json"` | `gpt-oss:20b`, `gemma4:31b` | markdown livre |
| `/v1/chat/completions` + `response_format: json_schema` (`strict: true`) | `gpt-oss:20b` | markdown livre |

Não há erro, não há aviso, não há campo. Uma resposta que o `JSON.parse` de `core/ai/proposal.ts` rejeita, caindo em `invalidProposal` — que **não lança**, por decisão (`D19.5`). O app degrada em vez de quebrar, exatamente como projetado.

⚠️ **Mas a sondagem revelou algo sobre o código atual, não sobre a nuvem:** `grep format` em `providers/gemini.ts` e `providers/glm.ts` devolve **zero linhas**. Nenhum dos dois adaptadores de nuvem implementa `format` — os dois descartam a opção em silêncio, e `register-all.ts` entrega `resolveProvider(args.service).chat` ao `aiPropose` para **qualquer** serviço. Ou seja: **`ai:propose` já é efetivamente só-Ollama-local hoje**, e isso não está declarado em lugar nenhum. O Ollama Cloud não introduz o problema — entra no mesmo balde e o torna visível.

✅ **Há um contorno, e ele funciona:** ***tool calling* funciona na nuvem** ([`capacidades.md`](capacidades.md)). Uma "ferramenta" cujo schema de parâmetros seja o schema do passo devolve `arguments` já estruturado, sem `format`. Não é o desenho atual, e avaliá-lo é trabalho de plano — mas a porta não está fechada.

### 4.2 `think: false` ignorado pelo `gpt-oss` vira raciocínio não pedido, persistido

| Modelo | `think: false` |
|---|---|
| `gpt-oss:20b` | **vazou** (209 chars de `thinking`) |
| `gpt-oss:120b` | **vazou** (130 chars) |
| `gemma4:31b` | respeitou |
| `nemotron-3-nano:30b` | respeitou |
| `nemotron-3-super` | respeitou |

Por que isso é defeito do app, e não só do modelo: `ollama.ts` acumula `reasoningAssembled += thinkingPiece` **incondicionalmente**, sem guarda por `onThinking`; e `useConversationChat.ts` monta uma `ReasoningPart` sempre que `reply.reasoning !== undefined`, **sem gate por `wantsReasoning`**. Com `gpt-oss`, o raciocínio apareceria na conversa e seria **persistido** com o botão de raciocínio desligado.

⚠️ **Nenhum modelo da frota local ignora `think: false`, e por isso o defeito nunca se manifestou.** É latente no código de hoje, e vale corrigir independentemente de este provedor ser integrado: a guarda é uma condição no adaptador.

⚠️ **E o mesmo defeito tem um segundo custo, financeiro.** A cota é tempo de GPU, e o raciocínio não desligável faz a família `gpt-oss` gerar **7× mais tokens** para a mesma resposta: 332 tokens onde `gemma4:31b` gasta 48, e **1.372** numa pergunta trivial sem `tools`. A tabela completa está em [`modelos.md`](modelos.md) § 4. Privacidade e custo saem da mesma raiz.

---

## 5. Erros e status

| Situação | Status | Corpo |
|---|---|---|
| Chave inválida | **401** | `{"error":"Unauthorized"}` |
| Endpoint não liberado (`/api/embed`, `/api/ps`) | **401** | `{"error": "unauthorized"}` |
| Modelo fora da faixa gratuita | **402** | `{"error":"this model requires a subscription or usage credits, upgrade for access at https://ollama.com/upgrade or add usage credits at https://ollama.com/settings (ref: <uuid>)"}` |
| **`gpt-oss:20b` com `tools`** | **400** | `{"error":"prompt too long; exceeded max context length by 17 tokens (ref: <uuid>)"}` — **bug do serviço**, ver abaixo |

⚠️ **O 400 mente sobre a causa, e é o erro mais perigoso desta lista** porque a mensagem é plausível. Os "17 tokens" **não mudam**: mesma resposta com prompt de 83 tokens, com +400, com +2.000, e com `num_ctx: 32768` explícito. Sem `tools`, o mesmo modelo responde normalmente (`prompt_eval_count: 83`). Um modelo que declara 131.072 de contexto recusando 83 tokens não está estourando contexto nenhum. Quem ler a mensagem ao pé da letra vai caçar um problema de orçamento de janela que não existe — detalhe e tabela por modelo em [`capacidades.md`](capacidades.md).

Os três primeiros já são tratados **sem mudança** por `describeUpstreamError` (`src/core/ai/upstreamError.ts`): 401 tem dica específica por status; 402 cai em `messageFromBody`, que lê a forma `{"error": "..."}` do Ollama e trunca em 200 caracteres — produzindo uma mensagem acionável, com a URL de upgrade. É o caso que a docstring daquele arquivo chama de *provider-agnostic* funcionando como previsto, contra um status que ninguém tinha em mente quando ele foi escrito.
