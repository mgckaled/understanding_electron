# 23-K — o fechamento

> Décimo primeiro e **último** corte do arco 23. Material de entrada: [`docs/reference/context7/`](../../reference/context7/README.md) e os dez diários. Siglas nascem como `D23K.n`.

## Contexto

Os dez cortes anteriores entregaram a consulta de documentação inteira — cliente REST, fronteira, parte persistida, quatro telas de painel, seleção com orçamento, a linha na transcrição, os onze erros e as minúcias. **O código está pronto e verificado ao vivo corte a corte.** O que falta é tudo o que fica *em volta* dele, e que hoje está errado ou desalinhado em pelo menos oito documentos:

- o `ESCOPO.md` ainda chama o pilar de **"Documentação (MCP)"**, que DM-0 revogou no primeiro dia do arco, e **não registra em lugar nenhum** que consultar documentação manda a pergunta para fora da máquina;
- o guia do arco (`docs/reference/context7/`, **~130 KB em quatro arquivos**) se declara *"vivo como referência e como errata"* **enquanto o arco roda** — e o arco acabou;
- o `DECISOES.md` parou no **23-E**: as decisões de cinco cortes (**56** delas) não estão indexadas;
- o `README.md` da raiz lista *"Busca web e documentação (MCP) no chat"* como **⬜ falta**;
- o `docs/plan/active/README.md` diz que o arco *"fechou os seis primeiros dos onze"* e que *"o próximo é o 23-G"*;
- o `ROADMAP § 1` traz `| 23 | MCP Context7 | planejado |`.

O corte fecha as duas forquilhas que sobraram (11 e 12) e faz a varredura que impede o resto de apodrecer calado.

**Este corte não escreve uma linha de código, e não tem verificação ao vivo** — decidido pelo dono em 13/09/2026. É o primeiro do arco assim, e por isso o portão que vale aqui é o `check:docs` mais o `check-doc-links.mjs`, não o `check:fast`.

---

## O que já está resolvido e não se reabre

| Pergunta | Estado |
|---|---|
| Nome da pasta do guia (DM-0 § *Consequências*) | já é `context7/` desde o primeiro dia |
| Silhueta dos três ícones a 16px | ✅ fechada no 23-H |
| `202` e o enum de `state` | ✅ encerrada sem sonda (D23I.12) — e isso **é** o veredito |
| Contadores anônimo × com-chave | ✅ sondados no 23-I: separados, e **não somáveis** (D23I.13) |
| Verificação do painel inteiro ao vivo | ✅ **encerrada por decisão do dono**, não por passada — D23K.1 |

---

## Decisões a fixar

**D23K.1 — a última verificação aberta do arco fecha por decisão, e isso se escreve.** O guia lista *"o painel inteiro, ao vivo"* como pendente do fechamento. O dono dispensou: os dez cortes foram verificados ao vivo **um a um**, e o 23-J terminou com o print que provou quatro coisas de uma vez. Uma passada final sobre o conjunto acrescentaria confiança marginal ao custo de cota real. **Registrar que foi dispensada é o que impede alguém de lê-la como esquecimento** — mesmo raciocínio de D23I.12.

**D23K.2 — o guia vira `⛔ consumido` e o dono passa para a skill `ctx-7`.** Fecha a forquilha 12. O guia é material de **entrada** de um arco terminado: as 32 `DM-n` foram fechadas antes de existir código, as sondas são de datas específicas, o `painel.md` é mock. Mantê-lo vivo seria manter uma segunda fonte que envelhece calada ao lado do código — exatamente a dívida que a régua de fonte única existe para evitar. **O que ainda amarra código migra para a skill; o resto fica onde está, legível por `Grep`, como os outros três consumidos da pasta.**

**D23K.3 — a skill é `ctx-7`, em três arquivos, divididos por *quando* se lê.** O mesmo critério que deu três anexos ao guia. `SKILL.md` decide a primeira linha; `api.md` é o fio medido; `painel.md` é a interface como ela ficou. ⚠️ **A skill não é um resumo do guia** — ela responde *"o que eu preciso saber antes de tocar isto"*, e material que só responde *"como chegamos aqui"* fica no guia consumido.

