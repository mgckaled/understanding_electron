# Ollama Cloud — capacidades além do chat

> Anexo de [`README.md`](README.md). Tudo aqui é **medido** contra `https://ollama.com` em 13/09/2026.
> ⛔ **Consumido em 14/09/2026** — leitura histórica. Donos vivos: skill [`ai`](../../../.claude/skills/ai/SKILL.md) (regra) e [`reference/models/cloud-optin.md`](../models/cloud-optin.md) (ficha). Ver [`README.md`](README.md).

---

## 1. Busca web e extração de página

Dois endpoints que **não existem no daemon local**, autenticados pela mesma chave.

### `POST /api/web_search`

```
→ {"query": "...", "max_results": 3}
← {"results": [{"title": "...", "url": "...", "content": "..."}]}
```

O `content` é o texto principal **já extraído em markdown**, não HTML bruto. `max_results` é respeitado e é o único botão de custo:

| `max_results` | Resultados | Conteúdo total | ~tokens (a 3,8 ch/tk) |
|---:|---:|---:|---:|
| 3 | 3 | 26.464 chars | ~6.964 |
| 1 | 1 | 7.929 chars | ~2.086 |

Ou seja: **~2.100 tokens por resultado**, e o peso escala linearmente com `max_results`.

### `POST /api/web_fetch`

```
→ {"url": "https://..."}
← {"title": "...", "content": "...", "links": ["https://...", ...]}
```

Também em markdown, com os links da página extraídos à parte. Medido contra `docs.ollama.com/cloud`: `content` de 5.914 chars (~1.556 tokens).

### Por que isto importa aqui

⚠️ **Toca uma decisão registrada como em aberto.** O [`ESCOPO.md`](../../ESCOPO.md) define **busca web** como pilar próprio — *"uma URL vira contexto da resposta: o app busca e extrai o texto principal"* — e afirma explicitamente que **quem executa a busca, o app ou um servidor MCP, é decisão em aberto**. O material de entrada do pilar é [`reference/web-fetch-mcp-thinking/README.md`](../web-fetch-mcp-thinking/README.md), cuja premissa comum (*tool calling* como espinha dorsal) já foi derrubada duas vezes — pelo arco 21 e pelo arco 23.

A API acima é um **terceiro candidato, medido**: REST, mesma chave, conteúdo já extraído — a mesma forma que o arco 23 escolheu para o Context7 (`DM-0`), e pelo mesmo tipo de argumento.

Ordem de grandeza para comparar: o `ESCOPO.md` registra que uma resposta REST inteira do Context7 custa **352–1.244 tokens**, contra 2.060 só para *definir* as duas ferramentas MCP. Um resultado de busca web custa **~2.100 tokens** — mesma ordem.

⚠️ **Duas ressalvas antes de tratar isto como solução do pilar:**

1. **Consome a mesma cota.** O painel da conta lista `web search` e `web fetch` como linhas próprias, ao lado dos modelos — confirmando o texto do painel de que *capabilities such as web search draw from your included usage*. Não é um serviço à parte com orçamento próprio.
2. **Amarra o pilar a um provedor de IA.** Busca web passaria a exigir chave da Ollama, mesmo numa conversa com modelo local — o mesmo tipo de acoplamento que o arco 23 aceitou conscientemente para o Context7 (*a pergunta sai da máquina mesmo em conversa local*, skill [`ctx-7`](../../../.claude/skills/ctx-7/SKILL.md)), e que ali virou decisão registrada, não efeito colateral.

**Este documento não decide nada sobre o pilar.** Registra que a capacidade existe, funciona e custa isto.

---

## 2. *Tool calling* — funciona

`gpt-oss:120b`, com uma ferramenta declarada em `tools`, perguntado pela temperatura em Recife:

```json
{"id": "call_ivsynq4l", "function": {"index": 0, "name": "get_weather", "arguments": {"city": "Recife"}}}
```

Argumentos já **estruturados** — objeto, não string a reparsear. Os seis modelos gratuitos declaram `tools`.

⚠️ **Mas "declara `tools`" não é "aciona a ferramenta", e dois dos seis falham.** Medido com o mesmo prompt curto e a mesma ferramenta:

| Modelo | Com `tools` |
|---|---|
| `gemma4:31b` | ✅ aciona (`prompt_eval` 121) |
| `nemotron-3-nano:30b` | ✅ aciona (`prompt_eval` 354) |
| `nemotron-3-super` | ✅ aciona (`prompt_eval` 354) |
| `nemotron-3-ultra` | ✅ aciona |
| `gpt-oss:120b` | ⚠️ **inconsistente** — acionou com o pedido acompanhado do esquema da tabela, respondeu em texto com o pedido curto |
| `gpt-oss:20b` | ❌ **HTTP 400 sempre** |

