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
