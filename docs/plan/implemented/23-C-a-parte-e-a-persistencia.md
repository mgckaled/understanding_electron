# 23-C — A parte e a persistência

> ✅ **Entregue em 08/09/2026.** Terceiro dos **onze** cortes do **arco 23** (documentação por REST). Material de entrada: [`reference/context7/`](../../reference/context7/README.md) — em especial [`painel.md`](../../reference/context7/painel.md) § *A linha na conversa* e § *O que mais o esboço presume*, que são os anexos deste corte. **Nenhum subcorte:** se este plano crescer demais, ele vira dois irmãos no mesmo nível, nunca um `23-C-1`.

## Contexto

O [23-A](../implemented/23-A-cliente-context7.md) entregou o cliente REST; o [23-B](../implemented/23-B-a-fronteira.md), os dois canais, os handlers e a chave no cofre. Hoje o renderer **consegue consultar** o Context7 — e a resposta morre onde chega. Nenhuma consulta entra na conversa, nada é persistido, o modelo nunca vê o resultado.

Este corte fecha a lacuna pela base: a **forma do dado** e a **persistência**, antes de existir painel (23-D em diante). É deliberadamente o corte sem tela — quando o painel nascer, ele terá onde gravar o que compôs.

**Por que agora e não depois do painel.** O diário do 23-B registra o precedente que decide isso: a `DocSnippet` trocou `code` por `blocks[]` naquele corte *"por ser o momento sem consumidor: depois do 23-C haveria parte persistida na forma antiga"* (D23B.11). O 23-C é o mesmo momento uma camada acima — o último corte antes de existir linha gravada no `crivo.db`. Campo que a parte precise ter um dia entra agora ou custa migração de blob JSON depois.

## Sondagem — o que a leitura e a medição encontraram

Sete achados, três deles contra o que se supunha.

| # | Achado | Consequência |
|---|---|---|
| 1 | ⚠️ **`attachmentPartOf` filtra por negação** (`core/ai/messages.ts:44`): `kind !== 'text' && !== 'stepProposal' && !== 'reasoning'` | uma variante nova é **adotada como anexo em silêncio**, contra DM-23. O `typecheck` não vê nada: `part is AttachmentPart` é asserção do autor. É o **único** filtro negativo do app — todo o resto checa `kind` positivamente e é seguro |
| 2 | `historyCharsOf` → `toChatMessages` → `contentOf` → `partForProvider` | consulta desligada devolvendo string vazia **some sozinha** do orçamento. É o que `painel.md` exige (*"o total do histórico e o medidor do composer precisam concordar"*) sem nenhuma segunda contagem |
| 3 | **JSON1 está dentro do binário do Electron** — Node 24.18.0 · SQLite 3.53.1: `json_set`, `json_each` e `->>` funcionam sem `loadExtension` | o desligar é uma statement, não ler-alterar-escrever. ⚠️ A busca web **não** confirmou isto; quem fechou foi a sonda |
| 4 | `conversation:settings` já usa `json_patch`, com o motivo escrito no fonte: *"one statement, so two controls cannot clobber each other through a read-modify-write window"* | precedente interno, não preferência de estilo |
| 5 | Conteúdo com quebra de linha, tab, barra invertida, aspas, não-ASCII e sequência de escape literal sobrevive **byte a byte** ao `json_set`; o blob cresce exatamente 1 byte (`true` para `false`) | trecho de código é seguro no caminho SQL. Sabotagem provada falsa |
| 6 | ⚠️ **`json_set` com caminho `NULL` devolve o JSON intacto** — não `NULL`, não erro | id inexistente vira no-op silencioso reportando `changes: 1`. Sem guarda `EXISTS`, um teste que afirme `changes === 1` fica **verde contra uma expressão de caminho sabotada** |
| 7 | `src/preload/index.ts` fechou o 23-B em **104 linhas**, teto "100, sem exceção" | dívida nomeada no diário daquele corte; vence aqui, e o canal deste corte a agravaria |

⚠️ **A contradição do `painel.md`, achada ao ler o documento inteiro.** § *O que mais o esboço presume* diz que a parte *"persiste o que foi **anexado**, não a resposta bruta — guardar tudo e filtrar na leitura permitiria remarcar depois"*. § *A linha na conversa* exige o oposto: o trecho recusado aparece riscado, *"sem ele, a seleção some da transcrição"*. A saída está na terceira linha do mesmo documento — o corpo da linha lista *"títulos e custo, nunca o código dos trechos"*. Ver D23C.3.

## Decisões

