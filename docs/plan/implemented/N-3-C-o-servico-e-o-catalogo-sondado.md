# N-3-C — o serviço e o catálogo sondado

> Terceiro corte da trilha N-3, e o **primeiro que toca nuvem**. Material de entrada: os seis arquivos de [`docs/reference/ollama-cloud/`](../../reference/ollama-cloud/README.md), os diários do [`N-3-A`](N-3-A-a-trava-antes-da-porta.md) e do [`N-3-B`](N-3-B-o-popover-em-uma-linha.md), as sete skills, e refinamento externo obrigatório (Context7 na doc oficial da API do Ollama; busca web sobre a chave e a faixa gratuita). Siglas nascem como `DN3C.n`.

## Contexto

Os dois primeiros cortes não tocaram nuvem de propósito — `consertar antes de acrescentar`. O `N-3-A` fechou a guarda de raciocínio, o descarte de modelo `-cloud` do catálogo local e o teto de contexto por serviço; o `N-3-B` deixou o popover pronto para receber linhas novas. **Agora o provedor entra.**

Este corte termina com **uma conversa funcionando** contra `gemma4:31b` na nuvem da Ollama: serviço próprio, chave no cofre, catálogo sondado, disponibilidade por chave, e o gate que declara o limite de `ai:propose`. Um modelo só — `gpt-oss:120b` é do `N-3-D`, porque exige `ThinkValue` no contrato dos **quatro** provedores, e isso é uma segunda variável.

⚠️ **O que torna este corte diferente dos dois anteriores de nuvem (`N-1-B`, `N-1-C`): o catálogo é SONDADO.** GLM e Gemini são tabelas fixas em `core/ai/models.ts`, importadas direto pelo renderer — não há `/api/show` para sondar. A Ollama publica os dois endpoints **sem credencial**, com `capabilities` e teto de contexto reais. É o primeiro provedor de nuvem do app com catálogo medido em vez de escrito à mão (`DNC-5`).

---

## O que já está pronto e não se reconstrói

- **`isCloudService(service)`** (`core/ai/messages.ts`) decide por `service !== 'ollama'`, então `'ollama-cloud'` é registrado no ledger de privacidade **sem uma linha nova** (`DNC-18`). Nenhum trabalho de ledger entra aqui.
- **`offeredCeiling`/`costsLocalRam`** (`core/ai/memory.ts`, `DN3A.5`) já decidem por serviço: um modelo de nuvem recebe o teto treinado e não custa RAM local. O `N-3-A` existiu para que este corte não precisasse tocar nisso.
- **O parser NDJSON de `providers/ollama.ts` serve sem uma linha de mudança** — medido contra a nuvem: transporte, `message.thinking` como campo irmão, `done_reason`, `prompt_eval_count`/`eval_count`, papel `system` interno e campo `images`, todos idênticos (`DNC-10`).
- **`describeUpstreamError`** já trata 401 (dica por status) e **402** (cai em `messageFromBody`, lê a forma `{"error": "..."}` da Ollama e produz mensagem acionável com a URL de upgrade). Nada a acrescentar para os status desta API.
- **O cofre existe inteiro** desde a `N-1-A`: `hasSecret`, `readSecretForUse`, `writeSecret`, o campo mascarado de `CloudSecrets.tsx`, o seed por `.env`. Um provedor novo é uma entrada em `CLOUD_PROVIDERS` e quatro `Record` exaustivos.
- **`AppError` não ganha variante:** `{ kind: 'blocked'; reason }` já existe e `errorMessage()` devolve o `reason` **verbatim**. O gate do `ai:propose` usa isso, sem entrada nova em `MESSAGES`.

---

## Decisões

### DN3C.1 — `'ollama-cloud'` entra em `aiServiceSchema` **e** em `CLOUD_PROVIDERS`, e é o primeiro valor nos dois

`DNC-8`, com o motivo que o `N-3-A` já pagou: `isCloudService()` decide por `service !== 'ollama'`, e é ela que liga o ledger. Um modelo de nuvem chegando sob `'ollama'` enviaria dados — **imagem inclusive** — sem uma linha de registro. O caminho errado custa **zero** linha de código, que é exatamente o que o torna tentador.

