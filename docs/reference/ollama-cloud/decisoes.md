# Ollama Cloud — as 31 decisões

> Anexo de [`README.md`](README.md). Todas fechadas em **13/09/2026**, **antes de existir código** — mesma forma das `DM-<n>` do arco 23 ([`reference/context7/decisoes.md`](../context7/decisoes.md)). Consulta por `Grep` na sigla `DNC-<n>`. **Não `Read` inteiro.**

⚠️ **A sigla é `DNC-<n>`, com hífen, e isso não é estética.** `DN1A.3` (ponto) é decisão tomada **dentro** do plano `N-1-A`; `DNC-<n>` (hífen) é decisão tomada **antes** de qualquer plano existir, e por isso não entra no [`DECISOES.md`](../../DECISOES.md) — que indexa decisão de plano. Quando um corte da N-3 executar, ele produz as suas próprias `D<id>.<n>`, e **é lá que a errata desta lista vai morar**.

Cada decisão declara **em que se apoia**, porque a força varia:

| Rótulo | Significa |
|---|---|
| *(medida)* | sonda própria contra a API, o painel da conta ou esta máquina, em 13/09/2026 |
| *(publicada)* | documentação oficial da Ollama, ou o fonte do próprio Ollama — citado no ponto |
| *(precedente)* | o código já resolve um caso igual, e a decisão é copiá-lo |
| *(juízo)* | escolha de produto — nenhuma sondagem a resolve |

---

## Escolha de modelo

- **DNC-1 · Dois modelos, não seis** *(medida + juízo)*. Dos seis gratuitos, entram `gemma4:31b` e `gpt-oss:120b`. A régua não é "qual é o melhor", é a da skill [`architecture`](../../../.claude/skills/architecture/SKILL.md): **opção que não vence nenhuma tarefa é ponto de extensão especulativo**, e a régua vale para linha de menu tanto quanto para código. Um seletor com seis entradas obriga o usuário a uma escolha que a medição já sabe responder.
- **DNC-2 · `gemma4:31b` é o padrão** *(medida)*. Vence ou empata nas quatro tarefas da bateria, e vence **por concisão** — 19 tokens onde o `gpt-oss:120b` gasta 334 para a mesma resposta certa. Português sem um deslize, ferramenta consistente, menor `prompt_eval` dos seis (121 contra 354 dos `nemotron`), 256 k de contexto, e **o único com `vision`**. Numa cota medida em tempo de GPU, concisão é preço.
- **DNC-3 · `gpt-oss:120b` é o segundo, e a ressalva mudou de natureza** *(medida + publicada)*. Entra pela capacidade bruta: 116 B de parâmetros, 315 tok/s — ~8× o melhor local. A ressalva de verbosidade **deixou de ser tara permanente** com `DNC-12`: `think: 'low'` é um botão de custo documentado que a sondagem não tinha usado. A ressalva que **fica** é o acionamento inconsistente de ferramenta — e ela não morde hoje, porque o app não tem loop de ferramenta (`DNC-19`).
- **DNC-4 · Os quatro que ficam fora, um motivo cada** *(medida)*. Não é empate; são quatro rejeições distintas, e a distinção importa para quem quiser reabrir:

  | Modelo | Por que fica fora |
  |---|---|
  | `gpt-oss:20b` | **HTTP 400 em toda requisição com `tools`**, e dominado pelo `120b` em velocidade, cota e correção mesmo sem ferramenta |
  | `nemotron-3-nano:30b` | **inventou sintaxe** com o cartão do Context7 em contexto (1 erro em 2), enquanto o `qwen3.5:2b` **local**, 50× mais lento, acertou. É o modo de falha que este app menos pode ter |
  | `nemotron-3-super` | **não foi encontrada tarefa em que ele ganhe** — dominado pelo `gemma4:31b`, que é 2–4× mais rápido, mais conciso e tem visão |
  | `nemotron-3-ultra` | **74–82 s por resposta** e 131–153 s de TTFT, que não é *cold start*. O app não tem estado de interface para "pedido aceito, nada chegando ainda" |

  ⚠️ **Isto revoga a recomendação 3 de [`modelos.md`](modelos.md) § 5**, que punha os três `nemotron` como alternativas. O argumento de lá continua válido *se* o contorno de `format` por ferramenta virar caminho — três deles acionam ferramenta de forma confiável. `DNC-19` fecha esse caminho por ora, então a premissa da recomendação antiga não se cumpre.

