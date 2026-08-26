# DS-5 — ícones, fonte de código, realce de sintaxe e o acabamento que o DS-4 não pediu

## Contexto

O `HISTORY.md` fechou a DS-4 chamando-a de "acabamento final da trilha DS" e o
`ROADMAP.md`/`plan/active/README.md` registraram a trilha como **encerrada
definitivamente**. `notes/notes.md`, escrito depois — com cinco imagens de referência
geradas pela mesma ferramenta externa (Claude Design) que produziu os handoffs
anteriores — pede mais um plano, e o motivo é legítimo, não um vazamento de escopo:
volume de detalhe visual que nenhum dos quatro planos anteriores cobriu. É a **quinta**
rodada de handoff da trilha, não uma extensão do DS-4 — mesma relação que o DS-4 tinha
com o DS-3 (`plan/active/README.md`: *"não é uma quarta divisão do mesmo escopo, é uma
segunda rodada de handoff"*).

Dez pedidos em `notes.md`, verificados nesta sessão contra o código real, não assumidos
pela leitura do usuário:

1. Biblioteca de ícones (Lucide) substituindo os glyphs Unicode (`«`/`»`, `✎`/`⋮`, `×`,
   `↻`, `⌄`, `⏸`/`↑`, `⚙`, `🔍`) — engrenagem de Configurações **maior** que os demais.
2. `--font-mono` passa de pilha do sistema para JetBrains Mono.
3. Realce de sintaxe "perdido" e rótulo de linguagem "não exibido mais" no bloco de
   código — **verificado nesta sessão**: `git diff ds-3 ds-4` em
   `MarkdownMessage.tsx`/`.module.css` não retorna nada. DS-4 não tocou esses arquivos.
   O que a fase precisa decidir é diferente do que a nota presume — ver DS5.4.
4. Ícone "Copiar" funcional em todo bloco de código.
5. Três ícones ao fim de cada turno do assistente — copiar (funcional), compartilhar e
   atualizar (**não-funcionais**, por pedido explícito da nota).
6. Tipografia do chrome (fora da superfície de leitura) pequena demais.
7. Remover "Abrir arquivo" da sidebar, entrar como clipe no composer.
8. Ícones de editar/excluir na lista de conversas (o kebab já existe, DS-4; falta
   ícone nos dois itens do menu, hoje só texto).
9. Reformular a lista de seleção de modelo, com o orçamento de contexto como controle
   **separado**, à direita.
10. Trocar o ícone de "recarregar lista de modelos".

**Duas decisões de produto, perguntadas ao usuário nesta sessão, não assumidas:**

| # | Pergunta | Resposta |
|---|---|---|
| DS5.1 | Só os glyphs citados nas notas viram Lucide, ou **todos** os do app? | **Todos.** `«`/`»` (Sidebar), `🔍` (busca), `⏸`/`↑` (Composer), `×` (Dialog), `⌄` (ModelSelector) migram junto — nenhum glyph Unicode sobrevive nesta sessão. |
| DS5.2 | `--font-mono` inteiro vira JetBrains Mono, ou só um `--font-code` novo para blocos? | **`--font-mono` inteiro.** Reverte "pilha do sistema, sem webfont" (skill `design-system`) para **todo** consumidor monoespaçado — host:porta do Ollama, nome de modelo, não só código. |

Duas simplificações técnicas encontradas com fonte primária (Context7), evitando
retrabalho que as notas não previam:

- **`lucide-react` é tree-shakable e decorativo por padrão** — cada ícone é um
  componente nomeado (`import { Search } from 'lucide-react'`), `stroke="currentColor"`
  herda o token semântico de cor sem `#hex` (não dispara a guarda 6), e sem
  `aria-*`/`role`/`title` o próprio pacote aplica `aria-hidden` — o mesmo papel que os
  `<span aria-hidden="true">` de hoje já cumprem manualmente.
- **`@fontsource/jetbrains-mono` é auto-hospedado**, resolvido no bundle do Vite —
  nenhuma requisição de rede em runtime, nenhuma mudança de CSP (`default-src 'self'`
  já cobre `font-src` por *fallback*, e o `index.html` não declara `font-src` próprio
  para sobrescrever isso).

Nenhum dos dois pacotes é módulo nativo — nenhuma entrada em `allowBuilds`
(`pnpm-workspace.yaml`), nenhum `pnpm dev` de validação além do de sempre.

**Alternativas descartadas:** Material Icons/Phosphor/Heroicons (Lucide nomeado
primeiro nas notas, tree-shakable, já é o padrão de fato do ecossistema Tailwind, sem
motivo concreto para preferir outra); fonte via `<link>` do Google Fonts (quebraria o
`default-src 'self'` do CSP e traria dependência de rede num app local-first).

---

## Fases

Ordem: o que só troca aparência primeiro (ícones, fonte), depois o que exige
diagnóstico antes de decidir (realce de sintaxe, escala tipográfica), depois o que
reorganiza estrutura (composer), por último os itens que dependem do composer já
reorganizado (copiar no bloco, ícones do turno) — mesmo critério de "quanto preserva"
que o DS-3/DS-4 já usaram.

### Fase 0 — Registro, housekeeping do repositório

- `git push origin ds-4`, depois `git checkout main && git merge --ff-only ds-4 && git
  push origin main` — mesmo padrão que `ds-3` já tem (`git branch -vv` confirmado nesta
  sessão: `ds-3`/`main` convergem no mesmo commit, os dois com upstream).
- `git rm -r docs/DS-04/` (444 KB, 60 arquivos rastreados, sem `.gitignore` — pacote de
  handoff já consumido pelo DS-4, "muito grande e sem função para o GitHub", pedido
  explícito do usuário).
- `docs/plan/implemented/DS-4-acabamento-final.md:6-7` tem o **único** link markdown de
  verdade para dentro da pasta (`[...](../../DS-04/reference/Chat%20Local%20Design%20
  System.dc.html)`) — os demais são menções em prosa (`HISTORY.md:192`,
  `plan/active/README.md:42`) que continuam legíveis sem a pasta existir e ficam como
  estão. Converter o link real em texto inerte (mesmo nome do arquivo, sem colchetes),
  com uma nota de uma linha: *"pasta removida do repositório após a DS-4 fechar —
  DS-5 § Fase 0"*.
- Criar `docs/plan/active/DS-5-icones-fonte-e-acabamento.md` com este corpo e diário
  vazio; linha nova em `docs/plan/active/README.md` (tabela da trilha DS) e
  `docs/ROADMAP.md § 1` (a trilha DS **reabre**: trocar "encerrada definitivamente"
  pela entrada do DS-5, com a mesma nota que a DS-4 já tinha para a DS-3 — cada rodada
  de handoff pode gerar a próxima).

**Aceite:** `main` e `origin/main` no commit do DS-4; `docs/DS-04/` fora do
repositório; o link morto convertido; plano registrado nos três lugares.

### Fase 1 — Biblioteca de ícones: instalação e migração de todo glyph existente (DS5.1)

`package.json`, `src/renderer/src/shared/ui/icon.ts` (novo),
`ConversationList.tsx`, `Composer.tsx`, `Settings.tsx`, `Sidebar.tsx`,
`ModelSelector.tsx`, `Dialog.tsx`.

- `pnpm add lucide-react`.
- `shared/ui/icon.ts`: `export const ICON_SIZE = { sm: 14, md: 16, lg: 24 } as const` e
  `export const ICON_STROKE = 1.75` — constante TS, não token CSS (o valor vira o prop
  numérico `size`/`strokeWidth` do componente Lucide, não uma propriedade CSS a
  resolver; `--space-*`/`--font-size-*` são tokens porque um seletor CSS os lê, este
  não é o caso). `1.75` em vez do `2` padrão do Lucide — mais fino, combina com "sem
  sombra, sem gradiente, plano" que a skill `design-system` já descreve.
- Mapa completo, todo ponto verificado por grep nesta sessão (9 ocorrências, 6
  arquivos):

  | Glyph | Local | Ícone Lucide | Tamanho |
  |---|---|---|---|
  | `⋮` | `ConversationList.tsx:108` (gatilho do kebab) | `MoreVertical` | sm |
  | `🔍` | `ConversationList.tsx:176` (busca) | `Search` | sm |
  | `×` | `Dialog.tsx:50` (fechar) | `X` | sm |
  | `⏸` | `Composer.tsx:117` (pausar) | `Pause` | md |
  | `↑` | `Composer.tsx:129` (enviar) | `ArrowUp` | md |
  | `⚙` | `Settings.tsx:108` (abrir Configurações) | `Settings` | **lg** — ver nota |
  | `«`/`»` | `Sidebar.tsx:49` (colapsar) | `ChevronsLeft`/`ChevronsRight` | sm |
  | `↻` | `ModelSelector.tsx:179` (recarregar) | `RefreshCw` | sm |
  | `⌄` | `ModelSelector.tsx:155` (chevron do seletor) | `ChevronDown` | sm |

- **A engrenagem em `lg` (24px) é o pedido literal da nota 1** ("2x ou 3x maior que o
  pequeno"). ⚠️ **Verificar ao vivo antes de fechar a fase:** `--control-height-sm` é
  24px — um ícone de 24px dentro de um botão de 24px de altura não sobra padding.
  `Button` do gatilho de Configurações sobe para `size="md"` (28px) se o `lg` não
  couber com folga visual em `sm`; decidir pela captura, não pela aritmética.
- Cada ícone decorativo continua sem `aria-*` (o pacote aplica `aria-hidden`
  sozinho — Context7, `hasA11yProp`); o rótulo acessível continua no `aria-label` do
  `<button>` pai, como já é.
- **Dois ícones novos nesta fase, não é troca de glyph — são itens de menu que hoje só
  têm texto** (`ConversationList.tsx`, dentro do `Popover` do kebab, DS5 item 8):
  `Pencil` antes de "Editar título de …", `Trash2` antes de "Excluir …", tamanho `sm`.

**Aceite:** grep por `[«»⋮×↻⌄⏸↑⚙🔍]` em `src/renderer/src` não retorna nada; os dois
itens do menu kebab têm ícone; a engrenagem lê visivelmente maior que os ícones `sm`
vizinhos, verificado ao vivo; `check:fast` verde.

### Fase 2 — `--font-mono` vira JetBrains Mono (DS5.2)

`package.json`, `src/renderer/src/shared/ui/tokens.css`,
`docs/reference/BRIEF-claude-design.md`, `.claude/skills/design-system/SKILL.md`,
`docs/HISTORY.md`.

- `pnpm add @fontsource/jetbrains-mono`.
- Importar só os pesos usados (`400`, `600` para o rótulo de linguagem que já é
  `font-weight` implícito do `.lang`, se algum peso não-400 estiver em uso — conferir
  antes de importar peso que ninguém consome): `import
  '@fontsource/jetbrains-mono/400.css'` no ponto de entrada do renderer
  (`main.tsx`, ao lado de onde `tailwind.css`/`base.css` já entram).
- `tokens.css`: `--font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code',
  Consolas, 'Liberation Mono', monospace` — a pilha do sistema **permanece como
  fallback**, não é substituída, só perde a primeira posição.
- **Reverte a decisão registrada na skill `design-system`** ("System font stack — no
  bundled webfont... A local desktop tool has no reason to ship a custom typeface") —
  atualizar a frase para registrar a exceção e o porquê (pedido explícito do usuário,
  DS5.2), e o mesmo em `BRIEF-claude-design.md` se ele repetir a afirmação. Entrada
  nova em `HISTORY.md`, mesma forma que a DS4.2/DS4.7 já usaram para decisão revertida
  a pedido.

**Aceite:** bloco de código, host:porta do Ollama (`OllamaStatus`) e nome de modelo
renderizam em JetBrains Mono nos dois temas; a pilha antiga só aparece se a fonte não
carregar (fallback, não removida); `SKILL.md`/`BRIEF` não contradizem mais o app;
`check:fast` verde.

### Fase 3 — Realce de sintaxe: hipótese nula antes de mexer (DS5.4)

`src/renderer/src/features/conversation/MarkdownMessage.tsx`.

⚠️ **Não presumir defeito.** `git diff ds-3 ds-4` nos dois arquivos de
`MarkdownMessage` está vazio — a DS-4 não tocou realce de sintaxe. O precedente
imediato (a própria DS-4, Fase 8) foi um script de verificação relatando o mecanismo
quebrado quando o problema era o driver de teste, não o app — a mesma disciplina se
aplica aqui: verificar ao vivo antes de escrever qualquer linha.

- **Passo 1, ao vivo (`pnpm dev`):** mandar duas respostas com bloco de código — uma
  com cerca rotulada (` ```sql `) e outra sem rótulo (` ``` ` solto). Comparar.
  - **Se a cercada colore e mostra "sql"**: o mecanismo está intacto.
    `rehypeHighlight`'s `detect: false` (D12.5) está fazendo exatamente o que foi
    decidido — cerca sem `language-*` não ganha classe, logo não ganha cor nem rótulo,
    porque não há do que rotular. **Isso não é a DS-4 quebrando nada — é D12.5,
    reaberta pela pergunta certa.** A fase vira: decidir se o app deveria tentar
    detectar a linguagem de um bloco sem rótulo (reabriria D12.5 com o motivo do
    descarte original ainda de pé: *"auto-detecção erra feio em trecho curto de
    chat"*) ou se o modelo deveria ser instruído a sempre rotular a cerca (fora do
    escopo deste plano — é comportamento do modelo, não de interface). **Fechar a fase
    documentando o achado**, sem mudar `detect: false` sem uma medição que justifique
    reabrir D12.5.
  - **Se a cercada NÃO colore nem mostra "sql"**: regressão real. Abrir o DevTools,
    inspecionar o `<span class="hljs-keyword">` (ou o que existir) e o computed style
    de `color` — achar quem vence a cascata sobre `.codeBlock :global(.hljs-keyword)`
    antes de escrever a correção. Só então editar.

**Aceite:** o teste com/sem rótulo rodado e documentado no diário; se hipótese A
(mecanismo intacto), a fase fecha sem alterar `MarkdownMessage.tsx`; se hipótese B
(regressão real), a causa é citada por seletor/regra vencedora antes da correção, e o
rótulo de linguagem volta a aparecer nos dois temas.

### Fase 4 — Escala tipográfica do chrome (item 6)

`src/renderer/src/shared/ui/tokens.css`.

⚠️ **Não é troca de token isolada — verificar antes de assumir "só isso".** `body`
(`base.css:64`) usa `--font-size-sm` como tamanho base; `Button`'s `SIZE` (`sm: h-24
text-xs`, `md: h-28 text-sm`) amarra tamanho de fonte à altura de controle
(`--control-height-*`), que **não** acompanha a escala tipográfica automaticamente.
`MarkdownMessage.module.css` já usa `--font-size-reading` explícito (headings em `em`
relativos a ele) — a superfície de leitura não é afetada por nada nesta fase.

- **Passo 1, ao vivo:** `pnpm dev`, capturar sidebar (lista de conversas, rodapé),
  modal de Configurações — comparar contra `notes/1.png`/`5.png` lado a lado. Anotar
  quais textos especificamente leem pequenos (rótulos de grupo "HOJE/ONTEM", dica de
  campo, badge de capacidade, texto do rodapé) vs. quais já batem com a referência.
- **Hipótese de trabalho, a confirmar pela captura:** subir só `--font-size-2xs` (11→12
  px) e `--font-size-xs` (12→13px) — os dois tamanhos mais usados em rótulo/dica/badge,
  não o `--font-size-sm` que já é o corpo padrão (13px) e a base de `Button`
  tamanho `md` (28px de altura, folga ampla mesmo sem mudar). Deixar `--font-size-sm`
  parado evita mexer em `Button` tamanho `sm` (24px de altura) além do 1px que o
  `--font-size-xs` já muda ali — verificar que esse 1px não estoura a caixa.
- Se a captura mostrar que o corpo em si (rodapé, texto de linha da lista) também
  precisa subir, **isso acopla `--control-height-sm`/`-md`** — documentar como mudança
  conjunta, não silenciosa, e ajustar as duas juntas nesta mesma fase (não empurrar
  para depois "porque já são só tokens").

**Aceite:** captura lado a lado com `1.png`/`5.png` sem divergência de escala
não-justificada; nenhum `Button` corta ou desalinha o rótulo verticalmente em nenhum
`size`; `tokens.contrast.test.ts` continua verde (mede cor, não tamanho, mas confirma
que a edição não tocou a camada errada); `check:fast` verde.

### Fase 5 — Composer: clipe, pílulas separadas, reordenação (itens 7, 9, 10-reposição)

`src/renderer/src/features/conversation/Composer.tsx`,
`src/renderer/src/features/conversation/ModelSelector.tsx` (dividido),
`src/renderer/src/features/conversation/ConversationView.tsx`, `App.tsx`,
`src/renderer/src/app/Sidebar.tsx`,
`src/renderer/src/features/open-dataset/OpenDatasetPanel.tsx` (relocado, não reescrito).

**Ordem alvo da linha de controles do composer, esquerda para direita (item 17):**
clipe · pílula de modelo · pílula de contexto · ícone de recarregar — com
pausar/enviar continuando à direita, como já é.

- **`ModelSelector.tsx` divide em duas pílulas**, cada uma com seu próprio `Popover` e
  `anchorName` — não um arquivo novo por pílula, o mesmo arquivo exporta duas funções
  (`ModelPicker` e `ContextControl`) mais o componente combinado, para não espalhar o
  estado de `models`/`ceilingOf` que as duas leem:
  - **`ModelPicker`**: pílula com nome do modelo + `ChevronDown`, abre popover com a
    lista de modelos (`optionLabel`, badges de capacidade do selecionado). O ↻
    (`RefreshCw`) **sai de dentro do popover e vira ícone próprio**, à direita da
    pílula de contexto (não mais colado ao `ModelPicker`).
  - **`ContextControl`**: pílula nova, rótulo = teto atual (`formatContext(ceiling)`,
    ex. "32k ⌄"), abre popover com o campo numérico de `numCtx`, os avisos
    `too-large`/`unaffordable`/`locked`, e o medidor (`<meter>` + "~N de M tokens") —
    tudo que hoje já vive nesse bloco, só sob um gatilho separado do nome do modelo.
  - **O contrato do `Composer` não muda** (DS5.6): `modelSelector: (budget) =>
    ReactNode` continua a mesma assinatura — `ConversationView` passa uma função que
    devolve os quatro elementos lado a lado (`<><ModelPicker.../><ContextControl
    .../><button>{RefreshCw}</button></>`), e o `Composer` continua só chamando
    `modelSelector(budget)` no mesmo lugar de sempre. Isso evita reabrir DS4.8.
- **Clipe (`Paperclip`, item 7):** `Composer.tsx` importa `useOpenDataset` direto (o
  mesmo hook que `OpenDatasetPanel.tsx` já usa) e renderiza um ícone-botão à esquerda
  da pílula de modelo. `OpenDatasetPanel.tsx` **sai da sidebar** (`App.tsx`,
  `Sidebar.tsx` content) — sem duplicar lógica, é a mesma função de topo relocada; a
  seção "Abrir arquivo" da sidebar deixa de existir.
  - ⚠️ **`useOpenDataset` é um job com progresso e cancelamento** (`useJobProgress`,
    `cancel()`), e um `popover="auto"` fecha em qualquer clique fora (DS5.5). Não
    depender de o popover sobreviver à chamada nativa de `window.api.dataset.pick()`:
    clicar em "Escolher arquivo" **fecha o popover primeiro** (mesmo idioma que o
    kebab já usa: `setOpen(false)` antes de chamar `pick()`), e enquanto
    `state.status === 'loading'` o progresso + "Cancelar" desenham **na própria linha
    do composer**, fora do popover — não dentro dele, que pode fechar a qualquer
    momento e levaria o botão de cancelar junto. Reabrir o clipe com o job pronto
    (`ready`/`error`) mostra o `StateView` de sempre (o `dl` de separador/colunas/
    linhas) dentro do popover.
  - **Verificar ao vivo, cedo na fase:** confirmar que o diálogo nativo de arquivo não
    interfere no estado do popover de forma inesperada — como o popover já fecha antes
    de `pick()` ser chamado, o comportamento exato do *light-dismiss* do Chromium
    sobre um diálogo nativo deixa de decidir a UX, mas vale confirmar que reabrir o
    clipe depois não herda um popover preso aberto.

**Aceite:** ordem clipe·modelo·contexto·recarregar confirmada ao vivo; `Composer`'s
prop `modelSelector` inalterada de tipo; escolher um arquivo fecha o popover antes do
diálogo nativo abrir, progresso/cancelar visíveis fora do popover durante o job;
`OpenDatasetPanel` não existe mais na sidebar; `modelSelection.test.tsx` e
`contextBudget.test.tsx` ajustados só onde a fiação mudou; `check:fast` verde; nível 4
nos dois temas.

### Fase 6 — Copiar no bloco de código (item 4)

`src/renderer/src/features/conversation/MarkdownMessage.tsx`,
`src/renderer/src/features/conversation/MarkdownMessage.module.css`,
`src/renderer/src/shared/hooks/useCopyToClipboard.ts` (novo).

- `useCopyToClipboard.ts`: hook mínimo — `copy(text): Promise<void>` via
  `navigator.clipboard.writeText` (API do Chromium, sem IPC — não toca `main`, não é
  canal novo) e um `copied: boolean` que volta a `false` depois de ~2s, para o feedback
  visual do ícone (`Copy` → `Check` por um instante).
- `pre()` em `MarkdownMessage.tsx` ganha um botão `Copy`/`Check` no canto do
  `.codeBlock`, fora do `<pre>` (mesma razão do `.lang` já estar fora — não faz parte
  da seleção de texto), copiando o texto puro do bloco (sem o rótulo de linguagem).

**Aceite:** clicar copia o conteúdo exato do bloco (sem o rótulo); o ícone confirma
visualmente por ~2s e volta ao estado normal; funciona nos dois temas; `check:fast`
verde.

### Fase 7 — Três ícones ao fim do turno do assistente (item 5, DS5.7)

`src/renderer/src/features/conversation/ConversationView.tsx`.

- Reusa `useCopyToClipboard` da Fase 6. Três `Button variant="ghost" size="sm"` numa
  linha, abaixo do texto de cada mensagem do assistente (mesmo lugar onde
  `STOPPED_LABEL` já aparece condicionalmente):
  - `Copy` — funcional, copia `messageText(message)`.
  - `Share2` — **`disabled`**, não um `onClick` vazio (DS5.7): um botão clicável sem
    efeito é pior sinal que um botão visivelmente inerte. `aria-label="Compartilhar
    (em breve)"`.
  - `RotateCcw` — **`disabled`**, mesma razão, `aria-label="Gerar novamente (em
    breve)"`. Ícone diferente do `RefreshCw` do recarregar modelos (Fase 1), para não
    ler como a mesma ação em dois lugares.

**Aceite:** os três ícones aparecem só sob mensagem do assistente, nunca do usuário;
copiar funciona; os outros dois estão visivelmente desabilitados, não apenas inertes;
`check:fast` verde; nível 4 nos dois temas.

### Fase 8 — QA visual e fechamento

- Revisão ao vivo nos três estados de tema, comparando contra as cinco imagens de
  `notes/` ponto a ponto (engrenagem grande, sidebar com ícones e tipografia,
  composer com clipe, kebab com ícones, seletor de modelo com pílulas separadas).
- **Lista de não-alvos:** cartão de anexo como artefato de mensagem (mecanismo
  continua no plano 16 — o clipe desta fase só relocaliza o `OpenDatasetPanel`
  existente, não cria anexo em conversa); "compartilhar"/"atualizar" funcionais (fora
  de escopo, DS5.7); detecção automática de linguagem em bloco sem rótulo (só se a
  Fase 3 achar hipótese A e uma medição justificar reabrir D12.5 — não decidido por
  omissão).
- Medir bundle (CSS/JS — `lucide-react` e `@fontsource` somam ao JS/assets); diário
  preenchido; entrada em `HISTORY.md` § Entregas; mover plano para `implemented/`;
  `ROADMAP.md`/`plan/active/README.md` atualizados.

**Aceite:** as cinco referências de `notes/` reproduzidas no essencial, nos três
estados de tema; registro fechado pelo ciclo de vida do plano.

---

## Arquivos críticos

| Arquivo | Papel |
|---|---|
| `src/renderer/src/shared/ui/icon.ts` | `ICON_SIZE`/`ICON_STROKE` (Fase 1) |
| `src/renderer/src/features/conversation/ModelSelector.tsx` | dividido em `ModelPicker`/`ContextControl` (Fase 5) |
| `src/renderer/src/features/conversation/Composer.tsx` | clipe, ordem dos controles (Fase 5) |
| `src/renderer/src/features/open-dataset/OpenDatasetPanel.tsx` | relocado da sidebar para o popover do clipe (Fase 5) |
| `src/renderer/src/features/conversation/MarkdownMessage.tsx` | copiar no bloco (Fase 6), diagnóstico de realce (Fase 3) |
| `src/renderer/src/features/conversation/ConversationView.tsx` | três ícones do turno (Fase 7) |
| `src/renderer/src/shared/hooks/useCopyToClipboard.ts` | novo, Fases 6-7 |
| `src/renderer/src/shared/ui/tokens.css` | `--font-mono` (Fase 2), escala do chrome (Fase 4) |
| `.claude/skills/design-system/SKILL.md`, `docs/reference/BRIEF-claude-design.md` | reversão da decisão "sem webfont" (Fase 2) |

## Verificação

- **A cada fase:** `pnpm check:fast` verde; revisão ao vivo nos dois temas.
- **Nível 1/2:** `useCopyToClipboard` (mock de `navigator.clipboard`),
  `ModelPicker`/`ContextControl` cobertos onde `modelSelection.test.tsx` já cobria
  `ModelSelector`; nenhuma função pura nova de peso além disso.
- **Nível 4 (único que prova):** ordem dos controles do composer; popover do clipe
  sobrevivendo ao ciclo escolher-arquivo→progresso→resultado; engrenagem
  visivelmente maior; JetBrains Mono carregada (não só declarada); realce de sintaxe
  com/sem rótulo, nos dois temas.
- **Fechamento:** bundle; comparação final contra as cinco imagens de `notes/`.

## Validação por advisor

Consulta única nesta sessão, antes da escrita do plano, incorporada acima: confirmou a
decomposição em nove fases e a ordem ("mais acoplado por último"); apontou que a Fase 4
(tipografia do chrome) não é troca de token isolada — `body` herda `--font-size-sm` e
`Button` amarra tamanho de fonte a `--control-height-*`, que não acompanha sozinho, daí
a fase abrir com captura ao vivo em vez de assumir o valor; corrigiu o diagnóstico da
Fase 3 para partir de hipótese nula (o `git diff ds-3→ds-4` vazio já prova que a DS-4
não quebrou nada — o candidato mais provável é cerca sem rótulo se comportando como
`D12.5` sempre decidiu, não regressão); apontou que mover `OpenDatasetPanel` para dentro
de um `popover="auto"` arrisca perder a superfície de progresso/cancelamento de um job
real, dali a decisão de fechar o popover antes do diálogo nativo e desenhar
progresso/cancelar na própria linha do composer; endossou Lucide, `@fontsource`, e
`disabled` (não no-op) para os dois ícones inertes do turno. Nenhuma segunda passada foi
necessária.

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 15/08/2026 | 1 | Nove fases, um commit cada. `lucide-react` substitui os glyphs Unicode; JetBrains Mono auto-hospedada; escala do chrome recalibrada (+1px nos quatro degraus de baixo, `lg` parado), auditada ao vivo com a sidebar semeada via IPC direto — sem depender do Ollama. **Fase 3 fechou com hipótese nula confirmada duas vezes:** o realce de sintaxe nunca esteve quebrado, `detect: false` (D12.5) se comporta como decidido — fase encerrada **sem alterar** `MarkdownMessage.tsx`. | **DS-5 concluído**, mais dois commits de correção |
| 15/08/2026 | 1 (revisão do usuário) | Cinco desvios de padrão vivos que **nenhuma fase tinha pego, porque nenhuma comparou o *box model* dos botões de ícone-só**: `Button` ganhou o eixo `shape="square"`; o `+` virou `Plus` num `span` interno (o `Button` embrulha todos os filhos num único `span`, então o `gap` da base nunca separava o sinal do texto); `Field` ganhou `inline`. | corrigido e verificado ao vivo nos dois temas |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| `@fontsource/<fonte>/400.css` traz subset demais, e o CSP bloqueia o que o Vite inlina | [`ARMADILHAS.md`](../../ARMADILHAS.md) § Arquivadas |
| Decisões DS5.1–DS5.7 | [`DECISOES.md`](../../DECISOES.md) |