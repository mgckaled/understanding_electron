# R-6 — Nascimento da skill `ai` e alívio dirigido de `docs/`/`CLAUDE.md`

**Entrega:** `.claude/skills/ai/SKILL.md` nascido, dono de "o que decide a primeira linha ao tocar código de IA", ancorado em código real (não resumo de plano); `CLAUDE.md` aliviado das regras de escolha de modelo e do protocolo de sonda do Ollama; `docs/reference/reasoning/README.md` auditado — achado real (R6.5) reverte a hipótese do planejamento: **não** virou `⛔ consumido`, porque a seção da Interactions API segue sendo o único desenho de uma migração ainda não implementada; as quatro skills que tocavam IA e as duas tabelas de fonte única (`CLAUDE.md`, `docs/README.md`) ganhando ponteiro para a skill nova; `ROADMAP.md` registrando a compressão residual como **R-7**, ainda sem arquivo, com o efeito real do R-6 remedido (`CLAUDE.md` foi a 40,4 kB, não encolheu).

> Sexto da **trilha R (refatoração)**, mesmo gesto do `R-3` (nascimento da skill `data`), aplicado ao domínio de IA. **Aceite global: nenhuma linha em `src/` muda de comportamento** — `git diff --stat -- src/` fica vazio em todo commit deste plano. O que muda é documentação e o conteúdo de uma skill nova.

---

## O caso — por que este plano existe

Pedido explícito do usuário: a informação técnica de IA — motor local Ollama, provedores de nuvem opt-in (Gemini, GLM), orçamento de contexto, raciocínio/thinking visível do arco 21 — está pulverizada por `docs/plan/`, `docs/reference/models/`, `docs/reference/reasoning/`, `ESCOPO.md`, `ARMADILHAS.md`, `HISTORY.md`, `DECISOES.md` e `CLAUDE.md`, sem que nenhuma das seis skills existentes seja dona do assunto — confirmado lendo as seis por inteiro nesta sessão: `architecture` não toca IA; `comments`, `design-system` e `ipc` mencionam `ai:*`/`CapabilityChip`/`ModelSelector` só de raspão; `data` cita Ollama uma vez, a propósito de `memory_limit`; `testing` cita um bug de `.context_length` do Ollama como estudo de caso de teste vacuoso. O domínio já tem massa de código própria (`src/core/ai/`, `src/main/features/ai/`, ~4.650 linhas somando fonte e teste) e decisões estruturais citáveis (D9.1–D9.6, D15.x, D21A.x–D21C.x) sem skill dona — o mesmo perfil que fez nascer a skill `ipc` no vigésimo canal e a skill `data` no `R-3`.

**O nome exato no repositório é `ai`**, não "ia" — decisão do usuário, aplicada em todo este documento.

**Investigação feita antes de escrever este plano (não repetir na execução):**
- As seis skills lidas por inteiro (achado acima).
- Próximo número de trilha R confirmado como `R-6` (`R-1`..`R-5` já existem, todos em `implemented/`).
- Arquivos-fonte reais do domínio mapeados: `src/core/ai/{budget,memory,messages,models,types,upstreamError,reasoningText,secrets,dataCard,documentCard,proposal,chat}.ts`, `src/main/features/ai/handlers.ts`, `src/main/features/ai/providers/{ollama,gemini,glm}.ts`.
- Estado do arco 21 conferido ao vivo: 21-A e 21-B implementados; 21-C-A implementado **com** verificação ao vivo confirmada (sessão de 03/09/2026); 21-C-B e 21-C-C implementados, mas com "verificação ao vivo pendente — fica com o usuário", ainda em `plan/active/`. Nenhum dos três 21-C tem linha própria em `ROADMAP § 1` (segue dentro da linha 29, arco 21).
- Baseline de tamanho medido nesta sessão (ver Passo 1).
- Duas consultas ao `advisor` (Opus): a primeira validou a existência do plano e a fronteira com `reference/models/`; a segunda, pedida explicitamente pelo usuário, respondeu "o que pode aliviar de `docs/` e do `CLAUDE.md`" documento a documento.

**O critério de alívio, do segundo `advisor`:** uma passagem só migra para a skill se decide a primeira linha de código que alguém está prestes a escrever. O resto fica onde está — é escopo de produto, história ou armadilha diagnosticada — ou nunca foi duplicação.

---

## Passo 0 — Nascimento do plano

Este arquivo, mais a linha `42` — `R-6` no `ROADMAP § 1`.

## Passo 1 — Baseline datado, por seção

