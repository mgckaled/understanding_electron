# N-3-A — a trava antes da porta

> Primeiro corte da trilha N-3, e **nenhuma linha de nuvem**. Material de entrada: [`docs/reference/ollama-cloud/`](../../reference/ollama-cloud/README.md) — os **seis** arquivos, lidos na íntegra —, mais as sete skills do projeto e refinamento externo obrigatório (Context7 sobre o fonte do Ollama, busca web sobre a arquitetura `qwen35` e sobre a grafia dos modelos de nuvem). Siglas nascem como `DN3A.n`.

## Contexto

A trilha N-3 integra o Ollama Cloud como provedor próprio, em cinco cortes ([`README § 5`](../../reference/ollama-cloud/README.md)). Este é o primeiro, e abre a trilha de propósito pela regra que vale nos dois primeiros cortes: **consertar antes de acrescentar.**

São três defeitos **do código de hoje**, latentes porque nenhum modelo da frota local os exercita:

1. **`DNC-14` — o raciocínio não pedido é acumulado e persistido.** Os três adaptadores fazem `reasoningAssembled += …` **incondicionalmente**, enquanto o `onThinking?.()` da linha seguinte é guardado; e `useConversationChat.ts` monta uma `ReasoningPart` sempre que a resposta traz `reasoning`, sem portão por `wantsReasoning`. Nenhum modelo local ignora `think: false` — o `gpt-oss` da nuvem ignora, e ele chega no `N-3-D`. O dano não é de tela: é **linha gravada no banco** com o botão desligado.
2. **`DNC-9` — o caminho `-cloud` custa zero linha de código e quebra a promessa central do app.** Depois de um `ollama signin`, o daemon local publica modelos de nuvem no `/api/tags`, e eles chegariam sob `service: 'ollama'`. `isCloudService()` decide por `service !== 'ollama'`, e é essa função que liga o registro no ledger de privacidade: dados sairiam da máquina — **imagem inclusive**, porque há visão na nuvem — sem uma linha no ledger. O interruptor (`OLLAMA_NO_CLOUD`, `disable_ollama_cloud`) é do usuário, não do app: **o conteúdo do catálogo local é entrada de fora.**
3. **`DNC-31` — `attention === null` carrega dois significados incompatíveis.** *"É de nuvem, RAM é de graça"* (intencional, `DN1C.2`) e *"não consegui ler a atenção deste modelo local"*. Os dois `qwen3.5` são **locais e os mais usados da frota**, e caem no ramo de nuvem: o seletor oferece **262.144** onde a máquina aguenta ~50k, `fitsInMemory` nunca diz `não cabe`, e janela grande demais faz o Ollama **descartar o começo do prompt em silêncio** — a armadilha para a qual `num_ctx` não é rede de segurança.

**Por que os três vêm antes da nuvem, e não junto dela.** `DNC-6` decide **forçar** `attention: null` para modelo de nuvem; entrar com isso antes de desfazer a sobrecarga cimentaria a ambiguidade do item 3. E o item 1 é a guarda que o modelo do `N-3-D` vai exercitar: chegar depois dele é chegar depois do dano.

**Escopo confirmado pelo dono nesta sessão de planejamento:**

| # | Decidido |
|---|---|
| 1 | a guarda do item 1 vai aos **três** adaptadores — o defeito é de classe, não do `ollama.ts` |
| 2 | o corte **tem** verificação ao vivo: quatro números na tela, porque o item 3 muda o que o popover exibe |

---

## O que já está pronto e não se reconstrói

- **A aritmética de orçamento existe e é medida** — `core/ai/memory.ts` (94 linhas) tem `OVERHEAD`, `FIXED_OVERHEAD_BYTES`, `RAM_MARGIN_BYTES`, `growingLayers`, `kvBytesPerToken`, `contextCeiling`. Nada disso nasce aqui; `growingLayers` e `kvBytesPerToken` ganham **um ramo** cada.
- **`readInfo` já casa por caminho abaixo do prefixo de família, descartando exatamente um segmento** (`D15.8`). É o que faz o bloco `qwen35.vision.*` paralelo não colidir com o real — confirmado nesta sessão contra o `/api/show` dos dois modelos, e **não precisa mudar**.
- **A presença de `onThinking` já é o pedido de raciocínio** nos três adaptadores (`D21A.1`), e `handlers.ts` já é o único lugar que traduz `wantsReasoning` nessa presença. A guarda **usa** esse desenho; não o substitui.
- **`isCloudService(service)` já existe** em `core/ai/messages.ts` e já decide o ledger de privacidade (O-8). O item 3 passa a usá-la para o teto; não cria um segundo conceito de "é nuvem".
- **`ContextControl` já trata teto nulo** (`contextWindow.status === 'open' && fits && ceiling !== null`): um modelo que não se consegue custear mostra o pill sem as faixas. **Nenhum estado de tela novo** sai deste corte.

