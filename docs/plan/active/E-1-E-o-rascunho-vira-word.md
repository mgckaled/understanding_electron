# E-1-E — O `.docx`: um emissor próprio sobre o mdast que o app já monta

> Quinto plano da trilha E, depois do [E-1-A](../implemented/E-1-A-o-rascunho-existe.md), [E-1-B](../implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md), [E-1-C](../implemented/E-1-C-o-rascunho-se-edita.md) e [E-1-D](../implemented/E-1-D-o-caminho-de-saida.md). O caminho de saída existe e entrega `.md` e `.txt` — este plano acrescenta o **terceiro** formato, o primeiro que sai em bytes.

**Origem:** o `FormatPicker` mostra `.docx` desabilitado desde o E-1-D, com "Em breve" no `title`. É o item mais barato da trilha justamente porque o E-1-D pagou o caminho inteiro: `writeAtomic` já aceita `Uint8Array`, `exportFileName` já produz `Vendas.docx`, `FILTERS.docx` já existe, e o `remark` já está embutido no bundle do `main`.

**Entrega:** uma dependência (`docx`), um emissor `mdast → .docx` escrito à mão, o parse de markdown virando fonte única com GFM — o que **conserta o `.txt` de tabela de brinde** — e `.docx` habilitado no seletor. **Nenhum canal novo, nenhuma mudança no rodapé, nenhuma linha no renderer além de apagar `soon: true`.**

---

## O que foi checado antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| Um conversor pronto (`mdast2docx`, `@m2d/remark-docx`, `md-to-docx`) poupa trabalho | **Poupa o emissor e cobra a árvore.** Todos são ESM-only e todos trazem o **próprio** `unified` + `remark`, duplicando o que o `toPlainText` já usa. O que eles fazem por cima do `docx` é mapear ~12 nós do mdast — e o `remark` já embutido me dá o mdast por `.parse()`, de graça. Ver DE1E.1 |
| `docx` publica CJS, então externaliza normal | ⚠️ **Provável, e não verificável por leitura.** O build é Vite com saídas UMD/ES/CJS/IIFE — mas ele depende de **`nanoid@5`, que é ESM puro**. É a forma exata da DE1D.9. E a sonda errada já custou um app que não abria: **decide-se por `check:bundle`, não por `package.json`.** Ver DE1E.3 |
| Lista com marcador e lista numerada custam o mesmo | **Não.** `bullet: { level }` funciona direto no `Paragraph`; **lista numerada exige um `numbering.config` declarado no `Document`**, com `reference`, `levels[]`, `LevelFormat` e recuo em *twips* por nível. Confirmado na doc do `docx`. E os níveis são **declarados de antemão** — markdown aninha sem limite, `docx` não. Ver DE1E.4 |
| O `.txt` e a **Prévia** mostram a mesma coisa | ⚠️ **Não mostram, e isso já está no app hoje.** A `MarkdownMessage` usa `remark-gfm`; o `toPlainText` **não**. Uma tabela aparece formatada na Prévia e sai como pipes literais no `.txt`. O `.docx` herdaria o mesmo desencontro se parseasse sem GFM. Ver DE1E.2 |
| `render()` continua devolvendo `string` | **Não pode.** `Packer.toBuffer` é assíncrono e devolve bytes. `render` vira `Promise<string \| Uint8Array>` — que é o tipo que `writeAtomic` **já aceita** desde o E-1-D. Uma linha de costura, não um refactor |
| O emissor se testa contra o arquivo produzido | ⚠️ **Não sem um leitor de ZIP.** O `.docx` é um ZIP, o Node 24 não traz leitor, e o `jszip` só existe aqui como dependência **transitiva** do `docx` — usá-lo seria dependência fantasma, e com `shamefullyHoist: false` nem resolveria. A saída é separar a decisão da serialização. Ver DE1E.6 |
| Uma imagem no markdown vira imagem no Word | **Não neste plano.** O rascunho é texto; não há resolução de anexo do lado do `core/`, e um `![alt](attachment://hash)` não tem bytes para embutir. Ver DE1E.7 |

---

## Decisões

### DE1E.1 — `docx` cru + emissor próprio, não conversor pronto

**Uma** dependência (`docx`, de `dolanmiu`), e o mapeamento `mdast → docx` escrito neste repositório.