**D23K.4 — a linha de privacidade entra no `ESCOPO.md` como subseção com peso de lei.** Fecha a forquilha 11, calibrada pelo dono. Molde: § *A URL escolhida pelo modelo não é a URL clicada pelo usuário*, que é o vizinho exato em natureza. O argumento que a põe nesse peso: **até aqui "o que sai da máquina" era governado pela escolha de provedor** — conversa local, nada sai. O Context7 quebra isso, e **nenhuma seção do `ESCOPO` diz isso hoje**.

**D23K.5 — o guia antigo `web-fetch-mcp-thinking` tem o escopo reduzido, não é marcado consumido.** A linha do 23-K prometia `⛔ consumido`, e cumpri-la ao pé da letra jogaria fora o material de entrada do **arco 22**: das três features, a 2 (MCP) foi consumida por este arco e a 3 (Thinking) pelo 21, mas a **1 (busca web) segue sendo a origem de um arco que ainda não nasceu**. Precedente exato na mesma tabela: o guia `reasoning/` leva *"Escopo reduzido pelo R-6"* e segue `✅ vivo`.

**D23K.6 — o `DECISOES.md` ganha uma linha por decisão, e a regra que diz o contrário é corrigida junto.** O `docs/README.md` § *ciclo de vida* manda dar **uma linha ao plano inteiro** quando ele não tem heading `### D<id>` — e 23-C, 23-D, 23-E escrevem em negrito (`**D23D.2 — …**`) e **têm uma linha cada** no índice. A prática do arco já contradiz a regra escrita; o índice fica mais útil e a regra é que se ajusta. ⚠️ **Segunda errata no mesmo arquivo:** o preâmbulo do `DECISOES.md` afirma que a descrição é *"copiada verbatim, nunca reescrita"*, e as linhas de 23-A a 23-E já são paráfrases (`D23E.5` no plano é *"rádios nativos dentro de `<label>`, num `<fieldset>`"*, no índice é *"Rádios nativos: o Chromium já implementa o padrão Radio Group do APG inteiro"*). Ou se corrige a afirmação, ou ela vira a próxima pergunta de alguém.

---

## Passos

### Passo 1 — a skill `ctx-7`

**Arquivos novos:** `.claude/skills/ctx-7/SKILL.md` · `api.md` · `painel.md`

Frontmatter no molde das sete existentes (`name: ctx-7`, `description:` dizendo o que cobre **e** quando usar).

**`SKILL.md` — o que decide a primeira linha.** Não é resumo: é o conjunto do que alguém violaria sem saber.

| Bloco | O que carrega |
|---|---|
| **REST, nunca MCP** | DM-0 com o par de números (2.060 tokens de definição × 352–1.244 de resposta inteira) — é a decisão que alguém tentará reabrir, e o custo de reabrir sem o número é alto |
| **Onde cada peça mora** | `core/context7/` (cliente puro, `fetch` injetado) → `main/features/context7/` (handlers, memo, cota) → `renderer/features/docs/` (quatro telas). Os canais `docs:*` e a chave no cofre são da skill `ipc` — ponteiro a escrever relativo à pasta da skill, nunca cópia |
| **`Result` × estado de tela** | 400/404 **nunca** viram `AppError` (D23A.3): `no-libraries`, `empty`, `indexing`, `library-not-found` viajam dentro do `value`. Entregar o 404 a `describeUpstreamError` apresenta erro de digitação como falha de sistema |
| **⚠️ A chave do memo de sessão** | `fetch\|libraryId\|version\|broad\|query` — D23J.4 e o modo de falha dela (sucesso silencioso), porque é a linha que alguém encurta sem perceber |
| **`rules` se exibe e nunca se envia** | DM-17, com a procedência dividida que a pesquisa do 23-F achou: só `libraryOwn` vem do repositório; `global`/`libraryTeam` chegam pela chave de **quem consulta** |
| **Cota e chave** | a chave é **exigida** (D23I.5); os dois regimes são contadores separados e **não somáveis** (D23I.13); não existe endpoint de cota — o header da última resposta é tudo (D23I.7) |
| **A pergunta sai da máquina** | DM-22, apontando o `ESCOPO` como dono, e o ponto cego não instrumentado que viajou para o `O-9` |
| **`invoke` simples, nunca job** | D23B.1 e o gatilho de reversão **medido** (2.222 ms contra teto de 30 s) — mais a condição 1, que ficou descumprida três cortes e só o 23-I pagou |
| **Como se testa sem gastar cota** | fixtures gravadas em `core/context7/__fixtures__/`; a suíte **nunca** bate na API |

