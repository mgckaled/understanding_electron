# N-3-E — o fechamento da trilha, e o esforço que muda de dono

> Quinto e **último** corte da trilha N-3. Material de entrada: os seis arquivos de [`docs/reference/ollama-cloud/`](../../reference/ollama-cloud/README.md), os diários dos quatro cortes anteriores, as sete skills, e o levantamento de esforço de pensamento por provedor feito nesta sessão (busca web + sonda própria contra o Ollama local). Siglas nascem como `DN3E.n`.

## Contexto

O `N-3-D` entregou o nível de raciocínio no fio e, junto, uma promessa: `N-3-E` seria a **escolha de esforço no composer**, com o fechamento empurrado para `N-3-F`. **A medição desta sessão desfez essa promessa**, e é o motivo deste corte existir na forma que tem.

Duas descobertas, nesta ordem:

1. **Nenhum dos dois `qwen3.5` honra o nível.** Com `seed: 42` e `temperature: 0`, `think: true`/`'low'`/`'medium'`/`'high'` produzem saída **idêntica byte a byte** — 1.210 caracteres de rastro e 447 tokens no `2b`; 1.367 e 502 no `4b`. A escada existiria para **um** modelo da frota.
2. **O servidor valida o nível; o modelo é quem ignora.** `think: "banana"` devolve HTTP 400 nomeando o enum (`"high", "medium", "low", "max", true, or false`) — então `200` prova apenas que a string é legal. Um teste de aceitação por status responde **sim para todos**.

Daí as três coisas que este corte faz: **o piso do `gpt-oss` vai para `'medium'`** (a única linha de produção), **a escolha de esforço vira escopo declarado da trilha `N-2`** com o levantamento ganhando dono, e **a trilha N-3 fecha** (`DNC-30`), o que inclui desfazer a renumeração de ontem.

---

## O que já está pronto e não se reconstrói

- **`requiredThinkLevel(name)`** (`core/ai/models.ts`, `DN3D.2`) já é a costura: o piso muda de valor, não de forma, e o `ChatFn.thinkLevel` continua exatamente como está.
- **`docs/reference/reasoning/`** já é o dono das APIs de raciocínio e está `✅ vivo` com escopo reduzido (a seção da Interactions API). O levantamento de esforço entra ali — não precisa de pasta nova.
- **`docs/reference/models/cloud-optin.md`** já é o dono da ficha de modelo de nuvem, e a pasta fica **viva** por decisão (`DNC-30`, destino 2).
- **`decisoes.md` da pasta `ollama-cloud`** nunca foi renumerado: o título § *O fechamento — o corte `N-3-E`* volta a estar certo sozinho.

---

## Decisões

### DN3E.1 — O piso do `gpt-oss` passa de `'low'` para `'medium'`, e isto revoga o VALOR de `DN3D.3`, não a forma

`DNC-13` escolheu o piso pelo custo: a cota é tempo de GPU, e a família gera 7× mais tokens. **O argumento tratava o raciocínio como exibição, e ele não é** — esforço compra qualidade de **resposta**, não só tamanho de rastro. Fixar o mínimo degradava toda resposta do `gpt-oss`, inclusive com o interruptor **desligado**, onde a economia parecia de graça: ali o usuário diz *"não quero ver"*, nunca *"pode pensar menos"*. A verificação ao vivo do `N-3-D` mostrou o sintoma — uma linha de rastro é, num modelo de raciocínio, quase não raciocinar.

`'medium'` é o default documentado do modelo, então o app **deixa de decidir por ele** até existir controle de verdade (`N-2`).

⚠️ **A consequência que precisa estar escrita, senão alguém "simplifica" depois:** com `medium`, o fio manda explicitamente o que o booleano ignorado já produzia. **Não é no-op** — é o tipo certo, é o que impede a família de cair em comportamento não declarado, e é a costura que a `N-2` vai usar. O custo de cota volta ao patamar medido na sondagem, e isso é escolha consciente do dono, não regressão silenciosa.