---

## Catálogo

- **DNC-5 · Sondado, e filtrado por uma lista fixa de dois** *(medida)*. `/api/tags` e `/api/show` respondem **sem credencial** — este seria o **primeiro provedor de nuvem do app com catálogo real**, com `capabilities` e teto de contexto medidos em vez de escritos à mão como `GLM_MODELS`/`GEMINI_MODELS`. Mas sondar sozinho traz os 20 do catálogo, dos quais 14 respondem **402**. A combinação resolve os dois lados: **sonda o que é verdade, cura o que aparece.**

  E a lista fixa **paga o custo da sondagem**: `ollamaModels` faz N+1 requisições, e com dois modelos isso é 1 + 2 = **três**, não 1 + 20. Filtrar antes de sondar, nunca depois.

  ⚠️ **A lista envelhece, e isso é aceito conscientemente.** A faixa gratuita muda; um modelo da lista que suma do `/api/tags` simplesmente não aparece no seletor, sem quebrar nada. O que **não** acontece sozinho é o inverso — um modelo novo e bom entrar. É manutenção conhecida, não defeito.

- **DNC-6 · `attention` e `sizeBytes` são forçados, nunca herdados** *(precedente)*. Hoje os seis não reportam `attention.head_count_kv`, então `readAttention()` devolve `null` → `contextCeiling` devolve `null` → `costed: false`. **Está certo por acidente.** Se um modelo passar a publicar os três campos de atenção, o app começaria a orçar RAM **local** para um modelo que não usa RAM local, em silêncio. O adaptador força `attention: null` e `sizeBytes: 0` — que é o que `GLM_MODELS`/`GEMINI_MODELS` já fazem, e por isso é precedente, não invenção. `sizeBytes` herdado exibiria 13,7 GB de disco que não existe.

- **DNC-7 · Catálogo sem chave, disponibilidade com chave** *(medida)*. Os dois fatos convivem e parecem contraditórios: o **catálogo** é público, mas `/api/version` **também** responde 200 sem chave — então o ping não prova credencial nenhuma. Vale a régua da skill [`ai`](../../../.claude/skills/ai/SKILL.md): *"disponível" significa "há chave guardada", nunca um ping*. Aqui ela vale **apesar** de o ping ser tecnicamente possível, não por ser impossível como em Gemini/GLM — e essa diferença precisa estar no comentário, senão alguém "conserta" para um ping de verdade.

---

## Orçamento de contexto — desfazer a sobrecarga de `attention: null`

