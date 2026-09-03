# Plano 21-D-B — assinatura do raciocínio: persistência, reenvio e orçamento

> Segundo de dois planos que promovem o gatilho parado no [`ROADMAP § 121`](../../ROADMAP.md). Depende do [`21-D-A`](21-D-A-interactions-api-o-parser-novo.md) (endpoint e parser novos) já fechado — este plano assume que `gemini.ts` já fala com a Interactions API e já extrai `reasoning`/`signature` de um `thought` step.

## Contexto

A Interactions API, em modo stateless (`store: false`), exige reenviar cada `thought` block **exatamente como recebido**, com a `signature` intacta — o oposto do que o app faz hoje: `partForProvider` devolve `''` para `reasoning` (D21A.3), porque a resposta final já captura o que importa e reenviar só inflaria `historyChars`. Essa decisão foi certa para Ollama/GLM (raciocínio solto, sem assinatura, sem custo de continuidade) e passa a estar **errada** especificamente para uma conversa Gemini pós-migração: sem reenviar a assinatura, o modelo perde a continuidade do próprio raciocínio entre turnos.

**O que fica com o texto sem assinatura:** toda mensagem de raciocínio persistida antes deste plano (Ollama, GLM, e o próprio Gemini nos poucos turnos em que já respondeu algo pelo endpoint antigo) não tem `signature` nenhuma — nunca teve de onde vir. Fabricar uma seria inventar dado; a saída é **não fabricar**: uma `reasoning` sem assinatura continua devolvendo `''` (comportamento de hoje, inalterado); só uma `reasoning` que carrega `signature` (produzida a partir daqui, só pelo Gemini via 21-D-A) é resend como `thought` step. O critério é a presença do campo, não o provedor — `core/` não precisa saber que é Gemini (D9.2 continua de pé).

**Onde o reenvio realmente mora — refinado depois da segunda rodada de pesquisa.** O 21-D-A confirmou com exemplo verbatim que o `input` de um turno em modo stateless, do lado de Google, é **uma lista plana de steps concatenada**: `[user_input do turno 1] + [todos os steps da resposta do turno 1] + [novo user_input]` — um objeto por **step**, não por mensagem. Isso é o formato de fio da Interactions API, não a fronteira `ChatFn` deste app: persistir e reenviar o `steps[]` bruto do Google vazaria o formato de um provedor específico para `shared/ipc.ts`, o mesmo erro que a fronteira `ChatFn` existe para evitar (D9.2). A fronteira genérica continua sendo `ChatMessage[]`, um objeto por mensagem — o precedente de `images` (D17.5, um campo a mais fora de `content`, que só quem sabe usá-lo lê) se aplica igual para `reasoningSignature`. É só **dentro** de `gemini.ts` que cada `ChatMessage` deixa de virar um `{role, parts}` e passa a virar um ou mais steps da lista plana que a API espera — a tradução para o formato de fio específico é responsabilidade do adaptador, como já é hoje para `role: 'model'` vs. `'assistant'`.

## Decisões

- **D21D.6 — `reasoningPartSchema` ganha `signature: z.string().optional()`.** JSON dentro de `parts`, sem tocar `migrations.ts` — mesmo raciocínio já registrado em `reference/reasoning/README.md` § *A pergunta que dimensiona o arco inteiro*. Ausente para todo dado já persistido (Ollama/GLM/Gemini pré-migração); presente só em `reasoning` produzido pelo Gemini via 21-D-A daqui em diante. **Não toca o portão de validação do IPC:** `argsSchema['ai:chat']` valida `messageSchema[]` (o que o renderer manda, D17.5) — `chatMessageSchema`/`ChatMessage` só existem depois da materialização no main, nunca chegam a um `.parse()` de payload de renderer. `reasoningSignature` (D21D.8, abaixo) segue a mesma regra.
- **D21D.7 — `partForProvider`/`toChatMessagesWithImages` (o caminho comum aos três provedores) não mudam.** Continuam devolvendo `''` para `reasoning` e montando `ChatMessage[]` como hoje — essa fronteira genérica nunca soube de `thought` step e não precisa saber. Mudar `core/ai/messages.ts` para decidir por provedor violaria D9.2.
- **D21D.8 — `ChatMessage` ganha `reasoningSignature?: { text: string; signature: string }` opcional, mesmo precedente de `images` (D17.5).** `ChatFn` continua recebendo `ChatMessage[]` — a fronteira não muda para os três provedores (D9.2, D21D.2). `toChatMessagesWithImages` (`core/ai/messages.ts`) popula o campo a partir da última `ReasoningPart` **com** `signature` de cada mensagem; ausente quando a `ReasoningPart` não tem assinatura (todo dado pré-migração, e todo o de Ollama/GLM) — não fabrica uma. Ollama/GLM ignoram o campo, como já ignoram `images` fora de `vision`.
- **D21D.8.1 — quem monta a lista plana de `steps[]` é só `gemini.ts`, lendo `reasoningSignature` de cada `ChatMessage`.** A fronteira genérica (`ChatMessage[]`, um objeto por mensagem) não muda; o que muda é que **dentro** do adaptador Gemini, cada mensagem deixa de virar um objeto `{role, parts}` e passa a virar um ou dois steps (`user_input`/`model_output`, mais um `thought` step extra quando `reasoningSignature` está presente) — é onde o achado do 21-D-A (`input` = concatenação plana de steps) se resolve, sem exigir que `core/ai/messages.ts` conheça a forma de step nenhuma.
- **D21D.9 — o reenvio de `signature` entra no orçamento (`core/ai/budget.ts`).** O termo de `historyChars` passa a contar o texto do `summary` reenviado como parte da história, do mesmo jeito que hoje conta `stepProposal` — não como termo novo separado, como extensão do que `calibrateRatio`/`budgetFor` já somam. Cruza com `21-C-A` (headroom de geração): não reabre a fórmula, soma ao dado que ela já processa.
- **D21D.10 — `exposesReasoning()` para de excluir Gemini.** Agora que existe um caminho de resend real, o switch "Raciocínio visível" liga para os dois modelos do catálogo. `hasCapability(model, 'thinking')` sozinho volta a ser o critério — a exceção de D21C.10 é revertida, com a sigla citada no comentário do código para quem for entender por que ela existiu.
- **D21D.11 — `useConversationChat.ts` fica fora deste plano.** O gatilho registrado no `ROADMAP` ("se a próxima extensão crescer mais") é sobre o hook do renderer; este plano toca `core/ai/`, `shared/ipc.ts` e `main/features/ai/providers/gemini.ts` — camada diferente, variável diferente. Separar o hook, se ainda fizer sentido depois deste plano, é sessão própria (princípio "uma variável por vez").

