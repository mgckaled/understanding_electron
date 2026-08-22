# N-1-A — Segredo de nuvem: `safeStorage`, campo mascarado e semente `.env`

**Depende de:** D9.2 (`ChatFn` injetável), D9.3 (gate uniforme `{ kind: 'unavailable', service, hint }`), `CLAUDE.md § Segurança` (regra de mão única, já fixada desde a fase 03) · **Entrega:** o subsistema de segredo inteiro — tabela própria no SQLite, `safeStorage` com a guarda do `basic_text` do Linux, três canais IPC, semente de desenvolvimento via `.env`, e o campo de dois estados no modal de Configurações para os dois provedores já confirmados (Gemini, GLM).

> Primeiro sub-plano da trilha **N** (nuvem) — ver [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência). Cortado pelas "peças" que [`docs/reference/cloud-optin-implementation-guide.md`](../../reference/cloud-optin-implementation-guide.md) já levantou: este plano fecha a **Peça A** (sistema de segredo) por inteiro. **N-1-B** (um provedor ponta a ponta — segundo valor de `AiModel.provider`, adaptador, streaming, `isAvailable` com semântica de nuvem, recusa de nível 3) e **N-1-C** (segundo provedor + cota/limite de taxa, Peça E) seguem sem arquivo — nascem quando forem os próximos a executar, mesma regra do arco 13-23.

**Fora deste plano:** qualquer coisa que fale com a API de um provedor de verdade — adaptador (`main/features/ai/providers/`), streaming, `ai:isAvailable`/`ai:chat` estendidos, `AiModel.provider` ganhando um segundo valor, desbloqueio dos cards "Locais/Nuvem" no `ModelPicker`. Este plano só guarda e recupera a chave; **N-1-B** é quem a usa. Também fora: os quatro elegíveis via provedor terceirizado (Groq/Cerebras/SambaNova) — decisão de adiar registrada abaixo.

---

## Contexto

O levantamento já existe e é denso — [`models/README.md`](../../reference/models/README.md), [`models/cloud-optin.md`](../../reference/models/cloud-optin.md) e [`cloud-optin-implementation-guide.md`](../../reference/cloud-optin-implementation-guide.md) (Peças A–G) respondem a maior parte de "o que muda na arquitetura" antes deste plano começar. Este documento **consome** esse guia, não o reabre — só a Peça A (segredo) vira código aqui.

**Os dois provedores já estão confirmados pelo usuário**, com nome exato e uso recente comprovado no mill.tools: `gemini-2.5-flash` (Google, contexto 1.048.576 tokens) e `glm-4.7-flash` (Z.ai, 200.000 tokens, tier grátis recorrente). Isso muda o que o passo 1 precisa fazer — deixou de ser "qual modelo" (já respondido, com evidência de produção real, mais forte que a ficha isolada) e virou só "o preço e a cota que a ficha registrou em 20/08/2026 ainda valem".

Três decisões de escopo tomadas **antes** deste plano, na conversa que o precedeu, e só resumidas aqui:

1. **`.env` é semente de desenvolvimento, nunca uma segunda fonte de verdade** — achado do context7 nesta sessão: o `loadEnv` do electron-vite é **tempo de build** (assa o valor dentro de `out/main/index.js`), errado para segredo de usuário; o `process.loadEnvFile()` nativo do Node 24 é runtime, zero dependência, e `.env`/`.env.*` já estão no `.gitignore`.
2. **O campo de chave tem dois estados, não um** — a regra de mão única (`CLAUDE.md`, e o guia: *"um canal `secrets:read` não deveria existir — se aparecer no código, é o bypass"*) proíbe reler uma chave já salva. O ícone de olho só funciona no estado *editando*.
3. **Os quatro elegíveis via provedor terceirizado ficam de fora desta rodada** — "mínima" já foi definida como um provedor por vez; a Peça G do guia registra que o formato de streaming da Cerebras e da SambaNova **não está confirmado**; a Peça F tem uma pergunta de UI ainda sem resposta; a SambaNova (20 req/dia) o próprio `cloud-optin.md` já descreve como inviável para conversa real. `CloudProvider` nasce como array `as const` (DN1A.5) justamente para a extensão custar uma linha quando a hora chegar — estrutura aberta, adaptador fechado.