- **DNC-31 · `ceilingOf` decide por serviço, e o custo de KV da família `qwen35` passa a ser CALCULADO — não estimado por fallback** *(medida)*. Entra no **`N-3-A`**, como terceiro item, com o mesmo caráter dos outros dois: conserto do código de hoje, sem tocar nuvem.

  ⚠️ **Esta decisão foi reescrita na mesma sessão, depois de medir.** A primeira versão mandava cair em `DEFAULT_NUM_CTX` (32768) quando a atenção fosse ilegível. **Era errado, e o dono apontou antes de qualquer código:** um teto arbitrário não protege nem libera — só troca uma ficção por uma restrição. A medição confirmou em cheio, e o registro do erro fica porque o raciocínio que o produziu vai reaparecer.

  | Modelo | Hoje exibe | Fallback de 32k | **Teto REAL medido** |
  |---|---:|---:|---:|
  | `qwen3.5:4b` | 262.144 | 32.768 | **48.192** |
  | `qwen3.5:2b` | 262.144 | 32.768 | **168.096** |

  O fallback teria restringido o `2b` — **o modelo local mais usado** — em **5,1×** sobre o que a máquina aguenta de verdade. `budgetFor.fits` recusa acima de `0,9 × numCtx`, então isso não é cosmético: é o app barrando consulta que caberia.

  **`attention === null` carrega hoje dois significados incompatíveis:** *"é de nuvem, RAM é de graça"* (intencional, DN1C.2) e *"não consegui ler a atenção deste modelo local"* (o bug da F-6). ⚠️ **E `DNC-6` aprofunda a sobrecarga** ao decidir **forçar** `attention: null` para nuvem — sem desfazê-la antes, o `N-3-C` cimenta a ambiguidade.

  A consequência é viva e está no território do `N-3-B`. `ConversationView.tsx` faz `entry.attention === null ? entry.contextLength : contextCeiling(...)`, então os dois `qwen3.5` — **locais** — recebem o teto **treinado**:

  | Modelo | Peso | `attention` | Teto oferecido |
  |---|---|---|---|
  | `qwen3:4b` | 2,3 GB | legível | **4k** — calculado contra a RAM livre |
  | `qwen3.5:4b` | 3,2 GB | `null` | **256k** — ficção |

  Um modelo **maior**, na mesma máquina, oferecendo janela **64× maior**. É o erro que a skill [`ai`](../../../.claude/skills/ai/SKILL.md) descreve como *"oferecer só o teto treinado é o erro que parece honesto e não é"*. Três efeitos encadeados: `fitsInMemory(262144)` é verdadeiro, então **`não cabe` nunca aparece**; `bandOptions` oferece **as sete faixas** até 256k, com `max={ceiling}`; e uma janela que não couber faz o Ollama **descartar o começo do prompt em silêncio**, que é a armadilha para a qual `num_ctx` não é rede de segurança.

  **A regra passa a ser, e as duas metades são independentes:**

  1. **`ceilingOf` decide por SERVIÇO** — nuvem → teto treinado; local → `contextCeiling`. Nunca por `attention === null`, que estava sobrecarregado.
  2. **`kvBytesPerToken` aprende a família híbrida**, e aí `readAttention` deixa de devolver `null` para ela.

  ### A medição que substituiu a hipótese

  Carregando cada modelo em `num_ctx` 2048 e 16384 e lendo o tamanho residente em `/api/ps`, a inclinação dá o custo por token **direto, sem precisar de `head_count_kv`** — o mesmo método que produziu `FIXED_OVERHEAD_BYTES` e o `OVERHEAD = 1,06`:

  | Modelo | RAM a 2048 | RAM a 16384 | **KV/token medido** |
  |---|---:|---:|---:|
  | `qwen3.5:4b` | 3.113.673.029 | 3.643.895.969 | **36.985 B** (36,1 KiB) |
  | `qwen3.5:2b` | 2.368.177.435 | 2.576.047.142 | **14.500 B** (14,2 KiB) |

  ⚠️ **E isso REPROVA a hipótese registrada na F-6.** Ela propunha usar `head_count` no lugar de `head_count_kv`; para o `4b` isso prevê **347.341 B/token** contra os 36.985 medidos — **9,4× para cima**. Codificada, teria esmagado o teto para ~1/9 do real: muito pior que o estado atual, e exatamente na direção que o dono temia. **A hipótese não foi refinada, foi derrubada.**

  ### O que a medição revelou, e por que a conta errava tanto

  ⚠️ **`qwen35` publica um bloco `ssm.*` completo** — `conv_kernel`, `group_count`, `inner_size`, `state_size`, `time_step_rank`. **É arquitetura híbrida Mamba**, a mesma família do `granite4`, e não um caso novo. Com `full_attention_interval = 4`, **só 1 em cada 4 camadas cresce com o contexto**; as demais são Mamba, de estado constante. A conta ingênua contava as 32.

  Com `growingLayers = block_count / full_attention_interval` e os `key_length`/`value_length` **publicados** (256 cada), a fórmula fecha nos dois:

  | Modelo | camadas que crescem | `kvHeads` | previsto | medido/previsto |
  |---|---:|---:|---:|---:|
  | `qwen3.5:4b` | 8 (de 32) | 4 | 32.768 B | **1,13** |
  | `qwen3.5:2b` | 6 (de 24) | 2 | 12.288 B | **1,18** |

  ⚠️ **O `OVERHEAD` desta família é maior que o do projeto** (1,13–1,18 contra `1,06`), e o resíduo está na direção **perigosa** — a fórmula subestima. Use ≥ 1,2 para esta família, ou o teto sai grande demais.

  ⚠️ **Um confundimento honesto, que só um terceiro modelo desfaz:** `kvHeads = head_count / 4` e `kvHeads = head_count / full_attention_interval` **dão o mesmo resultado nos dois modelos medidos**, porque o intervalo é 4 em ambos. Não dá para saber qual das duas é a regra. **Não codifique a que for mais fácil de escrever** — meça um `qwen35` com intervalo diferente, ou trate o divisor como constante da família com o confundimento anotado no comentário.

  ### O efeito na F-6

  ✅ **A frente 2 da F-6 fica resolvida em dados e absorvida pelo `N-3-A`** — era "hipótese a verificar antes de corrigir", e a verificação aconteceu aqui, derrubando a hipótese e entregando a substituta. **A F-6 encolhe para uma frente só**: o gate `vision`+`tools` do `Composer`/`AttachButton`, que é decisão de produto e segue **independente da N-3**.

  ⚠️ **O que sobra por medir antes de codificar:** os números acima valem para **esta máquina, com 5,65 GiB livres em 13/09/2026**. O custo por token é propriedade do modelo e não varia; o **teto**, sim — `contextCeiling` já lê `freeBytes` na hora, e a RAM livre desta máquina oscila 1,5–2 GiB.

