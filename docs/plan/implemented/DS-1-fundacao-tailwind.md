# DS-1 — Fundação Tailwind v4 sobre os tokens

**Depende de:** [05 — Design tokens](05-design-tokens.md) e [10 — Cor, contraste e tema claro](10-cor-contraste-e-tema-claro.md) · **Entrega:** a camada de utilidade instalada e provada, o `guard.mjs` estendido para o novo vetor de violação, e os seis primitivos de `shared/ui/` migrados como prova de que funciona ponta a ponta.

> Primeiro da [trilha DS](../active/README.md#a-trilha-de-design-system-ds-n). **Aceite global, e é o que define o plano: zero mudança visual.** Nenhum pixel muda. Se a tela ficou diferente, algo saiu errado — é o critério mais barato de verificar que existe para uma migração, e o motivo de os ajustes de interface estarem no DS-3 e não aqui.
>
> Motivo da adoção e as alternativas descartadas: [`HISTORY-archive.md`](../../HISTORY-archive.md) § *Tailwind v4 entra*. As restrições que a ferramenta externa de design recebeu: [`reference/BRIEF-claude-design.md`](../../reference/brief-claude-design/README.md).
>
> **O design system é um envelope** — define a linguagem visual e não constrói feature. A régua e o porquê são da skill [`design-system`](../../../.claude/skills/design-system/SKILL.md); o alvo e a tabela de distância são do [handoff](../../reference/handoff-ds-ago2026/README.md). **O que isso significa aqui:** este plano entrega o *vocabulário* do envelope — a camada de utilidade e os seis primitivos —, não a aparência final. Consequência prática nos passos 4 e 5: quando um primitivo precisar de uma variante que o alvo pede e hoje não existe (botão de ícone circular, `Button` contornado), **anote e não construa** — variante sem consumidor é ponto de extensão especulativo, que o [`CLAUDE.md`](../../../CLAUDE.md) recusa, e o DS-3 a cria junto com quem a usa.

---

## O caso

Os tokens estão certos e medidos desde a fase 10, mas escrever componente contra eles custa um arquivo `.module.css` por componente — 15 arquivos, 1.050 linhas. A [D5.1](05-design-tokens.md) adiou o Tailwind prevendo que ele poderia entrar depois **lendo o mesmo arquivo**, sem reescrever token. A previsão se confirmou, e o mecanismo que a torna verdadeira é `@theme inline`.

O que este plano **não** é: um redesenho. Nenhum token muda de valor, nenhum componente muda de aparência, nenhuma tela ganha ou perde elemento.

**Três fatos do repositório que o desenho respeita:**

1. `tokens.css` é lido por `tokens.contrast.test.ts` com expressão regular sobre `:root { }` e sobre o bloco `@media prefers-color-scheme: light` — 34 asserções WCAG AA. A estrutura do arquivo não é nossa para reorganizar.
2. A especificação do v4 proíbe `@theme` dentro de `@media`, e o tema claro do projeto vive exatamente ali.
3. As guardas 6 e 7 do [`guard.mjs`](../../../.claude/hooks/guard.mjs) são condicionadas por `if (isModuleCss)`. Quando os módulos saírem, elas **não passam a falhar — passam a nunca executar**, em silêncio.

---

## Passo 0 — Prova de conceito, com poder de veto ✅ **concluído em 12/08/2026**

> **Resultado: os dois riscos não se confirmaram. O plano segue como escrito.** Medido com `tailwindcss` e `@tailwindcss/vite` **4.3.3** (nenhum prompt de `allowBuilds` — o binário do Oxide entra como prebuild, sem script de instalação). Sonda descartada, `src/` intacto, `check:fast` verde com 333 testes.
>
> | | Resultado |
> |---|---|
> | **Risco A** — `@utility` em dev | ✅ **compila.** `.bg-accent { background-color: var(--color-accent) }` presente no CSS servido pelo dev server *e* no bundle de produção. A issue #18760 não afeta este projeto |
> | **Risco B** — auto-referência | ✅ **funciona** — mas por um mecanismo que precisa ficar escrito, ver D1.5 abaixo |
> | Paleta padrão desligada | ✅ `bg-slate-800` computa `rgba(0, 0, 0, 0)`; zero ocorrências de `slate-800` no bundle |
> | **Custo em CSS** | 34,77 kB → **45,97 kB** (+11,2 kB, quase tudo *preflight*, com só três utilidades geradas). O saldo real fica negativo conforme os 15 módulos CSS saírem no DS-2 |
> | **Custo em JS** | **zero** — 1.558,97 kB antes e depois, como esperado de uma ferramenta de build |
>
> Medição do risco B feita no Chromium **148.0.7778.280** — o que o Electron 42 embute, não uma tabela de compatibilidade —, carregando `tokens.css` e o CSS gerado na mesma ordem do `main.tsx` e lendo `getComputedStyle`:
>
> ```
> bg-surface  -> rgb(30, 32, 35)    = #1e2023 = --gray-3   ✅
> text-text   -> rgb(245, 246, 247) = #f5f6f7 = --gray-12  ✅
> bg-accent   -> rgb(13, 91, 217)   = #0d5bd9 = --blue-9   ✅
> --color-surface computa para #1e2023, idêntico a --gray-3 — sem ciclo
> ```

**Sem migrar nada.** Uma sessão curta que responde duas perguntas de sim ou não. Enquanto elas não estiverem respondidas, nenhum outro passo começa — e se a resposta for não, o plano muda de forma antes de custar trabalho.

### Risco A — `@utility` sob electron-vite em modo de desenvolvimento

A [issue #18760 do tailwindcss](https://github.com/tailwindlabs/tailwindcss/issues/18760) relata que diretivas `@utility` customizadas **não compilam** quando o Vite usa `config.root` — funcionam em build e preview, falham em `dev`. Aberta desde ago/2025, sem resposta de mantenedor.

Este projeto está no caso: `src/renderer/index.html` carrega `/src/main.tsx` por caminho absoluto, o que só resolve com o root do Vite em `src/renderer` — que é o que o electron-vite define.

**A forma da falha é o motivo do veto:** funciona no build, quebra no dev. O ciclo de trabalho inteiro é `pnpm dev`, então a versão vista o dia todo seria a sem as utilidades.

**Como medir:** um `@utility bg-accent` mínimo, um elemento que o use, `pnpm dev`, e olhar se a cor aparece. Depois `pnpm build && pnpm start` para confirmar a assimetria, se ela existir. A issue tem um ano — pode ter sido corrigida sem alguém fechá-la, e é por isso que se mede em vez de presumir.

**Se falhar:** o fallback é a alternativa descartada em ago/2026 — renomear os quatro sólidos para `--color-accent-solid` etc., pondo-os no `@theme inline` normalmente. `text-accent-solid` passa a compilar, mas lê como erro evidente. Custa 4 tokens e as linhas correspondentes de `tokens.contrast.test.ts`. **A D10.1 deixa de ser impossível e volta a ser detectável** — é uma perda real, e o registro dela é o que impede que alguém a reintroduza achando que foi descuido.

### Risco B — auto-referência de nome no `@theme inline`

Os tokens semânticos do projeto já se chamam `--color-surface`, `--color-text`, `--color-border` — **exatamente o namespace que o Tailwind usa**. O mapeamento natural é auto-referente:

```css
@theme inline {
  --color-surface: var(--color-surface); /* ← o mesmo nome dos dois lados */
}
```

O exemplo canônico da documentação usa nomes **distintos** (`--acme-canvas-color` → `--color-canvas`), e o caso de nome idêntico não está documentado. Com `inline`, a utilidade deve receber `background-color: var(--color-surface)` apontando para a declaração de `:root` — mas se o Tailwind também emitir `:root { --color-surface: var(--color-surface) }`, o ciclo invalida a propriedade e a cor some.

**Como medir:** o mesmo protótipo do risco A, com um `bg-surface` auto-referente, conferindo a cor na tela e o CSS gerado no inspetor. Nos **dois** temas — é no tema claro que um ciclo apareceria como "não aplicou nada".

**Se falhar:** o `@theme inline` mapeia para nomes de utilidade distintos onde houver colisão (`--color-app-surface: var(--color-surface)` → `bg-app-surface`). Feio, e barato. **Não** renomear a camada semântica do projeto: ela é lida pelo audit de contraste e pelo guard.

**Aceite do passo:** as duas respostas registradas neste arquivo, com o que foi observado. Nenhum arquivo do `src/` alterado — o protótipo é descartável.

---

## Passo 1 — Instalação e a camada de utilidade ✅ **concluído em 12/08/2026**

> **A camada existe e o aceite passou — mas o passo encontrou o que o plano não previa: o *preflight*.** Ele entra junto com `@import 'tailwindcss'` e é um reset **de página web** onde o `base.css` é um reset **de desktop**. Quatro divergências medidas, todas corrigidas no `base.css`, e a mais cara é invisível em qualquer captura da tela principal.
>
> | O que o preflight faz | Consequência medida |
> |---|---|
> | `* { margin: 0 }` | **o modal de Configurações renderiza em `rect=0,0`** em vez de centralizado — leva junto o `dialog { margin: auto }` da folha do navegador, que é *como* um modal se centraliza |
> | `font: inherit` em controle | `line-height` de `normal` para `1.5` em todo botão e campo: rótulo 1px acima, `section` da lista 9px mais alta |
> | `* { margin: 0 }` (de novo) | `p.locked` do `ModelSelector` perdeu o `1em` do navegador — 11px. A irmã `.tooBig` já declarava `margin: 0`; a inconsistência existia e só o preflight a revelou |
> | `::placeholder`, `option`, `meter` | cor do *placeholder* reescrita como `color-mix(currentcolor 50%)`; padding do popup nativo e borda do `<meter>` zerados |
>
> **Aceite verificado, não afirmado:** `bg-surface`, `p-6` (=16px), `rounded-md`, `text-reading`, `font-ui`, `bg-accent`, `bg-danger` e `hover:bg-accent-hover` lidos do CSS gerado; **`text-accent` e `bg-slate-800` ausentes**; `p-4` vale `var(--space-4)` = 8px. `tokens.contrast.test.ts` passa **sem uma linha alterada** (`git diff` do arquivo, vazio). `check:fast` verde, 333 testes.
>
> **Zero mudança visual, medido:** captura antes e depois nos dois temas, 1280×800, `userData` fixo — **0 pixels diferentes**, `maxDelta` 0. Antes das quatro correções eram 1,19% no escuro e 1,20% no claro. Mais os retângulos de todos os elementos do DOM, idênticos. Modal reconferido ao vivo: `rect=430,193`.
>
> **Custo:** CSS **34,77 → 47,28 kB** (+12,51 kB, quase tudo preflight). JS **1.558,97 → 1.558,97 kB — zero**, byte a byte. O saldo do CSS fica negativo conforme os 15 módulos saírem no DS-2.

✅ **A instalação já aconteceu no passo 0** — `tailwindcss` e `@tailwindcss/vite` **4.3.3** estão em `devDependencies`, validados em dev e em build. Falta o plugin no bloco `renderer` do `electron.vite.config.ts` — **só nele**; `main` e `preload` não recebem nada.

A camada mora em **arquivo próprio**, `src/renderer/src/assets/tailwind.css`, importado por `main.tsx` depois de `tokens.css`. Não dentro do `tokens.css`: o compromisso central deste plano é que aquele arquivo não muda, e concentrar a camada num arquivo separado o torna literal em vez de prometido.

Conteúdo: `@import 'tailwindcss'`, o `@theme inline` com todos os defaults desligados (`--color-*`, `--spacing`, `--text-*`, `--radius-*` em `initial`) e os tokens do projeto mapeados, e os `@utility` dos sólidos.

**Aceite:** `bg-surface` e `p-6` (=16px) compilam; `bg-slate-800` e `p-4`-valendo-16px **não**; `text-accent` não existe (ou, sob o fallback do passo 0, lê como erro); `tokens.contrast.test.ts` passa **sem uma linha alterada** — é o teste que prova que o arquivo de tokens seguiu intacto.

Dois desvios do escrito acima, ambos decididos na execução e ambos por consistência com o próprio plano:

- **Cinco namespaces desligados, não quatro.** `--font-*` entrou junto, porque `font-sans`/`font-serif` do Tailwind conviveriam com `--font-ui` — que é a forma exata de "dois lugares decidindo" que este plano existe para evitar. Medido antes de adotar, porque o palpite ia ao contrário: **`--font-*: initial` não leva `--font-weight-*` junto**, e `font-bold` sobrevive. Os namespaces são casados por chave inteira, não por prefixo de texto.
- **Cinco `@utility`, não quatro.** `--color-accent-hover` também é sólido de preenchimento, e `text-accent-hover` sobre `--color-surface` dá **2,44:1** — é o mesmo defeito que o ⚠️ do passo 2 aponta no pacote de handoff. Quatro famílias de cor, cinco nomes.

---

## Passo 2 — `base.css` como `@layer base` ✅ **concluído em 12/08/2026**

Meia sessão. ⚠️ **O passo 1 já acrescentou um bloco a este arquivo** — as quatro correções ao preflight (DS1.6). Elas entram no `@layer base` junto com o resto e continuam vencendo, porque `base.css` é importado **depois** de `tailwind.css` e, dentro da mesma camada, quem vem depois ganha.

O arquivo vira `@layer base`, preservando o que é comportamento de aplicativo de desktop: `user-select: none` na raiz com `.selectable`, `overscroll-behavior: none`, a scrollbar fina, `:focus { outline: none }` com `:focus-visible` de 2px, e o bloco `prefers-reduced-motion`.

⚠️ **O `base.css` do pacote de handoff não serve.** Ele acrescentou duas regras de link que não existem no repositório, e a segunda pinta `a:hover` com `--color-accent-hover` — um sólido de preenchimento usado como cor de texto, **2,44:1** sobre `--color-surface`, contra o mínimo de 4,5. É a mesma classe de bug que a fase 10 mediu e matou, chegando por duas linhas. Usar o arquivo do repositório.

**Aceite:** foco por teclado continua mostrando o anel e por mouse não; seleção de texto continua funcionando só em `.selectable`.

---

## Passo 3 — O ramo `.tsx` do `guard.mjs` ✅ **concluído em 12/08/2026**

Uma sessão, e **antes** de qualquer migração. Depois seria tarde: a rede sumiria durante a travessia, que é exatamente quando ela é necessária.

Guarda nova, inspecionando `.tsx` sob `src/renderer/`: cor literal (`#hex`) dentro de `className` ou de `style={{ }}`, e valor arbitrário de cor (`bg-[#…]`, `text-[#…]`, `border-[#…]`). O `--color-*: initial` do passo 1 já mata a paleta padrão em tempo de compilação; **o valor arbitrário é o que sobra**, e é o equivalente exato do que a guarda 6 bloqueia hoje no CSS.

As guardas 6 e 7 existentes **permanecem** — `MarkdownMessage.module.css` continua sendo um módulo CSS, e continua precisando delas.

**Aceite:** provocar a guarda uma vez, de propósito, e ver a saída 2. Guarda que nunca falhou é guarda não verificada.

---

## Passo 4 — Os primitivos com variante: `Button` e `Field` ✅ **concluído em 12/08/2026**

Uma sessão. São os dois que têm matriz de variantes (`variant` × `size` × `loading`), e por isso os que definem o padrão que o resto segue: as combinações saem para constante fora do JSX; layout de 3–4 classes fica inline.

Dois comportamentos a preservar, e ambos são sutis o bastante para se perder numa migração: `Button` esconde o rótulo com `visibility: hidden` durante `loading` — não `color: transparent` — para o spinner herdar `currentColor` e acertar a cor do variante sem uma cor extra por variante; `Field` clona o `children` para injetar `id`/`aria-describedby` no controle real, o que o mantém agnóstico ao tipo de input.

**Aceite:** os testes de nível 2 existentes passam sem alteração; as duas telas que usam `Button` estão pixel a pixel iguais nos dois temas.

---

## Passo 5 — Os primitivos sem variante: `Panel`, `Toolbar`, `Dialog`, `StateView` ✅ **concluído em 12/08/2026**

Uma sessão. Quatro arquivos, 108 linhas de CSS somadas.

⚠️ `Dialog` é o `<dialog>` nativo com `showModal()` e `closedby="any"`. Estilizar por utilidade, **nunca trocar o elemento** — camada superior, foco preso, `Esc`, foco devolvido ao gatilho e `::backdrop` vêm da plataforma (D13.8, verificado no Chromium 148). O `::backdrop` não é alcançável por utilidade em `className`; fica no `@layer base` ou num bloco CSS próprio.

**Aceite:** abrir Configurações, `Esc` fecha, foco volta ao gatilho, o scrim continua com a opacidade certa nos dois temas.

---

## Passo 6 — Fechamento ✅ **concluído em 12/08/2026**

> **O aceite global foi verificado de ponta a ponta: 0 pixels de diferença entre o commit anterior ao plano e o estado final**, nos dois temas, 1280×800, `userData` fixo. Não é afirmação — é a mesma comparação que rodou a cada passo.
>
> | | Antes | Depois |
> |---|---|---|
> | **JS do renderer** | 1.558,97 kB | **1.558,34 kB** — *menor* |
> | **CSS do renderer** | 34,77 kB | **50,11 kB** (+15,34) |
> | CSS dos seis primitivos | 225 linhas | **48** (só o `Dialog`) |
> | Módulos CSS no renderer | 15 | **11** · 877 linhas |
> | `check:fast` | 333 testes | **333 testes**, nenhum alterado |
>
> **O JS encolheu**, e é o dado que não se esperava: cinco `import styles from './X.module.css'` a menos valem mais que o zero que uma ferramenta de build custa. A série do renderer que o projeto mantém (573 → 951 na fase 11 → 1.302 na 12) ganha um ponto que **não sobe**.
>
> O CSS sobe 15,34 kB e **o saldo ainda é negativo a receber**: os 11 módulos restantes somam 877 linhas, e o DS-2 leva 10 deles. O preflight responde por ~11 kB desse aumento e é custo fixo, pago uma vez.

Meia sessão. `pnpm check:fast` verde, os dois temas conferidos ao vivo, e **o tamanho do bundle do renderer medido antes e depois** — o projeto registra esse número a cada plano que mexe em dependência (573 → 951 kB na fase 11, → 1.302 kB na fase 12), e a série só é útil se ninguém pular um ponto.

Diário preenchido. O DS-2 nasce na sessão em que começar.

### O que o alvo pede e os primitivos não têm

Anotado, **não construído** — a régua do envelope: variante sem consumidor é ponto de extensão especulativo, e o DS-3 as cria junto de quem as usa.

| Falta | Onde o alvo usa |
|---|---|
| Variante **contornada** — fundo transparente com borda visível | o "Nova conversa" da sidebar; hoje o mais próximo é `secondary`, que tem fundo elevado |
| Forma de **ícone circular** | o envio `↑` e a pausa do composer; hoje toda variante é retangular com `rounded-md` |

⚠️ **E o que não falta, verificado token a token:** os primitivos do handoff são **transcrição** dos do repositório — cinco dos seis idênticos, e no `Dialog` o repositório é o melhor dos dois (tem o `--duration-fast` do fade que o handoff perdeu). Para este plano, *seguir o envelope* e *copiar o repositório* eram a mesma ação. O que o alvo redesenha é **composição e chrome**, não primitivo.

---

## Decisões

### DS1.1 — A camada mora em arquivo próprio, e `tokens.css` não muda

O compromisso que sustenta o plano inteiro é o audit de contraste continuar lendo o arquivo que sempre leu. Pôr o `@import 'tailwindcss'` dentro do `tokens.css` funcionaria — o primeiro `:root` do arquivo continuaria sendo o do projeto, e o regex do teste ainda casaria —, mas transforma um invariante verificável (*"o arquivo não mudou"*) em juízo (*"o arquivo mudou, mas não de um jeito que quebre o regex"*). O segundo envelhece; o primeiro não.

### DS1.2 — O passo 0 tem poder de veto, e o fallback é decidido antes

Dois riscos externos, nenhum sob nosso controle, ambos capazes de mudar a forma da solução. Descobri-los no meio da migração custaria desfazer trabalho; descobri-los antes custa uma sessão curta. É a aplicação literal do princípio do [`CLAUDE.md`](../../../CLAUDE.md) — *instale, valide com `pnpm dev`, commite* — a um caso em que a validação vem antes da instalação de verdade.

O fallback de cada risco está escrito acima **antes de se saber se será preciso**, e isso é deliberado: um fallback escolhido sob a frustração de descobrir o problema é escolhido pelo caminho mais curto, não pelo melhor.

### DS1.3 — A guarda nasce antes da migração, não depois

Guarda escrita depois é guarda escrita sobre código já migrado, isto é, calibrada para não reprovar o que já existe. Escrita antes, ela reprova o primeiro erro real. E o intervalo entre "os módulos CSS saíram" e "a guarda `.tsx` entrou" é exatamente a janela em que a regra de token não tem fiscalização nenhuma — este passo existe para que essa janela tenha duração zero.

### DS1.4 — Zero mudança visual é o aceite, e não é uma formalidade

É o que torna cada passo verificável em segundos e commitável sozinho, que é a condição para uma sessão terminar em vez de se arrastar. Também é o que mantém a bissecção barata: se a tela mudar no DS-3, a causa está no DS-3.

O corolário incômodo e assumido: **melhorias visuais notadas durante a migração não entram aqui.** Vão para o DS-3, ou para uma linha no diário. Uma migração que "aproveita para ajustar" perde o único critério que a torna auditável.

### DS1.5 — A auto-referência funciona porque `tokens.css` está **fora** de toda `@layer`, e isso vira invariante

Medido no passo 0, e é o achado que o plano não previa. Com `@theme inline`, o Tailwind **emite a variável mesmo assim** — a documentação descreve o efeito sobre a utilidade e não menciona este lado:

```css
@layer theme {
  :root, :host {
    --color-surface: var(--color-surface);   /* auto-referência */
  }
}
```

Isolada, essa declaração é um ciclo, e um ciclo faz a custom property computar para o valor inválido-garantido — todas as superfícies do aplicativo ficariam transparentes. **Não acontece**, e o motivo é de cascata, não de sorte: `tokens.css` declara `--color-surface` **fora de qualquer camada**, e declaração sem camada vence declaração em camada — *independentemente da ordem dos arquivos*. A declaração cíclica perde a cascata e nunca chega a ser computada.

**A consequência é um invariante novo, e ele não é óbvio para quem não leu isto:** o dia em que alguém envolver `tokens.css` num `@layer` — para "organizar", ou seguindo um guia de Tailwind que recomenda `@layer base` —, a declaração do projeto passa a disputar em igualdade com a do Tailwind, o ciclo se torna alcançável, e **todas as cores somem de uma vez**. É falha total, silenciosa em build, e cuja causa está num arquivo que não foi editado.

Por isso o passo 2 põe **`base.css`** em `@layer base` e **não** `tokens.css` — a distinção entre os dois arquivos deixa de ser organizacional e passa a ser funcional.

### DS1.6 — O preflight fica, e as divergências com o `base.css` são corrigidas uma a uma

Descartar o preflight foi considerado e recusado por um motivo mecânico: as utilidades de borda do v4 emitem só `border-width`, e contam com o `*, ::before, ::after { border: 0 solid }` do preflight para o `border-style`. Sem ele, `border-2` produz largura sem estilo — **borda invisível**, defeito que aparece só nos passos 4–5 e cuja causa está num arquivo que ninguém editou. Vale para o mesmo lote a normalização de `box-sizing`, `img`/`svg` como bloco e a herança de fonte.

O que fica então é a fronteira: **preflight é um reset de página web, `base.css` é um reset de desktop, e onde discordam quem manda é o `base.css`.** As quatro correções são nomeadas, não um `revert` genérico, e se dividem em dois grupos com vidas diferentes:

| Correção | Vida |
|---|---|
| `line-height: normal` em `button`/`input`/`select`/`textarea` | **temporária** — sai quando `Button` e `Field` carregarem `leading-*` explícito (passo 4) |
| `dialog { margin: auto }` | **temporária** — vira `m-auto` no `Dialog` (passo 5) |
| `option`, `meter`, `::placeholder` | **permanente** — pseudo-elemento e chrome nativo **não têm `className` para receber utilidade**, exatamente o argumento que já mantém o `MarkdownMessage.module.css` em CSS |

A quinta correção não é do preflight e sim do que ele revelou: `p.locked` do `ModelSelector` dependia do `1em` que o navegador dá a `<p>`, enquanto a irmã `.tooBig`, que a substitui na tela, declarava `margin: 0`. O valor foi escrito por extenso para preservar o pixel; **qual das duas está certa é pergunta do DS-3**, e o comentário no fonte diz isso.

### DS1.7 — Diff de tela é aceite de fim de passo, não ferramenta de depuração

Nasceu de fazer errado. A conferência ao vivo do passo 1 virou um laço — medir, achar uma divergência, corrigir, medir de novo — quatro vezes, e o laço custou mais que os consertos somados. O mecanismo estava certo e a cadência, errada: **o diff responde "mudou?", e a pergunta "o que mudou?" tem instrumento melhor e mais barato**, que é o despejo de `getBoundingClientRect` de todo o DOM comparado entre os dois builds. Ele nomeia o elemento; o diff de pixel só aponta uma caixa.

Forma para o DS-2 em diante: **despejo de retângulos durante o trabalho, diff de pixel uma vez no fim, como aceite.** E o corolário que justifica manter os dois: o diff de pixel pegou o `::placeholder` e o `<meter>`, que são cor e não geometria, e portanto invisíveis ao despejo de retângulos.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 12/08/2026 | 3 | **Passos 2 a 6 — plano concluído.** `base.css` em `@layer base`; guarda 8 no `guard.mjs` (quatro ramos) mais a guarda 7 cobrindo o `tailwind.css`; os seis primitivos migrados, com cinco `.module.css` removidos e o do `Dialog` de 70 para 25 linhas. Medido: **0 pixels** entre o pré-Tailwind e o fim, JS **1.558,97 → 1.558,34 kB** (encolheu), CSS 34,77 → 50,11 kB, 333 testes intactos. Achado que corrigiu o método: os primitivos do handoff são transcrição dos do repositório — *seguir o envelope* e *copiar o repositório* eram a mesma ação, e isso passou a ser verificado em vez de assumido | **DS-1 concluído.** O DS-2 nasce na sessão em que começar, escrito contra a tabela de distância |
| 12/08/2026 | 2 | **Passo 1 completo.** `@tailwindcss/vite` no bloco `renderer`; `assets/tailwind.css` com `@theme inline` (5 namespaces desligados, 15 cores semânticas, 9 espaços, 4 raios, 8 tamanhos de texto, 2 famílias) e 5 `@utility` de sólido; import no `main.tsx` entre `tokens.css` e `base.css`. **O preflight foi o achado**: quatro divergências com o `base.css`, a pior sendo o modal em `rect=0,0`. Corrigidas, e o resultado é **0 pixel de diferença** nos dois temas. `tokens.css` intacto, 333 testes, CSS +12,51 kB, JS zero. D1.6 e D1.7 nasceram aqui | Passo 2. O `base.css` já ganhou um bloco no passo 1 — ler a ⚠️ do passo 2 antes de começar |
| 12/08/2026 | 1 | **Passo 0 completo.** `tailwindcss` + `@tailwindcss/vite` 4.3.3 instalados e validados; sonda descartável em dev (CSS lido do dev server) e em build; medição de `getComputedStyle` no Chromium 148 do próprio Electron. Os dois riscos caíram; a D1.5 nasceu do resultado. Custo medido: CSS +11,2 kB, JS zero. Sonda removida, `src/` intacto, `check:fast` verde (333 testes) | Passo 1. A dependência **fica instalada** — instalar, validar e commitar é uma variável por vez, e a validação já aconteceu |