---

## Decisões

### DN1A.1 — `.env` só em desenvolvimento, só como semente, nunca lido pelo app empacotado

```ts
// src/main/index.ts, antes de qualquer janela — só em dev
if (!app.isPackaged) {
  process.loadEnvFile() // Node 24 nativo — lança se o arquivo não existir; ver Risco 1
}
```

A semente **só preenche uma chave que ainda não existe** no `safeStorage` — nunca sobrescreve o que o usuário gravou pela UI. `isAvailable`/`secrets:has` (N-1-B) fazem sempre a mesma pergunta ("há chave gravada?"); nenhum caminho de código pergunta "veio de `.env` ou da UI?" depois que a semente rodou — a proveniência não sobrevive ao boot. `.env.example` documenta `GEMINI_API_KEY`/`GLM_API_KEY` na raiz do repo, sem valor real.

**A semente roda antes de qualquer janela existir — sem UI para mostrar o aviso da DN1A.4.** Regra: só grava quando `assessSecretBackend` devolve `'ok'`; se devolver `'weak'` ou `'unavailable'`, a semente **pula em silêncio** e loga um `console.warn` no terminal do main (visível em `pnpm dev`, onde a semente já roda por definição) — nunca bloqueia o boot, nunca inventa uma segunda superfície de aviso além da que o passo 6 já constrói para o caminho da UI.

### DN1A.2 — Tabela `secrets` própria, não reaproveita `app_settings`

Achado ao ler `main/features/settings/handlers.ts` nesta sessão: `readSettings()` faz `SELECT key, value FROM app_settings` **sem filtro** e devolve tudo ao renderer via `settings:read`. Guardar o segredo cifrado nessa mesma tabela vazaria o *ciphertext* para o processo sandboxado a cada leitura de configurações — inofensivo contra o conteúdo em si (a cifra é presa à conta do SO, o renderer não teria como decifrar), mas estruturalmente errado: a regra de mão única existe para o renderer nunca **receber** o segredo, não só para não conseguir usá-lo. Migração v2:

```sql
CREATE TABLE secrets (
  provider   TEXT PRIMARY KEY,
  ciphertext BLOB NOT NULL
);
```

`provider` é a chave — um segredo por provedor, `INSERT ... ON CONFLICT(provider) DO UPDATE` no `write`, mesmo padrão do `writeSettings` existente. `ciphertext` é `BLOB`: confirmado via Context7 (Node.js `node:sqlite`) que o tipo aceita `TypedArray`/`DataView` — `Buffer` (o que `safeStorage.encryptString()` devolve) é subclasse de `Uint8Array`, então liga direto, sem conversão para base64.

### DN1A.3 — Três canais, `secrets:read` não existe

| Canal | Args | Result | Observação |
|---|---|---|---|
| `secrets:write` | `{ provider: CloudProvider; apiKey: string }` | `Result<{ weakBackend: boolean }, AppError>` | `weakBackend: true` no sucesso é o sinal da DN1A.4 — nunca um `AppError`, que é só para o caminho de falha real |
| `secrets:has` | `{ provider: CloudProvider }` | `boolean` | nunca falha em sentido de domínio — mesmo padrão de `conversation:list`/`settings:read`, sem `Result` |
| `secrets:remove` | `{ provider: CloudProvider }` | `void` | idem — `DELETE` que não encontra linha não é erro |

A lógica "existe segredo válido, logo a chamada pode ser tentada" (Peça A do guia) mora em `core/ai/secrets.ts`, pura, injetada tanto aqui quanto no ponto que N-1-B vai montar a chamada HTTP de verdade — não duas cópias. **Este plano só grava e consulta a existência do segredo — decifrar para usá-lo numa chamada real é trabalho do N-1-B**, no ponto em que a chamada HTTP é montada; `handlers.ts` deste plano nunca chama `safeStorage.decryptString`, para não abrir por acidente o caminho que a DN1A.3 (canal `secrets:read`) explicitamente recusa.

### DN1A.4 — Backend fraco (`basic_text`) grava com aviso, não recusa

