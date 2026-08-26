# 10 — Cor: contraste medido e tema claro

**Depende de:** [05](05-design-tokens.md) · **Entrega:** todo par de cor declarado acima do limite WCAG AA nos dois temas, e um teste que reprova o próximo par que cair

> Escopo deliberadamente estreito: **cor**. Storybook, primitivos que faltam (`Dialog`, `Select`, `Tooltip`), auditoria de teclado e regressão visual **não** entram — a skill [`architecture`](../../../.claude/skills/architecture/SKILL.md) já os classifica como *barato de adiar*, e continuam custando o mesmo daqui a seis meses. Cor não: toda cor nova herda o defeito, e todo componente escrito contra token quebrado precisa ser revisitado. É o critério do projeto, não preferência.

---

## Por que esta fase existe

A [fase 05](05-design-tokens.md) entregou dois níveis de token, tema claro por `prefers-color-scheme` e a regra de nenhum componente tocar primitivo. A estrutura está certa. **Os valores não foram medidos**, e nove pares em uso hoje estão abaixo do limite.

Auditoria de todos os pares semânticos contra WCAG 2.1 AA (4,5:1 para texto):

### Tema escuro

| Par | Medido | Onde |
|---|---|---|
| `on-accent` sobre `accent` | **2,96:1** | rótulo do `Button` primário — o "Enviar" do chat |
| `on-accent` sobre `accent-hover` | **2,40:1** | o mesmo botão sob o cursor |
| `on-accent` sobre `danger` | **3,62:1** | `Button` variante danger |
| `text-faint` sobre `surface` | **2,56:1** | rótulo de autoria no chat, `hint` do `Field` |
| `danger` sobre `surface` | 4,17:1 | mensagem de erro do `Field` — limítrofe |

### Tema claro

| Par | Medido |
|---|---|
| `warn` sobre `surface` | **1,19:1** |
| `ok` sobre `surface` | 1,85:1 |
| `accent` sobre `surface` | 1,87:1 |
| `danger` sobre `surface` | 2,29:1 |

O caso que resume tudo: `AiChatPanel.module.css:93` pinta `.unavailable` com `--color-warn`. **A mensagem "rode `ollama serve`" — que existe exatamente para o momento em que nada funciona — tem 1,19:1 no tema claro.** É o texto mais importante do painel e o único ilegível.

> 🔍 Três pares que uma auditoria ingênua marca como falha **não são**: `border`/`surface`, `surface`/`bg` e `surface-raised`/`surface`. O limite de 3:1 do WCAG 1.4.11 vale para o que identifica um componente ou seu estado, não para separação decorativa de superfície. Ficam fora do registro do passo 1 — um verificador que grita onde não há problema é desligado na terceira vez.

### Nada do que o projeto roda pega isto

`typecheck`, `lint`, `test`, os quatro hooks e o `security-boundary.spec.ts` passam verdes com `warn` a 1,19:1. É a mesma classe da [armadilha da lista branca](../../HISTORY.md): a regra existia, estava escrita, e nada a verificava no caminho que importa.

---

## Decisões tomadas

### D10.1 — Um token de cor de estado tem **duas** formas, e confundi-las é a causa raiz

Este é o achado, e ele é maior que "faltou redefinir quatro variáveis no tema claro".

`--amber-9: #f5a524` é uma cor **sólida**: existe para preencher um fundo. `--color-warn` aponta para ela, e `.unavailable` a usa como cor de **texto**. No fundo escuro isso dá 8,00:1 e funciona — por acidente, porque um amarelo saturado é claro. No fundo branco dá 1,19:1.

O mesmo vale para os outros três:

| Primitivo | Como fundo sólido (texto branco) | Como texto (sobre surface escura) |
|---|---|---|
| `--accent-9: #4c8dff` | **2,96:1** ✗ | 5,10:1 ✓ |
| `--red-9: #e5484d` | **3,62:1** ✗ | 4,17:1 ✗ |
| `--amber-9: #f5a524` | — | 8,00:1 ✓ |
| `--green-9: #30a46c` | — | 5,17:1 ✓ |

**`--accent-9` é literalmente uma cor de texto sendo usada como fundo de botão.** Nenhum valor único serve às duas funções: fundo sólido precisa ser escuro o bastante para carregar texto claro; texto precisa ser claro o bastante para viver sobre superfície escura. São requisitos opostos.

