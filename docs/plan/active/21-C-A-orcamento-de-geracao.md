# Plano 21-C-A — orçamento de geração reservado + suavização da calibração

> Primeiro de três planos do arco 21-C (`21-C-A`, `21-C-B`, `21-C-C`) — nasceram juntos porque compartilham motivação (o que o 21-B deixou de fora), não porque compartilham código. Ver [`21-A`](../implemented/21-A-o-raciocinio-atravessa.md) e [`21-B`](../implemented/21-B-o-raciocinio-aparece-bem.md) para o resto do arco.

## Contexto

`core/ai/budget.ts:budgetFor()` reserva zero espaço para o que o modelo vai *gerar* — soma só `historyChars + draftChars`, o lado do prompt. O Ollama trata `num_ctx` como janela **total** compartilhada entre prompt e geração; um envio que passa no gate hoje pode estourar no meio da geração assim que o raciocínio está ligado. Evidência real coletada nesta sessão: `qwen3.5:2b` descrevendo uma imagem gastou vários parágrafos de raciocínio contra um parágrafo de resposta final — proporção invertida do que o app assume.

`calibrateRatio()` também recalibra com **uma amostra só** por turno (`lastPrompt`, sobrescrita a cada envio), nunca uma média — precisão, não o bug de "zera a cada turno" que uma sessão anterior já descartou (a soma de `historyChars` está correta, provada por teste existente).

Revisado pelo advisor (Opus) antes da implementação — duas correções que a primeira leitura não tinha: (1) o timing da suavização precisa avançar por **turno assentado**, não por render — um streaming re-renderiza por chunk, e alimentar o "valor anterior" de dentro do render evapora a suavização antes do turno terminar; (2) a reserva de geração só faz sentido onde `num_ctx` é uma janela local de verdade compartilhada com a geração (`costed`) — para nuvem, `num_ctx` é bookkeeping client-side que nunca chega ao request body, e `reasoningActive` (o toggle) é uma pergunta diferente de `exposesReasoning` (se o app consegue mostrar o resultado, ver 21-C-C) — não confundir as duas.

## Decisões

- **D21C.1 — headroom de geração como fração do limite.** `REASONING_OUTPUT_RESERVE_RATIO = 0.35`, ponto de partida (mesmo espírito do `MARK_REDUCTION` do 21-B) — ajustar depois de teste ao vivo.
- **D21C.2 — a reserva só se aplica quando `costed && reasoningActive`.** `costed` já existe em `ConversationView.tsx` (linha 111); `reasoningActive` é `hasCapability(model,'thinking') && wantsReasoning`, **não** `exposesReasoning` — Gemini já sai da reserva pelo `costed` falso, não por essa flag.
- **D21C.3 — a média móvel avança uma vez por turno assentado**, guardada como state em `useConversationChat.ts`, não recalculada a cada render em `ConversationView.tsx`.

## Passos

1. `core/ai/budget.ts`: `REASONING_OUTPUT_RESERVE_RATIO`; `budgetFor` ganha `costed?: boolean` (default `true`) e `reasoningActive?: boolean` (default `false`) — `reserve = costed && reasoningActive ? Math.floor(limit * REASONING_OUTPUT_RESERVE_RATIO) : 0`; `allowed = Math.max(0, Math.floor(limit * GATE_MARGIN) - reserve)`.
2. `Composer.tsx`: prop nova `costed: boolean`; `reasoningActive` computado localmente (`model`/`wantsReasoning` já convivem ali); os dois entram na chamada de `budgetFor` já existente.
3. `ConversationView.tsx`: passa `costed` (já calculado na linha 111) para `Composer`.
4. `core/ai/budget.ts`: `calibrateRatio` ganha terceiro parâmetro `previousRatio?: number` — EMA `previousRatio * 0.6 + sample * 0.4` quando existe, amostra pura quando não.
5. `useConversationChat.ts`: novo state `charsPerToken` (init `DEFAULT_CHARS_PER_TOKEN`), atualizado no mesmo bloco que já grava `lastPrompt` (linha 164) via `setCharsPerToken((previous) => calibrateRatio(sentChars, result.value.promptTokens, previous))`. Hook devolve `charsPerToken` no lugar de `lastPrompt` (sem outro consumidor, grep confirmado).
6. `ConversationView.tsx`: remove o cálculo por render (linha 151); desestruturação do hook troca `lastPrompt` por `charsPerToken`.

## Testes

- Nível 1 (`budget.test.ts`): reserva só com `costed && reasoningActive`; `limit` pequeno o bastante zera `allowed` sem ficar negativo; EMA com sequência de duas chamadas, valor esperado calculado à mão.
- Nível 2 (`contextBudget.test.tsx`, teste "counts the reply too, and calibrates on what was actually SENT"): estendido com um segundo turno, provando mistura, não substituição.

## Verificação ao vivo (fica com o usuário)

- Provar a reserva vermelha uma vez: `REASONING_OUTPUT_RESERVE_RATIO` bem alto num teste manual, confirmar recusa que não existiria sem o headroom.
- Raciocínio ligado com `qwen3.5:2b`, janela pequena — comparar recusa do gate antes/depois.
- Modelo cloud (`costed: false`) — confirmar que o gate não muda de comportamento.

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 1 (03/09/2026) | Sondagem inicial do arco 21-C (três frentes), revisão do advisor (Opus) split o plano em três arquivos e corrigiu o timing da EMA e o gate por `costed`. Implementação desta frente nesta mesma sessão. |