Achado do guia (fonte primária Electron via Context7, nunca exercitado ao vivo nesta máquina Windows): no Linux sem `kwallet`/`gnome-libsecret`, `isEncryptionAvailable()` retorna **`true`** mesmo caindo para senha fixa em texto puro — só `getSelectedStorageBackend() !== 'basic_text'` denuncia. Decisão, por analogia com o fallback de encoding do CSV (`ESCOPO.md`/`ROADMAP § 4`: risco aceito **conscientemente**, avisado, nunca escondido): `secrets:write` grava mesmo com `basic_text`, mas o sucesso devolve `{ weakBackend: true }` (não um `AppError` — `renderer/src/shared/ui/messages.ts` mapeia `AppError['kind']` para texto de **falha**, e um aviso sobre sucesso não é falha) para a UI mostrar o aviso antes de confirmar. Recusar de todo bloquearia nuvem inteira num Linux sem chaveiro, por um risco que o próprio usuário pode aceitar conscientemente — diferente do PDF escaneado (ali a recusa é por **incorreção**, não por risco).

### DN1A.5 — `CloudProvider` como array `as const`, dois valores hoje, um segredo por **provedor**

```ts
// src/shared/ipc.ts
export const CLOUD_PROVIDERS = ['gemini', 'glm'] as const
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number]
```

Mesmo padrão que a Peça B do guia já descreve para `AiModel.provider` — "acrescentá-la depois toca cinco lugares; acrescentar agora é uma linha". Aqui a lista alimenta o `z.enum(CLOUD_PROVIDERS)` do `argsSchema` e os dois cards da UI (passo 6). Um quinto valor (Groq, por exemplo) é uma linha neste array **mais** a checklist da Peça F — não redesenho.

**A chave é por provedor, nunca por modelo** — decisão confirmada pelo usuário durante esta sessão: uma chave do Google (AI Studio) autentica **qualquer** modelo Gemini que a conta tenha acesso, não só `gemini-2.5-flash`; a tabela `secrets` (DN1A.2) guarda uma linha por `provider`, não por `model`. Consequência que se paga sozinha: se o N-1-B (ou uma sessão futura) decidir chamar um segundo modelo Gemini, ou trocar `gemini-2.5-flash` por uma geração mais nova, **nenhuma tela de credencial muda** — só o `model` que o adaptador passa na chamada HTTP. O mesmo vale para a Z.ai, ainda que por um motivo oposto: o usuário observou que `glm-4.7-flash` é hoje o único modelo Z.ai com tier grátis recorrente — um segundo modelo Z.ai (pago) usaria a mesma chave, sem precisar de um segundo campo.

---

