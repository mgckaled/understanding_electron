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

## Anexo — achados brutos dos agentes de auditoria (skills), para os Passos 11-14

Transcrito verbatim dos 3 agentes Explore desta sessão, antes de qualquer compressão do Passo 8 consumir contexto. Os Passos 11-14 acima já resumem a ação a tomar; este anexo é a fonte de detalhe (linha, contagem exata, trecho) caso a memória da conversa não sobreviva a uma compactação. **Pode ser apagado no Passo 15**, junto do resto do plano.

### Skill `architecture` (Passo 12)

**Desatualização concreta**
- Linha 61: o mapa da árvore do renderer lista `features/<assunto>/ conversation, open-dataset, settings`. `open-dataset` não existe mais — o plano 16 renomeou a pasta para `features/attachment/` (confirmado em `src/renderer/src/features/`: hoje é `attachment`, `conversation`, `settings`; HISTORY.md registra "`features/open-dataset/` vira `features/attachment/`"). Referência de caminho quebrada.
- Linhas 100–102: o exemplo que sustenta "tipo em `shared/ipc.ts` não implica canal" (`Conversation`/`Message`/`MessagePart` "sem schema zod e sem canal") descreve o estado da fase 13. Hoje `MessagePart` tem schema zod completo (`dataset`/`document`/`image`) e canal correspondente (`dataset:attach`, `document:attach`, `image:attach`) desde os planos 16/17. O princípio segue válido, mas o exemplo específico já não ilustra o estado atual — trocar por outro caso ou marcar como histórico explícito.

**Redundância — o achado mais concreto**
- Linhas 85–94 ("Erro é dado, não exceção") reproduzem quase palavra por palavra a mesma tabela, a mesma definição de `Result<T, E=AppError>` e o mesmo parágrafo sobre `ipcRenderer.invoke` rejeitando com `Error invoking remote method` que aparecem em `ipc/SKILL.md` linhas 42–55. Especialmente grave porque duas seções depois (linhas 96–98) a própria skill declara: "a régua de `Result` vs exceção... saíram daqui em ago/2026 para a skill `ipc`... Não há resumo aqui: fato duplicado é o que a regra de fonte única existe para evitar" — mas o resumo continua presente, acima dessa mesma frase. A seção 85–94 deveria virar um ponteiro para `ipc/SKILL.md`, igual ao que já acontece corretamente nas linhas 108 e 118.

**Conteúdo mal localizado (menor)**
- Linhas 124–126 ("Convenção de idioma") tratam de convenção de código genérica, mais afim ao `CLAUDE.md` ou à skill `comments` do que a decisão estrutural — **mas o `CLAUDE.md` já delega explicitamente a esta skill** ("Detalhe e armadilha diagnosticada: skill architecture"), então a decisão tomada no plano foi manter, não mover.

### Skill `ipc` (Passo 11)

**Desatualização concreta — a mais séria do conjunto**
- Linhas 106–119, tabela "Os 22 canais de hoje": contagem real hoje é **24** (`grep -c "handle(" src/main/ipc/register-all.ts` = 24; `argsSchema` em `src/shared/ipc.ts` também lista 24 entradas). A tabela **omite inteiramente o domínio `image`** (`image:pick`, `image:attach`), implementado desde o plano 17 com handlers próprios em `src/main/features/image/handlers.ts` e canal com `Result`, igual a `dataset`/`document`. O cabeçalho (linha 8: "nos planos 14–15") também não reflete que os planos 16 e 17 alteraram o contrato (novo domínio `document`, novo domínio `image`, `ai:chat` mudou de `ChatMessage[]` para `Message[]`).
- Linha 121: "O que de fato reabre o desenho é payload binário (plano 16, anexo)" trata o plano 16 como gatilho futuro/pendente — mas os planos 16 **e** 17 já estão em `plan/implemented/`. Mais grave: quando a questão de payload binário foi de fato resolvida, a solução não foi um canal IPC — foi um protocolo customizado `attachment://` (`src/main/attachments/protocol.ts`, `protocol.handle` + `registerSchemesAsPrivileged`, D17.6) que serve bytes ao `<img>` sem passar por `invoke`/JSON. Esse mecanismo — a resposta real à pergunta que a seção "Payload binário" (linhas 94–104) deixa em aberto — não é mencionado em lugar nenhum da skill.

**Verbosidade/ruído**: nada de peso — a skill é enxuta e aponta corretamente para fora em vez de duplicar (linha 23 cita ISP "registrada na skill `architecture`" em vez de reexplicar).

### Skill `design-system` (Passo 13)

**Desatualização concreta**
- Linhas 3 (frontmatter) e 101–103: afirma "os seis primitivos (Button, Field, Panel, Toolbar, Dialog, Popover)... em CSS Modules". Falso desde a trilha DS-1..DS-5: verificado por Glob + leitura de código, só `Dialog/Dialog.module.css`, `Popover/Popover.module.css` e `MarkdownMessage/MarkdownMessage.module.css` existem; `Button.tsx`, `Field.tsx`, `Panel.tsx`, `Toolbar.tsx` são 100% classes utilitárias Tailwind.
- Linha 49: "grep por `#` seguido de hex em `*.module.css` fora desse arquivo é o teste" descreve só metade do mecanismo atual. `guard.mjs` hoje também inspeciona `.tsx` (`isRendererTsx`) para valores arbitrários Tailwind (`bg-[#hex]`) — a skill não menciona essa segunda metade.
- A skill nunca cita a palavra "Tailwind" nem `@theme inline`/`@utility`/`tailwind.css`, apesar de cinco planos inteiros (DS-1 a DS-5) terem reconstruído a camada de estilo dos componentes sobre `tokens.css`. O cabeçalho (linha 8) só cita a fase 05, nunca a trilha DS.