O critério não é peso — é **duplicação**. Todo conversor pronto empilha o próprio `unified`/`remark` sobre o `docx`, e o `remark` já está aqui, embutido no bundle do `main` desde o E-1-D. O que o conversor entrega além disso é a tradução de uma dúzia de nós conhecidos, que cabe em ~150 linhas de código que eu leio, testo e conserto.

**Descartados, com o motivo:** `mdast2docx`/`@m2d/*` (árvore de plugins, ESM-only, própria cópia do unified) · `md-to-docx` (mesma duplicação, mais opinativo no estilo) · `markdown-docx` (foco em LaTeX/equações, que este app não tem).

⚠️ **A dependência entra pela régua da skill `architecture`:** justificativa registrada aqui, alternativas nomeadas acima.

### DE1E.2 — O parse de markdown vira fonte única, e GFM sozinho **não** bastava

Nasce `src/core/export/markdown.ts` (o `toPlainText.ts` renomeado, por `git mv`), dono de **um** dialeto — `remark` + `remark-gfm` — servindo os dois consumidores: `toPlainText` e o emissor do `.docx`.

O motivo declarado era o desencontro entre a **Prévia** (que já renderiza GFM) e o `.txt` (que não). Sem isto o `.docx` nasceria com o mesmo defeito e o app teria **três** interpretações do mesmo texto.

⚠️ **Só que ligar GFM, sozinho, teria piorado o `.txt`.** Medido antes de escrever: com `remark-gfm` no caminho, o `strip-markdown` **apaga a tabela inteira** — "Mês", "Vendas", "120", tudo some. Sem GFM os pipes ao menos sobreviviam. Trocar "feio porém completo" por "limpo porém sem o dado" seria regressão, não conserto.

**E a investigação achou um segundo defeito, este já em produção há um plano inteiro:** o `.txt` de hoje **apaga blocos de código**. `'Antes.\n\n```js\nconst a = 1\n```\n\nDepois.'` sai como `'Antes.\n\nDepois.'`. Está no fonte do `strip-markdown`, declarado: `code: empty`, `table: empty`, junto de `html`, `thematicBreak`, `toml` e `yaml`. A prova ao vivo do E-1-D não pegou porque conferia o que **sai** (`#`, `**`, `-`), nunca o que **sobrevive**.

**O conserto usa o mecanismo que o próprio `strip-markdown` documenta** — tuplas de substituição em `remove` —, não um plugin próprio: `code` vira parágrafo com o fonte preservado, `table` vira um parágrafo por linha com as células separadas por tabulação. A recursão do `strip` processa o que o handler devolve, então ênfase dentro de célula continua sendo despida.

⚠️ **`remark-gfm` é ESM-only, como toda a família** — entra no `exclude` do `externalizeDepsPlugin`. **Provado por provocação:** tirá-lo do `exclude` e construir reproduz *"Expected usable value but received an empty preset"*, a mensagem exata que derrubou o app no E-1-D.

**O separador de célula tem um dono só** (`CELL_SEPARATOR`, exportado daqui): `.txt` e `.docx` achatam tabela do mesmo jeito, ou o mesmo rascunho sairia diferente em dois formatos.

### DE1E.3 — Externo ou embutido é decidido por sonda, e é o **passo 1**

O `docx` publica CJS **e** ESM, então deveria externalizar como qualquer outra dependência do `main`. Mas ele lista `nanoid@5` — ESM puro — entre as dependências, e o bundle do `main` é CJS.

Isso é a DE1D.9 com outro nome, e a lição registrada na 91ª armadilha não foi "ESM quebra": foi **"a sonda que eu escrevi mentiu"**. O `s.default ?? s` daquela vez mascarava exatamente o defeito que existia.

**Então a sonda aqui não é minha.** É o `scripts/check-main-bundle.mjs`, que carrega o artefato construído com o `electron` estubado — o mesmo que reproduziu a mensagem exata quando sabotado. O passo 1 instala, constrói e roda. Dois desfechos, ambos de uma linha:

- **carrega** → `docx` fica externo, e é o caminho barato: os ~4,7 MB dele vão para o `app.asar` via `node_modules`, sem tocar nenhum bundle;
- **não carrega** → `docx` entra no `exclude`, junto do `remark`.

⚠️ **O bundle do renderer não é afetado em nenhum dos dois desfechos** — o emissor vive em `core/`, chamado pelo `main`. Os 3,02 MB medidos no E-1-C ficam como estão.