Bytes totais, medidos em 03/09/2026: `ESCOPO.md` 45.686 B, `ARMADILHAS.md` 110.911 B, `ROADMAP.md` 62.899 B, `DECISOES.md` 64.685 B, `CLAUDE.md` 39,2 kB (teto ~25 kB) — os quatro primeiros já acima do teto ~45 kB de `docs/README.md`.

Seções candidatas a alívio, citadas por título para a verificação de fechamento comparar seção a seção, não arquivo a arquivo (regra de auto-conservação (b) do `CLAUDE.md`: nunca copiar número sem remedir):
- `CLAUDE.md` § *Máquina e modelos locais* — parágrafo "Frota Ollama: 8 modelos distintos" (as quatro regras de escolha) e os dois avisos ⚠️ seguintes (sonda de um modelo por vez; `capabilities` vem do `/api/show`).
- `docs/reference/reasoning/README.md` — 22.445 B, hoje `✅ vivo` na tabela de `docs/reference/README.md`.

## Passo 2 — Nascimento da skill `ai`, com escopo nomeado por arquivo real

`.claude/skills/ai/SKILL.md` nasce dona de:
- **Provedor e streaming** — `src/main/features/ai/providers/{ollama,gemini,glm}.ts`, `src/main/features/ai/handlers.ts`: o formato de streaming de cada provedor, degradação graciosa (Gemini sem bloco de raciocínio dedicado, D21A.x), o que cada adaptador parseia de `done_reason`/`finish_reason`.
- **Orçamento de contexto e RAM** — `src/core/ai/budget.ts`, `memory.ts`: a família de decisões D15.x e D21C.x (âncora pós-fato, faixas fixas de contexto, `RAM_MARGIN_BYTES`).
- **Raciocínio/thinking** — `src/core/ai/reasoningText.ts`: o rename `ThinkingMark`→`RespondingMark` (F-1), o motivo de parada por janela esgotada (21-C-B), `exposesReasoning()` (`core/ai/models.ts`).
- **Modelos e capacidades** — `src/core/ai/models.ts`, `types.ts`: a tabela de capacidade, o gate vision×tools.
- **Mensagens e erro upstream** — `messages.ts`, `upstreamError.ts`, `secrets.ts`.
- **Cartões e proposta** — `dataCard.ts`, `documentCard.ts`, `proposal.ts` (cruza com `core/pipeline/steps.ts`, D9.4).

**Decisão R6.1 — a skill não absorve `docs/reference/models/`.** Aquele diretório continua dono da frota Ollama (peso, cache KV por faixa de contexto, papel de cada modelo) e do catálogo de nuvem (preço, teto de tier grátis) — `CLAUDE.md` já decidiu essa fronteira deliberadamente em ago/2026, com motivo registrado (`CLAUDE.md` é lido toda sessão; o detalhe de frota, não). Corte de três vias: `study/` = lido uma vez para entender · `reference/models/`, `reference/reasoning/` = consultado para lembrar um fato · skill `ai` = consultada para escrever código. `docs/reference/observatory/README.md` fica fora do domínio da skill, só ganha ponteiro cruzado (O-7/O-9 tocam desempenho por modelo).

## Passo 3 — Migração de conteúdo real

- `CLAUDE.md` § *Máquina e modelos locais*: as quatro regras de escolha de modelo e os dois avisos ⚠️ (protocolo de sonda, `capabilities`/`/api/show`) saem do arquivo e entram na skill; `CLAUDE.md` fica com um ponteiro de uma linha. **Não sai:** a tabela de CPU/RAM/GPU medida (fato de máquina sem dono melhor, já citada pela skill `data` para `memory_limit`) e as três linhas de § *Segurança* (níveis 1-2-3, segredo de mão única) — essas já têm dono (`ESCOPO.md`, `HISTORY.md`); a skill aponta, não reivindica.
- `docs/reference/reasoning/README.md`: auditado seção por seção contra o código real (`core/ai/models.ts`, os três adaptadores) — os headers já sinalizam perfil de investigação incorporada ("Estado atual do código", "A pergunta que dimensiona o arco — RESOLVIDA", "Verificações já feitas, não repetir"), o mesmo perfil de `cloud-optin-implementation-guide.md`, já `⛔ consumido`. Confirmando na execução, o documento é marcado consumido em `docs/reference/README.md`, e a regra viva que sobrar (a tabela das três APIs, os achados medidos) migra para a skill. ⚠️ **Revisado na execução — ver `R6.5`: a auditoria real não confirmou esta hipótese, o documento não virou consumido.**
- `ESCOPO.md` §§ *O que a IA vê do seu dado*, *gate de capacidade*, *o modelo carregado é recurso da máquina*: relidas antes de decidir — são escopo de produto ("o que o app faz"), candidatas a ponteiro, não a corte. A seção *o modelo carregado é recurso da máquina* (linha ~415) é a única a reler com atenção redobrada.
- `ARMADILHAS.md`, `HISTORY.md`, `DECISOES.md`: **sem corte.** `ARMADILHAS.md` é buscável por sintoma — a skill cita entrada por título, como `data`/`testing` já fazem. `HISTORY.md` é dono de narrativa. `DECISOES.md` é índice derivado: ganha linha(s) `R6.x`, não perde nenhuma `D9.x`/`D15.x`/`D21x` existente.

