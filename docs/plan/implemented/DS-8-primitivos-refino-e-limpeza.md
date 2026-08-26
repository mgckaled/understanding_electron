# DS-8 — Primitivos: refino de acessibilidade, limpeza de órfãos

**Entrega:** dois primitivos apagados (`Toolbar`, `Panel` — zero consumidores, confirmado por `git log --follow` e grep no repositório inteiro, achado que o relatório de origem não tinha); contrato de acessibilidade fechado onde havia defeito real e verificado no código antes de agir — `Button` mantém nome acessível durante `loading`, `Field` injeta `aria-invalid`, `Dialog` rola conteúdo longo e aceita `describedBy`, `Popover` ganha `className` interno e os 5 gatilhos reais ganham `aria-haspopup`/`aria-expanded` consistentes, `Slider` comita pelo evento nativo `change` e ganha `aria-valuetext`; `cx()` (zero-dep) substitui o join manual repetido em três primitivos; testes de contrato novos para o que mudou. A skill `design-system` corrige "nove primitivos" para "sete" e ganha um inventário das medidas ad hoc que ficam de fora do token layer.

> Oitavo plano da trilha DS, e o primeiro desde o DS-3/DS-4/DS-5 a ter uma verificação ao vivo que **achou uma regressão real** antes do fechamento — não só confirmou que nada mudou. O DS-7 não tinha verificação ao vivo porque nenhum pixel mudava; aqui pixels mudam (scroll do `Dialog`) e a passagem ao vivo pegou algo que os 707 testes automatizados, incluindo os novos, não podiam pegar. Ver Armadilhas.

---

## O caso — por que este plano existe

Nasceu de um relatório externo (`notes/reports/r_primitive-components.md`), avaliado item a item contra o repositório real antes de aceitar qualquer um — os 9 primitivos `.tsx` lidos por inteiro, `git log --follow` e grep no repositório inteiro para cada alegação de "consumidor", os 5 usos reais de `Popover` lidos um a um antes de decidir a forma da API nova. `advisor` (Opus) chamado três vezes: antes de escrever o parecer (corrigiu a leitura de S1, a armadilha de nomear o helper de classes como resolvedor de conflito, e pediu os três greps que viraram os achados abaixo), antes de escrever código (fixou `aria-label` derivado de children em vez de trocar `invisible` por `opacity-0`, e recusou a troca de `role="alert"` por `aria-live="polite"` no `Field`), e ao final, antes do commit de fechamento.

**O relatório errou contra o código real em três pontos, achados só por verificação, não por leitura do texto:**

- **A dicotomia do `Toolbar`** ("(a) implementar APG completo ou (b) rebaixar a helper de layout") era uma escolha falsa — `grep -r "<Toolbar" src/` não encontra **nenhum** consumidor. `Composer.tsx`/`ConversationView.tsx` já citam "the removed toolbar (DS-3 passo 7)" em comentário próprio; o plano 13 já tinha feito o mesmo com `Panel` ("`OpenDatasetPanel` — seção da sidebar, inalterado por dentro — perde só o embrulho `Panel`"). O critério que decide isto já estava escrito desde a fase 11 ("o que decide não é a contagem, é ter mais de um chamador") — os dois sobreviveram no diretório por sobrarem de duas migrações sem que ninguém remedisse.
- **S4** ("Só `messages.test.ts`; sem teste de contrato por componente") estava errado: já existiam 4 (`StateView`, `Popover`, `Switch`, `Slider`), no padrão certo (role/nome/comportamento, nunca classe CSS).
- **A proibição de `className` no `Popover`** já tinha solução documentada e em uso pelos 5 consumidores reais (`HISTORY-archive.md` § *um `className` no Popover derrota...*) — não era uma lacuna em aberto, como o relatório tratou.

**Achados de verificação que mudaram prioridade, não só aceite/recusa:**

- O binding duplicado do `Slider` (`mouseup`/`touchend`/`keyup`/`blur`) — o relatório marcava P0. `grep onChangeCommitted` achou o único consumidor real (`ContextControl.onCommit`), que persiste `num_ctx` via IPC: chamar duas vezes com o mesmo valor é idempotente. Desceu para robustez.
- O guard em runtime para `aria-label` de botão-ícone (S3, `Button`) — auditados os 11 consumidores reais de `shape="circle"`/`"square"` no repositório inteiro. Todos os 11 já passam `aria-label`. Um guard preveniria uma regressão que ainda não existe; virou TSDoc, não código.
- `Button` `loading` — o mesmo grep achou o lado oposto: 4 consumidores reais com filho de texto puro (`DatasetQueryPanel` "Executar", `LoadedModels` "Descarregar", `CloudSecrets` "Remover"/"Salvar") sem `aria-label` próprio, ficando mudos enquanto `invisible` escondia o texto do nome acessível. Confirmado real, não hipotético.