### DE1E.4 — Lista numerada custa configuração, e a profundidade é travada em 5 níveis

`bullet: { level }` sai de graça no `Paragraph`. Lista numerada exige, no construtor do `Document`:

```
numbering: { config: [{ reference: 'ordered', levels: [ { level, format, text, style: { paragraph: { indent } } }, ... ] }] }
```

Os níveis são **declarados de antemão**, e markdown aninha sem limite. Declaro **0 a 4** e **prendo** (`Math.min(depth, 4)`) o que passar disso: o quinto nível de aninhamento numerado num rascunho de prosa não existe, e um `level: 7` sem configuração produz um `.docx` que o Word abre torto — pior que um recuo achatado.

O recuo segue a convenção do próprio Word: 720 twips (½ polegada) por nível, `hanging: 260`.

### DE1E.5 — `render` vira assíncrono; é a única costura no `main`

```ts
async function render(text, format): Promise<string | Uint8Array>
```

`md` devolve o texto; `txt` devolve `toPlainText`; `docx` devolve os bytes do `Packer`. O `await` já existe no `saveExport` — a chamada a `writeAtomic` só ganha um `await render(...)` na frente. O `pdf` continua caindo no ramo `md` até o E-1-F, **e isso é aceitável apenas porque ele segue desabilitado no seletor**; o `Record<ExportFormat, …>` do `FILTERS` continua obrigando os quatro a existirem.

### DE1E.6 — O que decide mora em dado plano; o `docx` só serializa

Dois módulos, e a divisão existe por um motivo mecânico, não estético:

| Arquivo | O quê | Como se testa |
|---|---|---|
| `core/export/blocks.ts` | `Root` do mdast → `Block[]`, dado plano nosso (`{ style, runs, bullet?, ordered?, level? }`) | **nível 1, inteiro** — é objeto comum, `toEqual` resolve |
| `core/export/toDocx.ts` | `Block[]` → `Document` → `Packer.toBuffer` | tradutor burro; só se prova que sai um ZIP |

O `docx` não retém as opções do `new Paragraph({...})` como campos legíveis — ele constrói XML. Sem esta divisão, **toda** a decisão de mapeamento ficaria intestável, ou dependeria de descompactar o ZIP no teste.

**Descompactar no teste foi considerado e recusado:** o Node 24 não traz leitor de ZIP, o `jszip` só chega aqui como transitivo do `docx` (dependência fantasma, e com `shamefullyHoist: false` nem resolve), e escrever um leitor de *local file header* + `inflateRawSync` à mão é manutenção comprada para provar o que o Word prova melhor, ao vivo.

### DE1E.7 — O emissor nunca perde texto: o que ele não mapeia vira parágrafo

O mapeamento cobre `heading` (1–6), `paragraph`, `text`, `strong`, `emphasis`, `inlineCode`, `code`, `list`/`listItem`, `blockquote`, `thematicBreak`, `link`, `break`, `delete` e `table` (os dois últimos via GFM).

Para todo o resto — `html`, `footnote`, `image`, um nó que uma versão futura do remark introduza — a regra é **uma só**: extrai o texto que houver e emite um parágrafo comum. Nunca some, nunca lança.

⚠️ **`image` cai explicitamente aí**: vira o `alt` como parágrafo, não uma imagem embutida. O rascunho é texto puro, `core/` não resolve anexo, e um `attachment://hash` não tem bytes para embutir. Fora deste plano, registrado abaixo.

### DE1E.8 — O documento sai parecendo Word, não parecendo o crivo

Os títulos usam `HeadingLevel.HEADING_1..6`, que são os estilos **nativos** do Word — então o tema, a fonte e a numeração automática do usuário se aplicam sozinhos, e o sumário do Word encontra os títulos.

**Nenhum token do design system atravessa.** Os `var(--color-*)` vestem o app; um `.docx` é um arquivo que sai do app e vai viver num Word que não é meu. A **única** exceção é fonte monoespaçada em `code`/`inlineCode`, que é semântica e não decoração.

---

## O layout

Uma linha muda, em `FormatPicker.tsx`:

```diff
-  { format: 'docx', label: '.docx — Word', soon: true },
+  { format: 'docx', label: '.docx — Word' },
```

O rodapé, o seletor, o botão e a linha de status ficam como o E-1-D os deixou. **Este plano não tem passo de interface.**

---

## Passos

### Passo 1 — A sonda, antes de qualquer código

