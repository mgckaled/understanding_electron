# Plano 21-D-A — Interactions API do Gemini: endpoint e parser novos

> Primeiro de dois planos que promovem o gatilho parado no [`ROADMAP § 121`](../../ROADMAP.md) — "alguém precisar do raciocínio visível do Gemini de verdade". Decisão do usuário: promover agora, em vez de deixar o gatilho aberto sem número, com um requisito adicional — o parser não pode quebrar em silêncio se o contrato mudar de novo. Segundo plano: [`21-D-B`](21-D-B-signature-resend-e-orcamento.md), que só nasce depois deste fechar.

## Contexto

`gemini.ts` usa `streamGenerateContent` (`/v1beta/models/{model}:streamGenerateContent?alt=sse`), que não tem bloco de pensamento dedicado — causa fechada em 21-C-C. A Interactions API expõe raciocínio real (`steps[]`, tipo `thought`, com `summary`/`signature`), mas é **um endpoint diferente com forma de resposta diferente**, não um parâmetro a mais no endpoint atual.

Confirmado nesta sessão contra a documentação viva (Context7 `/googleapis/python-genai` + `ai.google.dev`, não só o que `reference/reasoning/README.md` já registrava):

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/interactions` — **não** `/v1beta/models/{model}:...`.
- Corpo em `snake_case` (`generation_config`, `thinking_summaries`, `system_instruction`, `previous_interaction_id`, `store`), diferente do `camelCase` que `gemini.ts` usa hoje (`generationConfig`, `thinkingConfig`) — a REST antiga e a nova não compartilham convenção de nome de campo.
- `generation_config.thinking_summaries: "auto" | "none"` substitui `thinkingConfig.includeThoughts`; **`thinking_level` continua existindo ao lado**, como campo separado — os dois controlam coisas diferentes (nível de esforço vs. se o resumo volta), o parser precisa decidir o que cada um faz, não fundir os dois numa flag só.
- Resposta: `steps[]`. Um `thought` step tem `type: 'thought'` (obrigatório), `signature` (obrigatório) e `summary` (array de conteúdo, opcional — pode vir vazio) — confirmado com JSON verbatim da própria documentação (`event: step.start`, `data: {"index":0,"step":{"signature":"","summary":[{"text":"...","type":"text"}],"type":"thought"}}`). Um `model_output` step carrega o texto de resposta em `content[]`.
- ⚠️ **A `signature` chega vazia no `step.start` e só se preenche depois**, ao longo dos eventos `step.delta` daquele step (discriminados por `thought_summary`/`thought_signature`) — o parser não pode persistir a assinatura no início do step, só quando ele fecha. É uma restrição de ordem real para a persistência do 21-D-B, não um detalhe cosmético.
- Streaming: ciclo de vida por step — `interaction.created` → `step.start` (anuncia o step, campos ainda incompletos) → `step.delta` (incremento, tipo do delta em `thought_summary`/`thought_signature`/texto comum) → fechamento do step. Estrutura mais rica que o streaming linha-a-linha dos outros três provedores — não é um ajuste do parser atual, é um parser novo.
- `input` para o próximo turno, em modo stateless (`store: false`), é literalmente a concatenação plana: `[user_input do turno 1] + [todos os steps da resposta do turno 1] + [novo user_input]` — confirmado com exemplo verbatim da documentação (`jq` concatenando `first_input + model_steps + second_input`). Não é um objeto `{role, content}` por mensagem como hoje — é uma lista de steps typed, e o `signature` de um `thought` step anterior viaja dentro dela, reenviado junto. Isso é o assunto do 21-D-B (como este app, que não persiste o `steps[]` bruto do Google, reconstrói essa lista a partir do próprio `MessagePart`), não deste plano.
- Status geral do turno: `status` no nível da interação tem os valores `in_progress`/`requires_action`/`completed`/`failed`/`cancelled`/`incomplete`/`budget_exceeded`/`queued`. **Dois candidatos a `'context-exhausted'`, não confirmados ainda:** `incomplete` ("completed, but contains incomplete results, e.g. hitting max_tokens" — o mais provável) e `budget_exceeded` (parece ser outra condição, possivelmente de cota/orçamento de execução, não de janela). Não colapsar os dois na mesma label sem confirmar — é sondagem do passo 1, não suposição.

**Status da API:** GA — a própria página de migração afirma "As of June 2026, it is Generally Available and recommended for all new projects", e a janela de breaking changes citada (maio/2026) já passou. A guarda de contrato abaixo não existe porque a API é instável hoje; existe porque o contrato **já mudou de forma uma vez** recentemente (`outputs` → `steps`) e pode mudar de novo — é precaução de manutenção, não desconfiança do status atual.

**Requisito do usuário para este plano:** o app não pode falhar em silêncio se o formato de resposta mudar nem mais uma vez. Um evento inesperado (step de tipo desconhecido, `thought` sem `signature` no fechamento, resposta sem `steps` nenhum) precisa produzir um aviso **específico** — não um erro genérico de parse — visível no terminal (log) e no chat (a mensagem de erro que já chega à interface hoje via `AppError.upstream`), nomeando que é a forma da Interactions API que pode ter mudado.

**O que não é resolvido aqui, de propósito:** qual dos dois status (`incomplete` vs. `budget_exceeded`) mapeia para `context-exhausted`, e como uma imagem anexada se comporta dentro desse `input` concatenado num turno real (o formato de `content` de imagem — `type`/`data`/`mime_type`/`uri` — já está confirmado pela doc, falta confirmar ao vivo). Passo 1 deste plano é essa sondagem, não suposição.

## Decisões

- **D21D.1 — Sondar `incomplete` vs. `budget_exceeded` antes de codificar o motivo de parada.** Mesma disciplina da skill `ai` (não presumir comportamento de campo nativo sem sondar contra o provedor real): passo 1 é uma chamada real forçando janela pequena e confirmar qual dos dois valores aparece, antes de decidir o mapeamento para `'context-exhausted'`.
- **D21D.2 — O provedor muda de endpoint, a fronteira `ChatFn` não.** `makeGeminiChat` continua devolvendo `ChatReply`; o que muda é inteiramente interno ao adaptador (`main/features/ai/providers/gemini.ts`). `core/ai/types.ts` não é tocado neste plano.
- **D21D.3 — Guarda de contrato é `UpstreamError` com mensagem nomeada, não uma exceção genérica.** Um shape inesperado loga `[gemini] unexpected Interactions API shape: <detalhe>` (mesmo padrão do `console.error('[gemini] HTTP...')` já existente) e lança `UpstreamError` com mensagem que cita "formato de resposta inesperado — o contrato da Interactions API pode ter mudado" — que já chega ao chat pelo caminho existente (`AppError.upstream` → `errorMessage()`, skill `design-system`). Nenhum primitivo de UI novo (o app não tem `Toast` ainda, F-5 planejado e adiado) — reaproveita o caminho de erro que toda chamada de IA já usa.
- **D21D.4.1 — `opts.format` (usado por `ai:propose`, D19.3) continua ignorado pelo Gemini, sem mudança de comportamento.** O código atual de `gemini.ts` já não lê `format` — uma lacuna pré-existente, não introduzida por este plano (uma proposta contra Gemini hoje já depende do modelo devolver JSON solto, sem decodificação restrita, e `runStructuredChat`/`proposal.ts` já tratam isso como `invalidProposal` possível, nunca crash). O parser novo **preserva** esse comportamento — não tenta wire up `response_format` da Interactions API neste plano. Se `ai:propose` contra Gemini virar prioridade, é escopo próprio: mesma lição do O-8 (`ai:propose` foi esquecido uma vez por raciocínio que não se transferia do caminho de streaming).
- **D21D.4 — `exposesReasoning()` não muda neste plano.** Ele volta a permitir Gemini só no 21-D-B, depois que o resto da cadeia (persistência de `signature`, resend) existir — ligar o switch antes disso prometeria um resumo que o `ReasoningDisclosure` (21-B) ainda não teria de onde vir de forma persistida corretamente.
- **D21D.5 — Teste de contrato provado vermelho antes de verde.** A guarda do D21D.3 só conta como testada se a sabotagem (fixture com step de tipo desconhecido, ou `thought` sem `signature`) falhar sem ela e passar com ela — mesmo procedimento da skill `testing` § *Um teste que passa com o defeito presente não estava provando nada*.

## Passos

1. Sondar ao vivo: forçar janela pequena e confirmar se `incomplete` ou `budget_exceeded` é o status que aparece; forçar um anexo de imagem real e confirmar o `content` de imagem dentro de `input`. Registrar os dois achados no `docs/reference/reasoning/README.md` antes de codificar o resto.
2. `gemini.ts`: endpoint novo (`/v1beta/interactions`), corpo em `snake_case`, `generation_config.thinking_summaries`, `store: false`.
3. Parser do ciclo `interaction.created`/`step.start`/`step.delta`: monta `steps[]` incrementalmente, só considera a `signature` de um `thought` step definitiva no fechamento (nunca no `step.start`, onde chega vazia), extrai `content`/`reasoning`/motivo de parada conforme o achado do passo 1.
4. Guarda de contrato (D21D.3): shape inesperado → log nomeado + `UpstreamError` específica, nunca exceção não tratada nem silêncio.
5. `gemini.test.ts`: reescrito contra fixtures do novo formato de fio; teste da guarda sabotado antes de corrigido (D21D.5).
6. `docs/reference/reasoning/README.md` e `ROADMAP.md § 121`: endpoint/campo atualizados para o que foi de fato implementado, substituindo o desenho especulativo.

## Testes

- Nível 1/3 (`gemini.test.ts`, fixtures SSE do novo ciclo `step.start`/`step.delta`): `content`/`reasoning` extraídos corretamente; motivo de parada mapeado para o status confirmado no passo 1; um `thought` step com `signature` vazia no `step.start` só é tratado como definitivo depois do fechamento.
- Guarda de contrato: fixture com step de tipo desconhecido e fixture com `thought` fechado sem `signature` preenchida — cada uma produz a mensagem nomeada do D21D.3, não um erro genérico nem um crash silencioso.

## Verificação ao vivo (fica com o usuário)

- Uma chamada real ao Gemini (`gemini-3.5-flash-lite` ou `gemini-3.7-flash`) com raciocínio ligado — confirmar que `reasoning` chega de verdade pela primeira vez nesta conta (ao contrário do endpoint antigo, D21A.10).
- Uma chamada com anexo de imagem, para confirmar que o `content` de imagem sondado no passo 1 realmente carrega imagem sem regressão.

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 1 | Nasce o arquivo. Primeira rodada de pesquisa (Context7 + WebFetch) confirmou endpoint, `snake_case`, e achou a reestruturação de maio/2026 — motivo do requisito de guarda de contrato pedido pelo usuário. Segunda rodada, pedida explicitamente pelo usuário antes de submeter ao advisor: JSON verbatim do `thought` step (`signature` vazia no `step.start`, preenchida depois), ciclo `interaction.created`/`step.start`/`step.delta`, confirmação de que `input` multi-turno é a concatenação plana `user_input + steps anteriores + novo user_input` (não um objeto por mensagem), e os dois candidatos a motivo de parada (`incomplete`/`budget_exceeded`, nenhum confirmado ao vivo ainda). O advisor pegou uma leitura errada de uma página de referência secundária (que parecia negar `thought` como step próprio) contra o JSON verbatim de uma página mais específica — resolvido a favor do verbatim, retirado do plano. Implementação ainda não começou. |