---

## Serviço e fronteira

- **DNC-8 · Serviço próprio `'ollama-cloud'`, nunca a tag `-cloud`** *(juízo, sobre medida)*. `isCloudService()` decide por `service !== 'ollama'`, e é essa função que liga o registro no ledger de privacidade. Um modelo `-cloud` sob `service: 'ollama'` enviaria dados do usuário para fora da máquina **sem uma linha no ledger** — imagens inclusive, já que há visão na nuvem. Custa uma entrada em `aiServiceSchema` e uma em `CLOUD_PROVIDERS`; o caminho errado custaria zero linha, que é exatamente o que o torna tentador.

  ⚠️ **`CLOUD_PROVIDERS` já não significa "provedor de IA"** desde que `'context7'` entrou (D23B.4) — são quatro `Record<CloudProvider, …>` exaustivos que o `typecheck` cobra. Este é o primeiro valor a entrar nos **dois** conjuntos ao mesmo tempo.

- **DNC-9 · O catálogo local descarta todo modelo terminado em `-cloud`** *(juízo)*. Torna o estado perigoso **inexpressável** em vez de regra que alguém precisa lembrar — mesma forma de `features/panel/` na skill [`architecture`](../../../.claude/skills/architecture/SKILL.md). Três fatos sustentam:

  1. A ameaça é **latente, não viva**: o `/api/tags` local desta máquina tem 13 modelos, nenhum `-cloud` (medido em 13/09/2026).
  2. O interruptor **não é do app**: quem decide é `OLLAMA_NO_CLOUD=1` / `disable_ollama_cloud` no `~/.ollama/server.json` do usuário *(publicada, FAQ oficial)*. O conteúdo do catálogo local é entrada de fora.
  3. Um usuário que **queira** os modelos de nuvem já tem o caminho certo: o serviço próprio de `DNC-8`. Descartar não tira capacidade, redireciona.

- **DNC-10 · O adaptador é `ollama.ts` parametrizado por host e header, não um arquivo novo** *(medida)*. Medido contra a nuvem, o parser NDJSON de `providers/ollama.ts` serve **sem uma linha de mudança**: transporte, `message.thinking` como campo irmão, linha final com `done_reason`, `prompt_eval_count`/`eval_count`, papel `system` interno e campo `images` — todos idênticos. Duplicar as 272 linhas criaria dois donos do mesmo parser, divergindo em silêncio.

- **DNC-11 · `LoadedFn` devolve lista vazia, `UnloadFn` é no-op** *(medida)*. `/api/ps` responde **401**. É resposta verdadeira, não recurso faltando: não há modelo residente em RAM local para listar ou descarregar. Mesmo tratamento dos demais provedores de nuvem.

---

## Raciocínio

- **DNC-12 · `think` deixa de ser booleano — passa a `ThinkValue`** *(publicada)*. O `api/types.go` do Ollama declara `Think *ThinkValue` como **booleano ou string** (`"high"`/`"medium"`/`"low"`/`"max"`), e `docs/capabilities/thinking.mdx` diz textualmente que *GPT-OSS is an exception, requiring specific levels*. O app manda booleano (`providers/ollama.ts`, `think: onThinking !== undefined`).

  ⚠️ **Isto reclassifica o "defeito" registrado em [`api.md`](api.md) § 4.2.** `think: false` ignorado pela família `gpt-oss` **não é bug do serviço** — é o contrato documentado, e o app estava mandando o tipo errado. A sondagem leu o sintoma certo e atribuiu a causa errada; o registro fica para que a próxima leitura não repita a atribuição.

