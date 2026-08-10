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

Um `mistral` responde sob `llama.`, e dois modelos de famílias comerciais diferentes compartilham o mesmo prefixo. Procura-se pelo **sufixo** `.context_length`, nunca montando a chave — e o teste do passo 1 ganha o `mistral:7b` como caso, porque é ele que falha se alguém "consertar" a busca para usar o nome.

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

> 🔍 **A aritmética e a medição discordam, e a discordância é o achado.** O delta medido no `gemma3:4b` foi de 120 MB para 28.672 tokens a mais — **4,3 KB por token**, contra os 24 KB que a fórmula prevê. Fator de ~5,6×, sem explicação confirmada: o `ollama ps` pode reportar estimativa em vez de RSS, o runtime pode alocar sob demanda, ou o cache KV pode estar quantizado por padrão. **A tabela acima é teto superior, não previsão.** O que ela sustenta com segurança é a **razão** entre modelos, que é arquitetural e independe de qual das hipóteses seja a certa: `mistral:7b` e `llama3.1:8b` custam **5,3× por token** o que o `gemma3:4b` custa. O passo 0 existe para fechar essa lacuna com uma medida só.

**O orçamento desta máquina, somando pesos e cache, a 32.768 tokens.** Duas incertezas se cruzam aqui, e é por isso que a tabela tem duas colunas de total: o **fator** (aritmética contra medição, ~5,6×) e o **cenário** (a RAM livre varia 3 GB conforme o que está aberto — ver D15.2).

| Modelo | Pesos | + KV | Total (teto superior) | Total (calibrado ÷5,6) |
|---|---|---|---|---|
| `qwen2.5-coder:3b` | 1,80 GB | 1,13 | **2,93** | **2,00** |
| `gemma3:4b` | 3,11 GB | 0,77 | **3,88** | **3,25** |
| `phi4-mini` | 2,32 GB | 4,00 | **6,32** | **3,03** |
| `qwen2.5:7b` | 4,36 GB | 1,75 | **6,11** | **4,67** |
| `qwen2.5-coder:7b` | 4,36 GB | 1,75 | **6,11** | **4,67** |

> 🔍 **Repare no `phi4-mini` contra o `qwen2.5:7b`: 6,32 e 6,11 GB, praticamente o mesmo total, por caminhos opostos.** Um é 2,32 de pesos com 4,00 de cache; o outro é 4,36 de pesos com 1,75 de cache. Quem orçar por tamanho de modelo — que é o reflexo, e o que o `ollama list` mostra — conclui que o `phi4-mini` custa metade do `qwen2.5:7b`. A 32k eles empatam, e a 4k o `phi4-mini` de fato custa menos. **O ordenamento entre dois modelos pode inverter conforme o `num_ctx`**, e nenhuma coluna do `ollama list` deixa isso visível.

Cruzando com os três cenários (✅ cabe · ⚠️ na borda · ❌ não cabe):

| Modelo | 6 GB (dev típico) | 7,5 GB (só VS Code) | 9 GB (só o app) |
|---|---|---|---|
| `qwen2.5-coder:3b` | ✅ ✅ | ✅ ✅ | ✅ ✅ |
| `gemma3:4b` | ✅ ✅ | ✅ ✅ | ✅ ✅ |
| `phi4-mini` | ❌ ✅ | ⚠️ ✅ | ✅ ✅ |
| `qwen2.5:7b` | ❌ ✅ | ⚠️ ✅ | ✅ ✅ |
| `qwen2.5-coder:7b` | ❌ ✅ | ⚠️ ✅ | ✅ ✅ |

*(primeiro símbolo: teto superior · segundo: calibrado)*

**Onde as duas incertezas se somam é onde o passo 0 se paga.** Para três dos cinco modelos, a resposta a "cabe a 32k?" depende inteiramente de qual fator vale — e o cenário só desloca a fronteira, não a apaga. Os dois pequenos cabem em todas as combinações; os três demais não cabem em nenhuma pela aritmética e cabem em todas pelo fator medido. Uma medida resolve nove células.

Duas conclusões sobrevivem a **todas** as combinações, e são as que o código pode usar antes do passo 0:

- **`qwen2.5-coder:3b` cabe com folga em qualquer cenário e sob qualquer fator** — 2,0 a 2,9 GB contra 6 no pior caso. É isso, e não a especialização (que o 7b também tem), que o torna candidato a default do caminho NL→SQL.
- **Nenhum modelo da frota tem o teto declarado utilizável**, e vale ser preciso sobre o porquê, porque uma versão anterior desta seção afirmava mais do que os números sustentam. O `phi4-mini` a 131.072 pede **18,3 GB** pela aritmética (acima da RAM *total*) e **5,2 GB** pelo fator calibrado — o que **caberia** nos cenários de 7,5 e 9 GB. O que mata a ideia não é a RAM, é o argumento que a D15.2 já tinha em primeiro lugar: **131.072 tokens a 25 tok/s de prefill são ~87 minutos.** O teto não é impossível em todos os casos; é inútil em todos. Uma perna em vez de duas, e ainda de pé.

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

tetoDeRam = (ramLivre − margem − pesos) ÷ kvPorToken
kvPorToken = 2 × blockCount × headCountKv × headDim × 2 × fatorDaClasse
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

#### O fator de classe

`fatorDaClasse` é a única constante que não sai do `/api/show` nem de leitura de runtime, e existe porque a aritmética e a medição discordam por ~5,6× (registrado acima). São **dois** valores, um por classe de atenção, medidos nesta máquina e escritos aqui:

| Classe | Como se detecta | Fator | Origem |
|---|---|---|---|
| com janela deslizante ativa | `slidingWindow !== null && slidingWindow < contextLength` | **0,032** | `gemma3:4b`, medido 09/08/2026 (4,3 KB/token contra 136 analíticos) |
| sem janela, ou janela inerte | o contrário | **a medir** | `qwen2.5-coder:3b`, passo 0 |

Dois números, medidos, com a máquina registrada no [`CLAUDE.md`](../../../CLAUDE.md) — e o gatilho de refazê-los é o mesmo de todas as outras medidas de lá: trocar de máquina.

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

> ⛔ **Não medir `phi4-mini`, `qwen2.5:7b` nem `qwen2.5-coder:7b` a 32k antes de ter o fator.** Pelo teto superior são 6,3, 6,1 e 6,1 GB contra ~6 GB livres no cenário de desenvolvimento — não seria uma medição lenta, seria *swap*, e a máquina para de responder. Pelo fator calibrado seriam 3,0 a 4,7 GB, e caberiam com folga; **mas é exatamente isso que ainda não se sabe**, e medir antes de saber é apostar a máquina no resultado que a medida deveria produzir. Ordem: 3b primeiro, fator na mão, e só então decidir se os outros são mensuráveis aqui.
>
> Os dois modelos que este ⛔ nomeava na primeira redação (`mistral:7b` e `llama3.1:8b`, a 8,1 e 8,6 GB) foram desinstalados antes de o passo rodar — ver D15.8. A regra não mudou de forma, só de alvo, e é isso que a torna uma regra e não uma lista.

**Aceite:** os dois `SIZE`, o delta, o fator, e `ollama ps` vazio ao final, anotados no diário e o fator escrito na tabela da D15.2. Se o fator sair perto de 1,0, a aritmética estava certa e a medição do `gemma3:4b` é que precisa de explicação — o que é um resultado, não um fracasso, e muda a tabela de orçamento inteira.
**Commit:** `docs(plan): fator de cache KV medido para atenção sem janela`

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

### Passo 2 — O seletor no lugar do campo de texto

O `<input>` do `ConversationView` vira um seletor alimentado pelo catálogo, e o modelo escolhido passa a viver em `settings` da conversa — `conversation:list` devolve `settings` (D15.6), e um canal grava. O default deixa de ser uma constante no componente e passa a ser *o modelo da conversa, ou o primeiro do catálogo*.

Cada opção mostra o que o catálogo sabe: tamanho, teto de contexto, e um indicador por capability — as conhecidas (`vision`, `tools`) com rótulo próprio, e as demais renderizadas pelo nome cru, que é o que mantém a promessa do `string[]` viva na tela em vez de só no tipo. O `insert` dos dois `qwen2.5-coder` é o primeiro a exercitar esse caminho.