### DN3E.2 — A escolha de esforço sai da N-3 e vira **escopo declarado da `N-2`**; `DN3D.8` fica revogada

Medido nesta sessão: a escada teria **um** degrau útil e **um** modelo (`gpt-oss:120b`). O que muda o cálculo é quem vem depois — os provedores da `N-2` têm esforço **nativo e variado**: `reasoning_effort` na OpenAI (`minimal`/`low`/`medium`/`high`), na Groq (`gpt-oss` low/medium/high; **Qwen3 só `none`/padrão**; `qwen3.8-27b` os quatro, padrão `none`), na Cerebras (padrão **`high`** no `qwen-3.8-27b`), na xAI (low/high, e há modelo que recusa); `budget_tokens` na Anthropic (mínimo 1.024, **alvo e não teto**), que desde o Opus 4.8 ganhou também `effort` com `xhigh`/`max`.

**É lá que a escada tem mais de um degrau para servir**, e é lá que o app precisa de um vocabulário único traduzido por adaptador — o precedente citável é o OpenRouter, que aceita `effort` **ou** `max_tokens` e converte enum→orçamento por razão fixa (**0,8 / 0,5 / 0,2 / 0,1**, clampado a `[1024, 32000]`).

O desenho já está escolhido pelo dono e entra no registro **verbatim** (abaixo), para não se perder na transcrição: **pílula no composer**, ao lado de `Janela`, **presente só quando aquele modelo tem escada** — nunca desabilitada, e **nunca no seletor de modelo**, que o `N-3-B` acabou de reduzir a uma linha. O laço com a reserva de janela (`REASONING_OUTPUT_RESERVE_RATIO`) foi **recusado** pelo dono: as janelas dos modelos opt-in são folgadas para esta máquina. Números medidos por degrau (a variante que lia o Observatório) foram **recusados** junto — a escada é seca.

#### Os desenhos aprovados — copiar para o registro sem redesenhar

Três classes de modelo, três estados da barra. A pílula ocupa um vão no meio, entre a `Janela` (à esquerda) e o enviar (ancorado à direita), então **sumir não empurra ninguém**:

```
local sem pensamento (gemma3:4b, qwen2.5:7b)
  ⊕  Modelo [gemma3:4b ▾]  ⟳  Janela de contexto [32k ▾]              ↑

local com pensamento, mas booleano (qwen3.5:2b, qwen3.5:4b)
  ⊕  Modelo [qwen3.5:2b ▾]  ⟳  Janela de contexto [112k ▾]            ↑

com escada (gpt-oss:120b, e os provedores da N-2)
  ⊕  Modelo [gpt-oss:120b ▾]  ⟳  Janela [64k ▾]  Esforço [Médio ▾]    ↑
```

Aberta — **variante A, a escada seca**, sem número medido por degrau:

```
                          ┌─────────────────────────┐
                          │  ESFORÇO DE PENSAMENTO  │
                          │   ○ Baixo               │
                          │   ● Médio               │
                          │   ○ Alto                │
                          │  ───────────────────────│
                          │  Este modelo sempre     │
                          │  pensa; o interruptor   │
                          │  decide se você vê.     │
                          └─────────────────────────┘
  ⊕  Modelo [gpt-oss:120b ▾]  ⟳  Janela [64k ▾]  Esforço [Médio ▾]
```

Na janela estreita a fila quebra, e **é isso que precisa ser olhado ao vivo** — jsdom não faz layout, e o `N-3-B` pagou três vezes por esta classe:

```
┌────────────────────────────────────┐
│  ⊕  Modelo [gpt-oss:120b ▾]  ⟳     │
│     Janela [64k ▾]  [◐ Médio ▾]  ↑ │
└────────────────────────────────────┘
```

Duas regras que os desenhos fixam, e que a `N-2` não deve redecidir:

1. **A pílula aparece pela escada do modelo, nunca pelo estado do interruptor.** Amarrar um ao outro esconderia justamente o controle que economiza cota — o `gpt-oss` pensa de qualquer forma (`DN3D.3`).
2. **O controle some, não desabilita.** No `qwen3.5` não é que o esforço esteja indisponível: **não há escada** — e no GLM não há nem no provedor. Cinza afirmaria *"existe, só não agora"*.

### DN3E.3 — O levantamento ganha dono: `reference/reasoning/`, não `models/` nem `ollama-cloud/`

Três candidatos, e a régua é o assunto: `reference/models/` é ficha **por modelo** (peso, teto, KV/token); `reference/ollama-cloud/` vira `⛔ consumido` neste mesmo corte e enterraria o material; `reference/reasoning/` é o dono das **APIs de raciocínio**, está `✅ vivo`, e já guarda exatamente este gênero — as três APIs e os achados medidos do arco 21.

Entra como seção nova, com quatro partes: a tabela das três famílias de contrato (enum de nível · orçamento em tokens · enum próprio), a conversão do OpenRouter, **o método de sonda** — o ativo reutilizável quando a frota mudar: `seed` fixa + `temperature: 0`, mesmo prompt, dois níveis, comparar o rastro; um modelo por vez, `keep_alive: 0` entre medidas — e **os desenhos aprovados de `DN3E.2`, copiados verbatim**.

⚠️ **Os desenhos vão para o mesmo arquivo do levantamento, não para o `ROADMAP`.** A linha da `N-2` ali é uma célula de tabela; bloco de arte ASCII dentro dela seria ilegível e envelheceria escondido. O `ROADMAP` declara o escopo em prosa e **aponta**; o desenho tem um dono só, como todo fato neste projeto.

### DN3E.4 — A armadilha entra em `ARMADILHAS.md` por sintoma, porque custará tempo de novo

*"O modelo aceitou `think: 'high'` e nada mudou"* é a forma como isso vai reaparecer. O conteúdo: o servidor do Ollama valida o `ThinkValue` e devolve **400** para valor ilegal, então `200` diz apenas *"a string é legal"* — não *"este modelo honra"*. A única prova é a comparação com seed fixa. Mesma família do `think: false` que o `gpt-oss` ignora e do `num_ctx` que o Ollama descarta em silêncio: **nesta API o modo de falha padrão é o sucesso silencioso.**

### DN3E.5 — O fechamento executa o destino **triplo** de `DNC-30`, sem exceção

| O que sobrevive | Vai para | Estado final |
|---|---|---|
| Regra que decide a primeira linha — `attention`/`sizeBytes` forçados, o piso do `gpt-oss`, a armadilha `-cloud`, disponibilidade por `hasKey()` apesar de o ping funcionar | skill [`ai`](../../../.claude/skills/ai/SKILL.md) | ✅ dono (a maior parte **já** foi migrada nos cortes C e D — este corte confere, não recopia) |
| Ficha dos dois modelos de nuvem — teto, capacidades, e o fato de **não custarem RAM local** | `reference/models/cloud-optin.md` | ✅ **vivo** |
| A narrativa da sondagem — as 82 requisições, a série de cota, a bateria de qualidade, as quatro rejeições com motivo | `reference/ollama-cloud/` | ⛔ **consumido** |

⚠️ **A contagem do `README.md` da pasta `models/` envelhece junto** (*"sete candidatos de nuvem — três integrados"*): é item de auto-conservação (b), **remedir**, nunca copiar o número antigo mais dois.

### DN3E.6 — A renumeração de ontem é desfeita, e o registro do erro fica

A trilha volta a ter **cinco** cortes, `A`–`E`, com `E` sendo o fechamento — que é o recorte original de `DNC-30`. Seis lugares afirmam hoje o contrário e precisam voltar; dois deles são **história** e não se reescrevem:

| Onde | Tratamento |
|---|---|
| `ROADMAP.md` (linha N-3: lista de cortes e status) | **corrigir** — é estado atual |
| `reference/ollama-cloud/README.md` § 5 (tabela de cortes, "primeira letra livre", o parágrafo do `N-4`/`N-5`) | **corrigir** |
| skill `ai` (*"é o que justifica o corte `N-3-E`"*) | **corrigir** — passa a apontar a `N-2` |
| `HISTORY.md` (entrada do `N-3-D`) e `DECISOES.md` (`DN3D.8`) | **não reescrever.** A decisão foi tomada e depois revogada por medição — é exatamente o gênero que `DNC-31` registrou ao ser reescrita na mesma sessão: *o registro do erro fica porque o raciocínio que o produziu vai reaparecer*. Quem revoga é a entrada nova |

---

## Passos

Quatro, commitáveis em separado. **Só o primeiro toca código de produção**, e ele é uma linha.

### Passo 1 — o piso vai para `medium`

`core/ai/models.ts` (`requiredThinkLevel`), o teste de nível 1 que hoje afirma `'low'`, e o de nível 3 do adaptador. `DN3E.1`.

**As asserções são invertidas, não enfraquecidas** — o par de testes continua provando o mesmo: que a família recebe nível e que as demais recebem booleano. A sabotagem de `N-3-D` (mandar `false` com o interruptor desligado) continua sendo a que discrimina, e não precisa ser repetida: ela já provou o ramo, e o que muda aqui é a constante.

### Passo 2 — o registro da `N-2`, e a armadilha

`ROADMAP.md` ganha **linha própria** para a `N-2` (hoje ela só existe mencionada dentro da linha da `N-1`), com o escopo declarado em prosa — provedor terceirizado **e** a escolha de esforço — apontando para o levantamento. `reference/reasoning/` ganha a seção de esforço por provedor: as três famílias, a conversão do OpenRouter, o método de sonda e **os quatro blocos de desenho, copiados verbatim do plano**. `ARMADILHAS.md` ganha a entrada por sintoma. A skill `ai` passa a apontar para o novo dono. `DN3E.2`, `DN3E.3`, `DN3E.4`.

⚠️ **Bloco de código dentro de `.md` não passa pelo `guard`** (ele só vê `Edit`/`Write`, e nem assim inspeciona ASCII) — conferir a colagem **olhando**, porque um desenho desalinhado não quebra teste nenhum.

### Passo 3 — o fechamento da trilha

A ficha dos dois modelos em `cloud-optin.md` (+ **remedir** a contagem no `README.md` da pasta), `reference/ollama-cloud/` marcada `⛔ consumido` no cabeçalho dos seis arquivos, a conferência do que já migrou para a skill `ai`, e a renumeração desfeita nos quatro lugares que são estado atual. `ESCOPO.md` **verificado** — ele fala de classes (local/nuvem), não de provedor nomeado, então a expectativa é nenhuma mudança; se houver, é uma linha. `DN3E.5`, `DN3E.6`.

### Passo 4 — `HISTORY.md`, `DECISOES.md`, `ROADMAP` (N-3 concluída) e o plano para `implemented/`

---

## Verificação

### Automatizada

| Nível | O que prova | Sabotagem |
|---|---|---|
| 1 | `requiredThinkLevel` devolve `'medium'` para a família `gpt-oss` e `null` para o resto | — a asserção é o próprio valor; o par de casos já discrimina |
| 3 | o corpo da requisição leva `think: 'medium'` nos dois estados do interruptor | — provado no `N-3-D`, e a constante não muda o ramo |
| — | `pnpm exec node scripts/check-doc-links.mjs` verde | — |
| — | `grep -rn "N-3-F" docs/ .claude/` **sem resultado fora de `HISTORY.md`/`DECISOES.md`** | é o que prova que a renumeração foi desfeita **inteira**, não em três dos quatro lugares |

⚠️ **Documentação é a maior parte deste corte, e o portão dela é o script de links mais o grep acima** — foi assim que o rodapé apagado do `HISTORY.md` apareceu no `N-3-D`.