## Passo 4 — Ponteiros nas seis skills existentes

Precedente: `R-4` passo 6 (escopo negativo transversal). Cada uma ganha uma nota curta apontando "lógica do lado do provedor: skill `ai`", nenhuma reescreve conteúdo:
- `ipc` — linha `ai` da tabela de canais (`isAvailable`, `models`, `loaded`, `unload`, `chat`, `propose`).
- `data` — linha do `memory_limit`/"sem Ollama residente".
- `testing` — o caso do `.context_length` (teste vacuoso por ordem de chave favorável).
- `design-system` — `CapabilityChip`/`ModelSelector`.

## Passo 5 — As duas tabelas de fonte única

`CLAUDE.md` e `docs/README.md` (linhas 121–126 hoje) ganham a linha "Camada de IA (provedores, orçamento de contexto, raciocínio) → skill `ai`", no mesmo formato das seis linhas existentes.

## Passo 6 — Cláusula sobre a dívida de teto já registrada

`ROADMAP.md` linha 80 já registra a compressão dos cinco documentos estourados (`ARMADILHAS.md`, `CLAUDE.md`, `ROADMAP.md`, `DECISOES.md`, `ESCOPO.md`) como "um plano da trilha R", sem dono. Este plano **não reivindica** esse trabalho — relata, ao fechar, quanto os documentos tocados no Passo 3 encolheram como efeito colateral, e deixa registrado que a compressão residual continua pendente como **R-7**, ainda sem arquivo.

## Passo 7 — Registro do corte do arco 21

A skill documenta 21-A, 21-B, 21-C-A, 21-C-B e 21-C-C como implementados (citando a pendência de verificação ao vivo em 21-C-B/C-C, sem bloquear o nascimento da skill por isso). 21-D escreve **na** skill quando nascer, em vez de gerar mais um documento solto.

## Passo 8 — Avaliação da 8ª skill (`observatory`)

**Decisão R6.2 — não nasce agora.** A trilha O já fechou (O-1..O-8, ver `ROADMAP` linha 41), `docs/reference/observatory/README.md` já é dono único da fundamentação (6 eixos, 13 painéis, classes de custo/trabalho/situação, critério `crivo.db` vs. `observatory.db`), e os três painéis restantes (propostas, RAG, índices de ML) estão gatilhados sem data — mesmo padrão de "segundo chamador" que rege o nascimento de primitivo na skill `design-system`. Gatilho de reabertura, registrado aqui e não deixado implícito: quando um nono plano de observatório for de fato agendado.

## Passo 9 — Fechamento

Diário preenchido, plano movido para `plan/implemented/`, entrada em `HISTORY.md`, hook `guard` validado em cada `.md` tocado (nenhum link relativo para `.claude/skills/ai/SKILL.md` escrito antes de o arquivo existir), `advisor` chamado de novo com o resultado final.

---

## Decisões

- **R6.1 — A skill `ai` não absorve `docs/reference/models/`.** Fronteira deliberada: `CLAUDE.md` já decidiu manter a frota Ollama e o catálogo de nuvem fora de si em ago/2026, com motivo registrado. A skill nova respeita a mesma fronteira em vez de reabri-la — corte de três vias (`study/`/`reference/`/skill).
- **R6.2 — A 8ª skill (`observatory`) não nasce neste plano.** Trilha O fechada, dono de referência já existe, painéis restantes gatilhados sem data — mesmo critério de "segundo chamador" já em uso no projeto.
- **R6.3 — Sigla `R`, não `F`.** Reafirma `R3.1`: refatoração documental, zero mudança de comportamento do app.
- **R6.4 — `SKILL.md` de `ai` nasce só na sessão de execução deste plano.** A sessão que escreveu este arquivo (planejamento) não cria a skill nem toca `src/`, `.claude/skills/`, `ESCOPO.md`, `ARMADILHAS.md` ou `reference/`.
- **R6.5 — `docs/reference/reasoning/README.md` NÃO virou `⛔ consumido`, ao contrário da hipótese do Passo 3.** A auditoria seção por seção (pedida pelo próprio advisor: "não assuma a partir daqui") achou que a seção *A Interactions API* é o único desenho existente da migração do `gemini.ts` — trabalho **ainda não implementado** (`ROADMAP § 2`). Marcar o documento inteiro consumido teria enterrado a referência que essa migração futura vai precisar. Revisão adicional na mesma auditoria: a linha do documento que dizia "21-C verificado ao vivo no mesmo dia" contradizia o diário dos próprios planos `21-C-B`/`21-C-C` ("verificação ao vivo pendente — fica com o usuário") — corrigida para descrever a evidência real por sub-plano, não uma afirmação uniforme. A reversão da hipótese original é o achado mais citável desta execução, por isso registrada aqui e não só em mensagem de commit.

