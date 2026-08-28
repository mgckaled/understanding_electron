# E-1-F — O `.pdf`: o motor de layout que já está dentro do app

> Sexto e último plano da trilha E, depois do [E-1-A](../implemented/E-1-A-o-rascunho-existe.md), [E-1-B](../implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md), [E-1-C](../implemented/E-1-C-o-rascunho-se-edita.md), [E-1-D](../implemented/E-1-D-o-caminho-de-saida.md) e [E-1-E](../implemented/E-1-E-o-rascunho-vira-word.md). Fecha o motor de exportação.

**Origem:** o `.pdf` é o último item desabilitado do `FormatPicker`, e o único da trilha que ainda tinha bifurcação técnica em aberto.

**Entrega:** `.pdf` de ponta a ponta, por `webContents.printToPDF` numa janela offscreen — **zero dependência nova** —, alimentado por um HTML gerado do mesmo `Block[]` que o `.txt` e o `.docx` já usam.

---

## A bifurcação, resolvida pelo dono do projeto

| | `pdf-lib` | **`printToPDF`** |
|---|---|---|
| Dependências | `pdf-lib` + `@pdf-lib/fontkit` + fonte vendorizada | **nenhuma** |
| Paginação de prosa longa | **por minha conta** — medir texto, quebrar linha, estourar página | Chromium |
| Tabela com célula que quebra | por minha conta | Chromium |
| Custo estrutural | nenhum — entra como renderizador do `Block[]` | ~~bifurca o pipeline~~ — **dissolvido, ver DE1F.1** |

O `ESCOPO` já registrava o problema central ao escolher a biblioteca: *"`pdf-lib` — desenha texto/posição; **sem paginação automática de prosa longa**"*. Uma resposta de modelo é exatamente isso.

E a objeção que restava contra o `printToPDF` — bifurcar o pipeline — **foi dissolvida pelo próprio usuário**, ao perguntar se o `.pdf` não podia sair "no mesmo esquema do `.docx`". Podia, e é melhor assim.

---