Cinco `Record` exaustivos cobram entrada, e o `pnpm typecheck` é quem cobra:

| Onde | O quê |
|---|---|
| `main/features/ai/handlers.ts` | `HINTS: Record<AiService, string>` |
| `renderer/src/shared/serviceLabel.ts` | `SERVICE_LABEL: Record<AiService, string>` |
| `main/features/secrets/seed.ts` | `ENV_VAR_BY_PROVIDER: Record<CloudProvider, string>` |
| `renderer/features/settings/CloudSecrets.tsx` | `PROVIDER_LABEL: Record<CloudProvider, string>` |
| `renderer/features/observatory/CapabilitiesPanel.tsx` | `CLOUD_LABEL: Record<CloudProvider, string>` |

⚠️ **E um sexto lugar NÃO é cobrado por ninguém:** `AI_SERVICES: AiService[]` em `renderer/features/observatory/useCapabilities.ts` é um **array escrito à mão**. Um serviço ausente ali compila, passa no lint e passa na suíte — o painel Capacidades simplesmente não mostra o cartão, sem nenhum sinal. É o item de auto-conservação (b) deste corte, e vai no passo 1 junto dos outros cinco.

### DN3C.2 — `resolveProvider` passa a ser exaustivo, em vez de cair no Ollama local

Hoje é `if (glm) … if (gemini) … return ollamaAdapter`. **O ramo padrão é justamente o perigoso:** um serviço novo que alguém esqueça de ligar não falha — ele roteia para o daemon **local**, que é a forma exata do risco que `DNC-8` existe para impedir, agora por omissão em vez de por tag. Com um mapa `Record<AiService, ProviderAdapter>`, esquecer um serviço vira erro de compilação.

É mudança em código que serve os três provedores existentes, e por isso vai **sozinha** no passo 1, antes de qualquer coisa de nuvem.

### DN3C.3 — O adaptador é `ollama.ts` **parametrizado**, e o filtro `-cloud` NÃO viaja com a parametrização

`DNC-10`: duplicar as 279 linhas criaria dois donos do mesmo parser, divergindo em silêncio. As funções de módulo viram fábricas sobre um alvo (`{ baseUrl, headers, dropCloudRouted }`), e os exports de hoje (`ollamaChat`, `ollamaModels`, `ollamaProbe`, …) continuam existindo como a **instância local** — `register-all.ts` e os testes de hoje não mudam de forma.

⚠️ **O filtro de `isCloudRoutedName` é do catálogo LOCAL e não pode ser herdado pelo de nuvem** — achado do refinamento desta sessão, não do recorte. A doc oficial (Context7, `docs.ollama.com/api/authentication`) mostra que o sufixo pertence ao **caminho de roteamento local** (`ollama run gpt-oss:120b-cloud`), enquanto a REST contra `ollama.com` usa o nome **nu** (`"model": "gpt-oss:120b"`). Aplicar o filtro do lado da nuvem seria errado por dois motivos: ali o modelo de nuvem é o que se **quer**; e se o catálogo da nuvem um dia listar a segunda grafia (`qwen3.5:cloud`, a que `DN3A.3` descobriu), o filtro a apagaria **em silêncio** — um buraco na guarda cuja razão de existir é impedir o silêncio.

### DN3C.4 — Lista fixa de **um**, e ela filtra ANTES do `/api/show`

`DNC-5`. `/api/tags` da nuvem traz **20** modelos, dos quais 14 respondem **402** e não há como distinguir os gratuitos pela API — o catálogo autenticado é idêntico ao anônimo. A combinação resolve os dois lados: **sonda o que é verdade, cura o que aparece.**

Filtrar antes de sondar também paga o N+1: **1 + 1 = duas** requisições, não 1 + 20.

⚠️ **A lista envelhece, e isso é aceito conscientemente.** Um modelo que suma do `/api/tags` simplesmente não aparece no seletor, sem quebrar nada; o inverso — um modelo novo e bom entrar — não acontece sozinho. É manutenção conhecida, não defeito. O nome `gemma4:31b` vem da sondagem de 13/09/2026 e **se confirma na primeira execução do passo 3**, não antes.

