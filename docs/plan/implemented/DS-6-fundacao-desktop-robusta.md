# DS-6 — Fundação de desktop robusta em `base.css` e `tailwind.css`

**Entrega:** `base.css` ganha `color-scheme` por tema, `forced-colors` (Windows High Contrast), `overflow-wrap`, autofill do Chromium neutralizado com o token real do campo, `caret-color`, `user-drag` desligado em mídia, `img` normalizado como bloco e `::selection`. Três convenções documentadas sem tocar CSS (`tabular-nums`, tokens fora de `@theme inline`, `:disabled` por componente) e sete decisões implícitas do estado atual escritas por extenso pela primeira vez. Toda a narrativa de decisão que vivia em comentário dentro de `base.css`/`tailwind.css` — a que já existia e a que este plano acrescentou — migrou para a skill `design-system`; só um aviso catastrófico e não óbvio (DS1.5, `tokens.css` nunca em `@layer`) sobreviveu como linha solta no fonte. `guard.mjs` passou a cobrir `base.css` nas guardas 6/7. Verificado ao vivo contra o app real (Playwright temporário, escrito e apagado) nos dois temas.

> Sexto plano da trilha DS, de natureza diferente dos cinco anteriores: DS-1/DS-2 tinham o aceite "zero mudança visual", DS-3/DS-4/DS-5 tinham "a tela chega ao alvo". Este não muda layout nem cor visível de propósito — é robustez de **plataforma**: como o Chromium se comporta num app desktop Windows (chrome nativo, alto contraste, string longa, autofill), não como o app se parece.

---

## O caso — por que este plano existe

Nasceu de um relatório externo (`notes/prompts/p_tailwind-base.md` + `notes/reports/r_tailwind-base.md`), 25 itens propostos para `base.css`/`tailwind.css`, organizados em alta/média/baixa + verificações de consistência. Como chanceler da proposta, cada item foi verificado contra o repositório real — os dois arquivos lidos por inteiro, `tokens.css` conferido token a token, `guard.mjs` lido para confirmar cobertura — antes de aceitar qualquer um, com o `advisor` (Opus) chamado antes de qualquer edição para filtrar o escopo.

**O `advisor` corrigiu quatro coisas antes da primeira edição:**

- **Item 7** (`scrollbar-gutter: stable` em `html`) — reservaria ~10px na janela inteira, permanentemente, sem resolver o problema real (conteúdo pulando dentro de painel que rola, não da janela). Descartado.
- **Item 13** (`@custom-variant hover-enabled`) — abstração prematura para 5 ocorrências adjacentes em `Button.tsx`; `hover:not-disabled:` já é Tailwind padrão e autoexplicativo. Descartado.
- **Item 4** (autofill) — o relatório propunha `var(--color-surface)`; os inputs reais (`ConversationList.tsx`, `CloudSecrets.tsx`) usam `bg-surface-sunken`. Corrigido para `--color-surface-sunken` antes de escrever a regra.
- **Item 6** (`user-drag`) — o relatório incluía `user-select: none` junto, redundante: `html` já declara isso na raiz, herdado. Removido.

Como consequência do item 7 sair, a lista de verificação ao vivo do próprio relatório (itens 2 e 7) deixou de fazer sentido — o `advisor` apontou que os itens 1 e 9 também não são inertes (mudam renderização real de `<meter>`/`<option>`/placeholder e não têm cobertura em `tokens.contrast.test.ts`, respectivamente), então a lista final ficou em **1, 2 e 9**.

Context7 foi consultado uma vez, no meio da sessão, para confirmar que `tabular-nums` (item 10) não sofre o mesmo tipo de armadilha que `--font-weight-*` sofreu com `--font-*: initial` — confirmado contra a documentação oficial do Tailwind: é `font-variant-numeric: tabular-nums`, uma declaração estática sem `var()`, imune aos resets de `@theme inline`.

**Decisões tomadas com o usuário, antes da primeira edição:**