A separação vira estrutura de nome:

```css
--color-accent        /* sólido — preenche fundo */
--color-on-accent     /* rótulo sobre esse fundo */
--color-accent-text   /* texto e foco sobre superfície */
```

E o mesmo para `danger`, `warn` e `ok`. É o que Radix, Material e Tailwind fazem, cada um com sua nomenclatura, e pela mesma razão física.

### D10.2 — Primitivo continua sendo fato; o tema escolhe qual fato usar

A [fase 05](05-design-tokens.md) fixou que "primitivos permanecem os mesmos números em ambos os temas" e que o tema claro redefine só a camada semântica. **A regra continua de pé e não é relaxada.**

O que muda é a quantidade de primitivos: uma cor de texto legível sobre fundo escuro e uma legível sobre fundo branco são **duas cores diferentes**, e as duas existem o tempo todo. Declarar as duas não é "primitivo que muda com o tema" — é a camada semântica escolhendo entre dois fatos:

```css
:root {
  --blue-11-dark: #4c8dff;   /* legível sobre superfície escura */
  --blue-11-light: #0d74ce;  /* legível sobre branco */
  --color-accent-text: var(--blue-11-dark);
}
@media (prefers-color-scheme: light) {
  :root { --color-accent-text: var(--blue-11-light); }
}
```

### D10.3 — O espelhamento `--gray-N → --gray-(13-N)` morre; o tema claro mapeia por intenção

A regra atual é mecanicamente elegante e semanticamente errada. Ela produz, no tema claro:

- `--color-surface: var(--gray-11)` = `#c4c6cb` — cinza médio, não uma superfície clara;
- `--color-surface-raised: var(--gray-10)` = `#9a9da5` — a superfície **elevada é mais escura que a base**;
- `--color-border: var(--gray-8)` = `#5c5f68` — borda quase preta a 1px, que dá aparência de *wireframe*.

Em tema claro, elevação vai em direção ao branco. O espelhamento inverteu isso porque a escala foi calibrada dark-first e **não tem resolução na ponta clara**: entre `--gray-11` (`#c4c6cb`) e `--gray-12` (`#f5f6f7`) há um salto grande, e acima do 12 não há nada.

Conserto mínimo: um primitivo novo no topo (`--gray-13: #ffffff`, a numeração já cresce no sentido "mais claro") e mapeamento escrito à mão.

> Consequência aceita e registrada: no tema claro, `--color-bg` e `--color-surface-sunken` compartilham `#f5f6f7`. São contextos que nunca ficam adjacentes sem borda entre eles — fundo da janela e interior de campo. É decisão, não descuido, e está aqui para não ser "corrigida" depois.

### D10.4 — O par verificado é **declarado**, não inferido

O teste do passo 1 não descobre sozinho o que precisa checar, e a tentação de fazê-lo descobrir é o que transformaria isto num projeto próprio.

Nenhuma análise estática de `tokens.css` sabe que `--color-warn` é usado como **texto** sobre `--color-surface` — essa informação vive no CSS do componente. Então o registro de pares é escrito à mão, e é justamente ele que **documenta a intenção de cada token**: `['warn-text', 'surface', 'text']` afirma que aquele token existe para ser texto sobre superfície. Quando alguém usar `--color-warn` (o sólido) como cor de texto, o registro não vai proteger — o que protege é o nome já dizer o que a cor é.

Duas alternativas descartadas:

- **Pôr o check no `guard.mjs`.** Ele já lê `tokens.css`, então a tentação é real. Mas hook `PostToolUse` só dispara no arquivo editado: mudar `--gray-3` não reexecuta nada relacionado a `--color-text-faint`. Teste roda em `check:fast`, sempre, independentemente de quem foi tocado.
- **Uma biblioteca de contraste.** São quinze linhas de aritmética de uma especificação estável desde 2008. Dependência nova pede justificativa, e "não escrever quinze linhas" não é uma.

### D10.5 — `--syntax-*` fica de fora

