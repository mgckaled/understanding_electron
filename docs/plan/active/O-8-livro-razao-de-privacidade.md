# O-8 — Livro-razão de privacidade: o que saiu da máquina, por chamada de nuvem

> Oitavo plano da trilha **O** (observatório) — gatilhada, não sequencial. Fundamentação, os seis eixos, o inventário classificado e o desenho fechado desta entrega (§ 9.3): [`reference/observatory/`](../../reference/observatory/README.md).

## Contexto

O-7 decompôs desempenho por `(service, model)`. O-8 é o par que o O-6 já reservava desde que "Desempenho e Privacidade ficam para planos próprios, mesmo repartindo o arquivo" — o segundo painel de série temporal sobre `observatory.db`, e o único dos dois que responde a uma pergunta de auditoria, não de tendência: **o que saiu da máquina, e para onde.**

O gatilho: `isCloudService()` já existe (`core/ai/messages.ts`, N-1-B) e o app já tem provedores de nuvem reais (GLM, Gemini) desde a trilha N. O que falta é só o registro.

## Sondagem — o que a leitura encontrou

- `chat()` (`src/main/features/ai/handlers.ts`) já recebe uma dependência opcional injetada (`recordPerformance`) no mesmo ponto em que este plano precisa entrar — nenhum ponto de instrumentação novo, mesma decisão que o § 9.4 do `reference/observatory/` já registrou.
- `attachmentPartOf`/`attachmentPartsOf` (`core/ai/messages.ts`) já respondem "qual o anexo desta mensagem" — no máximo um por mensagem, dos três tipos possíveis (`dataset`/`document`/`image`). Contar por chamada é agrupar isso por `kind`, não escrever um scanner novo.
- `messages: Message[]` chega ao handler como o **transcrito inteiro** re-enviado a cada turno (provedor sem estado) — um anexo colado três turnos atrás continua saindo em todo turno seguinte, porque a mensagem que o carrega ainda está no array. Contar sobre `messages` a cada chamada é, portanto, honesto ao que de fato atravessa a rede naquele turno, não uma aproximação.
- O aviso do § 9.3 sobre `contentOf`/`partForProvider` tratarem imagem como `''` **não afeta este plano**: a contagem lê `part.kind` direto de `messages`, nunca `contentOf`/`partForProvider` — não há bytes a somar aqui, só tipo e contagem.

## Decisões

### DO8.1 — O proxy do nível é o tipo do anexo, decisão herdada, não reaberta

Confirma o que o § 9.3 já fechou: sem seletor de nível por anexo em nenhum lugar do renderer, o tipo (`dataset`/`document`/`image`) já é o proxy do que saiu — schema para dataset, conteúdo inteiro para documento e imagem. Quando um seletor de nível nascer como feature própria, o painel ganha uma coluna a mais sem mudar o mecanismo de captura.

### DO8.2 — Só chamada de nuvem grava linha; local não produz nada

`isCloudService(service)` decide. Uma chamada ao Ollama não tem o que auditar aqui — nada saiu da máquina —, e não gravar nada é o dado certo, não uma omissão.

### DO8.3 — Grava no ENVIO da requisição, não na resolução da resposta (ao contrário do O-7)

O-7 só grava quando `evalTokens` chega — porque a métrica (tokens/s) só existe depois da resposta. Aqui a métrica (quais tipos de anexo, quantos) já é conhecida **antes** de chamar o provedor: os bytes saem no corpo da requisição, e um timeout ou cancelamento não desfaz o que a rede já transmitiu. Gravar condicionado ao sucesso mentiria por omissão num caso exatamente oposto ao que o livro-razão existe para cobrir (chamada de nuvem que falhou depois de já ter saído).

### DO8.4 — Contagem por tipo, nunca o hash do anexo

A linha grava `datasetCount`/`documentCount`/`imageCount` (inteiros), nunca o hash de qual arquivo saiu. Um livro-razão de privacidade que guardasse o hash reteria, ele mesmo, um ponteiro para o dado sensível que está auditando — a pergunta que ele responde é "que classe de coisa saiu, quantas vezes", não "qual arquivo".

### DO8.5 — Toda chamada de nuvem grava, mesmo sem anexo (contagem zero é dado, não lacuna)

