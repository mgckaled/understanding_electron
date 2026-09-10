# Context7 — as 32 decisões

> Anexo de [`README.md`](README.md). Todas fechadas em 06–07/09/2026. Cada uma declara **em que se apoia**, porque a força varia. Consulta por `Grep` na sigla `DM-<n>`.

---

## Decisões — recomendação e base

**As 32 estão fechadas** — DM-0 e DM-27 na investigação de 06/09/2026, as 18 restantes na passagem decisão a decisão de 07/09/2026, e o resto dissolvido ou encerrado por DM-0 no caminho. Cada uma declara **em que se apoia**, porque a força varia:

| Rótulo | Significa |
|---|---|
| *(medida)* | sonda própria contra a API ou contra a máquina, nesta investigação |
| *(precedente)* | o código já resolve um caso igual, e a recomendação é copiá-lo |
| *(juízo)* | escolha de produto — nenhuma sondagem a resolve |

### Seleção e orçamento

As duas primeiras foram **recomendadas como dissolvidas** pela medição de 4–5 trechos e depois **revogadas** na passagem de 07/09/2026; as duas últimas continuam dissolvidas, e por precedente, não por tamanho.

- **DM-16 · DECIDIDA (07/09/2026) — seleção completa, caixa por trecho.** Revoga a recomendação anterior *(medida)* de não construir seleção. **O argumento vencedor não é de tamanho, é de premissa:** o crivo existe para gerenciar e controlar o que vai ao modelo, e a medição de 4–5 trechos descreve as bibliotecas sondadas hoje, não um limite da API — nada no `openapi.json` promete que a resposta seja pequena. Continua valendo o achado sobre `codeLanguage` não ser normalizado (`TypeScript`, `typescript`, `tsx` na mesma resposta): **filtrar por linguagem segue fora**, a seleção é trecho a trecho.
- **DM-25 · DECIDIDA (07/09/2026) — painel interativo, não só de leitura.** Consequência de DM-16: havendo seleção, há o que interagir. **O corte 23-C renasce.**
- **DM-4 · Faixa mínima → não existe** *(precedente)*. `conversationWindow` decide o tamanho da janela; uma consulta não mexe em `numCtx`, só aumenta `estimated`, que é assunto do `budgetFor`. Nada a impor.
- **DM-11 · Conversa travada → nenhum caminho especial** *(precedente)*. A trava só morde com `costed && locked && reserved !== undefined`, e decide janela, não conteúdo. É o mesmo trajeto de um documento anexado grande.

### Forma do dado

- **DM-23 · DECIDIDA (07/09/2026) — tipo próprio, renderizado como divulgação retrátil.** Desenho em [`painel.md`](painel.md) § *A linha na conversa*. `MessageList` não faz `switch` por `kind`: despacha por helpers `*PartOf(message)` — `attachmentPartOf`, `reasoningPartOf`, `stepProposalPartOf` —, cada um com seu componente. A variante custa três coisas conhecidas: schema em `shared/ipc.ts`, `docsPartOf` em `core/ai/messages.ts`, componente próprio. Entrar em `AttachmentPart` significaria renderizar como cartão de anexo, que é o que isto não é.
- **DM-6 · DECIDIDA (07/09/2026) — reenvio inteiro, todo turno, molde `DocumentPart`.** A coluna `parts` é `TEXT` com JSON, e o docstring de `DocumentPart` registra a decisão consciente de reenviar a extração todo turno. Resumir documentação técnica estraga exatamente o que ela tem de útil, e "só na primeira vez" não existe: o modelo não guarda nada entre turnos. É o que torna o desligar de DM-31 necessário.
- **DM-14 · DECIDIDA (07/09/2026) — inline em `parts`, sem `userData`.** `DatasetPart` e `ImagePart` usam `userData/attachments/<hash>` porque carregam bytes; aqui é texto de 3–5 KB.

#### A conta de escala do `crivo.db`, conferida na fonte (não por teste)