## O que foi checado antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| `printToPDF` obriga a abandonar o `Block[]` e imprimir o HTML do `react-markdown` | **Não.** O HTML pode ser **gerado do `Block[]`**, virando o **terceiro renderizador** do mesmo mapeamento. O pipeline não bifurca, e o HTML sendo string pura ainda me dá o que o `.docx` não deu: **asserção de igualdade no nível 1** |
| Chromium bloqueia navegação de topo para `data:` URL | ⚠️ **Bloqueia na web, não aqui.** `await window.loadURL('data:text/html,…')` **já roda em produção** neste app, no `rasterizeToPng` (D17.7), verificado ao vivo. O padrão inteiro de janela offscreen sandboxed existe pronto para copiar |
| O guarda de navegação do app barraria a janela offscreen | **Não.** `will-navigate` e `setWindowOpenHandler` são anexados a `mainWindow.webContents` em `src/main/index.ts` — **por janela, não globais**. O `rasterizeToPng` já prova isso funcionando |
| Carregar e imprimir basta | ⚠️ **Não: imprimir antes de a carga terminar produz um PDF EM BRANCO**, sem erro nenhum. A doc do Electron avisa explicitamente. O `await` do `loadURL`/`executeJavaScript` é obrigatório, não higiene |
| Gerar HTML de texto do modelo contradiz a D12.2 | **Contradiria se o texto passasse por HTML.** Ele não passa: **todo run é escapado** e só as minhas tags são emitidas. A D12.2 proíbe *transformar texto do modelo em HTML*, e escapar é o oposto disso. Reforço em profundidade na DE1F.3 |
| A tipografia precisa de fonte embutida | **Não — decisão do dono:** *"o que o sistema oferece está ok, desde que diferencie tipografia normal de monoespaçada"* |
| Títulos podem virar marcadores do PDF | ⚠️ **`generateDocumentOutline` é experimental e tem issue aberta** de não gerar o índice ([electron#45124](https://github.com/electron/electron/issues/45124)). Fica de fora, com gatilho |
| `page-break-inside` é a propriedade a usar | É **legada**. A moderna é `break-inside`, e as legadas são tratadas como apelido. Uso a moderna |

---

## Decisões

### DE1F.1 — `printToPDF`, e o HTML sai do `Block[]` — terceiro renderizador, não segundo pipeline

```
markdown → Block[] ─┬→ toPlainText  → .txt
                    ├→ toDocx       → .docx
                    └→ toHtml       → printToPDF → .pdf
```

Nasce `src/core/export/toHtml.ts`, puro, sem `electron`. É o que mantém a garantia conquistada na DE1E.9: **um mapeamento, agora três saídas**, consistentes por construção. Um bloco de código continua sendo o mesmo bloco de código nos três formatos, porque nenhum deles reinterpreta o markdown por conta própria.

⚠️ **E é o formato que se testa melhor dos três.** HTML é string: o nível 1 compara o documento **inteiro**, por igualdade — exatamente a lição que a DE1E.9 cobrou (asserção de presença não prova transformação).

### DE1F.2 — A janela offscreen copia o molde do `rasterizeToPng`, inclusive o `finally`

`show: false`, `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` — **escritos**, não deixados no default, pela mesma razão registrada no D17.7: esta janela nasce e morre dentro de um handler e o `security-boundary.spec.ts` nunca a vê.

`window.destroy()` no `finally`, sem exceção. Janela offscreen vazada é processo vazado, e nenhum teste apanha isso sozinho.

**A carga em dois tempos**, e não `data:` URL com o documento inteiro: `loadURL('data:text/html,…')` mínimo, depois `executeJavaScript` escrevendo o documento.

⚠️ **A justificativa que eu escrevi primeiro estava errada, e a correção importa mais que o número.** Eu havia medido o `data:` URL falhando "entre 128 e 192 KB" e registrado isso como necessidade. Era **artefato da sonda**: ela criava uma janela, destruía, criava outra — e destruir a **única** janela dispara `window-all-closed`, cujo padrão do Electron é encerrar o app. A segunda janela falhava sempre, em qualquer tamanho, e eu li isso como teto de tamanho porque a primeira era pequena e a segunda grande.

Remedido com uma janela âncora viva (o que a `mainWindow` é em produção): `data:` URL vai até **1 MB** e morre em 2 MB com `ERR_INVALID_URL`; a carga em dois tempos passa **4 MB sem teto encontrado**. Então a escolha continua certa — sem teto conhecido, e é o padrão já provado no `rasterizeToPng` —, mas **não** pelo motivo que eu tinha escrito.

⚠️ **A lição é sobre a forma da sonda, não sobre o Chromium:** uma medição que varia duas coisas ao mesmo tempo (o tamanho **e** a ordem) mede a que eu não estava olhando. O app nunca sofreria disso porque a janela principal está sempre aberta — a sonda é que não a tinha.

### DE1F.3 — Todo texto é escapado, e o documento gerado nasce com `default-src 'none'`

`&`, `<`, `>` e `"` escapados em **todo** run, sem exceção. O que entra é texto do modelo; o que sai são as minhas tags e mais nada.

⚠️ **O `Block` tem um caminho que parece contrariar isso e não contraria:** a DE1E.7 manda o nó `html` do markdown virar um parágrafo com o texto cru. Como ele chega **como run**, o escape o alcança naturalmente — HTML dentro do rascunho vira HTML **visível** no PDF, nunca HTML executado. Isso ganha teste próprio, porque é a linha entre um recurso e um vazamento.

**Reforço em profundidade:** o documento gerado carrega `<meta http-equiv="Content-Security-Policy" content="default-src 'none'">`. Se o escape falhar um dia, a página ainda não busca nada da rede. Custa uma linha e fecha a exfiltração, que é o dano real possível numa janela já sem `preload` e sem Node.

### DE1F.4 — Paginação é CSS, e são quatro regras que importam

| Regra | Por quê |
|---|---|
| `@page { size: A4; margin: 2cm }` + `preferCSSPageSize: true` | o tamanho mora no CSS, num lugar só |
| `break-inside: avoid` em código e tabela | bloco partido ao meio perde o sentido |
| `break-after: avoid` em título | título não pode ser a última coisa da página |
| `orphans: 2; widows: 2` | linha solta de parágrafo no pé ou no topo |

Propriedades **modernas** (`break-*`), não as legadas `page-break-*`.

### DE1F.5 — Tipografia do sistema, e a única distinção que precisa existir

Decisão do dono, literal: *"tipografia não precisa — o que o sistema oferece está ok, desde que diferencie tipografia normal de monoespaçada"*.

`system-ui, sans-serif` para o corpo; `ui-monospace, Consolas, monospace` para `code` e `inlineCode`. **Nada é embutido**, e nada da paleta do app viaja — mesma régua da DE1E.8, e aqui ela é ainda mais fácil de respeitar porque o preto no branco é o que se imprime.

`printBackground: true`, para o fundo levíssimo do bloco de código sair no arquivo. É a única concessão a cor, e ela serve à leitura.

### DE1F.6 — A impressão é injetada, como o diálogo já é

`render` deixa de bastar sozinho: o `.pdf` precisa do Electron e `core/` não pode importá-lo. A divisão segue a régua da skill `architecture`:

| Onde | O quê | Testável |
|---|---|---|
| `core/export/toHtml.ts` | `Block[]` → HTML | **nível 1, por igualdade** |
| `main/features/export/printPdf.ts` | HTML → bytes, via janela offscreen | não — é Electron vivo, como o `rasterizeToPng` |

`saveExport` recebe `printPdf` **por parâmetro**, exatamente como já recebe `showSaveDialog`. O nível 3 injeta um dublê e continua rodando sem Electron; o composition root injeta o real.

### DE1F.9 — Número de página entra, e o template do Chromium não herda estilo nenhum

**Pedido do usuário na prova ao vivo**, e o corte o tinha em *Fora deste plano* com a justificativa "nenhum chamador pediu". Pediu.

`displayHeaderFooter: true` + `footerTemplate` com as classes próprias do Chromium (`pageNumber`, `totalPages`), e `headerTemplate` **vazio de propósito** — ligado sem ele, o Chromium imprime título e data no topo por conta própria.

⚠️ **O template não herda nada da página e renderiza com fonte de tamanho zero.** Cada regra do `style` inline é obrigatória, não decoração; sem `font-size` o rodapé existe e é invisível.

**Provado por diferença, não por inspeção:** o texto do PDF vem comprimido e com glifos remapeados por *subsetting*, então procurar "Página" nos bytes não prova nada. O que prova é o tamanho do arquivo **mudar conforme o comprimento do rodapé** — 19,8 KB sem rodapé contra 30,4 / 35,2 / 33,1 KB com três textos diferentes.

### DE1F.8 — O doctype pertence à **primeira** carga, não ao documento gerado

Achado sondando a paginação, e é independente dela. `document.compatMode` vinha **`BackCompat`**: o `data:text/html` inicial não tinha doctype, e **`innerHTML` não muda o modo de compatibilidade de um documento depois**. O `toHtml` emite `<!doctype html>` no documento dele e isso **não ajuda** — quem decide é a carga que criou o documento.

Efeito: todo PDF exportado renderizava em **modo quirks**, onde altura de linha e dimensionamento de célula de tabela seguem outras regras. Não era um defeito de paginação; era um defeito de tudo, silencioso.

Um caractere de conserto (`data:text/html,<!doctype html><div></div>`), medido antes e depois: `BackCompat` → `CSS1Compat`, mesmas 3 páginas.

⚠️ **Não é testável abaixo do Electron vivo**, mesma categoria do `rasterizeToPng`. O que sobra é o comentário no ponto de aplicação, porque a linha parece decorativa e não é.

### DE1F.7 — Sem `generateDocumentOutline` e sem `generateTaggedPDF`

Os dois são marcados **experimentais** pelo próprio Electron, e o primeiro tem [issue aberta de não gerar o índice](https://github.com/electron/electron/issues/45124). Ligar um recurso experimental com defeito relatado para ganhar marcadores de navegação é trocar um PDF que funciona por um que talvez funcione.

**Gatilho:** quando o Electron marcar `generateDocumentOutline` como estável, ele passa a ser uma linha — os `<h1>`–`<h6>` já estarão lá.

---

## O layout

Uma linha em `FormatPicker.tsx`, a última:

```diff
-  { format: 'pdf', label: '.pdf', soon: true }
+  { format: 'pdf', label: '.pdf' }
```

O seletor deixa de ter item desabilitado pela primeira vez desde o E-1-D. **Este plano não tem outro passo de interface.**

---

## Passos

### Passo 1 — A sonda, antes de qualquer código de conversão

Uma janela offscreen, um HTML mínimo com `@page`, `printToPDF`, gravar, **abrir o arquivo**. Só isso.

O que a sonda tem de responder, e que leitura de doc não responde: a carga em dois tempos funciona? o PDF sai com conteúdo ou em branco? o `preferCSSPageSize` respeita o `@page`? quanto custa em tempo, com a janela fria?

⚠️ **É o passo 1 do E-1-E de novo, e ele se pagou duas vezes lá** — uma achando que o `check:bundle` passava vazio, outra confirmando o `remark-gfm`. Nada de `toHtml` antes disto.

### Passo 2 — `core/export/toHtml.ts`

`Block[]` → documento HTML completo, com o CSS de impressão embutido e todo texto escapado.

**Teste:** nível 1, e **por igualdade do documento inteiro** — é o formato que permite isso, e a DE1E.9 já cobrou o preço de não fazer. Um caso por tipo de bloco; a tabela como `<table>` de verdade, no mesmo espírito da DE1E.10.

⚠️ **Sabotagem obrigatória:** um rascunho contendo `<script>alert(1)</script>` e `<img src=x onerror=...>` tem de sair como **texto visível**. Removendo o escape, esse teste precisa cair — se ele passar dos dois jeitos, não estava provando nada.

### Passo 3 — `main/features/export/printPdf.ts`, e o `.pdf` ligado

A janela offscreen no molde do `rasterizeToPng`, `printPdf` injetado no `saveExport`, e o `soon: true` apagado.

**Teste:** nível 3 com dublê — `saveExport` com `format: 'pdf'` chama `printPdf` com o HTML do `toHtml` e grava os bytes que ele devolver; o filtro oferecido ao diálogo é o do PDF. A impressão real fica para o passo 4, como o `.docx` ficou.

### Passo 4 — Prova ao vivo

1. Exportar `.pdf` e **abrir** — sem aviso de arquivo corrompido
2. Um rascunho **longo**, que passe de uma página — a paginação acontece sozinha
3. Título perto do fim da página **não** fica órfão da própria seção
4. Bloco de código: monoespaçado, indentação preservada, **não partido** entre páginas
5. Tabela: desenhada como tabela, e não partida no meio de uma linha
6. Negrito, itálico, `código inline`, citação e régua
7. Um rascunho com `<script>` escrito dentro — aparece como **texto**
8. Acentuação portuguesa correta em tudo
9. `.md`, `.txt` e `.docx` de novo — **nada regrediu**

---

## Fora deste plano

| Item | Onde vai / por quê |
|---|---|
| Marcadores/índice no PDF | **gatilho** — `generateDocumentOutline` sair de experimental (DE1F.7) |
| PDF acessível (tagged) | mesmo gatilho, mesmo motivo |
| ~~Número de página~~ | **entrou** — o usuário pediu na prova ao vivo, ver DE1F.9 |
| Cabeçalho e data no topo | fora — o `headerTemplate` fica vazio de propósito |
| Escolher A4 × Carta, margem, retrato × paisagem | fora — seria configuração; o `@page` fixa A4 num lugar só, e mover para as Configurações é um plano de UI |
| Imagem embutida no PDF | fora — mesmo motivo da DE1E.7: `core/` não resolve anexo. O `alt` vira texto |
| `.pptx` | **E-2**, e depois do plano 20 (aproveita imagem de gráfico) |

---

## Diário de execução

✅ **Aceite observado pelo usuário em 27/08/2026.** As dez conferências do passo 4 certas, mais uma entrega acrescentada durante a prova (DE1F.9). **Plano concluído, e a trilha E fecha com ele** — quatro formatos de saída, `.md`/`.txt`/`.docx`/`.pdf`, e o seletor sem nenhuma opção desabilitada pela primeira vez.

⚠️ **Uma palavra custou uma investigação inteira, e valeu a pena.** O usuário relatou *"a paginação não veio"*; eu li **quebra em páginas** e ele queria **numeração de página**. Perseguir a leitura errada não achou o defeito que não existia — mas achou **dois** que existiam: o modo quirks (DE1F.8) e uma medição minha falsa sobre o `data:` URL (DE1F.2). O conserto de ambos veio antes da entrega que ele de fato pediu.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 4 | **prova ao vivo — 1047 testes, 113 arquivos** | ⚠️ **"Paginação" tinha dois sentidos, e eu peguei o errado.** Li como quebra em páginas; era **numeração**. Reproduzir antes de consertar foi o que impediu o estrago: duas sondas contra o `toHtml` real paginaram (4 páginas em prosa longa, 3 no formato do `.docx` validado), e o rascunho de 63 parágrafos reexportado deu **3 páginas com conteúdo completo** — então não havia o que consertar ali. **E a investigação pelo caminho errado achou dois defeitos reais:** o documento inteiro renderizava em **modo quirks** (DE1F.8), e a minha medição do teto do `data:` URL era **artefato da própria sonda** (DE1F.2). O que o usuário pediu de fato — número de página — virou a DE1F.9, com o `headerTemplate` vazio para o Chromium não imprimir título e data por conta. |
| 27/08/2026 | 2-3 | verdes — **1047 testes, 113 arquivos**, `pnpm build` com `check:bundle` | **Uma segunda sonda desmentiu uma suposição minha e confirmou um risco que eu não tinha visto.** Eu ia registrar que a CSP em `<meta>` injetada por `innerHTML` é ignorada pelo Chromium (é o que a orientação geral diz) e que a tranca da DE1F.3 seria decorativa — medido com `securitypolicyviolation` e uma imagem remota, **ela está ATIVA**. Já o `data:` URL com o documento inteiro, que eu tratava como alternativa viável, **falha com `ERR_FAILED` entre 128 e 192 KB** — perto demais de um rascunho longo, então a carga em dois tempos deixa de ser conveniência e vira necessidade. **Duas sabotagens:** sem o escape caem os quatro testes de `<script>`/`<img onerror>`/`&`/bloco de código, e só eles; sem o ramo `pdf` do `render` cai um teste, o certo. ⚠️ **Uma asserção minha nasceu vacuosa e foi corrigida antes de virar commit:** `not.toContain('onerror=alert')` é falsa por construção — o texto escapado **contém** essa string, como texto; o que não pode existir é a tag que abre. É a mesma família da lição da DE1E.9. |
| 27/08/2026 | 1 | sonda verde — **o caminho inteiro funciona** | Janela offscreen sandboxed no molde do `rasterizeToPng`, carga em dois tempos, `printToPDF`. **PDF válido de 34 KB, com as DUAS páginas** que o `break-before: page` pedia, `MediaBox` de `594,96 × 841,92 pt` (A4 — o `preferCSSPageSize` respeitou o `@page`), fonte monoespaçada embutida e fluxo comprimido. Acentuação portuguesa correta. **Tempo a frio: 542 ms** — `loadURL` 166, `executeJavaScript` 12, `printToPDF` 364. É meio segundo por exportação, com a janela nascendo e morrendo a cada vez; aceitável para uma ação que já abre diálogo de salvar, e **não vale cache de janela** (janela viva é processo vivo). ⚠️ **Nenhuma surpresa, e é isso que se queria saber antes de escrever `toHtml`:** os dois medos da pesquisa (`data:` bloqueada, guarda de navegação global) continuam sem se materializar em execução real, não só em leitura. |
| 27/08/2026 | — | plano escrito, ainda não executado | **A objeção que eu tinha contra o `printToPDF` foi dissolvida pelo usuário, não por mim:** eu recomendava assumir a bifurcação do pipeline como custo; ele perguntou se não dava para sair "no mesmo esquema do `.docx`", e dá — o HTML gerado do `Block[]` faz o `.pdf` virar o **terceiro renderizador** em vez de um segundo caminho, e ainda entrega o formato mais testável dos três. **A pesquisa derrubou dois medos e confirmou um:** `data:` URL não é bloqueada aqui (o `rasterizeToPng` já a usa em produção, D17.7) e o guarda de navegação é por janela, não global; mas imprimir antes de a carga terminar produz **PDF em branco, sem erro**, então o `await` é obrigatório. **E tirou um recurso da mesa:** `generateDocumentOutline` é experimental e tem issue aberta de não gerar o índice — vira gatilho em vez de entrega. |
