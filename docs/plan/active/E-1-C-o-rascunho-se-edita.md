# E-1-C — O rascunho se edita: CodeMirror 6, no molde do VS Code

> Terceiro plano da trilha E, depois do [E-1-A](../implemented/E-1-A-o-rascunho-existe.md) e do [E-1-B](../implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md). O rascunho existe, tem painel, seletor e exclusão — falta a capacidade que o usuário nomeou como o diferencial do app.

**Origem:** a frase dele ao aprovar o desenho — *"faço questão da funcionalidade editar... é isso que diferencia meu app: eu defino o que é exportado e como é exportado, e não o modelo."* O `ESCOPO` já justifica a exportação dizendo que **duas** decisões são exclusivas do usuário (o caminho e o formato); editar acrescenta a terceira: **o conteúdo**.

**Entrega:** as abas `Editar`/`Prévia` no painel de rascunho, o editor sobre **CodeMirror 6**, o canal `draft:update` (37º), e `Tabs` promovido a `shared/ui/`.

⚠️ **Este plano substitui uma versão anterior de si mesmo**, escrita sobre `<textarea>` e descartada antes de virar código. O motivo está na primeira decisão, e vale mais que o plano.

---

## O que foi checado antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| `<textarea>` é o caminho simples, e editor de verdade é exagero | ⚠️ **Invertido.** Metade do plano anterior existia só para contornar a `<textarea>`: campo não controlado, estado sombra, `useDeferredValue`, e a pilha de desfazer sem teste possível. **CodeMirror traz história própria** (`history()` de `@codemirror/commands`), e essas quatro peças somem |
| Botões de formatação seriam impossíveis | ⚠️ **Eram — na `<textarea>`.** Ali toda inserção programática quebra o desfazer, exceto o depreciado `execCommand('insertText')`. Num editor com modelo próprio, formatar é transação, e a história registra. **Continua fora deste plano**, mas por escopo, não por impedimento |
| Capturar `Tab` seria falha de acessibilidade nossa | **Não precisamos decidir.** O CodeMirror 6 **não trata `Tab` por padrão**, e a razão declarada é exatamente passar no critério *no keyboard trap* da WCAG. Ainda oferece duas saídas documentadas se um dia se quiser indentar: `Escape` seguido de `Tab`, e `Ctrl-m` (`toggleTabFocusMode`) |
| Editor rico faria markdown deixar de ser a fonte da verdade | **Só nas famílias WYSIWYG.** No CodeMirror o documento **é** a string de markdown — a trilha E a jusante (`mdast → .docx/.pdf`) não muda uma linha. Foi o critério que decidiu contra TipTap/Lexical |
| CodeMirror roda em jsdom como qualquer componente | ⚠️ **Não.** Precisa de `Range.prototype.getBoundingClientRect`, `getClientRects` e `Document.prototype.elementFromPoint`, que o jsdom não implementa. Vão para `test/setup-renderer.ts`, ao lado dos shims de `<dialog>` e Popover que já moram lá |
| `Tabs` só precisa mudar de pasta | ⚠️ Renderiza `current.render()` — **um** painel. Desmontar o editor para espiar a prévia destruiria a história a cada olhada. Precisa de montagem persistente **opt-in**: o dataset tem quatro abas e uma fala com o motor |
| A prévia precisa de trabalho | **Não precisa de nenhum.** `MarkdownMessage` já renderiza markdown com `remark-gfm` e destaca bloco de código com `rehype-highlight`. A aba `Prévia` é o corpo que o E-1-B já escreveu |

---

## Decisões

### DE1C.1 — CodeMirror 6, montado à mão, sem invólucro de React

O que decidiu não foi tamanho nem popularidade, foi **qual é a fonte da verdade**. TipTap e Lexical editam um modelo de documento e serializam markdown na entrada e na saída — o *round-trip* perde coisas em silêncio, e os emissores da trilha E passariam a ler o modelo em vez do markdown. No CodeMirror o documento **é** o texto: `mdast → .docx/.pdf` continua exatamente como está planejado.

E é a sensação que o usuário pediu, com todas as letras: *"como se eu estivesse editando algo no VS Code."*

**Sem `@uiw/react-codemirror`.** A montagem à mão é um `useEffect` que cria a `EditorView`, guarda a referência e chama `view.destroy()` na limpeza — algumas dezenas de linhas contra um pacote a mais, e a skill `architecture` já recusa biblioteca de componentes por padrão. O invólucro também expõe uma API controlada (`value`/`onChange`), que é justamente a forma que este plano existe para não ter.

### DE1C.2 — Um objeto de tema serve aos **dois** temas do app

`EditorView.theme()` e `HighlightStyle.define()` recebem valores como string. Escrevendo `var(--color-text)` em vez de um `#hex`, o editor herda o tema claro/escuro **sem uma linha de detecção** — os tokens já trocam sozinhos sob `prefers-color-scheme` (DS4.2).