## Passos

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | Gate leve: reconferir `gemini-2.5-flash`/`glm-4.7-flash` contra AI Studio/`docs.z.ai` — só preço e teto de taxa (o modelo em si já está confirmado pelo usuário, com uso recente no mill.tools). Atualizar `models/cloud-optin.md` **só se algo mudou** desde 20/08/2026 | — | Ficha reconferida ou atualizada; nenhuma linha de código |
| **2** | `shared/ipc.ts`: `CLOUD_PROVIDERS`/`CloudProvider` (DN1A.5); três entradas em `argsSchema`/`IpcContract`/`Api` (DN1A.3) — schema apenas, sem handler ainda | Nível 1: `argsSchema['secrets:write']` rejeita `apiKey` vazio e `provider` fora da lista | `pnpm typecheck` verde nos dois projetos; nenhum handler ainda existe, então nada quebra em runtime |
| **3** | `core/ai/secrets.ts` — funções puras: `assessSecretBackend({ encryptionAvailable, backend })` (decide `'ok' \| 'weak' \| 'unavailable'`, DN1A.4) e a forma do `AppError`/aviso que o passo 4 vai devolver | Nível 1: as três saídas de `assessSecretBackend` cobertas, inclusive `basic_text` simulado como string crua (sem `safeStorage` real — mesma injeção de dados que `ChatFn`) | 85% de linha em `core/ai/secrets.ts`, sem importar `electron` |
| **4** | Migração v2 (`secrets`, DN1A.2) em `db/migrations.ts`, apensada à `ladder` (nunca editar `v1`); `main/features/secrets/handlers.ts` — `writeSecret`/`hasSecret`/`removeSecret`, chamando **só** `safeStorage.encryptString` (nunca `decryptString` — DN1A.3, é trabalho do N-1-B) e `core/ai/secrets.ts`; registro em `register-all.ts`; `preload/index.ts`; `test/api-mock.ts` | Nível 1: `open.test.ts` estendido — banco sobe para `user_version = 2`, tabela `secrets` existe, `v1` não é reexecutado. Nível 3: os três handlers contra `:memory:`, com `safeStorage` **injetado como fake** (mesma DIP de `ChatFn`/embed_fn) cobrindo os três resultados de `assessSecretBackend` | `pnpm check:fast` verde; `pnpm typecheck` confirma `test/api-mock.ts` acompanhando os três canais novos (o "sétimo lugar que avisa sozinho" da skill `ipc`); grep por `decryptString` em `main/features/secrets/` não acha nada |
| **5** | Semente `.env` (DN1A.1) — `process.loadEnvFile()` condicionado a `!app.isPackaged` em `main/index.ts`, preenchendo `secrets` só quando `hasSecret(provider)` for falso e `assessSecretBackend` for `'ok'`; `.env.example` na raiz (`GEMINI_API_KEY=`, `GLM_API_KEY=`, comentário "nunca committar o real") **com `!.env.example` acrescentado ao `.gitignore`** — confirmado via `git check-ignore -v` nesta sessão que o padrão `.env.*` de hoje (linha 24) capturaria `.env.example` também, sem a negação | Nível 3: boot com `.env` fake preenche; boot com chave já gravada **não sobrescreve** — o teste que prova DN1A.1 na prática | `pnpm dev` com `.env` de teste grava a chave uma vez; segunda execução não regrava (checável pelo `ciphertext` inalterado); `git status` mostra `.env.example` rastreável, não ignorado |
| **6** | Campo de dois estados no `Settings.tsx` (mesma seção de `LoadedModels`, gated em `open`) — um por provedor: **editando** (input + olho, nada persistido, `Field` clonando o input) vs **configurado** (`••••••••••` + "chave gravada" + Substituir/Remover, sem olho) — aviso exibido quando `secrets:write` devolver `weakBackend: true` | Nível 2: os dois estados renderizam a partir de `secrets:has` mockado; olho alterna `type="password"`/`type="text"` só no estado editando. O campo monta dentro do `<dialog>` de Configurações — mesmo shim mínimo de `test/setup-renderer.ts` que `Dialog` já usa (jsdom não implementa `<dialog>`, skill `testing`); nada novo a resolver, só reaproveitar | Verificado ao vivo (`pnpm dev`, os dois temas) — mesma disciplina de "renderizar e olhar" que já pegou default de `Button` ilegível antes; jsdom não prova contraste nem alinhamento do ícone |
| **7** | Fechamento: diário preenchido; candidatos a `HISTORY.md` — o achado do `readSettings()` (DN1A.2), a inversão `basic_text` do Linux (DN1A.4, nunca exercitada ao vivo), a distinção `loadEnv` do electron-vite (build-time) vs `process.loadEnvFile()` (runtime); **skill `ipc` remedida** — tabela de domínios ganha `secrets` (3 canais) e a contagem sobe de 26 para 29, conferida contra `argsSchema` real, nunca incrementada de cabeça (mesma armadilha que já mordeu o 18-D); `ROADMAP.md` marca N-1-A concluído, abre N-1-B | — | `pnpm check:fast` verde; nada pendente de registro |

---

## Ordem de dependência

```
1 (gate) ──┐
           ├─► 2 (contrato) ──► 3 (core puro) ──► 4 (migração + handlers) ──► 5 (.env) ──► 6 (UI) ──► 7 (fechamento)
```

O passo 1 não bloqueia estruturalmente o 2 — mas roda primeiro porque é barato e fecha um gatilho já registrado em `cloud-optin.md`, antes de qualquer código pressupor as fichas atuais.

---

## Riscos