A [fase 11](11-markdown-na-resposta-do-assistente.md) vai colocar bloco de código na tela, e a paleta de realce cairia aqui por associação — é cor, e mexe em `tokens.css`. Mesmo assim não entra, e a razão é a mesma que ordenou as duas fases: **decidir cor exige ver a cor no seu contexto real.**

Calibrar cinco a oito cores de sintaxe **sem SQL real na tela** é decidir no escuro; o resultado seria revisto na primeira vez que alguém olhasse um `SELECT` de verdade. O que este plano entrega para ela é a estrutura: quando a paleta chegar, cada cor nasce com sua linha no registro de pares e o teste do passo 1 a cobre desde o primeiro commit.

**Gatilho:** a fatia 2 do [plano 09](../active/09-camada-de-ia.md) (NL→passo) gerando SQL para revisão.

---

## Passos

### Passo 1 — A auditoria vira teste, e ele nasce vermelho

`src/renderer/src/shared/ui/tokens.contrast.test.ts`. Três partes:

1. **Contraste WCAG 2.1** — luminância relativa e razão, ~15 linhas.
2. **Leitor de `tokens.css`** — extrai as declarações e resolve `var()` encadeado até chegar a um `#hex`. Precisa ler os **dois** blocos separadamente: `:root` e o `@media (prefers-color-scheme: light)`, com o segundo sobrepondo o primeiro.
3. **Registro de pares** — a lista da D10.4, com o limite de cada um.

```ts
const PAIRS = [
  ['text', 'surface', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-faint', 'surface', 4.5],
  ['accent-text', 'surface', 4.5],
  ['danger-text', 'surface', 4.5],
  ['warn-text', 'surface', 4.5],
  ['ok-text', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['on-danger', 'danger', 4.5]
] as const
```

Cada par roda nos dois temas. A mensagem de falha precisa trazer **o valor resolvido e a razão medida** — `text-faint #5c5f68 sobre surface #1e2023 = 2,56:1, mínimo 4,5` — porque o próximo a ler isso não vai ter esta auditoria à mão.

> ⚠️ Escreva o teste **antes** de tocar em `tokens.css` e confirme que ele reprova os nove pares desta fase. Teste de invariante que nunca foi visto vermelho não se sabe se está ligado — é a mesma provocação que a [fase 08](08-automacao-e-registro.md) usou e que pegou o `--reporter basic` do Vitest.

**Aceite:** `pnpm test` **vermelho**, com as nove falhas nomeadas e os valores medidos na saída.
**Commit:** `test(renderer): contraste dos tokens verificado nos dois temas`

### Passo 2 — Primitivos: separar sólido de texto

Em `tokens.css`, camada de primitivos. Duas mudanças de forma antes dos valores:

**`--accent-9`/`--accent-10` passam a `--blue-9`/`--blue-10`.** Os outros três primitivos de cor já se chamam `--red-9`, `--amber-9`, `--green-9` — nomeados pelo que **são**. "Accent" é o que a cor *faz*, e isso é vocabulário da camada semântica: `--color-accent` continua existindo e é lá que o papel mora. Um primitivo chamado pelo papel é a camada errada sabendo demais, e trocar o acento do azul para outra cor obrigaria a escolher entre um nome mentiroso e um *rename* em cascata.

**O sufixo `-11` marca a variante de texto**, alinhado à escala neutra de 12 passos que já existe: 9 é o sólido, 11 é o texto. Não é numeração inventada nem escala completa a preencher — só os passos com uso real.

Valores já medidos — a coluna da direita é o que cada um garante:

| Primitivo | Valor | Garante |
|---|---|---|
| `--gray-13` | `#ffffff` | topo da escala, elevação do tema claro |
| `--blue-9` (sólido, revisado) | `#0d5bd9` | 5,52:1 com texto branco |
| `--blue-10` (sólido hover) | `#1d4ed8` | 6,19:1 com texto branco |
| `--blue-11-dark` (texto) | `#4c8dff` | 5,10:1 sobre `#1e2023` — é o valor atual, reclassificado |
| `--blue-11-light` (texto) | `#0d74ce` | 4,77:1 sobre branco |
| `--red-9` (sólido, revisado) | `#c62a2f` | 5,14:1 com texto branco |
| `--red-11-dark` | `#ff6369` | 5,63:1 sobre `#1e2023` |
| `--red-11-light` | `#ce2c31` | 5,21:1 sobre branco |
| `--amber-9` (sólido) | `#f5a524` | mantém |
| `--amber-11-dark` | `#f5a524` | 8,00:1 — mantém, já passa |
| `--amber-11-light` | `#946800` | 4,95:1 sobre branco |
| `--green-9` (sólido) | `#30a46c` | mantém |
| `--green-11-dark` | `#30a46c` | 5,17:1 — mantém |
| `--green-11-light` | `#1a7f4f` | 5,01:1 sobre branco |

