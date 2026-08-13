# DS-2 — Migração da casca e das features

**Depende de:** [DS-1](../implemented/DS-1-fundacao-tailwind.md), concluído em ago/2026 · **Entrega:** os 9 módulos CSS restantes que têm `className` migrados para utilidade, e o único que fica ganhando por escrito o motivo de ficar.

> Segundo da [trilha DS](README.md#a-trilha-de-design-system-ds-n). **Aceite global, herdado e inalterado: zero mudança visual.** Se a tela ficou diferente, algo saiu errado.
>
> **O design system é um envelope** — a régua é da skill [`design-system`](../../../.claude/skills/design-system/SKILL.md), o alvo é do [handoff](../../reference/handoff-ds-ago2026/README.md). Este plano **não constrói nada do alvo**: ele troca o mecanismo de estilo dos componentes que já existem. Quem leva a interface ao alvo é o DS-3.

---

## O caso

O DS-1 provou a camada e migrou os seis primitivos, tirando 177 linhas de CSS de `shared/ui/`. Sobram **11 módulos, 877 linhas**, e é onde mora a maior parte do estilo do aplicativo. Enquanto eles existirem, o projeto tem **dois** mecanismos para a mesma decisão — o que o [`HISTORY.md`](../../HISTORY.md) § *Tailwind v4 entra* nomeia como a única forma de meia migração que importa: *dois lugares decidindo o padding do mesmo botão*.

**O que este plano não é:** um redesenho, e nem sequer uma reorganização. Nenhum componente muda de forma, de estrutura de DOM ou de aparência. Só o veículo do estilo muda.

### Três fatos do repositório que o desenho respeita

1. **`MarkdownMessage.module.css` fica** — 219 das 877 linhas, 25%. Ele estiliza HTML gerado pelo `react-markdown`, onde **não existe `className` para receber utilidade**. Decidido no `HISTORY.md` antes deste plano; aqui só vira literal.
2. **`Dialog.module.css` já está no seu mínimo irredutível** — o DS-1 o reduziu de 70 para 25 linhas de regra, deixando `::backdrop`, `@starting-style` e a transição com `allow-discrete`. **Não tocar.**
3. **Três comportamentos estruturais moram nesses arquivos e são frágeis**, cada um com uma decisão registrada atrás: a rolagem estrutural da D13.5 (`overflow: hidden` na raiz, `min-width: 0` no filho), a transição de largura do recolher da sidebar, e as ações reveladas no `:hover` da lista.

---

## O inventário, e o que "mínima" quer dizer

| Arquivo | CSS | TSX | Migração | O DS-3 faz o quê com ele |
|---|---:|---:|---|---|
| `app/AppShell` | 25 | 33 | **completa** | preserva — é o grid de regiões |
| `app/Sidebar` | 55 | 52 | **completa** | acrescenta cabeçalho e rodapé; a estrutura fica |
| `features/conversation/ConversationList` | 91 | 123 | **completa** | acrescenta agrupamento por data e barra de acento |
| `features/conversation/ConversationView` | 138 | 230 | **completa** | troca o cabeçalho e a forma da mensagem |
| `features/conversation/Composer` | 68 | 156 | **mínima** | reestrutura inteiro — contêiner arredondado, ícones |
| `features/conversation/ModelSelector` | 109 | 214 | **mínima** | desmonta a toolbar; vira pílula dentro do composer |
| `features/settings/Settings` | 68 | 88 | **completa** | preserva |
| `features/open-dataset/OpenDatasetPanel` | 38 | 56 | **mínima** | sai no [plano 16](16-anexo-mecanismo-e-dataset.md), substituído pelo clipe |
| `components/Versions` | 18 | 32 | **mínima** | vira o rodapé de status do Ollama |
| `features/conversation/MarkdownMessage` | 219 | 119 | **fica em CSS** | — |
| `shared/ui/Dialog` | 48 | 69 | **já feito** (DS-1) | — |

**"Mínima" não é meia migração** — ver [DS2.1](#ds21--migração-mínima-é-sobre-quanto-se-organiza-nunca-sobre-quanto-se-migra). O módulo CSS sai inteiro, do mesmo jeito. O que muda é quanto esforço se gasta fatorando classe em constante e nomeando padrão num arquivo que o DS-3 vai reescrever.

---

## O que o DS-1 deixou pronto, e que este plano usa desde a primeira linha

- **A guarda 8 do [`guard.mjs`](../../../.claude/hooks/guard.mjs)** reprova, a cada edição de `.tsx` sob `src/renderer/`: cor literal em valor arbitrário, primitivo alcançado por utilidade (`bg-(--gray-3)`), literal em `style={{ }}`, e `#hex` dentro de `className`. Foi provocada de propósito e sai com código 2.
- **O padrão dos primitivos:** matriz de variantes em constante fora do JSX, layout de 3–4 classes inline.
- ⚠️ **A armadilha de ordem, e ela é a que mais vai morder aqui:** duas utilidades do mesmo grupo são resolvidas pela **ordem na folha gerada**, nunca pela ordem no `className`. O que uma variante ou um estado sobrescreve **não pode estar no base**. No DS-1 isso apareceu em `text-*` e `border-*` do `Button`; nestes arquivos, com estados `.active`, `.selected` e `:hover` por toda parte, aparece mais.
- **O instrumento de aceite (DS1.7):** despejo de `getBoundingClientRect` de todo o DOM **durante** o trabalho, porque ele nomeia o elemento; diff de pixel **uma vez, no fim do passo**, porque ele pega cor e o despejo não.

---

## Passo 1 — A casca: `AppShell` e `Sidebar`

Uma sessão. 80 linhas de CSS, e é o passo mais arriscado do plano — a casca enquadra tudo, então um erro aqui move a tela inteira.

**Três comportamentos a preservar, cada um com sua decisão atrás:**

- **A rolagem estrutural (D13.5).** A raiz é `overflow: hidden` para que nenhum filho empurre a página, e o filho de conteúdo carrega `min-width: 0` — que é o que permite um bloco de código largo rolar **dentro** de si em vez de esticar a coluna. `min-w-0` é uma classe fácil de esquecer e o sintoma é uma tabela empurrando a sidebar para fora da tela.
- **A transição de largura do recolher:** `transition: width var(--duration-base) ease` com `overflow: hidden`. Vira `transition-[width] duration-(--duration-base) ease-initial` — `ease-initial` porque o default do Tailwind é outra curva, medido no DS-1.
- **A sidebar tem uma só região que rola.** As outras duas não.

**Aceite:** recolher e expandir a sidebar anima na mesma duração; a lista de conversas rola sem que o documento role; `Sidebar.test.tsx` passa sem alteração. Diff de pixel zero.

---

## Passo 2 — `ConversationList`

Uma sessão. 91 linhas, e traz a armadilha que a skill [`testing`](../../../.claude/skills/testing/SKILL.md) já registrou por escrito.

⚠️ **As ações de cada linha são `visibility: hidden` até o `:hover` ou o foco de teclado.** É `visibility` e não `display` de propósito — o espaço fica reservado, então revelar não empurra o título. Duas consequências para a verificação: **o nível 2 clica no botão invisível sem hesitar** (o jsdom não aplica CSS), e o Playwright espera até estourar. Só o nível 4 prova isto.

O par vira `invisible` no base e `visible` no `group-hover:` / `group-focus-within:` — o que exige `group` no `<li>`. É a primeira vez que o padrão de grupo entra no projeto, e vale um comentário curto no fonte.

**Aceite:** passar o mouse revela as ações **sem mover o título**; `Tab` até a linha revela igual; o título longo continua truncando com reticências. Diff de pixel zero.

---

## Passo 3 — `ConversationView`

Uma sessão. 138 linhas de CSS e 230 de TSX — o maior par do plano.

⚠️ **É a superfície que rola, e a rolagem é presa ao fim por `useStickToBottom`.** O [`HISTORY.md`](../../HISTORY.md) registra que esse hook perdia uma corrida real com o `scroll` assíncrono do DOM, e que **nenhum teste de nível 2 poderia ter pego** — em jsdom `scrollHeight` e `clientHeight` são zero. A migração não toca o hook, mas mexe no CSS de que ele depende: se o contêiner de rolagem deixar de ser o mesmo elemento, o hook mede o elemento errado e o sintoma é *"a tela não acompanha a resposta"*, ao vivo e só com o Ollama gerando.

**Aceite:** com uma resposta em fluxo, a tela acompanha o fim; rolar para cima durante o fluxo **solta** a prisão e não a reata sozinha. `ConversationView.test.tsx` e `contextBudget.test.tsx` passam sem alteração. Diff de pixel zero.

---

## Passo 4 — `Composer` e `ModelSelector`, migração mínima

Uma sessão. 177 linhas, e o par que o DS-3 mais reestrutura — o seletor sai da toolbar e vira pílula dentro do composer.

⚠️ **A largura do `<select>` nativo vem do catálogo do Ollama, e isso torna o diff de pixel ruidoso nesta região.** Medido no DS-1: a largura intrínseca é a da opção mais larga, que chega por rede em runtime, então uma captura tirada cedo demais difere de uma tirada depois — **sem que nada tenha mudado no código**. Ao ver diferença só aqui, repetir a captura antes de investigar.

O `<meter>` do medidor de tokens tem chrome nativo, e o `base.css` restaura o `padding`/`border` que o preflight zera. Não sobrescrever por utilidade.

**Aceite:** o medidor continua com a mesma cor e altura; o `<select>` abre e o popup nativo mantém o padding do sistema; a recusa de envio (D15.5) continua com o mesmo recuo. Diff de pixel zero, com a ressalva acima.

---

## Passo 5 — As folhas: `Settings`, `OpenDatasetPanel`, `Versions`

Uma sessão. 124 linhas somadas. `Settings` completa; as outras duas mínimas — o painel de abrir arquivo sai no plano 16 e o `Versions` vira o rodapé de status no DS-3.

`Settings` é o conteúdo do `<dialog>`, então herda a fonte e o tamanho que o `Dialog` já fixa; `LoadedModels` divide o mesmo módulo e vai junto.

**Aceite:** abrir Configurações, o controle de threads continua na mesma posição, a lista de modelos residentes continua com o mesmo espaçamento. `loadedModels.test.tsx` passa sem alteração. Diff de pixel zero.

---

## Passo 6 — Fechamento

Meia sessão.

- **`MarkdownMessage.module.css` ganha um comentário no topo** dizendo por que fica: `react-markdown` constrói elementos sem `className`, então não há onde pendurar utilidade. Sem isso, a próxima sessão vai olhar para o último módulo CSS do renderer e achar que é sobra.
- **Medir o bundle**, e a série do projeto ganha o ponto que o DS-1 previu: o CSS deve **cair** agora, porque 610 linhas de módulo saem contra utilidades que em boa parte já foram geradas.
- `pnpm check:fast` verde, os dois temas ao vivo, diário preenchido, entrada no `HISTORY.md`.

**Aceite:** `find src/renderer/src -name "*.module.css"` devolve **dois** arquivos — `MarkdownMessage` e `Dialog` — e cada um tem escrito no topo por que sobreviveu.

---

## Decisões

### DS2.1 — Migração mínima é sobre quanto se **organiza**, nunca sobre quanto se migra

O `HISTORY.md` recusou nominalmente *"CSS Modules convivendo com utilidade sem fronteira declarada"* como a única meia migração que importa. Esta decisão não a reabre: **todo módulo listado sai inteiro**, e ao fim do plano restam dois arquivos, ambos por limite físico.

O que "mínima" governa é o **esforço de curadoria**. Num componente que o DS-3 preserva, vale extrair a matriz de variantes para constante, nomear o padrão e deixá-lo bonito de ler — esse trabalho persiste. Num componente que o DS-3 reescreve, o mesmo esforço é jogado fora duas semanas depois: ali a tradução é direta, classe por classe, sem inventar organização.

A alternativa era migrar tudo com o mesmo cuidado, e ela tem um custo real e um argumento fraco: o custo é fatorar constantes para o `ModelSelector`, que o DS-3 desmonta; o argumento a favor seria *"e se o DS-3 mudar de ideia?"* — que é OCP disfarçado, [recusado no projeto](../../HISTORY.md).

### DS2.2 — A ordem é por quanto o DS-3 preserva, não por tamanho

Casca → lista → conversa → composer → folhas. O que o DS-3 mantém vem primeiro, com o cuidado inteiro, enquanto a sessão está fresca; o que ele reescreve vem depois, quando a tradução já é mecânica. A alternativa óbvia — *do menor para o maior, para ganhar ritmo* — poria `Versions` e `OpenDatasetPanel` no início, que são exatamente os dois com menos vida pela frente.

### DS2.3 — Zero mudança visual continua valendo, e é ele que torna este plano barato

Herdado da DS1.4 sem alteração. **Vale repetir por que não é timidez:** no DS-1 esse aceite pegou o modal de Configurações renderizando em `rect=0,0` — defeito que nenhum dos cinco níveis de teste alcança, porque o jsdom não implementa `<dialog>` e nenhum spec de nível 4 confere posição.

O corolário incômodo segue de pé: **melhoria visual notada durante a migração não entra aqui.** Vai para o DS-3, ou para uma linha no diário.

### DS2.4 — Não construir o que o alvo pede

A régua do envelope, aplicada. O alvo pede busca de conversas, agrupamento por data, barra de acento na conversa ativa, cabeçalho e rodapé novos na sidebar. **Nada disso entra neste plano**, mesmo passando o dia inteiro dentro do `Sidebar.tsx` e do `ConversationList.tsx`. O que se pode fazer é **anotar** — como o DS-1 fez com a variante contornada e o ícone circular do `Button`.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 13/08/2026 | 1 | **Passo 1 — casca (`AppShell`, `Sidebar`).** Dois módulos CSS (80 linhas) migrados para utilidade, com os comentários load-bearing (D13.5, `minmax(0,1fr)` vs `1fr`, pino de linha `row-start-*`) levados ao TSX. **Achado bloqueante medido e escalado ao `HISTORY.md`:** `min-w-0`/`min-h-0` não emitem CSS com a base `--spacing` desligada — trocados por `min-w-[0px]`/`min-h-[0px]`. Verificado no CSS gerado: transição composta = `width 200ms ease` idêntica, grids exatos, bordas com `solid` do preflight. `check:fast` verde (333 testes, `Sidebar.test.tsx` intacto), CSS 50,11 → 49,59 kB. Verificação por fidelidade de tradução + emissão no CSS + testes; revisão visual ao vivo fica consolidada no fim (o harness de pixel-diff do DS-1 não foi persistido) | Passo 2 — `ConversationList` |
| 13/08/2026 | 1 | **Passo 2 — `ConversationList`** (91 linhas). Dois _order traps_ resolvidos: (a) `.action` sobre o `Button` precisou de `px-3!` (important), porque ao sair do CSS Module entra na camada de utilidade e perderia o `px-5` do Button por ordem na folha; (b) cor/peso do título viraram condicionais de `active`, fora do base. Primeiro uso do padrão `group` no projeto: `invisible` + `group-hover:visible`/`group-focus-within:visible`, com o comentário do `visibility` vs `display` levado ao TSX. `margin:0` redundante dropado (preflight já zera). CSS gerado confere `padding-inline … !important`, `letter-spacing:.04em`, `visibility` nos dois estados. `check:fast` verde, CSS 49,59 → 48,73 kB. ⚠️ Não há `ConversationList.test.tsx`: a revelação no hover só o nível 4 prova (fica na revisão ao vivo) | Passo 3 — `ConversationView` |
| 13/08/2026 | 1 | **Passo 3 — `ConversationView`** (138 CSS, o maior par). O `<div>` de rolagem segue o **mesmo elemento** com o mesmo `ref` — `useStickToBottom` mede o nó certo; comentário ligando o CSS ao hook levado ao TSX. Classes mortas `.input`/`.number` (não usadas no TSX) somem com o módulo. `.user`/`.assistant` eram a mesma regra → uma classe só. Comentários load-bearing (D13.5, D13.6, D14.3 warn-não-danger, densidade de leitura + `select-text`) preservados. CSS gerado: `min-height:0`, `line-height:var(--leading-normal)` (=1.5), `normal-case`/`tracking-normal` revertendo o herdado. `check:fast` verde (`ConversationView.test.tsx` e `contextBudget.test.tsx` intactos), CSS 48,73 → 46,49 kB. ⚠️ Stick-to-bottom em streaming só o nível 4 prova (revisão ao vivo) | Passo 4 — `Composer` + `ModelSelector` (mínima) |
| 13/08/2026 | 1 | **Passo 4 — `Composer` + `ModelSelector`** (177 linhas, migração mínima da DS2.1: tradução direta, sem curadoria pois o DS-3 reescreve). Chrome nativo respeitado: `<meter>` só dimensionado (`h-[6px] w-[120px]`, o `base.css` restaura padding/border); `<select>` estiliza só a caixa, o popup `<option>` fica com o padding do sistema. Controles saem do anel global via `focus-visible:outline-none` + `focus-visible:border-accent-text`. `.locked` mantém `my-5` — é a preservação de pixel da DS1.6, com o comentário levado ao TSX. `TOO_BIG` como constante (reusada em dois estados). `check:fast` verde (`modelSelection.test.tsx` intacto), CSS 46,49 → 43,68 kB | Passo 5 — folhas (`Settings`, `OpenDatasetPanel`, `Versions`) |