**`api.md` — o fio, medido.** As duas rotas e os quatro parâmetros · `fast` invertido (`true` = **amplo**, ~25 trechos) · o que a resposta traz e as **sentinelas** (`stars: -1`, `pageTitle: "Unknown"`, `codeLanguage: "APIDOC"`) · `codeId` endereça a **página**, não o trecho · `codeList[]` são **variantes** do mesmo exemplo · `versions[]` não é ordenável nem homogêneo, e `__branch__*` se filtra · sem paginação · a ordem da API **não é estável entre chamadas idênticas** · termo sem sentido pode dar `200` com cinco resultados irrelevantes · os headers de cota e a ausência de endpoint · a armadilha de sonda do Git Bash (`MSYS_NO_PATHCONV=1`).

**`painel.md` — a interface como ela ficou**, nunca o mock: as quatro telas (compor · desambiguar · resultado · releitura), os **onze** textos de falha com a ação de cada um, o contador e o `histórico`, a linha na transcrição com o interruptor, e as duas densidades (DM-28) com os dois elementos que a execução acrescentou — descrição **e** título são markdown.

### Passo 2 — o guia consumido, e o antigo com escopo reduzido

1. `docs/reference/context7/README.md` ganha o cabeçalho `⛔` no molde dos três já consumidos da pasta, apontando a skill como dono e dizendo o que **sobra** ali (o porquê histórico, as 32 `DM-n`, as sondas com data, o mock). Os três anexos ganham a mesma marca, uma linha cada.
2. `docs/reference/README.md`: a linha do Context7 vira `⛔ consumido` com o ponteiro para a skill; a do `web-fetch-mcp-thinking` vira **escopo reduzido à Feature 1** (D23K.5), seguindo `✅ vivo`.
3. ⚠️ **Não apagar nada.** `⛔` é *leitura histórica*, e a pasta continua grepável — foi assim com `arte-anterior-milltools`, `brief-claude-design` e `cloud-optin-implementation-guide`.

### Passo 3 — `ESCOPO.md`

1. **`Documentação (MCP)` → `Documentação (Context7)`** na tabela de § *Ferramentas do chat*, com a célula "Não faz" reescrita: não é suporte a MCP em geral **porque não há MCP nenhum** — a integração é REST, e ligar um servidor MCP é decisão nova.
2. **Subseção nova com peso de lei** (D23K.4), depois da tabela e antes de § *A URL escolhida pelo modelo*: a pergunta vai **como escrita** (DM-22), vale **inclusive em conversa 100% local**, o aviso é permanente sob o campo e nunca consentimento de uma vez, e o registro do que saiu é dívida nomeada do `O-9`.
3. O parágrafo *"Como a ferramenta é acionada é decisão do plano"* passa a dizer que, **para documentação, está decidido**: quem aciona é o usuário, por ato explícito, sem `tools` em provedor nenhum — e que isso é o precedente que o arco 22 herda, não uma regra que ele deva repetir.
4. O ponteiro para `reference/web-fetch-mcp-thinking/` no topo da seção passa a nomear as duas fontes: a skill `ctx-7` para documentação, o guia reduzido para busca web.

### Passo 4 — `DECISOES.md`

