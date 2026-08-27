# E-1-A — O rascunho existe: tabela própria, e o quarto ícone que o cria

> Primeiro plano da **trilha E** (exportação). Abre o arco `E-1-A..F`, cujo destino é exportar a saída do modelo em quatro formatos com o usuário decidindo **o quê**, **como** e **onde**. Este plano não exporta nada e não tem painel: entrega o dado e o gesto que o cria.

**Origem:** o `ROADMAP` previa E-1 como "motor de exportação de documento". O levantamento de 27/08 mostrou que metade do trabalho não é sobre formato nenhum — é sobre um objeto que ainda não existe. O usuário propôs o **painel de rascunho**: a saída do modelo vira material editável antes de virar arquivo. A frase que fixou o desenho foi dele: *"meus rascunhos não devem ser reinjetados para o contexto do modelo. São coisas separadas."*

**Entrega:** a tabela `drafts` (degrau v3), três canais `draft:*`, o quarto ícone no `TurnActions` que envia uma resposta para rascunho, e o contador no cabeçalho da conversa. Ao fim: criar rascunho, fechar o app, reabrir, e o contador continua lá.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| Rascunho como parte de mensagem custa **zero** migração | ✅ Verdade — `migrations.ts` diz com todas as letras: *"`parts` is JSON so the plano-16/17 MessagePart variants cost none"*. **E mesmo assim não é o caminho** — ver DE1A.1 |
| Uma parte nova é automaticamente excluída do que vai ao modelo | ⚠️ **Depende do caminho, e um dos dois não protege.** `partForProvider` é `switch` exaustivo sobre `part.kind`: uma variante nova **quebra o typecheck** até ser tratada. Já `attachmentPartOf` (`core/ai/messages.ts:42`) filtra **negativamente** (`!== 'text' && !== 'stepProposal'`) com um predicado `part is AttachmentPart` — que é **afirmação, não verificação**. Uma parte `draft` seria silenciosamente classificada como anexo, desenhada como cartão, contada em `attachmentPartsOf` e recolhida pelo `artifactsOf` |
| Uma mensagem só-rascunho seria inofensiva no envio | ⚠️ **Não.** `contentOf` junta as partes não vazias; se a única parte contribui `''`, a mensagem sai com `content: ''` e o provedor recebe um turno vazio |
| A escada de migração nunca subiu um degrau de verdade | **Subiu.** `migrations = [v1, v2]`, e o v2 é real (tabela `secrets`, N-1-A). O v3 é rotina, não estreia |
| `foreign_keys` precisa ser ligado | **Já está.** `open.ts` registra que o `node:sqlite` liga por padrão, ao contrário do SQLite cru — então uma FK aqui **age**, não decora |
| O `TurnActions` precisa ser reescrito para caber um ícone | **Não.** Já são exatamente três — `Copy` ligado, `Share2`/`RotateCcw` desabilitados com *"(em breve)"* sob a regra DS5.7. Um quarto **ligado** custa ~15 linhas |
| Mensagem pode ser editada | **Não existe caminho.** Só `append` e `removeMessage`; não há `UPDATE messages` em lugar nenhum do `main/`. Não é problema **deste** plano, e é o motivo de o E-1-C existir |

---

## Decisões

### DE1A.1 — O rascunho é **tabela própria**, não parte de mensagem

O esboço apresentado ao usuário recomendava `draftPart`, por custar zero migração. **A recomendação está revertida**, e a frase dele é a razão: *"são coisas separadas; o modelo só precisa ter ciência das coisas que acontecem no chat."*

Uma tabela própria é a codificação literal dessa frase. Comparadas:

| | Parte de mensagem | **Tabela `drafts`** |
|---|---|---|
| Migração | zero | **um degrau** (v3) |
| Vazar para o contexto do modelo | evitável — em três lugares que precisam concordar | **estruturalmente impossível**: `toChatMessages` lê `messages`, e a tabela não está lá |
| Editar | viola o *append-only* de mensagem | `UPDATE` comum |
| `attachmentPartOf` | classifica errado, em silêncio | não vê |
| Turno vazio no provedor | acontece | não existe |

O degrau custa ~8 linhas numa escada já testada. Ele compra a impossibilidade — não a disciplina — de um rascunho voltar ao modelo.