### DN3C.5 — `attention` e `sizeBytes` são **forçados**; `contextLength` é **herdado**

`DNC-6`. Hoje nenhum dos seis reporta `attention.head_count_kv`, então `readAttention()` devolve `null` e `costed` sai `false` — **está certo por acidente**. Se um modelo passar a publicar os três campos, o app começaria a orçar RAM **local** para um modelo que não usa RAM local, em silêncio. `sizeBytes` herdado exibiria **13,7 GB** de disco que não existe (`gpt-oss:20b` no `/api/tags` da nuvem).

O que **se herda** é o teto de contexto e as `capabilities` — é exatamente o ganho da sonda sobre a tabela escrita à mão. O forçamento mora num normalizador próprio do alvo de nuvem, nunca em `normalizeOllamaModel`, que é do local.

### DN3C.6 — Disponibilidade por `hasKey()`, **apesar** de o ping funcionar

`DNC-7`, e a diferença contra Gemini/GLM precisa estar no comentário. Ali a régua vale porque não há ping possível; aqui `/api/version` responde **200 sem chave**, então um ping provaria apenas que a internet existe. Sem o comentário, alguém "conserta" isto para um ping de verdade e o cartão de status passa a mentir.

### DN3C.7 — A sonda só acontece com **chave guardada** — decidido pelo dono nesta sessão

O catálogo é público, então sondar sem chave é tecnicamente possível. **Não se faz**, porque quebraria um invariante que o app cumpre hoje inteiro: *nenhuma chamada a terceiro sem opt-in*. GLM, Gemini e Context7 só tocam a rede depois que existe chave; um catálogo sondado no boot faria o app falar com `ollama.com` em toda sessão de quem nunca vai usar nuvem — e não há tela onde isso esteja divulgado.

**A consequência é assumida:** sem chave, **nenhuma linha** de Ollama Cloud no seletor, o que quebra a convenção "linha desabilitada com dica" que GLM e Gemini seguem. A quebra é deliberada — aquela convenção pressupõe catálogo de graça, e este não é. A descoberta acontece no campo de chave em Configurações, que é onde todo provedor se descobre.

Mecanicamente: `useAiModels` ganha um segundo parâmetro `enabled`. ⚠️ **Não basta passar `enabled` ao `useQuery`:** uma query desabilitada no TanStack v5 fica `isPending: true` para sempre, e o estado atual traduziria isso como `loading` eterno. O hook precisa devolver `{ status: 'idle' }` antes de olhar `isPending`.

### DN3C.8 — `loaded` devolve lista vazia e `unload` é no-op

`DNC-11`. `/api/ps` responde **401** — resposta verdadeira, não recurso faltando: não há modelo residente em RAM local para listar ou descarregar. Mesmo tratamento de `glmLoaded`/`glmUnload`.

### DN3C.9 — O gate de `ai:propose` recusa **todo** serviço de nuvem, não só este

`DNC-19`. `format` é ignorado em silêncio pela nuvem da Ollama — testado em quatro modelos e nas três formas, todas HTTP 200 com markdown. ⚠️ **Mas o problema é maior que este provedor:** `grep format` em `providers/gemini.ts` e `providers/glm.ts` devolve **zero linhas**, e `register-all.ts` entrega `resolveProvider(args.service).chat` ao `aiPropose` para **qualquer** serviço. **`ai:propose` já é só-Ollama-local hoje, e isso não está declarado em lugar nenhum.** A nuvem não introduz o defeito; torna-o visível.

O gate fica no **main** (`features/ai/propose.ts`), antes de gastar o `runProfile`, usa `isCloudService` — que já é o dono da pergunta, em `core/` — e devolve `{ kind: 'blocked', reason: … }`. Hoje o caminho degrada para `invalidProposal` ("não foi possível entender a proposta do modelo"), que **culpa o modelo por um limite do app**.