## Decisões tomadas com o usuário, antes da primeira edição

- Trilha **DS**, não a **P** que o relatório sugeria — o relatório é sobre os primitivos que a trilha DS já possui, e "toca todo componente que existir" já é a razão de a trilha DS ter numeração própria (`plan/active/README.md`); um domínio novo (letra própria) é para feature que ainda não existe, categoria de `N`/`E`, não este caso.
- Verificação profunda de consumidores de `Panel`/`Toolbar` **antes** de qualquer ação destrutiva, pedido explícito do usuário — `git log --follow`, grep case-insensitive no repositório inteiro (incluindo `e2e/`, `test/`, `.claude/`, `descarte/`), e leitura dos planos históricos que documentam a última remoção de cada um.
- Plano de **8 passos** — um a mais que o teto usual de 7 — executado inteiro numa sessão, cada passo com commit próprio; escrito direto em `implemented/`, mesmo padrão do DS-6/DS-7/R-4.
- Teste ao vivo obrigatório ao final, Context7 obrigatório para qualquer claim técnica de biblioteca (usado para confirmar `ref` como prop comum no React 19, sem `forwardRef`, e o padrão de `addEventListener`/cleanup em `useEffect`), e commit detalhado por fase.

## Itens rejeitados, e por quê

- **`role="alert"` → `aria-live="polite"` no erro do `Field`** (S3) — o `role="alert"` já carrega `aria-live="assertive"` implícito e é tratado de forma especial na inserção pelos motores de acessibilidade; a troca proposta exigiria um wrapper sempre montado com texto condicional dentro, e uma versão condicionalmente montada (o risco real de uma implementação apressada) teria tornado o anúncio **menos** confiável, não mais. Achado pelo `advisor` antes de codificar — não precisou de teste ao vivo para se provar errado.
- **`clsx`/`tailwind-merge`** (S2) — o defeito real que motivava a proposta (`rounded-md` da BASE perdendo para `rounded-full` de uma variante) já tem solução funcionando: a convenção de variante-como-constante do DS-1/DS-2 ("o que uma variante sobrescreve não pode estar no base"). Um merge automático resolveria um problema que o projeto já resolve de outro jeito, e ainda precisaria de configuração estendida para reconhecer as `@utility` próprias do projeto.
- **`ref` público nos 9 primitivos como eixo à parte (S1)** — nove props de `ref` sem consumidor nomeado é o padrão que este projeto recusa por princípio (OCP descartado, "ponto de extensão especulativo é retrabalho antecipado"). `ref` interno entrou só onde o próprio trabalho de a11y pediu (o `useRef` do `Slider` para o listener nativo `change`) — não como prop pública nova em nenhum primitivo.
- **`usePopoverTrigger()`** — em vez de um hook novo, os 5 consumidores reais foram alinhados diretamente (`aria-haspopup`/`aria-expanded`). Mesma régua que o `Disclosure` já usa neste repositório: a segunda ocorrência não extrai, a terceira é o gatilho — e mesmo com 5 ocorrências, alinhar o que já existe é mais barato que desenhar uma API nova sobre um padrão que varia por consumidor (`listbox`/`dialog`/`true`).
- **Extração preventiva do `MarkdownMessage`** — 143 de 400 linhas, longe do teto; "divide-se ao tocar" (`CLAUDE.md`) descarta a extração antes de haver o que estender.
- **`Panel`/`Toolbar` como "decisão binária" (a implementar de verdade / b rebaixar)** — a pergunta certa não era "o que este componente deveria ser", era "alguém ainda o chama". Não chamava. Apagados.

## Passo 1 — Apagar `Toolbar` e `Panel`, corrigir contagem na skill

`git rm -r` nos dois diretórios. `design-system/SKILL.md`: descrição do frontmatter, heading "Os nove primitivos" → "Os sete primitivos", lista de nomes, parágrafo de CSS Modules, e a citação de `Panel` na regra de radius (`lg` é o contêiner primário) — corrigidos. Nova nota de aviso aponta as duas razões históricas (DS-3 passo 7, fase 13) para quem for tentado a reintroduzir um dos dois nomes sem um segundo chamador real.