`pnpm add docx` → `pnpm build` → `pnpm run check:bundle`.

O desfecho decide **uma linha** do `electron.vite.config.ts` (DE1E.3) e nada mais. Registrar qual dos dois foi, com a mensagem exata se for o segundo.

⚠️ **Nada de emissor antes disso.** Escrever 150 linhas e só então descobrir que o pacote não carrega é a ordem que já custou uma sessão.

### Passo 2 — `core/export/markdown.ts`, e o `.txt` consertado no caminho

Um dialeto, com GFM, e as duas tuplas de substituição que impedem `code` e `table` de sumirem (DE1E.2). `toPlainText.ts` renomeado por `git mv`. `remark-gfm` no `exclude`.

**Teste:** nível 1. Os três casos novos **nascem vermelhos** — tabela, bloco de código e `~~riscado~~`. E os três que o E-1-D já cobre (parágrafo sobrevivendo, lista achatada, alvo de link descartado) continuam verdes, provando que a troca de dialeto não regrediu nada.

⚠️ **Provocação obrigatória no bundler**, não só no teste: tirar `remark-gfm` do `exclude` e construir precisa reproduzir a mensagem da DE1D.9.

### Passo 3 — `core/export/blocks.ts`: o mapeamento inteiro, em dado plano

`Root` → `Block[]`. É onde mora toda a decisão da DE1E.4, DE1E.7 e DE1E.8.

**Teste:** nível 1, e é o passo com mais asserção do plano. Um caso por nó mapeado; aninhamento de lista **preso em 4**; `strong` dentro de `listItem`; `inlineCode` dentro de `paragraph`; um nó não mapeado virando parágrafo com o texto preservado.

⚠️ **Sabotagem obrigatória:** remover o `Math.min` do nível e ver o teste de aninhamento profundo cair. Sem isso o caso passa por acidente — nenhum rascunho de teste aninha cinco vezes sozinho.

### Passo 4 — `core/export/toDocx.ts` e o `render` assíncrono

O tradutor (`Block[]` → `Document` → `Packer.toBuffer`), o `numbering.config` dos cinco níveis, o `render` assíncrono no handler, e o `soon: true` apagado.

**Teste:** nível 1 — `toDocx` de um markdown pequeno devolve bytes começando em `PK\x03\x04`. Nível 3 — `saveExport` com `format: 'docx'` grava um arquivo **não vazio** no diretório temporário, e o filtro oferecido ao diálogo é `{ name: 'Word', extensions: ['docx'] }`.

### Passo 5 — Prova ao vivo

1. Exportar um rascunho como `.docx` e **abrir no Word** — abre sem aviso de arquivo corrompido
2. Títulos aparecem como **Título 1/2/3 do Word**, não como texto grande à mão (confere no painel de estilos)
3. Lista com marcador e lista numerada, com um nível de aninhamento cada — recuo certo, numeração reiniciando certo
4. Negrito, itálico e `código inline` no meio de um parágrafo
5. Bloco de código em fonte monoespaçada, indentação preservada
6. Citação e linha horizontal
7. Uma **tabela** — aparece como texto legível, e a mesma tabela em `.txt` sai **sem os pipes** (a correção do passo 2)
8. Um rascunho com título contendo `:` — o nome sugerido sai `.docx` limpo
9. Exportar `.md` e `.txt` de novo — **nada regrediu**

---

## Fora deste plano