**Redundância**: linhas 91–95 ("Controle que COPIA um valor...") reexplicam em prosa duas armadilhas (fase 13 e 14) antes de apontar para `HISTORY.md`, quando um resumo de 1 linha + citação bastaria.

**Conteúdo mal localizado**: linhas 111–113 ("Ref é prop comum desde o React 19") é convenção geral de React/TS, sem relação com token/primitivo — sem dono natural no projeto; decisão tomada no plano foi remover, não mover.

**Omissão notável**: `MarkdownMessage` existe em `shared/ui/` com `.module.css` por "limite físico" (mesmo motivo do `Dialog`), mas a skill não o menciona nem como sétimo componente nem como exceção à regra CSS Modules/Tailwind.

### Skill `testing` (Passo 14)

**Desatualização concreta**: linhas 100–102 citam "207 testes, 28 arquivos" e "15–19s... ao fim da fase 14" como se fosse o estado de referência do projeto. Planos posteriores já reportam 452 testes/49 arquivos (plano 17) — **remedir com `pnpm test` no momento de executar o passo, não copiar nenhum destes dois números**.

**Redundância (achado principal)**: as cinco descobertas de "o jsdom não é um navegador" (linhas 44–53) duplicam quase textualmente cinco entradas dedicadas em `HISTORY.md`, cada uma já citável por título/âncora:
- scroll assíncrono (skill linha 44) ≈ HISTORY "O evento `scroll` é assíncrono...";
- `<dialog>` no jsdom (skill linha 46) ≈ HISTORY "O jsdom não implementa `<dialog>`..." — frase "seria testar o shim" repetida quase idêntica nos dois lugares, mesmo arquivo (`HTMLDialogElement-impl.js`), mesma versão (30.0.1);
- animação (skill linha 52) ≈ HISTORY "`animationiteration` borbulha..." — mesmo `typeof window.AnimationEvent === 'undefined'`;
- `prefers-color-scheme` do Playwright (skill linha 50) ≈ HISTORY "O Playwright emula `prefers-color-scheme: light`...".
Mesmo padrão nas "Armadilhas" da skill (linhas 64–66 vazamento do asar ≈ HISTORY "`app.asar` empacotava..."; linhas 68–72 import de `electron` ≈ HISTORY "Import de `electron`..."; linhas 74–76 glob de `coverage.include` ≈ HISTORY "Glob de `coverage.include`...") — mesmos números, mesmos caminhos de arquivo, mesma narrativa, sem citação por id.

**Ruído**: o gap "jsdom não implementa X" é dito três vezes em detalhe crescente (frontmatter, título da seção, cada item).

**Ação**: comprimir a seção inteira (linhas 40–54) a 5 regras de uma linha ("comportamento X só se prova ao vivo, ver HISTORY §Y"), e as 3 armadilhas (asar/electron/coverage) a citação de uma linha cada — os alvos no `HISTORY.md` já foram mantidos vivos de propósito para isso (nenhum dos 6 está na lista de armadilhas migradas para o archive no Passo 7).

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 18/08/2026 | 1 | Passos 0-8 completos, um commit cada: `c2be3d2` (0, plano+ROADMAP), `d4af098` (1, checklist auto-conservação no CLAUDE.md), `b5b8528` (2, docs/README.md), `08eb867` (3, README.md raiz), `39dad38` (4, HISTORY-archive.md nasce + 11 marcos da fundação), `b77810a` (5, trilha DS — 6 marcos), `21a8354` (6, trilhas R+F — 2 marcos), `dd6cfb0` (7, 13 armadilhas de trilha fechada relocadas — corrigido no processo um lapso de heading sem sufixo "(ago/2026)"), `e6025e7` (8a, comprime as 14 primeiras das 35 armadilhas que ficam), `d12957c` (8b, comprime as 21 restantes — Passo 8 fechado). Sessão interrompida por compactação de contexto entre o 8a e o 8b; retomada com `docs/plan/active/R-2-...md` (diário + anexo) como fonte de verdade em vez da memória da conversa — o mecanismo funcionou, nada foi perdido. `git diff --stat -- src/` conferido vazio em cada commit; todos os headings de `### ` conferidos intactos antes de commitar o 8b. | **Passos 9-15 inteiros pendentes.** Passo 9 (marcos que ficam, lote 1 — arco pesado/recente: identidade multiuso · plano 17 · plano 16 · fase 15 · IPC ganha skill · modelos em memória · três defeitos do 15 · frota dobra) é o próximo. Depois: Passo 10 (lote 2), Passos 11-14 (as 4 skills — achados brutos no `## Anexo` acima, ainda não consumido), Passo 15 (fechamento, incluindo a 2ª validação obrigatória com advisor). **Regra que não pode ser esquecida ao retomar:** nunca reescrever texto de heading `###`, só o corpo; conferir `git diff --stat -- src/` vazio a cada commit; o Passo 1 (checklist de auto-conservação) já está no `CLAUDE.md`. |
