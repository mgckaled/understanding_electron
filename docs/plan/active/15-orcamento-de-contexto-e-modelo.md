# 15 — Orçamento de contexto e modelo por conversa

**Depende de:** [14 — Persistência das conversas](../implemented/14-persistencia-das-conversas.md) · **Entrega:** o campo de texto livre onde hoje se digita o nome do modelo vira **seletor com catálogo real**; `num_ctx` deixa de ser o default silencioso do Ollama e passa a ser escolha da conversa, gravada em `settings`; e a conversa mostra quanto do orçamento já gastou — porque, sem isso, o Ollama joga fora o começo do histórico sem dizer nada.

> Terceiro plano do [arco conversacional](README.md#o-arco-conversacional-1320). **Nenhuma tabela nova e nenhuma migração:** tudo que este plano guarda cabe na coluna `settings` que a [D14.1](../implemented/14-persistencia-das-conversas.md) criou vazia. Se um `CREATE TABLE` aparecer no diff, alguma coisa saiu do lugar.

---

## O caso

Três coisas estão erradas hoje, e as três são do mesmo tipo: **o aplicativo não sabe o que está fazendo com o contexto.**

1. **O modelo é um `<input>` de texto livre** com `'gemma3:4b'` chumbado como default. Digitar `gemma3:4bb` produz um erro `upstream` genérico; não há como saber quais modelos existem, e nada no aplicativo sabe que só um deles enxerga imagem.
2. **`num_ctx` nunca é enviado**, então vale o default do Ollama — **4096** nesta máquina, contra os 131.072 que o `gemma3:4b` foi treinado para aceitar. Ninguém escolheu esse número.
3. **Quando o histórico passa do teto, o Ollama descarta o começo e responde como se nada tivesse acontecido.** Medido abaixo, e é a razão de este plano existir antes do anexo: um documento de 8k tokens (plano 17) estoura o default de 4096 **sozinho**, e o usuário receberia uma resposta confiante sobre a metade final de um PDF.

O item 3 é a mesma classe da [falha silenciosa do NL→SQL](../../HISTORY.md) e da [imagem que o modelo descreve sem ter recebido](../../HISTORY.md): num caminho gerado por modelo, **o perigo não é a exceção, é o sucesso**.

**Fora deste plano:** anexo e o mecanismo de `MessagePart` (16), extratores de documento e imagem e o `/api/ps` em Configurações (17), DuckDB (18). Prompt de sistema por conversa também fica fora — a coluna `settings` o recebe sem migração no dia em que houver o que escrever nele, e hoje não há.

---

## O que foi medido no Ollama desta máquina

Sondas diretas contra o Ollama 0.32.6 servindo os modelos de `C:\ollama-models`, na máquina registrada no [`CLAUDE.md`](../../../CLAUDE.md) — CPU sem aceleração. **Cada linha abaixo decide uma linha de código**, e duas delas derrubam premissas que já estavam escritas em documento dono.

### O catálogo

| | Medido |
|---|---|
| `/api/tags` traz `capabilities`? | **sim, e incompletas** — ver o alerta abaixo |
| `/api/tags` traz o teto de contexto? | **não** — não existe campo |
| `/api/show` traz `capabilities`? | sim, e **completas** |
| `/api/show` traz o teto de contexto? | sim, em `model_info`, sob chave **prefixada pela família** |
| Custo de `/api/show` | ~250 ms cada · **10 modelos em 2,5 s** |
| `/api/show` carrega o modelo? | **não** — `/api/ps` continua vazio depois de dez chamadas |

> ⚠️ **`/api/tags` omite `vision`, e isso invalida uma frase do [`ESCOPO.md`](../../ESCOPO.md).**
>
> ```
> gemma3:4b     tags=["completion"]            show=["completion","vision"]
> gemma3:1b     tags=["completion"]            show=["completion"]
> phi4-mini     tags=["completion","tools"]    show=["completion","tools"]
> qwen2.5:7b    tags=["completion","tools"]    show=["completion","tools"]
> ```
>
> `tools` aparece nos dois; **`vision` só aparece no `/api/show`**. O escopo dizia *"modelo que declare `vision` nas `capabilities` do `/api/tags`"*, e o diário da fatia 1 do [plano 09](09-camada-de-ia.md) deixou em aberto *"gate via `/api/tags` para popular um dropdown"*. Construído assim, o gate do plano 17 **recusaria o único modelo com visão da máquina** — falha na direção segura, mas a feature simplesmente não funcionaria, e a causa estaria a dois documentos de distância. Corrigido no `ESCOPO.md` e registrado no [`HISTORY.md`](../../HISTORY.md) na mesma sessão em que foi medido.

A chave do teto de contexto **não é derivável do nome do modelo**: `gemma3.context_length`, mas `phi3.context_length` para o `phi4-mini` e `qwen2.context_length` para o `qwen2.5:7b`. Procura-se pelo sufixo `.context_length`, nunca montando a chave a partir da família.

| Modelo | Teto treinado |
|---|---|
| `gemma3:4b` | 131.072 |
| `gemma3:1b` | 32.768 |
| `phi4-mini` | 131.072 |
| `qwen2.5:7b` | 32.768 |
| `nomic-embed-text` | 2.048 |

### O custo de `num_ctx` — e a surpresa

Mesmo prompt de 24 tokens no `gemma3:4b`, descarregando o modelo entre cada medida:

| `num_ctx` | RAM residente | Carga (disco frio) | Prefill |
|---|---|---|---|
| 4.096 | 2,91 GB | 48,5 s | 2,4 s |
| 16.384 | 2,95 GB | 51,1 s | 2,0 s |
| 32.768 | **3,03 GB** | 51,3 s | 1,7 s |

**Oito vezes mais contexto custa 120 MB.** O `CLAUDE.md` já afirmava que o custo dominante não é memória; agora está medido, e a consequência é mais forte do que a frase sugeria: **`num_ctx` não é um botão de consumo de RAM.** Reservar a janela é barato; o que custa é o que se coloca dentro dela, e isso se paga em segundos de prefill, não em gigabytes.

O outro número da tabela é de outro assunto e vale sozinho: **carregar o `gemma3:4b` do disco custa ~50 s.** Trocar de modelo não é instantâneo, e o seletor precisa dizer isso.

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

N+1 chamadas, deliberadamente, porque a alternativa não funciona: `/api/tags` sozinho não sabe que o `gemma3:4b` enxerga e não sabe o teto de contexto de ninguém. São 2,5 s para dez modelos, sem carregar nada — custo de latência, não de RAM.

Isso torna o catálogo **caro o bastante para não ser refeito a cada abertura de um dropdown, e barato o bastante para ser refeito quando o usuário pedir.** Ele é uma query do cache de servidor (D14.4) como qualquer outra, com `staleTime` infinito e um botão de recarregar — instalar um modelo novo é um evento do sistema, não do aplicativo, e não há como observá-lo.

```ts
type AiModel = {
  name: string
  parameterSize: string          // '4.3B' — details.parameter_size
  sizeBytes: number
  capabilities: string[]         // de /api/show, NUNCA de /api/tags
  contextLength: number | null   // model_info, por sufixo '.context_length'
}
```

`capabilities` fica como `string[]` e não como união fechada: a lista é do Ollama, cresce sem nos avisar, e um `z.enum` transformaria um modelo novo em erro de parse. Quem pergunta *"tem `vision`?"* pergunta a uma função de `core/`, que é onde o plano 17 vai pendurar o gate — decisão que dois chamadores precisam tomar não mora ao lado de um deles ([`HISTORY.md`](../../HISTORY.md)).

**Descartado** ler `capabilities` de `/api/tags` mesmo sabendo que faltam, completando só quando o usuário abrir o detalhe: seria um gate que funciona na tela de configurações e falha no envio, que é o pior lugar.

### D15.2 — `num_ctx` é escolha da conversa, e o default sobe

A medição matou o motivo de ser conservador: 32k custa 120 MB. O default deixa de ser o 4096 do Ollama e passa a ser **um valor nosso, escrito, com o teto do modelo como limite** — o seletor oferece o teto que o `/api/show` reportou, e não um número inventado.

Mora em `settings` da conversa, JSON, sem migração (D14.1). Escala de conversa e não de máquina pela régua da D13.4: `num_ctx` **muda o que o modelo responde** — muda o que ele consegue enxergar do próprio histórico.

⚠️ **O teto do modelo não é o teto útil.** O `gemma3:4b` aceita 131.072 tokens; a 25 tok/s de prefill, encher isso é uma hora e meia. O seletor oferece o teto porque é o dado verdadeiro; o **medidor** da D15.4 é quem diz onde a conversa realmente está.

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

---

## Passos

### Passo 1 — O catálogo, sem UI

`ai:models` nasce em `src/shared/ipc.ts`; o adaptador em `src/main/features/ai/providers/ollama.ts` ganha `ollamaModels`, que faz o `/api/tags` e um `/api/show` por modelo, e a normalização (achar a chave por sufixo `.context_length`, ler `capabilities` do `show`) vive em `src/core/ai/` como função pura sobre as duas respostas — é ali que ela é testável sem rede.

`core/ai/` ganha também o predicado de capacidade (`hasCapability(model, 'vision')`), que ninguém chama ainda e que o plano 17 vai chamar de dois lugares.

**Aceite:** teste de nível 1 sobre a normalização, com payloads reais capturados nesta sessão — incluindo o `gemma3:4b`, cuja resposta de `/api/tags` **não** traz `vision`, para que a regressão de voltar a ler do lugar errado fique vermelha; teste de que a chave de contexto é encontrada em `gemma3.`, `phi3.` e `qwen2.` sem montar o nome; nível 3 do handler com o `fetch` injetado. `pnpm check:fast` verde.
**Commit:** `feat(ai): catálogo de modelos com capabilities e teto de contexto`

### Passo 2 — O seletor no lugar do campo de texto

O `<input>` do `ConversationView` vira um seletor alimentado pelo catálogo, e o modelo escolhido passa a viver em `settings` da conversa — `conversation:list` devolve `settings` (D15.6), e um canal grava. O default deixa de ser uma constante no componente e passa a ser *o modelo da conversa, ou o primeiro do catálogo*.

Cada opção mostra o que o catálogo sabe: tamanho, teto de contexto, e um indicador para `vision`/`tools`.

**Aceite:** nível 2 — escolher um modelo, mandar uma mensagem, e o `ai:chat` receber o modelo escolhido; trocar de conversa e cada uma manter o seu; Ollama fora do ar deixando o seletor num estado vazio legível em vez de quebrar. Ao vivo: a lista com os dez modelos reais, e a etiqueta de `vision` aparecendo **só** no `gemma3:4b`.
**Commit:** `feat(conversation): seletor de modelo alimentado pelo catálogo`

### Passo 3 — `num_ctx` na chamada, e os contadores de volta no contrato

`num_ctx` entra em `settings` e chega ao `options` do `/api/chat` ao lado do `num_thread` que já vai. `ChatReply` ganha `promptTokens` e `evalTokens`; `ollamaChat` para de descartar a linha final do stream.

**Aceite:** nível 1 do adaptador provando que os contadores da linha `done: true` chegam ao `ChatReply` (e que a ausência deles não quebra nada — provedor de nuvem pode não mandar); nível 3 de que `num_ctx` vai no `options` só quando definido, pelo mesmo motivo já registrado para o `num_thread`. Ao vivo: `num_ctx` alto numa conversa e o `/api/ps` reportando `context_length` igual ao escolhido.
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

> ⚠️ **A armadilha que este plano arma para o 17:** o medidor da D15.4 conta **caracteres**, e uma imagem não tem caracteres. Ela custa ~270 tokens fixos, medidos em ago/2026, independentemente das dimensões. Se o medidor for estendido para anexos somando texto extraído, ele vai reportar zero para a imagem e o portão vai deixar passar exatamente o caso mais caro. O contador de partes não-textuais é problema de quem cria a variante, e precisa nascer junto dela.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 09/08/2026 | — | plano escrito | Sessão de medição, sem código. As sondas contra o Ollama real derrubaram duas premissas escritas: `/api/tags` **não** reporta `vision` (o `ESCOPO.md` foi corrigido na mesma sessão) e `num_ctx` **não** é um botão de RAM (8× de contexto custa 120 MB). A medição do cache de prefixo — 287 ms contra 8.500 ms para o mesmo prompt — deu o número que faltava para descartar a janela deslizante por evidência em vez de por intuição. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [14 — Persistência das conversas](../implemented/14-persistencia-das-conversas.md) · **Índice:** [README](README.md) · **Camada de IA:** [09 — Camada de IA e ML](09-camada-de-ia.md)