---

## Decisões

### DN3A.1 — A guarda de raciocínio vai aos três adaptadores, não só ao `ollama.ts`

`DNC-14` nomeia o `ollama.ts` porque foi lá que a sondagem mediu o vazamento. Mas `glm.ts` tem a **linha idêntica** sobre `delta.reasoning_content`, e `gemini.ts` acumula `step.reasoningText` em dois pontos — os três com o `onThinking?.()` guardado logo abaixo do acúmulo que não é. Consertar um só deixaria dois donos da mesma regra, divergindo em silêncio, e o `N-3-C` nasce **parametrizando** o `ollama.ts` (`DNC-10`) enquanto o `N-3-D` mexe no contrato dos quatro.

A forma é a mesma nos três, e troca a chamada opcional por uma condição — o invariante vira estrutura em vez de coisa a lembrar:

```ts
if (thinkingPiece !== '' && onThinking !== undefined) {
  reasoningAssembled += thinkingPiece
  onThinking(thinkingPiece)
}
```

⚠️ **No `gemini.ts` a guarda cobre também `reasoningSignature`**, não só o texto. É a assinatura que o 21-D-B **reenvia** como passo `thought` (`D21D.6`): guardar o texto e deixar a assinatura escapar reenviaria ao provedor um raciocínio que ninguém pediu.

### DN3A.2 — O portão do renderer entra mesmo sendo segunda linha de defesa

Com `DN3A.1` no lugar, `result.value.reasoning` já chega `undefined` quando não se pediu — o portão em `useConversationChat.ts` fica, então, inalcançável pelo caminho normal. Ele entra assim mesmo, por dois motivos: é ele que torna o **estado persistido** inexpressável (que é o dano real, não a tela), e é o único que sobrevive a um quarto adaptador esquecer a guarda. São **dois** caminhos a portar: a resposta normal e a interrompida (`reasoningPartial`).

⚠️ **E é testável como discriminante**, apesar de inalcançável em produção: o mock de `window.api` pode **mentir** — devolver `reasoning` com `wantsReasoning: false` —, que é exatamente o cenário que o `gpt-oss` cria do lado de lá.

### DN3A.3 — O predicado cobre as DUAS grafias de nuvem, `-cloud` e `:cloud` — errata de `DNC-9`

`DNC-9` manda descartar todo modelo **terminado em `-cloud`**. A documentação oficial usa essa grafia (`ollama run gpt-oss:120b-cloud`), mas o catálogo mais novo usa **`:cloud`** como tag (`qwen3.5:cloud`, `kimi-k2.6:cloud`) — achado na busca web desta sessão. Esta máquina **não está logada**, então nenhuma das duas é verificável aqui: o `/api/tags` local tem 12 modelos e nenhum sufixo de nuvem (medido, 13/09/2026), o que confirma que a ameaça é **latente, não viva**.

⚠️ Um filtro só de `-cloud$` deixaria `qwen3.5:cloud` passar — **um buraco silencioso na guarda cuja razão de existir é impedir exatamente o silêncio.** O predicado cobre as duas (`/[-:]cloud$/`), e isso custa dois caracteres.

⚠️ **O custo aceito:** um modelo local criado à mão cujo nome termine em `-cloud` fica escondido. `DNC-9` já aceita — descartar não tira capacidade, **redireciona** para o serviço próprio do `N-3-C`.

### DN3A.4 — O descarte acontece em `ollamaModels`, antes do `/api/show`, nunca em `selectableModels`

O predicado é puro e mora em `core/ai/models.ts`, ao lado de `dropRedundantVariants`; a **aplicação** é no laço de `ollamaModels` (`providers/ollama.ts`), **antes** da requisição de `/api/show` daquele tag.

