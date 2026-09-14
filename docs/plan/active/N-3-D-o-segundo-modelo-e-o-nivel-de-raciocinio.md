# N-3-D — o segundo modelo e o nível de raciocínio

> Quarto corte da trilha N-3. Material de entrada: os seis arquivos de [`docs/reference/ollama-cloud/`](../../reference/ollama-cloud/README.md) lidos na íntegra, os diários dos [`N-3-A`](../implemented/N-3-A-a-trava-antes-da-porta.md), [`N-3-B`](../implemented/N-3-B-o-popover-em-uma-linha.md) e [`N-3-C`](../implemented/N-3-C-o-servico-e-o-catalogo-sondado.md), as sete skills, e refinamento externo obrigatório (Context7 na doc oficial do Ollama sobre `think`; busca web sobre `thinking_level` do Gemini). Siglas nascem como `DN3D.n`.

## Contexto

O `N-3-C` entregou o Ollama Cloud com **um** modelo, `gemma4:31b`, e deixou o segundo de fora por uma razão nomeada: a família `gpt-oss` **não aceita o booleano** que o app manda em `think`. É contrato documentado, não defeito do serviço (`DNC-12`) — e o app estava mandando o tipo errado desde sempre, sem que nada quebrasse, porque nenhum modelo da frota local ignora `think: false`.

Este corte faz três coisas, nesta ordem de dependência:

1. **o nível entra no fio** — `ThinkLevel` sobe ao `ChatFn`, e o handler o preenche com o piso `'low'` para quem exige nível (`DNC-13`);
2. **`gpt-oss:120b` entra na lista fixa** (`DNC-3`) — só é possível depois de (1);
3. **`total_duration` passa a ser lido e exibido** (`DNC-20`) — a nuvem não manda nenhuma das três durações nativas, e manda esta, que o app descarta hoje.

⚠️ **O recorte da trilha mudou nesta sessão, e a renumeração é parte do plano.** O refinamento mediu o que a pergunta *"quais modelos têm esforço de pensamento?"* respondia: **três dos quatro serviços têm**, e o conjunto de níveis válidos **varia por modelo** — não é um enum global. Escolher esforço vira corte próprio, **`N-3-E`**, e o fechamento (`DNC-30`) desce para **`N-3-F`** (`DN3D.8`).

| Serviço | Esforço | Fonte |
|---|---|---|
| Ollama local | `thinking` só nos dois `qwen3.5` (sondado nesta sessão, 12 modelos, só metadados). Aceitarem **nível** não está medido | `/api/show` |
| Ollama Cloud | os seis declaram `thinking`; **`gpt-oss` exige** nível, os outros quatro aceitam booleano | `DNC-12`, doc oficial |
| Gemini | `thinking_level` com **quatro** valores, conjunto **variável por modelo** — o `minimal` que deu 400 no `gemini-3.7-flash` existe nos Flash 3.x | doc do Gemini |
| GLM | só `enabled`/`disabled` — **sem** nível | `providers/glm.ts`, medido no 21-A |

---

## O que já está pronto e não se reconstrói

- **A guarda de acúmulo de raciocínio** (`DN3A.1`/`DN3A.2`) já existe nos três adaptadores e no `useConversationChat`. É ela que torna seguro mandar `'low'` com o interruptor desligado: o rastro chega, não é acumulado, não é persistido. **O `N-3-A` existiu exatamente para que este corte pudesse acontecer.**
- **O adaptador parametrizado** (`DN3C.3`): mexer em `providers/ollama.ts` serve os dois alvos de uma vez, e é o preço aceito em `DNC-10`.
- **`describeUpstreamError`** já trata 400/401/402 sem acréscimo.
- **O painel Desempenho degrada sozinho** — todo campo de duração é opcional, e `avgOf` já ignora ausente. Uma coluna nova entra sem nenhuma guarda especial.
- **A migração é escada por `PRAGMA user_version`**, e `observatory.db` tem a sua própria (`src/main/observatory/db/migrations.ts`, hoje em `v4`).