- **D23C.1 — a `DocsPart` é a sétima variante de `MessagePart`, fora de `AttachmentPart`.** Cumpre DM-23: entrar em `AttachmentPart` significaria renderizar como cartão de anexo, que é o que isto não é. Custa o schema, `docsPartOf`, o `case` em `partForProvider` — e o conserto do achado 1, que nenhuma decisão previa.
- **D23C.2 — a parte carrega `id` cunhado no renderer.** Endereça o desligar sem depender de índice de array, que muda se a mensagem ganhar outra parte. Segue a regra de identidade do app (D14.5): nenhum handler gera identidade nem carimba tempo.
- **D23C.3 — o recusado persiste como título e custo, nunca com o código.** Satisfaz as três afirmações do `painel.md` ao mesmo tempo, e **torna o congelamento estrutural**: sem o código do recusado no banco, remarcar é inexpressável em vez de proibido por disciplina de interface. Mesmo espírito de DE1B.1 (*estado inexpressável em vez de regra que dois lugares têm de lembrar*).
- **D23C.4 — `rules` persiste, e nunca se materializa.** DM-17 manda exibir o que o serviço tentou injetar; sem persistir, esse registro some ao reabrir o app e a promessa vira "mostramos enquanto a aba estiver aberta". O filtro que o mantém fora do provedor já existe — `partForProvider` simplesmente não o lê.
- **D23C.5 — os tipos do fio viram schemas zod.** `DocCodeBlock`/`DocSnippet`/`DocNote`/`DocRules` são `type` à mão hoje, e bastavam: resultado de canal não é validado (zod na entrada, nunca na saída). A parte atravessa `conversation:append`, que **é** validado — então nascem schema, com os tipos passando a `z.infer`, como toda outra variante.
- **D23C.6 — `conversation:setDocsEnabled`, não `docs:toggle`.** O canal nomeia a operação (D23B.2), e a operação é editar a transcrição, não consultar documentação. Assim `main/features/context7/` continua sendo só `fetch` injetado sem conhecer SQLite, e o domínio `docs` do `Api` mantém `Result` uniforme nos dois membros. **Sem `Result`**, como o resto de `conversation`: um `UPDATE` indexado em SQLite local não tem falha que a interface desenhe; id inexistente é descartado, como `appendMessage` já faz com conversa apagada.
- **D23C.7 — `json_set` com guarda `EXISTS`.** A guarda não é defesa de contrato — o descarte silencioso é o comportamento certo. Ela existe para **dar dentes ao teste**: sem ela `changes` mente (achado 6) e o nível 3 fica verde contra caminho sabotado.
- **D23C.8 — o preload se divide por papel, não por domínio.** `invoke.ts` (mecânica), `api.ts` (a tabela de canais), `index.ts` (composição). O que a régua quer proibir é **lógica** no pior sítio para testá-la, e nenhum dos três ganha ramificação. Divisão por domínio, espelhando `main/features/`, foi considerada e descartada: churn desproporcional a um arquivo sem lógica. ⚠️ A saída do bundle continua **um arquivo** — rollup inlina import local, e `externalizeDepsPlugin` nunca entra no bloco `preload`.
- **D23C.9 — o livro-razão de privacidade não conta a consulta neste corte.** `countAttachments` usa checagem positiva, então a variante nova fica de fora sozinha. Contar exigiria coluna nova em `observatory.db` — a única peça capaz de arrastar migração para um corte que hoje não toca banco de ninguém — e a decisão de produto é maior que um contador: o livro-razão também **não vê a pergunta enviada ao Context7**, que sai da máquina mesmo em conversa 100% local (DM-22). As duas vão juntas para o **23-K**. Fica uma linha de comentário no ponto da omissão.

## Passos — um commit cada

1. **O preload volta abaixo do teto.** `invoke.ts` + `api.ts` + `index.ts`. ⚠️ **Verificação ao vivo obrigatória antes de seguir** — preload quebrado deixa `window.api` indefinido e abre **janela vazia sem erro no terminal**; nenhum dos cinco níveis alcança isso.
2. **Os tipos do fio viram schema** (D23C.5).
3. **A sétima variante** — `docsPartSchema`, o recusado, `rules` (D23C.1/3/4).
4. **A parte de docs não é anexo** — conserto do achado 1, vermelho provado antes.
5. **A parte vira texto do provedor** — `docsPartOf`, o `case`, `formatDocsCard`.
6. **Desligar sem reescrever a transcrição** — o canal, o handler, o registro, os dois mocks de teste (D23C.6/7).
7. **Fechamento** — diário, errata ao guia, `23-K` na tabela de cortes, `DECISOES.md`, `HISTORY.md`, a pendência no `ROADMAP § 3`.

## Arquivos

