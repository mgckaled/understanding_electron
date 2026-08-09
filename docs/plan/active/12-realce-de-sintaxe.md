# 12 — Realce de sintaxe no bloco de código

**Depende de:** [10 — Cor](../implemented/10-cor-contraste-e-tema-claro.md), [11 — Markdown](../implemented/11-markdown-na-resposta-do-assistente.md) · **Entrega:** a família `--syntax-*` em `tokens.css`, coberta pelo teste de contraste, ligada ao bloco de código do markdown por classes semânticas — sem estilo inline, sem WASM, sem afrouxar a CSP

> Este plano **fecha** o adiamento que a [D10.5](../implemented/10-cor-contraste-e-tema-claro.md) e a [D11.5](../implemented/11-markdown-na-resposta-do-assistente.md) registraram, cada uma pelo seu lado. Ele não mexe em nada do markdown além do bloco de código.

---

## Por que agora, e não no gatilho que estava escrito

O gatilho combinado das duas fases era **a fatia 2 do [plano 09](09-camada-de-ia.md) gerando SQL na tela**. Ele não disparou. Este plano anda mesmo assim, e o argumento precisa ficar registrado porque contraria um adiamento tomado duas vezes.

O medo das duas decisões era o mesmo e está citado literalmente: *"calibrar cores de sintaxe sem SQL real na tela é decidir no escuro"*. Esse medo mira em **inventar** uma paleta. Não é o que vai acontecer aqui — a paleta é **importada** do `@primer/primitives`, já calibrada, para uma superfície quase idêntica à de origem:

| | GitHub | data-lab (`--color-surface-sunken`) |
|---|---|---|
| Fundo do código, claro | `#f6f8fa` | `#f5f6f7` |
| Fundo do código, escuro | `#0d1117` | `#0b0c0e` |

O que restava no escuro era uma coisa só: se o **mapeamento** lê bem em SQL de verdade. E isso se resolve com uma fixture no teste de nível 2, não esperando a fatia 2.

O gatilho fica considerado disparado. O que ele protegia — não escolher cor por gosto, contra fundo hipotético — continua protegido por outro meio: o passo 1 entrega a paleta já medida contra o teste de contraste que a fase 10 deixou pronto para isto.

---

## Decisões tomadas

### D12.1 — `highlight.js` (via `rehype-highlight`), não `shiki`

A [D11.5](../implemented/11-markdown-na-resposta-do-assistente.md) citou `shiki` como a opção óbvia. Ela deixou de ser, e o motivo é do **Electron**, não de gosto.

**`shiki` emite `style="color:#…"` inline.** O `index.html` deste projeto tem CSP com `style-src 'unsafe-inline'`, e o [`ROADMAP § 2`](../../ROADMAP.md) lista **endurecer essa CSP** como dívida aberta desde a fase 03. Adotar `shiki` no caminho padrão tranca essa dívida: o dia em que alguém remover o `'unsafe-inline'`, todo bloco de código perde a cor. Existe o `transformerStyleToClass` para contornar, e o motor Oniguruma ainda pediria `wasm-unsafe-eval` no `script-src` a menos que se troque por `createJavaScriptRegexEngine()` — dois contornos para chegar onde a alternativa já está.

**`highlight.js` emite classes semânticas** (`hljs-keyword`, `hljs-string`, `hljs-selector-tag`) e **nenhum estilo inline**. Em cadeia, isso dá:

- CSP intocada, e a dívida do `ROADMAP` continua pagável;
- `tokens.css` permanece **fonte única de cor** — as cores viram `var(--syntax-*)`, e o `guard.mjs` fica satisfeito por construção, não por exceção;
- síncrono, o que a [D12.6](#d126--durante-o-streaming-colore-se-só-bloco-fechado) aproveita.

| Descartado | Por quê |
|---|---|
| `shiki` | Estilo inline acoplado ao `'unsafe-inline'` da CSP; WASM pedindo `wasm-unsafe-eval`; assíncrono. Contornável, mas são três variáveis para ganhar precisão que o conteúdo deste app não exercita. |
| `react-syntax-highlighter` | Empacota `lowlight`/`refractor` e temas como objetos JS — mesma classe de problema da fonte de cor, com uma camada de componente por cima que não se pede. |
| Chamar `hljs.highlight()` no `components.code` | Devolve **string de HTML**, o que exige `dangerouslySetInnerHTML` — exatamente o que a [D11.2](../implemented/11-markdown-na-resposta-do-assistente.md) passou a fase inteira evitando. Descartado por segurança, não por ergonomia. |
| Escrever o tokenizador | Markdown já foi descartado como "escrevível" na D11.2 por ser gramática grande com entrada não controlada. Sete gramáticas de linguagem é a mesma armadilha multiplicada. |

### D12.2 — `rehype-highlight` é um `rehypePlugin`, e a D11.2 continua valendo

Há uma contradição aparente a resolver **no código**, não só aqui. O `MarkdownMessage.tsx` tem hoje este comentário:

> *"Do not add rehypePlugins here to 'make some HTML work'."*

`rehype-highlight` é um `rehypePlugin`. Adicioná-lo sem tocar no comentário deixa o arquivo mentindo, e a próxima sessão terá que refazer este raciocínio do zero.

A distinção que o comentário precisa passar a expressar:

| | O que faz | Entra? |
|---|---|---|
| `rehype-raw` | **Parseia HTML cru** do texto do modelo e o transforma em nós reais. É o que reabre a superfície de injeção. | **Não**, e nunca. |
| `rehype-highlight` | Percorre a árvore `hast` **que o `react-markdown` já construiu**, e acrescenta `className` a `<span>`s dentro de `<code>`. Não lê HTML, não produz string, não cria nó a partir de texto do modelo. | Sim. |

A regra real nunca foi "nenhum rehype plugin"; era **"nada que transforme texto do modelo em HTML"**. O passo 3 reescreve o comentário para dizer isso, porque a versão atual proíbe a coisa certa pelo motivo errado — e regra com motivo errado é regra que alguém contorna.

### D12.3 — A paleta vem do `@primer/primitives` atual, **não** do `github.css` do `highlight.js`

O `highlight.js` distribui um tema `styles/github.css` pronto. Ele **não entra**, e não é por causa do `guard.mjs`: é porque está desatualizado. Usa os valores do GitHub pré-2021, e dois deles **reprovam o teste de contraste deste projeto** sobre `--color-surface-sunken` no tema claro:

| Grupo | `github.css` do hljs | `@primer/primitives` atual | Sobre `#f5f6f7` |
|---|---|---|---|
| `built_in` | `#e36209` | `#953800` | **≈3,2:1 ❌** → ≈6,8:1 ✓ |
| `keyword` | `#d73a49` | `#cf222e` | **≈4,2:1 ❌** → ≈4,9:1 ✓ |

Os números acima foram calculados à mão com a mesma aritmética do `tokens.contrast.test.ts`. **O teste é o árbitro** — o passo 1 os confirma ou os corrige, e o que ele disser vai para o diário.

O arquivo do hljs continua sendo referência para uma coisa só: **quais classes agrupar**. O agrupamento dele é bom e economiza descobrir na mão que `selector-pseudo` anda com `name`.

### D12.4 — Sete tokens, camada única, e um deles diverge do Primer de propósito

**Sete grupos cobrem as sete linguagens.** Dos ~30 tokens `--prettylights-syntax-*` do Primer, 21 são cromo do GitHub — marcadores de diff, `bracketHighlighter`, `sublimeLinterGutterMark`, `carriageReturn` — que existem para telas que este app não tem.

| Token | Claro | Escuro | Classes `hljs` |
|---|---|---|---|
| `--syntax-keyword` | `#cf222e` | `#ff7b72` | `keyword`, `type`, `doctag`, `template-tag`, `template-variable`, `variable.language_` |
| `--syntax-entity` | `#6639ba` | `#d2a8ff` | `title`, `title.class_`, `title.class_.inherited__`, `title.function_` |
| `--syntax-constant` | `#0550ae` | `#79c0ff` | `attr`, `attribute`, `literal`, `meta`, `number`, `operator`, `variable`, `selector-attr`, `selector-class`, `selector-id` |
| `--syntax-string` | `#0a3069` | `#a5d6ff` | `string`, `regexp`, `meta .string` |
| `--syntax-builtin` | `#953800` | `#ffa657` | `built_in`, `symbol` |
| `--syntax-comment` | `#59636e` | `#9198a1` | `comment`, `code`, `formula` |
| `--syntax-tag` | `#116329` | `#7ee787` | `name`, `quote`, `selector-tag`, `selector-pseudo` |

Três coisas nesta tabela são decisões, não transcrição:

**`--syntax-tag` diverge do Primer no tema claro.** O Primer atual colapsa `entityTag` (`#0550ae`) em cima de `constant` (`#0550ae`) no claro, mantendo-os distintos no escuro. Mas o `highlight.js` separa `name`/`selector-tag` de `attr`/`selector-class` — seguir o Primer ao pé da letra faria `<div class="x">` sair com `div` e `class` na **mesma cor** no tema claro e em cores diferentes no escuro. Adotamos o `#116329` (o `stringRegexp` do Primer, verde no claro), preservando a distinção nos dois temas e sem sair da paleta.

**O nome é `--syntax-builtin`, não `--syntax-variable`.** O token do Primer se chama `variable`, mas na gramática do `highlight.js` ele colore `built_in`/`symbol`, enquanto `.hljs-variable` cai no grupo do `constant`. Herdar o nome do Primer criaria um token cujo nome aponta para a classe errada — o tipo de detalhe que custa vinte minutos de confusão numa sessão futura. O token se chama pelo que colore **aqui**.

**A família é de camada única.** A [D5.x](../implemented/05-design-tokens.md) fixou primitivo → semântico, com componente tocando só o semântico. `--syntax-*` é declarado direto com literal, sem primitivo por baixo, e a exceção é deliberada: a paleta é importada **como conjunto** de um sistema externo. Criar sete primitivos com um consumidor cada seria cerimônia que não abre nenhuma opção — e a regra que o `guard.mjs` de fato aplica ("nada de `#hex` fora de `tokens.css`") continua intacta.

### D12.5 — Sem cerca com linguagem, sem cor

O `highlight.js` tem `highlightAuto`, e o `rehype-highlight` o expõe pela opção `detect`. **Fica desligado** — que é o padrão do pacote e o comportamento do próprio GitHub: bloco sem *info string* renderiza sem cor.

O motivo é o mesmo dos dois: a detecção automática é lenta e erra com frequência em trecho curto, e trecho curto é o caso comum numa resposta de chat. Um `SELECT` de duas linhas identificado como Perl sai pior do que sairia sem cor nenhuma.

O rótulo de linguagem que a [D11.5](../implemented/11-markdown-na-resposta-do-assistente.md) já mostra no topo do bloco fica sendo a explicação visível: sem rótulo, sem cor, e a relação entre as duas coisas é aparente na tela.

### D12.6 — Durante o streaming, colore-se só bloco fechado

O `completePartial.ts` já rastreia a cerca aberta (`completePartial.ts:20-31`) para fechá-la — informação que ninguém usou ainda para outra coisa. Ela responde exatamente à pergunta que importa aqui: *este bloco terminou?*

Regra: **bloco fechado é colorido; bloco em construção sai monoespaçado e sem cor**, ganhando cor no instante em que o ` ``` ` de fechamento chega. Isso evita a armadilha clássica — re-tokenizar um bloco que cresce a cada token, a 4–6 tokens/s medidos na fatia 1 — sem precisar de *throttle*, cache ou memoização.

O custo é uma transição visível quando o bloco fecha. É aceitável e provavelmente desejável: sinaliza que aquele trecho terminou.

> Se a implementação mostrar que a cor "pula" de forma incômoda, o remédio é `content-visibility` ou uma transição curta — **não** colorir parcial. Bloco parcial colorido é gramática incompleta sendo tokenizada, e o resultado é cor trocada que se corrige sozinha, que é pior que cor nenhuma.

### D12.7 — `.tsx` fica degradado, com estopim registrado

Sete gramáticas entram: `sql`, `json`, `python`, `javascript`, `typescript`, `css`, `xml` (que cobre HTML). Seis funcionam bem. `.tsx` não.

> **Revisto na execução (ago/2026):** entram as **37** do `common`, não sete. O `rehype-highlight` importa `common` do `lowlight` no escopo do módulo, então restringir a opção `languages` não tira um byte do bundle — medição no diário. As sete continuam sendo as que este app exercita, e o parágrafo abaixo sobre `.tsx` não muda.

A limitação é [documentada pelos mantenedores](https://github.com/highlightjs/highlight.js/issues/2998) e é **de projeto, não bug pendente**: o `highlight.js` faz correspondência de padrões deliberadamente, não constrói parser de gramática completo. Dentro de fragmento JSX ele não trata comentário nem JS embutido, e função genérica com parâmetro de tipo logo após o nome perde o realce do nome.

Peso disso aqui: o assistente deste app gera **SQL e JSON**. `.tsx` na resposta do modelo é hipótese, não caso de uso. `.ts` puro está bem.

**Estopim:** ver um bloco `.tsx` mal colorido na tela — não prevê-lo. Aí a troca é para `shiki` com `transformerStyleToClass` e `createJavaScriptRegexEngine()`, pagando as três variáveis que a D12.1 recusou pagar agora.

---

## Passos

### Passo 1 — A paleta, e o teste que a mede

Só `tokens.css` e `tokens.contrast.test.ts`. **Nenhuma dependência ainda** — este passo é reversível com um `git revert` e entrega valor sozinho.

Os sete tokens entram no `:root` com os valores **escuros** (o tema padrão do projeto) e no bloco `@media (prefers-color-scheme: light)` com os claros, seguindo a estrutura que a fase 10 fixou.

O registro de pares do teste precisa de um ajuste estrutural: o laço atual monta o nome com `` `--color-${foreground}` `` fixo (`tokens.contrast.test.ts:114-115`), e `--syntax-*` não tem esse prefixo. Generalize para o registro carregar o nome completo do token, ou acrescente um segundo registro — o que produzir menos linha tocada.

Quatorze asserções novas: sete tokens × dois temas, todos contra `--color-surface-sunken`, mínimo 4,5.

**Aceite:** `pnpm test` verde com as 14 asserções novas. Se alguma reprovar, o valor do Primer é ajustado **e o número medido vai para o diário** — a D12.3 prevê que passem, mas previsão não é medição.
**Commit:** `feat(design): paleta de sintaxe do GitHub, medida contra o teste de contraste`

### Passo 2 — Instalar e medir

```bash
pnpm add rehype-highlight
```

Ele traz `lowlight` e `highlight.js` como dependências transitivas. **Uma variável por vez:**

1. Confira o `peerDependencies` do manifesto instalado contra o `react-markdown` 10 do projeto — ler `node_modules/`, nunca um artigo.
2. `Ctrl+Shift+P → Developer: Reload Window` (pacote novo fora do watcher).
3. Nenhum é módulo nativo: confirme que o `pnpm add` não imprimiu aviso de script de build ignorado, e **não** acrescente entrada em `allowBuilds`.
4. `pnpm dev` e `pnpm build` **antes** de tocar em código.

**Anote o bundle do renderer antes e depois.** O padrão do `rehype-highlight` registra 37 linguagens; o passo 3 vai reduzir para sete via a opção `languages`. Meça os dois estados se o build for barato — a diferença é o número que justifica o import fino.

**Aceite:** `pnpm dev` abre, `pnpm build` limpo, dois números anotados.
**Commit:** `chore(deps): rehype-highlight para o realce do bloco de código`

### Passo 3 — Ligar no `MarkdownMessage`, com o comentário corrigido

Import fino, sete gramáticas:

```ts
import rehypeHighlight from 'rehype-highlight'
import sql from 'highlight.js/lib/languages/sql'
// … json, python, javascript, typescript, css, xml
```

E o plugin configurado com `languages` explícito, sem `common`, e `detect` desligado (D12.5).

> ⚠️ Confirme no manifesto instalado que `typescript` registra o alias `tsx` e que `xml` registra `html`. Se não registrar, os aliases entram à mão no `languages` — e a descoberta vale uma linha no diário.

**O comentário do topo do arquivo é entregável deste passo**, não detalhe. Ele hoje diz "não adicione rehypePlugins"; passa a distinguir `rehype-raw` (transforma texto do modelo em HTML — nunca entra) de `rehype-highlight` (só acrescenta `className` à árvore já construída), pelos termos da D12.2.

**Aceite:** `pnpm typecheck` limpo; um bloco ` ```sql ` sai com `<span class="hljs-keyword">` no DOM, ainda sem cor.
**Commit:** `feat(renderer): realce de sintaxe por classes, sem estilo inline`

### Passo 4 — O CSS, agrupado

Sete regras em `MarkdownMessage.module.css`, dentro de `.codeBlock`, copiando o agrupamento do `github.css` e trocando os hexes por `var(--syntax-*)` — a tabela da D12.4 é a especificação.

O `guard.mjs` protege este passo por dois lados: bloqueia `#hex` no módulo (regra 6) e bloqueia `var(--syntax-x)` que não exista em `tokens.css` (regra 7). É por isso que o passo 1 vem antes — invertida, a ordem produz um bloqueio que parece erro de digitação.

**Aceite:** `guard.mjs` silencioso; inspeção visual nos dois temas com um bloco de cada uma das sete linguagens.
**Commit:** `feat(renderer): cores de sintaxe do bloco de código`

### Passo 5 — Colorir só bloco fechado

Ligar a informação que o `completePartial` já tem (D12.6): durante o streaming, o bloco ainda aberto não passa pelo realce.

Teste de nível 2, com fixture de SQL:

| Cenário | Verifica |
|---|---|
| ` ```sql SELECT … ``` ` fechado | existe `.hljs-keyword` contendo `SELECT` |
| ` ```sql SELECT ` ainda aberto | **não** existe `.hljs-*` dentro do `<pre>` |
| cerca sem info string | nenhuma classe `hljs-*`; o texto está lá (D12.5) |
| ` ```html <div class="x"> ` | `.hljs-name` e `.hljs-attr` são elementos distintos (é a D12.4 na prática) |
| resposta com `<script>` dentro de cerca | continua texto literal — o teste de segurança da D11.7 **não** regride |

O último é o que garante que a D12.2 foi lida direito: `rehype-highlight` não pode ter reaberto o que a D11.2 fechou.

**Aceite:** `pnpm check:fast` verde.
**Commit:** `test(renderer): realce por linguagem, bloco parcial sem cor, HTML ainda inerte`

### Passo 6 — Ao vivo, com o Ollama

Nenhum teste automatizado pega o que segue. Com `ollama serve` no ar, peça uma resposta com bloco de código e observe:

1. O bloco **em construção** sai sem cor e ganha cor ao fechar, sem piscar durante o crescimento.
2. Alternar o tema do Windows (claro ↔ escuro) troca a paleta sem recarregar.
3. As sete linguagens, coladas à mão no estado se o modelo não as produzir — em especial `.css` e `.html`, que a D12.4 usa para justificar o `--syntax-tag`.
4. Selecionar e copiar de dentro de um bloco colorido continua devolvendo **texto limpo**, sem os `<span>`.
5. DevTools → console limpo de violação de CSP.

O item 4 é o que mais provavelmente surpreende: o realce fragmenta o texto em dezenas de `<span>`, e é aqui que se descobre se a cópia sobreviveu.

**Aceite:** os cinco itens, com o bundle do passo 2 e o resultado do contraste do passo 1 no diário.
**Commit:** `docs: registra a validação ao vivo do realce de sintaxe`

---

## Critério de aceite da fase

```bash
pnpm check:fast && pnpm build
```

E a validação manual do passo 6, que é a que importa.

---

## O que fica para depois

- **`.tsx` com fidelidade real** — estopim na D12.7: ver um bloco TSX mal colorido. Custa trocar para `shiki` e pagar CSP + WASM + assíncrono.
- **Realce de diff** (`--syntax-markup-inserted/deleted`) — o Primer tem os tokens prontos. Gatilho: existir uma tela que mostre diff, provavelmente a pré-visualização de um passo do pipeline.
- **Realce no editor de SQL**, se a fatia 2 trouxer um campo editável em vez de um bloco somente-leitura — é outro problema (cursor, seleção, desempenho por tecla), e o `highlight.js` não o resolve.
- **Botão de copiar bloco** — continua adiado desde a D11.5, e o passo 6 item 4 gera informação nova sobre ele.
- **Números com `font-variant-numeric: tabular-nums`** no bloco — só quando houver tabela de dados dentro de código.

---

## O que muda fora deste plano

| Documento dono | O que acrescentar |
|---|---|
| [`ROADMAP § 2`](../../ROADMAP.md) | a linha do `--syntax-*` (gatilho da D10.5/D11.5) sai — foi cumprida; entra o estopim do `.tsx` (D12.7) |
| skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) | a família `--syntax-*` e o fato de ser **camada única**, com o porquê (D12.4) — é regra de primeira linha para quem for tocar em `tokens.css` |
| [`HISTORY.md`](../../HISTORY.md) § Armadilhas | ✅ **escrito (ago/2026)** — duas entradas: o `github.css` desatualizado reprovando AA (D12.3) e a opção `languages` do `rehype-highlight` que não encolhe o bundle |
| [`HISTORY.md`](../../HISTORY.md) § Decisões | ✅ **escrito (ago/2026)** — `shiki` descartado por acoplamento à CSP, não por peso (D12.1); é a alternativa que qualquer sessão futura vai propor primeiro |