Filtrar no renderer (`selectableModels`) resolveria só o seletor de conversa: o painel Capacidades do Observatório chama `dropRedundantVariants` por conta própria, e `findEmbedders` também. Filtrar na origem é a forma de `features/panel/` — **estado perigoso inexpressável**, não regra que três consumidores precisam lembrar. Efeito colateral que se ganha de graça: o modelo descartado não custa uma requisição do N+1.

### DN3A.5 — `offeredCeiling` e `costsLocalRam` nascem em `core/ai/memory.ts` — e são DOIS chamadores, não um

`DNC-31` nomeia `ConversationView.ceilingOf`. **A mesma decisão está escrita de novo em `useResolvedContextWindow.ts`** (o ternário do teto *e* o `costed`), achado nesta sessão. Corrigir só o primeiro deixaria a ambiguidade viva no caminho que o `ai:propose` usa para resolver a janela fora do composer.

As duas cópias viram duas funções em `memory.ts`, que é onde a aritmética já mora e onde há meta de cobertura de 85%:

```ts
export function offeredCeiling(model: AiModel, freeBytes: number, marginBytes: number): number | null
export function costsLocalRam(model: AiModel): boolean
```

Ambas decidem por `isCloudService(model.provider)` — nuvem → teto treinado; local → `contextCeiling`. O import é `core → core` e **não cria ciclo**: `messages.ts` não importa `memory.ts` (conferido).

⚠️ **Preservar o comportamento de `current === undefined`:** hoje `costed = current?.attention !== null` devolve `true` quando nenhum modelo foi resolvido, e o chamador tem de continuar dizendo isso explicitamente. Traduzir para `costsLocalRam(current)` sem tratar o `undefined` inverte o default em silêncio.

### DN3A.6 — `AiModelAttention` ganha dois campos descritivos, e toda a aritmética híbrida fica em `memory.ts`

```ts
headCountKv: number | null            // publicado; null num híbrido que o omite
headCount: number | null              // attention.head_count, matéria da derivação
fullAttentionInterval: number | null  // 1 camada em N é atenção plena; null = atenção pura
```

`readAttention` segue **puramente descritivo** — reporta o que veio, como já faz com `slidingWindow`, cuja docstring diz que decidir se a janela está ativa *"belongs to the budget math, not here"*. A alternativa era `readAttention` já devolver o `headCountKv` derivado, e ela foi **recusada**: partiria a matemática híbrida em dois donos (o divisor em `models.ts`, o overhead e as camadas em `memory.ts`), e um leitor de `memory.ts` calcularia custo sobre um número silenciosamente inferido.

Não é o caso de `readHeadDim`, que a docstring chama de *"two spellings of the same number"* — ali as duas rotas são exatas. Aqui é **inferência**, e inferência não se esconde numa camada de normalização.

### DN3A.7 — O divisor é 4, e a fonte é o `config.json` publicado: o confundimento de `DNC-31` está RESOLVIDO

`DNC-31` registra que `head_count / 4` e `head_count / full_attention_interval` são indistinguíveis nos dois modelos medidos, e manda **não** codificar a mais fácil de escrever sem antes medir um terceiro `qwen35`. **A configuração publicada dos próprios modelos desfaz o empate sem precisar de um terceiro** (busca web, 13/09/2026):

| Modelo | `num_attention_heads` | `num_key_value_heads` | `head_dim` | camadas | `full_attention_interval` |
|---|---:|---:|---:|---:|---:|
| Qwen3.5-4B | 16 | **4** | 256 | 32 | 4 |
| Qwen3.5-2B | 8 | **2** | 256 | 24 | 4 |
| Qwen3.5-397B-A17B (MoE) | 32 | **2** | — | — | 4 |

Três leituras, e cada uma decide código:

1. **O valor real é `num_key_value_heads`, e o GGUF simplesmente não o publica** para esta arquitetura. Não é campo novo nem formato desconhecido: é **omissão**, e é isso que o ramo de derivação existe para cobrir.
2. **A razão Q/KV é 4 na linha densa e 16 na MoE** — logo **não é constante de família**. O divisor 4 vale como *medido nestes dois modelos*, nunca como regra do `qwen35`, e o comentário tem de dizer isso. A direção do erro salva: razão real **maior** que 4 superestima o custo e encolhe o teto (seguro); só uma razão real **menor** que 4 seria perigosa, e a família não a pratica.
3. **A semântica de `full_attention_interval` é confirmada por fonte externa:** uma em cada N camadas é atenção plena, as demais são recorrentes (Gated DeltaNet / Mamba-2) e carregam **estado de tamanho fixo**, não cache que cresce com o contexto. Então `growingLayers = block_count / full_attention_interval` deixa de ser hipótese e passa a ser a leitura **literal** do campo.

⚠️ **Gatilho, não pendência:** um terceiro híbrido cuja razão Q/KV não seja 4 reabre o divisor. Vai para o [`ROADMAP § 2`](../../ROADMAP.md) no fechamento.

### DN3A.8 — `OVERHEAD` passa a depender da arquitetura: 1,06 pura, 1,2 híbrida

O resíduo medido (medido/previsto) é **1,13** no `4b` e **1,18** no `2b`, contra o `OVERHEAD = 1.06` do projeto — e aponta na direção que **subestima**, que é a perigosa. `1.2` cobre os dois com folga e mantém a previsão **acima** do medido nos dois casos (39.322 contra 36.985; 14.746 contra 14.500).

Com os três termos estruturais agora confirmados por fonte publicada (`DN3A.7`), o resíduo não é mais "a fórmula pode estar errada": é sobrecusto de runtime medido, da mesma natureza do `1.06`, só maior nesta arquitetura.

### DN3A.9 — A regra de admissão exige o intervalo, e é isso que mantém o embedder fora

`readAttention` admite o bloco quando `blockCount` e `headDim` existem **e** (`headCountKv` está publicado **ou** `headCount` **e** `fullAttentionInterval` estão).

⚠️ **Exigir o intervalo não é zelo — é o que protege o embedder.** `nomic-embed-text` publica `attention.head_count: 12` e `block_count: 12`, mas **nem `head_count_kv` nem `full_attention_interval`** (medido nesta sessão). Uma regra que admitisse por `headCount` sozinho passaria a custear um embedder com número inventado, e o comentário de hoje — que prevê "um embedder, ou um formato novo" — deixaria de valer.

⚠️ **`granite4` continua sem custeio** se não publicar o intervalo, e **isso é correto**: a guarda é para híbrido **que publica o intervalo**, não para "todo híbrido". A entrada de `ARMADILHAS.md` sobre ele fica aberta, com o escopo ajustado.

### DN3A.10 — Errata: a tabela de verificação do recorte cita dois valores mortos

[`README § 5`](../../reference/ollama-cloud/README.md), linha do corte `A`, manda conferir que *"o `até 256k` virou `até 32k` nos dois"* e que *"`qwen3:4b` continua em `até 4k`"*. As duas metades estão mortas:

- **`até 32k` é resíduo da primeira versão de `DNC-31`** — a do fallback em `DEFAULT_NUM_CTX`, reescrita e reprovada na mesma sessão em que foi escrita, e cujo próprio registro diz que *"um teto arbitrário não protege nem libera"*. O esperado é o teto **real**. `DNC-32` fecha a porta do teto chumbado.
- **`qwen3:4b` não está instalado.** O `/api/tags` local tem 12 entradas e nenhuma é essa (medido, 13/09/2026). O contraste real desta máquina é **`qwen2.5:7b`**, cuja atenção é legível e cujo teto (~14k) fica bem abaixo do treinado (32.768).

---

## Passos

Cinco, commitáveis em separado. A ordem dos dois que formam o item 3 **não é a do recorte**, e o motivo está no passo 4.

### Passo 1 — a guarda de raciocínio, nos três adaptadores e no renderer

`providers/ollama.ts`, `providers/glm.ts`, `providers/gemini.ts` (dois pontos de acúmulo, mais a assinatura) e `useConversationChat.ts` (dois caminhos). `DN3A.1`, `DN3A.2`.

Nível 3, um por adaptador: uma fixture de fio **que traz raciocínio**, consumida com `onThinking: undefined`, resolve **sem** `reasoning`. Nível 2: mock que mente não persiste `ReasoningPart`, na resposta normal **e** na interrompida.