⚠️ Isso não é conveniência, é a regra do design system aplicada onde ela quase escapa: o CodeMirror injeta CSS próprio, fora do Tailwind e fora dos CSS Modules. Um `#hex` ali seria a primeira cor literal do app a passar despercebida pelo `guard`, que varre `.tsx` e `.module.css`. **Toda cor do tema do editor é `var(--color-*)`.**

### DE1C.3 — Extensões compostas à mão, nunca `basicSetup`

O pacote guarda-chuva `codemirror` traz `basicSetup`: números de linha, medianiz, dobra, autocompletar, busca. Nada disso pertence a um campo de **prosa**.

A composição é curta e cada peça tem motivo:

| Extensão | Por quê |
|---|---|
| `history()` + `historyKeymap` | a decisão inteira do plano |
| `defaultKeymap` | seleção, início/fim de linha, o esperado |
| `EditorView.lineWrapping` | prosa quebra linha; código não quebraria |
| `markdown()` | destaque de sintaxe do markdown |
| tema + `HighlightStyle` | DE1C.2 |

⚠️ **`@codemirror/lang-markdown` arrasta `@codemirror/lang-html`** (blocos HTML dentro de markdown). É peso que entra sem ser pedido — **medir depois de instalar** e registrar o número; se pesar demais, o destaque é a peça descartável, porque o usuário já disse que ele é *"seria melhor"*, não requisito.

### DE1C.4 — `Tabs` sobe para `shared/ui/`, com montagem persistente **opt-in**

Chegou o segundo chamador, então a régua da skill `design-system` autoriza — e o DE1B.4 recusou a subida um plano antes exatamente por ela.

Ganha uma opção de manter os painéis montados, com o inativo sob o atributo `hidden`. O padrão continua **desmontar**, e o dataset **não** opta: quatro abas vivas ali deixaria a aba `Consulta` conversando com o motor o tempo todo.

Só o rascunho opta, por um motivo físico — desmontar o editor apaga a história.

### DE1C.5 — `Tab` sai do campo, e agora por padrão do próprio editor

Sem indentação por `Tab`, e a diferença em relação ao plano anterior importa: lá era uma recusa nossa, aqui é o comportamento padrão do CodeMirror, escolhido por ele para passar no critério da WCAG. As duas saídas (`Escape`+`Tab`, `Ctrl-m`) ficam disponíveis se um dia a indentação for pedida.

### DE1C.6 — Grava no `blur`; trocar de rascunho grava antes e **reinicia o documento**

Os caminhos de saída foram conferidos um a um:

| Saída | O `blur` chega antes? |
|---|---|
| Trocar para `Prévia`, fechar o painel, trocar de conversa | sim — todos são clique |
| `Ctrl+D` com o cursor no editor | **não dispara** — o ouvinte do `panel` ignora as teclas em campo de texto (DE1B.5) |
| `Esc` com foco dentro | fecha o painel; grava antes, no mesmo manipulador |

Sem temporizador: escrever no SQLite enquanto alguém digita é outra classe de problema, e não cobre nada que o `blur` já não cubra.

**Trocar de rascunho no seletor troca de documento**, então usa `view.setState(...)` — que **reinicia a história de propósito**. Desfazer não pode atravessar de um rascunho para outro: a pilha pertence ao documento.

### DE1C.7 — Editar retitula, e o título continua derivado

`draft:update` recebe `content`, `title` e `updatedAt`; o título sai do mesmo `draftTitle` de `core/` que o E-1-A escreveu — a DE1A.4 já dizia que ele mora ali **porque** este plano ia retitular. Identidade e tempo continuam nascendo no renderer (DE1A.6). Efeito visível: mudar a primeira linha muda o rótulo no seletor.

### DE1C.8 — O que o nível 2 alcança, e o que só a prova ao vivo alcança

Honestidade sobre a cobertura, porque o contrário produz teste vacuoso:

| | Onde se prova |
|---|---|
| O editor monta com o conteúdo do rascunho | **nível 2** |
| Trocar de aba mostra a prévia e volta com o texto | **nível 2** |
| Os dois painéis ficam montados | **nível 2** |
| Sair do campo chama `draft:update` com o id e o texto corretos | **nível 2** |
| **Digitar de verdade, e desfazer** | ⚠️ **só ao vivo** |

O conteúdo do CodeMirror é `contenteditable` e a edição chega por `beforeinput` — o jsdom não reproduz isso de forma confiável. **O teste de nível 2 do `blur` prova o encanamento** (chama com o texto que está no documento), não a digitação. Está escrito assim no próprio teste, para ninguém achar que a pilha de desfazer está coberta.

### DE1C.9 — A prévia não ganha código

`MarkdownMessage` já é o renderizador, com `remark-gfm` e `rehype-highlight` para bloco de código. A aba `Prévia` mostra o mesmo corpo que o E-1-B já escreveu — o que muda é de onde vem o texto: do documento do editor, não do rascunho gravado, para a prévia refletir o que está na tela.

---

## Passos

### Passo 1 — `Tabs` sobe, com montagem persistente opt-in

`shared/ui/Tabs/`, com a opção e o `hidden` no inativo. `ArtifactDataset` importa do novo lugar **sem** optar.

