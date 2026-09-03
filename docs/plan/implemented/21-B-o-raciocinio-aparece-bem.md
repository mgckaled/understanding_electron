# 21-B — O raciocínio aparece bem

> Continuação de [`21-A`](21-A-o-raciocinio-atravessa.md), que fez o dado atravessar as três camadas e deixou dois pontos de exibição propositalmente mínimos (D21A.8), cada um marcado no código "the elegant block is 21-B's". Levantamento de mercado (Vercel AI SDK Elements "Reasoning") e verificação técnica (MDN, `calc-size()`) feitos ao vivo nesta sessão, não num guia `reference/` separado — o corte é pequeno o bastante para não precisar de um.

**Escopo do corte:** troca os dois pontos provisórios (`ConversationView.tsx:228-238` streaming, `MessageList.tsx:74-87` histórico) por um único componente novo, `ReasoningDisclosure` — recolhível, com prosa achatada (sem markdown visível) e rótulo por provedor. Reduz a banda `RespondingMark` pela metade e dá a ela um rótulo de duas fases. Camada visual só — nenhum canal IPC, schema, provider ou `core/ai/budget.ts` é tocado (isso é 21-C, orçamento de contexto, aberto para depois deste corte, por acordo com o usuário).

---

## Decisões

### D21B.1 — Rótulo de duas fases no `RespondingMark`, derivado do estado que já existe

`streaming`/`streamingReasoning` já vêm separados de `useConversationChat`. `thinking = streamingReasoning !== '' && streaming === ''` substitui o texto fixo `respondendo{dots}` por `{thinking ? 'Pensando' : 'Respondendo'}{dots}` — nenhum hook novo, nenhum estado novo.

### D21B.2 — O monograma não escala com o container; precisa de um multiplicador próprio

`.responding-dot` é `position: absolute; top/left: 50%` + `translate()` (`tailwind.css:101-112`) — o `<div>` `h-[46px] w-[57px]` é só *footprint* de flex, não recorta nem escala o desenho (o ponto `d14`, `cx: 38.45`, já ultrapassa os 57px hoje). Reduzir só as classes do container não muda o tamanho visual — é a armadilha. `MARK_REDUCTION = 0.5` (ponto de partida, ajustável ao vivo) multiplica `cx`/`cy`/`r`/`variance.dx`/`variance.dy` em `dotStyle`, nunca `variance.pulseScale` (multiplicador sem unidade de um `scale()`, não uma distância).

### D21B.3 — Disclosure com auto-open/auto-collapse por streaming, clique manual sempre vence

Padrão de mercado confirmado ao vivo (Vercel AI SDK Elements "Reasoning": abre automaticamente durante streaming, fecha automaticamente ao terminar). Aqui: `open` deriva de `thinking` durante o render (mesmo padrão que `useRespondingLoop.ts` já usa — "o próprio render é a saída, não uma sincronização com sistema externo"), até que um clique manual marque `overridden = true`, que passa a valer pelo resto do turno. `aria-expanded`/`aria-controls` no próprio componente (sem primitivo por trás, mesmo estilo que todo consumidor de `Popover` já declara os próprios atributos) — ao contrário do precedente negativo em `DocumentCard.tsx:25-26` ("not aria-expanded: nothing expands here"), aqui o comportamento realmente expande/recolhe.

⚠️ **Ordem dos hooks é regra, não estilo:** o guard de conteúdo vazio (`flat === ''`) só pode vir **depois** de todos os `useState`/`useMemo` do componente — `flattenReasoning` pode devolver `''` no primeiro chunk (whitespace puro) de um streaming que logo em seguida deixa de ser vazio, e um `return` antes dos hooks mudaria a contagem de hooks entre um render e o outro (React rejeita em runtime).

### D21B.4 — `SERVICE_LABEL` consolidado numa fonte única, wording do `CapabilitiesPanel`

Hoje existem **dois** mapas `Record<AiService, string>` divergentes: `ConversationView.tsx` (`'o Ollama'`, com artigo) e `CapabilitiesPanel.tsx` (`'Ollama'`/`'GLM (Z.ai)'`/`'Gemini (Google)'`, sem artigo). Confirmado com o usuário: o selo do disclosure usa o segundo. Extraído para `src/renderer/src/shared/serviceLabel.ts` — não pode ficar exportado de dentro de `CapabilitiesPanel.tsx` porque `react-refresh/only-export-components` recusa um `.tsx` que já exporta componente exportando mais um símbolo (mesma regra que tirou `formatCell.ts` de dentro de `DatasetTable.tsx`). `ConversationView.tsx` migra também — a frase de status muda de "Verificando o GLM…" para "Verificando o GLM (Z.ai)…" (artigo passa a viver na frase, não no mapa), confirmado com o usuário como consequência aceitável.