### Passo 2 — o catálogo local descarta modelo de nuvem

`isCloudRoutedName` em `core/ai/models.ts`, aplicado no laço de `ollamaModels`. `DN3A.3`, `DN3A.4`.

Nível 1 no predicado (as duas grafias aceitas, um nome comum recusado). Nível 3 em `ollamaModels`: o tag de nuvem não sai no catálogo **e** não gastou um `/api/show` — a contagem de requisições do `fetch` injetado é a asserção.

### Passo 3 — a família híbrida passa a ser custeada

O tipo em `shared/ipc.ts`, `readAttention` em `core/ai/models.ts`, os três termos em `core/ai/memory.ts`, e as oito fixtures que o `typecheck` vai cobrar. `DN3A.6`–`DN3A.9`.

⚠️ **Este passo vem ANTES do 4, invertendo o recorte, e a razão é "uma variável por vez".** Ele sozinho já conserta o sintoma visível: com `attention` deixando de ser `null` para os dois `qwen3.5`, o ternário existente passa a tomar o ramo de `contextCeiling` e o teto fica certo **sem nenhuma mudança no renderer**. Na ordem inversa haveria um commit intermediário em que os dois modelos ficam com teto `null` — pill sem faixas — o que é honesto mas é uma regressão visível atravessada no meio do corte.

### Passo 4 — o teto decide por serviço, num lugar só

`offeredCeiling`/`costsLocalRam` em `core/ai/memory.ts`; as duas cópias em `ConversationView.tsx` e `useResolvedContextWindow.ts` passam a chamá-las. `DN3A.5`.

Depois do passo 3, este passo **não muda nenhum número da frota atual** — e é justamente por isso que ele é o que importa: ele desfaz a sobrecarga de `attention === null` para que o `N-3-C` (`DNC-6`, que **força** `attention: null` na nuvem) não a cimente, e faz o caso "local com atenção ilegível" degradar para "não sei custear" em vez de "teto treinado".

### Passo 5 — verificação ao vivo (do dono) e fechamento

Roteiro de quatro números, abaixo. Depois: `HISTORY.md`, `DECISOES.md`, skill `ai`, `ARMADILHAS.md`, `ROADMAP.md`, e o plano para `implemented/`.

---

## Verificação

### Automatizada — e cada teste precisa ser visto vermelho

| Nível | O que prova | Sabotagem que tem de reprovar |
|---|---|---|
| 1 | `isCloudRoutedName` aceita `gpt-oss:120b-cloud` **e** `qwen3.5:cloud`, recusa `qwen3.5:4b` | trocar por `endsWith('-cloud')` → a segunda grafia reprova |
| 1 | `readAttention` devolve bloco para o payload real do `qwen3.5:4b` e **`null`** para o do embedder (`head_count` sem intervalo) | admitir por `headCount` sozinho → o caso do embedder reprova |
| 1 | `kvBytesPerToken` dos dois `qwen3.5` fica **≥ o medido** (36.985 / 14.500) e dentro de ~+15% | overhead `1.06` no híbrido → cai abaixo do piso medido. **É o teste que pega um divisor errado na direção perigosa** |
| 1 | `offeredCeiling` dá teto treinado para nuvem e `contextCeiling` para local; `costsLocalRam` idem | decidir por `attention === null` → o `qwen3.5` local recebe 262.144 e reprova |
| 3 | com `onThinking: undefined`, fio com raciocínio resolve sem `reasoning` — nos três adaptadores | remover a condição → `reasoning` volta |
| 3 | `ollamaModels` não sonda nem lista um tag de nuvem | filtrar depois do laço → a contagem de requisições reprova |
| 2 | mock que mente não persiste `ReasoningPart`, nos dois caminhos | remover o portão → a parte aparece |

⚠️ **Sabotagem estreita, uma por asserção.** Anular a tela inteira num teste de duas asserções derruba a primeira e deixa a segunda sem exercício — custou duas sabotagens para o mesmo teste no 23-F.

⚠️ **Vermelho tem uma forma só:** `Tests N failed`, com o **nome** do teste na lista de falhas. `Tests no tests` é a suíte não tendo corrido, e é o que uma sabotagem por shell produz ao quebrar a sintaxe.

