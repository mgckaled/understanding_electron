# E-2-A — O rascunho aceita código: o dado e o caminho

Um bloco de código da resposta do modelo vira um rascunho, pelo botão no cabeçalho do próprio bloco — ao lado do "copiar" que já está lá. Ele abre no painel de rascunho que já existe, editável, e sai pelo caminho de exportação que o E-1 já construiu.

**Não nasce um terceiro inquilino de painel.** Este é o corte 1 de 2: aqui entra o dado (`kind`, `language`), o caminho (o botão) e a distinção no seletor. O dialeto — destaque de sintaxe no editor e extensão certa na exportação — é o [E-2-B](#fora-deste-plano).

---

## A bifurcação, resolvida pelo dono do projeto

O desenho passou por três formas em uma sessão, e a terceira é a que vale.

1. **Terceiro inquilino** — `PanelKind` ganharia `'snippet'`, com contador próprio no cabeçalho, atalho próprio e tabela própria. Recusado.
2. **Inquilino na interface, um dono no dado** — proposto por mim como meio-termo. Também recusado, e por um motivo melhor do que o meu.
3. **Código é um rascunho de outro dialeto** — proposta do dono do projeto, adotada. O painel, a tabela, o editor e a exportação são os mesmos; o que muda é o dialeto do conteúdo, e a distinção viaja **no item**, não no painel.

O argumento que decidiu: nos quatro eixos que separam os dois inquilinos existentes — origem, persistência, edição e exportação — um trecho de código cai inteiro do lado do rascunho. A única diferença real é markdown contra uma linguagem de programação.

| | Artefato | Rascunho | Trecho de código |
|---|---|---|---|
| Nasce de | anexo (arquivo) | resposta do modelo | resposta do modelo |
| Persiste | recomputado de `messages` | tabela `drafts` | precisa |
| Edita | não | CodeMirror | sim |
| Exporta | não, só copia | quatro formatos | sim |

E a persistência deixou de ser pergunta por consequência, não por preferência: com o trecho sendo um rascunho, ele entra na tabela que já persiste.

## O que foi checado antes de virar plano

Medido nesta sessão, não suposto:

- **O destaque de sintaxe é barato, e a preocupação estava invertida.** Custo marginal sobre `@codemirror/language`, que o editor já carrega: `lang-markdown` — o que ele carrega **hoje** — pesa **+232.877 B**; os 14 arquivos de `@codemirror/legacy-modes` que cobrem ~25 linguagens pesam **+117.854 B**. Destacar código custa metade do que destacar markdown já custa. Números do E-2-B, levantados aqui porque decidiam se havia um E-2-B.
- **`out/` inteiro é 3,5 MB dentro de um `win-unpacked` de 457 MB** — o bundle não é uma questão de peso de instalação em nenhuma escala que este plano alcance.
- **Os `aliases` do highlight.js não servem como extensão de arquivo.** `sql` não tem alias nenhum, `cpp` traz `c++` e `h++`, `csharp` traz `c#`. Além disso `highlight.js` e `lowlight` **não são alcançáveis da raiz** (`MODULE_NOT_FOUND`) — chegam só via `rehype-highlight`, e usá-los direto seria dependência fantasma, o caso do `@types/hast`.
- **`hasDraftOf` passa a mentir com este plano** (`useDrafts.ts:85`) — ver DE2A.3.
- **`draftTitle` estraga código** (`core/draft/title.ts`) — ver DE2A.4.
- **`components` é constante de módulo** em `MarkdownMessage.tsx:97`, e o componente tem **quatro** consumidores — ver DE2A.6.

## Decisões

### DE2A.1 — Código é um rascunho, e a distinção viaja no item

Sem `PanelKind` novo, sem terceiro contador, sem atalho novo. `Ctrl+D` continua sendo o único acesso ao painel, e a lista mistura os dois tipos por desenho.

O que impede a confusão é o **chip de linguagem** na linha do seletor (DE2A.5) — a mesma linguagem visual que o cabeçalho do bloco de código já usa na conversa, reaproveitada em vez de inventada.

O que isso compra: as ~444 linhas de `DraftPanel`, `DraftPicker`, `DraftFooter`, `DraftCount` e `DraftEditor` servem os dois tipos sem duplicação. Um segundo conjunto divergiria em silêncio — é a dívida de fonte única, na versão TSX.

### DE2A.2 — `kind` e `language` são duas colunas, não uma

A economia tentadora seria `language TEXT NULL`, com `NULL` significando markdown. Não funciona: uma cerca sem linguagem (` ``` ` puro) é caso normal e já tratado — *"absent → no label, still correct (D11.5)"*. Esse trecho teria `language = NULL` e ficaria indistinguível de prosa.

```sql
kind      TEXT NOT NULL DEFAULT 'markdown'   -- 'markdown' | 'code'
language  TEXT                               -- NULL sempre que kind='markdown',
                                             -- e também quando a cerca não disse
```

Migração **v4, aditiva**: `ALTER TABLE ... ADD COLUMN` com default, então toda linha existente vira `markdown` sem passo de dados. A escada por `PRAGMA user_version` já cobre o resto.

### DE2A.3 — `hasDraftOf` filtra por `kind`, ou o botão do turno mente

Este é um defeito que **este plano cria** e precisa fechar no mesmo passo:

```ts
// useDrafts.ts:85 — hoje
const hasDraftOf = (messageId) => drafts.some((d) => d.sourceMessageId === messageId)
```

`TurnActions.tsx:26` usa isso para o estado do botão "criar rascunho" da **resposta inteira**. Enviar um bloco de código dessa resposta cria um rascunho com o **mesmo** `sourceMessageId` — e o botão do turno passa a exibir "já rascunhado" sem que ninguém tenha rascunhado a resposta.

O conserto é filtrar por `kind === 'markdown'`. O que importa registrar é por que ele é invisível: hoje é impossível uma mensagem ter dois rascunhos, então **nenhum teste atual falha**. Este plano torna N rascunhos por mensagem o caso comum — três blocos de código numa resposta são três rascunhos irmãos.

### DE2A.4 — O título de código não passa pelo `strip` da prosa

`draftTitle` foi escrito para prosa: `strip()` remove `#`, `>`, `-` iniciais e apaga `*`, `_` e crases. Em código esses caracteres são significativos, e o resultado engana:

| Primeira linha | Título hoje |
|---|---|
| `# -*- coding: utf-8 -*-` | `- coding: utf-8 -` |
| `import * as fs from 'fs'` | `import  as fs from 'fs'` |

Para `kind='code'`, o título é a primeira linha não-vazia **sem** `strip`, com o mesmo corte de 60 caracteres. A ramificação fica em `core/draft/title.ts`, que já é o dono declarado do título — não ao lado de um dos dois chamadores, pelo motivo que a própria docstring dele registra.

### DE2A.5 — O seletor distingue por chip, e o contador não se divide

Uma linha de código no seletor mostra o chip com a linguagem (`python`), ou nada quando a cerca não disse. O contador do cabeçalho conta os dois tipos juntos — é o número de rascunhos da conversa, e continua sendo.

### DE2A.6 — O botão chega ao `CodeBlock` por prop, e `components` deixa de ser constante

`MarkdownMessage` vive em `shared/ui/`, que **não importa de `features/`** — regra de camada verificada por ESLint. Então o `CodeBlock` não chama `useDraft()`: recebe um callback.

E há uma restrição que só apareceu ao ler o arquivo: `components` é uma constante de módulo (`MarkdownMessage.tsx:97`), o que hoje é correto porque nada nela depende de prop. Com o callback, ela passa a ser derivada por `useMemo` sobre a prop nova.

O detalhe que decide a assinatura: **`MarkdownMessage` tem quatro consumidores**, e o botão só faz sentido em um.

| Consumidor | Botão? |
|---|---|
| `MessageList.tsx:52` — resposta do assistente | **sim** |
| `ConversationView.tsx:241` — resposta em streaming | não — o bloco ainda está crescendo |
| `DraftPanel.tsx:46` — prévia do próprio rascunho | não — enviaria um rascunho para si mesmo |
| `ArtifactBody.tsx:49` — documento no painel | não |

Logo a prop é **opcional**, e ausente significa "sem botão". Três dos quatro chamadores não mudam uma linha.

### DE2A.7 — O canal não nasce novo; `draft:create` ganha dois campos

`draft:create` já existe e já recebe o rascunho montado no renderer, com identidade e tempo cunhados lá (DE1A.6/D14.5). Ele ganha `kind` e `language` no schema zod; nenhum canal novo, nenhum handler novo. O contrato IPC continua com os mesmos canais.

## O layout

```
src/main/db/migrations.ts              v4: ALTER TABLE drafts (kind, language)
src/shared/ipc.ts                      Draft ganha kind/language; draft:create idem
src/main/features/draft/handlers.ts    create/list carregam os dois campos
src/core/draft/title.ts                titleOf ramifica por kind
src/renderer/src/shared/ui/MarkdownMessage/
  MarkdownMessage.tsx                  prop opcional; components por useMemo
  CodeBlock                            segundo botão no cabeçalho
src/renderer/src/features/conversation/MessageList.tsx   liga o callback
src/renderer/src/features/draft/
  useDrafts.ts                         hasDraftOf filtra por kind; create recebe kind/language
  DraftPicker.tsx                      chip de linguagem
```

## Passos

### Passo 1 — A migração v4 e o tipo

`ALTER TABLE` com default, `Draft` ganha os dois campos, `draft:create` ganha os dois no schema, handlers carregam. Teste de migração: linha antiga lê como `markdown`.

### Passo 2 — O título ramifica

`core/draft/title.ts` por `kind`. Nível 1, e o teste vermelho primeiro: os dois exemplos da DE2A.4 são os casos.

### Passo 3 — `hasDraftOf` para de mentir

Filtra por `kind`. **Ver falhar antes**: escrever o teste que cria um rascunho de código e afirma que o botão do turno segue disponível — ele falha contra o código atual, que é o ponto.

### Passo 4 — O botão no `CodeBlock`

Prop opcional, `components` por `useMemo`, `MessageList` liga. Os outros três consumidores ficam intactos — e isso é uma asserção, não uma expectativa.

### Passo 5 — O chip no seletor

`DraftPicker` mostra a linguagem quando há.

### Passo 6 — Prova ao vivo

O usuário roda. Pedir ao modelo uma resposta com dois blocos de código de linguagens diferentes mais prosa; enviar os dois; conferir: o botão do turno continua disponível, os títulos não estão mutilados, os chips aparecem, a exportação sai (`.txt` — a extensão certa é o E-2-B), e reabrir o app mantém tudo.

## Fora deste plano

- **O dialeto — E-2-B.** Destaque de sintaxe no editor (`@codemirror/legacy-modes`, medido acima) e a tabela alias→extensão para a exportação, derivada do [Linguist](https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml) e escrita à mão em `core/`. Inclui os dois casos que a versão ingênua erra: cerca sem linguagem (sai `.txt`) e `dockerfile`, que é um **nome de arquivo**, não uma extensão.
- **`FormatPicker` condicional.** `.docx` de um `.py` não faz sentido, mas o conjunto só muda quando a extensão existir — E-2-B.
- **Editar o `.pptx`.** A sigla E-2 era dele; virou **E-3** nesta sessão ([`ROADMAP § 1`](../../ROADMAP.md)), sem custo, porque não tinha arquivo nem citação em código.
- **Qualquer coisa no painel de artefato.** Ele não é tocado por este plano.

## Diário de execução

| Sessão | O que foi feito | Observação que sobrevive ao plano |
|---|---|---|
| 28/08/2026 | Passos 1–5, um commit cada. Migração v4 (`kind`/`language`), título ramificado, `hasDraftOf` filtrado, botão no `CodeBlock`, chip no seletor. 1067 testes / 113 arquivos, `pnpm build` verde. Falta só o passo 6, que é do dono | **Escrita por script não passa pelos hooks** — nem `format_fix`, nem `guard`, nem `test_related`. Editar por `node`/`sed` em vez de Edit/Write exige rodar o Prettier à mão depois, e o `guard` deixa de checar as 11 invariantes. Efeito colateral medido: os arquivos do repositório têm finais de linha **mistos** na árvore de trabalho (CRLF em uns, LF em outros), e o script tem de detectar e preservar, senão o diff incha. Subiu para o ARMADILHAS |
| | | **Um teste meu nasceu vacuoso e só a provocação pegou.** Afirmava que a prévia do painel não ganha o botão de código; passava, e continuou passando com a condição sabotada — porque rascunho de código guarda o bloco **sem cerca**, então a prévia não renderiza `CodeBlock` nenhum. O caso que prova é o rascunho de **prosa** (esse sim contém a cerca), ancorado no botão irmão `Copiar código`; ancorar no texto do código acerta o editor que o `keepMounted` deixa montado atrás da aba (DE1C.4) |
| | | **A régua do primitivo é o segundo CHAMADOR, não o terceiro uso.** `LanguageChip` tem três usos, todos dentro do `DraftPicker` — fica local. Registrado porque a tentação de promover para `shared/ui/` vem da contagem de usos, e a skill `design-system` mede outra coisa |