### D21B.5 — Animação de altura via `calc-size(auto, size)`, sem opt-in global

Primeiro uso de animação de altura automática no projeto (confirmado: zero `grid-template-rows`/`interpolate-size`/`calc-size` em `src/renderer/src` antes deste corte). `calc-size(auto, size)` aplica `interpolate-size: allow-keywords` **escopado ao próprio valor** — confirmado na documentação oficial (MDN), não precisa de `:root { interpolate-size: allow-keywords }` global, que teria efeito colateral em qualquer outro elemento do app animando para uma palavra-chave intrínseca. Suporte desde Chromium 129; Electron 42 embute Chromium 148 — sem fallback, mesmo espírito do `field-sizing: content` já usado sem ressalva no `Composer.tsx`. Duração `--duration-base` (200ms, já existe), timing function `ease-initial` (utilidade Tailwind, precedente em `app/Sidebar.tsx`) — nenhum token novo.

A transição só carrega quando `open` muda de verdade (auto-collapse ou clique manual) — nunca durante os re-renders de streaming com `thinking` continuamente `true`, ou cada chunk novo recortaria o texto mais recente atrás de 200ms de `overflow: hidden`.

### D21B.6 — Achatamento de raciocínio sem `strip-markdown`, sem `remark-stringify` — lição do DE1E.9 reaplicada

Achado ao vivo pelo usuário: Ollama e GLM devolvem raciocínio em markdown estruturado (negrito, listas aninhadas), hoje mostrado cru (`**`/`*` literais na tela). Alvo: prosa corrida, sem marcador nenhum. O projeto já usou `strip-markdown` (E-1-D) e **removeu** (E-1-E, DE1E.9) porque ele apaga silenciosamente blocos de código e tabela inteiros (`code: empty`, `table: empty` — descarta o nó, não só a formatação) e, mesmo corrigido, ainda passa por `remark-stringify`, que escapa caractere que pareça markdown na prosa original. Lição registrada, literal: "a saída não é escapar melhor, é não serializar". `src/core/ai/reasoningText.ts` reaplica a mesma solução — percorredor de árvore próprio sobre a mdast de `parseMarkdown` (`core/export/markdown.ts`, `remark`+`remark-gfm`, já dependências instaladas), espelhando `runsOf`/`blocksOf` de `core/export/blocks.ts`: nunca re-serializa, nunca descarta conteúdo de código/tabela (só colapsa espaço em branco dentro deles — decisão consciente, ver Passo 1, diferente do problema do DE1E.9 porque aqui o alvo é prosa, não código citável).

`core/ai/reasoningText.ts` nunca é importado por `main/` — só o renderer precisa achatar texto para exibição; um import futuro do `main` arrastaria `remark` para o bundle CJS e reabriria o risco ESM-only do DE1D.9.

---

## Passos

### Passo 0 — Este arquivo

Nasce nesta sessão, por acordo com `ROADMAP.md § 1` (planos 21-23 só ganham arquivo na sessão que os executa).

### Passo 1 — `src/core/ai/reasoningText.ts` (+ teste)

`flattenReasoning(text: string): string`, independente dos demais passos. Ver D21B.6 para a forma exata (dois níveis de junção — inline com `''`, bloco com `' '` — espelhando `runsOf`/`blocksOf`).

### Passo 2 — `src/renderer/src/shared/serviceLabel.ts`

Extrai `SERVICE_LABEL` de `CapabilitiesPanel.tsx` (ver D21B.4). Independente.

### Passo 3 — `src/renderer/src/features/conversation/ReasoningDisclosure.tsx` (+ teste)

Depende de 1 e 2. Componente central — ver D21B.3 e D21B.5 para a forma exata (ordem dos hooks, `calc-size`, `aria-expanded`).

### Passo 4 — `RespondingMark.tsx` + `useRespondingLoop.ts`

