# 23-B — A fronteira do Context7

> ✅ **Entregue em 07/09/2026.** Segundo dos dez cortes do **arco 23** (documentação por REST). Material de entrada: [`reference/context7/`](../../reference/context7/README.md), em especial a § *A fronteira*, que é o anexo deste corte. **Nenhum subcorte:** se este plano crescer demais, ele vira dois irmãos no mesmo nível, nunca um `23-B-1`.

## Contexto

O [23-A](../implemented/23-A-cliente-context7.md) entregou o cliente puro em `src/core/context7/` — 35 testes, 98,6% de cobertura de linha, nenhuma rede na suíte. Ele existe e **ninguém o chama**: não há canal, não há handler, a chave não tem onde ser guardada.

Este corte é a ponte. Leva as duas funções do cliente até `window.api`, guarda a chave no cofre que já existe e deixa o campo em Configurações. **Nível 3, nada na conversa** — a parte persistida é do 23-C, o painel é do 23-D. Ao terminar, o renderer consegue consultar o Context7 e ainda não tem tela para isso.

Ele também fecha a **pergunta que o guia reservou explicitamente para cá**: `invoke` simples ou job cancelável.

## Sondagem — o que a leitura encontrou, incluindo o que contraria o guia

- ⚠️ **`mapProviderError` não serve aqui, ao contrário do que o guia afirma.** A assinatura é `(error, service: AiService)` e o corpo faz `HINTS[service]`, um `Record<AiService, string>` com dicas sobre Ollama e chaves de modelo (`src/main/features/ai/handlers.ts:172`). Forçar `'context7'` ali recoplaria exatamente o que DN1A.5 separou. O que de fato serve é o `AppError`, cujo campo é `service: string` — não `AiService`.
- ⚠️ **`src/preload/index.ts` está em exatamente 100 linhas**, o teto sem exceção do [`CLAUDE.md`](../../../CLAUDE.md#régua-de-tamanho). O bloco `docs` não cabe. **Nada no repositório importa esse arquivo** — a única referência é o caminho de build em `src/main/index.ts:34` —, então dividi-lo não propaga e custa o mesmo agora ou depois.
- ⚠️ **Os tipos normalizados do 23-A estão do lado errado da fronteira.** `LibraryCandidate`, `DocsResult`, `SearchOutcome` e `ContextOutcome` moram em `core/context7/types.ts`, e `src/shared/ipc.ts` **não pode importar de `core/`** — só de `zod`.
- **A chave custa uma palavra, e o `typecheck` cobra as outras quatro.** `'context7'` em `CLOUD_PROVIDERS` (`src/shared/ipc.ts:769`) obriga entrada em quatro `Record<CloudProvider, …>` exaustivos: `secrets/seed.ts`, `settings/CloudSecrets.tsx`, `observatory/CapabilitiesPanel.tsx` e `observatory/useCapabilities.ts`. Nenhuma divergência silenciosa é possível — mas **duas seções passam a dizer "nuvem" sobre algo que não é provedor de IA**.
- **O campo em Configurações vem quase de graça:** `CloudSecrets.tsx` já itera `CLOUD_PROVIDERS`; o trabalho é o rótulo e a cópia.
- **O molde da chave é o `glmAdapter`** (`register-all.ts:244`): `readSecretForUse('glm', db, decryptSecret)` numa closure, lida fresca a cada chamada.
- **`errorMessage` já devolve `error.message` para `upstream`** (`shared/ui/messages.ts:36`): o texto PT-BR do 429 montado pelo cliente chega intacto à tela, sem entrada nova em `messages.ts`.
- **O `Response` global satisfaz `HttpResponse` estruturalmente** (`status`, `headers.get`, `text()`), então o `fetch` global deve entrar direto como `Context7Fetch`. Confirmar no `typecheck`; se não passar, um adaptador de três linhas no handler.
- **Dividir o preload em vários arquivos é suportado, e só por causa do bundler:** a documentação do Electron diz literalmente *"a bundler is required if you need to split preload code into multiple files"*, porque o `require` do preload sandboxed é um polyfill sem capacidade de carregar código próprio. O electron-vite cumpre esse papel. Levantado aqui porque decide o corte seguinte, não este.

## Decisões

### D23B.1 — `invoke` simples, com `Result`, sem job

Fecha a pergunta que o guia reservou para este corte. O argumento que decide não estava em nenhum dos dois lados listados lá: **cancelar não devolve cota** — o Context7 conta a chamada no instante em que ela chega, então o botão compraria *parar de esperar*, nunca uma das 200 chamadas do mês. Some-se que `JobEvent` é `progress | chunk | log`: job existe para trabalho que reporta progresso ou transmite em fluxo, e uma chamada REST é uma requisição e uma resposta.

Três condições fazem parte da decisão, e sem elas ela não vale:

1. O teto de 30 s do cliente **aparece na tela** (23-D), nunca em silêncio.
2. **Nenhum botão "cancelar" falso.** Sem `JobId` que enderece o `AbortController`, ele deixaria a requisição correndo e a cota sumiria igual.
3. Promover a job depois custa ~6 arquivos, nenhum dado persistido, nenhum contrato que outro corte já consuma.

⚠️ **Gatilho de reversão, e ele é medido.** A verificação ao vivo do passo 5 cronometra a primeira chamada real de biblioteca grande com `fast=false`. Dezenas de segundos transformam job de conveniência em necessidade.

### D23B.2 — Domínio `docs`, serviço `context7`

O canal nomeia a **operação do app**; o segredo nomeia **quem tem credencial**. Casa com o resto do arco (`DocsPanel`, `docsPartOf`, `PanelKind: 'docs'`) e evita amarrar o contrato IPC a um fornecedor.

| Canal | Argumentos | Resultado |
|---|---|---|
| `docs:search` | `{ query }` | `Result<SearchOutcome>` |
| `docs:fetch` | `{ libraryId, query, version? }` | `Result<ContextOutcome>` |

Os dois retornam `Result`: 429, 401/403, 5xx e `fetch` recusado são falha de serviço, e a interface desenha estado com dica acionável. Estado de tela (`no-libraries`, `empty`, `indexing`, `library-not-found`) viaja **dentro do `value`** e nunca vira `AppError` — é a régua de D23A.3 atravessando a fronteira intacta.

### D23B.3 — Os tipos normalizados sobem para `shared/`; o fio fica em `core/`

`shared/` só importa `zod`, então o que o `IpcContract` referencia tem de morar lá. Sobem `LibraryCandidate`, `DocSnippet`, `DocNote`, `DocRules`, `DocsResult`, `SearchOutcome` e `ContextOutcome`; ficam os `*Wire`, o `ErrorBodyWire`, o `HttpResponse` e o `Context7Fetch` — eles descrevem a API e o *seam*, não o contrato. É a mesma direção que `core/ai/` já segue com `Message` e `AiModel`.

**Nenhum schema zod nasce daqui:** validação é de argumento, nunca de saída (skill [`ipc`](../../../.claude/skills/ipc/SKILL.md)).

### D23B.4 — `'context7'` entra em `CLOUD_PROVIDERS`, e duas seções deixam de dizer "nuvem"

Não nasce enum novo. `CLOUD_PROVIDERS` já nomeia *quem tem credencial guardada*, deliberadamente distinto de `AiService` (DN1A.5) — o Context7 é o primeiro portador de credencial que **jamais** será provedor de IA, o que valida a separação da trilha N em vez de atritar com ela.

| Onde | O quê |
|---|---|
| `secrets/seed.ts` | `context7: 'CONTEXT7_API_KEY'` |
| `settings/CloudSecrets.tsx` | rótulo próprio; título e subtítulo param de falar em "modelos locais via Ollama" |
| `observatory/CapabilitiesPanel.tsx` | rótulo próprio; o cabeçalho `Chaves de nuvem` deixa de mentir |
| `observatory/useCapabilities.ts` | nada a escrever — o `forEach` sobre `CLOUD_PROVIDERS` já cobre |

A régua dos segredos vale sem exceção: `write` devolve `Result` (backend fraco viaja como **sucesso**), `has`/`remove` não devolvem, e **`secrets:read` não existe por desenho** (DN1A.3).

### D23B.5 — Mapeamento de erro próprio, não `mapProviderError`

Cinco linhas no handler: `UpstreamError` vira `{ kind: 'upstream', service: 'context7', status, message }`; qualquer outra coisa vira `{ kind: 'unavailable', service: 'context7', hint }`. Reusar o do `ai/` significaria enfiar `'context7'` num `Record<AiService, string>` de dicas sobre modelo.

### D23B.6 — `query` com `min(1)` no zod: campo vazio é bug, não estado de tela

A situação 1 da tabela dos nove erros (DM-12) diz que a chamada **nunca sai** — o botão desabilitado é o conserto, e ele é do 23-D. Payload vazio chegando ao main é defeito de programação, e o `handle()` já lança para isso.

### D23B.7 — A chave é lida fresca a cada chamada

`readSecretForUse('context7', db, decryptSecret)` numa closure em `register-all.ts`, molde exato de `makeGlmChat`. Uma chave gravada em Configurações vale na consulta seguinte, sem reiniciar; e o cliente já distingue os dois textos do 429 por saber se recebeu chave (D23A.11).

### D23B.8 — O teste de nível 3 prova o embrulho, nunca o parse

Respostas montadas à mão no próprio arquivo. As fixtures do 23-A ficam onde estão: alcançá-las de `main/` faria o teste do handler falhar quando a normalização mudasse, escondendo qual camada quebrou. O que o nível 3 prova: `Result` embrulhando, estado de tela dentro do `value`, `UpstreamError` virando `upstream`, `TypeError` virando `unavailable`, a chave chegando ao cliente, e o `fetchFn` nunca alcançando `context7.com`.

### D23B.11 — `DocSnippet` carrega uma lista de blocos, não um `code` só

Achado da verificação ao vivo, não da leitura: o 23-A juntava o `codeList[]` num `code` com `join('

')` e guardava só o `codeLanguage` do trecho. A resposta real do `/vercel/next.js` mostrou o que isso produz — o mesmo `export async function GET()` **duas vezes** no primeiro trecho, e `GET(request: Request)` grudado em `GET(request)` no terceiro. A API guarda **variantes do mesmo exemplo** (TypeScript e JavaScript), e o campo de idioma do trecho dizia `'typescript'` justamente onde havia variante JS junto.

Não há conserto pela requisição: o `/v2/context` aceita quatro parâmetros (`libraryId`, `query`, `type`, `fast`) e nenhum deles alcança dentro do trecho — conferido contra o guia de API oficial. E filtrar por `codeLanguage` do nosso lado não veria o caso, além de ser o campo não normalizado que fez DM-16 deixar o filtro por linguagem de fora.

`blocks: { language, code }[]` é a forma fiel: uma lib Python com um bloco só renderiza um bloco só, sem caso especial, e o painel (23-F) decide se mostra abas TS/JS ou deduplica variantes de código idêntico. `tokens` continua sendo o número da API, que cobre a lista inteira.

**Feito agora porque é o momento mais barato:** ninguém consome `DocSnippet` ainda. Depois do 23-C haveria parte persistida na forma antiga.

### D23B.10 — Memo de sessão no handler, porque quem gasta cota é a fronteira

Pergunta idêntica devolve a resposta anterior sem gastar chamada. O recurso escasso desta feature é a cota — 200/mês no anônimo —, e o `Consultar de novo` do painel mais um painel reaberto gastariam duas chamadas numa pergunta já respondida. O freio mora aqui e não no painel: quem faz a chamada é esta camada, e um limite na interface seria contornado pelo próximo chamador.

**Só o que é resposta completa entra no memo** (`found` na busca, `ready` no contexto). `indexing` fica de fora porque tentar de novo é justamente o conserto que a situação 4 oferece; `empty`/`no-libraries` levam o usuário a reformular de qualquer forma; e falha nunca entra, senão o botão `Tentar de novo` nasceria morto.

Em memória, limitado a 20 entradas, vivo enquanto o app estiver aberto — documentação não vale persistir, e reiniciar é o jeito barato de forçar uma consulta nova.

### D23B.9 — O teto do preload estoura, com prazo

O corte termina com `src/preload/index.ts` em ~104 linhas. Dívida **nomeada**, com gatilho no [`ROADMAP § 3`](../../ROADMAP.md): dividir **antes do 23-C**. Nada importa esse arquivo, então a divisão não propaga e adiá-la não acumula juros — o que ela evita é misturar dois assuntos num corte só.

## Passos — um commit cada

### 0. O plano nasce

Este arquivo. *Commit: `docs(23-B): o plano da fronteira, com a pergunta aberta fechada`*

### 1. Os tipos normalizados sobem (D23B.3)

Mover o bloco normalizado de `src/core/context7/types.ts` para `src/shared/ipc.ts`; `parse.ts`, `client.ts` e os dois testes passam a importar de `@shared/ipc`. Refatoração mecânica, comportamento idêntico — os 35 testes do 23-A são a rede.

*Commit: `refactor(23-B): o que atravessa o IPC sobe para shared/, o fio fica em core/`*

### 2. O contrato, o preload e o mock (passos 1–3 e 6 da skill `ipc`)

`argsSchema`, `IpcContract`, `Api`, o bloco no preload e a entrada em `test/api-mock.ts` — os cinco no mesmo commit, porque `const api: Api` e o `satisfies Api` do mock quebram o `typecheck` se qualquer um faltar. O handler ainda não existe, e `handle()` não é exaustivo, então a suíte fica verde.

*Commit: `feat(23-B): os canais docs:search e docs:fetch no contrato`*

### 3. Os handlers (passo 4) e o nível 3

`src/main/features/context7/handlers.ts`: duas funções **exportadas**, dependências por parâmetro (`fetchFn`, `getApiKey`), o mapeamento de erro de D23B.5. Teto de 150 linhas, com folga. `handlers.test.ts` ao lado — sem Electron, sem rede.

**Ver vermelho antes de verde** em dois testes que nasceriam vacuosos: o que prova que estado de tela **não** vira `AppError` (aplicando o mapeamento a tudo, ele precisa falhar) e o que prova que a chave chega ao cliente.

*Commit: `feat(23-B): handlers da consulta, com o erro classificado no próprio domínio`*

### 4. A chave e a costura (passo 5)

`'context7'` em `CLOUD_PROVIDERS`, os quatro `Record` exaustivos, a cópia das duas seções, e os dois `handle()` em `register-all.ts` injetando o `fetch`, a chave e o `db`.

*Commit: `feat(23-B): a chave do Context7 no cofre e os canais registrados`*

### 5. Verificação ao vivo, e a medição que fecha D23B.1

Fase obrigatória, não opcional — detalhe na seção *Verificação*. O veredito sobre o job entra no diário e volta ao guia.

*Commit: `docs(23-B): a medição da chamada real, e o veredito sobre o job`*

### 6. Sincronização documental e fechamento

Auto-conservação, na ordem do `CLAUDE.md`: `DECISOES.md` ganha D23B.1–D23B.9; o guia do arco marca 23-B como entregue e recebe as linhas de errata (o `mapProviderError` que não servia, o preload no teto); `ROADMAP § 2` recebe a contagem de testes **remedida**, nunca copiada; `ROADMAP § 3` ganha o gatilho do preload. O plano sai de `plan/active/` para `plan/implemented/` e ganha entrada em `HISTORY.md`.

*Commit: `docs(23-B): fecha o corte — decisões, errata do guia e o gatilho do preload`*

## Arquivos

| Arquivo | O quê |
|---|---|
| `docs/plan/active/23-B-a-fronteira.md` | novo — este plano |
| `src/shared/ipc.ts` | tipos normalizados, `argsSchema`, `IpcContract`, `Api`, `CLOUD_PROVIDERS` |
| `src/core/context7/types.ts` · `parse.ts` · `client.ts` (+ testes) | os tipos saem; os imports apontam para `@shared/ipc` |
| `src/main/features/context7/handlers.ts` + `.test.ts` | novo — nível 3 |
| `src/main/ipc/register-all.ts` | dois `handle()`, a closure da chave |
| `src/preload/index.ts` | bloco `docs` — estoura o teto (D23B.9) |
| `test/api-mock.ts` | `docs` no mock |
| `src/main/features/secrets/seed.ts` | `CONTEXT7_API_KEY` |
| `settings/CloudSecrets.tsx` · `observatory/CapabilitiesPanel.tsx` | rótulos e a cópia que dizia "nuvem" |
| `docs/DECISOES.md` · `docs/HISTORY.md` · `docs/ROADMAP.md` · `docs/reference/context7/README.md` | fechamento |

## Verificação

- `pnpm exec vitest related` no arquivo tocado durante o trabalho; `pnpm check:fast` antes de cada commit (o `commit_gate` roda a suíte inteira sozinho).
- **Ver vermelho antes de verde** nos dois testes nomeados no passo 3.
- `pnpm exec node scripts/check-doc-links.mjs` depois das edições de `docs/`.
- **Ao vivo (`pnpm dev`), no passo 5:**
  1. Configurações mostra o campo do Context7 ao lado de Gemini e GLM; gravar uma chave e conferir `chave gravada`, `Substituir` e `Remover`.
  2. Observatório › Capacidades lista a linha do Context7 como `configurada`.
  3. **Duas chamadas reais pelo DevTools**, cronometradas com `performance.now()`: uma busca e um `docs:fetch` numa **biblioteca grande**. Custo: 2 das ~146 chamadas restantes no mês.
  4. O tempo da segunda é o que **confirma ou reverte D23B.1**.
- ⚠️ **Nenhum teste automatizado toca a rede** — nível 3 contra respostas montadas à mão, nível 1 contra as fixtures do 23-A.

## Fora do escopo

Schema da parte, `docsPartOf`, `partForProvider`, o booleano de ativa/desligada (23-C) · painel, gatilho no `AttachButton`, abas, seleção (23-D em diante) · os textos em português dos nove erros na tela (23-I) · a divisão do preload (decidida antes do 23-C) · `ESCOPO.md` e o guia antigo `⛔ consumido` (23-J).

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 07/09/2026 | Plano escrito a partir do guia do arco 23; D23B.1–D23B.9 fixadas | Duas forquilhas resolvidas pelo dono: `invoke` sem job (a recomendação do 23-A vale) e o domínio `docs` no canal, com `context7` só no cofre. **Três achados contra o guia e contra o próprio código:** `mapProviderError` não serve (é `Record<AiService>`), o preload já está no teto de 100 linhas, e os tipos normalizados do 23-A precisam subir para `shared/` porque `shared` não importa `core` |
| 07/09/2026 | Passos 1–4: tipos para `shared/`, os dois canais, handlers de nível 3, a chave no cofre e a costura | `fetch` global satisfaz `Context7Fetch` sem adaptador — confirmado no `typecheck`, era hipótese da sondagem. Duas contagens envelheceram com o terceiro portador de credencial e foram remedidas: `secrets.has` passa de 2 para 3 na sonda do Observatório, e a docstring de nove pontos vira dez |
| 07/09/2026 | D23B.10 acrescentada em execução: memo de sessão no handler | Pedido do dono ao ver o custo de repetir a sonda. O freio ficou na fronteira e não no painel — quem faz a chamada é esta camada. Só `found`/`ready` entram; `indexing` e falha ficam de fora para não matar o `Tentar de novo` |
| 07/09/2026 | Verificação ao vivo, e a medição que fecha a D23B.1 | Campo em Configurações e linha no Observatório conferidos. **Busca 3.944 ms · `/vercel/next.js` com `fast=false` 2.222 ms** — 7% do teto de 30 s, então o `invoke` sem job se sustenta e o gatilho de reversão não disparou. A busca saiu mais lenta que o contexto por carregar DNS e TLS da primeira requisição do processo; n=1 em cada. As ~125 repetições seguintes voltaram em 1–9 ms e **custaram zero de cota** — o memo ao vivo. Duas chamadas reais gastas no total |
| 07/09/2026 | D23B.11: `DocSnippet` troca `code`+`language` por `blocks[]` | Defeito que só a resposta real revelaria — o `join` do `codeList[]` renderizava o mesmo exemplo duas vezes. Confirmado contra a doc oficial que **não existe parâmetro de idioma** no `/v2/context`. Vermelho provado cortando a lista no primeiro bloco. Corrigido no 23-B por ser o momento sem consumidor: depois do 23-C haveria parte persistida na forma antiga |