---

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 1 (03/09/2026) | Plano nasceu: seis skills lidas por inteiro (nenhuma dona de IA), próximo número de trilha confirmado (`R-6`), arquivos-fonte do domínio mapeados, estado do arco 21-C conferido, baseline de tamanho medido. Duas consultas ao `advisor` (Opus) — a segunda respondeu à pergunta do usuário sobre alívio de `docs/`/`CLAUDE.md`, documento a documento. Linha `42` acrescentada ao `ROADMAP § 1`. |
| 2 (03/09/2026) | Execução completa, um commit por passo. Passo 2: `.claude/skills/ai/SKILL.md` escrita lendo por inteiro os 13 arquivos-fonte do domínio (não resumindo plano) — fronteira injetável, orçamento de RAM/tokens, `ConversationWindow`, ancoramento pós-fato, tabela dos três provedores, erro upstream, mensagens/privacidade, proposta NL→passo. Passo 3: `CLAUDE.md` § *Máquina e modelos locais* aliviado (regras de escolha + protocolo de sonda migram); `docs/reference/reasoning/README.md` auditado seção por seção — achado real contradisse a hipótese do plano (R6.5): não virou consumido; `ESCOPO.md` ganhou ponteiro de uma linha, sem corte. Passo 4: ponteiros em `ipc`/`data`/`testing`/`design-system`. Passo 5: as duas tabelas de fonte única apontam pra skill nova, com a linha do plano 09 desmembrada (RAG/ML continuam lá, o resto foi pra skill). Passo 6: `ROADMAP.md` registra o efeito real remedido (`CLAUDE.md` 40,4 kB, não encolheu) e a dívida residual como `R-7`. Passo 7: seção final da skill registra o corte do arco 21 e o gancho pro 21-D. Passo 8: `R6.2` já decidido no planejamento, sem novo arquivo. Submissão da entrega completa ao `advisor` (Opus) antes do fechamento, por pedido explícito do usuário: achou duas pendências reais — a contradição do 21-C-B/C-C não resolvida (corrigida na própria `reference/reasoning/README.md`) e um terceiro valor de `Estado` introduzido sem legenda (revertido para `✅ vivo` plano, com o corte de escopo movido pra célula de descrição) — mais três ajustes menores na skill (colapsar duplicata `/api/tags`/`/api/show`, citar `ARMADILHAS.md` por título em quatro pontos, registrar `R6.5`). Todos aplicados antes deste fechamento. Pesquisa mandatória do usuário sobre convenção oficial de `SKILL.md` (Context7 + WebSearch, `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`): skill já conforme (remedido ao final: 154 linhas contra o teto de 500, descrição em terceira pessoa com gatilhos concretos, sem `claude`/`anthropic` no nome — o número mudou de 148 para 154 entre a checagem inicial e o fechamento, porque os ajustes pós-advisor entraram depois; citado aqui só depois de remedir de novo, auto-conservação (b)). Verificado a pedido do usuário: `21-A`/`21-B` (em `implemented/`) têm entrada em `HISTORY.md`; `21-C-A`/`21-C-B`/`21-C-C` seguem em `active/` e corretamente **sem** entrada — a regra do projeto é que a entrada nasce quando o plano sai de `active/` para `implemented/`, e mover esses três não é decisão do R-6 (verificação ao vivo pendente é do usuário). Passo 9: diário preenchido; plano movido para `plan/implemented/` (`git mv`); `ROADMAP.md` linha 42 atualizada — status e caminho no mesmo commit, evitando o link quebrado que o hook `guard` pegaria; `HISTORY.md` ganhou a entrada `R-6` no topo, empurrando `O-1` (a mais antiga das 10) para `HISTORY-archive.md`, mesma edição; `DECISOES.md` ganhou a linha `R-6`. |
