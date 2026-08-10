# 15 — Orçamento de contexto e modelo por conversa

**Depende de:** [14 — Persistência das conversas](../implemented/14-persistencia-das-conversas.md) · **Entrega:** o campo de texto livre onde hoje se digita o nome do modelo vira **seletor com catálogo real**; `num_ctx` deixa de ser o default silencioso do Ollama e passa a ser escolha da conversa, gravada em `settings`; e a conversa mostra quanto do orçamento já gastou — porque, sem isso, o Ollama joga fora o começo do histórico sem dizer nada.

> Terceiro plano do [arco conversacional](README.md#o-arco-conversacional-1320). **Nenhuma tabela nova e nenhuma migração:** tudo que este plano guarda cabe na coluna `settings` que a [D14.1](../implemented/14-persistencia-das-conversas.md) criou vazia. Se um `CREATE TABLE` aparecer no diff, alguma coisa saiu do lugar.

---

## O caso

Quatro coisas estão erradas hoje, e as quatro são do mesmo tipo: **o aplicativo não sabe o que está fazendo com o contexto.**

1. **O modelo é um `<input>` de texto livre** com `'gemma3:4b'` chumbado como default. Digitar `gemma3:4bb` produz um erro `upstream` genérico; não há como saber quais modelos existem, e nada no aplicativo sabe que só um deles enxerga imagem. A frota passou de 10 para 14 modelos entre duas sessões e **nenhuma linha do aplicativo notou**.
2. **`num_ctx` nunca é enviado**, então vale o default do Ollama — **4096** nesta máquina, contra os 131.072 que o `gemma3:4b` foi treinado para aceitar. Ninguém escolheu esse número.
3. **Quando o histórico passa do teto, o Ollama descarta o começo e responde como se nada tivesse acontecido.** Medido abaixo, e é a razão de este plano existir antes do anexo: um documento de 8k tokens (plano 17) estoura o default de 4096 **sozinho**, e o usuário receberia uma resposta confiante sobre a metade final de um PDF.
4. **Nada sabe o que um contexto custa de RAM** — acrescentado em 10/08/2026, com a frota nova. Oferecer ao usuário o teto que o modelo declara parece a coisa honesta a fazer, e para o `phi4-mini` — que pesa 2,32 GB — significa oferecer **16 GB de cache** numa máquina de 16 GB. Um seletor construído sobre o dado verdadeiro entrega uma máquina travada.

O item 3 é a mesma classe da [falha silenciosa do NL→SQL](../../HISTORY.md) e da [imagem que o modelo descreve sem ter recebido](../../HISTORY.md): num caminho gerado por modelo, **o perigo não é a exceção, é o sucesso**. O item 4 é de outra família e vale distingui-la: ali o dado está correto e a **conclusão** que se tira dele é que está errada.

**Fora deste plano:** anexo e o mecanismo de `MessagePart` (16), extratores de documento e imagem e o `/api/ps` em Configurações (17), DuckDB (18). Prompt de sistema por conversa também fica fora — a coluna `settings` o recebe sem migração no dia em que houver o que escrever nele, e hoje não há. **Provedores de nuvem ficam fora**, com o motivo e a costura de custo zero que entra na D15.9.

---

## O que foi medido no Ollama desta máquina

Sondas diretas contra o Ollama 0.32.6 servindo os modelos de `C:\ollama-models`, na máquina registrada no [`CLAUDE.md`](../../../CLAUDE.md) — CPU sem aceleração. **Cada linha abaixo decide uma linha de código**, e duas delas derrubam premissas que já estavam escritas em documento dono.

### O catálogo

| | Medido |
|---|---|
| `/api/tags` traz `capabilities`? | **sim, e incompletas** — ver o alerta abaixo |
| `/api/tags` traz o teto de contexto? | **não** — não existe campo |
| `/api/show` traz `capabilities`? | sim, e **completas** |
| `/api/show` traz o teto de contexto? | sim, em `model_info`, sob chave **prefixada por uma família que não é a do modelo** — ver abaixo |
| Custo de `/api/show` | ~350 ms cada · **14 modelos em 4,9 s** (remedido em 10/08/2026) |
| `/api/show` carrega o modelo? | **não** — `/api/ps` continua vazio depois de **catorze** chamadas |

> ⚠️ **`/api/tags` omite `vision`, e isso invalida uma frase do [`ESCOPO.md`](../../ESCOPO.md).**
>
> ```
> gemma3:4b          tags=["completion"]                    show=["completion","vision"]
> gemma3:1b          tags=["completion"]                    show=["completion"]
> phi4-mini          tags=["completion","tools"]            show=["completion","tools"]
> qwen2.5:7b         tags=["completion","tools"]            show=["completion","tools"]
> mistral:7b         tags=["completion","tools"]            show=["completion","tools"]
> llama3.1:8b        tags=["completion","tools"]            show=["completion","tools"]
> qwen2.5-coder:7b   tags=["completion","tools","insert"]   show=["completion","tools","insert"]
> qwen2.5-coder:3b   tags=["completion","tools","insert"]   show=["completion","tools","insert"]
> ```
>
> `tools` aparece nos dois; **`vision` só aparece no `/api/show`**. O escopo dizia *"modelo que declare `vision` nas `capabilities` do `/api/tags`"*, e o diário da fatia 1 do [plano 09](09-camada-de-ia.md) deixou em aberto *"gate via `/api/tags` para popular um dropdown"*. Construído assim, o gate do plano 17 **recusaria o único modelo com visão da máquina** — falha na direção segura, mas a feature simplesmente não funcionaria, e a causa estaria a dois documentos de distância. Corrigido no `ESCOPO.md` e registrado no [`HISTORY.md`](../../HISTORY.md) na mesma sessão em que foi medido.
>
> 🔍 **`insert` apareceu sozinho, e é a prova empírica da D15.1.** Os dois `qwen2.5-coder` declaram uma quarta capability — preenchimento no meio do texto — que nenhum modelo da frota anterior tinha. Ninguém a previu, ela chegou instalando um modelo, e um `z.enum` fechado sobre as três conhecidas transformaria os dois modelos novos em erro de parse do catálogo inteiro. `capabilities: string[]` deixou de ser precaução e passou a ser medição.

### A chave do teto de contexto não é a família do modelo

A regra "não derivável do nome" já estava escrita; a frota nova a torna mais forte, porque agora há um caso em que o prefixo **não tem relação nenhuma** com o nome do modelo:

| Modelo | Chave em `model_info` |
|---|---|
| `mistral:7b` | **`llama.context_length`** |
| `llama3.1:8b` | `llama.context_length` |
| `phi4-mini` | `phi3.context_length` |
| `qwen2.5-coder:7b` | `qwen2.context_length` |
| `gemma3:4b` | `gemma3.context_length` |

Um `mistral` responde sob `llama.`, e dois modelos de famílias comerciais diferentes compartilham o mesmo prefixo. Nunca se monta a chave — e o teste do passo 1 ganha o `mistral:7b` como caso, porque é ele que falha se alguém "consertar" a busca para usar o nome.

> 🔧 **Correção de 10/08/2026, ao implementar o passo 1: "procurar pelo sufixo" está errado, e é errado de um jeito que passa nos testes.** Um modelo com visão carrega um **segundo namespace paralelo** — `gemma3.block_count` é 34 e `gemma3.vision.block_count` é 27, e os dois terminam em `.block_count`. O que salva a busca por sufixo hoje é acidente: o Ollama devolve `model_info` **ordenado**, e `vision` calha de ordenar depois de `attention`, `block_count` e `embedding_length`, então o primeiro casamento é o certo. Um sub-namespace que ordenasse **antes** — uma torre de `audio.*`, que existe em parentes desta família — sombrearia o valor bom.
>
> A regra implementada é **descartar o primeiro segmento e comparar o resto exatamente**: `vision.block_count` não é `block_count`, qualquer que seja a ordem. Travado por um caso de teste sintético (o único do arquivo) com namespace `audio.*`, **visto vermelho** com a implementação por sufixo antes de virar verde — e o caso da visão passou nas duas, que é a demonstração de que ele sozinho não provava nada.
>
> **Considerada e não adotada:** ler `general.architecture`, que reporta `gemma3`/`llama`/`phi3` e daria o prefixo de forma autoritativa em vez de adivinhada. Funciona; só exige mais um campo presente e não compra nada além do que o descarte de segmento já dá.

### O teto treinado de cada modelo da frota

A sondagem encontrou catorze entradas; **duas foram removidas em seguida** (ver abaixo), deixando doze — das quais **cinco são variantes `-custom` criadas por Modelfile**, com os mesmos pesos e o mesmo teto das originais. O catálogo as mostra como modelos distintos porque, para o Ollama, elas são — e o seletor do passo 2 vai listar as doze.

| Modelo | Teto treinado | `capabilities` | Disco |
|---|---|---|---|
| `gemma3:4b` | 131.072 | `completion`, **`vision`** | 3,11 GB |
| `gemma3:1b` | 32.768 | `completion` | 0,76 GB |
| `phi4-mini` | 131.072 | `completion`, `tools` | 2,32 GB |
| `qwen2.5:7b` | 32.768 | `completion`, `tools` | 4,36 GB |
| `qwen2.5-coder:7b` | 32.768 | `completion`, `tools`, **`insert`** | 4,36 GB |
| `qwen2.5-coder:3b` | 32.768 | `completion`, `tools`, **`insert`** | 1,80 GB |
| `nomic-embed-text` | 2.048 | `embedding` | 0,26 GB |

> **`mistral:7b` e `llama3.1:8b` foram medidos e depois desinstalados**, decidido na mesma sessão. O `mistral:7b` era dominado — mesmo porte e mesmo teto de 32k do `qwen2.5:7b`, sem especialização em código, e **128 KB/token de cache contra 56**. O `llama3.1:8b` tinha um único atrativo, os 131.072 de teto, e ele é inalcançável nesta máquina por qualquer caminho (detalhado adiante). Juntos ocupavam **8,65 GB** de disco.
>
> **As medições dos dois ficam**, e não por nostalgia: a chave `llama.context_length` do `mistral:7b` é o caso de teste do passo 1, e os payloads do `/api/show` foram capturados antes da remoção. Um modelo desinstalado não desfaz o que ele ensinou — e reinstalar para reproduzir custa 4,6 GB de download, o que é exatamente o motivo de a medida ficar escrita.

### O custo de `num_ctx` — e a surpresa

Mesmo prompt de 24 tokens no `gemma3:4b`, descarregando o modelo entre cada medida:

| `num_ctx` | RAM residente | Carga (disco frio) | Prefill |
|---|---|---|---|
| 4.096 | 2,91 GB | 48,5 s | 2,4 s |
| 16.384 | 2,95 GB | 51,1 s | 2,0 s |
| 32.768 | **3,03 GB** | 51,3 s | 1,7 s |

**Oito vezes mais contexto custa 120 MB** — *neste modelo*. A ressalva não estava na primeira redação deste plano e é o que a seção seguinte corrige: a medida foi feita no `gemma3:4b`, que é o **único modelo da frota com atenção de janela deslizante**, e é justamente a janela que torna o cache KV barato. Reservar a janela continua sendo barato comparado a enchê-la — o prefill segue sendo o custo dominante —, mas a frase *"`num_ctx` não é um botão de consumo de RAM"* generalizou uma arquitetura para todas.

O outro número da tabela é de outro assunto e vale sozinho: **carregar o `gemma3:4b` do disco custa ~50 s.** Trocar de modelo não é instantâneo, e o seletor precisa dizer isso.

### O custo de `num_ctx` é da arquitetura de atenção, não do `num_ctx`

Medido em 10/08/2026, **sem carregar modelo nenhum**: o `/api/show` já entrega os parâmetros de atenção em `model_info`, e o tamanho do cache KV é aritmética sobre eles.

```
bytes por token = 2 (K e V) × block_count × head_count_kv × head_dim × 2 (f16)
```

`head_dim` vem de `attention.key_length` quando existe (as duas famílias Gemma), senão de `embedding_length ÷ head_count`.

| Modelo | blocos | cabeças KV | `head_dim` | KB/token | `sliding_window` |
|---|---|---|---|---|---|
| `gemma3:1b` | 26 | 1 | 256 | 26 → **~4 crescem** | 512 |
| `gemma3:4b` | 34 | 4 | 256 | 136 → **~24 crescem** | 1024 |
| `qwen2.5-coder:3b` | 36 | 2 | 128 | **36** | — |
| `qwen2.5:7b` · `qwen2.5-coder:7b` | 28 | 4 | 128 | **56** | — |
| `phi4-mini` | 32 | 8 | 128 | **128** | 262144 — **inerte** |
| ~~`mistral:7b` · `llama3.1:8b`~~ | 32 | 8 | 128 | 128 | — |

As duas últimas linhas eram idênticas, e é por isso que remover os dois modelos **não custou nada ao argumento**: o `phi4-mini` sobrou como o exemplar de cache caro, e é um exemplar melhor. Ele tem os **pesos mais leves da faixa de conclusão depois do 3b** (2,32 GB) e o **cache mais caro da frota** (128 KB/token). A lição fica mais visível nele do que ficava no `llama3.1:8b`, que era pesado nas duas pontas: **o tamanho do modelo não prediz o custo do contexto.**

Num modelo com janela deslizante, só as camadas globais crescem com o `num_ctx`; as locais ficam presas ao tamanho da janela, qualquer que seja o contexto pedido. No Gemma 3 a proporção é de uma global a cada cinco locais, então das 34 camadas do `gemma3:4b` apenas ~6 escalam — **24 KB por token contra os 136 KB que a arquitetura teria sem janela.**

> ⚠️ **Declarar `sliding_window` não basta: ele tem de ser menor que o `num_ctx`.** O `phi4-mini` declara 262.144 — o dobro do próprio teto de contexto. A chave existe, o campo lê bonito, e a janela nunca fecha sobre nada. Um código que testar `if (slidingWindow)` classifica o `phi4-mini` como barato e erra por 4 GB. O teste é `slidingWindow < numCtx`.

**A consequência, projetada para 32.768 tokens:**

| Modelo | Pesos | KV a 4.096 | KV a 32.768 | KV no teto treinado |
|---|---|---|---|---|
| `qwen2.5-coder:3b` | 1,80 GB | 147 MB | 1,13 GB | — (teto é 32.768) |
| `gemma3:4b` | 3,11 GB | 98 MB | 768 MB | 3,1 GB (131.072) |
| `qwen2.5-coder:7b` | 4,36 GB | 229 MB | 1,75 GB | — (teto é 32.768) |
| **`phi4-mini`** | **2,32 GB** | 524 MB | 4,00 GB | **16,00 GB** (131.072) |

**O `phi4-mini` pesa 2,32 GB e, no teto que ele próprio declara, pede 16 GB de cache KV — numa máquina de 16 GB totais.** Um modelo que cabe folgado no disco e na RAM pede, para usar o contexto que anuncia, **sete vezes o próprio tamanho**. É o número que a D15.2 precisava, e a coluna de pesos está na tabela de propósito: **é a justaposição das duas primeiras colunas que carrega a lição.** O teto do modelo não é o teto útil, e o motivo não é só tempo de prefill — é que não cabe.

Compare-o com o `gemma3:4b`, que pesa **mais** (3,11 GB), declara o **mesmo** teto de 131.072, e o compra por 3,1 GB de cache em vez de 16. A diferença inteira é a janela deslizante.

> ✅ **A discordância entre aritmética e medição foi resolvida pelo passo 0, em 10/08/2026 — e a aritmética estava certa.**
>
> Medido no `qwen2.5-coder:3b` (sem janela), 4.096 contra 32.768, um modelo residente por vez: **38,0 KB por token** contra os 36,0 previstos. Fator de **1,055** — os 5,5% são overhead do runner, não erro de modelo.
>
> Isso isola a anomalia no `gemma3:4b`, e explica-a: os 4,3 KB/token medidos lá, divididos pelos 4 KB que uma camada custa naquele modelo, dão **1,07 camadas**. Com janela deslizante ativa, **o Ollama contabiliza o crescimento como se uma única camada escalasse com o `num_ctx`** — não as ~6 globais que a proporção 5:1 do Gemma 3 sugeriria. Empírico, ajustado a um modelo; o que lhe dá crédito é fechar as **duas** medições com a mesma constante de overhead.
>
> A tabela acima deixa de ser teto superior e passa a ser previsão, com uma correção: a linha do `gemma3:4b` conta 6 camadas crescendo e o certo é **1**.

**O orçamento desta máquina a 32.768 tokens**, agora com a fórmula fechada pelo passo 0: `base = disco + 0,33` e `KV = KB/token × 1,06 × num_ctx`. A linha do `qwen2.5-coder:3b` é **medida**; as demais são a fórmula aplicada.

| Modelo | Disco | Base | KV a 32k | **Total** |
|---|---|---|---|---|
| `gemma3:1b` | 0,76 | 1,09 | 0,03 | **1,12** |
| `qwen2.5-coder:3b` | 1,80 | 2,13 | 1,19 | **3,32** ✔ medido |
| `gemma3:4b` | 3,11 | 3,44 | 0,13 | **3,57** |
| `qwen2.5:7b` | 4,36 | 4,69 | 1,86 | **6,55** |
| `qwen2.5-coder:7b` | 4,36 | 4,69 | 1,86 | **6,55** |
| `phi4-mini` | 2,32 | 2,65 | 4,24 | **6,89** |

> 🔍 **O `phi4-mini` é o mais caro da frota a 32k, e é o segundo mais leve em disco.** 2,32 GB de pesos contra os 4,36 do `qwen2.5:7b` — e mesmo assim ele termina **acima**, porque paga 4,24 GB de cache contra 1,86. Quem orçar por tamanho de modelo, que é o reflexo e é o que o `ollama list` mostra, conclui que o `phi4-mini` custa metade. A 4k ele de fato custa menos; a 32k custa mais. **O ordenamento entre dois modelos inverte conforme o `num_ctx`**, e nenhuma coluna do `ollama list` deixa isso visível — é a razão de o `AiModel` carregar o bloco `attention`.

Cruzando com os três cenários de RAM livre:

| Modelo | 6 GB (dev típico) | 7,5 GB (só VS Code) | 9 GB (só o app) |
|---|---|---|---|
| `gemma3:1b` · `qwen2.5-coder:3b` · `gemma3:4b` | ✅ | ✅ | ✅ |
| `qwen2.5:7b` · `qwen2.5-coder:7b` | ❌ | ✅ | ✅ |
| `phi4-mini` | ❌ | ⚠️ 0,6 de folga | ✅ |

**Isto é o plano se justificando.** No cenário em que o aplicativo é desenvolvido, **metade da frota não roda a 32k** — e nada hoje avisa. Um seletor que ofereça 32.768 a qualquer modelo entrega *swap* em três dos seis. O teto de RAM da D15.2 não é uma salvaguarda teórica para um caso extremo: ele age no caso comum.

Três conclusões, agora com número fechado em vez de faixa:

- **`qwen2.5-coder:3b` cabe com folga nos três cenários** — 3,32 GB medidos contra 6 no pior caso. É isso, e não a especialização (que o 7b também tem), que o torna candidato a default do caminho NL→SQL.
- **O `gemma3:4b` consegue os 131.072 que declara — em RAM.** Base 3,44 mais 0,53 de cache dão **3,97 GB**, que cabe até no cenário apertado. A janela deslizante o torna o único modelo da frota cujo teto declarado é financiável, e isso *inverte* o que este plano supunha. O que o mantém fora não é memória: são os **~87 minutos de prefill** a 25 tok/s. A D15.2 tinha duas razões para desconfiar do teto declarado; para este modelo, sobrou uma.
- **O `phi4-mini` a 131.072 pede 19,6 GB** — acima da RAM total da máquina, sem ambiguidade. Mesmo teto declarado que o `gemma3:4b`, **cinco vezes** o custo, e a diferença inteira é a janela.

### O truncamento silencioso

`gemma3:1b`, prompt de 7.980 caracteres com um código no começo (`ALFA-111`) e outro no fim (`OMEGA-999`), pedindo os dois de volta:

| `num_ctx` | `prompt_eval_count` | Resposta |
|---|---|---|
| 4.096 (cabe) | 1.850 | `OMEGA-999.` |
| 512 (não cabe) | **259** | `OMEGA-999.` |

Mil e quinhentos tokens desapareceram, **sem erro, sem aviso, sem campo de status** — a única evidência é `prompt_eval_count` vir menor do que o prompt enviado. E o que sobrevive é o **fim**: o começo é descartado. Numa conversa longa, isso significa perder a pergunta original e manter as respostas recentes.

### O cache de prefixo, e por que a janela deslizante está morta

`gemma3:1b`, blocos de ~450 tokens, medindo `prompt_eval_duration`:

| Turno | Tokens | Prefill |
|---|---|---|
| 1. `A+B` (frio) | 899 | 11.753 ms |
| 2. `A+B` de novo — **prefixo idêntico** | 899 | **287 ms** |
| 3. `A+B+C` — **acrescenta ao fim** | 1.343 | 7.565 ms |
| 4. `B+C` — **descarta o começo** | 899 | **8.500 ms** |
| 5. `B+C+A` — acrescenta sobre o prefixo do turno 4 | 1.343 | 3.576 ms |

Compare as linhas **2 e 4**: o mesmo número de tokens, **287 ms contra 8.500 ms — trinta vezes**. A diferença inteira está em o prefixo ter mudado ou não na primeira linha.

E não é um custo pago uma vez. Uma janela deslizante descarta o começo **a cada turno**, então cada turno recomeça do zero: o custo do turno deixa de ser proporcional ao que foi acrescentado e passa a ser proporcional ao histórico inteiro, para sempre. Numa CPU sem GPU isso é a diferença entre uma conversa que responde e uma que não termina.

### O contador

**Não existe tokenização exata antes de enviar.** `/api/tokenize`, `/api/detokenize` e `/api/count_tokens` devolvem **404** neste runtime; os endpoints existem como PR e issue em aberto no repositório do Ollama, não como API. A única contagem verdadeira é `prompt_eval_count`, que chega **depois** da chamada.

Densidade de token medida em português, e a variação é o dado útil:

| Texto | Caracteres por token |
|---|---|
| Prosa variada (o `ESCOPO.md`, medido na revisão de ago/2026) | **3,8** |
| Frase repetida centenas de vezes | **4,3 – 5,1** |

Estimar por caractere erra até **um terço** conforme o texto se repete. Serve para um medidor; não serve para um portão.

---

## Decisões tomadas

### D15.1 — O catálogo é `/api/tags` **mais** um `/api/show` por modelo

N+1 chamadas, deliberadamente, porque a alternativa não funciona: `/api/tags` sozinho não sabe que o `gemma3:4b` enxerga e não sabe o teto de contexto de ninguém. São **4,9 s para catorze modelos**, sem carregar nada — custo de latência, não de RAM.

Isso torna o catálogo **caro o bastante para não ser refeito a cada abertura de um dropdown, e barato o bastante para ser refeito quando o usuário pedir.** Ele é uma query do cache de servidor (D14.4) como qualquer outra, com `staleTime` infinito e um botão de recarregar — instalar um modelo novo é um evento do sistema, não do aplicativo, e não há como observá-lo. A frota saiu de 10 para 14 entradas entre duas sessões sem que nada no aplicativo pudesse ter notado, o que é o argumento do botão.

```ts
type AiModel = {
  provider: 'ollama'             // discriminante — ver D15.9
  name: string
  parameterSize: string          // '4.3B' — details.parameter_size
  sizeBytes: number
  capabilities: string[]         // de /api/show, NUNCA de /api/tags
  contextLength: number | null   // model_info, por sufixo '.context_length'

  // Parâmetros de atenção: chegam de graça na mesma resposta e são o que
  // permite calcular o custo de RAM de um num_ctx antes de pagá-lo (D15.2).
  // null quando o model_info não os traz — um embedder, ou um formato novo.
  attention: {
    blockCount: number
    headCountKv: number
    headDim: number              // key_length, ou embedding_length / head_count
    slidingWindow: number | null
  } | null
}
```

`capabilities` fica como `string[]` e não como união fechada: a lista é do Ollama, cresce sem nos avisar, e um `z.enum` transformaria um modelo novo em erro de parse. **Isso deixou de ser hipótese em 10/08/2026** — os dois `qwen2.5-coder` chegaram declarando `insert`, uma capability que nenhum modelo da frota anterior tinha e que ninguém previu. Quem pergunta *"tem `vision`?"* pergunta a uma função de `core/`, que é onde o plano 17 vai pendurar o gate — decisão que dois chamadores precisam tomar não mora ao lado de um deles ([`HISTORY.md`](../../HISTORY.md)).

O bloco `attention` é a diferença entre um seletor que oferece 131.072 ao `phi4-mini` e um que sabe que isso são 16 GB de cache. Ele **não** acrescenta nenhuma chamada de rede: sai do mesmo `model_info` de onde o `contextLength` já é lido.

**Descartado** ler `capabilities` de `/api/tags` mesmo sabendo que faltam, completando só quando o usuário abrir o detalhe: seria um gate que funciona na tela de configurações e falha no envio, que é o pior lugar.

### D15.2 — `num_ctx` é escolha da conversa, e o default sobe

A medição matou o motivo de ser conservador **no `gemma3:4b`**: 32k custa 120 MB ali. O default deixa de ser o 4096 do Ollama e passa a ser **um valor nosso, escrito**. O que mudou com a frota nova é o **limite**: não é mais só o teto do modelo.

Mora em `settings` da conversa, JSON, sem migração (D14.1). Escala de conversa e não de máquina pela régua da D13.4: `num_ctx` **muda o que o modelo responde** — muda o que ele consegue enxergar do próprio histórico.

#### O teto oferecido é o menor de dois

```
tetoOferecido = min(contextLength, tetoDeRam)

tetoDeRam  = (ramLivre − margem − base) ÷ kvPorToken
base       = pesos + OVERHEAD_FIXO
kvPorToken = 2 × camadasQueCrescem × headCountKv × headDim × 2 × OVERHEAD

camadasQueCrescem = janelaAtiva ? 1 : blockCount
janelaAtiva       = slidingWindow !== null && slidingWindow < contextLength
```

#### `ramLivre` é leitura de runtime, e a `margem` sai da medição

Nenhum dos dois é constante escrita no código, e o motivo do segundo é mais interessante que o do primeiro.

**A RAM livre varia 3 GB nesta máquina**, medido em 10/08/2026 — mais que o peso da maioria dos modelos da frota:

| Cenário | Livre |
|---|---|
| só o aplicativo Electron rodando | **~9 GB** |
| tudo fechado, só o VS Code | **~7,5 GB** |
| ambiente de trabalho típico (VS Code, Edge, WhatsApp, Claude Code) | **~6 GB** |

Um teto derivado de qualquer um desses números chumbado no código está errado nos outros dois. Logo, `ramLivre` é lida **na hora**, e o passo 3 precisa conferir uma coisa que não é óbvia: no Windows, "livre" e "disponível" são quantidades diferentes — o Gerenciador de Tarefas mostra *Disponível* (livre + standby recuperável), e é esse o número que interessa. **Conferir que o que a API do runtime reporta bate com o Gerenciador de Tarefas antes de confiar nele**, porque a diferença entre as duas leituras é dessa mesma ordem de 3 GB.

**E a margem é a diferença entre os cenários, não um número escolhido.** O raciocínio: `num_ctx` **reserva o cache no momento da carga, e a reserva não encolhe**. Se o aplicativo mede 9 GB livres, reserva com base neles e o usuário depois abre o ambiente de trabalho, quem estoura é a máquina — e a causa foi uma decisão do aplicativo tomada com um retrato instantâneo. A margem existe para cobrir o **retorno do ambiente de trabalho**, e nesta máquina isso são os 3 GB entre "só o app" e "uso típico".

> 🔍 **A assimetria que decide o valor da margem:** subestimar a RAM disponível custa contexto que o usuário poderia ter tido; superestimar custa a máquina travando no meio de uma resposta. Não são erros do mesmo tamanho, e é por isso que a margem se calibra pelo cenário mais apertado observado, não pela média.

Isso também explica por que desenvolver no cenário apertado é a direção segura: o que funciona com 6 GB funciona nos 9 GB do aplicativo empacotado, e nunca o contrário.

#### As duas constantes, medidas no passo 0

Tudo o mais sai do `/api/show` ou de leitura de runtime. Sobram **duas** constantes, e as duas foram medidas em 10/08/2026 no `qwen2.5-coder:3b`, comparando `num_ctx` 4.096 com 32.768:

| Constante | Valor | Como saiu |
|---|---|---|
| `OVERHEAD` | **1,06** | 38,0 KB/token medidos contra 36,0 analíticos — o runner do Ollama por cima do cache |
| `OVERHEAD_FIXO` | **0,33 GB** | `ollama ps` reportou 2,277 GB a 4k e 3,316 a 32k; subtraindo o cache dá **2,129 GB** nos dois casos, contra 1,80 GB de disco |

O `OVERHEAD_FIXO` não estava previsto e caiu dos dados: os dois pontos dão a mesma base com três casas, o que é forte para duas medidas. Ele importa porque é **maior que o cache inteiro de um modelo pequeno a 4k** — ignorá-lo subestimaria todo modelo por um terço de giga, sempre na direção perigosa.

**`camadasQueCrescem = 1` para modelo com janela ativa é empírico**, e vale dizer que é. Os 4,3 KB/token medidos no `gemma3:4b` divididos pelos 4 KB que uma camada custa ali dão 1,07 — não as ~6 camadas globais que a proporção 5:1 do Gemma 3 sugeriria. O que dá crédito ao número é fechar as **duas** medições com a mesma `OVERHEAD`:

| Modelo | Previsto | Medido |
|---|---|---|
| `gemma3:4b` (janela ativa, 1 camada) | 4,34 KB/token | **4,3** |
| `qwen2.5-coder:3b` (sem janela, 36 camadas) | 38,2 KB/token | **38,0** |

Duas constantes, medidas, com a máquina registrada no [`CLAUDE.md`](../../../CLAUDE.md) — e o gatilho de refazê-las é o mesmo de todas as outras medidas de lá: trocar de máquina. **Um terceiro modelo com janela deslizante também as reabre**, porque o `1` está ajustado a um caso só.

> 🔍 **A comparação é contra `contextLength`, não contra o `numCtx` — e a diferença não é estilística, é que a segunda forma não fecha.** O `numCtx` é exatamente o valor que a fórmula está calculando; testar a classe contra ele torna a função recursiva sobre a própria saída. Comparar com o teto treinado do modelo resolve, e dá o **mesmo veredito para os nove modelos da frota**: as janelas reais são de 512 e 1024, muito abaixo de qualquer `numCtx` que se vá oferecer, e a única janela inerte (`phi4-mini`, 262.144) é inerte justamente por ser maior que o teto do próprio modelo. É a propriedade que torna a simplificação segura, e ela precisa ser reconferida se algum dia entrar um modelo com janela na ordem de dezenas de milhares.

**Descartado** ignorar a janela deslizante e usar sempre o número analítico cheio: para o `gemma3:4b` isso projeta 4,4 GB a 32k contra os 120 MB reais, um alarme 36× exagerado no modelo padrão do aplicativo. Um portão que grita no caso comum é desligado pelo usuário na primeira semana.

**Descartado** também não ter teto de RAM nenhum e confiar no `contextLength`: é o que produziria a tela oferecendo 131.072 ao `phi4-mini`.

⚠️ **O teto do modelo não é o teto útil, e agora há duas razões.** A primeira é tempo: o `gemma3:4b` aceita 131.072 tokens, e a 25 tok/s de prefill encher isso é uma hora e meia. A segunda chegou com a frota nova e é mais dura: **o `phi4-mini` no seu teto declarado pede 16 GB só de cache KV**, numa máquina de 16 GB totais — sete vezes o próprio peso. O primeiro é uma escolha ruim; o segundo é a máquina parar. O **medidor** da D15.4 continua sendo quem diz onde a conversa realmente está.

### D15.3 — Janela deslizante **descartada**, com número

O contrato do arco já previa recusá-la; a medição dá o argumento citável: **287 ms contra 8.500 ms** para o mesmo prompt, e o custo se repete a cada turno em vez de ser pago uma vez.

O que fica no lugar, em ordem de preferência:

1. **Não estourar.** O medidor da D15.4 existe para que o estouro seja visível antes de acontecer.
2. **Estourou: o aplicativo recusa e explica** (D15.5). Não trunca por conta própria.
3. **Resumir o começo numa mensagem estável** — a única estratégia que preserva prefixo, porque o resumo vira o novo começo e para de mudar. Custa uma chamada ao modelo e é uma feature; **não é deste plano**, e fica registrada aqui para que a sessão que a construir saiba por que ela é a candidata certa e a janela deslizante não.

**Descartado** deixar o Ollama truncar, que é o comportamento de hoje: pela D15.5.

### D15.4 — O contador é estimativa antes, exato depois — e a própria conversa o calibra

Sem `/api/tokenize`, a escolha aparente era entre estimar (erra até um terço) e não mostrar nada. Existe uma terceira, e ela é melhor que as duas: **cada resposta devolve `prompt_eval_count`, que é a contagem exata do que acabou de ser enviado.** Dividido pelos caracteres que foram enviados, dá a densidade real **daquela conversa** — daquele idioma, daquele estilo, daqueles anexos.

- **Turno 1:** estimativa com a razão padrão medida (3,8 caracteres por token para português).
- **Turno 2 em diante:** a razão observada no turno anterior, que já embute o que a estimativa genérica erra.

A calibração é aritmética de uma linha em `core/`, testável no nível 1 sem rede nenhuma, e o erro cai a cada turno em vez de crescer.

Consequência de contrato: **`ChatReply` deixa de ser só `content`.** O `ollamaChat` de hoje lê a linha final do stream (`done: true`) e descarta os contadores que ela carrega — passa a repassá-los. Zero canal novo.

### D15.5 — Nada é truncado em silêncio: o aplicativo recusa e explica

Quando o próximo turno não couber no `num_ctx` da conversa, o envio é **bloqueado**, com o motivo na tela e as saídas oferecidas: subir o `num_ctx` (se o modelo permitir), trocar para um modelo de teto maior, ou começar uma conversa nova.

É a mesma forma do gate de disponibilidade da D9.3 e do gate de `vision` que o plano 17 traz: **recusar com uma dica acionável, nunca enviar pela metade.** O motivo é o registrado no `ESCOPO.md` para o anexo — *anexo que falha em silêncio não produz erro, produz resposta convincente sobre um arquivo que o modelo nunca viu* —, e o histórico truncado é exatamente o mesmo problema com outro nome.

⚠️ **A estimativa é otimista por construção, e o portão tem de contar com isso.** Ela pode subestimar em um terço, então o bloqueio usa uma **margem** e dispara antes do teto nominal. Um bloqueio que só acontece depois de o dano ocorrer não é um portão — é um relatório.

O caso genuinamente irrecuperável — a mensagem que o usuário acabou de escrever já não cabe sozinha — existe e é raro; ele recebe o mesmo tratamento, com a diferença de que "começar uma conversa nova" não resolve, e a tela precisa dizer isso.

### D15.6 — `settings` viaja na linha de `conversation:list`

A D14.1 decidiu **o que é coluna e o que é JSON**; ela não decidiu o que a leitura da lista devolve. São perguntas diferentes, e vale separá-las antes que alguém leia a D14.1 como se proibisse isto.

`settings` é um objeto pequeno e de tamanho limitado (modelo, `num_ctx`, e o prompt de sistema quando existir), e a conversa ativa precisa dele **antes** de qualquer envio. Uma leitura própria seria uma segunda ida ao banco para buscar duzentos bytes que já estavam na linha. Vai junto.

O gatilho para separar está escrito: **`settings` passar a caber um prompt de sistema longo**, momento em que a lista carregaria kilobytes por conversa para desenhar títulos.

### D15.7 — O modelo continua sendo gravado por mensagem, e o seletor não trava

Já é assim desde a [D13.4](../implemented/13-casca-do-aplicativo.md), e este plano só passa a exercitá-lo de verdade: trocar de modelo no meio de uma conversa é a principal ação de recuperação num app de modelo local (*"este 4B falhou, sobe para o qwen 7B"*), e a autoria do que já foi respondido é preservada porque cada mensagem carrega o `model` que a produziu.

O que o seletor **acrescenta** é o preço na etiqueta: trocar de modelo custa ~50 s de carga do disco, medido. A troca não é proibida nem confirmada por diálogo — é informada.

Descarregar o modelo anterior ao trocar é regra do [`ESCOPO.md`](../../ESCOPO.md) e **é do plano 17**, junto com o `/api/ps` em Configurações. Aqui ela ainda não roda, e é bom que não role: com um único modelo residente e nenhum anexo, o custo de RAM ainda não é o problema que ela resolve.

### D15.8 — Dos quatro modelos instalados, dois ficam e dois saem — e o mais barato é o que muda o aplicativo

O catálogo continua sendo derivado do que o Ollama serve e **não curado**: curar a lista reintroduziria a manutenção manual que a D15.1 existe para eliminar. Mas curar o *catálogo* e curar a *máquina* são coisas diferentes, e esta decisão é sobre a segunda — o que o aplicativo mostra é consequência do que está instalado, nunca de uma lista de permissão no código.

**Ficam:**

| Modelo | Papel | Veredito a 32k |
|---|---|---|
| **`qwen2.5-coder:3b`** | treinado em código, e SQL é código — serve direto ao verbo *perguntar* do plano 19 | ✅ **o achado da frota.** 2,0–2,9 GB, o único que cabe **sob os dois fatores e nos três cenários**. Candidato a default do caminho NL→SQL |
| **`qwen2.5-coder:7b`** | mesma especialização, teto de qualidade | ⚠️ **depende do passo 0.** 4,7 GB calibrado contra 6,1 pelo teto superior. É o modelo que mais ganha com a medição, e a escolha deliberada de quando o 3b falhar |

**Saem, desinstalados:**

| Modelo | Motivo |
|---|---|
| **`mistral:7b`** | **dominado, independentemente da RAM.** Mesmo porte e mesmo teto de 32k do `qwen2.5:7b`, sem especialização em código, e **128 KB/token de cache contra 56**. Nada que outro da frota não dê, pelo dobro do custo de contexto |
| **`llama3.1:8b`** | **o único atrativo é inalcançável.** Os 131.072 pedem 20,6 GB pela aritmética — acima da RAM total — e, mesmo no melhor cenário sob o fator calibrado, ~87 min de prefill. Sem o teto, sobra um `qwen2.5:7b` mais pesado (4,58 contra 4,36 GB) com o dobro do custo de cache |

Os dois liberam **8,65 GB** de disco. As medições feitas neles **ficam**: a chave `llama.context_length` do `mistral:7b` continua sendo o caso de teste do passo 1, com o payload do `/api/show` capturado antes da remoção. Modelo desinstalado não desfaz o que ensinou, e reinstalar para reproduzir custaria 4,6 GB de download — que é exatamente o motivo de a medida ficar escrita.

**A inversão vale ser dita porque é o oposto do reflexo:** os dois modelos que impressionavam na ficha — o `llama3.1:8b` pelos 131.072 e o `qwen2.5-coder:7b` pela especialização — eram os dois cujo atrativo a máquina não paga. O primeiro é interessante *pelo contexto longo*, e é exatamente o contexto longo que não cabe; o segundo é interessante *pela qualidade em código*, e o 3b traz a mesma especialização por 40% da RAM. **O que muda o que o aplicativo consegue fazer é o 3b** — o mais barato dos quatro, o que não era o palpite de ninguém ao instalá-los.

> 🔍 **Remover os dois não custou nenhum argumento a este plano, e isso é informação sobre o plano.** O `phi4-mini` já ocupava a mesma célula da tabela de arquitetura — 128 KB/token, teto de 131.072 — e é um exemplar melhor, porque pesa 2,32 GB em vez de 4,58: **o modelo mais leve da faixa de conclusão tem o cache mais caro da frota.** Quando uma decisão sobrevive à remoção do exemplo que a motivou, ela era sobre o mecanismo e não sobre o exemplo. O contrário também vale como alerta: se remover um modelo tivesse derrubado a D15.2, ela seria uma regra ajustada a um caso.

E fica o efeito de segunda ordem, que agora tem o `phi4-mini` como portador: **custo de cache por token não acompanha tamanho de modelo.** Num aplicativo cujo plano seguinte é anexar documentos, isso deixa de ser detalhe de ficha técnica e vira o que decide quantas páginas cabem antes de a máquina reclamar.

O `gemma3:4b` continua sendo o único modelo com visão da máquina, e o gatilho do [`ROADMAP § 2`](../../ROADMAP.md) sobre "modelo local com `vision` e `tools` ao mesmo tempo" **continua fechado**. A frota com `tools` vai de dois para **quatro** distintos (`qwen2.5:7b`, `phi4-mini`, `qwen2.5-coder:7b`, `qwen2.5-coder:3b`), o que **dispara** o gatilho de reavaliar *tool calling* — por um caminho que ele não previa: não foi a máquina que cresceu, foi um 3B especializado desfazendo a suposição de que "modelo com `tools`" significa 7B.

### D15.9 — Os modelos de nuvem **não** entram neste plano, e a costura que entra custa uma palavra

Os dois candidatos estão pesquisados e registrados abaixo para que a pesquisa não se repita. Ainda assim, a resposta é **não entram no 15**, por quatro razões que não são de ordem de fila:

1. **`num_ctx` não existe na nuvem.** Este plano inteiro é sobre um botão que só o Ollama tem. D15.2, D15.3 e a aritmética de cache KV são todas de provedor local — na nuvem não se reserva janela, manda-se e recebe-se cobrança ou recusa. Um plano sobre reservar contexto não tem o que decidir sobre um provedor que não deixa reservar.
2. **O catálogo da D15.1 é uma sondagem de runtime.** As N+1 chamadas, o `staleTime` infinito e o botão de recarregar existem porque um servidor local pode ser **perguntado**. Nuvem não tem endereço equivalente que devolva `capabilities` e teto na mesma forma: seria uma **tabela chumbada**, que é outro mecanismo, com outro problema de validade — ela envelhece com o release do fornecedor, não com a máquina do usuário.
3. **Não há onde guardar a chave.** O `CLAUDE.md` fixa a regra dos segredos (mão única, `safeStorage`, `userData`) e registra que **nenhum segredo existe ainda**. Nuvem precisa desse subsistema inteiro antes da primeira chamada. É um plano, não um passo.
4. **A nuvem bloqueia o nível 3, e é exatamente o que os planos 16 e 17 constroem.** O [`ESCOPO.md`](../../ESCOPO.md) põe documento e imagem como nível 3 por construção, bloqueado na nuvem. Entregar nuvem antes do 17 é entregar um provedor que não faz a feature dos dois planos seguintes.

**O que entra agora, porque custa zero e o retrofit custa caro** — a régua do [`ESCOPO.md`](../../ESCOPO.md): *forma de dado que atravessa camadas e costura que custa zero decidem-se agora; feature constrói-se quando existir.* É o mesmo argumento que fez `Message` nascer como lista de partes na D13 e se pagar no 17.

- **`AiModel.provider`**, uma palavra, hoje com um valor só. Acrescentá-la depois toca `shared/ipc.ts`, o preload, o renderer, o main e todo `settings` já gravado; acrescentá-la agora é uma linha.
- **O conceito na fronteira é `contextWindow`, não `num_ctx`.** O `core/ai/budget.ts` do passo 4 recebe **um teto em tokens**, sem saber de onde veio. Os dois provedores têm janela de contexto; só um tem botão para reservá-la. Chamar o parâmetro de `numCtx` dentro de `core/` seria escrever o nome do Ollama num módulo que a D9.2 desenhou para não conhecer provedor.
- **A D15.4 já tinha o gancho** e ele fica de pé: *"a ausência deles não quebra nada — provedor de nuvem pode não mandar"*.

> **Sobre consultar as capacidades por busca na web:** serve para **preencher** a tabela ao escrever o plano — foi o que se fez agora —, não como mecanismo. Um aplicativo empacotado não sai à web para descobrir o teto de um modelo: a tabela mora em `core/ai/`, versionada com o código e **com a data em que foi conferida**, do mesmo jeito que os números de máquina do `CLAUDE.md`. Buscar em runtime traria rede numa camada que a D9.2 mantém pura, e uma resposta de terceiro decidindo um portão de segurança.

**Pesquisado em 10/08/2026, para o plano de nuvem não recomeçar do zero:**

| | `glm-4.7-flash` (Z.ai) | `gemini-2.5-flash` (Google) |
|---|---|---|
| Janela de contexto | **203.000** | **1.048.576** |
| Teto de saída | não publicado | 65.536 |
| Modalidades de entrada | texto | texto, **imagem**, áudio, vídeo |
| `tools` / saída estruturada | sim / não publicado | **sim / sim** |
| Tier grátis | recorrente, **1 concorrência** | 10 req/min · 250 req/dia |
| Arquitetura | MoE 30B-A3B (31B totais), jan/2026 | fechada |

> ⚠️ **A tensão que o plano de nuvem vai ter de resolver, registrada agora:** o `gemini-2.5-flash` **enxerga imagem** — seria o segundo modelo com visão do aplicativo, e o primeiro que não custa 80 s de prefill. E o [`ESCOPO.md`](../../ESCOPO.md) proíbe mandar imagem para a nuvem, porque imagem é nível 3 por construção. As duas coisas estão certas e se contradizem na tela: o usuário verá um modelo capaz de ver, com o anexo recusado. Isso não se resolve neste plano; resolve-se decidindo se a regra do nível 3 é sobre **o dado do usuário** (e então uma imagem que o próprio usuário anexou conscientemente talvez caiba num opt-in explícito) ou sobre **sair da máquina** (e então continua proibida). A segunda leitura é a que está escrita hoje.

---

## Passos

### Passo 0 — Uma medida, para fechar o `fatorDaClasse` sem janela

Sem código. A D15.2 precisa de **um** número que a aritmética não dá: quanto o cache KV de um modelo **sem** janela deslizante realmente cresce nesta máquina.

O alvo é o `qwen2.5-coder:3b`, e a escolha é por segurança, não por conveniência: 1,80 GB de pesos mais o teto superior de 1,13 GB de cache a 32k dão **2,93 GB de pico**, com margem confortável nos ~6 GB livres. É o único dos quatro novos em que a medida cabe **mesmo se a aritmética estiver certa** — que é a hipótese contra a qual o protocolo precisa se proteger, já que é justamente ela que o passo existe para testar.

Protocolo, **um modelo residente por vez**, no molde da sessão de 09/08:

1. `ollama ps` vazio antes de começar.
2. `num_ctx` 4.096, prompt de 24 tokens, anotar o `SIZE` do `/api/ps`.
3. Descarregar com `keep_alive: 0`; confirmar `ollama ps` vazio.
4. `num_ctx` 32.768, mesmo prompt, anotar o `SIZE`.
5. Descarregar; confirmar vazio.
6. `fatorDaClasse = (delta ÷ 28.672) ÷ 36 KB`.

> ⛔ **Não medir `phi4-mini`, `qwen2.5:7b` nem `qwen2.5-coder:7b` a 32k no cenário de desenvolvimento.** Escrito como precaução antes do passo rodar, e **a medição o confirmou**: com o fator em 1,06, os totais são 6,89, 6,55 e 6,55 GB contra ~6 GB livres. Não seria uma medição lenta, seria *swap*. A ordem que a precaução impôs — 3b primeiro, fator na mão, decidir depois — é o que evitou travar a máquina para descobrir isso, e continua valendo: para medi-los é preciso fechar o ambiente de trabalho e subir ao cenário de 7,5 ou 9 GB.
>
> Os dois modelos que este ⛔ nomeava na primeira redação (`mistral:7b` e `llama3.1:8b`, a 8,1 e 8,6 GB) foram desinstalados antes de o passo rodar — ver D15.8. A regra não mudou de forma, só de alvo, e é isso que a torna uma regra e não uma lista.

**✅ Concluído em 10/08/2026.** `ollama ps` vazio antes, entre e depois.

| `num_ctx` | `ollama ps` SIZE | `context_length` reportado |
|---|---|---|
| 4.096 | 2,277 GB | 4096 |
| 32.768 | 3,316 GB | 32768 |

Delta de **1,039 GB** para 28.672 tokens = **38,0 KB/token**, contra 36,0 analíticos: `OVERHEAD` = **1,055**. E os dois pontos deram a mesma base ao subtrair o cache — 2,129 GB —, revelando um `OVERHEAD_FIXO` de **0,33 GB** que não estava previsto.

**O fator saiu em 1,0, que era a hipótese registrada como "resultado, não fracasso".** A aritmética estava certa para atenção plena, e a anomalia ficou isolada no `gemma3:4b`, com explicação: 4,3 ÷ 4 = **uma camada crescendo**. A fórmula da D15.2 passou de dois fatores opacos para uma contagem de camadas mais duas constantes de overhead, e as tabelas de orçamento deixaram de ser faixa para virar previsão.

**Commit:** `docs(plan): fator de cache KV medido — a aritmética estava certa`

### Passo 1 — O catálogo, sem UI

`ai:models` nasce em `src/shared/ipc.ts`; o adaptador em `src/main/features/ai/providers/ollama.ts` ganha `ollamaModels`, que faz o `/api/tags` e um `/api/show` por modelo, e a normalização (achar a chave por sufixo `.context_length`, ler `capabilities` do `show`, extrair o bloco `attention`) vive em `src/core/ai/` como função pura sobre as duas respostas — é ali que ela é testável sem rede.

O adaptador de hoje tem uma constante `OLLAMA_HOST` e duas funções (`ollamaProbe`, `ollamaChat`); `ollamaModels` é a terceira, no mesmo arquivo e com a mesma forma — `fetch` que lança `UpstreamError` no não-2xx, deixando o handler mapear para `AppError`.

`core/ai/` ganha também o predicado de capacidade (`hasCapability(model, 'vision')`), que ninguém chama ainda e que o plano 17 vai chamar de dois lugares.

**Aceite:** teste de nível 1 sobre a normalização, com payloads reais capturados nesta sessão e nas duas anteriores —

- o `gemma3:4b`, cuja resposta de `/api/tags` **não** traz `vision`, para que a regressão de voltar a ler do lugar errado fique vermelha;
- o **`mistral:7b`, que responde sob `llama.context_length`** — é o caso que falha se alguém "consertar" a busca para montar a chave a partir do nome do modelo, e o único medido em que o prefixo não tem relação nenhuma com o nome. ⚠️ **O modelo foi desinstalado (D15.8), então este caso existe apenas como fixture** — o que o torna mais importante e não menos: é a única forma que resta de a regressão ficar vermelha, e ninguém vai reinstalar 4,6 GB para redescobri-la;
- os **`qwen2.5-coder`, que trazem `insert`** — a capability desconhecida precisa **atravessar** a normalização intacta, não ser filtrada contra uma lista;
- `headDim` vindo de `key_length` nos Gemma e de `embedding_length ÷ head_count` nos demais;
- o **`phi4-mini`, cujo `sliding_window` de 262.144 é maior que o próprio teto de 131.072** — a normalização o preserva cru, sem interpretar; quem decide se a janela é ativa é o cálculo de orçamento, comparando-a com o `contextLength`;
- o `nomic-embed-text`, sem bloco de atenção utilizável, produzindo `attention: null` sem lançar.

Nível 3 do handler com o `fetch` injetado. `pnpm check:fast` verde.
**Commit:** `feat(ai): catálogo de modelos com capabilities e teto de contexto`

**✅ Concluído em 10/08/2026.** `ai:models` é o 16º canal. `core/ai/models.ts` (119 linhas) com `normalizeOllamaModel` e `hasCapability`; `ollamaModels` no adaptador, sequencial; `models` no handler, com o `mapChatError` renomeado para `mapProviderError` por passar a servir dois chamadores. 24 testes novos (19 de nível 1, 5 de nível 3, 4 do adaptador), `check:fast` verde com **236 testes em 14,4 s**. Um achado durante a implementação corrigiu a regra da chave — ver acima.

### Passo 2 — O seletor no lugar do campo de texto

O `<input>` do `ConversationView` vira um seletor alimentado pelo catálogo, e o modelo escolhido passa a viver em `settings` da conversa — `conversation:list` devolve `settings` (D15.6), e um canal grava. O default deixa de ser uma constante no componente e passa a ser *o modelo da conversa, ou o primeiro do catálogo*.

Cada opção mostra o que o catálogo sabe: tamanho, teto de contexto, e um indicador por capability — as conhecidas (`vision`, `tools`) com rótulo próprio, e as demais renderizadas pelo nome cru, que é o que mantém a promessa do `string[]` viva na tela em vez de só no tipo. O `insert` dos dois `qwen2.5-coder` é o primeiro a exercitar esse caminho.

**Aceite:** nível 2 — escolher um modelo, mandar uma mensagem, e o `ai:chat` receber o modelo escolhido; trocar de conversa e cada uma manter o seu; Ollama fora do ar deixando o seletor num estado vazio legível em vez de quebrar. Ao vivo: a lista com os **doze** modelos reais (incluindo as cinco variantes `-custom`, que o Ollama serve como modelos distintos e o catálogo não tenta deduplicar), a etiqueta de `vision` aparecendo **só** nos dois `gemma3:4b`, e `insert` aparecendo **só** nos dois `qwen2.5-coder`.
**Commit:** `feat(conversation): seletor de modelo alimentado pelo catálogo`

**✅ Concluído em 10/08/2026.** `conversation:settings` é o 17º canal, gravando com `json_patch` do SQLite (verificado antes de usar) — merge atômico, e `null` remove a chave. `Conversation` ganha `settings` e ele viaja na linha da lista (D15.6); a leitura é **validada com zod**, seguindo o precedente da D14.7 para `app_settings`: bytes vindos do disco sem esquema para migrar. `ModelSelector` sai como componente próprio (121 linhas), o que manteve o `ConversationView` em 143. `resolveModel` mora em `conversations.ts` ao lado do `titleFromText`, pelo mesmo motivo — main não opina sobre qual modelo a interface preseleciona. 20 testes novos; `check:fast` verde com **256 testes em 15,2 s**.

### Passo 3 — `num_ctx` na chamada, e os contadores de volta no contrato

`num_ctx` entra em `settings` e chega ao `options` do `/api/chat` ao lado do `num_thread` que já vai. O `ChatFn` de `src/core/ai/types.ts` deixa de resolver para `string` e passa a resolver para um objeto com o texto e os contadores; `ollamaChat` para de descartar a linha `done: true` do stream, que hoje ele lê e joga fora no `return assembled`.

`core/ai/` ganha `contextCeiling(model, freeRamBytes)`, que aplica a fórmula da D15.2. A RAM entra **como argumento**, não como leitura de dentro: é o que mantém a função pura, testável nos três cenários sem simular sistema operacional nenhum, e coerente com a D9.2, que já mantém `core/` sem I/O. Quem lê o número é o main, e passa.

**Aceite:** nível 1 do adaptador provando que os contadores da linha `done: true` chegam ao contrato (e que a ausência deles não quebra nada — provedor de nuvem pode não mandar).

Nível 1 de `contextCeiling`, com os quatro casos de arquitetura que a frota real produz — sem janela (`qwen2.5-coder:3b`), com janela ativa (`gemma3:4b`), com **janela inerte** (`phi4-mini`, cujo `sliding_window` de 262.144 não pode ser tratado como janela) e sem bloco de atenção (`nomic-embed-text`, que não é oferecido para conversa) — mais os três cenários de RAM como tabela de casos. Duas asserções fecham o passo:

- **`phi4-mini` recebe teto abaixo dos 131.072 que declara, nos três cenários** — é o caso em que o dado verdadeiro e a resposta certa divergem, e o único jeito de provar que o teto de RAM está de fato limitando.
- **O mesmo modelo recebe tetos diferentes com 6 e com 9 GB** — é o que prova que a RAM está entrando na conta em vez de decorar.

Nível 3 de que `num_ctx` vai no `options` só quando definido, pelo mesmo motivo já registrado para o `num_thread`.

⚠️ **Ao vivo, e é o que não dá para testar em unidade:** conferir que o número de RAM disponível que o runtime reporta bate com o *Disponível* do Gerenciador de Tarefas. No Windows, "livre" e "disponível" são quantidades diferentes — a segunda inclui o standby recuperável —, e a diferença entre elas é da mesma ordem de grandeza dos 3 GB que separam os cenários. Ler a errada erra o teto por um modelo inteiro. Depois: `num_ctx` alto numa conversa e o `/api/ps` reportando `context_length` igual ao escolhido.
**Commit:** `feat(ai): num_ctx por conversa e contadores de token no contrato`

**✅ Concluído em 10/08/2026.** `ChatFn` deixa de resolver para `string`; `ollamaChat` para de descartar a linha `done: true`. `core/ai/budget.ts` com `kvBytesPerToken`, `residentBytes` e `contextCeiling`, mais as três constantes medidas (`OVERHEAD`, `OVERHEAD_FIXO`, `RAM_MARGIN_BYTES`). **Um canal a mais do que o plano previa:** `app:memory` (18º), porque o teto precisa da RAM livre e não existe *um* número — ela é lida a cada chamada. `os.freemem()` **conferido contra o Gerenciador de Tarefas antes de ser usado**: 6,73 GiB contra os 58% de 15,81 GiB da captura, ou seja o Node devolve `ullAvailPhys` (o *Disponível*), não o *Livre*. Ler o outro reportaria quase zero e ofereceria contexto nenhum a todo modelo. 19 testes novos; `check:fast` verde com **275 testes**.

### Passo 4 — O medidor, calibrado pela própria conversa

`core/ai/budget.ts`: dada a conversa, o `num_ctx` e o último `prompt_eval_count` observado, estima quantos tokens o próximo envio vai custar e quanto do orçamento já foi gasto. O `ConversationView` mostra isso perto do composer — chrome, densidade compacta, sem competir com a leitura.

**Aceite:** nível 1 do cálculo, incluindo o caso do primeiro turno (sem observação, razão padrão) e o da calibração (uma observação real puxando a estimativa na direção certa); nível 2 do medidor aparecendo e mudando depois de um turno. Ao vivo: comparar o número mostrado com o `prompt_eval_count` que voltou, e **anotar o erro no diário** — é o único jeito de saber se a margem da D15.5 está calibrada.
**Commit:** `feat(conversation): medidor de orçamento de contexto`

### Passo 5 — O portão: nada é truncado em silêncio

Quando o próximo turno não couber, o envio é bloqueado com o motivo e as saídas (D15.5). É o passo que fecha a falha silenciosa, e é o motivo de o plano existir.

> **A prova que este passo existe para cobrar, no molde do ciclo vermelho→verde da [fase 07](../implemented/07-e2e-e-empacotamento.md):** ao vivo, com o portão **desligado**, mandar um histórico maior que o `num_ctx` e confirmar que o Ollama responde normalmente com `prompt_eval_count` truncado — ver a falha acontecer. Religar e ver o envio ser recusado. Um portão que nunca foi visto deixando passar não é um portão testado.

**Aceite:** nível 2 dos três casos — cabe (envia), não cabe (bloqueia com a dica), e a mensagem sozinha já não cabe (bloqueia dizendo que conversa nova não resolve); a demonstração acima registrada no diário com os números.
**Commit:** `feat(conversation): envio recusado quando o histórico não cabe no contexto`

---

## O que este plano deixa registrado para o 16 e o 17

- **`hasCapability` existe e não tem chamador** (D15.1) — o gate de `vision` do plano 17 é uma chamada, não um mecanismo. E ele lê do `/api/show`, que é o único lugar onde `vision` aparece.
- **`AiModel.contextLength` é dado de primeira classe**, então o plano 17 sabe, antes de anexar, se um documento cabe — e o teto de ~8k tokens por documento do [`ESCOPO.md`](../../ESCOPO.md) passa a ser comparável com um número real em vez de uma estimativa.
- **O medidor já existe quando o anexo chegar**, e é ele que torna visível o custo de ~80 s de uma imagem antes de ele ser pago.
- **`settings` continua absorvendo chave nova sem migração** — prompt de sistema, temperatura, e o que o 17 precisar.
- **A política de resumo do começo (D15.3, opção 3)** é a única estratégia de compressão que preserva o cache de prefixo. Quando alguém for construí-la, o número que a justifica está na tabela acima.
- **`AiModel.attention` e `contextCeiling` existem antes de o anexo chegar** (D15.2), e é o 17 que os cobra de verdade: um documento de 8k tokens muda o `num_ctx` necessário, e o `num_ctx` necessário muda quais modelos ainda cabem na RAM. O 17 herda a conta pronta em vez de descobrir na tela que anexar o PDF tornou o modelo escolhido inviável.
- **`AiModel.provider` existe com um valor só** (D15.9), e é a costura de zero custo para a fatia 3 do [plano 09](09-camada-de-ia.md). O nome do parâmetro de orçamento em `core/` é `contextWindow`, não `numCtx`, pelo mesmo motivo.

> ⚠️ **A armadilha que este plano arma para o 17:** o medidor da D15.4 conta **caracteres**, e uma imagem não tem caracteres. Ela custa ~270 tokens fixos, medidos em ago/2026, independentemente das dimensões. Se o medidor for estendido para anexos somando texto extraído, ele vai reportar zero para a imagem e o portão vai deixar passar exatamente o caso mais caro. O contador de partes não-textuais é problema de quem cria a variante, e precisa nascer junto dela.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 10/08/2026 | 3 | **concluído** | `num_ctx` na chamada, contadores de volta, `core/ai/budget.ts`. Três testes ancoram a fórmula na medição do passo 0 e passam: 3,32 GB a 32k e 2,28 GB a 4k para o `qwen2.5-coder:3b`, os mesmos que o `ollama ps` reportou. **Um canal a mais do que o plano previa** — `app:memory`, 18º: o teto de RAM da D15.2 precisa de RAM livre, e como não existe *um* número (9 / 7,5 / 6 GB), ela é lida a cada chamada em vez de chumbada. Verificação do aceite feita e aprovada: `os.freemem()` deu **6,73 GiB**, batendo com os 58% de uso do Gerenciador — no Windows o Node devolve `ullAvailPhys`, que é o *Disponível*. Se devolvesse o *Livre*, seria quase zero (o Windows mantém quase tudo em standby recuperável) e todo modelo receberia teto zero. Contra a armadilha de "controle que copia valor assíncrono" (fase 14), o campo de contexto é **não controlado com `key` por conversa**, remontando em vez de copiar. |
| 10/08/2026 | 2 | **concluído** | Seletor no lugar do campo de texto. `conversation:settings` (17º canal) com `json_patch`; `settings` viaja na linha da lista; `ModelSelector` extraído, `ConversationView` fica em 143 linhas. **Dois defeitos reais que só o teste de nível 2 pegou.** (1) `Field` injeta o `id` **clonando o filho**, então envolver um `StateView` fazia o `id` parar nele e o `<label for>` apontar para nada — rótulo decorativo, e só uma consulta por texto de rótulo percebe. Conserto: `Field` envolve o `<select>`, e só aparece quando há controle. (2) `conversation?.settings.model ?? pending` **vazava entre conversas**: conversa sem escolha devolve `undefined` e caía no último clique de *outra* conversa, então criar a segunda herdava o modelo da primeira. Conserto: ramificar por "existe conversa?" em vez de encadear `??`. Armadilha de teste, da família já registrada na skill `testing`: o botão "Nova conversa" e a conversa recém-criada (título padrão idêntico) viram dois botões com o mesmo nome acessível — capturar a referência antes de criar. Régua: `preload/index.ts` em **53 de 60**, sete linhas de folga. |
| 10/08/2026 | 1 | **concluído** | Catálogo sem UI. `ai:models` (16º canal), `core/ai/models.ts`, `ollamaModels`, handler `models`; 24 testes novos, `check:fast` verde em 14,4 s com 236 testes. **A implementação corrigiu o plano:** "procurar pelo sufixo `.context_length`" está errado — modelo com visão carrega um namespace paralelo (`gemma3.vision.block_count` também termina em `.block_count`), e só não quebra hoje porque o Ollama devolve as chaves ordenadas e `vision` calha de vir depois. Trocado por descartar o primeiro segmento e comparar o resto; travado com um caso sintético de torre `audio.*`, **visto vermelho** antes de virar verde. O caso da visão passava com a implementação errada, o que é a lição: um teste que passa com o defeito presente não estava provando nada. Achado adjacente, não adotado: `general.architecture` daria o prefixo de forma autoritativa. Ruído pré-existente encontrado e **não** consertado (fora de escopo): `App.tsx` e `ConversationView.test.tsx` estão CRLF no disco e geram 577 avisos de Prettier em todo lint. |
| 10/08/2026 | 0 | **concluído** | Medição no `qwen2.5-coder:3b`, um modelo residente por vez, `ollama ps` vazio nas três conferências. **O fator saiu 1,055 — a aritmética estava certa**, e era a hipótese que o passo registrava como "resultado, não fracasso". Consequências, todas na D15.2: o `fatorDaClasse` opaco morreu e virou `camadasQueCrescem`, que é **1** para modelo com janela ativa (4,3 ÷ 4 KB por camada = 1,07 no `gemma3:4b`) e `blockCount` para os demais; apareceu um `OVERHEAD_FIXO` de 0,33 GB que não estava previsto e que os dois pontos confirmam com três casas; e as tabelas de orçamento deixaram de ser faixa para virar previsão. **Duas surpresas do outro lado:** metade da frota **não cabe** a 32k no cenário de 6 GB, o que faz o teto de RAM agir no caso comum em vez de num extremo; e o `gemma3:4b` **cabe** nos 131.072 que declara (3,97 GB), invertendo a suposição do plano — o que o mantém fora é o prefill de ~87 min, não a memória. |
| 09/08/2026 | — | plano escrito | Sessão de medição, sem código. As sondas contra o Ollama real derrubaram duas premissas escritas: `/api/tags` **não** reporta `vision` (o `ESCOPO.md` foi corrigido na mesma sessão) e `num_ctx` **não** é um botão de RAM (8× de contexto custa 120 MB). A medição do cache de prefixo — 287 ms contra 8.500 ms para o mesmo prompt — deu o número que faltava para descartar a janela deslizante por evidência em vez de por intuição. |
| 10/08/2026 | revisão do plano | plano reescrito | Quatro modelos novos instalados (`qwen2.5-coder:7b`/`:3b`, `mistral:7b`, `llama3.1:8b`), frota de 10 → 14. Sessão só de `/api/tags` + `/api/show`, **sem carregar modelo nenhum** — `ollama ps` vazio no início e no fim. Três achados: (1) `insert` chegou como capability desconhecida, o que torna o `string[]` da D15.1 medição em vez de precaução; (2) `mistral:7b` responde sob **`llama.context_length`** — o prefixo não é a família comercial do modelo, e virou caso de teste do passo 1; (3) **a manchete do plano estava generalizada demais** — os 120 MB de 09/08 foram medidos no `gemma3:4b`, o único modelo da frota com janela deslizante, e `llama3.1:8b`/`mistral:7b` custam **5,3× por token** de contexto. Daí nasceram o teto de RAM da D15.2, o passo 0 e a recusa a medir os modelos de 7–8B antes de ter o fator. **A RAM livre virou três números, não um** — 9 GB só com o app, 7,5 GB só com o VS Code, 6 GB no ambiente típico (a estimativa anterior de 4,4 GB estava baixa). A variação de 3 GB é maior que o peso da maioria dos modelos, o que matou a ideia de chumbar `ramLivre` como constante e deu à `margem` da fórmula uma origem medida em vez de escolhida: ela cobre o **retorno do ambiente de trabalho**, porque `num_ctx` reserva na carga e a reserva não encolhe. Uma afirmação anterior desta sessão foi corrigida no caminho: `llama3.1:8b` a 131.072 **não** é impossível sob todas as leituras — cabe em 7,4 GB pelo fator calibrado no cenário de 9 GB; o que o mantém fora é o prefill de ~87 min, não a RAM. Decidido também que os modelos de nuvem **não** entram neste plano (D15.9), com a costura de custo zero que entra. Catálogo remedido: 4,9 s para 14 modelos. **Ao fim da sessão, `mistral:7b` e `llama3.1:8b` foram desinstalados** (D15.8) — dominado o primeiro, atrativo inalcançável o segundo, 8,65 GB de disco liberados, payloads do `/api/show` capturados antes. A remoção não custou nenhum argumento ao plano: o `phi4-mini` já ocupava a mesma célula da tabela de arquitetura e é exemplar melhor, por pesar 2,32 GB e ainda assim ter o cache mais caro da frota. Frota: 14 → 12 entradas, 9 → 7 distintas. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [14 — Persistência das conversas](../implemented/14-persistencia-das-conversas.md) · **Índice:** [README](README.md) · **Camada de IA:** [09 — Camada de IA e ML](09-camada-de-ia.md)