- **DNC-13 · `gpt-oss` não tem "raciocínio desligado", e o precedente é o Gemini** *(publicada)*. Os níveis são `low`/`medium`/`high`; nenhum deles é "off". É **exatamente a forma** de `thinkingLevel` do Gemini, que também não tem desligar de verdade (D21A.6) e ficou fixo no mínimo válido. A decisão é a mesma: `'low'` como piso para este modelo, e o app **não promete** desligar o que o provedor não desliga.

  **O ganho é financeiro, não cosmético.** A cota é tempo de GPU, e a família `gpt-oss` gerou **7× mais tokens** para a mesma resposta (332 contra 48 do `gemma4:31b`; 1.372 numa pergunta trivial). `'low'` ataca a raiz do custo — ⚠️ **mas o quanto ele reduz não foi medido**, e medir é passo do corte, não suposição a herdar.

- **DNC-14 · A guarda de acúmulo de raciocínio é conserto de hoje, não da nuvem** *(medida)*. `providers/ollama.ts` faz `reasoningAssembled += thinkingPiece` **incondicionalmente**, enquanto `onThinking?.()` logo abaixo é guardado; e `useConversationChat.ts` monta uma `ReasoningPart` sempre que `reply.reasoning !== undefined`, sem portão por `wantsReasoning`. Com um modelo que ignore o pedido, o raciocínio apareceria na conversa e seria **persistido** com o botão desligado.

  **Nenhum modelo da frota local ignora `think: false`, e é só por isso que o defeito nunca se manifestou.** Ele é latente no código de hoje e vale corrigir **independentemente** de este provedor ser integrado — por isso abre a trilha (`N-3-A`) em vez de viajar junto do modelo que o expõe.

---

## Cota e custo

- **DNC-15 · Não haverá indicador de cota para este provedor** *(medida)*. Não há header de cota — os headers trazem só `x-request-id`, `x-build-commit`, `x-build-time` e o trace do Google Frontend. O padrão do arco 23 (`docs:quota` lendo o header da última resposta, `D23I.10`) **não é replicável**. A única fonte de saldo é o painel do site, e dizê-lo ao usuário é mais honesto que desenhar um número inventado. **Não é lacuna a preencher depois; é a forma final.**

- **DNC-16 · O painel da conta não permite atribuição por lote** *(medida)*. Três leituras no mesmo dia: 23 req → 0,2 % · 42 req → 1,7 % · **76 req → 1,9 %**. O terceiro lote (34 requisições, com **quatro** chamadas ao `nemotron-3-ultra`, o mais caro dos seis) custou **0,2 pp** — praticamente a taxa do primeiro lote, que era o mais leve. Os dois lotes com mais `ultra` estão nos extremos opostos.

  **O único número defensável é o total:** 76 requisições de sondagem deliberadamente pesada = **1,9 %**, ordem de ~4.000 requisições/mês nesse perfil. ⚠️ **Qualquer modelo de custo construído sobre deltas deste painel está construído sobre ruído** — e é isto que revoga a narrativa dos "7,5×" que as duas primeiras leituras sugeriam.

---

## Privacidade

- **DNC-17 · A retenção está documentada, e o que ela cobre é preciso** *(publicada)*. A FAQ oficial: *"Ollama runs locally. We don't see your prompts or data when you run locally. When using cloud-hosted models, we process your prompts and responses to provide the service but do not store or log that content and never train on it."*

  **Fecha a pergunta que o [`README.md`](README.md) § 6 marcava como a mais importante das cinco.** Três verbos negados — não armazenam, não registram, não treinam — e um afirmado: processam. ⚠️ **É promessa de política, não garantia técnica**, e não cobre o que o `ESCOPO.md` exige: os três níveis (esquema · perfil agregado · amostra) seguem **opt-in por anexo**, porque essa garantia é do app e mora em `core/`, não de quem recebe.