## Passo 2 — Contrato de a11y: `Button`, `Field`

`Button`: `aria-label` derivado de `children` quando `loading && typeof children === 'string'` — o `aria-label` explícito de quem chama sempre vence, porque `{...props}` espalha depois. TSDoc no prop `shape` documentando a exigência de nome acessível para ícone-only, sem guard em runtime (11/11 consumidores já cumprem). `Field`: `aria-invalid` passa a acompanhar `error` pelo mesmo `cloneElement` que já injeta `id`/`aria-describedby`. `Button.test.tsx` e `Field.test.tsx` novos.

## Passo 3 — `Dialog`: scroll de conteúdo longo + `aria-describedby`

`Dialog.module.css` ganha `max-height` (mesmo raciocínio da largura já ali: valor sem token para um único consumidor). Cabeçalho fixo (`flex-none`), conteúdo rolável (`flex-1 overflow-y-auto`). `describedBy` opcional, wireado em `Settings.tsx` — único consumidor real — ao `id` do parágrafo de introdução que já existia, sempre montado.

## Passo 4 — `Popover`: `className` interno + `aria-haspopup`/`aria-expanded` nos 5 consumidores

`Popover` ganha `className` opcional aplicado a um `<div>` interno — nunca à raiz `[popover]`, que segue sem classe de display por causa da armadilha já documentada. 4 dos 5 consumidores reais (`ModelSelector`, `ConversationList`, `ContextControl`, `OllamaStatus`) tinham a mesma div-wrapper duplicada; migrados. `AttachButton` manteve a própria estrutura — conteúdo com duas formas condicionais, sem uma única classe para extrair. Todos os 5 gatilhos reais ganharam `aria-expanded`; `OllamaStatus` — o único sem nenhum dos dois — ganhou `aria-haspopup` também. Teste novo no `Popover.test.tsx` prova que `className` nunca alcança a raiz.

## Passo 5 — `Slider`: `aria-valuetext` + fix do commit duplicado

`ref` interno + `useEffect` com `addEventListener('change', ...)` substitui os quatro handlers React (`onMouseUp`/`onTouchEnd`/`onKeyUp`/`onBlur`) — o evento nativo `change` é o sinal de commit real de um range input (dispara uma vez, no release), o que React não expõe via `onChange` (mapeado a `input`). `aria-valuetext` usa o rótulo do tick quando o valor bate um; sem correspondência, cai no número cru, comportamento de hoje. `Slider.test.tsx` reescrito: `fireEvent.input` prova o step (`onChange`), `fireEvent.change` prova o commit — a distinção que o jsdom só simula tendo os dois eventos disparados explicitamente.

## Passo 6 — `cx()` zero-dep + inventário S5

`shared/ui/cx.ts`: só junta, TSDoc deixa explícito que não resolve conflito. Aplicado em `Button`, `Switch`, `Slider` — os três call sites reais de `className` (o join de `MarkdownMessage`/`CodeBlock` parseia um nó de AST do `hast`, não é um `className` de componente; ficou de fora). `cx.test.ts` cobre o comportamento. Commit separado do inventário S5 (medidas ad hoc de `Switch`/`Slider`/`Dialog` documentadas na skill, mesmo viés do DS-6/DS-7: um consumidor não promove a token).

## Passo 7 — Testes de contrato faltantes

`Dialog.test.tsx`: nome acessível pelo título, `aria-describedby` presente/ausente conforme a prop, botão fechar chamando `onClose` — o que o shim de `<dialog>` em `test/setup-renderer.ts` de fato sustenta; camada superior, foco preso e Esc continuam nível 4.

## Passo 8 — Fechamento: `check:fast`, teste ao vivo, documentação

`pnpm check:fast`: 707 testes em 84 arquivos, verde (só warnings de Prettier em `descarte/`, fora do escopo). Playwright temporário contra o app buildado (`pnpm build` + `_electron.launch`) verificou o que nenhum teste de jsdom alcança: geometria real do `Dialog` (altura do diálogo aberto ≤ altura da janela, `overflow-y: auto` computado no conteúdo), `aria-expanded`/`aria-haspopup` reais em dois gatilhos (`OllamaStatus`, `AttachButton`) através de um clique real e do fechamento por `Escape`. **Achou uma regressão real** antes de qualquer teste automatizado conseguir — ver Armadilhas. Corrigida, o script foi apagado (nunca comitado, mesmo padrão do DS-6). `HISTORY.md` ganha a entrada do marco e a armadilha; este arquivo nasce direto em `implemented/`; `ROADMAP.md` e `plan/active/README.md` recebem a linha do DS-8.

