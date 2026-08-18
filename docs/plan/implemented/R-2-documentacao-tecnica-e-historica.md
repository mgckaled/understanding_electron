# R-2 — Revisão da documentação técnica e histórica

**Entrega:** `README.md` raiz, `docs/README.md`, `docs/HISTORY.md` (mais um `docs/HISTORY-archive.md` novo), `docs/ROADMAP.md`, `CLAUDE.md` e as 4 skills técnicas (`architecture`, `design-system`, `ipc`, `testing`) sincronizados com o estado real do projeto — desatualização corrigida, redundância reduzida a citação, e o `HISTORY.md` de volta a um tamanho que uma sessão consegue ler sem custar uma fração relevante do próprio contexto.

> Segundo da **trilha R (refatoração)**, transversal ao arco: não constrói feature, leva um padrão já decidido ao que precede. `R-1` aplicou a convenção de comentário a `src/`; este aplica atualidade + fonte única à documentação. Numeração própria, como DS e F.
>
> **Aceite global: `git diff --stat -- src/` vazio em todo commit.** Este plano é só documentação — qualquer toque em código de produção é escopo vazado.

---

## O caso — por que este plano existe

`docs/HISTORY.md` chegou a ~184 mil caracteres (~45-50 mil tokens), grande o bastante para custar uma fração relevante do contexto de qualquer sessão que precise consultá-lo. A auditoria motivada por essa constatação achou mais: `README.md` raiz não é tocado desde 10/ago/2026 (antes de Tailwind, da skill `comments`, dos planos 15-17 e da revisão de identidade multiuso); as skills `ipc` e `architecture` documentam contrato que os planos 16/17 já mudaram (contagem de canal errada, domínio `image` ausente, protocolo `attachment://` não documentado); a skill `architecture` duplica quase palavra-por-palavra uma seção que ela mesma diz ter cedido à skill `ipc`; a skill `testing` renarra ao vivo cinco achados que o próprio `HISTORY.md` já registra e cita por título.

Decisão tomada com o usuário: o mecanismo para o `HISTORY.md` é **comprimir + arquivar por trilha fechada**, espelhando `plan/{active,implemented,archive}`. Medição prévia (linha a linha, não por amostra): a seção "Entregas (marcos)" tem 77.215 caracteres (cada entrada, hoje, um único parágrafo denso violando a própria regra do arquivo de 3-8 linhas); "Decisões arquiteturais", 19.113 caracteres, já no formato citável correto; "Armadilhas diagnosticadas", 80.569 caracteres — a maior seção, **não** uniformemente enxuta (média 1.645 caracteres/entrada, algumas com 700+ palavras). Marcos e armadilhas levam réguas de compressão diferentes por isso.

---

## Estrutura de arquivamento

**Um arquivo novo: `docs/HISTORY-archive.md`.** Espelha as duas seções do `HISTORY.md`; só recebe o que pertence a uma trilha **inteiramente fechada** — fundação (fases 00-08), trilha DS (DS-1 a DS-5 + o marco-semente "Tailwind v4 entra"), trilha R (R-1) e trilha F (F-1). Cabeçalho: nota de que é registro de trilhas encerradas, que `HISTORY.md` é a fonte para tudo ativo, e que link interno ali não se conserta depois de escrito (mesma regra de `plan/archive/`).

**Critério do que fica**, validado contra o `ROADMAP § 2` (toda seção que ele cita por título já pertence ao conjunto "fica"): o arco 10-17 inteiro, os dois nascimentos de skill (`comments`, `ipc`), e a revisão de identidade multiuso. A Fase 10 fica apesar de `plan/active/README.md` agrupá-la visualmente com a fundação — critério é citação viva (D10.1 citada por três entradas que ficam), não a categorização de outro índice.

**Regra dura:** nunca reescrever o texto de um `### título` ao mover — a âncora deriva dele, então mover vira troca de caminho (`HISTORY.md#slug` → `HISTORY-archive.md#slug`), nunca slug novo. Compressão toca só o corpo. `HISTORY.md` também tem links de fragmento **sem prefixo de arquivo** entre entradas (`](#slug)`) — `grep -n '\](#' docs/HISTORY.md` antes de cada commit de migração, além do grep por `HISTORY.md#`/`HISTORY.md) §`.

**Cada trilha migrada é um commit só** — corpo saindo, corpo entrando comprimido com heading intacto, toda referência cruzada corrigida, tudo junto. Nunca um checkpoint com conteúdo ausente dos dois arquivos, ou presente nos dois.

---

## Passo 0 — Nascimento do plano

Este arquivo, mais a linha `R-2` no `ROADMAP § 1`. Nenhuma outra edição.

## Passo 1 — `CLAUDE.md` ganha o checklist de auto-conservação