---

## Decisões

### DN3D.1 — `ThinkLevel` sobe ao `ChatFn`, e quem o preenche é o **handler**, não o adaptador

`DNC-12`. Duas formas existiam: decidir o nível dentro de `ollama.ts` (contrato intocado, precedente do `thinking_level: 'low'` chumbado no `gemini.ts`), ou pô-lo no `ChatFn`. **Vale a segunda, e a razão é datada, não especulativa:** o `N-3-E` troca *quem decide o valor* — o usuário, no composer —, e isso obriga o nível a atravessar o fio de qualquer forma. Decidi-lo no adaptador agora significaria reescrevê-lo em seguida.

⚠️ **Isto não abre exceção à régua de `DNC-1`.** Um parâmetro com um valor só seria ponto de extensão especulativo se o segundo valor fosse hipotético; aqui o consumidor tem corte escrito e a medição que o motiva está na tabela acima.

`ChatFn` não ganha um flag paralelo: `onThinking` continua sendo **o** sinal de que se quer raciocínio (D21A.1). `thinkLevel` responde a outra pergunta — *com quanto esforço* —, e os dois se compõem no adaptador.

### DN3D.2 — Quem exige nível é reconhecido pelo **nome de família**, e isso é uma limitação da API, não uma preferência

`capabilities` do `/api/show` diz `thinking`, nunca *"exige nível"*. A única fonte dessa informação é a doc (*"GPT-OSS requires `think` to be set to `low`, `medium` or `high`. Passing `true`/`false` is ignored for that model"*), então o predicado testa o **nome**. Ele vive em `core/ai/models.ts`, puro e de nível 1, ao lado de `isCloudRoutedName`, que resolve o mesmo tipo de pergunta pela mesma razão.

⚠️ Vale para os dois alvos do Ollama: `gpt-oss` instalado localmente teria o mesmo contrato. O predicado não pergunta de que serviço o modelo veio.

### DN3D.3 — Com o interruptor **desligado**, o `gpt-oss` recebe `'low'` mesmo assim

Parece contradição e não é. A doc é explícita: *o rastro não pode ser desligado* para essa família. Mandar `think: false` não desliga nada — faz o modelo pensar no nível **padrão**, que é a verbosidade de 7× medida (`332` tokens contra `48` do `gemma4:31b`, e `1.372` numa pergunta trivial). `'low'` é o **mínimo possível**, e a cota é tempo de GPU: desligar o interruptor passa a custar menos, não mais.

O que o app promete continua honesto porque a guarda do `N-3-A` já garante o resto: rastro não pedido **não é exibido nem persistido**. O app não promete desligar o que o provedor não desliga (`DNC-13`) — ele deixa de pagar caro por isso.

### DN3D.4 — Entra `gpt-oss:120b`; `gpt-oss:20b` continua fora

`DNC-3`/`DNC-4`. O `120b` entra pela capacidade bruta — 116 B de parâmetros, 315 tok/s medidos, ~8× o melhor local, um modelo que nesta máquina não roda de forma alguma. A ressalva que fica é o acionamento inconsistente de ferramenta, e ela **não morde**: o app não tem loop de ferramenta (`DNC-19`).

O `20b` fica fora por defeito do serviço (HTTP 400 em toda requisição com `tools`, com um excesso invariável de "17 tokens") e por ser dominado pelo `120b` em velocidade, cota e correção mesmo sem ferramenta.

A lista fixa passa a ter dois nomes, e o custo do catálogo vai de 1+1 para **1+2** requisições — nunca 1+20 (`DNC-5`).

### DN3D.5 — `total_duration` vira **coluna própria**, e não refina `Rede+Prefill`