⚠️ **O teste de escopo continua satisfeito.** O `ESCOPO` recusa capacidade que precise de *"estado próprio, gerido fora da conversa"*. O rascunho **pertence a uma conversa**, morre com ela por `CASCADE`, e não tem galeria nem tela de gerência. Fosse uma lista de rascunhos vivendo fora das conversas, seria a 6ª revisão de escopo — não é.

```sql
CREATE TABLE drafts (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  source_message_id TEXT    NOT NULL,
  title             TEXT    NOT NULL,
  content           TEXT    NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE INDEX drafts_by_conversation ON drafts (conversation_id, created_at);
```

### DE1A.2 — `source_message_id` é **procedência**, não posse — e por isso não é chave estrangeira

Tentador declarar `REFERENCES messages(id) ON DELETE CASCADE`, por simetria com `conversation_id`. Estaria errado: apagar a mensagem que originou o rascunho levaria junto um texto que o usuário **editou e é dele**. Com `foreign_keys` ligado por padrão, essa FK agiria de verdade.

Fica `TEXT NOT NULL` sem FK. A coluna responde *"de onde isto veio"*, e um rascunho cuja mensagem de origem sumiu continua válido — só perde o caminho de volta.

### DE1A.3 — "Já rascunhei esta resposta?" é estado **derivado**, nunca um sinalizador

O usuário pediu: evitar cópias do mesmo rascunho, **mas** poder rascunhar de novo depois de apagar. As duas coisas caem de graça se a pergunta for uma consulta, não um campo:

```ts
drafts.some((draft) => draft.sourceMessageId === messageId)
```

Apagar o rascunho torna o predicado falso e o botão volta a criar — **sem nada a limpar em lugar nenhum**. Um campo `drafted` na mensagem exigiria desmarcá-lo na exclusão, que é o tipo de par que se esquece de um lado.

O botão tem então dois estados, no molde do `Copy` que vira `Check`:

| | |
|---|---|
| Sem rascunho desta resposta | `NotebookPen` — *"Enviar para rascunho"* |
| Já existe | `NotebookPen` marcado — *"Rascunho criado"*, e a partir do E-1-B **abre** o painel nele |

### DE1A.4 — O título nasce da primeira linha, e a regra mora em `core/`

O seletor do painel (E-1-B) precisa rotular cada rascunho, e "Rascunho 1, 2, 3" não distingue nada depois do terceiro. A primeira linha não vazia do conteúdo, sem marcação de cabeçalho e truncada, é o rótulo que o próprio texto já oferece.