## Passos

1. `shared/ipc.ts`: `signature` opcional em `reasoningPartSchema`.
2. `core/ai/messages.ts`: `reasoningSignature` opcional em `ChatMessage`; `toChatMessagesWithImages` popula a partir da última `ReasoningPart` com `signature`.
3. `main/features/ai/providers/gemini.ts`: a montagem de `input` (sucessora de `toGeminiContents`, já reescrita no 21-D-A para produzir a lista plana de steps) passa a ler `reasoningSignature` de cada `ChatMessage` e inserir um `thought` step reconstruído junto do step daquela mensagem; ausência do campo não gera step nenhum (turno sem raciocínio anterior, ou raciocínio sem assinatura).
4. `core/ai/budget.ts`: o texto reenviado do `thought` step soma a `historyChars` do mesmo jeito que `stepProposal` já soma hoje.
5. `core/ai/models.ts`: `exposesReasoning()` volta a ser só `hasCapability(model, 'thinking')`; comentário cita D21C.10/D21D.10.
6. Testes de nível 1 para os quatro pontos acima; `docs/reference/reasoning/README.md`/`ROADMAP.md § 121` fecham a entrada, movendo a decisão de "fora de escopo" para "implementado".

## Testes

- Nível 1 (`messages.test.ts`): `reasoningSignature` populado só quando a última `ReasoningPart` da mensagem tem `signature`; ausente quando não tem (Ollama/GLM/Gemini legado).
- Nível 1 (`gemini.test.ts`): a montagem de `input` reconstrói o `thought` step certo a partir de `reasoningSignature`, na posição certa da lista plana; mensagem sem o campo não produz step de raciocínio.
- Nível 1 (`budget.test.ts`): `historyChars` cresce com o texto do `summary` reenviado, mesma forma de teste já usada para `stepProposal`.
- Nível 1 (`models.test.ts`): `exposesReasoning` volta a ser verdadeiro para Gemini com `thinking`.

## Verificação ao vivo (fica com o usuário)

- Uma conversa Gemini de dois turnos com raciocínio ligado: confirmar que o segundo turno reenvia a assinatura do primeiro (sem erro de "invalid signature" do lado da API) e que o raciocínio mostrado faz sentido como continuação, não como reinício.
- Uma conversa antiga (raciocínio persistido antes deste plano, sem `signature`) reaberta e continuada: confirmar que não quebra — o raciocínio antigo simplesmente não é reenviado, como sempre foi.
- O medidor de tokens (Composer) refletindo o custo do reenvio de `summary` numa conversa longa com raciocínio ligado.

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 1 | Nasce o arquivo, junto do `21-D-A`. Primeira versão do D21D.8 propunha `gemini.ts` recebendo `Message`/`MessagePart` direto, contornando `ChatFn` — corrigido depois de checar `core/ai/types.ts`: a fronteira é `ChatMessage[]` para os três provedores (D9.2), sem exceção. Desenho final: `ChatMessage.reasoningSignature` opcional (mesmo precedente de `images`, D17.5), lido só dentro de `gemini.ts` para montar a lista plana de steps que o 21-D-A já vai ter introduzido. Implementação não começou — depende do `21-D-A` fechar primeiro. |
