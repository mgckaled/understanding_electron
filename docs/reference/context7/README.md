# Context7 — guia de implementação (arco 23)

> **As 32 decisões estão fechadas** (06–07/09/2026). Este é o material de entrada do arco 23: o que foi medido, o que foi decidido e com que base, e o desenho do painel. A **narrativa** congelou aqui: o dono do que se decide durante a execução é o plano de cada corte. O guia, porém, **continua vivo como referência e como errata** — ele é o que se lê ao começar o corte seguinte, então cada fechamento de corte devolve para cá o que a execução contrariou (§ *[O que a execução já contrariou](#o-que-a-execução-já-contrariou)*). Fora isso, consulta por `Grep`.
>
> Siglas `DM-n` são provisórias. A definitiva (`D23.n`) nasce com o plano.
>
> **Três anexos**, porque cada um é lido num momento diferente do arco: [`api.md`](api.md) (sondagens, formatos, medições — o 23-A vive nele), [`decisoes.md`](decisoes.md) (as 32, com a base de cada uma) e [`painel.md`](painel.md) (o desenho da interface — do 23-D em diante).

---

## Por que este documento existe em vez de `plan/active/23.md`

Porque o guia anterior — [`web-fetch-mcp-thinking/README.md`](../web-fetch-mcp-thinking/README.md) — foi escrito **antes** de olhar o código e o protocolo, e errou na premissa: propunha *tool calling* como espinha dorsal comum de três capacidades, premissa que RE6.4 derrubou com o resultado do arco 21. Ele também descreve um app com um provedor só, um orçamento de RAM chumbado em 7 GB e uma API (`ollama.chat`) que este projeto não usa.

O padrão que funcionou no arco 21 foi o oposto: levantar contra o código e contra a fonte primária, medir o que dá para medir, e listar explicitamente o que ficou por verificar. É o que este documento faz.

O guia antigo será marcado `⛔ consumido` quando este substituí-lo.

---

---

## DECIDIDO — DM-0: REST, não MCP

O Context7 entra pela **REST API pública**, não pelo protocolo MCP.

A consequência atravessa o arco inteiro: consultar documentação deixa de ser **capacidade do modelo** e passa a ser **operação do aplicativo**. Ninguém precisa de `tools`; nenhum provedor precisa saber que o Context7 existe; não há loop de *tool calling* a construir.

### O par de números que decidiu

| | Custo |
|---|---|
| Definir as duas ferramentas MCP | **2.060 tokens**, reenviados em toda requisição |
| Uma resposta inteira de `/v2/context` | **352 a 1.244 tokens** (n=6) |

A resposta completa custa entre um sexto e seis décimos do que o MCP cobra só para existir.

### O argumento estrutural

As ferramentas MCP aceitam **duas strings cada** (`resolve-library-id`: `libraryName`, `query` · `query-docs`: `libraryId`, `query`) e devolvem prosa num `content[]`. A REST aceita quatro parâmetros e devolve estrutura com o custo de cada trecho contado. **As ferramentas MCP são um envelope que esconde os parâmetros da REST.**

Pelo MCP se trunca; pela REST se seleciona — e selecionar é o princípio que o [`ESCOPO`](../../ESCOPO.md) já fixou como seção de produto: *o app nunca deixa o modelo decidir em silêncio o que descartar*.

### O que se perde, e por que é aceitável

O acionamento pelo modelo. Quem pede a documentação passa a ser o usuário.

RE6.4 já registra que nenhum caminho de acionamento é canônico, e o precedente que desautoriza presumir *tool calling* é o raciocínio visível — entregue, e por outro caminho em todos os provedores. Some-se que um modelo de 2B decidindo sozinho quando consultar documentação é a parte menos confiável do arranjo.

**O loop de *tool calling* não se constrói aqui.** Se for necessário depois — pilar de código, arco 22 por *tool calling* —, nasce lá, num plano que o justifique.

### Especulação sem compromisso — REST no local, MCP na nuvem (07/09/2026)

⚠️ **Levantada em conversa, sem sonda nenhuma, e nada foi firmado — DM-0 segue valendo inteiro.** A ideia é usar REST para Ollama e MCP para os provedores opt-in, apostando que os 2.060 tokens de definição são ruído numa janela de nuvem e caros num `num_ctx` reservado em RAM. O que a torna inviável hoje não é o custo: são **três** caminhos, não dois — Gemini teria MCP *server-side* (`{type: 'mcp_server', url}`, só na Interactions API, que o adaptador atual não usa), GLM não tem esse recurso e pagaria o custo inteiro que DM-0 rejeitou sem nenhum ganho, e Ollama seguiria REST. Pior, a entrega do arco não é a consulta, é o painel: ele vive de resposta estruturada (`codeSnippets[]` com contagem por trecho), e MCP devolve prosa — no Gemini *server-side* o app sequer vê a chamada acontecer, o que apaga as onze etapas da tabela de fluxo e a coluna de controle junto. O desejo legítimo por trás disso é **agência** (o modelo decidir consultar), e ela não exige MCP: uma ferramenta local única, `consultar_documentacao(biblioteca, pergunta)`, cujo corpo faz a mesma chamada REST, custa ~200 tokens de definição em vez de 2.060, devolve o mesmo objeto que o painel já saberá renderizar e serve qualquer provedor com `tools` — corte futuro sobre a REST, não alternativa a ela. Procedência: o MCP *server-side* do Gemini vem de pesquisa, nunca de sonda; é a primeira coisa a medir se isto voltar à mesa.

### Consequências a executar junto do plano

1. O pilar muda de nome no `ESCOPO`: "Documentação (MCP)" → "Documentação (Context7)".
2. Esta pasta muda de nome junto; os apontadores são tocados na mesma edição.
3. `DM-19` (a chave) é revista — ver [`api.md`](api.md) § *Medições*.
4. O `ESCOPO.md` registra que **consultar documentação envia a pergunta do usuário a um terceiro, inclusive em conversa local** (DM-22). É fato de fronteira do app, e o `ESCOPO` é o dono — uma linha, no mesmo peso normativo da diretriz de MCP já registrada lá.

---

---

## Estado atual do código (confirmado lendo, 06/09/2026)

| Peça | Como está | Onde isto encaixa |
|---|---|---|
| `PanelKind` (`features/panel/panelContext.ts`) | `'artifact' \| 'draft'` | ganha um terceiro inquilino; `raise`/`toggle`/`close`/`release`, `width` por inquilino e `onShortcut` já existem |
| `StepProposalLine.tsx` | linha-botão na transcrição que chama `toggle(target, event.currentTarget, messageId)` | molde exato da linha na conversa (DF3F.1/DF3F.2) |
| `DocumentPart` (`shared/ipc.ts`) | `{ kind, hash, fileName, format, text }` — texto **inline** | molde da forma do dado |
| `partForProvider` (`core/ai/messages.ts`) | `switch` por `kind`; `document → formatDocumentCard` | um `case` novo |
| `AttachmentPart` | `DatasetPart \| DocumentPart \| ImagePart` | o comentário convida um quarto membro — mas ver DM-23 |
| `checkExternalUrl` (`core/url.ts`, 33 linhas) | valida esquema para `shell.openExternal` | **não** está no caminho: host fixo, é `fetch`, e não é o SO resolvendo protocolo |
| `describeUpstreamError` (`core/ai/upstreamError.ts`) | trata `{error: string}` e `{error: {message}}` por classe de status | a forma do Context7 é `{ error, message }` — cai no fallback de classe hoje |
| `SidePanel` (`shared/ui/`) | primitivo desde o E-1-B: `<aside>`, fade, resizer, foco ao abrir, `Esc`; `header`/`children` por slot | **a casca do painel já existe** — o arco não desenha estrutura, só conteúdo |
| `Tabs` (`shared/ui/`) | primitivo com `keepMounted` opcional | se o painel tiver abas (trechos · metadados), está pronto |
| `ViewState` / `StateView` (`shared/ui/state.ts`) | seis estados, `loading` com barra determinada quando há `total` | o estado da consulta usa isto, não um booleano |
| `messages.ts` (`shared/ui/`) | `Record<ErrorKind, string>` — `typecheck` falha se faltar entrada | ver DM-12: `AppError` novo **obriga** texto em português |

O achado mais útil está no docstring de `DocumentPart`: o texto vai inline e é **reenviado inteiro todo turno**, por decisão consciente — *"the chat is stateless and resends the transcript every turn, so what must not repeat is the extraction, not the resend."* Na ordem de grandeza medida (centenas de tokens), esse precedente serve direto.

⚠️ **Nada disto é trabalho de design system.** O painel do Context7 **ainda não existe**, e pela régua do envelope (skill [`design-system`](../../../.claude/skills/design-system/SKILL.md)) o que não existe nasce no plano da própria feature, já vestido. As peças acima estão prontas para ser usadas, não para ser construídas.

---

---

## O fluxo, e onde está o controle

Onze etapas, do gatilho ao orçamento. A coluna que importa é a última.

| # | Etapa | Onde | Controle |
|---|---|---|---|
| 1 | gatilho | renderer | **total** — item da lista de anexos (DM-29) |
| 2 | `GET /v2/libs/search` | `core/context7/` | **parcial** — entrada sim, ranking não |
| 3 | desambiguação | a decidir | **total** — o critério é seu (DM-30) |
| 4 | fixar versão | idem | **parcial** — só entre as indexadas |
| 5 | `GET /v2/context` | `core/context7/` | **mínimo — quatro parâmetros** |
| 6 | tratar a resposta | `core/context7/` | **total** |
| 7 | montar a parte | `shared/ipc.ts` · `core/ai/messages.ts` | total |
| 8 | persistir | `crivo.db`, coluna `parts` | total |
| 9 | renderizar | `MessageList` · `DocsPanel.tsx` | total |
| 10 | enviar ao modelo | `partForProvider` | total |
| 11 | orçamento | `budgetFor` | total — sem caminho especial |

**A forma do controle é uma só: não se modula o que vem, modula-se o que se faz com o que veio.** O Context7 rerankeia e corta do lado dele — sempre 4–5 trechos — e não aceita instrução sobre isso. Não há `limit`, `tokens`, `topic` nem `page` na v2.

O único volante *antes* da resposta é a **pergunta**, e é isso que dá peso a DM-22: `query` é o que ordena o resultado. O que salva o arranjo é o corte deles ser generoso o bastante (≤1.244 tokens medidos); com 30k, a ausência de `limit` seria bloqueante.

Na etapa 5 o app não controla: quantos trechos · quais · em que ordem · o tamanho · se vem `infoSnippets` · se vem `rules` · o formato de `codeId`.

---

---

## A fronteira — o que já está resolvido, e a única pergunta que não está

Levantado lendo o código em 07/09/2026, no fechamento do 23-A. **Nada aqui é decisão** — decisão de contrato é do plano do 23-B. É o que se sabe antes de começá-lo.

### A chave custa uma palavra, e o motivo é uma separação já feita

`secrets:write`/`has`/`remove` são tipados por **`CloudProvider`**, não por `AiService`, e o docstring de `src/shared/ipc.ts` registra que a distinção é deliberada (DN1A.5): *"Distinct from AiService/aiServiceSchema above, which names who `ai:*` talks to today."*

| Enum | Nomeia | O Context7 entra? |
|---|---|---|
| `CLOUD_PROVIDERS` | quem **tem credencial** guardada | **sim** — uma palavra |
| `AiService` | com quem o `ai:*` **conversa** | **não**, nunca |

A consequência é o que se queria saber: entrar no primeiro **não** toca `isCloudService`, nem o livro-razão de privacidade do O-8, nem o catálogo de modelos. O Context7 será o primeiro portador de credencial que jamais será provedor de IA — o que valida a separação da trilha N em vez de atritar com ela.

A régua dos `secrets` já vigente vale sem exceção: `write` devolve `Result` (o backend fraco viaja como **sucesso**, não como erro), `has`/`remove` não devolvem, e **`secrets:read` não existe por desenho** (DN1A.3) — o renderer grava e pergunta se existe, nunca lê de volta.

### O que o cliente do 23-A já entrega pronto para a fronteira

`searchLibraries` e `fetchLibraryContext` são funções puras com dependências por parâmetro: o handler do 23-B injeta o `fetch` real, a chave e a URL, e não escreve classificação de erro nenhuma — o cliente lança `UpstreamError`, e `mapProviderError` (`main/features/ai/handlers.ts`) já o converte em `AppError.upstream`, com o `TypeError` do `fetch` caindo em `unavailable`. Estado de tela (`no-libraries`, `empty`, `indexing`, `library-not-found`) **volta como valor** e nunca vira `AppError`.

### ✅ A pergunta, respondida no 23-B: `invoke` simples

Nenhuma das 32 decisões tocou nisso. O 23-A recomendou, o **23-B decidiu e mediu** (D23B.1): busca 3.944 ms, `/vercel/next.js` com `fast=false` **2.222 ms** — 7% do teto de 30 s, então o gatilho de reversão abaixo **não disparou**. O material que sustentou a recomendação fica registrado.

- **A favor de job:** o `/context` com `fast=false` leva **segundos** (o reranqueamento por LLM é do lado deles), o painel fica bloqueado nesse intervalo, e o registro de `src/main/jobs.ts` mais o `signal` que o cliente já aceita (D23A.10) deixam tudo pronto dos dois lados.
- **Contra:** `job:event` existe para carregar **progresso**, e uma chamada REST não tem progresso — é uma requisição e uma resposta. Job aqui compra **só** cancelamento, ao custo de um `JobId`, um `AbortController` no `Map` e o `finish` no `finally`.

⚠️ **O que fecha a questão é que não existe meio-termo.** Abandonar a promessa no renderer **não cancela nada**: sem um id que enderece o `AbortController` no main, a requisição segue correndo e a cota **já foi gasta**. Ou é job de verdade, ou não há cancelamento — e aí o timeout de 30 s do cliente é a única saída, o que precisa ser dito na tela em vez de descoberto.

#### Recomendação do 23-A — `invoke` simples, com `Result`, sem job

O argumento que mais pesa não estava em nenhum dos dois lados acima: **cancelar não devolve cota.** A requisição já saiu e o Context7 contou no instante em que ela chegou lá, então o botão compra *parar de esperar*, nunca economizar uma das 200 chamadas do mês. O recurso escasso desta feature é a cota, e cancelamento não a protege.

Os três eixos habituais, e o que cada um decide de fato:

| Eixo | Veredito |
|---|---|
| **A máquina** | **neutro, e não se deve fabricar relevância.** O escasso aqui é RAM e CPU, e uma chamada REST não consome nem um nem outro — é o caso que D9.1 já julgou ("o main fica ocioso esperando a rede, e a janela continua desenhando"). Um job também não custa RAM: uma entrada num `Map` |
| **O escopo** | **empurra contra.** No momento da consulta **nada foi ao modelo ainda**; o controle que o crivo promete mora no 23-G (seleção e orçamento). Cancelar uma busca é conveniência de espera, não a premissa do app |
| **A arquitetura** | **exclui o caso.** `JobEvent` é `progress \| chunk \| log`: job existe para trabalho que **reporta progresso ou transmite em fluxo**. `ai:chat` é job porque streama; `disk:usage`, porque varre. Uma chamada REST é uma requisição e uma resposta — um job cujo único evento é "acabou" usa o mecanismo pelo efeito colateral |

**Três condições fazem parte da recomendação**, e sem elas ela não vale:

1. O teto de 30 s **aparece na tela**, nunca em silêncio — se o serviço travar, o painel diz o que vai acontecer.
2. **Nenhum botão "cancelar" falso.** Sem id que enderece o `AbortController`, ele pararia de ouvir e deixaria a requisição correndo: mentira cara, porque a cota some do mesmo jeito.
3. Promover a job depois é **barato de adiar** pelo teste da skill [`architecture`](../../../.claude/skills/architecture/SKILL.md) — *quantos arquivos toco se adiar?* O cliente já aceita `signal` (D23A.10), então é o handler, o `JobId` e o painel: ~6 arquivos, nenhum dado persistido, nenhum contrato que outro corte já consuma.

⚠️ **O gatilho que reverte isto, e ele é medido, não impressão.** O 23-A sondou cinco bibliotecas e **não cronometrou chamada por chamada** — sabe que nenhuma chegou perto do teto, não sabe a distribuição. Se no 23-F ou no 23-J uma biblioteca grande com `fast=false` levar dezenas de segundos, o job deixa de ser conveniência e vira necessidade. **Cronometrar a primeira chamada real de biblioteca grande é o que fecha esta questão de vez.**

---

## Os cortes

Arquivos separados, estilo 18-A — nunca passos dentro de um arquivo só, e **nunca subcorte**.

> ⚠️ **Não existe `23-A-1`.** O arco 21 produziu essa forma e ela não se pagou: um filho carrega o contexto do pai junto, o que anula o ganho de fatiar. **Corte que crescer demais vira dois irmãos** — se o 23-D não couber, ele passa a ser 23-D e 23-K, ambos no mesmo nível, cada um com o próprio arquivo e o próprio diário. A letra é etiqueta, não hierarquia.

**A ordem das letras é sugestão; a dependência é lei.** Divergência entre plano e execução é esperada — o encaixe reordena sem renomear nada.

| Corte | Entrega | Depende de |
|---|---|---|
| ~~**23-A**~~ | ✅ **entregue (07/09/2026)** — o cliente, em `core/context7/`. Tipos, `fetch` injetado, parse das duas respostas, classificação de status (400 · 404 · 202 · 429 · 401/403 · 5xx), descarte de `rules`, `codeId` → URL com falha tratada, filtro de `__branch__*`, ordenação estável. Fixtures gravadas da API real. Sonda de 12 chamadas, seis fixtures verbatim, 35 testes, cobertura de linha 98,6%. Plano: [`plan/implemented/23-A`](../../plan/implemented/23-A-cliente-context7.md) | — |
| ~~**23-B**~~ | ✅ **entregue (07/09/2026)** — a fronteira. Handlers em `main/features/context7/`, os canais em `src/shared/ipc.ts`, a chave no cofre e o campo em Configurações ao lado de Gemini e GLM. Nível 3, nada na conversa. Decidiu a pergunta aberta: **`invoke` simples**, com o gatilho de reversão medido e não disparado. Plano: [`plan/implemented/23-B`](../../plan/implemented/23-B-a-fronteira.md) | A |
| ~~**23-C**~~ | ✅ **entregue (08/09/2026)** — a parte e a persistência. `DocsPart` como sétima variante, `docsPartOf`, o `case` em `partForProvider`, e o desligar por `conversation:setDocsEnabled` com `json_set`. Nível 1 e 3, sem interface. Plano: [`plan/implemented/23-C`](../../plan/implemented/23-C-a-parte-e-a-persistencia.md) | A |
| **23-D** | **o painel nasce.** Terceiro valor de `PanelKind`, `DocsPanel.tsx` sobre `SidePanel`, cabeçalho, o gatilho no `AttachButton`, o formulário do Estado 1 com o aviso de privacidade. Primeira coisa visível | B |
| **23-E** | **desambiguação.** Estado 2: lista sempre visível, ordenada pelo app, versões filtradas, seletor de versão | D |
| **23-F** | **o resultado.** Estado 3 e as três abas — Trechos, Notas, Regras (esta só quando `rules` vier) | D |
| **23-G** | **seleção e orçamento.** Caixas por trecho, total ao vivo no rodapé, `Anexar` desabilitado quando não cabe | F · C |
| **23-H** | **a conversa.** A linha retrátil, o contador no cabeçalho, o `histórico` com o desligar, o rótulo `fora do contexto` | C · F |
| **23-I** | **os nove erros.** Cada situação com o seu texto e a sua ação, incluindo os dois textos opostos do 429 | D (encaixa em qualquer ponto depois) |
| **23-K** | **o livro-razão e as minúcias.** O Observatório não conta a consulta reenviada ao modelo e **não vê a pergunta enviada ao Context7**, que sai da máquina mesmo em conversa 100% local (DM-22) — são a mesma pergunta, e meia resposta não serve. Recolhe também o que se acumulou nos dez cortes. ⚠️ Roda **antes** do J, apesar da letra | C · H |
| **23-J** | **fechamento.** Verificação ao vivo, `ESCOPO.md` (nome do pilar, a linha de privacidade), guia antigo marcado `⛔ consumido`, pasta e apontadores | todos |

**O caminho crítico é `A → B → D`.** Depois dele, `E`, `F` e `I` são independentes entre si; `C` pode entrar em qualquer momento depois de `A`, inclusive em paralelo a `D`. Só `G`, `H`, `K` e `J` têm duas dependências.

⚠️ **A letra `K` estava reservada acima para um eventual irmão do 23-D.** Ela foi usada pelo corte novo em 08/09/2026; se aquela divisão acontecer, o irmão vira `23-L`. A letra é etiqueta, não hierarquia — e `K` executa **antes** de `J`, porque o J é o fechamento que depende de todos e um apanhado de pendências depois dele reabriria o que ele fechou.

### As verificações abertas são passos, não pendências

Cada uma tem dono. **Cinco foram fechadas na sonda do 23-A** (07/09/2026, 12 chamadas) — o detalhe de cada veredito está em [`api.md`](api.md) § *A sonda do 23-A*.

| Verificação | Corte | Estado |
|---|---|---|
| `/v2/context` consome o mesmo contador de cota? | 23-A | ✅ **sim**, contador único para as duas rotas |
| `fast=true` muda quantidade ou só ordem | 23-A | ✅ **muda o tamanho**: 25 trechos contra 3, na mesma pergunta |
| a duplicata de `id` acontece no `/v2/context`? | 23-A | ✅ **sim**, e por outro motivo — `codeId` endereça a página, não o trecho |
| frequência de `rules`, e em quais bibliotecas | 23-A · 23-F | ✅ **ausente em 11 de 11** — sem fixture real, o caminho é exercitado à mão |
| `libraryName` vs `query` no `/v2/libs/search` | 23-A | ✅ os dois respondem; duas chamadas **não** distinguem parâmetro de instabilidade. Fica `query` |
| `202` na prática, e o enum de `state` | **23-I** | ⏳ aberta — 6 buscas deram `finalized` em 100% dos ~28 resultados; caçar custaria cota sem garantia, e a classificação do cliente não depende de ver ao vivo |
| silhueta dos três ícones do cabeçalho a 16px | 23-J | ⏳ aberta |
| o painel inteiro, ao vivo | 23-J | ⏳ aberta |

⚠️ **A cota é uma só, e sondar gasta o que usar gastaria.** 200 chamadas/mês no anônimo; as sondas de 06–07/09 levaram `Ratelimit-Remaining` de 200 a **146** em dois dias — 27% do mês. A suíte de testes **nunca** bate na API: as fixtures de `src/core/context7/__fixtures__/` foram gravadas uma vez, e os testes rodam contra elas.

### O que a execução já contrariou

Uma linha por premissa que caiu, com o ponteiro para onde o fato corrigido mora — nunca a conclusão repetida aqui, que envelheceria calada. **Cada fechamento de corte acrescenta as suas.**

| Premissa original | Caiu em | O que vale agora |
|---|---|---|
| "sempre 4 ou 5 trechos, qualquer que seja a amplitude" | 23-A | era fato de `fast=false`, não da API: `fast=true` devolveu 25 trechos e 3.497 tokens — [`api.md § A sonda do 23-A`](api.md) |
| "`codeId` é o portador da procedência do trecho" | 23-A | endereça a **página**: cinco trechos do zod compartilham um só, então é link e nunca identidade — [`api.md`](api.md) |
| "`infoSnippets` não tem procedência nenhuma" | 23-A | `pageId` é URL completa; a aba Notas pode linkar. O assimétrico é outro: ela vem **vazia** na maioria — [`painel.md`](painel.md) |
| "sem correspondência é `404`" | 23-A | também pode ser `200` com cinco resultados irrelevantes, sem campo nenhum sinalizando — [`api.md`](api.md) |
| "`codeList[]` são as partes de um trecho" | 23-B | são **variantes** do mesmo exemplo (TS e JS), às vezes idênticas: juntá-las duplica o código na tela, e não há parâmetro de idioma na requisição — [`api.md`](api.md) |
| tabela dos nove erros (DM-12) | 23-A | são **dez**: `library-not-found` no `/context` não estava prevista, porque ninguém imaginou a biblioteca sumir entre as duas chamadas |
| "a parte persiste o que foi anexado, não a resposta bruta" × "trecho não enviado aparece riscado" | 23-C | as duas afirmações deste guia se contradiziam. A parte guarda o enviado inteiro e o recusado **só como título e custo** — [`painel.md`](painel.md) § *A linha na conversa* já dizia que a linha lista títulos e custo, nunca o código, e é isso que torna o congelamento estrutural (D23C.3) |
| `rules` só existe enquanto a aba está aberta | 23-C | **persiste na parte** e nunca se materializa: sem isso o registro do que o serviço tentou injetar sumiria no próximo início do app, esvaziando DM-17 (D23C.4) |
| "um booleano na parte persistida, um filtro e o interruptor" (DM-31) | 23-C | falta uma quarta peça que o guia não previa — **não havia como alterar uma parte já gravada**. `conversation:*` só tinha `append` e `removeMessage`, então o desligar exigiu canal novo (D23C.6) |


## Como isto se testa

Pirâmide e limites: skill [`testing`](../../../.claude/skills/testing/SKILL.md).

| Peça | Nível | Forma |
|---|---|---|
| cliente REST, seleção de trechos, parse de `codeId` | 1 | `fetch` injetado, fixtures de JSON — sem rede real |
| handlers dos canais | 3 | funções exportadas, dependências por parâmetro, sem Electron |
| linha na conversa, painel | 2 | jsdom; a classe é atribuída, a cor e o layout não |

⚠️ **A fixture vem da resposta real, nunca do `openapi.json`.** O schema publicado está atrás da API — `generationDate` voltou na sonda sem estar nele. Uma fixture derivada do schema testaria o schema, não a API.

⚠️ **Antes de mandar qualquer asserção do painel para nível 4, verifique se ela cabe sobre a classe.** O veredito "isso só se prova ao vivo" já saiu errado por metade uma vez neste projeto.

---

---

## Onde está o resto

| Anexo | O que tem | Quando se lê |
|---|---|---|
| [`api.md`](api.md) | endpoints, formatos, as 13 sondas, medições, verificações feitas e abertas | corte **23-A** |
| [`decisoes.md`](decisoes.md) | as 32 decisões, com a base declarada de cada uma | ao duvidar de um "por quê" — `Grep` na sigla |
| [`painel.md`](painel.md) | o desenho da interface, estado por estado, em plaintext | cortes **23-D** em diante |