`core/draft/title.ts` — puro, nível 1. Fica em `core/` e não ao lado do criador porque o E-1-C vai reintitular ao editar: uma cópia junto de um dos dois divergiria em silêncio, que é o argumento de fronteira do [`CLAUDE.md`](../../../CLAUDE.md#segurança) aplicado a rótulo em vez de segurança.

### DE1A.5 — `draft:*` **não** retorna `Result`

Pela régua da skill [`ipc`](../../../.claude/skills/ipc/SKILL.md): um `INSERT` indexado num SQLite local não tem falha que a interface precise distinguir, e é exatamente o precedente de todo o bloco `conversation:*`. Ausência vira dado — lista vazia —, e um `remove` endereçado a um id que já sumiu é descartado pelo `changes` do próprio `DELETE`.

Embrulhar tudo em `Result` treina o leitor a ignorar o `ok`.

### DE1A.6 — Identidade nasce no renderer

`id` e `createdAt` vêm de quem age (`crypto.randomUUID()`), como em D14.5: nenhum handler gera identidade nem carimba tempo. O efeito colateral que se paga é o que se quer — invalidação de cache previsível no TanStack Query.

### DE1A.7 — Este plano **não** tem painel, e isso é o corte, não um adiamento

Generalizar o envelope do painel antes de existir um segundo inquilino é ponto de extensão especulativo — OCP, que a skill [`architecture`](../../../.claude/skills/architecture/SKILL.md) descarta explicitamente. O E-1-B traz o inquilino e a generalização **juntos**, na mesma sessão em que a prova existe.

O que este plano entrega ao vivo é menor e é verdadeiro: o rascunho é criado, contado, e sobrevive a fechar o app.

---

## Passos

### Passo 1 — O degrau v3 e o contrato

`src/main/db/migrations.ts` ganha `v3` (append, nunca editar degrau publicado) e a escada vira `[v1, v2, v3]`.

`src/shared/ipc.ts` ganha o tipo `Draft` e três canais, nos seis lugares da skill `ipc`:

| Canal | Args | Result |
|---|---|---|
| `draft:list` | `{ conversationId }` | `Draft[]` |
| `draft:create` | `{ id, conversationId, sourceMessageId, title, content, createdAt }` | `void` |
| `draft:remove` | `{ id }` | `void` |

⚠️ **Todo canal de `IpcContract` precisa de entrada em `argsSchema`** — o `handle()` genérico faz `argsSchema[channel]` e um canal sem schema quebra no registro, não na chamada.

O sétimo lugar avisa sozinho: `test/api-mock.ts` é `satisfies Api` e para de compilar.

⚠️ **`draft:remove` nasce aqui mesmo sem ter botão**, e não é ponto de extensão especulativo: a **DE1A.3** afirma que "já rascunhei?" é derivado, e essa afirmação só se prova com o ciclo inteiro — criar, existir, apagar, criar de novo. Decisão que não pode ser exercitada no plano que a toma é decisão tomada por fé. O primeiro chamador na interface é do E-1-B.

**Teste:** o degrau, na escada de migração (nível 3, `:memory:` e um arquivo real) — cria a tabela, é idempotente ao reabrir, e o `CASCADE` leva os rascunhos junto com a conversa.

### Passo 2 — Os handlers e o título derivado

`src/main/features/draft/handlers.ts` — funções exportadas recebendo `DatabaseSync` por parâmetro, no molde de `conversation/handlers.ts`, com `rows.ts` para a conversão de linha.

`src/core/draft/title.ts` — primeira linha não vazia, sem `#` de cabeçalho, truncada com reticências. Puro.

**Teste:** nível 3 para os três handlers contra `:memory:` (criar, listar em ordem, remover, e a exclusão da conversa em cascata); nível 1 para o título — conteúdo vazio, só cabeçalho, linha longa, linhas em branco à frente.

### Passo 3 — O hook e o quarto ícone

`useDrafts(conversationId)` no molde dos hooks de conversa (TanStack Query, cache de servidor).

`TurnActions.tsx` ganha o quarto botão, `NotebookPen`, e uma prop a mais: hoje recebe só `text`, e precisa do **id da mensagem** para o rascunho saber de onde nasceu. O estado do botão é a consulta da DE1A.3 — nenhum campo novo.

**Teste:** nível 2 — cria a partir da resposta; o botão muda de rótulo quando já existe rascunho daquela mensagem; volta a criar depois de apagado.

⚠️ **Prova por sabotagem, obrigatória:** o teste do "volta a criar" tem de ser visto **vermelho** com o predicado fixado em `true`. Um teste que passa com o defeito presente não estava provando nada.

### Passo 4 — O contador no cabeçalho

`DraftCount`, irmão do `ArtifactCount` (39 linhas), ao lado dele no cabeçalho da conversa. Ícone próprio, contagem própria — anexos e rascunhos nunca somados no mesmo número.

Neste plano ele **conta e não abre** — o painel é do E-1-B. É o mesmo precedente meio-real do rodapé de paginação (DF3D.4): número verdadeiro, ação que ainda não existe.

**Teste:** nível 2 — some com zero rascunhos, aparece com a contagem certa, e não mistura com a contagem de anexos.

### Passo 5 — Prova ao vivo

`pnpm dev`, e cinco coisas conferidas na tela:

1. Pedir uma resposta ao modelo e clicar no quarto ícone
2. O contador de rascunhos sobe; o de anexos **não** se mexe
3. Fechar o app, reabrir, abrir a mesma conversa — o contador continua lá
4. Trocar de conversa — a contagem é da conversa, não global
5. Apagar a conversa — os rascunhos vão junto (`CASCADE`)

E a verificação que só o olho pega, porque o jsdom não aplica CSS: o quarto ícone não pode ler como os três vizinhos nem quebrar a linha da barra de ações.

---

## Fora deste plano

| Item | Onde vai |
|---|---|
| O painel, a região com dois inquilinos, `SidePanel`, `Tabs` promovido, `DraftPicker`, `Ctrl+D`, **e o botão de excluir** | **E-1-B** |
| Editar (textarea não controlada, aba Prévia, `draft:update`) | **E-1-C** |
| `showSaveDialog`, escrita atômica, `EBUSY`, `.md`/`.txt` | **E-1-D** |
| `.docx` · `.pdf` | **E-1-E** · **E-1-F** |
| O filtro negativo de `attachmentPartOf` | **fica como está** — sem parte `draft`, ele não erra hoje. Registrar no [`ROADMAP § 2`](../../ROADMAP.md) como armadilha latente, com o gatilho sendo a próxima variante de `MessagePart` |

⚠️ **O botão de excluir vai no rodapé do painel, à esquerda** — decidido aqui para o E-1-B não reabrir a pergunta. **Não** ao lado do ✕ no cabeçalho: destrutivo encostado em fechar é o clique errado clássico, e o cabeçalho é sobre identidade (qual rascunho), não sobre destino. O rodapé é a barra do *que acontece com isto* — exportar ou descartar são as duas ações terminais, e ficam em pontas opostas. Ele nasce no E-1-B com um ocupante e ganha o seletor de formato + `Exportar` no E-1-D. O gesto é o mesmo já escrito no `ArtifactSteps`: `Trash2` fantasma em `text-danger-text` abrindo o `Dialog` nativo, com `Cancelar`/`Excluir`.

⚠️ **`.xml` saiu do escopo em 27/08/2026**, por decisão do dono — nunca houve uso real, e escolher o que ele significaria custava mais que a saída valia. `.txt` tomou o lugar dele na tabela do [`ESCOPO`](../../ESCOPO.md), a recusa ficou registrada em `§ Fora do escopo`, e o `ROADMAP` foi alinhado. A trilha é **`E-1-A..F`**, com **quatro** formatos, não cinco.

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 1-4 | passos 1-4 concluídos; falta a prova ao vivo (passo 5) | O corte real ficou entre **dado** e **tela**, não onde o plano previa: o `store-api.ts` deriva o mock de nível 2 dos handlers reais, então os handlers tinham de entrar no passo 1 para o commit ficar verde — os passos 1 e 2 do plano viraram *degrau + contrato + handlers* e *título*. **Três defeitos achados por teste, nenhum por leitura:** `###` sem texto depois não era desmarcado; a linha de régua (`---`) sobrevivia e titularia metade dos rascunhos; e `queryByTitle(/rascunho/)` casava também com o botão do turno. **Duas provas por sabotagem**, uma por decisão: com a FK em `source_message_id` só o teste da DE1A.2 cai; com `hasDraftOf` fixado em `false`, só o da DE1A.3. **Uma instabilidade real:** o teste de nível 2 passava sozinho e caía na suíte inteira — três consultas encadeadas contra o teto de 1s do testing-library, com todo ambiente jsdom disputando os mesmos núcleos. Timeout explícito de 5s, duas passagens completas verdes. **Conserto de conservação de carona:** quatro asserções em `open.test.ts` fixavam a altura da escada e caíram no terceiro degrau; passaram a derivar de `migrations.length`, para o quarto não repetir o prejuízo. `check:fast`: 940 testes, 108 arquivos. |
| 27/08/2026 | — | plano escrito, ainda não executado | Recorte fechado com o usuário em duas rodadas de esboço. **A pesquisa mudou duas decisões antes de existir código:** a doc do React confirmou que contexto se divide por concern independente — e os dois painéis **não** são independentes (dividem a região), o que sustenta um dono só com dois hooks como costura, no precedente *"um hook público sobrevive à troca de fonte"*; e a leitura do `core/ai/messages.ts` reverteu a recomendação de `draftPart` (DE1A.1), ao mostrar que um dos dois caminhos até o modelo filtra **negativamente** e não protegeria. Achados no código: `partForProvider` é exaustivo e quebraria o typecheck (protege), `attachmentPartOf` afirma em vez de verificar (não protege), mensagem só-rascunho geraria turno vazio no provedor, e `foreign_keys` já vem ligado no `node:sqlite`. **Duas mudanças do usuário depois de o plano existir:** `.xml` saiu do escopo (registrado no [`ESCOPO`](../../ESCOPO.md) § Fora do escopo e alinhado no [`ROADMAP`](../../ROADMAP.md) — a trilha encolheu de sete planos para seis), e o rascunho ganha exclusão no painel, cujo lugar ficou decidido aqui para o E-1-B não reabrir. |