`DNC-20`, com a forma decidida pelo dono nesta sessão. A nuvem manda só `total_duration` (`nativeDurations()` devolve `{}` para ela); o local manda as quatro. Ler a única que chega dos dois lados dá uma comparação direta: **o total do servidor contra o nosso relógio de parede**, e a diferença é a rede.

⚠️ **Refinar a coluna existente foi recusado**: `Rede+Prefill` tem significado documentado em `reference/observatory/` § 9.2, e mudá-lo por dentro faria o mesmo número dizer outra coisa sem que a tabela avisasse. Coluna nova não reinterpreta nenhuma antiga.

⚠️ **A semântica é do servidor, não do caminho inteiro** — a doc define `total_duration` como *"total time spent generating"*, em nanossegundos. Ele **não** inclui a rede, e é exatamente por isso que a subtração diz alguma coisa.

### DN3D.6 — A coluna do banco é **degrau novo** (`v5`), nunca edição do `v2`

Regra do próprio projeto (D14.2), e o comentário do `v3` de `observatory.db` já a registra: existe banco de desenvolvimento nesta máquina com linhas reais; `ALTER TABLE` as mantém, editar o `v2` no lugar não.

Linha existente fica com `NULL` na coluna nova, que é o valor verdadeiro — aquela resposta não teve total reportado guardado. `avgTotalDurationMs` é `number | null`, e a célula mostra `—`, mesma régua de `maxLoadDurationMs`.

### DN3D.7 — **Quanto `'low'` reduz** é medição deste corte, não número herdado

`DNC-13` afirma que o nível ataca a raiz do custo, e isso é dedução da documentação: **o número não foi medido**. A régua de 332 contra 48 tokens é o *antes*. O *depois* sai no passo 5, com a mesma pergunta e o mesmo modelo, lendo `eval_tokens` no medidor da própria conversa — sem sonda à parte, sem cota extra além da conversa que já se vai ter.

### DN3D.8 — O corte de **escolha de esforço** nasce como `N-3-E`, e o fechamento vira `N-3-F`

A trilha foi recortada em cinco cortes com o fechamento em `E` (`DNC-30`). A medição desta sessão mostra que escolher esforço é assunto próprio: três serviços têm níveis, o conjunto válido **varia por modelo** (Gemini omite `minimal` em alguns; GLM não tem nenhum; Ollama depende da família), e um controle que ofereça um enum global prometeria o que metade dos provedores não cumpre.

Entra como corte, não como apêndice deste — a régua do projeto contra corte que cresce demais. **O fechamento continua sendo o último**, agora em `F`.

---

## Passos

Cinco, commitáveis em separado. Os três primeiros não dependem um do outro em comportamento, mas (2) só é verificável depois de (1).

### Passo 1 — o nível entra no fio, com o piso do `gpt-oss`

`core/ai/types.ts` (`ThinkLevel`, `ChatFn.thinkLevel`), `core/ai/models.ts` (o predicado por nome de família), `main/features/ai/handlers.ts` (preenche o piso), `providers/ollama.ts` (compõe `think` a partir dos dois sinais). `DN3D.1`–`DN3D.3`.

Gemini e GLM **não são tocados**: nenhum dos dois recebe `thinkLevel` ainda, e é o `N-3-E` que decide o que cada um faz com ele. O campo é opcional, então os dois adaptadores seguem compilando sem uma linha.

Nível 1 no predicado, nível 3 no handler e no adaptador.

### Passo 2 — `gpt-oss:120b` entra na lista fixa

Uma string em `OLLAMA_CLOUD_MODEL_NAMES`, mais o comentário que hoje explica a ausência dele e passa a estar errado (auto-conservação (a) — o texto cita `N-3-D` pelo nome). `DN3D.4`.

Nível 3: o catálogo passa a fazer **três** requisições, e o modelo fora da lista continua não sendo sondado.

### Passo 3 — o adaptador lê `total_duration`