### Ao vivo (`pnpm dev`) — do dono, e é curta

| # | O que fazer | O que reprova |
|---|---|---|
| 1 | `gpt-oss:120b`, raciocínio **ligado**, uma pergunta que exija pensar | o rastro vir do tamanho de ontem (uma linha) — seria o `'low'` ainda no fio |
| 2 | comparar com o rastro de ontem | não haver diferença visível de profundidade: é o único discriminante honesto de `medium` contra `low` |
| 3 | o mesmo com o raciocínio **desligado** | rastro aparecer na conversa — a guarda do `N-3-A` continua valendo, e `medium` não a afeta |

⚠️ **Esperado:** o custo por resposta sobe. É a escolha de `DN3E.1`, e o número da sondagem (332 tokens para duas frases) é o patamar de volta.

---

## Riscos nomeados

- **`medium` devolve o custo de cota que `'low'` economizava.** Decisão consciente do dono, registrada com o motivo — e a quarta leitura de cota (82 req = 2,2 %) mostra que a faixa gratuita comporta folgadamente o uso real.
- **Desfazer a renumeração toca seis lugares, e dois deles são história.** O risco é "consertar" o `HISTORY.md` e apagar a decisão revogada — que é justamente o que o projeto guarda de propósito.
- **`⛔ consumido` é irreversível na prática.** Depois dele, a pasta deixa de ser consultada; o que não tiver migrado para a skill `ai` ou para `cloud-optin.md` some do caminho de quem lê. Por isso o passo 3 **confere** o que já migrou em vez de supor.
- **Um corte majoritariamente documental não tem rede.** Nenhum nível de teste alcança um apontador errado; o script de links e o grep são tudo o que existe.

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 14/09/2026 | Os quatro passos implementados e o corte fechado | **O passo 1 foi uma linha e três asserções invertidas**; o resto é documentação, que é onde este corte tinha risco. **Dois achados da execução.** (a) A entrada nova de `ARMADILHAS.md` apontava para `plan/implemented/`, onde o plano **ainda não estava** — o script de links pegou na hora, e é exatamente o caso (a) de auto-conservação que o `CLAUDE.md` descreve: mover um arquivo conserta os links **para** ele e quebra os **de dentro** dele. Apontado para `active/` e corrigido junto da mudança. (b) Ao arquivar a `23-F` cortei **só** até o rodapé, aplicando a lição do `N-3-D`, onde o mesmo corte levou três seções de rodapé junto sem que `git diff --stat` mostrasse. **Duas contagens remedidas, nunca copiadas:** armadilhas 116 → **119** (93 ativas + 26 arquivadas) no `CLAUDE.md`, e candidatos de nuvem sete → **nove** (cinco integrados) no `README.md` de `reference/models/`. O `grep` por `N-3-F` fora de `HISTORY`/`DECISOES` voltou **vazio**, que era o portão da renumeração |
| 14/09/2026 | Plano escrito. Sonda própria contra o Ollama local decidiu o recorte | **A pergunta em aberto do `N-3-D` foi medida antes de virar plano, e a resposta mudou o dono do trabalho.** Nenhum dos dois `qwen3.5` honra `think` como nível — saída **idêntica byte a byte** sob `seed: 42`/`temperature: 0` (1.210 ch / 447 tk no `2b`; 1.367 / 502 no `4b`) —, então a escada seria de um modelo só e pertence à `N-2`, onde os provedores têm esforço nativo. ⚠️ **A sonda entregou uma armadilha que vale mais que a resposta:** `think: "banana"` devolve **400** com o enum do servidor, o que prova que `200` não diz nada sobre o modelo honrar. E o piso volta a `'medium'` porque o argumento de custo de `DNC-13` tratava raciocínio como exibição: esforço compra **qualidade de resposta**, e o piso degradava toda resposta do `gpt-oss` — inclusive com o interruptor desligado, onde a economia parecia de graça |