⚠️ **O contorno medido existe e não entra:** uma ferramenta cujo schema de parâmetros seja o schema do passo devolve `arguments` estruturado, e `tool_calls` chega em streaming. É **gatilho** no [`ROADMAP § 2`](../../ROADMAP.md), sem trilha reservada — reservar um corte para algo que talvez nunca seja preciso é o ponto de extensão especulativo que `DNC-1` recusa.

### DN3C.10 — `think` continua booleano neste corte

`gemma4:31b` **respeita `think: false`** (medido). A família `gpt-oss` não — ela só aceita nível, por contrato documentado (`api/types.go` declara `Think` como booleano **ou** string) —, e é por isso que o segundo modelo é do `N-3-D`: `ThinkValue` muda o contrato dos **quatro** provedores, e misturá-lo com o nascimento de um quinto seria duas variáveis no mesmo corte.

---

## Passos

Cinco, commitáveis em separado. Os dois primeiros não falam com a nuvem.

### Passo 1 — o serviço nasce, e o resolvedor deixa de ter ramo padrão

`shared/ipc.ts` (`aiServiceSchema`, `CLOUD_PROVIDERS`), os cinco `Record` que o typecheck cobra, o `AI_SERVICES` que **não** é cobrado, e `resolveProvider` virando mapa exaustivo. `DN3C.1`, `DN3C.2`.

Sem adaptador ainda: o serviço existe, o campo de chave aparece em Configurações, e nenhum modelo pode carregá-lo porque não há catálogo. Nível 1 no schema, nível 3 no resolvedor.

### Passo 2 — `ollama.ts` vira parametrizável, sem mudar comportamento nenhum

As fábricas sobre `{ baseUrl, headers, dropCloudRouted }`, com os exports de hoje preservados como a instância local. `DN3C.3`.

**Refatoração pura:** a suíte de `ollama.test.ts` (381 linhas) tem de passar **sem uma linha alterada**. Se precisar mudar, a parametrização escolheu a fronteira errada.

### Passo 3 — o provedor de nuvem

`providers/ollamaCloud.ts`: alvo (`https://ollama.com`, `authorization: Bearer`), a lista fixa de um, o normalizador que força `attention`/`sizeBytes`, o probe por `hasKey`, os dois no-ops, e o ramo no mapa de `register-all.ts`. `DN3C.4`–`DN3C.6`, `DN3C.8`.

Nível 3 contra `fetch` injetado: o catálogo faz **duas** requisições, o modelo fora da lista não é sondado, `attention`/`sizeBytes` saem forçados e `contextLength` sai herdado.

### Passo 4 — o renderer sonda sob chave, e o `ai:propose` declara seu limite

`useAiModels` ganha `enabled`, `useCloudCatalog` concatena o resultado sondado, e o gate entra em `propose.ts`. `DN3C.7`, `DN3C.9`.

### Passo 5 — verificação ao vivo (do dono) e fechamento

Roteiro abaixo. Depois: `HISTORY.md`, `DECISOES.md`, skill `ai`, `ARMADILHAS.md` se houver, `ROADMAP.md`, e o plano para `implemented/`.

---

## Verificação

### Automatizada — cada teste visto **vermelho** antes de verde

| Nível | O que prova | Sabotagem que tem de reprovar |
|---|---|---|
| 1 | `aiServiceSchema` aceita `'ollama-cloud'`; `isCloudService('ollama-cloud')` é verdadeiro | — (é o schema; o discriminante real é o de privacidade, abaixo) |
| 1 | o normalizador de nuvem força `attention: null` e `sizeBytes: 0` **mesmo** quando o payload os traz, e **herda** `contextLength` e `capabilities` | herdar `attention` → o teste do payload com atenção reprova |
| 3 | o catálogo de nuvem faz **duas** requisições (1 tag + 1 show) e não sonda o modelo fora da lista | filtrar depois do laço → a contagem de requisições reprova |
| 3 | o alvo de nuvem **não** descarta um tag terminado em `:cloud`; o alvo local **descarta** | ligar `dropCloudRouted` na nuvem → o tag some e reprova |
| 3 | `resolveProvider` devolve o adaptador certo para os quatro serviços, e **nenhum** cai no Ollama local por omissão | voltar ao `return ollamaAdapter` final e remover um ramo → o serviço órfão roteia para local |
| 3 | o probe de nuvem lança sem chave e resolve com chave, **sem tocar a rede** nos dois casos | trocar por um ping real → o teste sem `fetch` injetado reprova |
| 3 | `ai:propose` recusa serviço de nuvem **antes** de chamar `runProfile`, com `blocked` | remover o gate → `runProfile` é chamado e a asserção de não-chamada reprova |
| 3 | uma conversa com `'ollama-cloud'` grava linha no ledger de privacidade | — já garantido por `isCloudService`; o teste existe para **travar** a garantia contra um refactor futuro |
| 2 | sem chave: nenhuma linha de Ollama Cloud **e nenhuma chamada** a `ai:models('ollama-cloud')` | remover o `enabled` → a chamada acontece e a asserção de não-chamada reprova |
| 2 | com chave: a linha aparece com as capacidades sondadas | — |