A dúvida legítima: milhares de conversas, cada uma com várias dessas partes, incham o banco? Os limites publicados em [sqlite.org/limits.html](https://www.sqlite.org/limits.html) respondem com folga de várias ordens de grandeza:

| Limite | Valor documentado | O caso do crivo |
|---|---|---|
| Tamanho de um `TEXT` | 1.000.000.000 bytes por padrão | uma consulta ocupa ~3–5 KB — **cinco ordens de grandeza abaixo** |
| Tamanho do banco | ~17,5 TB com página de 4096 bytes | 10.000 consultas a 5 KB somam **~50 MB** |
| Linhas por tabela | 2⁶⁴ teórico, na prática limitado pelo tamanho do banco | irrelevante nesta escala |

**Onde estaria o risco real, e por que não está aqui:** SQLite guarda um valor grande *inline* na linha até a página encher e depois usa páginas de estouro, então um `SELECT` que traga a coluna `parts` paga a leitura dessas páginas. Isso morderia se a tela lesse **todas** as conversas de uma vez — mas a leitura é sempre de **uma** conversa por vez, e é o mesmo caminho que documento e raciocínio já percorrem hoje sem sintoma.

⚠️ **O que vale vigiar não é o tamanho, é o espaço não devolvido.** Apagar conversas libera páginas para reúso mas **não encolhe o arquivo** sem `VACUUM`. Não é problema desta escala e não entra no arco 23 — fica anotado para o dia em que a retenção automática de conversas apagar volume de verdade.


### Conteúdo e privacidade

- **DM-17 · DECIDIDA (07/09/2026) — `rules` nunca vai ao modelo, mas é exibido.** Ausente em 6 de 6 sondas, e o schema o prevê: se chegar, é instrução de terceiro endereçada ao modelo — a definição de superfície de injeção. Descartar do que é enviado, com três linhas citando esta decisão, **e mostrar na aba Regras do painel**: o usuário vê o que o serviço tentou injetar, o modelo não recebe. É o único lugar do app onde exibir e enviar deliberadamente divergem — sem essa aba, descartar em silêncio esconderia a tentativa.
- **DM-22 · DECIDIDA (07/09/2026) — a pergunta vai como escrita, com aviso fixo no painel.** É o `query` que faz o reranking; extrair termos degradaria justamente o que o serviço faz bem — mas isso **aumenta** o que sai da máquina. O caso que define o risco: conversa 100% local, com Ollama, e a pergunta *"como faço paginação no TanStack Query para a tabela de faturamento do cliente Acme"* viaja inteira para um terceiro. Daí o aviso ser **permanente sob o campo**, e não um consentimento de primeira vez: aviso que se aceita uma vez não está na tela no turno em que o vazamento acontece. Some-se o registro no `ESCOPO.md`, dono do que sai da máquina.

### Rede, erro e segredo

- **DM-26 · DECIDIDA (07/09/2026) — `fetch` cru, não o SDK** *(precedente)*. Mantém o cliente em nível 1 e dentro da meta de 85% de `core/`, como `core/ai/` roda sem Ollama instalado; o SDK o empurraria para `main/`, sem meta, e para o risco de ESM no bundle (DE1D.9).
- **DM-20 · DECIDIDA (07/09/2026) — constante no adaptador, não em `core/`** *(precedente)*. O padrão real é `GLM_ENDPOINT`, `OLLAMA_HOST` e `GEMINI_INTERACTIONS_URL` como constantes *module-level* nos adaptadores de `main/features/ai/providers/`.
- **DM-12 · DECIDIDA (07/09/2026) — `AppError` só para falha de rede, e cada situação tem texto próprio** *(medida + precedente)*. `upstream` e `unavailable` já existem e bastam; `404`/`400` são **estado de tela** via `ViewState`, como o `status: 'empty'` que aparece em dez lugares hoje. Nenhum `kind` novo, nenhuma entrada em `messages.ts`. A tabela das nove situações está abaixo.

#### As nove situações, cada uma com texto e conserto próprios

**Princípio:** a mensagem nomeia a causa **e** o conserto. Um texto genérico repetido em nove situações obriga o usuário a adivinhar qual delas ocorreu — e em cinco delas o conserto é diferente.

Nenhuma dessas frases entra em `shared/ui/messages.ts`, que é dono da tradução de `AppError['kind']`. Elas são **estado de tela do painel**, no mesmo lugar onde `ArtifactDataset` guarda o seu *"Arquivo sem linhas de dado."*

| # | Situação | Como chega | Texto ao usuário | Ação oferecida |
|---|---|---|---|---|
| 1 | campo vazio | `400 validation_error` | — nenhum: `Consultar` fica desabilitado, a chamada nunca sai | — |
| 2 | nome sem correspondência | `404 no_libraries_found` | *"Nenhuma biblioteca com esse nome. Tente outro termo — o Context7 indexa pelo nome do repositório ou do site."* | volta ao campo, texto preservado |
| 3 | biblioteca achada, pergunta sem resposta | `200` com `codeSnippets: []` | *"A biblioteca existe, mas nada respondeu a essa pergunta. Tente reformular."* | `Consultar de novo` |
| 4 | biblioteca em indexação | `202` + `state` ≠ `finalized` | *"Esta biblioteca ainda está sendo indexada pelo Context7. Tente daqui a alguns minutos."* | `Tentar de novo` · escolher outro candidato |
| 5 | cota do mês estourada, **sem** chave | `429` | *"As 200 consultas mensais gratuitas acabaram. A cota volta em 1º de outubro. Uma chave do Context7 aumenta para 1.000."* | abre Configurações |
| 6 | cota do mês estourada, **com** chave | `429` | *"As 1.000 consultas mensais da sua chave acabaram. A cota volta em 1º de outubro."* | — |
| 7 | chave recusada | `401` / `403` | *"A chave do Context7 foi recusada. Confira em Configurações."* | abre Configurações |
| 8 | serviço com problema | `5xx` | *"O Context7 está indisponível no momento. Isso é do lado deles."* | `Tentar de novo` |
| 9 | sem alcançar o serviço | `fetch` rejeita (`TypeError`), DNS, offline | *"Não foi possível alcançar o Context7. Verifique sua conexão."* | `Tentar de novo` |

Três detalhes que a sondagem tornou possíveis, e que seriam invenção sem ela:

- **A data no 429 é real, não estimativa.** `Ratelimit-Reset` veio como epoch apontando para `2026-10-01T00:00:00Z` — a virada do mês. Formatar essa data é melhor que qualquer texto genérico sobre "limite atingido", porque responde *quando volta*.
- **5 e 6 são a mesma resposta HTTP com consertos opostos.** Sem chave, há o que fazer; com chave, só esperar. Distinguir custa um booleano (`hasSecret`, que já existe e não descriptografa nada).
- **1 nunca chega à rede.** O `400` é o que a API responde a `query` vazia — mas gastar uma das 200 chamadas mensais para descobrir que o campo estava em branco é desperdício puro. O botão desabilitado é o conserto.

⚠️ **O 404 é o que mais engana, e é por ele que esta decisão existe.** Entregue a `describeUpstreamError`, ele vira *"Erro do serviço: 404"* — um erro de digitação apresentado como falha de sistema. O cliente separa **antes** de qualquer tradução: `400` e `404` nunca viram `AppError`.

**Nenhum `kind` novo de `AppError` nasce daqui.** `upstream` cobre 5 a 8, `unavailable` cobre 9, e 2 a 4 são `ViewState`. O que muda é só quem escolhe o texto.

- **DM-19 · DECIDIDA (07/09/2026) — chave opcional, no cofre que já existe** *(medida)*. **A janela anônima é mensal, não horária:** `Ratelimit-Reset` apontou para `2026-10-01T00:00:00Z` — o primeiro do mês seguinte —, então os 200 anônimos e os 1.000 da chave estão na mesma unidade e a chave vale **5×** literalmente. Exigir chave foi descartado (transformaria em cadastro algo que funciona de graça); não oferecer também (estourar o anônimo seria um modo de falha sem conserto possível pelo usuário). O caminho do segredo já existe inteiro — `safeStorage`, `userData`, escrita de mão única, `hasSecret` —, então o custo é um campo em Configurações ao lado de Gemini e GLM.

  ⚠️ **Sondar consome a mesma cota que usar.** As 13 chamadas de investigação mais as repetições de controle levaram `Ratelimit-Remaining` de 200 a **157 num único dia** — 21,5% do mês. Ao construir 23-A, gravar fixtures da primeira resposta real e rodar os testes contra elas; suite que bate na API de verdade queima a cota do mês em poucas corridas.
- **DM-18 · DECIDIDA (07/09/2026) — `fast=false`** *(juízo)*. O gargalo do projeto é janela de contexto, não latência; ordenação melhor por alguns segundos é a troca certa.
- **DM-24 · DECIDIDA (07/09/2026) — registrar a exceção no código** *(precedente)*. Duas linhas no cliente: host fixo, é `fetch`, `checkExternalUrl` existe para `shell.openExternal`. Impede que o próximo leitor procure um bypass inexistente.

### Interface

- **DM-29 · DECIDIDA (07/09/2026) — o gatilho sai de Ferramentas e vira item da lista de anexos.** A linha `mcp` com `<Switch>` desabilitado deixa de existir: capacidade é o que o *modelo* tem, e consultar documentação é ação do usuário que produz um anexo. Desenho em [`painel.md`](painel.md) § *O gatilho*.
- **DM-30 · DECIDIDA (07/09/2026) — lista sempre visível, ordenada pelo app, sem "mais recente"** *(medida, 13 chamadas)*. Antes era *(juízo)*. A ordem exibida é a do app — `benchmarkScore` decrescente, desempate por `id` — porque a da API varia entre chamadas idênticas. Desenho em [`painel.md`](painel.md).
- **DM-31 · DECIDIDA (07/09/2026) — acumula, com desligar por consulta.** Substituir a anterior foi descartado. Antes era *(medida)*. Duas perguntas sobre a mesma biblioteca geram duas partes, ambas reenviadas todo turno — o custo fixo dobra, e o desligar é o freio. Desenho em [`painel.md`](painel.md).

- **DM-21 · DECIDIDA (07/09/2026) — `DocsPanel.tsx`, terceiro inquilino, ao lado de `ArtifactPanel` e `DraftPanel`** *(precedente)*. Os dois são hoje os únicos consumidores de `SidePanel`. Mostra biblioteca, versão, a pergunta e os trechos com `codeTokens`, com link quando `codeId` parseia como URL. Sem seção de "descartado" — nada é descartado.
- **DM-28 · DECIDIDA (07/09/2026) — metadados em chrome, conteúdo em leitura** *(precedente)*. Não é régua a aplicar, é o vizinho a copiar: `ArtifactBody.tsx` usa `text-reading` no corpo enquanto `ArtifactSteps`/`ArtifactDataset`/`ArtifactPicker` usam `text-xs`/`text-sm`/`text-2xs` — o painel de artefato já é misto. **O critério não é importância, é quanto tempo o olho fica ali:** a lista de títulos se escaneia, o bloco de código se lê.

  | Elemento do painel | Densidade |
  |---|---|
  | nome da biblioteca, notas, contagens, abas, rodapé, título de cada trecho | chrome |
  | **o código dos trechos** | leitura, monoespaçada |
  | texto corrido das Notas e das Regras | leitura |
- **DM-32 · DECIDIDA — ícone de livros empilhados, nunca o logotipo da Upstash** (07/09/2026). Motivo jurídico e de design system em [`painel.md`](painel.md).
- **DM-15 · DECIDIDA (07/09/2026) — não é interruptor, é uma ação** *(precedente)*. `wantsReasoning` é `useState` no `Composer` passado no `onSend` porque é **modo** do envio. Consultar documentação é ato pontual cujo resultado persiste na transcrição.

### Encerradas por DM-0

`DM-1` (caminho do Gemini) · `DM-2` (MCP server-side) · `DM-3` (loop nos três provedores) · `DM-5` (encurtar descrições) · `DM-7` (chamadas paralelas) · `DM-8` (teto de voltas) · `DM-9` (cancelamento no loop) · `DM-10` (timeout do loop) · `DM-13` (capacidade nova no catálogo de nuvem).

⚠️ `DM-1` sai **deste arco**, não do projeto: a Interactions API do Gemini continua pendente por causa do raciocínio (D21A.10), e ela aceita `{ type: 'mcp_server', name, url }` server-side — o Google conectando ao servidor a partir da infraestrutura dele. Se for adotada algum dia, reabre a questão de privacidade que DM-2 fechou aqui.

---

## O que a execução fez com estas 32

**Toda decisão aqui foi fechada antes de existir código.** Esta seção é o antídoto para a surpresa que isso produz: quem consulta uma sigla precisa saber, na mesma leitura, se ela ainda vale inteira. Uma linha por decisão que **mudou de forma ou envelheceu**, com o corte que a tocou e o motivo — nunca a conclusão nova repetida aqui, que envelheceria calada em segundo lugar.

⚠️ **Alimentada por todo fechamento de corte, a partir do 23-E.** Premissa que caiu é assunto do [`README.md`](README.md) § *O que a execução já contrariou*; o que muda aqui é o estado de uma **decisão**.

| Sigla | Corte | O que aconteceu com ela |
|---|---|---|
| **DM-16 · DM-25** | 23-D · 23-E | **Adiadas na prática, não revogadas.** A seleção trecho a trecho e o painel interativo seguem decididos, e o 23-G continua sendo o dono — mas os cortes visíveis chegaram até o resultado sem nenhuma caixa de marcação, e o rodapé ainda diz `nada consultado`. Nada aqui foi contrariado; o que envelheceu é a impressão de que estariam de pé desde o primeiro pixel |
| **DM-17** | 23-F | **Cumprida, e a premissa dela vale para uma das três listas.** A aba Regras existe, exibe e nada é enviado. Mas a decisão trata as três como *"instrução de terceiro endereçada ao modelo"*, e a doc oficial diz outra coisa: só `libraryOwn` vem do `context7.json` do **repositório**; `global` e `libraryTeam` são criadas no painel do Context7 e chegam pela chave de **quem consulta**. A aba nomeia a procedência de cada grupo (D23F.8), porque chamar de alheia uma instrução que o próprio dono da chave escreveu seria falso. **E isto explica os 11/11 ausentes:** nenhuma sonda mandou chave, então as duas de *teamspace* não podiam aparecer, e `libraryOwn` só existe se o repositório publicar regra. ⚠️ Consequência que sobra para o 23-I: quando a chave passar a ser exigida, as regras do próprio usuário começam a voltar — a aba deixa de ser caminho raro |
| **DM-28** | 23-F | **Cumprida, e a tabela dela tem um elemento a mais que ninguém previu.** As três linhas (metadado em chrome, código e prosa em leitura) foram aplicadas, mas a **descrição do trecho** não está em nenhuma delas — e ela é markdown, não texto: a API escreve código inline com acento grave. Descrição e nota passam pelo `MarkdownMessage`, que já é o dono do assunto e trata texto de fora como não confiável (D11.2); as regras seguem em texto puro, de propósito, porque são o registro do que o serviço tentou injetar |
| **DM-16 · DM-25** | 23-G | ✅ **Cumpridas — saem de "adiadas" depois de três cortes nelas.** Caixa por trecho **e por nota** (o `kind` de `docsOmittedSchema` já previa as duas desde o 23-C), rodapé com a soma da seleção e `Anexar`. O painel deixou de ser de leitura no mesmo passo. Uma coisa que nenhuma das duas previa: a seleção guarda o que ficou **de fora**, não o que ficou dentro (D23G.3) — o conjunto vazio significa "tudo vai", que é o caso comum, e o inverso exigiria semear todas as chaves a cada resposta nova |
| **DM-28** | 23-G | **A tabela dela ganhou um segundo elemento que ninguém previu, e é irmão do primeiro.** O 23-F já tinha achado que a **descrição** não estava em nenhuma das três linhas; o 23-G achou que o **título do trecho** também é markdown — `codeTitle` vem com código inline em acento grave. Não está consertado: o conserto certo é uma variante inline do `MarkdownMessage` (dono do assunto, `span` em vez de `p`, herdando o tamanho de quem chama), e isso é trabalho de design system, que pela régua do envelope não nasce dentro de um corte de feature. Pendência do 23-K |
| **DM-16 · DM-25** | 23-F | **Ainda adiadas, e agora é a última parada antes delas.** O 23-F entregou o resultado inteiro sem uma caixa de marcação, e o rodapé passou de `nada consultado` para o custo exato — mas segue sem `Anexar`. O 23-G é o corte que finalmente as encosta na tela |
| **DM-19** | 23-E | **A metade "opcional" caiu; a do cofre fica.** Decidido em 08/09/2026 que o crivo **exigirá** chave para consultar — a cota anônima deixa de ser caminho. O argumento que a decisão original não pesou não é de tamanho de cota, é de **modo de falha**: sem chave, o custo corre calado e a pessoa descobre no erro, que é o mesmo silêncio que DM-22 combate na porta ao lado. Implementação a partir do **23-I**, com a sondagem de viabilidade e o atrito com D23D.3 registrados em [`ROADMAP § 3`](../../ROADMAP.md) |
| **DM-30** | 23-E | **Reforçada pelo pior caso, e ele é real.** *"o usuário digita e o usuário desambigua"* deixou de ser preferência de produto e virou necessidade medida: na primeira consulta real fora da sonda (`pandas`), a ordenação do app pôs `/rsheftel/pandas_market_calendars` na frente e o `/pandas-dev/pandas` em **terceiro**. Nenhum campo da resposta escolhe certo sozinho — `benchmarkScore` não, `totalSnippets` não, `stars` não —, que é exatamente o motivo de a decisão existir |
| **DM-32** | 23-D · 23-E | **Cumprida e sem pendência de licença.** O ícone `Library` serve o popover, o cabeçalho do painel e o painel inteiro; a palavra "Context7" é o crédito, em texto. A silhueta a 16px contra `NotebookPen`/`Paperclip` continua sendo verificação do 23-J, e só é possível lá, quando o contador do 23-H existir |
| **DM-18** | 23-E | **Confirmada com pergunta real, não com sonda.** `fast=false` custou **2 a 3 s** numa consulta de verdade (`pandas`, versão fixada), contra os 2,2 s que o 23-B mediu sem pergunta formulada. O gatilho que promoveria o `invoke` a job segue sem disparar |
| **DM-29** | 23-D | **Cumprida com um conserto que a decisão não previa.** O gatilho virou item de anexos, mas o popover trocava a lista inteira pelo detalhe do anexo — o item nasceria inalcançável. Detalhe em D23D.3 |
| **DM-31** | 23-C | **Cumprida com uma quarta peça a mais.** As três que a decisão previa (booleano, filtro, interruptor) não bastavam: não havia como alterar uma parte já gravada, e o desligar exigiu canal novo (D23C.6) |
| **DM-12** | 23-A | **Nove viraram dez.** `library-not-found` no `/context` não estava prevista — ninguém imaginou a biblioteca sumir entre as duas chamadas |
| **DM-23** | 23-C | **Cumprida, e a contradição interna do desenho resolvida junto.** O que a parte persiste ficou fixado em D23C.3 |