⚠️ **O 400 do `gpt-oss:20b` é bug do serviço, não limite de contexto.** A mensagem é `prompt too long; exceeded max context length by 17 tokens` — e os **17 tokens não mudam**: mesma resposta com prompt de 83 tokens, com +400, com +2.000, e com `num_ctx: 32768` explícito. **Sem** `tools` o mesmo modelo responde normalmente. Um modelo que declara 131.072 de contexto recusando 83 tokens é defeito do lado de lá; o efeito prático é que `gpt-oss:20b` **não serve** para nenhum caminho baseado em ferramenta.

⚠️ **Os `nemotron` gastam ~3× mais tokens de prompt** que o `gemma4:31b` para a mesma ferramenta (354 contra 121) — o template de chat deles é mais verboso. Numa cota medida em tempo de GPU, isso conta.

**É o contorno para a ausência de `format`** ([`api.md`](api.md) § 4.1): uma ferramenta cujo schema de parâmetros seja o schema do passo entrega saída estruturada por outro caminho — mas só nos quatro modelos que acionam de fato.

✅ **A pergunta em aberto sobre streaming fechou no refinamento de 13/09/2026.** Só o modo `stream: false` tinha sido sondado; a documentação do Ollama responde o resto (`docs/capabilities/streaming.mdx` e `tool-calling.mdx`, este último com exemplo em JS):

- `tool_calls` **chega em streaming**, em `message.tool_calls` dentro de um chunk com `done: false`;
- o array chega **completo num chunk**, e `arguments` já é **objeto** — não são deltas de string a remontar, ao contrário do formato OpenAI;
- o padrão documentado é acumular `thinking`, `content` e `tool_calls` do stream e devolvê-los na mensagem do assistente no turno seguinte.

⚠️ **Medido no local, não contra a nuvem** — mas o fio NDJSON da nuvem é idêntico ao local em todos os campos sondados ([`api.md`](api.md) § 2), então a forma vale até que alguém meça o contrário. **A UX de stream do app deixa de ser objeção ao contorno** — o que ficou no caminho foi a decisão `DNC-19`, que escolheu o gate em vez do contorno, e não uma limitação técnica.

---

## 3. Visão — funciona

`gemma4:31b`, campo `images` com um PNG 16×16 vermelho em base64, perguntado que cor predomina: respondeu **"Vermelho"**, com `prompt_eval_count: 281`.

Mesmo formato de fio do Ollama local (`ChatMessage.images`, `D17.5`), então `toChatMessagesWithImages` serve sem alteração.

✅ **E o `IMAGE_TOKEN_ESTIMATE` do app não precisa mudar.** A ficha de `ollama.com/library/gemma4:31b-cloud` publica resolução variável com orçamentos de **70, 140, 280, 560 ou 1120** tokens por imagem. O `prompt_eval_count: 281` medido acima encaixa no degrau de **280** — e o app estima **270** (`IMAGE_TOKEN_ESTIMATE`, skill [`ai`](../../../.claude/skills/ai/SKILL.md)), medido no `gemma3:4b` local. Erro de ~4 %, na direção conservadora.

⚠️ **Mas o degrau é configurável, e o app não o configura.** Uma imagem grande pode cair num orçamento maior, e aí 270 subconta em até 4×. Não é problema hoje — com `costed: false` o app não orça janela para este provedor —, mas seria no dia em que alguém quisesse um medidor fiel de custo na nuvem. Outros dados da mesma ficha: **256 k de contexto**, 30,7 B de parâmetros, encoder de visão de ~550 M, janela deslizante de 1024, **sem áudio**.

⚠️ **É a razão pela qual a armadilha do caminho `-cloud` ([`README.md`](README.md) § 1) é mais grave do que parece:** este provedor recebe **imagem**. Um caminho que não registre no ledger de privacidade não deixaria de registrar apenas texto.

---

## 4. *Embeddings* — **não** disponíveis

`/api/embed` responde **401** (`{"error": "unauthorized"}`) com a mesma chave que funciona em `/api/chat`, e **nenhum dos 20 modelos do catálogo declara `embedding`**.

As fatias **5 (RAG)** e **6 (ML clássico)** do [plano 09](../../plan/active/09-camada-de-ia.md) **não ganham nada deste provedor**: o embedder continua obrigatoriamente local, e `findEmbedders()` (`src/core/ai/models.ts`) seguiria devolvendo lista vazia para ele.