| Arquivo | O quê |
|---|---|
| `src/preload/index.ts`, mais `invoke.ts` e `api.ts` | passo 1 |
| `src/shared/ipc.ts` | schemas do fio, `docsPartSchema`, união, `argsSchema`, `IpcContract`, `Api` |
| `src/core/ai/messages.ts` | `docsPartOf`, o `case`, o conserto de `attachmentPartOf` |
| `src/core/ai/docsCard.ts` | **novo**, molde de `documentCard.ts` |
| `src/main/features/conversation/handlers.ts` | `setDocsEnabled` |
| `src/main/ipc/register-all.ts` | registro |
| `test/api-mock.ts`, `test/store-api.ts` | o `satisfies Api` cobra os dois |
| `src/core/observatory/privacy.ts` | uma linha de comentário (D23C.9) |

## Verificação

- **Ao vivo, no passo 1, antes de qualquer outro:** `pnpm dev`, janela abre, `window.api` existe.
- **`pnpm check:fast`** ao fim de cada passo; contagem de arquivos/testes **remedida** no diário, nunca copiada do 23-B.
- **Três vermelhos a provar** (teste que passa com o defeito presente não provou nada): remover `!== 'docs'` de `attachmentPartOf`; remover a guarda `EXISTS`; cortar o `enabled` do `case` em `partForProvider`.
- **E2E de fronteira** por causa do passo 1: `e2e/dev/security-boundary.spec.ts` e `persistence.spec.ts` exercitam a existência de `window.api`.

## Fora do escopo

Painel, gatilho, contador no cabeçalho, linha na conversa, seleção e os textos de erro — 23-D em diante. `docsCount` no livro-razão e a pergunta enviada ao Context7 — **23-K**.

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 08/09/2026 | Plano escrito a partir do guia do arco 23; D23C.1–D23C.9 fixadas | Duas forquilhas resolvidas pelo dono antes de escrever: o canal no domínio `conversation` e a oitava skill adiada para depois do 23-J. **Três achados que nenhuma decisão previa:** o filtro negativo de `attachmentPartOf`, a contradição interna do `painel.md` sobre o que a parte persiste, e o `json_set` de caminho `NULL` que reporta `changes: 1` sem alterar nada |
| 08/09/2026 | Passo 1: preload dividido por papel; `index.ts` em 12 linhas | Bundle conferido no build, não suposto: **4 modules transformed, `out/preload/index.js` em 4,07 kB** — rollup inlina import local. Achado colateral: `security-boundary.spec.ts` estava **vermelho desde 27/08** (afirma a lista exata de domínios e parou em nove enquanto o `Api` chegava a dezenove). É a segunda vez que esse spec apodrece — nível 4 fica fora do `check:fast`, então nada avisa. Vermelho provado tirando o `exposeInMainWorld`: o app sobe igual, sem uma linha no terminal |
| 08/09/2026 | Passos 2–3: os tipos do fio viram schema, e a sétima variante nasce | Os quatro schemas tiveram de **subir** no arquivo: viraram dependência de `docsPartSchema`, e const referenciada antes da própria declaração é erro de execução. Os passos 3 e 5 do plano **fundiram-se** — o `switch` de `partForProvider` é exaustivo, então o `typecheck` recusa a união nova sem o `case`, e os dois não se separam em commits |
| 08/09/2026 | Passo 4: o filtro negativo de `attachmentPartOf` | Não precisei provocar o vermelho: o hook `test_related` recusou o commit do teste antes do conserto existir, devolvendo a parte de docs inteira onde se esperava `null` |
| 08/09/2026 | Passo 6: o canal, o handler e a divisão de `handlers.ts` | **A guarda `EXISTS` foi escrita e removida no mesmo passo, e quase ficou por um argumento falso.** Removê-la deixou os 30 testes verdes: `json_set` com caminho `NULL` devolve o documento intacto, e como o handler retorna `void` e nunca lê `changes`, ela não mudava nada observável. O vermelho que vale está na expressão de caminho — trocar `$.id` por `$.key` derruba exatamente as duas asserções que medem a troca. O `handlers.ts` foi de 123 para 169 linhas com o handler novo, acima do teto de 150, e dividiu pela linha que cada função endereça: conversa em `handlers.ts` (66), mensagem em `messages.ts` (114) |
| 08/09/2026 | Passo 7: fechamento | `check:fast` remedido: **152 arquivos / 1447 testes, 99,2s**. Canais recontados contra o `IpcContract`: **53**, e a skill `ipc` atualizada. Errata devolvida ao guia (três linhas, uma delas a contradição interna do `painel.md`), `23-K` registrado na tabela de cortes com a ressalva de que roda **antes** do `J` |
