# Ollama Cloud — sondagem da API contra o serviço real

> **Data:** sondagem e refinamento em 13/09/2026 · **Estado:** ✅ vivo · **Natureza:** medição, mais o recorte que a trilha N-3 executa.
>
> Registra **o que a API faz**, medido contra o serviço real: **76 requisições** contadas no painel da conta — 27 mapeando a API, o restante na bateria de qualidade e no diagnóstico do HTTP 400. A sessão de refinamento fechou quatro perguntas contra a documentação oficial e o fonte do Ollama, e **§ 5 recorta a trilha N-3 em quatro cortes**.
>
> **Continua não sendo plano.** Cada corte nasce como arquivo na sessão em que for executado ([`ROADMAP § 1`](../../ROADMAP.md), linha N-3) — o que § 5 entrega é o escopo e a ordem, para que a sessão de planejamento não precise refazer esta leitura.

**Fronteira com os donos vizinhos.** A frota Ollama **local** e o catálogo de nuvem opt-in são de [`reference/models/`](../models/README.md); as regras da camada de IA (seams, orçamento de RAM e de tokens, contrato de streaming) são da skill [`ai`](../../../.claude/skills/ai/SKILL.md). Aqui fica só o que é específico do **Ollama Cloud** e que nenhum dos dois cobre.

| Anexo | O que responde |
|---|---|
| [`decisoes.md`](decisoes.md) | **As 29 decisões `DNC-<n>`, fechadas antes de existir código** — escolha de modelo, catálogo, fronteira, raciocínio, cota, privacidade, e o que ficou declaradamente fora |
| [`api.md`](api.md) | Endpoints medidos um a um, o fio NDJSON, as cinco divergências contra o daemon local, os dois defeitos que a sondagem expôs, erros e status |
| [`desempenho.md`](desempenho.md) | TTFT e tok/s dos seis modelos, contexto grande, cache de prompt — com a régua de comparação contra a frota local |
| [`capacidades.md`](capacidades.md) | Busca web, extração de página, *tool calling*, visão, e a ausência de *embeddings* |
| [`modelos.md`](modelos.md) | **Dos seis, quais dois** — bateria de quatro tarefas que o app já faz, o veredito modelo a modelo, e por que velocidade não responde a essa pergunta |

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

**Três fatos medidos em 13/09/2026 que dimensionam a armadilha:**

1. **Ela é latente, não viva.** O `/api/tags` **local** desta máquina devolve 13 modelos, **nenhum** com sufixo `-cloud` — a máquina não está logada. O risco é o dia em que alguém rodar `ollama signin`, não hoje.
2. **A decisão não é do app.** O daemon roteia para a nuvem por configuração do usuário, e desligar isso é `OLLAMA_NO_CLOUD=1` ou `{"disable_ollama_cloud": true}` em `~/.ollama/server.json` (FAQ oficial). **O crivo não controla esse interruptor** e não pode contar com ele: o conteúdo do catálogo local é entrada de fora.
3. **Por isso a defesa é do lado do app, e é barata.** Descartar do catálogo local todo modelo cujo nome termine em `-cloud` torna o estado perigoso **inexpressável**, em vez de regra que alguém precisa lembrar — mesma forma do `features/panel/` na skill [`architecture`](../../../.claude/skills/architecture/SKILL.md). É o corte **N-3-A** (§ 5).

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
| Requisições totais | **76** (70 de inferência + 6 às ferramentas web) |
| Consumo | **1,9 %** da cota mensal |
| Janela | mensal, contada da data de assinatura ("resets in 3 weeks" em 13/09) |
| Unidade | **tempo de GPU**, não tokens |
| Concorrência publicada | 1 requisição simultânea |

### As três leituras, e por que só a última serve

| Momento | Requisições | Cota | Delta |
|---|---:|---:|---|
| Após a 1ª rodada (respostas curtas) | 23 | 0,2 % | — |
| Após a 2ª rodada (inclui os pesados) | 42 | 1,7 % | +19 req · **+1,5 pp** |
| **Final, lido no painel** | **76** | **1,9 %** | +34 req · **+0,2 pp** |