- **DNC-18 · O ledger de privacidade já funciona por construção** *(precedente)*. `isCloudService()` devolve verdadeiro para todo `service !== 'ollama'`, então `'ollama-cloud'` é registrado **sem uma linha nova** no O-8. A ressalva que [`README.md`](README.md) § 4 levanta — documentação do Context7 viajando junto para um provedor de nuvem — não é caso novo: o cartão viaja **dentro** da conversa, e a conversa é registrada como nuvem. O que falta é granularidade sobre a consulta ao Context7, e disso o **`O-9`** já é dono. **Nenhum trabalho de ledger entra na N-3** — desde que `DNC-9` entre.

---

## Saída estruturada

- **DNC-19 · `ai:propose` declara o limite, e nada além disso** *(juízo)*. `format` é **ignorado em silêncio** na nuvem — testado em quatro modelos e nas três formas (`/api/chat` com JSON Schema, com `"json"`, e `/v1/chat/completions` com `response_format: json_schema, strict: true`). Todos devolveram markdown com HTTP 200.

  ⚠️ **O problema é maior que este provedor:** `grep format` em `providers/gemini.ts` e `providers/glm.ts` devolve **zero linhas**, e `register-all.ts` entrega `resolveProvider(args.service).chat` ao `aiPropose` para **qualquer** serviço. **`ai:propose` já é só-Ollama-local hoje, e isso não está declarado em lugar nenhum.** A nuvem não introduz o defeito; torna-o visível.

  A decisão é o gate, não o contorno: `ai:propose` recusa serviço de nuvem, com estado de tela. O contorno medido — uma ferramenta cujo schema de parâmetros seja o schema do passo — **funciona** e `tool_calls` **chega em streaming** *(publicada: `docs/capabilities/streaming.mdx`, com exemplo em JS; o array chega completo num chunk, com `arguments` já como objeto)*, então a UX de stream não é obstáculo. Fica como **gatilho no [`ROADMAP § 2`](../../ROADMAP.md)**, sem trilha reservada: reservar um `N-4` para algo que talvez nunca seja preciso é o ponto de extensão especulativo que `DNC-1` recusa.

  ⚠️ **E é uma chamada forçada, não agência.** Se um dia for feito, não reabre a decisão REST-e-nunca-MCP da skill [`ctx-7`](../../../.claude/skills/ctx-7/SKILL.md): não há loop, não há modelo escolhendo consultar, e o app continua sem *tool calling* como espinha dorsal.

---

## Desempenho

- **DNC-20 · `total_duration` substitui as durações nativas ausentes** *(medida)*. A nuvem manda só `total_duration`; faltam `load_duration`, `prompt_eval_duration` e `eval_duration`, então `nativeDurations()` devolveria `{}`. O painel Desempenho **degrada sozinho** — todos os campos são opcionais —, mas `total_duration` é mandado hoje e o app não o lê. É a substituição natural, e o painel deixa de ficar vazio para este provedor.

---

## Popover de modelo — o corte `N-3-B`

> Fechadas em 13/09/2026, contra a captura do popover real e o fonte de `ModelSelector.tsx`. **O corte é 100% renderer, nenhum canal tocado** — mesma forma de `23-E`/`23-F`, e é o que o mantém curto.

⚠️ **Por que isto entra na trilha da nuvem, e ANTES do provedor novo:** o pior caso já está na tela hoje — `gemini-3.5-flash-lite`, com três chips e o tripé de limites, é mais longo que qualquer linha que o `ollama-cloud` vá produzir (a Ollama não publica RPM/TPM). O desenho não precisa esperar o provedor; e se esperasse, a sessão que adiciona `ollama-cloud` acrescentaria linhas a um popover já sabidamente quebrado. Mesma lógica do `N-3-A`: **consertar antes de acrescentar.**