> ⚠️ **Ao mover este plano para `implemented/`:** as três entradas acima linkam para `plan/active/12-realce-de-sintaxe.md`. Repontar para `plan/implemented/`. Elas foram escritas antes da conclusão porque a regra de escalonamento é *na mesma sessão*, e o caminho é o único preço disso.

Nada muda no [`ESCOPO.md`](../../ESCOPO.md): esta fase não altera o que o app faz.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-08 | 1–5 | **passo 6 pendente** | Passos 1–5 implementados; `pnpm check:fast` verde (**148 testes**, eram 128) e `pnpm build` limpo. **Contraste (passo 1):** todos os 14 passam. Escuro, o mais apertado é `comment` `#9198a1` a **6,72:1**; claro, `keyword` `#cf222e` a **4,95:1** — confirma a D12.3, já que os valores equivalentes do `github.css` do hljs dariam 4,2:1 e 3,2:1. **Bundle (passo 2):** renderer JS **951,35 → 1.301,81 kB**, CSS **16,99 → 19,45 kB**, módulos 309 → 516. São ~350 kB, da mesma ordem dos ~378 kB que a D11.2 aceitou pelo `react-markdown`. **A D12.7 foi revista por medição:** restringir `languages` às sete gramáticas produziu os **mesmos 516 módulos** das 37 do `common`, com as variantes medidas dentro de **1 kB** umas das outras (1.301,17 / 1.301,28 / 1.301,81) — ruído de minificação, não economia. Causa verificada na fonte instalada: `rehype-highlight` faz `import {common} from 'lowlight'` no escopo do módulo (`lib/index.js:30`), consumido como `settings.languages || common`, então as 37 são alcançáveis pelo bundler de qualquer jeito. Opção removida; encolher de verdade exigiria plugin próprio sobre `createLowlight`. *Lição de método: delta abaixo de 0,1% não sustenta conclusão — o que sustenta é a contagem de módulos e o mecanismo lido no `lib/`.* **Armadilha do CSS Modules:** as classes `hljs-*` são escritas pelo plugin, não pelo `.module.css`, então cada seletor precisa de `:global()` — sem isso o bundler renomeia e o sintoma é "cor nenhuma", silencioso. **Aliases confirmados no manifesto instalado**, não presumidos: `typescript`→`tsx`, `xml`→`html`, `javascript`→`jsx`, `python`→`py`. **Observação fora do escopo:** `pnpm lint` acusa 485 avisos `Delete ␍` em arquivos não tocados — `core.autocrlf=true` sem `.gitattributes` faz o working tree ser CRLF e o Prettier esperar LF. ESLint sai 0, então `check:fast` passa; é pré-existente, não desta fase. **Passo 6 não executado:** exige Ollama no ar e conferência visual nos dois temas — em especial o item 4 (copiar de dentro de bloco colorido, agora fragmentado em dezenas de `<span>`). |

| 2026-08-09 | — (nenhum passo desta fase) | **passo 6 segue pendente** | Sessão de planejamento do arco conversacional; a fase 12 não avançou. Registrado porque **muda o passo 6**: a superfície de leitura da resposta subiu de `--font-size-sm` (13px) para `--font-size-reading` (18px), em commit à parte, então a conferência visual do realce nos dois temas passa a ser contra o tamanho novo — inclusive o item 4 (copiar de dentro do bloco colorido), já que o `code` do markdown foi junto de `--font-size-xs` para `--font-size-lg`. Vai um achado a conferir na mesma passada: com o corpo em 18, `h2` e `h3` caem os dois no tamanho do corpo, porque a escala não tem degrau entre 16 e 20 — distinguidos só pelo peso. O conserto (títulos em `em` relativos ao corpo, sem token novo) está roteado para o plano 13. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [11 — Markdown na resposta do assistente](../implemented/11-markdown-na-resposta-do-assistente.md) · **Índice:** [README](README.md) · **Camada de IA:** [09 — Camada de IA e ML](09-camada-de-ia.md)