`providers/ollama.ts` (`nativeDurations` ganha o campo), `shared/ipc.ts` (`ChatReply.totalDurationMs`), `main/observatory/chatTiming.ts`, `core/observatory/performance.ts` (`PerformanceEvent`). `DN3D.5`.

Nível 3 no adaptador, contra a linha final de fixture que a sondagem mediu.

### Passo 4 — a coluna, do banco à tela

Migração `v5` de `observatory.db`, `recordPerformanceEvent`/`listPerformanceEvents`, `summarizeByModel` (`avgTotalDurationMs`), `PerformanceSummary`, e a coluna `Total (provedor)` no `PerformancePanel`. `DN3D.5`, `DN3D.6`.

Nível 1 no resumo, nível 3 na persistência (banco real em `:memory:`, nunca fake), nível 2 na tabela.

### Passo 5 — verificação ao vivo (do dono) e fechamento

Roteiro abaixo, incluindo a medição de `DN3D.7`. Depois: `HISTORY.md`, `DECISOES.md`, skill `ai`, `ARMADILHAS.md` se houver, `ROADMAP.md` (com a renumeração de `DN3D.8`), e o plano para `implemented/`.

---

## Verificação

### Automatizada — e a sabotagem é estreita, onde a asserção corre risco de nascer vácua

⚠️ **Nem toda linha desta tabela pede sabotagem, e provar demais é retrabalho.** A régua: sabota-se onde o teste **poderia passar com o defeito presente**. Onde o discriminante é o próprio valor asserido contra uma fixture, o vermelho já é estrutural.

| Nível | O que prova | Sabotagem |
|---|---|---|
| 1 | o predicado reconhece a família `gpt-oss` nas duas grafias de tag e **não** reconhece `gemma4`/`qwen3.5` | — o par de casos já discrimina |
| 3 | com o interruptor **ligado** e modelo `gpt-oss`, o corpo leva `think: 'low'`; com ele **desligado**, leva `'low'` **também** | **sim** — mandar `false` no caso desligado: é o desenho que `DN3D.3` recusa, e um teste que só olhasse o caso ligado passaria com ele |
| 3 | modelo que **não** exige nível continua recebendo booleano nos dois estados | — a asserção é sobre o corpo, contra fixture |
| 3 | o catálogo de nuvem faz **três** requisições e sonda os dois nomes da lista | — a contagem é o discriminante |
| 3 | `total_duration` vira `totalDurationMs` em ms; uma linha final **sem** o campo não produz a chave | **sim** — devolver `0` no lugar de ausente: é a diferença entre "não reportado" e "instantâneo", e a asserção de ausência é fácil de escrever vácua |
| 1 | `summarizeByModel` devolve `avgTotalDurationMs: null` quando nenhuma linha do balde reporta, e a média quando alguma reporta | — os dois baldes discriminam |
| 3 | a migração `v5` preserva linha escrita antes dela, com `NULL` na coluna nova | — o banco real responde |
| 2 | a coluna aparece com `—` quando `null` | — |

⚠️ **Vermelho tem uma forma só:** `Tests N failed`, com o **nome** do teste na lista. Sabotagem por shell afirma que o texto mudou **antes** de rodar (`N-3-C`: os arquivos são CRLF, e duas sabotagens não aplicaram enquanto o verde parecia confirmá-las).

⚠️ **A suíte nunca toca `ollama.com`** — `fetch` injetado, fixtures gravadas do que a sondagem mediu.

### Ao vivo (`pnpm dev`) — do dono, e o roteiro diz regra, não número

⚠️ **Consome cota real** (poucas requisições) e exige a chave gravada no cofre.