- **DNC-23 · Uma linha por modelo — `flex-col` vira `flex-row`** *(medida)*. Hoje a linha é `flex flex-col gap-1`: nome em cima, e embaixo um `flex flex-wrap` com metadados e chips. O `flex-wrap` é o que joga os chips do `gemini-3.5-flash-lite` para uma **terceira** linha. O nome passa a flexionar e truncar; metadados e chips vão para a direita.

  ⚠️ **O truncamento exige `min-w-[0px]`, nunca `min-w-0`.** O projeto desliga `--spacing-*: initial`, então **todo** utilitário no degrau `0` não gera CSS nenhum — é o gatilho aberto do [`ROADMAP § 2`](../../ROADMAP.md), com dano medido três vezes. A própria pílula deste componente já usa a forma correta (`ModelSelector.tsx`, o `min-w-[0px]` do rótulo). Escrever `min-w-0` produz um nome que empurra os chips para fora e **nada avisa** — nem lint, nem typecheck, nem jsdom.

  ⚠️ **E o bloco de chips precisa de `flex-none`.** É o defeito recorrente já registrado neste projeto (ícone + texto quebrando sem `flex-none`). O juiz é o CSS construído e o olho, porque jsdom não faz layout.

- **DNC-24 · Largura `380px` → `560px`** *(juízo, sobre medida)*. O comentário do código registra que a largura já subiu de **300 para 380 no N-1-C**, *"porque as linhas de Nuvem agora carregam uma segunda linha"* — ou seja, a largura já foi aumentada uma vez para tratar o sintoma, e a segunda linha continuou lá. Desta vez a largura acompanha a mudança de eixo, não a substitui. ⚠️ **O número é ponto de partida:** o valor final se confirma contra a janela estreita (F-3-C), não na janela larga em que se desenha.

- **DNC-25 · O tripé de limite sai da linha** *(precedente)*. `15 RPM · 250k TPM · 500 RPD` é o elemento mais longo do popover e é **informação de administração** — a mesma classe que `D23I.1` tirou do caminho do usuário no painel de documentação (*"informação de administração não segue a pessoa pelo processo"*). Ninguém escolhe modelo por RPD. Vai para `title`, no hover. `formatRateLimit` **não muda** — muda onde a string é usada.

- **DNC-26 · Vocabulário unificado: `até <n>k` nos dois grupos** *(juízo)*. Hoje local diz `até 256k` e nuvem diz `195k de contexto` — duas gramáticas para o mesmo fato, lado a lado na mesma lista. O sufixo `de contexto` sai.

- **DNC-27 · `não cabe` sozinho, sem `até 0k`** *(medida)*. `formatContext` faz `Math.round(tokens / 1024)`, então um teto minúsculo vira `0k` e a linha lê `4,4 GB até 0k não cabe`. O veredito já diz tudo; o teto só aparece quando há teto útil. **Não é conserto em `formatContext`** — a função está certa, é a composição da linha que decide não mostrar.

- **DNC-28 · `·` entre todos os metadados, e a coluna de chips alinhada** *(medida)*. Hoje os metadados são `<span>`s soltos num `gap-2` **sem separador**, o que produz a frase corrida `195k de contexto 1 simultânea`. Com os chips à direita em coluna, o olho varre capacidade na vertical em vez de caçá-la no fim de cada frase.

- **DNC-29 · Um mecanismo de destaque só, e o das linhas de nuvem é inerte** *(medida)*. O popover tem fundo `bg-surface-raised` (`Popover.tsx`). Sobre ele:

  | | Hoje | Efeito real |
  |---|---|---|
  | Linha **local** | `onMouseEnter` → estado JS `highlighted` → `border-border-strong bg-surface` | funciona, e a direção está certa: a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) manda **o inverso** onde o item já parte de `surface-raised` |
  | Linha **de nuvem** | CSS `hover:border-border hover:bg-surface-raised` | ⚠️ **`bg-surface-raised` é a cor do próprio fundo do popover** — a mudança de fundo é invisível, só a borda aparece |

  Unifica no mecanismo **local** (estado JS), por dois motivos: a cor está certa, e o estado JS é o único que sincroniza com a navegação por teclado do `role="listbox"` — um `:hover` puro deixa mouse e setas destacando linhas diferentes. **Os defaults também divergem** (`border-border` nas locais contra `border-transparent` nas de nuvem) e passam a ser um só.

---

## O fechamento — o corte `N-3-E`