O `--accent-9` deixa de ser `#4c8dff`. **Alternativa medida, se a validação visual do passo 5 preferir manter o azul claro no botão:** `--color-on-accent: var(--gray-1)` sobre `#4c8dff` dá **6,11:1** e também passa. O teste do passo 1 aceita as duas; a escolha é estética e fica registrada no diário com o motivo.

**Aceite:** `pnpm typecheck` e `pnpm lint` limpos; o teste segue vermelho (os semânticos ainda não mudaram).
**Commit:** `feat(renderer): primitivos de cor separando fundo sólido de texto`

### Passo 3 — Tema claro: estado, elevação e borda

O bloco `@media (prefers-color-scheme: light)` deixa de espelhar e passa a mapear:

```css
--color-bg: var(--gray-12);              /* #f5f6f7 */
--color-surface: var(--gray-13);         /* #ffffff — elevação vai para o branco */
--color-surface-raised: var(--gray-13);  /* distinguida por borda, não por tom */
--color-surface-sunken: var(--gray-12);  /* ver a consequência aceita na D10.3 */
--color-border: var(--gray-11);          /* #c4c6cb — hoje é #5c5f68 */
--color-border-strong: var(--gray-9);
--color-text: var(--gray-1);             /* 19,57:1 */
--color-text-muted: var(--gray-6);       /* 11,18:1 */
--color-text-faint: var(--gray-8);       /*  6,38:1 */
```

Mais os quatro tokens de texto de estado apontando para as variantes `-light`, e `--color-on-accent`/`--color-on-danger` para `--gray-13`.

**Aceite:** metade do teste verde — todos os pares do tema claro passam.
**Commit:** `feat(renderer): tema claro mapeado por intenção, não por espelhamento`

### Passo 4 — Tema escuro: os três níveis de texto e os rótulos sobre sólido

`--color-text-faint` a 2,56:1 não se conserta com ajuste fino: `--gray-9` (`#75787f`) dá 3,69:1 e continua reprovado. Os três níveis sobem um degrau:

| Token | Antes | Depois | Medido |
|---|---|---|---|
| `--color-text` | `--gray-12` | `--gray-12` | 15,09:1 |
| `--color-text-muted` | `--gray-10` | `--gray-11` | ~10:1 |
| `--color-text-faint` | `--gray-8` | `--gray-10` | 6,02:1 |

A hierarquia fica mais sutil do que era. É o preço de os três serem legíveis, e é a troca certa: `text-faint` carrega o rótulo de autoria do chat e o `hint` do `Field` — **informação, não decoração**. Se em algum momento existir texto genuinamente decorativo, ele ganha um token próprio e sai do registro de pares com a justificativa escrita.

Mais `--color-on-accent` e `--color-on-danger` sobre os sólidos revisados do passo 2.

**Aceite:** teste do passo 1 **verde** nos dois temas.
**Commit:** `feat(renderer): três níveis de texto legíveis no tema escuro`

### Passo 5 — Migrar os usos e validar ao vivo

Onze linhas em seis arquivos, todas trocando um token sólido por um token de texto:

| Arquivo | Linha | De | Para |
|---|---|---|---|
| `AiChatPanel.module.css` | 93 | `--color-warn` | `--color-warn-text` |
| `AiChatPanel.module.css` | 39 | `--color-accent` | `--color-accent-text` |
| `Field.module.css` | 20 | `--color-danger` | `--color-danger-text` |
| `App.module.css` | 12 | `--color-danger` | `--color-danger-text` |
| `Button.module.css` | 71 | `--color-on-accent` | `--color-on-danger` |
| `base.css` | `:focus-visible` | `--color-accent` | `--color-accent-text` |

`Button.module.css:42-43,47` e `StateView.module.css:12` ficam como estão — são usos sólidos legítimos.