- Sigla **DS-6**, não a DS-7 sugerida — a trilha DS-1 a DS-5 está toda em `implemented/`, sem nenhuma ocorrência de `DS-6`/`DS-7` em `docs/`, `notes/` ou `.claude/` (conferido por grep), então o próximo da sequência é o 6.
- Plano nasce **direto em `implemented/`**, sem passar por `active/` — mesmo padrão do R-4: o relatório já vinha detalhado item a item, e o mapeamento (verificação contra o repositório, filtro de chanceler, consulta ao `advisor`) já tinha acontecido antes da primeira edição.
- **4 passos por categoria** (Alta, Média, Leve, Fechamento), um commit por passo.
- Toda a narrativa de decisão que o relatório sugeria como comentário nos dois arquivos CSS consolida na skill `design-system`, com uma citação única no topo de cada arquivo — pedido explícito do usuário, tratado como refatoração saudável, estendido também à narrativa que **já existia** nos dois arquivos antes deste plano (não só a que os itens novos trariam).
- Pendências fora do escopo (itens que exigiriam tocar componente) registradas no `ROADMAP § 2`, não como passo deste plano.

## Itens descartados, e por quê

- **Item 7** (`scrollbar-gutter: stable` em `html`) — ver acima. Resolvido de verdade exige `stable both-edges` no container que rola de fato, dentro de um componente de feature — fora do escopo de um plano que só toca `base.css`/`tailwind.css`/`guard.mjs`. Registrado no `ROADMAP § 2`.
- **Item 11** (rever sombra/gradiente) — contradiz o princípio 2 do próprio relatório ("a filosofia do produto vence o padrão genérico"), não traz proposta de CSS nenhuma, e reabre uma decisão deliberada e citada em `icon.ts` ("flat, shadow-free, gradient-free"). Registrado no `ROADMAP § 2` com gatilho de reabertura (proposta concreta de token, não comparação genérica).
- **Item 13** (`@custom-variant hover-enabled`) — ver acima. Decisão de manter `hover:not-disabled:` inline (a própria opção B do relatório) registrada na skill `design-system`, sem tocar `Button.tsx`.

## Passo 1 — Alta: `base.css` ganha fundação de desktop

`color-scheme` por tema (item 1), `forced-colors: active` (item 2), `overflow-wrap: break-word` no `body` (item 3), autofill do Chromium neutralizado com `--color-surface-sunken` (item 4, token corrigido), `caret-color` (item 5), `-webkit-user-drag: none` em `img`/`svg`/`video` sem `user-select` redundante (item 6), `img` normalizado como bloco (item 8). Cabeçalho do arquivo reescrito para uma citação única à skill `design-system` + o aviso DS1.5; toda a narrativa que já existia (correções ao preflight, `option`/`meter`/`::placeholder` revertendo ao chrome nativo, `:focus-visible` só no teclado) migrou para a skill no mesmo commit.

## Passo 2 — Média: `::selection` e o padrão de tokens do `tailwind.css`

`::selection` com `color-mix(in oklab, var(--color-accent-text) 30%, transparent)` (item 9, opção A do relatório). Convenções documentadas só na skill, sem CSS: `tabular-nums` por superfície de dado (item 10), tokens fora de `@theme inline` — `--duration-*`/`--control-height-*`/`--sidebar-width*`/`--thinking-*` por referência direta, `--color-backdrop`/`--syntax-*` por consumidor único fora do Tailwind (item 12, incorporando a verificação do item 23) —, `:disabled` por componente (item 14). Cabeçalho e todo comentário narrativo de `tailwind.css` (`@theme inline`, os resets `initial`, as solid fills, o spinner, o `ThinkingMark`) migraram para a skill no mesmo commit — só o aviso DS1.5 e a sincronia `dotThinking`/`prefers-reduced-motion` (também catastrófico-e-não-óbvio: sem ela, um usuário de movimento reduzido vê a marca congelada fora de forma) sobreviveram como linha solta.

## Passo 3 — Leve: documentação do estado implícito + `guard.mjs`