⚠️ **A terceira leitura desmente a narrativa que as duas primeiras sugeriam.** A segunda leitura parecia mostrar que requisições pesadas custam ~7,5× as leves, e este documento extrapolava daí entre ~2.500 e ~11.000 requisições/mês. Mas o terceiro lote — **34 requisições, com quatro chamadas a `nemotron-3-ultra`**, o mais caro dos seis — custou **0,2 pp**, praticamente a taxa do primeiro lote, que era o mais leve de todos. Os dois lotes com mais `ultra` estão nos extremos opostos da tabela.

**A conclusão não é que a cota é barata; é que este painel não permite atribuição por lote.** O número é arredondado a uma casa decimal, não é carimbado por requisição, e pode não atualizar em tempo real. **Qualquer modelo de custo construído sobre deltas daqui está construído sobre ruído.**

✅ **O único número defensável é o total:** 76 requisições de sondagem deliberadamente pesada — incluindo seis chamadas ao `ultra`, dois prompts de 32 k tokens e seis às ferramentas web — consumiram **1,9 %**. Ordem de grandeza: **~4.000 requisições/mês** nesse perfil. Uso conversacional normal com `gemma4:31b` fica folgadamente abaixo disso.

> 🔍 **Uma hipótese que reconciliaria o ruído, não verificada.** Fontes de terceiros descrevem a faixa gratuita com **níveis 1 a 4 por peso de modelo** e janelas de 5 h / 7 dias, em vez de mensal. Isso explicaria saltos não lineares melhor que "segundos de GPU" sozinho — mas **conflita com o painel medido**, que diz `1,9% used` e `Resets in 3 weeks`. Prevalece o medido; a hipótese fica registrada para quem remedir.

⚠️ **As ferramentas web consomem a mesma cota**, e aparecem como linhas próprias no painel, ao lado dos modelos. Distribuição final em [`desempenho.md`](desempenho.md).

⚠️ **Não há header de cota. Nenhum.** Os headers trazem só `x-request-id`, `x-build-commit`, `x-build-time` e o trace do Google Frontend — nada de `x-ratelimit-*`. Somado à inatribuição acima, isso fecha uma decisão de produto: **o app não terá indicador de cota para este provedor** — nem por header (não existe), nem por inferência (o painel não sustenta). É a diferença contra o Context7, onde `docs:quota` lê o header da última resposta (`D23I.10`) e por isso pode exibir um número. Aqui a única fonte de saldo é o site, e dizer isso ao usuário é mais honesto que desenhar um número inventado.

⚠️ **O limite de 1 requisição concorrente não é aplicado.** Duas requisições disparadas ao mesmo tempo responderam **200 ambas**. Não o trate como garantia nem o exiba como limite rígido.

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
| **Escolha de modelo** | ✅ **resolvida: dois** — `gemma4:31b` e `gpt-oss:120b`; os outros quatro ficam fora ([`modelos.md`](modelos.md) § 5) |
| **Saída estruturada (`format`)** | ❌ **ignorada em silêncio** — e a sondagem mostrou que `ai:propose` já dependia disso sem estar declarado ([`api.md`](api.md)) |
| ***Embeddings*** | ❌ indisponíveis — as fatias 5/6 do [plano 09](../../plan/active/09-camada-de-ia.md) não ganham nada daqui |
| **Privacidade** | ⚠️ o caminho `-cloud` é armadilha latente e tem conserto de três linhas (§ 1); retenção de dados ✅ **documentada** — não armazenam, não registram, não treinam (§ 6) |
| **Cota exibida na UI** | ❌ **decidida: não haverá** — sem header e sem atribuição confiável no painel (§ 3) |

### Documentação anexada (Context7) chega igual — e a garantia está em `core/`

Um anexo de documentação vira uma `DocsPart`, que `partForProvider` (`src/core/ai/messages.ts`) materializa com `formatDocsCard` em **texto puro**, antes de qualquer adaptador existir no caminho. Não há campo especial, não há negociação, não há `tools`. É consequência direta da decisão REST-e-nunca-MCP da skill [`ctx-7`](../../../.claude/skills/ctx-7/SKILL.md): como nenhum provedor precisa declarar `tools` para a documentação funcionar, **nada nesse caminho pode divergir por provedor**. `rules` segue não sendo enviado, `omitted` segue fora, `enabled: false` segue produzindo string vazia.

