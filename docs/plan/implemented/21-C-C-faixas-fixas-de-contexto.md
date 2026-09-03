# Plano 21-C-C — faixas fixas de contexto + campo numérico

> Terceiro de três planos do arco 21-C. Ver [`21-C-A`](21-C-A-orcamento-de-geracao.md), [`21-C-B`](21-C-B-motivo-de-parada.md), [`21-A`](../implemented/21-A-o-raciocinio-atravessa.md) e [`21-B`](../implemented/21-B-o-raciocinio-aparece-bem.md).

## Contexto

`ContextControl.tsx` é hoje um slider contínuo (1024 até o teto do modelo, marcas de dobramento só como rótulo). Quanto maior o teto nativo (`qwen3.5:2b` tem 256k), mais difícil escolher um ponto razoável arrastando. Decisão desta sessão: faixas fixas de 4k/8k/16k/32k/64k/128k/256k, **mais** um campo numérico livre que arredonda para múltiplo de 1024 — "o melhor dos dois mundos".

O domínio de baixo nível continua sendo o token bruto, nunca um índice — preserva a garantia já defendida pelo comentário de `ContextSlider` (F2.5, revisado pelo advisor no passado): uma conversa travada num valor fora das faixas continua mostrando esse valor real, sem forçar encaixe na faixa mais próxima.

Revisado pelo advisor: o filtro `CONTEXT_BANDS.filter(v => v <= ceiling)` esvaziaria para um teto abaixo de 4096 — corrigido replicando a garantia que `contextTicks()` já tinha (o teto real sempre alcançável, mesmo fora das faixas). `MIN_NUM_CTX` **não** sobe para 4096 — continua 1024, o piso de `fitsInMemory`/`too-large` (D15.10) e a unidade de arredondamento do campo numérico, sem relação com o pedido de faixas.

Este corte também é o "martelo do Gemini": o switch "Raciocínio visível" fica desligado especificamente para esse provedor — não porque o modelo não pense (pensa; `thinkingLevel` tem piso `'low'` sem "desligar" real), mas porque `generateContent`/`streamGenerateContent` **não tem bloco de pensamento dedicado**, confirmado via Context7 (`/googleapis/python-genai`) e a documentação oficial da Interactions API (`ai.google.dev/gemini-api/docs/interactions/thinking`) — não é bug, é a forma de resposta do endpoint. A Interactions API expõe raciocínio de verdade para os mesmos dois modelos do catálogo, e a pergunta que travava a migração (`store: false` preserva o stateless full-history-resend, D21A.6) está respondida — sim. Migrar fica fora de escopo aqui, vira plano futuro sem número.

## Decisões

- **D21C.6 — `CONTEXT_BANDS = [4096, 8192, 16384, 32768, 65536, 131072, 262144]`**, `MIN_NUM_CTX` mantido em 1024.
- **D21C.7 — o teto do modelo sempre entra na lista**, mesmo fora das faixas: `[...CONTEXT_BANDS.filter(v => v < ceiling), ceiling]`.
- **D21C.8 — `SegmentedField` sobe para `shared/ui/`** (segundo chamador fora de `settings/`, mesma régua de `SidePanel`/`Tabs`/`CapabilityChip`), ganhando `flex-wrap` (7 faixas não cabem numa linha do popover de 360px).
- **D21C.9 — `Slider`/`Slider.test.tsx` saem do repositório** (único chamador era `ContextControl`); `design-system/SKILL.md` atualiza a lista de primitivos e a linha "100% utilitários" — mesmo precedente do DS-8 (Panel/Toolbar apagados ao perderem o último chamador).
- **D21C.10 — `exposesReasoning(model)` em `core/ai/models.ts`**: `hasCapability(model,'thinking') && model.provider !== 'gemini'`. Gate do switch em `AttachButton.tsx` troca de `hasCapability` puro para esta função; `capabilities.ts`/`CapabilityChip` (sigla `TH`) não mudam — comunicam a capacidade real do modelo, não o que este app expõe hoje.
- **D21C.11 — a migração para a Interactions API do Gemini fica documentada, não implementada.** `docs/ROADMAP.md` linha 119 e `docs/reference/reasoning/README.md` recebem o achado; plano futuro nasce sem número, quando for a vez.

## Passos

