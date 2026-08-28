# E-2-B — Cada linguagem no seu dialeto: o destaque e a extensão

O E-2-A deixou o código **correto e sem cor**: as duas abas mostram texto puro, porque colorir errado é pior que não colorir (DE2A.9). Este corte substitui esse "sem gramática" pela gramática certa, e faz o arquivo exportado sair com a extensão que a linguagem pede.

Fecha a trilha E-2.

---

## O que já foi medido, antes de virar plano

Sondado nesta sessão contra os pacotes reais, não suposto:

**1. O destaque é barato, e o caro já está no bundle.** Custo marginal sobre `@codemirror/language`, que o editor já carrega:

| | marginal |
|---|---|
| `lang-markdown` — o que o editor **já** carrega | +232.877 B |
| `python` só | +6.469 B |
| `clike` só (c, c++, java, c#, kotlin, scala…) | +22.288 B |
| **os 14 arquivos de modo, ~25 linguagens** | **+117.854 B** |

Destacar 25 linguagens custa **metade** do que o markdown já custa. E o bundle inteiro do app é 3,5 MB dentro de um `win-unpacked` de 457 MB — não é questão de peso de instalação em nenhuma escala que este plano alcance.

**2. Um motor serve as duas abas.** `highlightCode` existe em `@lezer/highlight`, que **já é dependência declarada** (`^1.2.3`). Rodado contra 13 linguagens:

```
python     | tok-comment tok-definition tok-keyword tok-string tok-variableName
sql        | tok-comment tok-keyword tok-operator tok-string
typescript | tok-comment tok-definition tok-keyword tok-operator tok-string tok-typeName tok-variableName
```

As 13 passaram. O vocabulário inteiro são **10 classes**: `atom`, `comment`, `definition`, `keyword`, `meta`, `number`, `operator`, `string`, `typeName`, `variableName`.

**3. `syntaxHighlighting` aceita qualquer `Highlighter`** — não só um `HighlightStyle`. Confirmado na assinatura do pacote: `syntaxHighlighting(highlighter: Highlighter, options?)`.

**4. O `guard` varre `base.css`.** Linha 33 do `guard.mjs`: cor literal é bloqueada em `*.module.css`, na camada de tema do Tailwind **e em `base.css`** desde a DS-6. É o que permite o CSS global deste plano nascer verificado.

**5. `sql` exporta uma fábrica, não um modo.** `import { sql }` devolve uma função; o modo é `standardSQL`. Descoberto quebrando na sonda (`TypeError: token is not a function`) — a tabela de modos precisa nomear o **export exato**, não o nome do arquivo.

## Decisões

### DE2B.1 — Um `Highlighter` só, duas renderizações

A tentação é definir um `HighlightStyle` para o editor e um mapa de classes para a prévia. Seriam duas listas para divergir em silêncio — e a divergência de cor entre as abas é **literalmente o defeito que o dono relatou** no E-2-A.

O mesmo objeto serve os dois lados:

```
                      classHighlighter  (@lezer/highlight)
                               │
        ┌──────────────────────┴──────────────────────┐
   editor                                         prévia
   syntaxHighlighting(classHighlighter)           highlightCode(code, tree, classHighlighter, …)
        └──────────────────────┬──────────────────────┘
                       as MESMAS classes .tok-*
                        um bloco de CSS, uma vez
```

É o mesmo padrão do `Block[]` da trilha E-1 — uma fonte, vários renderizadores —, e aqui ele é ainda mais barato porque a fonte já vem pronta do pacote.

O CSS das 10 classes vai para `base.css`: precisa ser global (alcança o DOM que o CodeMirror monta **e** o `<pre>` da prévia), e é justamente ali que o `guard` já checa cor literal e token desconhecido.

### DE2B.2 — `legacy-modes`, não os `lang-*` oficiais

Não existe um `lang-any`: cada linguagem oficial é um pacote com parser Lezer completo. `@codemirror/legacy-modes` traz **103 arquivos de modo** com tokenizador de fluxo, importáveis um a um (`@codemirror/legacy-modes/mode/<nome>`), e um arquivo cobre várias linguagens — `clike.js` exporta 14 símbolos, `javascript.js` exporta 4 incluindo **typescript** e **json**, `sql.js` exporta 14 dialetos.

Contrapartida assumida: tokenizador de fluxo erra mais que um parser real em código muito aninhado. Para um trecho colado de uma resposta, é troca boa — e a alternativa custa o dobro por uma fração das linguagens.

Sem carregamento dinâmico: 118 kB estáticos num app que lê do disco local não pagam a complexidade.

### DE2B.3 — A cerca é texto livre, então a tabela normaliza e mapeia numa etapa

O que vem da cerca (` ```python `) é escrito pelo modelo, não por um esquema: `py`, `python`, `python3`, `Python`, `postgres`. A tabela mora em `core/` (pura, testável) e resolve **alias → (modo, extensão)** numa etapa só. Duas tabelas encadeadas seriam duas coisas para envelhecer.

Derivada do [Linguist](https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml) — o padrão de fato — mas **escrita à mão**, cobrindo o que este app vê. Sem dependência: 700 linguagens para usar ~25 não passa na régua.

⚠️ **Os `aliases` do highlight.js não servem, e isso foi medido:** `sql` não tem alias nenhum, `cpp` traz `c++` e `h++`, `csharp` traz `c#` — nenhum deles é nome de arquivo. Além disso `highlight.js` e `lowlight` não são alcançáveis da raiz (`MODULE_NOT_FOUND`), então usá-los seria dependência fantasma.

⚠️ **Nem toda linguagem tem extensão.** `dockerfile` é um **nome de arquivo** — o Linguist o modela com o campo `filenames`, separado de `extensions`. A tabela precisa da mesma distinção.

### DE2B.4 — Cerca sem linguagem continua sem gramática e sai `.txt`

Uma cerca que não nomeia linguagem é caso normal (D11.5), e a decisão do E-2-A vale igual aqui: sem linguagem conhecida, **nenhuma gramática**. Detecção automática fica fora pelo mesmo motivo que o `rehype-highlight` já roda com `detect: false` (D12.5) — ela chuta mal em trecho curto, e um chute errado é o defeito que o E-2-A acabou de consertar.

### DE2B.5 — Rascunho de código exporta **verbatim**, e o seletor de formato vira rótulo

Este é o ponto onde o plano quase reintroduz a DE2A.9. Hoje o handler faz:

```ts
if (format === 'txt') return toPlainText(text)   // parseia markdown!
if (format === 'docx') return toDocx(text)       // idem
if (format === 'pdf') return printPdf(toHtml(text))
```

Os três passam por `toBlocks(markdown)`. Rodar código por ali **destrói código** — exatamente o que a DE2A.9 registrou, agora do lado da saída.

Então código não escolhe formato: sai **verbatim**, com a extensão da linguagem (`.py`, `.sql`, …) ou `.txt` quando não há linguagem. E o `FormatPicker`, com uma opção só, deixa de ser controle e vira rótulo — a mesma regra que o `DraftPicker` já aplica a um rascunho só:

> *"One draft is not a choice, so it is not a control either — not even a disabled one: an empty box with a chevron promises a list that is not there."*

Descartado: oferecer `.docx`/`.pdf` de código. Não é conservadorismo — é que o caminho deles **é** o que mutila.

### DE2B.6 — Numeração, rolagem lateral e linha do cursor: a premissa da DE1C.3 mudou

Pedido do dono depois da prova ao vivo do passo 5. A DE1C.3 mantinha gutter fora com esta razão:

> *"line numbers, gutters, folding, search and autocompletion belong to a **code editor**, and this is a field of **prose**"*

Ela **não é revogada** — a premissa dela deixou de valer para metade dos rascunhos. Prosa continua sem nada disso; código ganha os três, pelo mesmo `kind` que já decide gramática e exportação.

Medido: **+8.304 B**, e nenhuma dependência nova — `lineNumbers`, `highlightActiveLine` e `highlightActiveLineGutter` vêm do `@codemirror/view`, que o editor já usa. É 3% do que as gramáticas custaram.

**A quebra de linha sai junto, e não é detalhe:** com `lineWrapping`, uma linha longa ocupa três alturas e carrega **um** número — a numeração fica ilegível justamente onde ela mais serve. Código rola na horizontal, como em qualquer editor de código; prosa continua quebrando.

⚠️ **Ordem de registro é carga.** `codeGutters` tem de vir **depois** de `editorTheme`, porque sobrescreve o `.cm-activeLine: transparent` que ele define. Trocar a ordem apaga o realce da linha do cursor sem erro nenhum.

## O layout

```
src/core/draft/languages.ts        alias → { mode, extension | filename }; puro, testável
src/renderer/src/features/draft/
  codeHighlight.ts                 modo por linguagem + classHighlighter
  editorTheme.ts                   syntaxHighlighting(classHighlighter) junto do markdown
  DraftEditor.tsx                  a gramática entra onde o E-2-A deixou o vazio
  DraftPanel.tsx                   a prévia passa por highlightCode
  DraftFooter.tsx                  extensão verbatim para código
  FormatPicker.tsx                 rótulo quando não há escolha
src/renderer/src/assets/base.css   as 10 classes .tok-*, em token semântico
```

## Passos

### Passo 1 — A tabela de linguagens, em `core/`

Alias → modo → extensão, com o caso `filename` (dockerfile) e o caso sem linguagem. Nível 1, e o teste inclui os aliases que o modelo de fato escreve (`py`, `ts`, `postgres`).

### Passo 2 — O `Highlighter` e as 10 classes

`classHighlighter` ligado no `editorTheme`, CSS em `base.css`. Prova por provocação: o `guard` recusa um `#hex` ali.

### Passo 3 — O editor ganha a gramática

Substitui o `[]` que o E-2-A deixou. ⚠️ **Não testável em jsdom** — mesma razão da DE2A.9; a prova é ao vivo.

### Passo 4 — A prévia ganha a mesma gramática

`highlightCode` sobre o `<pre>`. **Testável**, e o teste que importa é o par: mesmo texto, mesmas classes nas duas abas.

### Passo 5 — A exportação verbatim

`ExportFormat` ganha o membro verbatim, `FormatPicker` vira rótulo para código, `exportFileName` usa a extensão da tabela. Teste: um `.py` exportado é **byte a byte** o que o editor tinha.

### Passo 6 — Numeração, sem quebra, linha do cursor

`lineNumbers()` + `highlightActiveLine()` + `highlightActiveLineGutter()` e o `codeTheme`, só para `kind === 'code'`; `lineWrapping` passa a ser exclusivo da prosa. Testado pelos dois lados da régua: código numera, prosa não.

### Passo 7 — Prova ao vivo

Do dono. Um trecho de cada: `python`, `sql`, `typescript`, um sem linguagem. Conferir que as cores do editor e da prévia são **as mesmas**, e que o arquivo salvo abre íntegro.

## Fora deste plano

- **Detecção automática de linguagem** — DE2B.4.
- **Linguagem editável no rascunho** (trocar `python` por `sql` depois de criado). O dado suporta; nenhum caminho de UI é aberto aqui.
- **`.pptx`** — é o [E-3](../../ROADMAP.md), depois do gráfico.
- **Numeração de linha, dobra, busca no editor** — continuam fora pela DE1C.3: é um campo de edição, não uma IDE.

## Diário de execução

| Sessão | O que foi feito | Observação que sobrevive ao plano |
|---|---|---|
| 28/08/2026 | Passos 1–5, um commit cada. Tabela de linguagens em `core/`, `classHighlighter` nas duas abas, gramática no editor, `CodePreview`, exportação verbatim. 116 arquivos / 1128 testes, `pnpm build` verde. Falta o passo 6, do dono | **A estimativa de bundle do plano estava subestimada em ~2,2×.** O plano prometia **+117,9 kB**; o build real cresceu **+261,75 kB** (3.025,32 → 3.287,07 kB). Remedindo com os imports reais, os 27 modos custam **149.936 B** — a estimativa usava 14 arquivos de modo, a implementação usa 17. Os ~112 kB restantes **não foram atribuídos**, e fica dito em vez de arredondado. O veredito não muda (o app empacotado é 457 MB), mas **o número a citar é 261,75 kB, medido no build, não os 117,9 kB da sonda** |
| | | **O React Compiler é erro, não aviso, e encadeamento opcional estreitado dentro de um `useMemo` o quebra.** `current?.kind === 'code'` seguido de `current.content` produziu *"Compilation Skipped: Existing memoization could not be preserved"* — que o `pnpm lint` conta como **erro**. Içar para locais (`const kind = current?.kind ?? …`) resolve |
| | | **Sob jsdom o CodeMirror emite as classes de destaque** (`tok-*`), ainda que não aplique cor. O plano afirmava que o editor não era testável; vale para a cor, **não** para as classes — e é o que torna o par editor/prévia verificável |
| | | **Nomear um tipo de `@lezer/common` seria dependência fantasma.** `highlightCode` precisa de um `Tree`, mas o pacote não é declarado; o módulo devolve `{ text, classes }` e os tipos do lezer não saem dele. Efeito colateral: virou função pura, testável sem DOM |