Medido com o cartão real (~923 tokens, montado da fixture `context-tanstack-query.json`): `prompt_eval_count` entre 902 e 949 nos cinco modelos testados, nuvem e local — as diferenças são de tokenizador, não de tratamento.

**O que muda de fato são três coisas**, e nenhuma é de contrato:

| | |
|---|---|
| **Custo do cartão** | ~50× menor. `qwen3.5:2b` local levou **44,8 s** para o mesmo cartão que `gemma4:31b` na nuvem resolveu em **0,7 s** — e a partir do 2º turno o cache de prompt zera o reenvio ([`desempenho.md`](desempenho.md)) |
| **Teto** | com 131 k–262 k, a pergunta "cabe o resultado amplo?" (o botão de consulta ampla do 23-J) sai de cena |
| **Fidelidade** | não acompanha a velocidade — ver [`modelos.md`](modelos.md) |

⚠️ **A fronteira muda: passam a existir dois portais de saída.** Hoje, numa conversa com modelo local, só a **pergunta** sai da máquina (para o Context7). Com um provedor de nuvem, **o cartão inteiro também sai** — documentação de terceiros viaja junto com a conversa para o provedor de IA.

✅ **Mas isto não é trabalho novo de ledger, e o refinamento verificou por quê** (`DNC-18`). `isCloudService()` devolve verdadeiro para todo `service !== 'ollama'`, então `'ollama-cloud'` é registrado no O-8 **sem uma linha nova**; e o cartão viaja **dentro** da conversa, que é o que fica registrado. O que falta é granularidade sobre a **consulta ao Context7** — e disso o `O-9` já é dono ([`ROADMAP § 2`](../../ROADMAP.md)). **Nenhum corte da N-3 toca o ledger** — desde que `DNC-9` (descartar `-cloud` do catálogo local) entre, que é exatamente o `N-3-A`.

---

## 5. Os cortes

Arquivos separados, estilo 18-A — nunca passos dentro de um arquivo só, e **nunca subcorte** (a forma `23-A-1` do arco 21 não se pagou: o filho carrega o contexto do pai junto, o que anula o ganho de fatiar). **Corte que crescer demais vira dois irmãos**, ambos no mesmo nível, cada um com o próprio arquivo e o próprio diário. A primeira letra livre é `D`.

**Uma sessão por corte**, planejamento e implementação separados — é a régua que o plano 19 cobrou caro: sete passos executáveis num arquivo só somaram 950k tokens e entregaram bugs.

| Corte | Entrega | Depende de |
|---|---|---|
| **N-3-A** | **a trava antes da porta.** Nenhuma linha de nuvem. (1) A guarda de acúmulo de raciocínio (`DNC-14`) — `reasoningAssembled` e a montagem de `ReasoningPart` passam a respeitar `onThinking`/`wantsReasoning`. (2) O catálogo local descarta todo modelo terminado em `-cloud` (`DNC-9`). **Os dois são conserto do código de hoje**, verificáveis sem chave e sem serviço novo | — |
| **N-3-B** | **o popover em uma linha.** `flex-row` com nome truncando, `560px`, o tripé de limite para o `title`, vocabulário unificado, `não cabe` sem `até 0k`, separador `·`, coluna de chips alinhada, e **um mecanismo de destaque só** — o das linhas de nuvem é hoje inerte (`DNC-23`–`DNC-29`). **100% renderer, nenhum canal tocado** | — |
| **N-3-C** | **o serviço e o catálogo sondado.** `'ollama-cloud'` em `aiServiceSchema` **e** em `CLOUD_PROVIDERS` (`DNC-8`), campo no cofre ao lado de Gemini/GLM/Context7, adaptador por parametrização de `ollama.ts` (`DNC-10`), catálogo sondado com lista fixa (`DNC-5`) e `attention`/`sizeBytes` forçados (`DNC-6`), disponibilidade por `hasKey()` (`DNC-7`), `loaded`/`unload` no-op (`DNC-11`), e o gate de `ai:propose` (`DNC-19`). **Um modelo só: `gemma4:31b`** — o que respeita `think: false` hoje. Termina com conversa funcionando | A · B |
| **N-3-D** | **o segundo modelo e o nível de raciocínio.** `ThinkValue` no contrato (`DNC-12`), `'low'` como piso do `gpt-oss` (`DNC-13`), `gpt-oss:120b` entra na lista fixa (`DNC-3`), e `total_duration` alimenta o painel Desempenho (`DNC-20`) | C |