Diferente da regra do O-7 (nunca fabricar zero), aqui zero é uma medida completa e sempre disponível — a contagem de anexos numa chamada é conhecida no mesmo instante em que a chamada é montada, sucesso ou não. Uma linha com as três contagens em zero documenta "chamada de nuvem só-texto", que é o caso majoritário e também informação de auditoria: quantas chamadas de nuvem aconteceram, das quais quantas levaram anexo.

### DO8.6 — Tabela própria (`privacy_events`), mesmo arquivo, retenção herdada de `eventRetentionDays`

Mesma razão do O-7 (DO7.3/DO7.6): dado de forma diferente de `events`/`performance_events` merece tabela própria, mas a política de idade é a mesma configurável já em uso — reabrir essa escolha sem motivo novo seria a mesma dívida que o O-6 already recusou pagar duas vezes.

### DO8.7 — `privacy:list` devolve linhas cruas, não um resumo agregado (diferente do O-7)

`performance:list` agrega no main porque a pergunta é "qual a taxa típica deste modelo" — uma média faz sentido. A pergunta de um livro-razão é "o que saiu, quando, para qual serviço" — cada chamada é o próprio dado, agregar destruiria exatamente o que a auditoria precisa (a linha individual). `privacy:list` segue o padrão de `events:list`: `LIMIT 200`, mais recente primeiro, filtrado por `retentionDays` na leitura.

### DO8.8 — `LIMIT 200` por si só não sustenta a DO8.5; o canal devolve linhas + contadores da janela inteira

Achado do advisor: a maioria das chamadas de nuvem é só-texto (DO8.5), então uma janela de 200 mais recentes fica dominada por linhas de contagem zero — exatamente as linhas com anexo, que são o motivo do painel existir, podem sair da janela visível sem sair da retenção. `privacy:list` passa a devolver `{ rows, totalCalls, callsWithAttachment }`: `rows` continua `LIMIT 200` (DO8.7), e os dois contadores somam sobre a retenção inteira via `COUNT`/`SUM` no SQLite, não sobre as 200 linhas devolvidas. O painel mostra os contadores como cabeçalho, no mesmo lugar em que `EventsPanel` mostra "últimos N dias" — sem os contadores, a DO8.5 grava um dado que a UI não consegue honrar.

## Passos

### 1. Schema (`src/main/observatory/db/migrations.ts`)

`v4`: `CREATE TABLE privacy_events (id, service, model, dataset_count, document_count, image_count, created_at)` + índice por `created_at`. Nova migração, não edição de `v2`/`v3` — mesma regra do D14.2 que o comentário de `v3` já cita.

### 2. Contagem pura (`src/core/observatory/privacy.ts`, novo)

`PrivacyEvent` (`service`, `model`, `datasetCount`, `documentCount`, `imageCount`) e `countAttachments(messages: Message[])`. **Não** roteia por `attachmentPartOf` — essa função é `.find`, uma parte por mensagem, escrita para "qual card esta bolha desenha"; `messageSchema` não proíbe duas partes de anexo na mesma mensagem, e um livro-razão que sub-contasse por herdar a semântica errada de outra função seria pior que um que escrevesse a própria varredura. `countAttachments` itera `message.parts` de todas as mensagens e soma por `kind` diretamente.

### 3. Gravação e leitura (`src/main/observatory/privacy.ts`, novo)

`recordPrivacyEvent(db, event)` e `readPrivacyLedger(db, retentionDays, now?)` — a segunda devolve `{ rows, totalCalls, callsWithAttachment }` (DO8.8): `rows` no molde de `main/observatory/performance.ts` com `LIMIT 200` herdado de `events.ts` (DO8.7); os dois contadores somam com `COUNT`/`SUM` sobre a retenção inteira, consulta própria, não derivada de `rows`.

### 4. `chat()` ganha a sexta dependência (`src/main/features/ai/handlers.ts`)

`recordPrivacy?: (event: PrivacyEvent) => void`, chamado com `isCloudService(service)` e `countAttachments(messages)` **depois** de `toChatMessagesWithImages` resolver e **antes** de `measureChatTiming` (DO8.3 revisado pelo advisor): antes desse ponto, uma falha em `resolveImageBytes` (blob ausente) registraria um envio que nunca aconteceu; depois, os bytes já estão montados e a chamada ao provedor é a instrução seguinte — o ponto mais próximo e ainda honesto de "prestes a sair pela rede".

### 5. Retenção (`src/main/observatory/retention.ts`)