Sete decisões que já existiam no código, sem registro escrito, viraram parágrafo na skill: ausência de media query de largura (item 15), font rendering deliberado (item 16), reset de `ul` e a interação com `MarkdownMessage` (item 17), scrollbar sem token dedicado (item 18), `::backdrop` por componente (item 19), fills sólidos sem hover para `danger`/`warn`/`ok` (item 21), `ease-initial` como palavra-chave do Tailwind, não token (item 22) — todas verificadas contra o código real antes de escrever, nenhuma CSS tocada. Item 20 (`--font-weight-*` sobrevive ao reset) já tinha sido coberto no Passo 2, ao migrar o comentário original. `guard.mjs` (guardas 6/7, cor literal e token desconhecido) passou a cobrir `base.css` ao lado de `*.module.css` e `tailwind.css` — confirmado sem violação rodando o hook manualmente contra os dois arquivos finais.

## Passo 4 — Fechamento

`pnpm typecheck` (três projetos) e `pnpm check:fast` (693 testes, 80 arquivos) verdes. Verificação ao vivo com um spec Playwright temporário (`e2e/dev/ds6-live-check.spec.ts`, escrito, rodado e apagado — mesmo padrão do N-1-B) contra o app real, cobrindo os três pontos que o `advisor` apontou como não inertes:

- **Item 1** — `<meter>`/`<select>`/placeholder injetados na página, capturados nos dois temas (`emulateMedia({ colorScheme })`): controle nativo troca de esquema claro/escuro corretamente, casado com o resto da UI.
- **Item 9** — seleção real por arraste de mouse (a Selection API programática não pinta `::selection` sem foco de janela real — achado desta verificação) sobre um texto injetado, nos dois temas: legível nos dois.
- **Item 2** — `emulateMedia({ forcedColors: 'active' })` (a mesma emulação que o DevTools do Chromium usa — não o toggle real do tema de contraste do Windows, que exigiria mudar uma configuração de acessibilidade do sistema operacional): todo controle interativo (botões, inputs, `<select>`) ganhou contorno visível que não existia antes.

**Segunda chamada ao `advisor`, depois do portão verde e antes do commit de fechamento** (pedido explícito do usuário) — achou três coisas reais:

1. **A afirmação "nenhuma mudança de layout" (item 8, `img { display: block }`) não tinha prova** — a verificação ao vivo do Passo 4 não exercitou nenhuma imagem. Medido depois, com um probe temporário: no único consumidor real (`ImageCard`, imagem de tamanho real 180×140 dentro de um `<div>` sozinha), a diferença de altura entre `inline` e `block` é **zero** — o "gap fantasma" só existe quando a imagem é menor que a linha de texto ao redor. `MarkdownMessage` não é um segundo consumidor: `urlTransform` zera todo `src` de imagem markdown sob o CSP, então nenhum `<img>` chega a renderizar ali. Pergunta irmã, sobre `overflow-wrap` contra célula de `DatasetPreview` (`white-space: nowrap`): também medida — `nowrap` vence, a célula não quebra, comportamento idêntico ao anterior.
2. **Comentário órfão em `tailwind.css`** — a linha sobre `dotThinking`/`prefers-reduced-motion` apontava "veja a skill", mas a skill não tinha essa frase. Uma sentença adicionada ao parágrafo de `thinking-dot`.
3. **A racional da DS1.1 (por que `tailwind.css` é arquivo próprio, nunca fundido em `tokens.css`) tinha sumido** na migração — não sobreviveu no fonte (correto, não é catastrófico-e-não-óbvio) nem foi para a skill (incorreto, é a resposta a "por que não simplificar em um arquivo só"). Adicionada.

Os três ajustes entraram no mesmo commit de fechamento, pela mesma razão de atomicidade da DS6.4.

`ROADMAP.md` ganhou a linha 33 (§1) e duas linhas de pendência (§2, itens 7 e 11); `plan/active/README.md` ganhou a linha do DS-6 na tabela da trilha; este arquivo nasce direto em `implemented/`; entrada em `HISTORY.md`.

---

## Decisões

