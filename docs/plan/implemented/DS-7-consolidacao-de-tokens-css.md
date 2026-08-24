# DS-7 — Consolidação de `tokens.css`: convenções registradas, zero token novo

**Entrega:** `tokens.css` enxuga para declaração pura — cabeçalho com citação única à skill `design-system`, seção de rótulo sem narrativa, um único comentário sobrevivente (`--color-bg`, cruzado com `src/main/index.ts`). A skill ganha uma seção nova consolidando tudo que saiu do CSS — convenção de hover/seleção já existente, regra de radius corrigida contra o uso real, seis ausências e convenções registradas sem token, o detalhe de `--color-backdrop`/`--syntax-*`, a correção do comentário de shell layout — mais duas contagens que tinham envelhecido fora do relatório de origem (`--font-size-sm` é 14px, não 13px; `--table-row-height` faltava na lista de tokens fora de `@theme inline`). `ROADMAP.md` ganha o gatilho de atualização do Primer. **Nenhum token novo entra em `tokens.css`/`tailwind.css`, nenhum pixel muda** — os dois itens do relatório que adicionariam CSS (superfície interativa, radius de badge) foram recusados contra o código real.

> Sétimo plano da trilha DS, de natureza diferente dos seis anteriores: DS-1/DS-2 tinham "zero mudança visual", DS-3/DS-4/DS-5 tinham "a tela chega ao alvo", DS-6 era robustez de plataforma verificável ao vivo. Este não muda nem robustez nem layout — é consolidação de narrativa e correção de fato, e por isso não há verificação ao vivo (nada renderiza diferente): o portão é `pnpm typecheck` + `pnpm check:fast`.

---

## O caso — por que este plano existe

Nasceu de um relatório externo (`notes/prompts/p_tokens-css.md` + `notes/reports/r_tokens-css.md`), 21 itens propostos para `tokens.css` (com mapeamento eventual em `tailwind.css`), organizados em alta/média/baixa + verificações de consistência. Como chanceler da proposta, cada item foi verificado contra o repositório real — `tokens.css` e `tailwind.css` lidos por inteiro, `tokens.contrast.test.ts` e `guard.mjs` lidos para confirmar o que cada um cobre, `Button.tsx`/`ConversationList.tsx`/`Sidebar.tsx` lidos para checar as alegações de uso — antes de aceitar qualquer item, com o `advisor` (Opus) chamado antes de qualquer edição para filtrar o escopo.

**O relatório errou duas vezes contra o código real, e o `advisor` apontou mais cinco pontos antes da primeira edição:**

- **Item 1** (tokens de superfície interativa — `--color-surface-hover`, `--color-surface-active`, `--color-accent-subtle`) — a alegação de que hover "resolve com `color-mix` inline ou literal próprio" é falsa: `ConversationList.tsx` e `AttachButton.tsx` já sobem um degrau na escada de superfície existente (`bg-surface` ↔ `hover:bg-surface-raised`). E o estado selecionado (`ConversationList`, barra de acento da DS-3) já não é fundo nenhum: é `border-l-2` na cor de acento + o mesmo `bg-surface-raised` do hover + peso de fonte — o `advisor` apontou que essa composição de três partes é uma **rejeição mais forte** de `--color-accent-subtle` do que "zero consumidor", porque o projeto já respondeu a essa pergunta com outro mecanismo. Descartado por inteiro; convenção existente documentada em vez de token novo.
- **Item 5** (`--radius-xs` para badge/chip) — já existe um chip real, `CapabilityChip.tsx`, e ele usa `rounded-sm` (4px), não algo menor. Não há lacuna. Descartado.
- **Itens 6/7** (regra de uso de radius) — a regra proposta ("sm = controles, md = cards, lg = modais") é falsa contra o uso real: `Panel.tsx`, o próprio primitivo de painel, usa `rounded-lg`; todo controle/input usa `rounded-md`. Corrigida para a regra medida: `md` é o default (controles, inputs, linhas, itens de menu); `lg` é o contêiner de superfície primário (`Panel`, `Dialog`, `Popover`, os três cartões de anexo, `Composer`, bolha de mensagem); `sm` tem um único consumidor (`CapabilityChip`); `full` é circular/pílula.
- **Item 2** (`--font-size-sm` é o corpo) — ao verificar qual token o `body` de `base.css` de fato consome (`font-size: var(--font-size-sm)`, `base.css:61`) contra o valor real em `tokens.css` (14px), a skill `design-system` foi flagrada com o número errado: "13px" na tabela de densidades, resquício de antes da recalibração da DS5 (que subiu os quatro degraus de baixo em 1px). Corrigido no mesmo commit — é a "contagem que envelheceu" que o `CLAUDE.md` pede para nunca copiar sem reconferir.
- **Item 11** (listar os três consumidores do shell layout) — o comentário original afirmava três consumidores, incluindo "a largura que o plano 14 vai persistir". Conferido contra o plano 14: ele **decidiu contra isso** (D14.7 — não existe alça de redimensionar, persistir um booleano seria adiantar metade de uma feature). Hoje há **um** consumidor real (`Sidebar.tsx`). A ação não foi "listar os três" como o relatório pedia — foi corrigir a alegação.
- **Item 13** (processo de atualização do Primer) — o relatório propunha uma cadência de calendário ("a cada 6 meses"). Recusado: uma promessa de calendário sem automação que a cubra é dívida que ninguém paga. Registrado como gatilho de evento ("quando o Primer lançar novo major") em `ROADMAP.md § 2`, dono único de pendência — não na skill.
- **Item 18** (espessura de borda) — o relatório oferecia duas opções, uma delas "decidir via sessão, tendo em vista o padrão de mercado". Verificado contra o uso real: sempre 1px, com 2px em dois pontos sem relação entre si (barra de acento, anel do spinner) — a descrição original já batia com o código; nenhuma pesquisa de mercado era necessária.