**Aceite:** nível 2 — escolher um modelo, mandar uma mensagem, e o `ai:chat` receber o modelo escolhido; trocar de conversa e cada uma manter o seu; Ollama fora do ar deixando o seletor num estado vazio legível em vez de quebrar. Ao vivo: a lista com os **doze** modelos reais (incluindo as cinco variantes `-custom`, que o Ollama serve como modelos distintos e o catálogo não tenta deduplicar), a etiqueta de `vision` aparecendo **só** nos dois `gemma3:4b`, e `insert` aparecendo **só** nos dois `qwen2.5-coder`.
**Commit:** `feat(conversation): seletor de modelo alimentado pelo catálogo`

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
| 09/08/2026 | — | plano escrito | Sessão de medição, sem código. As sondas contra o Ollama real derrubaram duas premissas escritas: `/api/tags` **não** reporta `vision` (o `ESCOPO.md` foi corrigido na mesma sessão) e `num_ctx` **não** é um botão de RAM (8× de contexto custa 120 MB). A medição do cache de prefixo — 287 ms contra 8.500 ms para o mesmo prompt — deu o número que faltava para descartar a janela deslizante por evidência em vez de por intuição. |
| 10/08/2026 | revisão do plano | plano reescrito | Quatro modelos novos instalados (`qwen2.5-coder:7b`/`:3b`, `mistral:7b`, `llama3.1:8b`), frota de 10 → 14. Sessão só de `/api/tags` + `/api/show`, **sem carregar modelo nenhum** — `ollama ps` vazio no início e no fim. Três achados: (1) `insert` chegou como capability desconhecida, o que torna o `string[]` da D15.1 medição em vez de precaução; (2) `mistral:7b` responde sob **`llama.context_length`** — o prefixo não é a família comercial do modelo, e virou caso de teste do passo 1; (3) **a manchete do plano estava generalizada demais** — os 120 MB de 09/08 foram medidos no `gemma3:4b`, o único modelo da frota com janela deslizante, e `llama3.1:8b`/`mistral:7b` custam **5,3× por token** de contexto. Daí nasceram o teto de RAM da D15.2, o passo 0 e a recusa a medir os modelos de 7–8B antes de ter o fator. **A RAM livre virou três números, não um** — 9 GB só com o app, 7,5 GB só com o VS Code, 6 GB no ambiente típico (a estimativa anterior de 4,4 GB estava baixa). A variação de 3 GB é maior que o peso da maioria dos modelos, o que matou a ideia de chumbar `ramLivre` como constante e deu à `margem` da fórmula uma origem medida em vez de escolhida: ela cobre o **retorno do ambiente de trabalho**, porque `num_ctx` reserva na carga e a reserva não encolhe. Uma afirmação anterior desta sessão foi corrigida no caminho: `llama3.1:8b` a 131.072 **não** é impossível sob todas as leituras — cabe em 7,4 GB pelo fator calibrado no cenário de 9 GB; o que o mantém fora é o prefill de ~87 min, não a RAM. Decidido também que os modelos de nuvem **não** entram neste plano (D15.9), com a costura de custo zero que entra. Catálogo remedido: 4,9 s para 14 modelos. **Ao fim da sessão, `mistral:7b` e `llama3.1:8b` foram desinstalados** (D15.8) — dominado o primeiro, atrativo inalcançável o segundo, 8,65 GB de disco liberados, payloads do `/api/show` capturados antes. A remoção não custou nenhum argumento ao plano: o `phi4-mini` já ocupava a mesma célula da tabela de arquitetura e é exemplar melhor, por pesar 2,32 GB e ainda assim ter o cache mais caro da frota. Frota: 14 → 12 entradas, 9 → 7 distintas. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [14 — Persistência das conversas](../implemented/14-persistencia-das-conversas.md) · **Índice:** [README](README.md) · **Camada de IA:** [09 — Camada de IA e ML](09-camada-de-ia.md)