- **DS6.1 — Sigla DS-6, não DS-7.** A sugestão original do usuário pulava um número; a trilha DS-1 a DS-5 está toda em `implemented/` e nenhuma ocorrência de `DS-6`/`DS-7` existia no repositório antes deste plano.
- **DS6.2 — Plano nasce direto em `implemented/`.** Mesmo padrão e mesmo motivo do R-4: mapeamento completo (relatório item a item, filtro de chanceler, `advisor`) já tinha acontecido antes da primeira edição.
- **DS6.3 — Toda narrativa de decisão sai da CSS e entra na skill `design-system`, inclusive a que já existia.** Critério de sobrevivência como linha solta no fonte: só o aviso cuja violação é catastrófica **e** não óbvia (DS1.5; e, em `tailwind.css`, a sincronia `dotThinking`/`prefers-reduced-motion`). Explicação de "por que o valor é esse" migra inteira, mesmo quando não fazia parte dos 25 itens do relatório — decisão do usuário, tratada como refatoração saudável.
- **DS6.4 — Migração de narrativa feita passo a passo, no mesmo commit que toca cada arquivo — não deferida ao Passo 4.** Pequeno desvio do pedido original do usuário ("atualizar a skill depois de tudo implementado"), que valia para as decisões **novas**; para a narrativa **migrada**, deferir criaria uma janela em que a informação não existe em lugar nenhum — a mesma falha de fonte única que o projeto existe para evitar. Ajustado com a concordância do usuário antes de editar.
- **DS6.5 — Verificação ao vivo via Playwright temporário, não toggle real do Windows.** `forced-colors: active` foi verificado pela emulação do Chromium (mesma tecnologia do DevTools), não por ligar um tema de contraste real do sistema operacional — mudar uma configuração de acessibilidade do SO é ação de escopo maior que este plano, fora de uma sessão de agente autônomo. Achado incidental: `page.screenshot()` não captura `::selection` de uma seleção programática (`Range`/`Selection` API) sem foco real de janela — só um arraste de mouse de verdade pinta a cor.
- **DS6.6 — `advisor` chamado duas vezes, não uma.** Antes de qualquer edição (filtrou o escopo — descartou os itens 7 e 13, corrigiu o token do item 4) e depois do portão verde, antes do commit de fechamento (achou a alegação "sem mudança de layout" do item 8 sem prova, um comentário órfão em `tailwind.css` e a racional da DS1.1 desaparecida — ver Passo 4). Mesma disciplina que o R-4 registrou: escopo correto na primeira chamada não garante execução sem deriva — vale medir de novo antes de fechar.
- **DS6.7 — Itens 7, 11 e 13 não viram passo deste plano.** Os dois primeiros exigem tocar componente (scrollável real, `Button.tsx`) ou reabrir uma decisão de produto sem proposta concreta — registrados no `ROADMAP § 2` com gatilho de reabertura. O terceiro é decisão fechada (abstração prematura), registrada na skill, não pendência.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 24/08/2026 | 1 | Plano concluído numa sessão só, nascido direto em `implemented/` por pedido do usuário. Relatório (`notes/reports/r_tailwind-base.md`, 25 itens) avaliado item a item contra o repositório real; `advisor` consultado antes da primeira edição (descartou os itens 7 e 13, corrigiu o token do item 4, removeu redundância do item 6, ampliou a lista de verificação ao vivo). Context7 confirmou o item 10 seguro. 4 passos, 4 commits: Alta (`base.css`, itens 1-6/8), Média (`::selection` + tokens do `tailwind.css`, itens 9/10/12/14), Leve (documentação dos itens 15-22 + `guard.mjs` cobrindo `base.css`), Fechamento (portão verde, verificação ao vivo via Playwright temporário confirmando itens 1/2/9 nos dois temas, `ROADMAP`/`plan/active/README.md` atualizados). Itens 7 e 11 registrados como pendência no `ROADMAP § 2`; item 13 registrado como decisão fechada na skill. | Plano concluído — nasce e fecha na mesma sessão, sem pendência de retomada. |