**Teste:** os testes existentes acompanham o lugar sem asserção editada — a mesma prova negativa que validou o `SidePanel`. Um teste novo para a opção: ligada, os dois painéis estão no DOM e o inativo é `hidden`; desligada, só o ativo existe.

⚠️ **Conservação:** `grep` por `features/artifact/Tabs` em `docs/` e `.claude/`. A skill `design-system` conta **8** primitivos e a DF3D.2 registra por que ele ficou de fora — a linha passa a dizer que o segundo chamador chegou (**9**).

### Passo 2 — O canal `draft:update` (37º)

Os seis lugares da skill `ipc`. Sem `Result`, pela régua da DE1A.5. `UPDATE drafts SET content = ?, title = ?, updated_at = ? WHERE id = ?`.

**Teste:** nível 3 contra `:memory:` — grava e relê; `updated_at` muda e `created_at` não; `update` para id inexistente não lança.

### Passo 3 — O editor

As dependências entram e são **declaradas explicitamente** (`shamefullyHoist: false` transforma dependência fantasma em erro, e isso já mordeu uma vez): `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown` e `@lezer/highlight`. São seis entradas de **uma** biblioteca — CodeMirror é modular por desenho.

`useCodeMirror` monta a `EditorView` e a destrói na limpeza; `DraftEditor` é o componente. Os mocks de `Range`/`elementFromPoint` entram em `test/setup-renderer.ts`.

⚠️ **`DraftPanel` já tem 103 linhas** — o editor nasce em arquivo próprio, não empurrando o painel na direção do teto.

**Teste:** nível 2 — monta com o conteúdo; as duas abas ficam montadas; a inativa é `hidden`.

### Passo 4 — Gravar, retitular e trocar de documento

`blur`, troca de aba e `Esc` gravam. Trocar de rascunho grava e faz `setState`. O título é derivado na hora e o seletor acompanha.

**Teste:** nível 2 — sair do campo chama `draft:update` com id e texto; trocar de rascunho grava o anterior antes. **Provar por sabotagem:** sem a gravação no `blur`, o teste tem de cair sozinho.

### Passo 5 — Prova ao vivo

1. Editar e apertar **`Ctrl+Z` várias vezes** — desfaz por trecho, não letra a letra, e não para na primeira
2. `Ctrl+Y` refaz
3. `Tab` **sai** do campo, não indenta
4. Alternar `Editar`/`Prévia` várias vezes e desfazer de novo — a história sobreviveu à troca
5. Trocar de rascunho e desfazer — **não** atravessa para o documento anterior
6. Editar, fechar o painel, reabrir — o texto está lá
7. Mudar a primeira linha e abrir o seletor — o rótulo mudou
8. Alternar tema claro/escuro com o editor aberto — as cores acompanham, sem recarregar (DE1C.2)
9. Texto longo: rolagem e quebra de linha se comportam como prosa, não como código

---

## Fora deste plano

| Item | Onde vai / por quê |
|---|---|
| `showSaveDialog`, escrita atômica, `EBUSY`, seletor de formato e `Exportar` no rodapé, `.md`/`.txt` | **E-1-D** |
| `.docx` · `.pdf` | **E-1-E** · **E-1-F** |
| Botões de formatação (negrito, lista, título) | **fora por escopo, não por impedimento** — com o modelo do CodeMirror são transações, e a história as registra. Deixam de ser a impossibilidade que a `<textarea>` fazia delas |
| Indentação por `Tab` | fora, com as duas saídas do CodeMirror registradas caso um dia entre (DE1C.5) |
| Indicador de "salvo" | **gatilho na prova ao vivo** — se editar der a sensação de que nada foi gravado, o conserto é um sinal discreto, não um botão |
| Números de linha, medianiz, autocompletar, busca | recusados (DE1C.3): é um campo de prosa |
| Criar rascunho do zero, sem resposta de origem | fora da trilha — `sourceMessageId` é `NOT NULL` (DE1A.2); rascunho em branco é outro objeto e outra pergunta de escopo |

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | — | **reescrito** sobre CodeMirror 6; a versão anterior, sobre `<textarea>`, foi descartada antes de virar código | O usuário perguntou como os apps do mercado resolvem isso, e a pergunta desfez a premissa do plano anterior: **ProseMirror, Lexical e CodeMirror implementam a própria pilha de desfazer**, então "o React quebra o desfazer" é limite da `<textarea>`, não da plataforma. Metade do plano antigo existia só para contorná-lo. A escolha entre as três famílias foi decidida por **fonte da verdade**, não por peso: TipTap/Lexical editam um modelo e serializam markdown com perda no *round-trip*, o que mudaria os emissores da trilha E; no CodeMirror o documento **é** o markdown, e nada a jusante muda. A pesquisa acrescentou três coisas: o CodeMirror **não trata `Tab` por padrão** por decisão de acessibilidade declarada (com `Escape`+`Tab` e `Ctrl-m` como saídas), ele **não roda em jsdom** sem três mocks de `Range`/`elementFromPoint`, e `@codemirror/lang-markdown` **arrasta `@codemirror/lang-html`** — peso a medir depois de instalar. |