- **DNC-30 · O fechamento é corte próprio, e o destino do que sobra é TRIPLO** *(precedente)*. Ao fim da trilha, esta pasta deixa de ser fonte de regra e passa a **`⛔ consumido`**, como `reference/context7/`. Duas partes na decisão:

  **(a) Corte próprio, não rodapé do `N-3-D`.** O arco 23 deu ao fechamento o seu próprio corte (`23-K`), separado das minúcias (`23-J`), e o motivo registrado foi de ordem: *um apanhado de pendências depois do fechamento reabriria o que ele fechou*. O mesmo vale aqui, mais dois argumentos: o `N-3-D` já carrega uma **medição** (quanto `think: 'low'` reduz) e uma mudança de contrato que atravessa os quatro provedores; e a verificação ao vivo do fechamento só pode acontecer **depois** de `D` estar pronto. R-6 e R-7 confirmam o padrão — consolidação documental sempre teve unidade própria neste projeto.

  **(b) O destino não é só a skill, e essa é a diferença contra o arco 23.** Lá, `reference/context7/` pôde ser consumido por inteiro porque a skill `ctx-7` absorveu tudo que sobreviveu. Aqui **já existe um segundo dono vivo**: `reference/models/`, cuja fronteira R6.1 traçou de propósito. Sem a divisão, ou esta pasta duplica aquela (dívida, e o segundo lugar envelhece calado), ou aquela fica desatualizada em silêncio.

  | O que sobrevive | Vai para | Estado final |
  |---|---|---|
  | Regra que decide a primeira linha de código — forçar `attention`/`sizeBytes`, `ThinkValue` e o piso do `gpt-oss`, a armadilha `-cloud`, disponibilidade por `hasKey()` apesar de o ping funcionar | skill [`ai`](../../../.claude/skills/ai/SKILL.md) | ✅ dono |
  | Ficha dos dois modelos de nuvem — teto, capacidades, e o fato de **não custarem RAM local** | [`reference/models/`](../models/README.md) | ✅ **vivo**, nunca consumido |
  | A narrativa da sondagem — as 76 requisições, a série de cota, a bateria de qualidade, as rejeições com motivo | esta pasta | ⛔ consumido |

  ⚠️ **A régua que separa (1) de (3) é a mesma do `CLAUDE.md`:** vai para a skill o que alguém violaria **sem saber** ao escrever a primeira linha; fica aqui o que se consulta uma vez e não decide código. *"76 requisições custaram 1,9 %"* não muda nenhuma linha — `DNC-15` (não exibir cota), que saiu daí, muda.

---

## Fora de escopo, declarado

- **DNC-21 · Busca web não é da trilha N** *(juízo)*. `/api/web_search` e `/api/web_fetch` existem, funcionam, devolvem markdown já extraído (~2.100 tokens por resultado) e consomem a mesma cota. É um **terceiro candidato medido** para o pilar de busca web do [`ESCOPO.md`](../../ESCOPO.md) — REST, mesma chave, mesma forma que o arco 23 escolheu para o Context7 (`DM-0`).

  **Mas o dono é o pilar, não este provedor.** O material de entrada é [`reference/web-fetch-mcp-thinking/`](../web-fetch-mcp-thinking/README.md), e integrar a busca aqui amarraria o pilar a exigir chave da Ollama mesmo numa conversa com modelo local. Esse acoplamento é decisão de produto que o arco 23 tomou **explicitamente** para o Context7 — aqui ela nem foi formulada. Enfiá-la na N-3 seria decidi-la por omissão.

- **DNC-22 · `truncate` e `shift` são achado do provedor local, não da nuvem** *(publicada)*. O `ChatRequest` do Ollama tem dois campos que o app não usa: `Truncate` (*truncates the chat history messages if the rendered prompt exceeds the context length limit*) e `Shift` (*shifts the chat history when hitting the context length limit instead of erroring*).

  ⚠️ **`truncate: false` é o botão que faltava para a armadilha do descarte silencioso** que a skill [`ai`](../../../.claude/skills/ai/SKILL.md) registra — *"o Ollama descarta o começo do prompt em silêncio, e `num_ctx` não é o botão que parece"*, o caso em que 1.500 tokens sumiram sem erro nem aviso. Aquela armadilha é o motivo de fundo de `GATE_MARGIN` e de `budgetFor.fits` recusarem **antes** de enviar.

  **Não entra na N-3, e a razão é medida:** a nuvem **ignora `options.num_ctx`** e usa o contexto nativo do modelo, então não há descarte silencioso a evitar deste lado. É trabalho do provedor local — candidato à **F-6**, que já é o plano de bug da camada de IA. Registrado aqui porque foi aqui que apareceu.
