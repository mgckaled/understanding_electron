# Nuvem opt-in — guia de implementação (levantamento prévio)

**Data:** 21/08/2026. **Motivo:** a fatia 3 do [plano 09](../plan/active/09-camada-de-ia.md) (`nuvem opt-in, Gemini/GLM + segredos`) segue no backlog, mas as fichas técnicas dos seis candidatos já existem ([`cloud-optin.md`](models/cloud-optin.md), [`cloud-optin-free-tier-analysis.md`](models/cloud-optin-free-tier-analysis.md)) e a pergunta "o que muda na arquitetura para a nuvem entrar" já tinha resposta parcial espalhada entre o [D15.9](../plan/implemented/15-orcamento-de-contexto-e-modelo.md#d159--os-modelos-de-nuvem-não-entram-neste-plano-e-a-costura-que-entra-custa-uma-palavra) e o [D9.2/D9.3](../plan/active/09-camada-de-ia.md#decisões-tomadas) do plano 09. Vale registrar essa resposta reunida **antes** de o arco começar, para o próprio plano nascer sem precisar rederivar o que já dá para prever hoje.

**O que este documento não é.** Não é o plano da fatia 3 — não tem passo numerado, não tem diário de execução, e não decide nada que hoje é decidível só na hora (nome de canal, forma exata de um tipo). É levantamento: o que se sabe que vai ser preciso construir, o que já está decidido em outro documento dono (só apontado, nunca duplicado), e o que ainda é pergunta em aberto. Quando o plano da fatia 3 nascer em `docs/plan/active/`, ele consome este guia — não o contrário.

**Legenda, e ela importa mais que qualquer item da lista:**

| Marca | Significa |
|---|---|
| ✅ **decidido** | já é regra fixada em outro documento dono — este guia só aponta e explica a consequência |
| ❓ **questão em aberto** | identificada nesta varredura, sem resposta — a fatia 3 decide, não este guia |
| ⚠️ **não pesquisado** | palpite razoável a partir do padrão do projeto ou de conhecimento geral, **sem verificação nesta sessão** — confirmar antes de virar código |

Companheiros: [`models/cloud-optin.md`](models/cloud-optin.md) (ficha técnica dos seis candidatos), [`models/cloud-optin-free-tier-analysis.md`](models/cloud-optin-free-tier-analysis.md) (panorama de provedor, dado e sustentabilidade financeira), [`ESCOPO.md`](../ESCOPO.md) (regra do nível 3), [`CLAUDE.md § Segurança`](../../CLAUDE.md#segurança) (regra de segredo).

---

## Índice

1. [As quatro razões do D15.9 — por que a fatia 3 não é "trocar a URL"](#1-as-quatro-razões-do-d159--por-que-a-fatia-3-não-é-trocar-a-url)
2. [Peça A — sistema de segredo](#2-peça-a--sistema-de-segredo)
3. [Peça B — plumbing de provedor](#3-peça-b--plumbing-de-provedor)
4. [Peça C — tabela de capacidade chumbada](#4-peça-c--tabela-de-capacidade-chumbada)
5. [Peça D — nível 3 e a visão do Gemini, tensão já registrada](#5-peça-d--nível-3-e-a-visão-do-gemini-tensão-já-registrada)
6. [Peça E — cota e limite de taxa, o problema que o Ollama não tinha](#6-peça-e--cota-e-limite-de-taxa-o-problema-que-o-ollama-não-tinha)
7. [Peça F — provedor terceirizado pede uma camada extra de checagem](#7-peça-f--provedor-terceirizado-pede-uma-camada-extra-de-checagem)
8. [Peça G — formato de streaming não é um padrão único](#8-peça-g--formato-de-streaming-não-é-um-padrão-único)
9. [`isAvailable` muda de sentido semântico na nuvem](#9-isavailable-muda-de-sentido-semântico-na-nuvem)
10. [O que fica fora deste guia, de propósito](#10-o-que-fica-fora-deste-guia-de-propósito)

---

## 1. As quatro razões do D15.9 — por que a fatia 3 não é "trocar a URL"

✅ **Decidido, resumido aqui só para orientar o resto do documento** — texto completo em [D15.9](../plan/implemented/15-orcamento-de-contexto-e-modelo.md):

1. `num_ctx` não existe na nuvem — não há janela a reservar, só envio e cobrança/recusa.
2. Não há `/api/show` equivalente — capacidade e teto de contexto viram tabela chumbada no código, que envelhece com o release do fornecedor, não com a máquina do usuário (é a Peça C abaixo).
3. Não há onde guardar a chave — o subsistema de segredo inteiro falta (Peça A).
4. A nuvem bloqueia o nível 3, e é exatamente o que os planos 16/17 constroem para o local (Peça D).

As seções seguintes detalham as peças 2-4 acima, mais três que a varredura desta sessão encontrou e que o D15.9 não cobria — porque em 10/08/2026 a pesquisa ainda não tinha chegado aos quatro elegíveis via provedor terceirizado (Peças F, G) nem tinha isolado a mudança de sentido do `isAvailable` (seção 9).

---

## 2. Peça A — sistema de segredo

✅ **Decidido:** a regra já está fixada no [`CLAUDE.md`](../../CLAUDE.md#segurança) — "segredo é de mão única: o renderer grava e consulta se existe, **nunca lê**". Isso implica dois canais, não um: algo como `secrets:write` (renderer entrega a chave, main criptografa e grava) e `secrets:has` (renderer pergunta se existe, recebe booleano) — nomes ilustrativos, a decisão de nome real é do plano, seguindo a convenção `domínio:verbo` da skill [`ipc`](../../.claude/skills/ipc/SKILL.md). Um canal `secrets:read` **não deveria existir** — se aparecer no código, é o bypass que a regra de mão única existe para impedir.

✅ **Decidido (arquitetura, não segredo em si):** "decisão de segurança que dois processos precisam tomar nasce em `core/`, nunca ao lado de um dos chamadores" ([`CLAUDE.md`](../../CLAUDE.md#segurança)). Aplicado aqui: a lógica "existe segredo válido para este provedor, logo a chamada pode ser tentada" mora em `core/`, injetada tanto no `isAvailable(service)` (D9.3) quanto no ponto que efetivamente monta a chamada HTTP — não duas cópias da mesma checagem em lugares diferentes.

✅ **Confirmado via documentação oficial do Electron (Context7):** o mecanismo concreto é `safeStorage` (criptografia ligada à conta do sistema operacional), já citado como a peça planejada desde a fase 03. `isEncryptionAvailable()` depende da OS **e** do app estar pronto (`app.isReady()`) — no Windows fica disponível a partir do evento `ready`; no macOS depende do Keychain; no Linux depende de um *secret store* presente (`kwallet` ou `gnome-libsecret`).

⚠️ **A armadilha real, achada no próprio código-fonte da Electron via Context7, é uma inversão que engana quem só ler a doc de alto nível.** Se o Linux não tem nenhum *secret store* disponível, o Electron cai para uma senha fixa em texto puro (`basic_text`) — mas `isEncryptionAvailable()` continua retornando **`true`** nesse caso (o C++ fonte mostra `OSCrypt::IsEncryptionAvailable() || (usar_v10 && backend == "basic_text")` — o `||` é o detalhe que importa). **Checar só `isEncryptionAvailable() === true` não garante proteção real** — é preciso também chamar `safeStorage.getSelectedStorageBackend()` e conferir que o retorno **não** é `'basic_text'`. Como o app hoje só roda Windows nesta máquina de desenvolvimento, este caso não foi testado ao vivo — mas já não é "não pesquisado": é comportamento documentado no próprio fonte da Electron, e a fatia 3 precisa decidir o que fazer quando o backend for `'basic_text'` — recusar salvar o segredo com aviso claro, ou salvar mesmo assim avisando que a proteção é fraca nesta máquina. Fonte: [`docs/api/safe-storage.md`](https://github.com/electron/electron/blob/main/docs/api/safe-storage.md) (oficial, via Context7).

---

## 3. Peça B — plumbing de provedor

✅ **Decidido:** a abstração já existe e foi desenhada para isto — `ChatFn` (D9.2) é a única função que toca rede em `core/ai/`, e os adaptadores concretos vivem em `src/main/features/ai/providers/`. Um provedor de nuvem novo é **mais um adaptador nesse diretório**, implementando a mesma assinatura que o adaptador Ollama já implementa — não uma segunda abstração paralela.

✅ **Decidido:** `AiModel.provider` já existe com um valor só (`'ollama'`), de propósito — "acrescentá-la depois toca `shared/ipc.ts`, o preload, o renderer, o main e todo `settings` já gravado; acrescentá-la agora é uma linha" ([D15.9](../plan/implemented/15-orcamento-de-contexto-e-modelo.md)). A fatia 3 é o momento em que essa costura de custo zero se paga — abrir um segundo valor no discriminante ainda toca os cinco lugares citados, só que agora com um propósito real em vez de zero-custo especulativo.

✅ **Decidido:** `isAvailable(service)` (D9.3) já devolve o mesmo formato `{ kind: 'unavailable', service, hint }` para qualquer provedor — Ollama fora do ar e chave do Gemini ausente já eram, por desenho, o mesmo tipo de falha. Um provedor de nuvem novo estende essa função, não a substitui. **Mas ver a seção 9** — o formato é igual, o que ele *verifica* não é.

⚠️ **Não pesquisado:** cada adaptador novo pede o mesmo teste de nível 1 que o Ollama já tem — `ChatFn` é injetável, então o teste roda sem rede real, "o mesmo desenho de `embed_fn`... o teste de nível 1 roda sem Ollama instalado" (plano 09, D9.2). O detalhe de *como* mockar cada provedor (formato de resposta, erro típico) não foi levantado nesta sessão — fica para quando o adaptador for escrito.

---

## 4. Peça C — tabela de capacidade chumbada

✅ **Decidido, e é a razão de existir do `cloud-optin.md`:** sem `/api/show`, contexto/capacidades/preço de cada modelo de nuvem não são sondados em runtime — são uma tabela escrita à mão no código, igual à ficha já pesquisada. A D15.9 já registrou o motivo de propósito: "buscar em runtime traria rede numa camada que a D9.2 mantém pura, e uma resposta de terceiro decidindo um portão de segurança".

❓ **Questão em aberto:** `cloud-optin.md` é documentação, não código — nada garante que os números lá cheguem ao TypeScript sem erro de transcrição, nem que alguém lembre de reconferir a data antes de copiar. O próprio `cloud-optin.md` já tem um gatilho de revisão registrado (checar se `glm-5.x`/`gemini-3.x` têm tier melhor antes de integrar) — a fatia 3 decide se esse gatilho vira um passo formal do plano ou fica na confiança de quem implementa lembrar de reabrir o documento.

---

## 5. Peça D — nível 3 e a visão do Gemini, tensão já registrada

✅ **Decidido, e a tensão já está documentada em dois lugares** — [`ESCOPO.md`](../ESCOPO.md#o-gate-de-capacidade-é-correção-não-cortesia) e [`cloud-optin.md`](models/cloud-optin.md): a família Gemini 3.x inteira — Flash e as variantes **Lite** — declara `vision` nas capacidades (corrigido em N-1-C; a pesquisa original, contra `gemini-2.5-flash`, cobria só um modelo da geração anterior), e o nível 3 (ESCOPO.md) bloqueia justamente anexo de imagem/documento na nuvem, sem exceção por provedor ou por modelo. Um usuário vai ver **qualquer** modelo Gemini declarando poder ver imagem, com o anexo recusado mesmo assim.

**A decisão de UI que este guia deixava em aberto foi tomada em N-1-C, sem intervenção especial:** a capacidade `vision` aparece no chip da linha do modelo no seletor (mesmo mecanismo que já mostrava `tools`/`thinking` para qualquer modelo, `capabilityChips()`) — nada foi ocultado. É a opção "mais honesta" que este guia já cogitava, escolhida por omissão: não construir um caso especial para esconder `vision` de um modelo de nuvem foi mais barato, e mais correto, que construir um para escondê-la. A recusa em si usa a mesma mensagem genérica que `checkLevel3` já dava para o GLM (que nunca tinha `vision` para começo de conversa): "Documento e imagem são nível 3 — bloqueados em modelos de nuvem. Use um modelo local para este anexo."

---

## 6. Peça E — cota e limite de taxa, o problema que o Ollama não tinha

O Ollama tem um problema de recurso local (um modelo residente por vez, disciplina de `keep_alive`, já registrado no `CLAUDE.md`). A nuvem troca esse problema por outro, de natureza diferente: cota **por conta**, compartilhada entre todos os modelos chamados com aquela chave — os números já levantados em `cloud-optin.md` mostram o teto da Groq em 14.400 requisições/dia **para todos os modelos da conta**, e o da SambaNova em apenas 20/dia.

✅ **Resolvido para a Groq, confirmado via documentação oficial (Context7):** cada resposta HTTP da Groq já traz a cota em cabeçalhos — `x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`, `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`, mais `x-ratelimit-reset-requests`/`-tokens`, e um `retry-after` quando a resposta é 429. **O app não precisa contar localmente para a Groq** — basta ler o cabeçalho de cada resposta e manter o último valor visto. **Atenção à janela: os dois pares de cabeçalho não medem o mesmo período** — `-requests` é sobre o teto **diário** (RPD), `-tokens` é sobre o teto **por minuto** (TPM); tratar os dois como a mesma janela de tempo é um jeito fácil de calcular cota errado. Fonte: [`console.groq.com/docs/rate-limits`](https://console.groq.com/docs/rate-limits) (oficial, via Context7).

❓ **Continua em aberto para Cerebras e SambaNova.** A busca desta sessão nas respectivas documentações (Context7) encontrou só a recomendação padrão de *retry* com *backoff* exponencial em cima de `RateLimitError`/429 — nenhuma tabela de cabeçalho de cota restante equivalente à da Groq apareceu no material indexado. Isso não prova que o cabeçalho não existe, só que esta pesquisa não o confirmou — **verificar direto na resposta HTTP real antes de decidir a estratégia de cota** para esses dois provedores, em vez de presumir paridade com a Groq.

Perguntas que continuam sem resposta, mesmo após a pesquisa desta rodada:

- Para Cerebras/SambaNova, sem cabeçalho confirmado: o contador precisa ser local? Por processo (perdido a cada reinício) ou persistido (em quê — `node:sqlite`, já usado para conversas)?
- Qual `AppError.kind` representa "estourei a cota" — o mesmo `'unavailable'` com um `hint` diferente, ou um `kind` novo (`'rate-limited'`), com UI própria distinguindo "provedor fora do ar" de "provedor disponível, mas eu já gastei a cota de hoje"?

Estas duas seguem como trabalho da própria fatia 3.

---

## 7. Peça F — provedor terceirizado pede uma camada extra de checagem

✅ **Decidido, herdado de [`cloud-optin-free-tier-analysis.md` § 5](models/cloud-optin-free-tier-analysis.md#5-risco-de-segurança-específico-para-o-crivo):** os quatro elegíveis via Groq/Cerebras/SambaNova empilham duas responsabilidades — o hospedeiro responde pelo dado, o laboratório original responde pelo modelo, e a política do primeiro nunca cobre o segundo. Isso não é código, é um item de checklist **antes** de um desses quatro virar opção real no seletor de modelo: reconfirmar a política de retenção do hospedeiro contra a fonte oficial dele (não um agregador — a rodada anterior desta sessão encontrou justamente esse erro, corrigido depois de revisão), e decidir se a política de dado do laboratório original do modelo (não do hospedeiro) importa para o caso de uso do crivo.

❓ **Questão em aberto:** o crivo deveria expor os quatro elegíveis com o mesmo destaque dos dois de primeira parte (Gemini/GLM), ou com um aviso de interface diferenciado por serem "modelo de um lab, hospedado por outra empresa"? Não decidido — nenhum documento anterior tratou disso.

---

## 8. Peça G — formato de streaming não é um padrão único

✅ **O que se sabe:** o adaptador Ollama consome um stream de linhas NDJSON (uma linha JSON por chunk) — é o formato documentado da API do Ollama e o que o adaptador atual já trata.

✅ **Confirmado, especificamente para a Groq (Context7, documentação oficial da própria `api.groq.com`):** Server-Sent Events, `data: {...}\n\n` com `choices[0].delta.content`, terminado por `data: [DONE]` — a doc de referência da API descreve o formato literalmente nesses termos.

⚠️ **Cerebras e SambaNova — parcialmente confirmado, não presumir o mesmo detalhe da Groq.** Os dois confirmam **SSE** como transporte (SambaNova: a doc do SDK oficial diz "supports streaming responses using Server-Sent Events"). Mas o exemplo com `data:`/`[DONE]`/`choices[0]['delta']['content']` que esta pesquisa encontrou para Cerebras veio da página de integração com o **Cloudflare AI Gateway** (`gateway.ai.cloudflare.com`), não de uma chamada direta a `api.cerebras.ai` — é o formato do *gateway*, não necessariamente uma confirmação direta do endpoint da Cerebras (o outro exemplo visto, com `base_url="https://api.cerebras.ai/v1"` e cliente OpenAI, era **sem streaming**). Nenhum exemplo de shape de chunk (`delta.content`, `[DONE]`) apareceu para a SambaNova. **Tratar "compatível com OpenAI" como hipótese razoável para os dois, não como fato confirmado** — verificar contra uma chamada real (ou a doc de referência específica do endpoint, não de uma integração terceira) antes de escrever o adaptador.

A atribuição a um gerador de SDK comum (Stainless) é **inferência minha**, a partir de convenções de cliente (`.with_raw_response`, `.with_streaming_response`) que apareceram nos três — nenhum resultado do Context7 nomeou o gerador. Não tratar como fato citável.

⚠️ **O Gemini não segue o padrão Groq, e tem uma complicação a mais.** Confirmado via `ai.google.dev` (oficial, Context7): a "Interactions API" (mais nova) usa SSE com **eventos nomeados** (`event: step.delta`, `event: interaction.completed`, etc.) — estrutura genuinamente diferente do formato plano `choices[0].delta`. Mas essa confirmação de shape é só para a Interactions API. Para o endpoint clássico `generateContentStream`/`streamGenerateContent` — o que `gemini-2.5-flash`, o candidato já fichado, usaria — a documentação encontrada só diz que "usa Server-Sent Events para empurrar chunks", **sem mostrar o formato do chunk em si**. Achado extra, fora do que esta pesquisa pretendia confirmar: os próprios exemplos oficiais da Interactions API já usam `gemini-3.6-flash` como modelo de referência — o mesmo sinal de geração corrente já registrado como gatilho de revisão em `cloud-optin.md`. Quem escrever o adaptador do Gemini precisa confirmar **qual das duas APIs** integrar e qual é o shape real do chunk clássico — nenhuma das duas coisas está fechada aqui.

Cada adaptador novo ainda precisa de verificação pontual contra uma chamada real (ou a doc de referência específica, não uma página de integração terceira) no momento de ser escrito. **Não presumir que um único parser cobre Groq, Cerebras e SambaNova** — só a Groq tem o shape confirmado nesta pesquisa; os outros dois só têm o transporte (SSE) confirmado.

---

## 9. `isAvailable` muda de sentido semântico na nuvem

❓ **Questão em aberto, não coberta pelo D9.3 original.** O formato de retorno de `isAvailable(service)` é o mesmo para os três provedores (D9.3, ✅ decidido) — mas o que a função **verifica** não é o mesmo, e um implementador lendo só o D9.3 vai presumir paridade que não existe:

- **Ollama:** faz um *ping* real contra um serviço vivo (timeout curto, 10s conforme D9.3) — "disponível" significa "respondeu agora".
- **Nuvem:** só pode checar "existe uma chave gravada" (Peça A) — não dá para confirmar que a chave é válida sem gastar uma chamada real contra o provedor. "Disponível" na nuvem significa "há uma chave presumivelmente utilizável", não "a chamada vai funcionar" — isso só se sabe na primeira tentativa real, que pode falhar por chave revogada, cota estourada (Peça E) ou qualquer outro motivo que um *ping* não captura.

Não é uma falha de design do D9.3 — é uma diferença real entre os dois tipos de provedor que o formato comum de retorno esconde por baixo de uma interface igual. A fatia 3 precisa decidir se isso é aceitável como está (o usuário descobre a chave inválida na primeira mensagem, com erro claro) ou se merece uma verificação mais forte no momento em que a chave é cadastrada (uma chamada de teste, gastando uma unidade de cota só para validar).

---

## 10. O que fica fora deste guia, de propósito

Para não repetir o que já tem dono em outro lugar:

- **Quais modelos, com qual ficha técnica** — `models/cloud-optin.md`.
- **Lógica de negócio de cada provedor, política de dado, risco de segurança geral** — `models/cloud-optin-free-tier-analysis.md`.
- **Regra do nível 3 em si** (o que é, por que existe) — `ESCOPO.md`.
- **Convenção de canal IPC, `Result` vs. exceção, os seis lugares que um canal novo toca** — skill `ipc`.
- **Camadas, regra de importação, sandbox** — skill `architecture`.
- **Passo a passo, ordem de execução, diário de sessão** — nasce no plano da fatia 3, em `docs/plan/active/`, quando o arco começar. Este documento não é esse plano.

---

## Fontes

Consultadas em 21/08/2026, todas via Context7 (documentação oficial de cada projeto/provedor):

- [Electron — `safeStorage`](https://github.com/electron/electron/blob/main/docs/api/safe-storage.md) — comportamento por plataforma, fallback `basic_text` no Linux.
- [Groq — Rate limits](https://console.groq.com/docs/rate-limits) — cabeçalhos de cota por resposta.
- [Groq — Text chat / streaming](https://console.groq.com/docs/text-chat) e [API reference](https://console.groq.com/docs/api-reference) — formato SSE, `data: [DONE]`.
- [Cerebras Inference — docs](https://inference-docs.cerebras.ai/) — SSE confirmado via página de integração (Cloudflare AI Gateway, não o endpoint direto), padrão de *retry*/backoff em 429; shape do chunk **não** confirmado direto contra `api.cerebras.ai`.
- [SambaNova — Python SDK](https://github.com/sambanova/sambanova-python) — SSE confirmado pela doc do SDK; shape do chunk **não** confirmado.
- [Google — Gemini API, streaming](https://ai.google.dev/gemini-api/docs/api-overview) e [Interactions streaming](https://ai.google.dev/gemini-api/docs/interactions/streaming) — SSE com eventos nomeados, duas APIs de streaming coexistindo.

Preço, cota e formato de wire são decisão do fornecedor e mudam sem aviso — reconferir contra a fonte oficial antes de escrever o adaptador real, não copiar estes trechos direto para produção.

---

**Índice da pasta:** [`README.md`](README.md) · **Ficha técnica dos candidatos:** [`models/cloud-optin.md`](models/cloud-optin.md) · **Panorama de provedor:** [`models/cloud-optin-free-tier-analysis.md`](models/cloud-optin-free-tier-analysis.md) · **Plano que consome este guia:** [09 — Camada de IA](../plan/active/09-camada-de-ia.md)