⚠️ **Manter o símbolo em uso ao sabotar**, ou o `typecheck` reprova antes do Vitest e o vermelho que aparece é do portão errado.

### Ao vivo (`pnpm dev`) — quatro números, e o contraste é o que prova

| # | O que olhar | Esperado |
|---|---|---|
| 1 | popover de modelo, linha do `qwen3.5:4b` e do `qwen3.5:2b` | sai de `até 256k` para **~50k** e **~180k** |
| 2 | linha do `qwen2.5:7b`, e nenhuma linha local em 256k | **~14k**, inalterado — atenção legível, nada mudou |
| 3 | linhas Gemini e GLM | teto treinado, e **nenhuma** ganhou `não cabe` |
| 4 | pill de contexto com o `qwen3.5:4b` escolhido | dica lê `até ~50k`; as faixas param abaixo disso, sem oferecer 131072/262144 |

Números calculados nesta sessão com a frota real e **5,96 GiB livres**:

| Modelo | KV/token previsto | medido | teto hoje | teto depois |
|---|---:|---:|---:|---:|
| `qwen3.5:4b` | 39.322 B | 36.985 B | 262.144 *(ficção)* | **~53k** |
| `qwen3.5:2b` | 14.746 B | 14.500 B | 262.144 *(ficção)* | **~183k** |
| `qwen2.5:7b` | 60.785 B | — | 13.900 | 13.900 |
| `gemma3:4b` | 4.342 B | — | 131.072 | 131.072 *(satura o treinado)* |

⚠️ **O teto anda com a RAM livre** — `contextCeiling` lê `freeBytes` na hora, e esta máquina oscila 1,5–2 GiB. Os dois primeiros são ordem de grandeza, não constante: **o que reprova é continuar 262.144**, não um desvio de alguns milhares de tokens.

---

## Riscos nomeados