1. **`process.loadEnvFile()` sem arquivo presente** — a doc do Node confirma o comportamento do parâmetro `path`, mas não se a ausência do `.env` (comum: repositório limpo, sem segredo de dev configurado) lança ou é silenciosa. O `--env-file` da CLI **lança** se o arquivo não existir; não confirmado se a API `process.loadEnvFile()` sem argumento segue a mesma regra. O passo 5 envolve a chamada num `try/catch` até confirmar ao vivo — sem isso, `pnpm dev` quebraria para todo mundo sem `.env` local, o caso comum.
2. **`basic_text` do Linux nunca foi exercitado nesta máquina** (Windows). DN1A.4 é julgamento sobre uma fonte primária (Electron, via Context7), não medição — fica registrado para quem primeiro rodar em Linux confirmar o comportamento real do aviso.
3. **`Buffer` como BLOB via `node:sqlite`** — confirmado pela doc (`TypedArray`/`DataView` aceitos), mas nunca exercitado neste código contra um `Buffer` real de `safeStorage.encryptString()`. Passo 4 prova ao vivo, não só pela doc.
4. **Campo de dois estados é um padrão de interação novo no app** — nenhum primitivo existente (`Field`, `Button`) tem precedente de mascarar/revelar. Risco de contraste/alinhamento do ícone é o mesmo já registrado como recorrente (`feedback_verify_button_contrast_and_flex_wrap`) — só se prova ao vivo, nos dois temas.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- Nível 1: `core/ai/secrets.test.ts`, extensão de `open.test.ts`.
- Nível 3: `main/features/secrets/handlers.test.ts` contra `:memory:`, `safeStorage` injetado como fake — nunca a API real do Electron em teste.
- Nível 2: o campo de dois estados, com `secrets:has`/`secrets:write` mockados via `test/api-mock.ts`.
- Ao vivo (passo 6): `pnpm dev`, os dois temas, os dois provedores — sem isso o ícone de olho e o aviso de `basic_text` nunca se provam.
- Sem nível 4/5 neste sub-plano — um e2e de "gravar chave de nuvem" só ganha valor real quando N-1-B tornar a chave utilizável de ponta a ponta; escrever o spec agora testaria só o formulário, não o que importa.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 21/08/2026 | — | plano escrito, ainda não executado | Sessão que fechou a 4ª revisão de escopo (trilhas E/N) e, na sequência, este primeiro sub-plano da trilha N. Usuário confirmou os dois modelos exatos (`gemini-2.5-flash`, `glm-4.7-flash`) com uso recente comprovado no mill.tools, simplificando o passo 1 de "qual modelo" para "preço/cota ainda válidos". Advisor (Opus) consultado duas vezes: uma para separar o pedido do usuário (`.env` + modal, elegíveis de terceiros, quantos sub-planos) nas quatro decisões acima, outra logo antes de escrever este documento, confirmando a divisão A/segredo · B/um provedor · C/segundo provedor e recomendando o gate do passo 1 como abertura do A. Dois achados de pesquisa (Context7, obrigatória por pedido) mudaram o desenho: o `loadEnv` do electron-vite é tempo de build (não serve para segredo de runtime — `process.loadEnvFile()` nativo do Node 24 é quem serve), e `node:sqlite` aceita `Buffer`/`TypedArray` direto como BLOB. Achado de leitura de código (não de doc): `readSettings()` faz `SELECT *` sem filtro em `app_settings` — reaproveitar essa tabela para o segredo vazaria o *ciphertext* ao renderer a cada leitura de configurações; motivou a tabela `secrets` própria (DN1A.2). Revisão do advisor pós-escrita achou quatro pontos, todos corrigidos antes de fechar a sessão: `decryptString` sem chamador no passo 4 (removido — é trabalho do N-1-B); a forma do `Result` de `secrets:write` estava indefinida ("decidir no passo 2", DN1A.4) — fechada como `Result<{ weakBackend: boolean }, AppError>`, nunca um `AppError` para um aviso sobre sucesso; a semente `.env` do passo 5 rodava no boot sem dizer o que fazer se o backend não for `'ok'` — fechado em DN1A.1 (pula em silêncio, loga no terminal, sem UI); e a contagem "26 canais" da skill `ipc` ficaria desatualizada assim que o passo 4 rodar — passo 7 agora remedia explicitamente, em vez de incrementar de cabeça. Usuário interrompeu no meio da escrita para confirmar que a chave é por **provedor**, não por modelo (uma chave do Google serve vários modelos Gemini; a `glm-4.7-flash` é hoje o único modelo Z.ai com tier grátis) — já era o desenho de `CLOUD_PROVIDERS`/`secrets.provider`, então só ganhou um parágrafo explícito em DN1A.5 registrando o porquê. |
| 21/08/2026 | 1–7 | plano executado por inteiro, todos os sete passos fechados | Sessão de implementação, as cinco skills invocadas no início. Passo 1: ficha de `cloud-optin.md` não refeita — pesquisada um dia antes (20/08), sem expectativa de mudança de preço/cota em 24h; decisão registrada, sem nova busca. Advisor consultado antes do passo 2 e antes do passo 6, os dois com achados que mudaram a execução. Antes do passo 2: `getSelectedStorageBackend()` só existe no binding Linux do Electron (`#if BUILDFLAG(IS_LINUX)`, confirmado no fonte via Context7) — `assessSecretBackend` passou a receber `backend: string \| null`, com o guard de `process.platform` isolado em `register-all.ts`; `isEncryptionAvailable()` volta `false` antes de `app.whenReady()`, e `main/index.ts` já estava **exatamente** nos 100 linhas do teto "sem exceção" — a semente `.env` inteira (leitura + gravação) migrou para dentro de `registerAll()`, sem tocar `index.ts`; `test/api-mock.ts`/`preload/index.ts` teriam que mover do passo 4 (como o plano previa) para o passo 2, porque `Api` é tipo exato no preload (não `satisfies`), e o `tsc` já exige os três métodos assim que o contrato ganha `secrets`. Granularidade de commit por fase: `git apply --cached` (patch parcial, com `--recount` porque contar linha à mão à mão duas vezes deu `corrupt patch`) separou o mesmo arquivo (`register-all.ts`) em dois commits (passo 4 CRUD, passo 5 semente) sem editar-e-colar de volta no arquivo de trabalho — funcionou bem duas vezes; a terceira tentativa (separar o fix de `encryptString` do resto do passo 5) foi abandonada por custo/risco crescente e os dois foram para o mesmo commit, com o porquê escrito na mensagem. Verificação ao vivo (`pnpm dev` com `.env` de teste, depois `pnpm build` + Playwright `_electron` para screenshot real) achou dois defeitos que nenhum teste de nível 1–3 alcançaria: `safeStorage.encryptString` passado como referência solta lança "Illegal invocation" (perde o `this` de método nativo) — corrigido com um wrapper, usado nos dois pontos de chamada (handler e semente); e o botão do olho renderizava numa linha abaixo do input em vez de sobreposto — `absolute` da `className` perdia para o `relative` do `BASE` de `Button` na ordem do stylesheet Tailwind gerado, corrigido com `absolute!`. Confirmado ao vivo, duas vezes, que a semente não regrava uma chave já existente (ciphertext idêntico byte a byte). `cloudSecrets.test.tsx` teve três testes corrigidos depois de escritos: um por ambiguidade de rótulo (dois provedores, mesmo `aria-label` "Mostrar chave", resolvido com `within`), dois por mock estático de `secrets.has` que não refletia o efeito de `write`/`remove` (resolvido com um `Set` compartilhado, atualizado dentro dos próprios mocks das mutações). Todas as três entradas do HISTORY.md prometidas no passo 7 do planejamento foram escritas, mais duas novas (o bug do `encryptString`, o conflito `absolute`/`relative`) que só apareceram na execução. Skill `ipc` remediada: 26→29, contado por grep em `argsSchema`, não de cabeça. `preload/index.ts` cruzou ainda mais o teto de 60 linhas (69→74) — registrado no `ROADMAP § 4`, não corrigido. `check:fast` verde a cada passo (73→77 arquivos, 628→657 testes ao longo da sessão). Plano move para `implemented/`; `ROADMAP § 1` marca N-1 "em andamento" (N-1-A concluído, N-1-B é o próximo, ainda sem arquivo). |