1. Extrair as **56** decisões que faltam — `23-F` (13), `23-G` (10), `23-H` (9), `23-I` (13), `23-J` (11) —, uma linha cada, no formato das vizinhas — `trilha | sigla linkada ao plano | descrição`. Os três formatos de origem (`### D<id> —`, `**D<id> —`, `- **D<id> —`) saem todos de um `grep` por `D23[F-J]\.\d+ —`.
2. As **duas erratas do próprio arquivo** (D23K.6): a régua de *"uma linha por plano sem heading"* em `docs/README.md`, e a afirmação *"copiado verbatim"* no preâmbulo.
3. **Remedir** a contagem do preâmbulo (hoje declara 303 de ago/2026; o real antes deste passo é **519**).

### Passo 5 — a varredura ampla

O que o `grep` já mostrou desalinhado, com o conserto de cada um:

| Arquivo | O quê |
|---|---|
| `CLAUDE.md` | o pilar `documentação (MCP)` no parágrafo de abertura → Context7 · linha nova na tabela § *Fonte única por assunto* apontando a skill `ctx-7` · números de `docs/` remedidos no fim |
| `docs/README.md` | a linha *"Ferramentas do chat"* aponta o guia antigo como dono único → **divide**: documentação é da skill `ctx-7`, busca web segue no guia reduzido · a régua de `DECISOES.md` (D23K.6) |
| `README.md` (raiz) | `⬜ Busca web e documentação (MCP)` **divide em duas**: ✅ consulta de documentação via Context7, ⬜ busca web · a linha de `.claude/skills/` ganha o assunto novo · os `~660k tokens em 117 arquivos` remedidos (o real hoje é ~749k/132) |
| `docs/ROADMAP.md` | `§ 1` linha 45: `| 23 | MCP Context7 | planejado |` → **✅ arco inteiro concluído**, com os onze cortes linkados, no molde da linha do arco 21 · o gatilho *"o plano 23 entregar valor real"* **disparou** e precisa de veredito · a menção do `O-9` a `reference/context7/` passa a apontar a skill |
| `docs/plan/active/README.md` | diz *"fechou os seis primeiros dos onze"* e *"o próximo é o 23-G"* → o arco **fechou inteiro** |
| skill `ipc` | a linha do domínio `docs` ganha o ponteiro para `ctx-7`, como a de `ai` já faz para a skill dela |

⚠️ **Depois da varredura, `grep -rn "Documentação (MCP)\|documentação (MCP)"` tem de voltar vazio** fora de `plan/implemented/`, `HISTORY-archive.md` e do guia consumido — que são registro histórico e **não se corrigem**.

### Passo 6 — fechamento

Diário, entrada de marco no `HISTORY.md` (**a 11ª empurra a mais antiga para o archive na mesma edição**), plano movido para `implemented/`, as sete skills conferidas mais a nova, e os números de `docs/` remedidos **por último** — porque mover o plano e escrever a entrada muda o que se ia medir.

---

## Verificação

Sem teste ao vivo e sem código, o portão é outro:

| O quê | Como |
|---|---|
| Link relativo e seção citada | `pnpm exec node scripts/check-doc-links.mjs` — **obrigatório**, porque o `guard` não vê escrita por `sed`/`python` |
| Portão de documentação | `pnpm check:docs` |
| A skill carrega | invocar `ctx-7` pela ferramenta Skill e ler o que volta — frontmatter mal formado só aparece assim |
| Termo morto | `grep -rn "(MCP)"` e `grep -rn "reference/context7"` fora do histórico |
| Contagem de decisões | `grep -cE '^\| [^|]+ \| \['` em `DECISOES.md` **depois** de escrever, nunca copiada |

⚠️ **`pnpm check:fast` não é o portão deste corte**, mas roda de qualquer forma no `commit_gate` — e tem de continuar verde, porque nada de código muda.

---

## Riscos nomeados