Primeiro, não por último — é a única parte que precisa sobreviver a uma execução interrompida no meio, e os passos 2-15 se testam contra ela em vez de a afirmarem sem prova. Parágrafo curto em "⚠️ Registro de trabalho", logo após "Escalonamento", distinguindo dois tipos de deriva: (a) nome/caminho que mudou — grepável no momento do rename; (b) contagem que envelheceu — só se corrige remedindo, nunca copiando de outro documento.

## Passo 2 — `docs/README.md`

Corrige a inversão factual (tabela do `CLAUDE.md` é hoje a mais completa, não a resumida). Acrescenta linha "ferramentas do chat".

## Passo 3 — `README.md` raiz

Tagline sincronizada com a frase-síntese multiuso; `Estado atual` corrigido (15/16/17 e trilha DS); Stack ganha Tailwind; badges cloud param de sugerir integração existente; seções duplicadas do `ESCOPO.md` encolhem a ponteiro; "Princípio de trabalho" encolhe a ponteiro ao `CLAUDE.md`; tabela Documentação ganha as 5 skills.

## Passo 4 — `HISTORY-archive.md` nasce + fundação relocada

11 marcos da fundação, comprimidos, heading intacto. `docs/README.md` passa a citar o arquivo novo. Grep e conserto de referências.

## Passo 5 — Trilha DS relocada

"Tailwind v4 entra" + DS-1..DS-5. Corrige citação "acima" em `Decisões arquiteturais § tokens em CSS`.

## Passo 6 — Trilhas R + F relocadas

R-1 e F-1. Este próprio arquivo (nascido no Passo 0) passa a citar `plan/implemented/R-1-comentarios-e-tsdoc.md` diretamente, nunca o marco.

## Passo 7 — 13 armadilhas de trilha fechada relocadas

7 (F-1/DS sem citação viva) + 6 (fundação sem citação viva). Corrige citação cruzada "Token de cor → lista branca de esquemas". `HISTORY.md § Armadilhas` ganha nota da régua de compressão nova.

## Passo 8 — 36 armadilhas que ficam, comprimidas

Régua nova: número medido + mecanismo + conserto sobrevivem, narrativa de investigação sai. Maior passo — pode dividir em 8a/8b (cluster planos 15-17 primeiro) como commits sequenciais do mesmo passo.

## Passo 9 — Marcos que ficam, comprimidos — lote 1

Identidade multiuso · plano 17 · plano 16 · fase 15 · IPC ganha skill · modelos em memória · três defeitos do 15 · frota dobra. Citação de `Dxx.y` no lugar de reexplicação.

## Passo 10 — Marcos que ficam, comprimidos — lote 2

Fase 14 · segunda classe de arquivo · fase 13 · rename `crivo` · fase 12 · a virada · fase 11 · fase 10 · comentário/docstring ganham skill.

## Passo 11 — Skill `ipc`

Contagem 22→24 (recontar em `src/shared/ipc.ts`), domínio `image` incluído, `§ Payload binário` cita o protocolo `attachment://` (D17.6) como resposta existente.

## Passo 12 — Skill `architecture`

Remove tabela `Result` duplicada. Corrige `features/open-dataset` → `features/attachment`. Atualiza exemplo `MessagePart`. `§ Convenção de idioma` fica (delegação explícita do `CLAUDE.md`).

## Passo 13 — Skill `design-system`

Seção Tailwind nova. Corrige "seis primitivos em CSS Modules" (hoje só `Dialog`/`Popover`/`MarkdownMessage`). `MarkdownMessage` entra como sétimo caso. Comprime/remove trechos redundantes.

## Passo 14 — Skill `testing`

Contagem de teste remedida (`pnpm test`, não copiada deste plano). 5+3 achados duplicados viram citação de uma linha.

## Passo 15 — Fechamento

Diário preenchido (inclusive se o checklist do Passo 1 pegou algo de verdade nos passos 2-14), plano movido para `implemented/`, entrada própria no `HISTORY.md`, `pnpm check:fast` verde, `advisor` chamado com o resultado final.

---

## Decisões