- **O divisor 4 é da linha densa, não da família** (`DN3A.7`). Mitigado por três coisas: o overhead generoso de `1.2`, o teste de piso medido, e o gatilho no `ROADMAP`. Não mitigado para uma razão real **menor** que 4, que a família não pratica hoje.
- **A ameaça de `DNC-9` não é reproduzível nesta máquina** — exige `ollama signin`. A guarda se prova por teste de nível 1/3 com nome injetado; a grafia real de um catálogo logado continua **não medida** (`DN3A.3`).
- **Oito fixtures mudam de forma** ao ganhar os dois campos. É churn mecânico e guiado pelo compilador, mas atravessa quatro arquivos de teste — e um deles é `test/api-mock.ts`, que é `satisfies Api` e reprova a suíte inteira se ficar incoerente.
- **`CONTEXT_BANDS` tem 262144 e o comentário justifica a faixa citando o `qwen3.5:2b`** (`budget.ts`). Depois do corte essa faixa deixa de ser oferecida a ele (o teto real é menor) e passa a servir só a modelo de nuvem. Ajuste de uma linha, item de auto-conservação (b), não de escopo.
- **O teste de `useConversationChat` prova um portão inalcançável em produção** (`DN3A.2`). Vacuosidade é propriedade do par teste × implementação: se um dia a guarda do adaptador sair, é este teste que continua discriminando — e é por isso que ele descreve o cenário do `gpt-oss`, não "o portão existe".

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 13/09/2026 | Passo 5: verificação ao vivo pelo dono — **tudo ok** — e fechamento | Veredito do dono, que vale mais que o roteiro: *"os números se movem, porém mais restritivos em termos de limites reais… agora estamos nas faixas reais com salvaguardas reais"*, e *"thinking mode funcionando apenas para os modelos capazes, como deve ser"*. ⚠️ **O roteiro que entreguei errou de novo o mesmo jeito que o do 23-G e o do 23-J:** prometi números fixos (`~50k`/`~180k`) para uma grandeza que **se move com a RAM livre**, e o próprio `pnpm dev` derrubou a livre de 6,05 para 4,96 GiB entre escrever a lista e olhá-la — os valores viraram 26k/112k, e o `qwen2.5:7b` foi para `não cabe`. A segunda versão do roteiro trocou número por **regra** (*o que reprova é continuar em 262.144*), que é a forma certa: **um roteiro que promete um número precisa dizer contra qual estado da máquina.** Fechamento: `HISTORY.md` com a 11ª entrada empurrando o `23-B` para o arquivo, 10 linhas em `DECISOES.md` (575 → 585), seis trechos da skill `ai` que este corte tornou falsos, duas entradas de `ARMADILHAS.md` mudando de status e **uma nova** (as duas grafias de `-cloud`), `ROADMAP` com a `F-6` reduzida a uma frente e o gatilho do divisor híbrido |
| 13/09/2026 | Passos 1–4 implementados; falta o passo 5, que é do dono | **Passo 1 — a guarda nos três adaptadores.** O `test_related` reprovou antes de eu escrever teste nenhum, e estava certo: **quatro testes existentes codificavam o defeito** — dois em `gemini.test.ts` e dois em `ConversationView.test.tsx` pediam `reasoning` de volta sem ter passado `onThinking`/ligado o interruptor. Nenhum foi enfraquecido: os de provedor passaram a pedir, e os de tela ganharam `THINKING_MODEL` + `askForReasoning`. No `gemini.ts` a guarda ficou numa linha só, em `stepFor`: um passo `thought` não pedido nasce **não-`known`**, o que descarta texto **e** assinatura sem espalhar condição por quatro pontos. Vermelho provado nos três adaptadores e nos dois caminhos do renderer, cada sabotagem derrubando só o seu teste. **Passo 2 — o descarte.** Duas sabotagens, dois defeitos distintos: o predicado só com `-cloud$` derruba o teste da segunda grafia, e filtrar **depois** do laço derruba a contagem de requisições (4 em vez de 2). **Passo 3 — a família híbrida.** A troca de fixture revelou o mecanismo antes do teste: sem os campos novos, `fullAttentionInterval` chegava `undefined`, `=== null` dava falso, e **todos** os modelos puros passaram a pagar o overhead híbrido — 43,2 KB/token onde se mediu 38,2, exatamente 1,2/1,06. **Passo 4 — e aqui a sabotagem me corrigiu.** Os dois primeiros testes de `offeredCeiling` nasceram **vacuosos**: depois do passo 3 o `qwen3.5` tem bloco de atenção, então o ramo `attention === null` não o pega mais — o passo 3 sozinho já conserta o sintoma visível. O que discrimina o ramo por serviço é um modelo **local de atenção ilegível** (formato `granite4`), que sob o ramo velho recebia o teto treinado. Teste acrescentado, e só então os dois reprovaram. É a régua da skill `testing` em ação: *vacuosidade é propriedade do par teste × implementação* |
| 13/09/2026 | Plano escrito. Sete skills invocadas, os **seis** arquivos de `reference/ollama-cloud/` lidos na íntegra, `DN3A.1`–`DN3A.10` fixadas | **O refinamento externo mudou duas coisas do recorte, não confirmou-o.** (a) O confundimento de `DNC-31` está **resolvido sem um terceiro modelo**: o `config.json` publicado dá `num_key_value_heads` = 4 (4B) e 2 (2B) — o divisor é 4 —, e a MoE de 397B usa 2 sobre 32 cabeças, razão 16, o que prova que **não é constante de família**; a semântica de `full_attention_interval` (camada recorrente = estado fixo, não cache que cresce) veio de fonte externa. (b) **Existem duas grafias de modelo de nuvem** — a doc oficial usa `gpt-oss:120b-cloud`, o catálogo novo usa `qwen3.5:cloud` —, então o `-cloud$` de `DNC-9` deixaria a segunda passar, um buraco silencioso na guarda contra o silêncio. **Um terceiro achado é do código, não externo: `useResolvedContextWindow.ts` repete o ternário sobrecarregado que `DNC-31` só nomeia em `ConversationView.tsx`** — consertar um deixaria a ambiguidade viva no caminho do `ai:propose`. Sondagem própria (só metadados, nenhum modelo carregado): `/api/show` dos dois `qwen3.5`, do embedder e de três vizinhos, mais o catálogo local — 12 modelos, **nenhum `-cloud`**, confirmando que a ameaça é latente. A razão Q/KV dos vizinhos (8, 7 e 2) foi o que descartou "4 é convenção qwen". Errata de `DNC-31`/README registrada em `DN3A.10`, e **a ordem dos dois passos do item 3 foi invertida** contra o recorte, para não atravessar um commit com o teto `null` |