| Risco | Por que é aceitável |
|---|---|
| A skill nascer grande demais e virar o guia com outro nome | o critério é explícito em D23K.3: *"o que eu preciso saber antes de tocar isto"*. Material que responde *"como chegamos aqui"* fica no guia consumido |
| As 56 linhas do `DECISOES.md` serem paráfrase e não cópia | já é a prática de 23-A a 23-E, e a errata de D23K.6 torna isso declarado em vez de silencioso |
| A varredura deixar passar um apontador | o `check-doc-links.mjs` pega caminho quebrado; o que ele **não** pega é ponteiro semanticamente velho — daí os dois `grep` nomeados na verificação |
| Marcar o guia consumido e descobrir depois que algo dele ainda amarra código | `⛔` não apaga: a pasta segue grepável, e o precedente dos três já consumidos mostra que isso basta |

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 13/09/2026 | Plano escrito a partir do guia do arco (os quatro arquivos) e dos dez diários; D23K.1–D23K.6 fixadas | Três forquilhas resolvidas pelo dono: a linha de privacidade com **peso de lei** (subseção própria, não célula de tabela), o guia antigo com **escopo reduzido** em vez de consumido, e a skill em **três arquivos**. ⚠️ **O levantamento achou mais desalinhamento do que a lista pedia:** o `DECISOES.md` parou no **23-E** (faltavam 56 decisões, não as de um corte), o `plan/active/README.md` dizia *"fechou os seis primeiros dos onze"*, e o gatilho do `ROADMAP` *"o plano 23 entregar valor real"* tinha **disparado** sem veredito |
| 13/09/2026 | Passo 1: a skill `ctx-7` em três arquivos | 29 KB no total — entre `ipc` (13,6) e `design-system` (39). ⚠️ **O `guard` cobrou na hora certa:** o `SKILL.md` apontava para `api.md` e `painel.md` antes de eles existirem, e a escrita foi **bloqueada** — a 11ª invariante fazendo exatamente o que foi feita para fazer. Achado de ferramenta: o heredoc do Bash não sobreviveu ao conteúdo (aspas e crases), e os três arquivos foram pela ferramenta dedicada; a skill foi **invocada** depois de escrita, que é a única forma de provar que o frontmatter carrega |
| 13/09/2026 | Passos 2 e 3: o guia consumido, e o `ESCOPO` | O guia e os três anexos ganharam o cabeçalho `⛔` no molde dos outros três consumidos da pasta, **sem apagar nada**, com a regra de desempate escrita: *o que estiver aqui e na skill ao mesmo tempo, a skill vence*. No `ESCOPO`, o pilar deixou de se chamar MCP **quatro meses depois de DM-0 revogar o nome**, e a subseção de privacidade nasceu com o argumento que a justifica: até aqui o que saía da máquina era governado pela escolha de provedor, e a consulta quebra isso |
| 13/09/2026 | Passo 4: as 56 decisões, e as duas erratas do próprio índice | Extração mecânica por `grep` sobre os três formatos que convivem nos planos (`### D<id> —`, `**D<id> —`, `- **D<id> —`). ⚠️ **A régua escrita estava errada em dois pontos, e a prática é que estava certa:** o `docs/README.md` mandava dar uma linha ao **plano inteiro** quando ele não tem heading — o que descreveria sete cortes do arco como uma linha cada —, e o preâmbulo do `DECISOES.md` prometia descrição *"copiada verbatim"* quando as linhas de 23-A em diante já eram paráfrase. Os dois ajustados; a contagem remedida de **303** (ago/2026) para **575** |
| 13/09/2026 | Passo 5: a varredura, e um achado fora da lista | Seis documentos alinhados. ⚠️ **O `grep` de termo morto pegou um que ninguém tinha pedido:** o guia `reasoning/` — **vivo** — descreve o array `TOOLS` com três interruptores e o rótulo `Documentação (MCP)`, peça que o **23-D desfez** (D23D.5) ao reformar o popover inteiro. Ganhou errata no topo do parágrafo em vez de reescrita, porque está fora do escopo reduzido dele |