**A ordem é dependência, não sugestão.** `A` e `B` **não tocam nuvem** e podiam rodar isolados a qualquer momento — abrem a trilha de propósito, pela mesma regra nos dois casos: **consertar antes de acrescentar.** `A` garante que nenhum modelo de nuvem chegue antes da guarda que o `gpt-oss` vai exercitar; `B` garante que as linhas novas não entrem num popover já quebrado. Entre si **são independentes** — `A` é adaptador e catálogo, `B` é renderer — e a ordem alfabética entre os dois é etiqueta, não lei. `D` existe separado de `C` porque `ThinkValue` muda o contrato dos **três** provedores já existentes, e misturá-lo com o nascimento de um quarto seria duas variáveis no mesmo corte.

⚠️ **Não existe `N-4` nem `N-5` nesta trilha.** Dois candidatos foram avaliados e **recusados como trilha**, cada um com o seu registro: a saída estruturada por ferramenta forçada vira **gatilho** no [`ROADMAP § 2`](../../ROADMAP.md) em vez de corte reservado (`DNC-19`), e a **busca web** é do pilar próprio dela, não deste provedor (`DNC-21`). Reservar letra para trabalho que talvez nunca aconteça é o ponto de extensão especulativo que `DNC-1` recusa. **A primeira letra livre para um irmão é `E`** — corte que crescer demais vira dois irmãos no mesmo nível, nunca um subcorte `N-3-B-1`.

### O que cada corte ainda precisa VERIFICAR — são passos, não pendências

Nenhuma das três é decisão em aberto; todas são medição que o plano do corte agenda.

| Corte | A verificar | Por que não dá para supor |
|---|---|---|
| **A** | a guarda reprova sob sabotagem | Um teste de "não persiste raciocínio" pode nascer vacuoso se o campo nem for renderizado nesse estado — já aconteceu neste projeto (skill [`testing`](../../../.claude/skills/testing/SKILL.md)). Prove o **estado final** que o defeito inverteria |
| **B** | a largura final **na janela estreita**, e que as classes existem no CSS **construído** | Duas coisas que só o olho pega: `min-w-0` e qualquer utilitário no degrau `0` **não geram CSS** neste projeto, e jsdom não faz layout — nenhum teste de nível 2 reprova uma linha que quebrou. `560px` é ponto de partida, não medida (`DNC-24`) |
| **C** | o catálogo sondado devolve os `capabilities` esperados para `gemma4:31b` | A armadilha `/api/tags` vs `/api/show` é a razão do N+1 (skill [`ai`](../../../.claude/skills/ai/SKILL.md)); com lista fixa de dois, o custo é três requisições |
| **D** | **quanto `think: 'low'` reduz de fato** | `DNC-13` afirma que ataca a raiz do custo, e isso é dedução da documentação — **o número não foi medido**. A régua de 332 contra 48 tokens é o antes; o depois é sonda do corte |

---

## 6. O que ainda não se sabe

Eram cinco perguntas na sondagem. **Duas fecharam** no refinamento, **duas foram rebaixadas** a "não decide nada", e **uma continua aberta e é inerentemente assim**.

### ✅ Fechadas

| Pergunta | Resposta |
|---|---|
| **Retenção e uso de dados pela Ollama** | ✅ **documentada.** FAQ oficial: *"When using cloud-hosted models, we process your prompts and responses to provide the service but do not store or log that content and never train on it."* Três verbos negados, um afirmado — `DNC-17` |
| `tool_calls` chega **em streaming**? | ✅ **chega.** Documentado em `docs/capabilities/streaming.mdx` e `tool-calling.mdx`, com exemplo em JS: o array chega **completo num chunk**, com `arguments` já como objeto — não são deltas a remontar. A UX de stream não é obstáculo ao contorno de `format` — `DNC-19` |