Independente. `MARK_REDUCTION` (D21B.2), prop `thinking` (D21B.1), banda `px-7 py-5` → `px-7 py-3`.

### Passo 5 — `ConversationView.tsx`

Depende de 2, 3, 4. `SERVICE_LABEL` migrado, `thinking` calculado, `ReasoningDisclosure` no lugar do `<p>` provisório, `RespondingMark` com a prop nova, `MessageList` recebendo `service`.

### Passo 6 — `MessageList.tsx`

Depende de 3 e da prop `service` do passo 5. `reasoning` hoisted, `ReasoningDisclosure` sem `thinking` (modo histórico).

### Passo 7 — Testes e verificação ao vivo

Nível 1 (`reasoningText.test.ts`): igualdade de string completa, nunca `toContain` (lição do DE1E.9). Nível 2 (`ReasoningDisclosure.test.tsx`): `aria-expanded` nos quatro cenários (fechado por padrão, aberto no mount com `thinking`, auto-collapse no rerender, override manual persiste). `RespondingMark.test.tsx` e `ConversationView.test.tsx` atualizados. Ao vivo: prosa achatada real (Ollama e GLM), transição sem corte de texto durante "pensando", `MARK_REDUCTION` ajustado se o ponto `d14` sumir, tema claro/escuro.

### Passo 8 — Fechamento e auto-conservação

Diário abaixo. `docs/ROADMAP.md` item 29. `docs/reference/reasoning/README.md` § "Proposta de cortes" (prosa que ainda fala como se 21-A não tivesse acontecido). `.claude/skills/design-system/reference.md` ganha uma entrada para `calc-size()`/animação de altura — zero menção hoje, e este corte introduz o primeiro uso no projeto.

---

## O que **não** esperar deste plano

- Orçamento de contexto, faixas fixas, reserva de saída para raciocínio no `budgetFor` — **21-C**, já acordado com o usuário, aberto quando este corte fechar.
- Qualquer mudança em `ollama.ts`/`glm.ts`/`gemini.ts`, no schema `ReasoningPart`, ou no toggle "Raciocínio visível" do `AttachButton.tsx`.
- Painel do Observatório separando decode de raciocínio e de resposta — **O-9**, condicional, fora da numeração do arco 21.

---

## Diário de execução