⚠️ **Sabotagem estreita, uma por asserção.** ⚠️ **Vermelho tem uma forma só:** `Tests N failed` com o **nome** do teste na lista.

⚠️ **A suíte nunca toca `ollama.com`** — `fetch` é injetado e as respostas vêm de fixtures gravadas a partir do que a sondagem mediu. Sondar consome cota igual a usar.

### Ao vivo (`pnpm dev`) — e o roteiro diz regra, não número

⚠️ **Este corte exige uma chave nova.** A da sondagem foi **revogada** em 13/09/2026; é preciso criar outra em `ollama.com/settings/keys`. A verificação consome cota real (poucas requisições).

| # | O que fazer | O que reprova |
|---|---|---|
| 1 | abrir Configurações **antes** de gravar qualquer chave | não haver campo `Ollama Cloud` ao lado dos outros três |
| 2 | abrir o popover de modelo sem a chave gravada | aparecer qualquer linha de Ollama Cloud (`DN3C.7`) |
| 3 | gravar a chave e reabrir o popover | a linha `gemma4:31b` não aparecer, ou aparecer sem os chips `IM`/`TO`/`TH` que o `/api/show` reporta |
| 4 | olhar o teto na linha e no pill de contexto | `não cabe`, ou teto calculado contra a RAM da máquina — é nuvem, não custa RAM local |
| 5 | conversar: uma pergunta curta em português | não responder; ou responder sem raciocínio quando o interruptor está ligado |
| 6 | anexar uma imagem e perguntar sobre ela | o modelo não enxergar — `gemma4:31b` é o único dos seis com `vision` |
| 7 | Observatório → **Privacidade** | a conversa **não** aparecer como saída para nuvem (`DNC-18`) |
| 8 | Observatório → **Capacidades** | não haver cartão `Ollama Cloud` — é o `AI_SERVICES` que o typecheck não cobra |
| 9 | anexar um CSV e pedir uma proposta de passo com o modelo de nuvem escolhido | a mensagem culpar o modelo (*"não foi possível entender a proposta"*) em vez de declarar o limite |
| 10 | apagar a chave em Configurações e reabrir o popover | a linha continuar lá |

⚠️ **Esperado e não é defeito:** o painel **Desempenho** fica sem as durações nativas para este provedor — a nuvem manda só `total_duration`, e lê-lo é `DNC-20`, do `N-3-D`. Todos os campos são opcionais, então o painel degrada sozinho.

---

## Riscos nomeados