⚠️ **A resposta de retenção é política, não garantia técnica** — e não substitui o que o [`ESCOPO.md`](../../ESCOPO.md) exige: os três níveis (esquema · perfil agregado · amostra) seguem **opt-in por anexo em qualquer provedor**, porque essa garantia é do app e mora em `core/`. Saber o que o outro lado promete é diferente de não precisar da garantia.

### ↓ Rebaixadas — abertas, mas não decidem nada

| Pergunta | Por que parou de importar |
|---|---|
| O cache de prompt sobrevive quanto tempo entre turnos? | O app reenvia a história inteira a cada turno porque o provedor é *stateless*, e continuará reenviando. O cache é **ganho gratuito, nunca dependência** — se expirar em segundos, nada no desenho muda |
| Há limite de tamanho de requisição? | 126 KB / 32 k tokens aceitos sem reclamação; o teto declarado é 262 k e não foi tocado. Com `costed: false`, o app não orça janela para este provedor — o limite morderia num uso que ele não faz |

### ⚠️ Aberta, e assim permanece

| Pergunta | Por que não fecha |
|---|---|
| A cota se esgota com que perfil de uso real? | **A API não expõe saldo** (sem header) e **o painel não sustenta atribuição por lote** (`DNC-16`): três leituras no mesmo dia produziram taxas por requisição que variam 4× sem correlação com o peso do lote. O único número defensável é o total — 76 requisições pesadas = 1,9 %, ordem de ~4.000/mês. **Isto não é lacuna a preencher; é a razão de `DNC-15`** — o app não exibe cota porque não há o que exibir com honestidade |

---

## 7. Metodologia e proveniência

**Como foi medido.** **76 requisições** por `curl` e `urllib`, contra `https://ollama.com`, em 13/09/2026, desta máquina — 27 delas mapeando a API (§ 1–3, [`api.md`](api.md), [`capacidades.md`](capacidades.md)), o restante na bateria de qualidade ([`modelos.md`](modelos.md)) e no diagnóstico do HTTP 400; o total é o do painel da conta, não uma contagem do lado do cliente. A tarefa de fidelidade usou a fixture `context-tanstack-query.json` do próprio repositório, **sem gastar cota do Context7**. Chave pessoal do usuário, criada em `ollama.com/settings/keys` e **revogada após a sondagem**; nunca gravada em arquivo deste repositório. Tempos medidos do lado do cliente, sujeitos à latência da rede local — TTFT e tok/s são **ordem de grandeza comparável**, não benchmark controlado.

**O que o refinamento acrescentou, e de onde.** Nenhuma requisição nova à nuvem: a sessão de refinamento leu a terceira leitura de cota no painel da conta, a documentação oficial (`docs.ollama.com/cloud` e `/faq`), as fichas de `ollama.com/library` dos dois modelos escolhidos, e o **fonte do próprio Ollama** (`api/types.go`, `docs/capabilities/thinking.mdx`, `streaming.mdx`, `tool-calling.mdx`) pelo Context7. O `/api/tags` **local** foi consultado uma vez, sem custo. Daí saíram `DNC-12` (o contrato de `think`), `DNC-17` (retenção), `DNC-22` (`truncate`/`shift`) e a resposta de `tool_calls` em streaming.

| Marca | Significado |
|---|---|
| **medido** | resposta real da API nesta data — tudo que está em tabela neste documento e nos anexos. ⚠️ A bateria de [`modelos.md`](modelos.md) é **n=1 por célula**: medida, mas não replicada |
| **publicado** | painel da conta, `docs.ollama.com`, `ollama.com/library`, ou o fonte do Ollama — a lista dos seis, a janela mensal, a concorrência 1, o contrato de `think`, a retenção |
| **não verificado** | § 6 · a hipótese de níveis 1–4 em § 3 · o quanto `think: 'low'` reduz (§ 5) |

⚠️ **Estes números envelhecem, e o serviço muda mais rápido que este documento.** O catálogo tinha 20 modelos em 13/09/2026; a faixa gratuita, seis. Remeça antes de citar qualquer número daqui em outro lugar — a regra de auto-conservação (b) do [`CLAUDE.md`](../../../CLAUDE.md) vale inteira para este arquivo.