---

## Decisões

- **DS8.1 — Trilha DS confirmada contra a sugestão "P" do relatório.** O relatório propunha um prefixo novo por analogia com "P de Primitivos", mas os primitivos avaliados já pertencem à trilha DS existente — nenhum domínio novo nasce aqui, só refino do que já é dela.
- **DS8.2 — Verificação de consumidor antes de deletar é regra, não ritual único.** `Toolbar` e `Panel` sobreviveram a duas migrações inteiras (DS-3, fase 13) porque a contagem de "nove primitivos" nunca foi remedida contra o código real — a mesma classe de dívida que motivou a trilha R (`R-2`, `R-3`, `R-4`). O critério que resolve ("mais de um chamador") já estava escrito desde a fase 11; só não tinha sido reaplicado.
- **DS8.3 — Severidade decidida por medição, não pela forma do bug.** O binding duplicado do `Slider` "parece" P0 pelo nome (evento pode disparar duas vezes); medir o único consumidor real (idempotente) desceu a prioridade sem mudar a decisão de consertar — o preview do relatório e o veredito final concordam no "o quê", divergem só no "quão urgente".
- **DS8.4 — Guard em runtime só nasce depois de uma violação real, não antes.** A auditoria dos 11 consumidores de ícone-only (100% conformes hoje) é o mesmo raciocínio que já rege o `Disclosure`/`usePopoverTrigger()`: mecanismo de prevenção é caro comparado a TSDoc + correção no dia em que a primeira violação real aparecer.
- **DS8.5 — A verificação ao vivo achou o que o `Dialog.test.tsx` não podia achar.** Um `flex` sem escopo no `<dialog>` derrotou `dialog:not([open]) { display: none }` do UA stylesheet — mesma mecânica (origem de CSS antes de especificidade) já diagnosticada para o `Popover`, elemento diferente. `pnpm check:fast` inteiro, incluindo os testes novos deste plano, ficou verde com o defeito presente — só o Playwright contra o app real, clicando no botão atrás do diálogo fechado, expôs. Corrigido escopando a `.dialog[open]`, mesmo padrão que a regra de fade já usava duas linhas abaixo. Ver `HISTORY.md` § Armadilhas.
- **DS8.6 — `advisor` chamado três vezes, cada uma mudando o plano.** (1) Antes do parecer — redirecionou a leitura de S1/S2, pediu os três greps que viraram os achados de `Toolbar` zero-consumidor, teste-count desatualizado e `onChangeCommitted` idempotente. (2) Antes de codificar — recusou `opacity-0` para o `Button` (a favor de `aria-label` derivado de `children`) e recusou a troca de `role="alert"` por `aria-live="polite"` no `Field`; as duas recusas mudaram código que só foi escrito depois. (3) Ao final — pediu duas correções de registro (a contagem "três skills" que devia ser quatro, e esta própria entrada, que conflava as chamadas 2 e 3 numa primeira versão) e uma verificação pendente (`aria-valuetext` do `Slider` cobre só os valores que batem um tick da lista **já afinada** por `thinLabels`, não a lista completa de `contextTicks` — a maioria das posições que um usuário de teclado alcança fica sem `aria-valuetext`, e nem o TSDoc nem esta entrada tinham dito isso; ambas corrigidas no mesmo commit desta constatação).

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| ago/2026 | — | `Toolbar` e `Panel` **apagados** por ficarem sem nenhum chamador — sobreviveram duas migrações inteiras sem que ninguém remedisse. Contrato de a11y fechado nos que ficam. | concluído |
| ago/2026 | verificação ao vivo | **`check:fast` inteiro ficou verde com o defeito presente** — um `flex` sem escopo no `dialog` derrotava a regra de esconder do UA stylesheet, e só o Playwright clicando no botão atrás do diálogo fechado expôs. | corrigido |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| Um `flex` sem escopo no `dialog` derrota `dialog:not([open])` do UA stylesheet | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Primitivo nasce com o **segundo** chamador, não pela contagem | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) |
| As medidas one-off de `Switch`/`Slider`/`Dialog`, e por que nenhuma virou token | skill [`design-system`](../../../.claude/skills/design-system/reference.md) |
| Decisões DS8.1–DS8.5 | [`DECISOES.md`](../../DECISOES.md) |