Depois, **os dois temas ao vivo**. O tema segue o sistema operacional e não há alternador (decisão da fase 05), então a troca é em Configurações → Personalização → Cores do Windows, com o app aberto:

1. O painel do assistente no tema **claro**: a mensagem do gate do Ollama está legível.
2. O `Button` primário e o danger nos dois temas — rótulo legível, e a cor ainda parece um botão primário.
3. A borda do `Panel` no claro não parece traço de wireframe.
4. Campo em foco: o anel aparece e se distingue da borda normal.
5. `Field` com erro, nos dois temas.

O item 2 é o que pode reverter a escolha do passo 2 para a alternativa medida. Registre no diário **qual** foi escolhida e por quê — é a única parte deste plano que um número não decide sozinho.

**Aceite:** `pnpm check:fast` verde e os cinco itens conferidos.
**Commit:** `feat(renderer): componentes migrados para os tokens de texto`

---

## Critério de aceite da fase

```bash
pnpm check:fast && pnpm build
```

E a validação nos dois temas do passo 5.

---

## O que fica para depois

- **`--syntax-*`** — gatilho na D10.5: a fatia 2 do plano 09 gerando SQL.
- **Sombras e elevação por sombra** — no tema claro a elevação hoje se resolve por borda. Uma família `--shadow-*` só se justifica quando existir sobreposição real (o primeiro `Dialog` ou menu flutuante).
- **`forced-colors` / alto contraste do Windows** — o modo de alto contraste substitui as cores do sistema e ignora boa parte disto. Vale quando houver usuário, não antes.
- **Contraste AAA (7:1)** — AA é o alvo declarado. Subir a régua depois é reexecutar o mesmo teste com outro número, o que é barato justamente porque o teste existe.
- **Storybook, primitivos que faltam, regressão visual** — fora de escopo por decisão, não por esquecimento; ver a nota no topo.

---

## O que muda fora deste plano

| Documento dono | O que acrescentar |
|---|---|
| skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) | a distinção sólido/texto (D10.1) e o registro de pares como fonte da intenção de cada token — é regra de primeira linha, o lugar dela é a skill |
| [`HISTORY.md`](../../HISTORY.md) | entrada de marco + a armadilha: token de estado servindo a duas funções passa despercebido no tema para o qual foi calibrado |
| [`ROADMAP § 2`](../../ROADMAP.md) | gatilho do `--syntax-*` (D10.5): a fatia 2 do plano 09 gerando SQL |

`--color-bg` do tema escuro **não muda**, então o comentário cruzado com o `backgroundColor` do `BrowserWindow` em `src/main/index.ts` continua válido. Confirme ao final — é o único valor do projeto que vive em dois arquivos.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| ago/2026 | todos | **concluído** | Escopo deliberadamente estreito: **cor**. Os valores da fase 05 nunca tinham sido medidos — nove pares reprovavam AA. Nasce `tokens.contrast.test.ts`, que resolve cada `var()` até o hex e mede nos dois temas. |

| 2026-08-08 | 1–5 | **concluída** | O teste nasceu com **13** falhas, não as 9 previstas — 3 medidas de contraste mais 10 de token que ainda não existia (os `PAIRS` já usavam os nomes-alvo `-text`/`on-danger`). **Ambos vermelho legítimo**, e a diferença entre os dois tipos é o que diz se o teste está medindo ou só tropeçando. **Alternativa de cor recusada, registrada com o número:** `#4c8dff` + `--gray-1` batia 6,11:1, melhor que os 5,52:1 do `--blue-9: #0d5bd9` escolhido — a decisão foi estética e ficou com o usuário, não com a régua. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| Cor de estado tem duas formas: sólido e texto são dois tokens (D10.1) | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) |
| O tema claro mapeia por **intenção**, não por espelhamento da escala (D10.3) | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) |
| `import.meta.url` é `http:` sob jsdom — caminho derivado dele aponta para lugar nenhum | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Decisões D10.1–D10.3 | [`DECISOES.md`](../../DECISOES.md) |
---

**Índice:** [README](../active/README.md) · **Próximo:** [11 — Markdown na resposta do assistente](11-markdown-na-resposta-do-assistente.md)