Context7 foi consultado para confirmar que o namespace `--color-*` do Tailwind v4 cunha `bg-*`/`text-*`/`border-*`/`ring-*`/`divide-*` de uma vez só — a base técnica da rejeição do item 1 (declarar `--color-surface-hover` ali mintaria `text-surface-hover` de graça, o mesmo bug que a D10.1 já matou).

**Decisões tomadas com o usuário, antes da primeira edição:**

- Sigla **DS-7**, confirmada — nenhuma ocorrência prévia no repositório, e a trilha está em DS-6 como último marco em `implemented/`.
- Plano nasce **direto em `implemented/`**, sem passar por `active/` — mesmo padrão do DS-6 e do R-4: mapeamento completo (relatório item a item, filtro de chanceler, `advisor`) já tinha acontecido antes da primeira edição, e a execução aconteceu na mesma sessão.
- **4 passos** (tokens.css → skill → ROADMAP → fechamento), **um commit por passo** — pedido explícito do usuário nesta sessão.
- Migração de narrativa feita **passo a passo**, no mesmo commit que toca cada arquivo — não deferida ao fechamento, mesma disciplina que o DS-6 adotou a meio da sessão (DS6.4) e que o usuário confirmou de propósito aqui, em vez do "atualizar a skill depois de tudo implementado" do pedido original.
- Pendências fora do escopo (processo do Primer) registradas no `ROADMAP § 2`, não como passo deste plano.

## Itens descartados, e por quê

- **Item 1** (tokens de superfície interativa) — ver acima. O app já resolveu hover (escada de superfície) e seleção (borda + superfície + peso) sem tint. Um token novo duplicaria uma convenção que funciona e, posto em `@theme inline`, reabriria o bug da D10.1.
- **Item 5** (`--radius-xs`) — ver acima. `CapabilityChip` já responde "chip" com `rounded-sm`.
- **Item 8** (assimetria de hover entre cores de estado) — já é decisão registrada na skill desde o DS-6 ("se um dia precisar, o token nasce primeiro"). Sem ação nova.
- **Item 17** (ausência de tokens de opacidade) — já coberto pela mesma seção do DS-6 (`:disabled` é decisão por componente). Sem ação nova, para não duplicar.

## Passo 1 — `tokens.css` enxuga para declaração pura

Cabeçalho reescrito para citação única à skill `design-system`, no molde do `base.css`/`tailwind.css` (DS-6). Dez blocos de narrativa saem do arquivo (primitivos neutros, primitivos de cor + D10.1 + sufixo `-dark`/`-light`, três níveis de texto, `--color-backdrop`, sintaxe/Primer, escala de tipo + DS5, tamanho de leitura, layout da casca, tema claro/D10.3, canais do `ThinkingMark`) — a maioria já duplicada na skill (seções "Dois níveis de token" e "Cor de estado tem duas formas" cobrem primitivos/D10.1/tema claro desde antes); o que não estava lá migra no Passo 2. Nenhum valor de token muda — confirmado por `git diff` linha a linha antes do commit. Sobrevive só o comentário `--color-bg`/`src/main/index.ts`, mesmo critério catastrófico-e-não-óbvio do DS1.5.

## Passo 2 — skill `design-system` recebe a narrativa e duas correções