| Data | O que foi feito |
|---|---|
| 02/09/2026 | Plano elaborado em modo de planejamento (Context7 + web search obrigatórios, conforme pedido: pesquisa do padrão de mercado no Vercel AI SDK Elements "Reasoning", verificação de `calc-size()`/`interpolate-size` na documentação oficial MDN, precedente `strip-markdown`/DE1E.9 relido em `plan/implemented/E-1-E`). Dois agentes de exploração levantaram o estado real do código (renderização de `MessagePart`, precedentes de disclosure/animação no design system). Um agente de design produziu o desenho detalhado. Submetido ao advisor Opus antes de fechar — quatro achados corrigidos: (1) ordem dos hooks em `ReasoningDisclosure` — o guard de conteúdo vazio precisa vir depois de todos os `useState`, não antes (React rejeitaria em runtime); (2) `service` em `MessageList` verificado como o par travado da conversa (D15.13), não um valor de picker global — sem mudança de desenho, só confirmação; (3) decisão explícita registrada sobre o achatamento colapsar espaço em branco dentro de blocos de código do raciocínio, distinguindo essa garantia da do DE1E.9; (4) passo de fechamento/auto-conservação adicionado (faltava no desenho inicial). Plano aprovado pelo usuário. |
| 02/09/2026 | **Passos 1-8 implementados na mesma sessão.** `core/ai/reasoningText.ts` (nível 1, 4 testes, todos hand-derived e verdes de primeira — confirma o entendimento do parser); `shared/serviceLabel.ts` extraído, `CapabilitiesPanel.tsx` migrado; `ReasoningDisclosure.tsx` (nível 2, 4 testes) — bug real pego pelo próprio teste antes de rodar (`aria-expanded` sem import de `screen` no `RespondingMark.test.tsx`, corrigido na hora); `RespondingMark`/`useRespondingLoop` com `MARK_REDUCTION` e rótulo de duas fases; `ConversationView.tsx` e `MessageList.tsx` religados, três asserções antigas (texto cru "Raciocínio: …") reescritas para `aria-expanded`. `pnpm check:fast` verde: typecheck limpo (3 projetos), lint com 1 aviso pré-existente não relacionado (`DraftEditor.tsx`), **1318 testes, 148 arquivos**. Fechamento: `21-A` movido para `implemented/` (pedido do usuário — o que ficara em aberto nele já é escopo do 21-C), entrada nova no topo do `HISTORY.md` (a 11ª empurrou `E-2` para o archive), `ROADMAP.md` item 29 atualizado, `reference/reasoning/README.md` § "Proposta de cortes" corrigido (prosa que falava como se 21-A não tivesse acontecido), `design-system/reference.md` ganhou a entrada de `calc-size()`. **Falta:** verificação ao vivo — o usuário assumiu essa parte fora desta sessão. Comentário no código mantido ao mínimo, a pedido explícito do usuário nesta sessão (skill `comments` à risca, não narrativa). |
| 02/09/2026 | **Verificação ao vivo do usuário achou três pontos reais, todos corrigidos na mesma sessão.** (1) **Disclosure não colapsava/expandia visualmente** — causa: `h-0` não gera CSS nenhum neste projeto (`--spacing-*: initial`, só `--spacing-1..9` definidos), armadilha **já documentada** em `ARMADILHAS.md` ("`min-w-0` não gera CSS quando a base `--spacing` do Tailwind está desligada", DS-2) e que eu deveria ter grepado antes de escrever `'h-0'` — não grepei, caiu na mesma pegadinha pela segunda vez no projeto (a primeira foi o `Sidebar.tsx`). Corrigido para `h-[0px]`, confirmado no CSS construído (`grep` em `out/renderer/assets/*.css`, "o único juiz é o CSS gerado", como a skill `design-system` já manda). Nenhuma outra ocorrência de utilitário numérico `-0` bare encontrada no restante do `renderer` — caso isolado. (2) **Terceira fase de streaming faltando**: antes do primeiro token (raciocínio ou conteúdo) chegar, o rótulo já dizia "Respondendo" — falso, é rede+prefill (o próprio vocabulário que o O-7 já usa). `RespondingMark` ganhou `phase?: 'connecting' \| 'thinking' \| 'responding'` (troca o `thinking?: boolean` antigo), rótulo "Preparando…" na fase nova; `ConversationView.tsx` deriva `phase` a partir de `streaming`/`streamingReasoning`, mesma fonte de sempre. (3) **Espaçamento do `RespondingMark`** ajustado a pedido: `pb-4` (era `py-3`, só o vão até o composer cresce) e `gap-4` (era `gap-3`, só o vão entre o monograma e o texto) — ambos os passos de `--space-*` disponíveis (6px→8px), sem token novo. Usuário também compartilhou, "para registro", um caso real onde o raciocínio (qwen3.5:2b) saiu muito mais longo que a resposta final — evidência direta a favor do 21-C, guardada, não agida agora. `pnpm check:fast` verde de novo: 1318 testes, 148 arquivos, CSS reconstruído e conferido. |
| 02/09/2026 | **Duas rodadas finais de refinamento, ainda em verificação ao vivo, ambas fechadas.** (1) Card do raciocínio: passou a usar o mesmo estilo do `StepProposalLine`/`DatasetCard` (`rounded-lg border border-border bg-surface-raised px-5 py-4`, referência explícita do usuário), em vez de texto solto sem moldura. (2) Ícone de lâmpada (`Lightbulb`, já usado no `AttachButton` para a mesma ideia de "raciocínio") ao lado do rótulo de provedor — pulsando em `--color-warn-text` (token semântico, nunca hex solto) enquanto `thinking === true`, novo token `--duration-warn-pulse-cycle: 1200ms` para um pulso perceptível (pedido explícito do usuário: "bastante perceptível, velocidade razoável") — `prefers-reduced-motion` já coberto pela regra global do `base.css`, sem código extra. Depois de discutido, o ícone passou a ficar **sempre montado** (não some quando o pensamento termina), só troca de aceso/pulsando para apagado (`text-text-faint`) — mantém a marca de "isto teve raciocínio" mesmo com o card fechado. Mais um ajuste de espaçamento (`mb-1` no próprio card, para não inflar o `gap-2` compartilhado com o resto do turno). `pnpm check:fast` verde: 1319 testes. **Aprovado pelo usuário** ("tudo excelente, pode finalizar") — plano fechado nesta sessão. |