| Item | Onde vai / por quê |
|---|---|
| `.pdf` | **E-1-F** — a única bifurcação que a trilha ainda tem em aberto (`pdf-lib` com fonte vendorizada contra `printToPDF` sem dependência) |
| Imagem embutida no `.docx` | fora — exigiria resolver `attachment://` dentro de `core/`, que hoje não conhece o disco do app. O `alt` vira parágrafo (DE1E.7) |
| Tabela como **tabela do Word** (`Table`/`TableRow`/`TableCell`) | fora — o `docx` suporta, e é um plano de meia hora **quando alguém exportar uma tabela de verdade**. Neste corte ela vira texto legível, que é melhor que pipes |
| Cabeçalho, rodapé, número de página, sumário automático | fora — são decisões de documento, não de conversão. Nenhum chamador pediu |
| Escolher fonte ou tamanho na exportação | fora — DE1E.8: quem veste o `.docx` é o Word do usuário |
| `.odt`, `.rtf`, `.epub` | fora do escopo do produto — o `ESCOPO` fixa cinco formatos de saída |

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 3-4 | verdes — **1022 testes, 112 arquivos**, `pnpm build` com `check:bundle` | **Duas sabotagens, cada uma derrubando exatamente um teste.** Sem o `Math.min` do nível, o aninhamento devolve `[0,1,2,3,4,5,6]` em vez de `[0,1,2,3,4,4,4]`; sem o ramo `docx` do `render`, o arquivo começa em `[35, 32, 86, 101]` — `"# Ve"`, o markdown cru — em vez do `[80, 75, 3, 4]` de um zip. **Conferência manual do artefato, fora do teste:** descompactado com `Expand-Archive` (o Windows tem leitor de ZIP, o teste é que não pode ter), o `document.xml` traz `Heading1`/`Heading2`, quatro parágrafos de lista com `numId` e `ilvl`, `Consolas`, a borda do `---`, negrito só no cabeçalho da tabela, e os 24 trechos de texto todos presentes. **Só agora o `check:bundle` vira juiz do `docx`** — com o `toDocx` alcançável pelo `main`, o bundle exige o pacote de fato. O teste do seletor escrito no E-1-D pegou sozinho a mudança de "dois habilitados" para três. |
| 27/08/2026 | 2 | verde — **1000 testes, 110 arquivos** | **A decisão que eu tinha escrito estava errada, e medir antes de implementar foi o que salvou.** DE1E.2 prometia que ligar GFM consertaria o `.txt` de tabela; medido, ele faz o oposto — o `strip-markdown` **apaga a tabela inteira** quando o GFM a transforma em nó `table`, trocando "feio porém completo" por "limpo porém sem o dado". **E a investigação achou um segundo defeito já em produção desde o E-1-D:** o `.txt` apaga blocos de código (`code: empty` no mapa do `strip-markdown`, ao lado de `table`, `html`, `thematicBreak`, `toml` e `yaml`). A prova ao vivo do E-1-D não pegou porque conferia o que **sai**, nunca o que **sobrevive** — uma lição sobre a forma da conferência, não sobre este pacote. Conserto pelo mecanismo documentado do próprio `strip-markdown` (tuplas em `remove`), sem plugin próprio. **Provocação no bundler:** `remark-gfm` fora do `exclude` reproduz *"Expected usable value but received an empty preset"* — a mensagem idêntica do E-1-D. Os `as` que escrevi nas tuplas eram desnecessários e saíram. |
| 27/08/2026 | 1 | sonda fechada — **`docx` fica externo** | **O `check:bundle` do passo 1 seria vazio e eu quase o aceitei:** com a dependência instalada e nada importando `docx`, o bundle não referencia o pacote, então "carrega" não prova interop nenhuma. O juiz honesto foi `require('docx')` cru, sem fallback — **306 exports nomeados, sem embrulho `default`**, `Packer.toBuffer` é função. O `dist/index.cjs` do `docx` tem **zero `require()`**: ele embute `jszip`, `nanoid`, `hash.js` e os dois `xml`, então o `nanoid@5` ESM-puro nunca é exigido em runtime e o risco da DE1E.3 não se materializa. **A mesma sonda achou o risco do outro lado:** `require('remark-gfm')` devolve `{ default }` — a forma exata da DE1D.9 —, então ele entra no `exclude` no passo 2, quando o `core/` passar a importá-lo. O `check:bundle` só vira juiz de verdade no passo 4, com o emissor importado; rodar de novo lá faz parte do passo. |
| 27/08/2026 | — | plano escrito, ainda não executado | **A pesquisa achou um defeito que já está no app, não um risco futuro:** a Prévia usa `remark-gfm` e o `toPlainText` não, então tabela aparece formatada no painel e sai como pipes literais no `.txt`. O `.docx` herdaria o desencontro — daí o parse virar fonte única (DE1E.2), o que conserta o `.txt` sem plano próprio. **E confirmou uma assimetria do `docx` que teria custado tempo:** marcador é grátis, lista numerada exige `numbering.config` declarado no `Document`, com níveis fixados de antemão — markdown aninha sem limite, `docx` não (DE1E.4). O risco do `nanoid@5` (ESM puro dentro de um pacote CJS) **não** foi resolvido por leitura: virou o passo 1, com o `check:bundle` da DE1D.9 como juiz, porque a lição daquela armadilha foi que a sonda escrita à mão mentiu. |