| # | O que fazer | O que reprova |
|---|---|---|
| 1 | abrir o popover de modelo com a chave gravada | `gpt-oss:120b` não aparecer no grupo Nuvem, ou aparecer sem os chips que o `/api/show` reporta |
| 2 | selecionar `gpt-oss:120b`, **interruptor de raciocínio ligado**, e fazer uma pergunta curta em português | não responder; ou o rastro não aparecer no `ReasoningDisclosure` |
| 3 | anotar `Geração (raciocínio + resposta)` no rodapé da resposta | — é o *depois* de `DN3D.7`; o *antes* registrado é 332 tokens para a mesma classe de pergunta |
| 4 | repetir a **mesma** pergunta com o **interruptor desligado** | rastro aparecer na conversa, ou sobreviver a recarregar o app (seria a guarda do `N-3-A` furada) |
| 5 | comparar a geração dos itens 3 e 4 | o número do item 4 ser **maior** que o do item 3: `'low'` nos dois, então a diferença esperada é só o que não se exibe |
| 6 | Observatório → **Desempenho** | não haver coluna `Total (provedor)`; ou ela vir vazia para `ollama-cloud`, que é o que este corte existe para consertar |
| 7 | conversar uma vez com um modelo **local** e reabrir o painel | a coluna vir `—` no local: o daemon manda `total_duration` também |
| 8 | comparar `Rede+Prefill + Decode` contra `Total (provedor)` na linha de nuvem | o total do servidor ser **maior** que o nosso relógio — seria leitura ou conversão errada, não rede |
| 9 | Observatório → **Privacidade** | as conversas do `gpt-oss:120b` não aparecerem como saída para nuvem |

⚠️ **Esperado e não é defeito:** `Entrada tok/s` e `Carga (pico)` seguem `—` para a nuvem — ela não manda `prompt_eval_duration` nem `load_duration`, e nenhum corte vai inventá-los.

---

## Riscos nomeados

- **`'low'` pode não reduzir o que `DNC-13` supõe.** É dedução da doc, medida só no passo 5. Se reduzir pouco, a decisão não muda (o piso continua sendo o mínimo possível), mas o argumento financeiro registrado no `HISTORY.md` precisa dizer o número medido, não o esperado.
- **A lista fixa pode estar velha.** `gpt-oss:120b` é o nome de 13/09/2026; o item 1 do roteiro é onde isso aparece, e o conserto é uma string.
- **O parser é compartilhado com o provedor local** (`DNC-10`): a mudança de `think` e a leitura de `total_duration` afetam os dois alvos. É o preço aceito, e o item 7 do roteiro é quem olha o lado local.
- **A coluna nova estreita as outras sete** numa tabela que já tem `min-w-[720px]` e rolagem horizontal própria. jsdom não faz layout — quem reprova é o item 6 na janela estreita, não a suíte (`N-3-B` pagou três vezes por essa classe).
- **`N-3-E` herda um contrato com um valor só.** Se aquele corte nunca acontecer, `thinkLevel` fica sendo um parâmetro que só o handler preenche — aceitável, mas é a hipótese que `DN3D.1` assume ao recusar a forma adaptador-local.

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 14/09/2026 | Plano escrito. Sete skills invocadas, os seis arquivos de `reference/ollama-cloud/` lidos na íntegra, `DN3D.1`–`DN3D.8` fixadas | **O refinamento externo mudou o recorte da trilha, não só o do corte.** A pergunta do dono — *quais modelos da frota têm esforço de pensamento?* — foi medida em vez de suposta: sonda local (12 modelos, só metadados, nenhum carregado) mostra `thinking` apenas nos dois `qwen3.5`; a doc do Gemini mostra `thinking_level` com **quatro** valores e conjunto **variável por modelo**, o que reabre o `medium`/`high` que o app nunca testou; o GLM não tem níveis. Três dos quatro serviços têm esforço, e isso transforma "escolher nível no composer" de apêndice em corte próprio (`DN3D.8`): `N-3-E` passa a ser a escolha de esforço, e o fechamento desce para `N-3-F`. Consequência no desenho deste corte: o nível sobe ao `ChatFn` **agora** (`DN3D.1`), porque decidi-lo dentro do adaptador seria reescrito pelo corte seguinte |