`sweepExpiredPrivacyEvents`, mesma forma de `sweepExpiredPerformanceEvents`.

### 6. Contrato IPC (`src/shared/ipc.ts`, `src/preload/index.ts`, `test/api-mock.ts`)

`PrivacyRow` (molde de `EventRow`) e `PrivacyLedger = { rows: PrivacyRow[]; totalCalls: number; callsWithAttachment: number }` (DO8.8), ambos cruzam o IPC. Canal `privacy:list`, sem `Result` (mesma razão de `events:list`/`performance:list`). `Api.privacy.list(): Promise<PrivacyLedger>`.

### 7. Registro (`src/main/ipc/register-all.ts`)

Import de `recordPrivacyEvent`/`readPrivacyLedger`/`sweepExpiredPrivacyEvents`; sexto argumento em `ai:chat`; `handle('privacy:list', () => readPrivacyLedger(observatoryDb, retentionDays))`; `'privacy:list'` entra em `OBSERVATORY_READ_CHANNELS`; sweep no boot ao lado do de performance.

### 8. Painel Privacidade (`src/renderer/src/features/observatory/PrivacyPanel.tsx`, `panels.ts`)

Terceiro habitante do grupo `activity`. Cabeçalho com `totalCalls`/`callsWithAttachment` da janela de retenção (DO8.8, molde da linha "últimos N dias" do `EventsPanel`); tabela por linha: Quando, Serviço/Modelo, e as três contagens **rotuladas como desta chamada** ("anexos nesta chamada"), nunca como total acumulado — o mesmo dataset resend por turno (Sondagem) faria uma coluna sem esse rótulo parecer uma mentira na tela.

### 9. Sincronização de documentação (auto-conservação, `CLAUDE.md`)

`.claude/skills/ipc/SKILL.md` — tabela de canais ganha a linha `privacy` e a contagem de **49** sobe para **50**, remedida contra o `IpcContract`, não copiada. `docs/ROADMAP.md` linha 55 — "O-8 **sem arquivo**" deixa de valer. `docs/plan/active/README.md` linha 59 — "Nenhum plano em `active/` no momento" deixa de valer.

## Verificação

- `core/observatory/privacy.test.ts` — `countAttachments` com mensagens de tipos mistos, mensagem sem anexo, transcrito com o mesmo anexo repetido em mais de uma mensagem.
- `main/observatory/privacy.test.ts` — round-trip `recordPrivacyEvent`/`readPrivacyLedger` contra `:memory:`, filtro de retenção, `totalCalls`/`callsWithAttachment` corretos mesmo quando `rows` é cortado pelo `LIMIT 200`.
- `main/observatory/retention.test.ts` — `sweepExpiredPrivacyEvents`, mesmo molde do de performance.
- `main/features/ai/handlers.test.ts` — `chat()` grava para `glm`/`gemini`, não grava para `ollama`, grava contagem zero numa chamada só-texto de nuvem. **O teste de ausência (`ollama` não grava) precisa ser visto vermelho antes de verde** (skill `testing`): remover o guard `isCloudService` durante o desenvolvimento e confirmar que o teste falha, senão um `recordPrivacy` nunca ligado passaria por omissão.
- `pnpm typecheck && pnpm lint && pnpm test` — o portão de sempre.
- Vivo: `pnpm dev`, anexar dataset + documento numa conversa com um provedor de nuvem, abrir o Observatório → Privacidade, confirmar a linha com as contagens certas; trocar para Ollama e confirmar que nenhuma linha nova aparece.

## Fora do escopo deste plano

- **Bytes enviados por chamada.** O § 9.3 registra o buraco (`partForProvider` devolve `''` para imagem, os bytes reais viajam por `ChatMessage.images`) e explicitamente não resolve — este plano também não: a métrica aqui é tipo+contagem, nunca tamanho.
- **Nível de exposição escolhido pelo usuário.** Depende de um seletor de nível por anexo que ainda não existe em nenhum lugar do renderer (§ 3.4 vs. § 9.3, já reconciliados na fundamentação) — feature própria, não este plano.
- **Provedor terceirizado (N-2).** `isCloudService` já cobre qualquer serviço que não seja `'ollama'`, então um provedor novo (Groq/Cerebras/SambaNova) entra na trilha N-2 sem tocar este plano.

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 01/09/2026 | Escopo definido e plano escrito (DO8.1–DO8.7) | Sessão de escopo — implementação segue no mesmo dia |