Nova seção "Tokens — convenções e registros de ausência (DS-7)": convenção de hover/seleção existente (sem token de tint), regra de radius corrigida, cinco ausências verificadas (`--control-height-xs`, `--duration-instant`, `z-index`, breakpoints/impressão, espessura de borda), quatro convenções sem token (alinhamento vertical, `line-height`, `--font-size-xl` órfão sem futuro prometido, gatilho de linha de contraste), o detalhe de `--color-backdrop` e do desencontro de nomes `--syntax-*`/`highlight.js`/Primer (incluindo a divergência deliberada do tema claro, D12.4), a correção do layout da casca (um consumidor real, não três) e a exceção do `ThinkingMark`. Duas correções fora do relatório: "13px" → "14px" na tabela de densidades; `--table-row-height` entra na lista de tokens fora de `@theme inline` (achado ao comparar `tokens.css` inteiro contra `@theme inline`, item 20 do relatório).

## Passo 3 — `ROADMAP.md` ganha o gatilho do Primer

Uma linha em `§ 2 Gatilhos de revisão`: "o Primer lançar um novo major" reabre a diferenciação de `--syntax-*` — sem cadência de calendário, ver descarte acima.

## Passo 4 — Fechamento

`pnpm typecheck` (três projetos) e `pnpm check:fast` verdes: 693 testes em 80 arquivos, incluindo `tokens.contrast.test.ts` sem nenhuma linha nova (nenhum par de cor novo entrou). Sem verificação ao vivo — nada muda de renderização; o portão é só o gate automatizado. `ROADMAP.md` já ganhou a linha do Primer no Passo 3; `plan/active/README.md` ganha a linha do DS-7 na tabela da trilha; este arquivo nasce direto em `implemented/`; entrada em `HISTORY.md`.

---

## Decisões

- **DS7.1 — Sigla DS-7 confirmada, sem disputa.** Diferente do DS-6 (que corrigiu a sugestão original do usuário), aqui não havia ocorrência prévia de DS-7 no repositório e a trilha já estava em DS-6 como último marco — a sugestão do usuário bateu com a checagem.
- **DS7.2 — Plano nasce direto em `implemented/`, com execução na mesma sessão.** Mesmo padrão do DS-6/R-4: mapeamento e filtro já tinham acontecido antes da primeira edição. Decidido explicitamente com o usuário, não por padrão silencioso — a alternativa (parar num plano em `active/` e implementar depois) foi levantada e recusada nesta sessão.
- **DS7.3 — Migração de narrativa por commit, não no fechamento.** O pedido original do usuário ("atualizar a skill depois de tudo implementado") foi ajustado com sua concordância explícita, repetindo a mesma disciplina que o DS-6 adotou a meio da sessão (DS6.4): diferir a migração deixaria a informação sem existir em lugar nenhum entre passos.
- **DS7.4 — Nenhum token novo, nenhuma verificação ao vivo.** Consequência dos itens 1 e 5 saírem: DS-7 é o primeiro plano da trilha DS que não muda um pixel sequer. Dito explicitamente em vez de fabricar uma checagem visual para cumprir ritual.
- **DS7.5 — Duas correções de fato fora do escopo do relatório entraram mesmo assim.** "13px" → "14px" (skill) e a alegação de três consumidores do shell layout (achada, não relatada) são exatamente o caso que o `CLAUDE.md` chama de "contagem que envelheceu": só apareceram porque cada alegação foi conferida contra o código antes de virar registro, não copiada do relatório ou do comentário anterior.
- **DS7.6 — Processo do Primer vai para `ROADMAP.md`, não para a skill, e sem cadência fixa.** Skill registra convenção e estado; `ROADMAP § 2` é o dono único de gatilho de revisão. Cadência de calendário sem automação que a cubra foi recusada nesta sessão e no DS-6 (mesma classe de decisão).
- **DS7.7 — `advisor` chamado duas vezes, mesma disciplina do DS-6/R-4.** A primeira, antes de editar, filtrou o relatório (descartou os itens 1 e 5, corrigiu a regra de radius, achou a checagem factual do "corpo em 13px"). A segunda, depois do portão verde — achou que a migração em si era o lugar onde uma alegação podia se esconder: quatro racionais tinham saído de `tokens.css` sem destino na skill. **A recalibração da DS5** (por que o corpo subiu de 13 para 14px, verificado contra o mapa `SIZE` do `Button`) — sem ela, a tabela de densidade corrigida atribuía 14px à "escala da fase 05", que nunca teve esse valor. **A restrição dos três níveis de texto** (a hierarquia lê por peso, não por um nível ser fraco demais para ler — `--color-text-faint` carrega rótulo de autoria e dica do `Field`, informação, não decoração). **A convenção do sufixo `-dark`/`-light`** nos primitivos de cor (a forma texto de cada cor de estado, com `blue` como a única escolha de gosto). E a metade do argumento de `--font-size-reading` que faltava ("ter o próprio token" também centraliza "aumentar a leitura do chat" num número só). As quatro entraram na skill no fechamento, mesma classe de achado que o DS6.6 registrou: escopo correto na primeira chamada não garante que a execução não perca conteúdo pelo caminho.

