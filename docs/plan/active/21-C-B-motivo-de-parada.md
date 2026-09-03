# Plano 21-C-B — motivo de parada por janela esgotada ("loop de pensamento")

> Segundo de três planos do arco 21-C. Ver [`21-C-A`](21-C-A-orcamento-de-geracao.md), [`21-A`](../implemented/21-A-o-raciocinio-atravessa.md) e [`21-B`](../implemented/21-B-o-raciocinio-aparece-bem.md).

## Contexto

"O loop de pensamento por janela de contexto limitada" — citado pelo usuário ao fechar o 21-B: se o raciocínio consumir a janela inteira antes de emitir qualquer resposta, o app não tem hoje como dizer "parou porque a janela encheu". Só existe `MessageStopped: 'cancelled' | 'timeout'`; os três adaptadores já parseiam um campo de motivo de parada (`done_reason`/`finish_reason`) e o descartam, fora de um caso pontual (`'unload'` em `ollama.ts`).

**Sondagem ao vivo feita antes de desenhar este plano** (pedida pelo advisor, que suspeitava de context shifting silencioso no llama.cpp): `curl` direto em `http://localhost:11434/api/chat`, `qwen3:4b`, `think: true`, `num_ctx: 256`, pedindo explicação longa. O modelo gerou bem mais do que 256 tokens comportariam (`prompt_eval_count: 42`, `eval_count: 2560`), mas a linha final chegou limpa:

```json
{"done":true,"done_reason":"length","prompt_eval_count":42,"eval_count":2560,...}
```

A hipótese de context shifting silencioso **não se confirmou** — `done_reason: "length"` chega de verdade. E `ollama.ts` nunca define `num_predict` (grep confirmado), então todo `'length'` que este app vier a ver só pode vir do `num_ctx` — não de um teto de resposta à parte.

## Decisões

- **D21C.4 — `messageStoppedSchema` ganha `'context-exhausted'`.** Sem migração: `stopped` já é coluna opcional (D14.3).
- **D21C.5 — os três adaptadores passam a ler o campo de parada que já parseiam.** `ollama.ts`: `done_reason === 'length'`. `glm.ts`: `finish_reason === 'length'`. `gemini.ts`: `candidates[0].finishReason === 'MAX_TOKENS'` (zero leitura hoje).

## Passos

1. `shared/ipc.ts`: `messageStoppedSchema = z.enum(['cancelled', 'timeout', 'context-exhausted'])`.
2. `core/ai/types.ts`/`ChatReply`: o motivo de parada sobe pela mesma via que `cancelled`/`timeout` já usam — terceiro valor no mesmo canal.
3. `ollama.ts`, `glm.ts`, `gemini.ts`: mapeiam o campo já parseado para `'context-exhausted'` quando o valor bate.
4. `useConversationChat.ts`: grava o valor recebido, sem lógica nova.
5. `MessageList.tsx`/`ConversationView.tsx`: terceira legenda ao lado de `cancelled`/`timeout` — "Parou: a janela de contexto encheu antes de terminar." (texto a calibrar ao vivo).

## Testes

Nível 3 (cada adaptador, `node`): fixture de resposta com o `done_reason`/`finish_reason` de esgotamento — mesmo padrão dos fixtures NDJSON/SSE de `glm.test.ts` — prova que o `stopped` certo sai do parser.

## Verificação ao vivo (fica com o usuário)

- Repetir a sondagem com `think: false` — confirmar que `'length'` chega mesmo sem raciocínio (volume total decide, não o raciocínio em si); a legenda não deve prometer "esgotou pensando" como única causa.
- Turno real dentro do app, janela pequena, raciocínio ligado — legenda nova aparece, texto parcial persistido como em `cancelled`/`timeout` hoje.

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 1 (03/09/2026) | Sondagem ao vivo contra Ollama real (`qwen3:4b`, `num_ctx:256`) confirmou `done_reason:'length'` — refutou a hipótese do advisor de context shifting silencioso. Implementação completa nesta mesma sessão: `messageStoppedSchema`/`ChatReply` em `shared/ipc.ts`, os três adaptadores (nenhum parseava o campo antes, ao contrário do que o plano original supunha), `useConversationChat.ts`, legenda em `MessageList.tsx`. Testes de nível 3 novos nos três adaptadores. `pnpm check:fast` verde (1330/1330). **Verificação ao vivo pendente** — fica com o usuário. |