- **R2.1 — Comprimir + arquivar, não só um dos dois.** Só comprimir deixa o arquivo crescendo sem teto outra vez; só arquivar preserva a duplicação com o plano linkado. As duas juntas resolvem tamanho e fonte única ao mesmo tempo.
- **R2.2 — Réguas de compressão diferentes para marcos e armadilhas.** Marcos já tinham regra própria (3-8 linhas) nunca seguida; armadilhas nunca tiveram regra e não cabem na mesma, por carregarem número medido + mecanismo + conserto que o formato de marco não prevê.
- **R2.3 — Critério de arquivamento é citação viva, não a categorização de outro índice.** Validado contra `ROADMAP § 2`; a Fase 10 é o caso que prova a diferença (fica, apesar de agrupada com a fundação em `plan/active/README.md`).
- **R2.4 — Heading nunca se reescreve ao mover.** Preserva âncora sem exigir reconstrução de slug; todo conserto de referência cruzada vira troca de caminho, nunca adivinhação.
- **R2.5 — Auto-conservação nasce primeiro (Passo 1), não por último.** É a única parte do plano que precisa sobreviver a uma execução interrompida, e os demais passos se testam contra ela em vez de a afirmarem sem prova.
- **R2.6 — `CLAUDE.md` fora da varredura de conteúdo.** Foi sincronizado na revisão de escopo "identidade multiuso", na mesma sessão que originou este plano — só ganha a regra nova do Passo 1.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 18/08/2026 | 1 | **Plano concluído, todos os 15 passos, um commit cada** (mais três de apoio: nascimento do plano, e dois de checkpoint pré/pós-compactação de contexto no meio do Passo 8). Sequência: `c2be3d2` (0) · `d4af098` (1, checklist auto-conservação) · `b5b8528` (2, docs/README.md) · `08eb867` (3, README.md raiz) · `39dad38` (4, HISTORY-archive.md nasce + fundação) · `b77810a` (5, trilha DS) · `21a8354` (6, trilhas R+F) · `dd6cfb0` (7, 13 armadilhas relocadas) · `e6025e7`+`d12957c` (8, 35 armadilhas comprimidas, dividido pela compactação no meio) · `2efdb20` (9, marcos lote 1) · `efaf679` (10, marcos lote 2) · `1005c6d` (11, skill ipc — 24 canais recontados) · `72d3f70` (12, skill architecture — duplicata removida) · `10f4628` (13, skill design-system — Tailwind v4 entra) · `c0d5450` (14, skill testing — contagem remedida). `HISTORY.md` caiu de ~184 mil para 77.681 caracteres (58% menor, medido com `wc -m` — `wc -c` conta byte, não caractere, e a diferença importa com acentuação em português), com 24.634 caracteres migrados para `HISTORY-archive.md`; nenhum `git diff --stat -- src/` não-vazio em nenhum commit. **O checklist do Passo 1 pegou algo de verdade, três vezes:** (a) rename — o grep de `open-dataset` no Passo 12 confirmou que só a skill `architecture` linha 61 tinha a referência morta, nenhum outro arquivo do repositório (a busca ampla evitou um conserto incompleto); (b) contagem — a recontagem ao vivo dos canais IPC no Passo 11 (`grep -c "handle("`) bateu com o valor já citado no anexo da auditoria, mas foi *verificada*, não copiada; a recontagem de `.module.css` no Passo 13 (`find`) confirmou os 3 componentes por medição própria; e a recontagem de teste no Passo 14 (`pnpm check:fast`) **achou algo que a auditoria não tinha quantificado**: a suíte já passa de 15s para ~50s, um drift real que só apareceu por medir de novo, não por reler o que já estava escrito. A régua se provou: sem ela, os três (b) teriam sido cópia às cegas de um número já citado em outro lugar deste mesmo plano.

**Correção pós-fechamento, achada pelo `advisor` na 2ª validação obrigatória:** o item 3 da Verificação ("a alternativa descartada sobrevive à compressão") não tinha sido conferido de fato nos Passos 9/10 — só citado como feito. Comparando `git diff d12957c efaf679 -- docs/HISTORY.md` entrada por entrada, seis marcos tinham perdido alternativa descartada e/ou o motivo do descarte durante a compressão: **Plano 16** (`dataset:attach` vs domínio genérico; remoção de `dataset:scan`/`useOpenDataset`), **Três defeitos do 15** (desabilitar opção que não cabe; filtrar em `main`), **Fase 10** (a alternativa de cor `#4c8dff`+`--gray-1`, medida e recusada — a mais grave, por ser rejeição contraintuitiva sem repetição em nenhum outro lugar), **Fase 14** (razão de ORM, atualização otimista, `refetchOnWindowFocus`), **Fase 13** (razão de Zustand e das props do `App.tsx`), **A virada** (razão da bancada de painéis descartada), **A segunda classe de arquivo** (razão de `.docx`/`.pptx`), **Fase 11** (razão do parser próprio) e **Comentário e docstring** (`@see`, alternativa inteira ausente). Todos restaurados nesta mesma sessão, num commit separado — lição de método: citar um item de verificação como feito não é o mesmo que executá-lo, e a régua "3-8 linhas, cite Dxx.y" não cobria por si só a regra mais antiga e mais dura do próprio `HISTORY.md` ("o que nunca pode faltar: a alternativa descartada e o motivo"). | Plano concluído — movido para `plan/implemented/`, sem pendência de retomada. |