1. `core/ai/budget.ts`: `CONTEXT_BANDS`.
2. `core/ai/models.ts`: `exposesReasoning`.
3. `AttachButton.tsx`: `hasThinking = model !== null && exposesReasoning(model)`.
4. `features/settings/Settings.tsx` → `shared/ui/SegmentedField/SegmentedField.tsx`: promoção, `flex-wrap` no grupo de botões, `Settings.tsx` importa de lá.
5. `ContextControl.tsx`: `contextTicks`/`thinLabels` saem; `ContextSlider` vira `ContextBands` (faixas via `SegmentedField` + campo numérico livre, `Field` + `<input type="number">`, commit no blur arredondando para múltiplo de `MIN_NUM_CTX`, clamp `[MIN_NUM_CTX, ceiling]`).
6. Remove `Slider.tsx`/`Slider.test.tsx`.
7. `.claude/skills/design-system/SKILL.md`: lista de primitivos e "100% utilitários" atualizadas.
8. `docs/ROADMAP.md` linha 119 e `docs/reference/reasoning/README.md`: achado da Interactions API.

## Testes

- Nível 1 (`models.test.ts`): `exposesReasoning` verdadeiro para Ollama/GLM com `thinking`, falso para Gemini mesmo com `thinking` na lista.
- Nível 2 (`contextBudget.test.tsx`): clique em faixa commita valor exato; campo numérico arredonda no blur; `ceiling` abaixo da menor faixa ainda oferece o próprio `ceiling`; modelo Gemini com switch de raciocínio indisponível.

## Verificação ao vivo (fica com o usuário)

- Clicar cada faixa e o campo numérico, modelo de teto alto (`qwen3.5:2b`) e baixo (`qwen2.5-coder:3b`).
- Olhar o popover renderizado — 7 botões quebrando linha, tema claro e escuro.
- Modelo Gemini selecionado — switch "Raciocínio visível" desligado/indisponível, `TH` do `CapabilityChip` sem regressão.

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 1 (03/09/2026) | Pesquisa Context7 + WebFetch fechou a causa do D21A.10 (Gemini) e confirmou a Interactions API como caminho real. Revisão do advisor corrigiu o caso de `ceiling` pequeno e o `flex-wrap`. Implementação completa nesta mesma sessão: `CONTEXT_BANDS`/`exposesReasoning` em `core/`, `SegmentedField` promovido de `Settings.tsx`, `ContextControl.tsx` reescrito (faixas + campo numérico), `Slider` removido, `AttachButton.tsx` migrado para `exposesReasoning`. Quatro testes existentes precisaram de ajuste (queriam um `<input>` que não existe mais — viraram `getByRole('group', { name: 'Contexto', hidden: true })`, `hidden: true` necessário porque conteúdo de `Popover` computa `display:none` sob jsdom); testes novos em `models.test.ts`, `contextBudget.test.tsx` (clique em faixa). `docs/ROADMAP.md`/`reference/reasoning/README.md`/skill `design-system` atualizados com o achado da Interactions API e a troca de primitivo. Segunda revisão do advisor achou dois defeitos reais além dos três da 21-C-A/B: `SegmentedField` não tinha `disabled` (os sete botões de faixa ficavam sempre clicáveis, mesmo com o controle desabilitado — corrigido, prop nova); e `Composer.tsx` ainda tinha um segundo gate de raciocínio (`hasThinking` no re-check de envio) usando `hasCapability` puro em vez de `exposesReasoning`, divergindo do gate do `AttachButton` — corrigido, os dois concordam agora. O teste de clique em faixa original também não provava a garantia real do F2.5 (nome dizia "não arredonda" mas nada testava arredondamento) — nasceu `ContextControl.test.tsx`, isolado do resto do app, com o caso que de fato prova a garantia: um valor herdado fora das faixas (12288) não acende nenhum botão. `pnpm check:fast` verde (1335/1335). **Verificação ao vivo pendente** — fica com o usuário. |
| 2 (03/09/2026) | **Verificação ao vivo confirmada pelo usuário.** A verificação já havia sido feita ao vivo pelo usuário e validada pelo Claude Code na sessão original do arco 21-C — o diário acima nunca foi atualizado para refletir isso, achado corrigido durante a auditoria da R-6. Plano concluído. |
