# 14 — Persistência das conversas

**Depende de:** [13 — Casca do aplicativo](13-casca-do-aplicativo.md) · **Entrega:** a mesma tela do 13, sobrevivendo ao fechamento. `node:sqlite` em `userData`, esquema com escada de migração desde a v1, canais `conversation:*`, histórico ao abrir, renomear e excluir — e a resposta interrompida gravada com o que chegou.

> Segundo plano do [arco conversacional](../active/README.md#o-arco-conversacional-1320). **Primeiro plano do arco que atravessa a fronteira de processo:** ele cria canais, handlers e o primeiro dado que o aplicativo escreve por conta própria. Se um componente do renderer aparecer no diff sem que um hook tenha mudado antes, algo passou por cima da D14.6.

---

## O caso

O plano 13 entregou a casca: cria conversa, conversa nas duas, alterna entre elas — e **tudo some ao fechar**. Isso não é uma lacuna de conveniência. As conversas são o **primeiro dado próprio do aplicativo** ([`ESCOPO.md`](../../ESCOPO.md)): tudo até aqui é derivado de um arquivo do usuário, e a conversa não é. Enquanto ela vive só em memória, o app não tem estado — tem sessão.

O plano 13 preparou o terreno de propósito, e três coisas dele são a fundação deste:

- **O store já tem o formato do cache que vai substituí-lo.** A lista é ordenada por `updatedAt` descendente com a conversa tocada voltando ao topo, que é o que o `ORDER BY updated_at DESC` vai devolver. A UI não muda quando a fonte mudar.
- **`useConversations()` e `useActiveConversation()` são o único ponto de troca** (D13.2). Nenhum componente chama `useContext` direto, e é isso que faz o passo 3 tocar um arquivo em vez de quatro.
- **`Message` já é lista de partes tipadas** (D13.3). O que vai para a coluna JSON já tem forma.

**Fora deste plano:** orçamento de contexto e seletor de modelo (15), mecanismo de anexo e cartão de dados (16), anexo de documento e imagem (17), DuckDB (18). Busca em texto completo também fica fora — ver [D14.9](#d149--o-cartão-de-dados-não-nasce-aqui-porque-não-há-escritor).

> ⚠️ **Revisado em ago/2026, depois da [entrada de documento e imagem no escopo](../../HISTORY.md).** A revisão criou o plano 17 e empurrou o DuckDB para 18 — os números acima já refletem isso. **Nada do esquema mudou**, e essa é a informação útil: uma ampliação de escopo que acrescenta duas classes de anexo passou por este plano sem tocar um `CREATE TABLE`. Os pontos onde ela encosta estão marcados na D14.1, na D14.9 e na seção final.

---

## O que foi medido no binário deste Electron

Refeito nesta sessão de planejamento, porque cada linha abaixo **decide uma linha de código** e a decisão original de persistência foi tomada com o Electron de outra semana. Sonda direta, não leitura de changelog.

| | Medido |
|---|---|
| Runtime | Electron 42.8.0 · Node 24.18.0 · SQLite **3.53.1** |
| Superfície de `node:sqlite` | `DatabaseSync`, `StatementSync`, `Session`, `backup`, `constants` |
| `app.getName()` / `userData` | `crivo` / `%APPDATA%\crivo` — o renome de ago/2026 pagou o que prometeu |
| `PRAGMA journal_mode = wal` | **`wal`** em arquivo (em `:memory:` responde `memory`, e é por isso que a sonda precisou de um arquivo real) |
| `PRAGMA foreign_keys` | **já vem `1`** — o `node:sqlite` liga por padrão, ao contrário do SQLite cru, onde é `0` |
| `ON DELETE CASCADE` | funciona; apagar a conversa leva as mensagens |
| Inteiro devolvido | `number`, **não `BigInt`** — `Date.now()` em milissegundos atravessa sem conversão |
| `json_extract` | disponível |
| FTS5 | **disponível** — não usado aqui, mas o gatilho do [`ROADMAP § 2`](../../ROADMAP.md) deixa de depender de "será que dá?" |
| Ao fechar limpo | sobra só `crivo.db`; `-wal` e `-shm` são consolidados |

⚠️ **`foreign_keys` ligado por padrão é a linha mais fácil de errar nos dois sentidos.** Quem vem do SQLite cru escreve o `PRAGMA` por hábito (inofensivo) ou, pior, **assume que está desligado** e conta com poder inserir mensagem órfã em teste. Não dá.

---

## Decisões tomadas

### D14.1 — Duas tabelas, e `parts` é coluna JSON

O [`HISTORY.md`](../../HISTORY.md) § *persistência em `node:sqlite`* é o dono da escolha do motor, e o argumento que ele usa contra banco documental **dita o esquema**: *"numa base documental a conversa é um documento, e cada mensagem nova reescreve o documento inteiro"*. Logo, **mensagem é linha**, não item dentro de um blob de conversa.

```sql
conversations(id TEXT PK, title TEXT NOT NULL, created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL, settings TEXT NOT NULL DEFAULT '{}')
messages(id TEXT PK, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
         role TEXT NOT NULL, parts TEXT NOT NULL, created_at INTEGER NOT NULL,
         model TEXT, stopped TEXT)
```

Dois índices: `messages(conversation_id, created_at)` e `conversations(updated_at DESC)`.

**A régua que separa coluna de JSON é a D13.4, e ela já está decidida: o que a sidebar lista vira coluna; o que só a chamada ao modelo lê vira `settings` JSON.** Título e `updated_at` são coluna. `num_ctx`, temperatura e prompt de sistema — que o plano 15 vai criar — vivem no JSON, e é isso que impede cada botão novo de custar uma migração.

`parts` é JSON pelo mesmo motivo, com uma consequência que vale escrever: **as variantes `dataset` (plano 16) e `document`/`image` (plano 17) não vão exigir migração nenhuma.** É a flexibilidade que o `HISTORY` chama de legítima — "metadados que variam por mensagem" —, não *schemaless* disfarçado, porque tudo que se consulta é coluna.

A segunda dessas variantes é evidência, não previsão: ela **não existia** quando esta decisão foi escrita. A revisão de escopo de ago/2026 acrescentou duas classes de anexo dias depois, e o custo em esquema foi zero. Uma aposta dessas confirmada uma vez é sorte; a régua que a produziu está no [`HISTORY`](../../HISTORY.md) § *flexibilidade é forma de dado e slot*, e é ela que se cita, não o acerto.

### D14.2 — A escada de migração nasce **exercitada**, não só escrita

`PRAGMA user_version` com escada desde a v1 é infraestrutura que o [`HISTORY`](../../HISTORY.md) já exige por nome. O que este plano acrescenta é a desconfiança:

> **Uma escada com um degrau só nunca subiu escada nenhuma.** Ela roda `v0 → v1` na primeira abertura e nunca mais é executada em nenhuma máquina. Se o segundo degrau tiver defeito — e ele será escrito no plano 15 ou 16, sob pressão de outra coisa —, o defeito aparece **na base de alguém que já tem conversas dentro**.

É a mesma classe da prova do smoke test da [fase 07](07-e2e-e-empacotamento.md) (sabotar o `files` para ver o teste ficar vermelho) e da provocação de hook da [fase 08](08-automacao-e-registro.md). A escada é uma lista de funções indexada por versão, e o teste de nível 1 abre um banco **na v1 com linhas dentro**, roda a escada até uma v2 de fixture, e confere que as linhas sobreviveram. O degrau de fixture mora no teste, nunca no código de produção.

**Descartado** gerar o esquema a partir de um ORM ou de um migrador de terceiro: são quatro `CREATE TABLE` e uma função por versão, e o `node:sqlite` foi escolhido exatamente para não trazer pacote.

### D14.3 — Resposta interrompida grava o parcial, com marcador

A decisão que o contrato do arco reservou para este plano. **O que chegou é gravado**, como mensagem do assistente marcada com `stopped: 'cancelled' | 'timeout'`.

O motivo é o que a transcrição afirma. Uma conversa que descarta meia resposta mente por omissão: você lembra de ter perguntado, o app mostra a pergunta sem resposta, e não há como distinguir "o modelo não respondeu" de "eu cancelei". Com o marcador, a tela diz o que aconteceu, e o parcial **ainda informa o turno seguinte** — numa CPU sem GPU, jogar fora quarenta segundos de geração para reperguntar é caro.

**O mecanismo não custa mudança de contrato, e isso é o ponto de tê-lo verificado antes de planejar.** O texto parcial já existe no renderer: o `streaming` acumulado pelo `useJobChunks`. O main não tem como devolvê-lo — em `cancelled` e `timeout` o handler retorna `err(...)` e o `AppError` não carrega carga útil —, mas ele não precisa. Quem decide gravar é o renderer, e o renderer já tem o texto.

| Caso | O que grava |
|---|---|
| `cancelled` com texto | mensagem do assistente + `stopped: 'cancelled'` |
| `timeout` com texto | mensagem do assistente + `stopped: 'timeout'` |
| Interrompida **antes do primeiro token** | **nada** — mensagem vazia é ruído, não honestidade |
| `unavailable` / `upstream` | nada; o erro é da chamada, não uma resposta parcial |

Os dois primeiros casos já são distinguíveis: a flag `timedOut` do handler (`src/main/features/ai/handlers.ts`) mapeia para `AppError` diferentes, e o renderer lê o `kind`.

`stopped` é coluna, não parte da mensagem: a sidebar não o lista hoje, mas ele é **metadado do turno**, não conteúdo — e enfiá-lo em `parts` faria a interface abrir o JSON para saber como desenhar um rótulo.

### D14.4 — TanStack Query entra para o cache de servidor; o Context fica com o cliente

O gatilho do [`ROADMAP § 2`](../../ROADMAP.md) tinha data marcada aqui, e a razão registrada nele acontece de fato neste plano: **a lista de conversas é refeita após cada resposta**, que é a consulta repetida que faltava quando a [fase 06](06-primeira-feature.md) adiou a adoção. A régua que adiou é a mesma que agora manda adotar.

A divisão é a da D13.2, sem alteração:

| | Onde | Exemplos |
|---|---|---|
| **Cache de servidor** | TanStack Query | lista de conversas, mensagens de uma conversa |
| **Estado de cliente** | Context, para sempre | conversa ativa, sidebar recolhida, rascunho, `jobId` em voo |

**O corpo dos dois hooks é a única coisa que muda.** É a promessa que a D13.2 fez, e o passo 3 existe para cobrá-la: se um componente precisar ser tocado, a promessa era falsa e isso merece registro.

Três coisas que **não** entram, cada uma porque resolve um problema que este app não tem:

- **Atualização otimista.** Ela existe para esconder latência de rede. Aqui a escrita é um `INSERT` local de microssegundos no mesmo processo — invalidar depois da mutação é mais simples e não tem estado de reconciliação para errar.
- **`refetchOnWindowFocus`.** Desligado. Há um único escritor, que é este app; recarregar ao voltar o foco é comportamento de aba de navegador.
- **`queryClient` dentro de componente.** Ele mora no provider e nos hooks. A regra "nenhum componente chama `useContext` direto" vale igual para `useQueryClient`.

**Descartados:** invalidação manual no Context (funciona nesta escala, mas é reescrever o que a biblioteca faz, e o gatilho ficaria aberto para sempre) e SWR (menor, mas o projeto precisa de mutação com invalidação, que é onde o TanStack é mais forte). A dependência entra na tabela de stack do [`CLAUDE.md`](../../../CLAUDE.md) na sessão que a instalar, com a versão fixada lá — não aqui, para o plano não envelhecer junto.

### D14.5 — O renderer continua cunhando `id` e `createdAt`

Já é assim no store do 13, e o main aceita os dois como vieram. Mesmo argumento do `JobId` (skill [`architecture`](../../../.claude/skills/architecture/SKILL.md)): identidade gerada no lado que age dispensa esperar a resposta para saber do que se está falando. E torna a invalidação previsível — o que a UI acabou de mostrar e o que o banco guardou têm a mesma chave.

Consequência para o handler: ele **não** gera identidade nem carimba tempo. Insere o que recebe, validado por zod.

### D14.6 — Ao abrir, a conversa mais recente

`ORDER BY updated_at DESC LIMIT 1`. Custa zero coluna, e o reducer do 13 já elege `conversations[0]` quando precisa eleger. Persistir *qual estava ativa* foi descartado por preço/benefício: uma coluna a mais, um caso de borda (a conversa pode ter sido excluída noutra sessão) e o ganho é distinguir "a última que olhei" de "a última que mexi", que quase sempre são a mesma.

Banco vazio na primeira abertura abre **sem conversa ativa**, no estado vazio que o `ConversationView` já desenha.

### D14.7 — Configurações de máquina numa tabela chave-valor

`num_thread` hoje mora só em memória: o modal existe, aceita o valor, e esquece ao fechar — defeito visível. Vai para uma tabela `app_settings(key TEXT PK, value TEXT NOT NULL)` no mesmo banco: **um mecanismo de armazenamento, uma escada de migração**.

Escala de máquina, como a D13.4 fixou — por isso tabela própria e não coluna de conversa.

**Fora:** o estado recolhido da sidebar. É chrome, e a "largura persistida" que o passo 1 do plano 13 mencionou pressupõe uma alça de redimensionar que não existe — persistir um booleano hoje seria adiantar metade de uma feature.

### D14.8 — Escrita síncrona no main, e o que a reabre

O `HISTORY` já registra a contrapartida: a API do `node:sqlite` é síncrona e roda no main, o que contraria a D9.1 na letra, e é aceitável porque listar e inserir são operações **indexadas de microssegundos**. Este plano não muda isso e acrescenta uma condição de saúde: **nenhuma escrita acontece por token.** Só turno concluído — o que já é verdade no renderer desde a D13.2, e agora tem consequência de disco.

O gatilho que reabre continua sendo o do [`ROADMAP § 2`](../../ROADMAP.md): busca em texto completo sobre todo o histórico.

### D14.9 — O cartão de dados **não** nasce aqui, porque não há escritor

Registrado porque é a primeira coisa que uma sessão futura vai querer acrescentar, e porque a pergunta já foi feita: *vale persistir o resumo do arquivo analisado — colunas, tipos, contagem de linhas?*

**Vale, e não é deste plano.** Hoje não existe caminho para anexar arquivo a uma conversa: o `OpenDatasetPanel` é uma seção da sidebar cujo resultado é `ViewState` local, sem dono. Criar a tabela agora é armazenamento sem escritor — exatamente o que a régua do `HISTORY` § *flexibilidade é forma de dado e slot* recusa como camada (3), feature. O escritor nasce no **plano 16**.

**A forma, essa sim, decide-se agora, porque é camada (1):** o cartão mora **dentro da mensagem**, na variante `{ kind: 'dataset', ... }` de `MessagePart`, dentro da coluna `parts`. Não num armazenamento próprio. Três razões:

1. O [`ESCOPO.md`](../../ESCOPO.md) já decidiu — *"o que seria 'aba de pré-visualização' é um bloco preso à mensagem em que o arquivo foi anexado, e some da vista junto com ela"*. Cartão global reintroduz a aba fixa que a conversa substituiu.
2. **Ele não é rederivável na prática.** A regra "a conversa guarda a pergunta, a proposta e o veredito, nunca o resultado" vale porque resultado se recomputa do arquivo — *se* o arquivo ainda existir e não tiver mudado. Reabrir uma conversa de um mês atrás e ver referência a colunas que não se pode mais consultar é pior do que gravar alguns KB.
3. Custa **zero** a este plano: `parts` já é JSON opaco.

A revisão de escopo de ago/2026 **endureceu a razão 2 e acrescentou uma quarta**. O anexo de documento e imagem do plano 17 não é rederivável *na prática*, como o cartão — é irrecuperável **por natureza**: os bytes de um PDF não se recomputam de arquivo nenhum se o original foi movido ou apagado. Daí a regra do [`ESCOPO.md`](../../ESCOPO.md) de guardar o arquivo em `userData/attachments/<hash>` e a mensagem guardar a referência. **A quarta razão é essa:** as três variantes de anexo — `dataset`, `document`, `image` — passam a ter a mesma forma, uma parte tipada apontando para conteúdo endereçado por hash, e uma forma só é o que permite ao construtor de contexto de `core/` tratar as três no mesmo caminho, com uma fronteira de privacidade só.

⚠️ A objeção honesta, registrada para não ser redescoberta: com o cartão dentro do JSON, RAG sobre cartões (fatia 5 do [plano 09](../active/09-camada-de-ia.md)) e o observatório precisariam varrer o JSON de toda mensagem — o próprio argumento do `HISTORY` de que *schemaless* move a migração para o caminho de leitura. **A resposta é a D14.2:** quando existirem cartões suficientes, promover de JSON para tabela própria com backfill por `json_extract` é *operação normal* — desde que a escada exista **e tenha sido exercitada**. É por isso que o passo 1 gasta um teste nela.

---

## Passos

### Passo 1 — A camada de banco, sem canal nenhum

`src/main/db/` nasce: abertura em `app.getPath('userData')`, `journal_mode = wal`, e a escada de migração indexada por `PRAGMA user_version` com a v1 criando as três tabelas e os índices. Nada de IPC, nada de UI.

O esquema mora numa função por versão; o `open()` recebe o caminho por parâmetro (DIP), o que é o que torna tudo isto testável contra `:memory:` sem subir o Electron.

**Aceite:** teste de nível 1 abrindo `:memory:` na v0 e subindo para a v1; **o teste do segundo degrau** (D14.2) — banco na v1 **com linhas dentro**, escada até uma v2 de fixture, linhas intactas e `user_version` em 2; teste de que `ON DELETE CASCADE` leva as mensagens junto. `pnpm check:fast` verde.
**Commit:** `feat(main): banco de conversas com escada de migração desde a v1`

### Passo 2 — Os canais `conversation:*`

`src/shared/ipc.ts` ganha os schemas zod e as entradas do `IpcContract` — **agora sim**, porque agora existe IPC (era o que a D13.3 estava esperando). Handlers como funções exportadas em `src/main/features/conversation/handlers.ts`, recebendo o banco por parâmetro; `register-all.ts` costura.

Canais: listar, ler uma, criar, renomear, excluir, acrescentar mensagem. `Result` onde pode falhar de verdade; payload fora do schema **lança**, como sempre.

**Aceite:** testes de nível 3 chamando cada handler como função comum contra `:memory:`, sem Electron; `argsSchema` rejeitando payload malformado; `pnpm typecheck` limpo nos três projetos.
**Commit:** `feat(main): canais conversation:* sobre o banco`

### Passo 3 — O cache de servidor entra por dentro dos hooks

TanStack Query instalado, `QueryClientProvider` na composição, e o corpo de `useConversations()` / `useActiveConversation()` reescrito para ler dos canais. O Context perde a lista e as mensagens, e **fica** com conversa ativa, sidebar e rascunho.

> **A prova que este passo existe para cobrar:** os testes de nível 2 do plano 13 — troca de conversa, renomear, excluir, o fluxo que não vaza para outra conversa — precisam continuar verdes **sem que nenhum componente seja tocado**. Só os envoltórios de teste mudam, para incluir o provider. Se um componente precisar mudar, a D13.2 estava errada e isso sobe para o `HISTORY.md`.

**Aceite:** `git diff --stat` do passo mostrando os componentes intocados; `check:fast` verde; conversar, fechar e reabrir mantendo o histórico (verificação ao vivo).
**Commit:** `feat(renderer): cache de servidor no lugar do estado em memória`

### Passo 4 — A resposta interrompida

`stopped` entra em `Message` e na tabela. O renderer grava o `streaming` acumulado ao receber `cancelled` ou `timeout`, e **não grava nada** se nenhum token chegou. O marcador aparece na transcrição, ao lado do rótulo de autoria.

**Aceite:** teste de nível 2 dos três casos (parcial cancelado grava com marcador, parcial estourado grava com o marcador **outro**, interrupção antes do primeiro token não grava); ao vivo — mandar uma pergunta longa, cancelar no meio, fechar o app, reabrir e encontrar o parcial marcado.
**Commit:** `feat(conversation): resposta interrompida grava o que chegou, com marcador`

### Passo 5 — Configurações que sobrevivem

`app_settings` ganha `num_thread`; o modal lê e grava. O valor chega na chamada seguinte ao Ollama, como já chegava — a diferença é que ele continua lá amanhã.

**Aceite:** mudar o valor, fechar, reabrir e encontrá-lo; a chamada ao Ollama usando o valor restaurado; `check:fast` verde.
**Commit:** `feat(settings): num_thread persistido em app_settings`

### Passo 6 — O nível 4 que só este plano pode ter

Um spec de e2e que **fecha e reabre o aplicativo**: envia, encerra o `electronApp`, lança de novo e encontra a conversa na sidebar com o histórico dentro. É a única prova de que a persistência funciona de ponta a ponta, e é literalmente impossível nos níveis 1–3.

> ⚠️ **A armadilha deste passo, e ela morde antes de qualquer asserção:** o e2e roda contra o `userData` **real da máquina**, então um spec assim escreve conversas de teste dentro do `%APPDATA%\crivo` de quem desenvolve — e um teste que apaga tudo para começar limpo apagaria o histórico de verdade. O spec precisa de um `userData` próprio (`--user-data-dir` nos `args` do `_electron.launch`, numa pasta temporária por corrida), e o `workers: 1` do `playwright.config.ts` deixa de ser só sobre disputa de porta. Confirmar o caminho efetivo com `app.getPath('userData')` dentro do teste **antes** de escrever a primeira asserção.

**Aceite:** `pnpm test:e2e` 5/5, com o spec novo provado pelo ciclo vermelho→verde (sabotar a escrita, ver falhar, reverter); `app.getPath('userData')` do teste apontando para a pasta temporária, não para `%APPDATA%\crivo`.
**Commit:** `test(e2e): a conversa sobrevive ao fechamento do aplicativo`

---

## O que este plano deixa registrado para o 15, o 16 e o 17

- **`settings` JSON por conversa já existe como coluna** (D14.1) — `num_ctx`, temperatura e prompt de sistema entram lá sem migração.
- **`parts` é JSON opaco** — as variantes `dataset` (16) e `document`/`image` (17) não custam migração; o que custa é promovê-las a tabela, e o gatilho para isso é RAG (D14.9).
- **`app_settings` é chave-valor** (D14.7), então a política de modelo carregado que o plano 17 traz — descarregar o anterior ao trocar, e o que o `/api/ps` mostra em Configurações — entra como chave nova, sem tocar o esquema.
- **A escada tem dois degraus provados** (D14.2), então tabela nova é operação normal e não uma crise.
- **O modelo por mensagem já está gravado** — o seletor do plano 15 pode trocar de modelo no meio sem perder a autoria do que já foi respondido.
- **FTS5 está disponível neste binário** — o gatilho de busca do [`ROADMAP § 2`](../../ROADMAP.md) deixa de carregar a incerteza de disponibilidade e passa a ser só uma decisão de quando.

> ⚠️ **A armadilha que este plano arma para o 16, e que ele não pode resolver sozinho: `ON DELETE CASCADE` resolve mensagem e não vai resolver anexo.** Aqui a cascata está certa — mensagem pertence a uma conversa e a nenhuma outra, então apagar a conversa apaga as mensagens e acabou. Um arquivo em `userData/attachments/<hash>` é o oposto: **endereçado por conteúdo, e por isso compartilhável entre conversas** — o mesmo PDF anexado em duas conversas é um arquivo, não dois. Apagar uma conversa não pode apagar o blob sem antes perguntar se a outra ainda o usa, e o `ON DELETE CASCADE` não sabe fazer essa pergunta. Contagem de referência é problema de quem cria a tabela, mas quem lê este plano precisa saber que a cascata resolvida aqui **não** se estende — a semelhança de forma esconde uma diferença de posse.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 09/08/2026 | 1–6 | **plano concluído** | Uma sessão, seis commits. **A D13.2 se sustentou:** o passo 3 tocou `conversations.ts`, `conversationsContext.ts` e `useConversationChat.ts` — três hooks, **zero componentes** —, e os 33 testes de nível 2 do plano 13 passaram só com o provider acrescentado ao envoltório. O que fez isso funcionar não estava escrito no plano e subiu para o `HISTORY`: `Conversation` virou a **linha** e o composto com `messages` mudou de nome no renderer, então `ConversationList` recebe um subtipo e não muda uma linha. Três achados também subiram: o mock de armazenamento delegando aos handlers reais, o botão escondido por CSS que o jsdom não vê, e o campo do modal semeado antes da leitura chegar. `check:fast` 207 testes em ~15–19 s; `test:e2e` 5/5, com o novo provado por sabotagem (`openDatabase(':memory:')` no composition root → vermelho). Fica aberto: os outros três specs de e2e continuam lançando sem `--user-data-dir` e portanto criam `crivo.db` no `%APPDATA%` real — inofensivo hoje porque nenhum deles escreve conversa, e uma armadilha armada para quem fizer o primeiro que escreva. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [13 — Casca do aplicativo](13-casca-do-aplicativo.md) · **Índice:** [README](../active/README.md) · **Camada de IA:** [09 — Camada de IA e ML](../active/09-camada-de-ia.md)