- **A lista fixa pode estar velha.** `gemma4:31b` é o nome medido em 13/09/2026, contra um serviço que muda mais rápido que o documento. Se ele sumiu ou foi renomeado, o item 3 do roteiro ao vivo é onde isso aparece — e o conserto é uma string, não o desenho.
- **`resolveProvider` exaustivo toca o roteamento dos três provedores existentes.** Vai sozinho no passo 1, antes de qualquer coisa de nuvem, exatamente por isso.
- **O gate de `ai:propose` muda o comportamento visível de Gemini e GLM**, que hoje degradam em silêncio. É melhoria — a mensagem passa a dizer a verdade —, mas não é invisível, e o item 9 existe para olhá-la.
- **A sonda sob chave quebra a convenção de "linha desabilitada com dica"** que `N-1-B` fixou. Deliberado (`DN3C.7`), e é o tipo de divergência que o próximo leitor tentaria "consertar" — por isso a razão vai no comentário do hook, não só aqui.
- **O parser é compartilhado com o provedor local.** Qualquer mudança futura nele passa a afetar dois serviços; é o preço explicitamente aceito em `DNC-10` contra o de dois donos divergindo em silêncio.
- **Nada aqui é verificável sem rede e sem cota.** O nível 3 prova a forma contra fixtures; que a Ollama responda o que a fixture diz, só o passo 5 prova.

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 14/09/2026 | Passo 5: verificação ao vivo pelo dono — **dez de dez** — e fechamento | Conversa real com `gemma4:31b`: imagem descrita, documento resumido com raciocínio, dados tabulares, medidor em ~3.261 tokens no fim. O painel de Privacidade listou as três chamadas como `ollama-cloud · gemma4:31b`, com **os três tipos de anexo**, sem uma linha nova de ledger (`DNC-18` confirmado, não suposto). O item 10 saiu como previsto: Desempenho sem durações nativas, que é `DNC-20`, do `N-3-D`. Fechamento: `HISTORY.md` com a 11ª entrada empurrando o `23-D` para o arquivo, dez linhas em `DECISOES.md` (591 → **601**), duas seções novas na skill `ai`, a contagem de `Record<CloudProvider>` **remedida** na skill `ipc` (a declarada dizia quatro; são **três** mapas escritos à mão, os demais derivam de `CLOUD_PROVIDERS`), e `ROADMAP` com `N-3-D` como próximo |
| 14/09/2026 | Passos 1–4 implementados; **a ordem do plano estava errada e foi invertida na execução** | ⚠️ **O passo 1 do plano era impossível como escrito.** Pôr `'ollama-cloud'` em `aiServiceSchema` antes de existir adaptador obriga o mapa exaustivo a apontá-lo para o adaptador **local** — exatamente a linha que `DN3C.2` existe para impedir. O serviço passou a nascer junto do adaptador, e o passo 1 ficou só com o resolvedor exaustivo, provado por provocação (`TS2741` nomeando a propriedade ausente; a garantia aqui é do **compilador**, não de um teste, porque `resolveProvider` vive no composition root). **Passo 2** foi refatoração pura, e o critério de sucesso se cumpriu: `ollama.test.ts` passou com `git diff` **vazio**. **Passo 3** trouxe quatro sabotagens e um susto de método: duas delas **não aplicaram** — os arquivos são CRLF, o regex usava `
` — e o verde parecia confirmá-las, que é a armadilha que a skill `testing` registra; toda sabotagem por shell passou a afirmar que o texto mudou **antes** de rodar. **Passo 4** custou um erro meu: usei `git checkout` para desfazer uma sabotagem num arquivo cuja mudança real ainda não estava commitada, e apaguei o trabalho do passo — por acaso produzindo a sabotagem seguinte. Três testes do Observatório contavam serviços (3 → 4, 6 → 8) e um teste do `propose` codificava o caminho agora recusado: **invertido**, não enfraquecido |
| 14/09/2026 | Plano escrito. Sete skills invocadas, os seis arquivos de `reference/ollama-cloud/` lidos, `DN3C.1`–`DN3C.10` fixadas | **O refinamento externo mudou duas coisas do recorte.** (a) Context7 na doc oficial: o sufixo `-cloud` é do **roteamento local** (`ollama run gpt-oss:120b-cloud`), e a REST responde pelo nome nu — logo o filtro do `N-3-A` **não** pode viajar com a parametrização, ou apaga em silêncio a segunda grafia que aquele corte descobriu. (b) Busca web confirmou `Authorization: Bearer` e a faixa gratuita sem gastar cota. **Um achado é do código:** `resolveProvider` tinha ramo padrão caindo no Ollama **local**, e um sexto lugar (`AI_SERVICES`) que o `typecheck` não cobra. Uma pergunta ao dono, com três desenhos: quando sondar o catálogo — escolhida a sonda **sob chave**, para não quebrar o invariante de nenhuma chamada a terceiro sem opt-in |
