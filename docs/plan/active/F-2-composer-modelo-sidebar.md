# F-2 — Composer, seletor de modelo e sidebar: acabamento e as três ferramentas do arco 21-23

> Segundo item da **trilha F (features avulsas, fora do arco)** — mesma numeração própria da [F-1](../implemented/F-1-marca-pensando.md), transversal como DS e R. Não é envelope puro (DS nunca constrói feature) nem refatoração (R garante zero mudança de comportamento): este plano adiciona controles novos (dois primitivos, `Switch` e `Slider`) e reestrutura a exibição de dado já existente (capabilities, cards de modelo, rail da sidebar). Um plano só, como o F-1; o próximo item desta forma não precisa inventar um terceiro prefixo.

**Origem:** `notes/rascunho_f-2.md` (+ `notes/a.png`, captura da tela "Context length" das configurações do Ollama, usada como referência de estilo para o slider). Rascunho do usuário — ajustes de estilização no composer (botão de anexo, seletor de modelo, seletor de contexto) e na sidebar retraída.

**Entrega:** dois primitivos novos em `shared/ui/` (`Switch`, `Slider`); o popover do `AttachButton` ganha uma seção "Ferramentas" com os três toggles do arco 21-23 (desabilitados, só visual — a lógica é de cada plano quando chegar); `ModelPicker` troca badges de texto por um esquema de sigla+ícone para as 6 capabilities do Ollama, os cards da lista viram de 2 linhas, e ganha uma seção "Nuvem (Opt-in)" com dois placeholders bloqueados; `ContextControl` troca o `<input type="number">` por um slider com marcações; a sidebar retraída ganha 4 botões funcionais. Nenhum canal IPC novo — é tela sobre dado que o app já busca.

---

## O que foi checado contra o código real antes de virar plano

O rascunho não é um guia de ferramenta externa como o da F-1, mas mistura pedido de estilo com pedido de dado — e nem todo "isso já deveria existir" se confirmou. Tabela de conferência:

| O rascunho pede/sugere | O que existe de fato |
|---|---|
| Botão de anexo com "mecanismo kebab" | Já existe — `AttachButton.tsx` (238 linhas) abre um `Popover` (CSS anchor positioning, `shared/ui/Popover/`) com 3 categorias (`Table2`/`FileText`/`Image`). O padrão de item (ícone → texto, `hover:bg-surface`) é o mesmo do menu kebab de `ConversationList.tsx` — comentário no próprio código já cita essa irmandade. Faltava só a seção "Ferramentas" e o 4º item "Código". |
| Slider de contexto "como nas configurações do Ollama" | `ContextControl` era um `<input type="number">` puro, clampado entre `MIN_NUM_CTX=1024` e `ceiling` no `onBlur`. Não existia nenhum primitivo de slider/range no projeto — construído do zero. |
| Sigla "T" para `tools` e "T" para `thinking` | Colisão real no rascunho. **Resolvido com o usuário**: `tools`→"TO", `thinking`→"TH" (siglas de 2 letras evitam a colisão sem inventar letra nova). |
| Sigla "A" para `chat`/`completion` | O código já **esconde** essa capability de propósito (`ModelSelector.tsx`, comentário: *"`completion` is on every model, says nothing, and is dropped"*). O usuário não pediu para reverter essa decisão ao resolver a colisão — este plano **manteve** `completion` fora da exibição, sem sigla "A". |
| "Memória" no card do modelo | Ambíguo no rascunho. **Resolvido com o usuário**: é o teto prático desta máquina — `contextCeiling(model, freeBytes, marginBytes)`, já calculado via `ceilingOf` e usado para decidir "não cabe". Não é `kvBytesPerToken` (o custo por token, que também existe em `core/ai/memory.ts` mas não foi o que o usuário pediu — esse número fica para um F-3, ver seção própria abaixo). |
| "4 objetos selecionáveis" em Arquivos, incluindo "Código" desabilitado | Confirmado que "Código" **não** está mecanicamente pronto por baixo do capô, ao contrário do que a tabela de formatos do `ESCOPO.md` linha 236 sugere à primeira leitura ("código-fonte, mesmo extrator de `.txt`"): o diálogo de arquivo do canal `document:pick` (`src/main/features/document/handlers.ts`) filtra só `['txt', 'md', 'pdf']` — nenhuma extensão de código-fonte passa pelo seletor de arquivo hoje. O item desabilitado não é enfeite; é honesto. Registrado como gap no `ROADMAP.md` (F2.8). |
| As 6 capabilities listadas (chat, tools, images, insert, embedding, thinking) | **Validado via web search** contra o código-fonte do `ollama/ollama` (`server/images.go`/`images_test.go`): as constantes são exatamente `CapabilityCompletion`, `CapabilityTools`, `CapabilityInsert`, `CapabilityVision`, `CapabilityEmbedding`, `CapabilityThinking` — bate com a lista do rascunho (rascunho chama `vision` de "images", mesmo nome que o código já usa em `hasCapability(model, 'vision')`). Nenhuma capability a mais confirmada na fonte. |

---

## Decisões

- **F2.1 — Siglas de 2 letras, sem tocar a decisão de esconder `completion`.** `vision`→"IM", `insert`→"IN", `embedding`→"E", `tools`→"TO", `thinking`→"TH" — as duas últimas resolvem a colisão de letra única sem inventar convenção nova. `completion` continua fora da lista exibida.
- **F2.2 — "Memória" é o teto, não o custo por token.** O card mostra `formatContext(ceilingOf(model))` como a leitura de "memória" pedida.
- **F2.3 — Rail retraído por render-prop, não por callback solto.** Mesmo precedente do `modelSelector: (budget) => ReactNode` do `Composer`/`ConversationView` (DS4.8). `Sidebar.tsx` ganha `collapsedRail?: (expand: () => void) => ReactNode`; `App.tsx` monta os 4 botões, incluindo uma **segunda instância** do componente `Settings` (self-contido) para o botão de engrenagem abrir direto. `app/` continua sem importar `features/`.
- **F2.4 — Ações diretas onde fazem sentido (decisão do usuário).** "+" cria conversa na hora; engrenagem abre Configurações direto; busca e conversas apenas expandem — os dois pedem espaço que o rail de 44px não tem para mostrar algo.
- **F2.5 — Marcações do slider são por modelo, não a régua fixa 4k–256k da captura do Ollama.** A frota real varia de teto treinado 32.768 a 131.072, e o mínimo real do app é `MIN_NUM_CTX=1024`, não 4096. Marcações: potências de 2 múltiplas de 1024 entre `MIN_NUM_CTX` e `ceiling`, mais o `ceiling` em si como última marca (nunca uma marca inalcançável) — a captura empresta o **estilo**, não a escala.
- **F2.6 — `Switch` e `Slider` nascem genéricos, para os planos 21-23 os herdarem.** Os três toggles de Ferramentas entram desligados e desabilitados, mas `Switch` recebe `checked`/`onChange`/`disabled` como props normais desde o início.
- **F2.7 — Régua de tamanho: dividir ao tocar, não depois.** Disparou duas vezes: `ModelSelector.tsx` cruzou ~350 linhas ao ganhar o `Slider` (passo 4) — `ContextControl`+`ContextSlider`+`contextTicks` saíram para `ContextControl.tsx` própria, `formatSize`/`formatContext` para `modelFormat.ts`; e o esquema de capability (passo 5) precisou de dois arquivos, não um, por um motivo diferente — `react-refresh/only-export-components` não deixa um arquivo exportar componente E função ao mesmo tempo, então `capabilities.ts` (lógica) e `CapabilityChip.tsx` (só o componente) nasceram separados desde a primeira escrita, mesmo padrão do F-1 (`useThinkingLoop.ts`/`ThinkingMark.tsx`).
- **F2.8 — Gap do pilar "Código" ganhou uma linha no `ROADMAP.md`** (decisão do usuário), em `§ 4 Pendências pontuais`.

---

## O que o plano não previu, e como foi resolvido

Duas descobertas no caminho, nenhuma delas visível ao planejar:

- **`<datalist>`/`<option>` carrega `role="option"` implícito.** A primeira versão do `Slider` usava o mecanismo nativo do Chromium (`list="..."` + `<datalist>`) para desenhar as marcas de tick no trilho — e isso **vazou** para qualquer `getAllByRole('option', { hidden: true })` de outro teste no mesmo DOM (o listbox de `ModelPicker` também usa `role="option"`), inflando a contagem de 2 para 10 num teste que não tinha nada a ver com o slider. Resolvido trocando por rótulos posicionados por `left: pct%` calculado a partir do valor real (nunca `flex justify-between`, que distribuiria igualmente marcas que são potências de 2 — não-lineares no eixo do trilho, o que deslocaria toda marca menos a primeira/última).
- **Commit no `onChange` de um range espancaria o IPC.** `onNumCtx` persiste via `updateSettings.mutate(...)` a cada chamada — e o `onChange` do React para `<input type="range">` mapeia pro evento nativo `input`, que dispara a cada passo de um arraste (podendo ser dezenas por gesto), não só ao soltar. O `Slider` ganhou um segundo callback, `onChangeCommitted` (mouseup/touchend/keyup/blur), e só ele chama `onNumCtx` — o `onChange` continua livre para mover a alça visualmente a cada passo. Mesma razão que já existia para o antigo `onBlur` do input numérico, só que expressa de outro jeito.

---

## Onde plugou no código real

| Arquivo | O quê |
|---|---|
| `shared/ui/Switch/Switch.tsx` (+ `.test.tsx`) | Novo — primitivo (passo 1) |
| `features/attachment/AttachButton.tsx` (+ teste) | Cabeçalhos "Arquivos"/"Ferramentas", item "Código", os 3 `Switch` (passo 2) |
| `shared/ui/Slider/Slider.tsx` (+ `.test.tsx`) | Novo — primitivo, com `onChange`/`onChangeCommitted` (passo 3) |
| `features/conversation/ContextControl.tsx` | Novo — saiu de `ModelSelector.tsx` (F2.7) já usando `Slider`; `ContextSlider`, `contextTicks` (passo 4) |
| `features/conversation/modelFormat.ts` | Novo — `formatSize`/`formatContext`, compartilhados entre `ModelSelector.tsx` e `ContextControl.tsx` (passo 4) |
| `features/conversation/capabilities.ts` | Novo — `CAPABILITY_META`, `capabilityChips()` (passo 5) |
| `features/conversation/CapabilityChip.tsx` (+ `capabilities.test.tsx`) | Novo — só o componente do chip (passo 5) |
| `features/conversation/ModelSelector.tsx` (+ teste) | Cards de 2 linhas, separador Locais/Nuvem, placeholders Gemini/GLM (passo 6) |
| `app/Sidebar.tsx` (+ teste) | `collapsedRail` render-prop (passo 7) |
| `features/conversation/NewConversationButton.tsx` | Variante `compact` (passo 7) |
| `src/renderer/src/App.tsx` (+ `App.test.tsx`, novo) | Monta os 4 botões do rail, incl. `<Settings />` duplicado (passo 7) |
| `docs/ROADMAP.md` | Linha sobre o gap do pilar "Código", `§ 4` (passo 8) |

Nenhum arquivo de `shared/ipc.ts`, `main/`, `core/` ou `preload/` mudou — tudo aqui é composição de dado já disponível no renderer, confirmado ao longo dos 7 passos.

---

## Verificação

- `pnpm check:fast` depois de cada passo — verde nos 7 passos de código.
- Nível 2 (jsdom) nos dois primitivos novos e em cada componente que passou a consumi-los.
- Verificação ao vivo (passo 8, em andamento): `pnpm dev`/`pnpm build` + Ollama real, nos dois temas.

---

## Fora do escopo deste plano — candidato a F-3

Durante a revisão, o usuário trouxe uma referência visual (captura de tela das configurações do Ollama: "Memória estimada para `qwen3:4b`") mostrando uma tabela por modelo — contexto (4k/8k/16k/32k/128k...) × cache KV aproximado × peso do modelo × total aproximado. É genuinamente diferente do que o F2.2 entrega: o card do `ModelPicker` mostra **um número** (`ceilingOf`, o teto que a decisão de orçamento já usa); esta tabela seria uma **função de consulta** — o usuário compara faixas de contexto contra memória antes de escolher, sem o app decidir nada por ele. Mesmo teste de pilar do `ESCOPO.md` (vive na tela, sem estado próprio fora da conversa), papel diferente do dado já mostrado.

Decisão: **deixar aberto para um F-3 ainda não escrito.** A matemática já existe pronta em `core/ai/memory.ts` (`kvBytesPerToken`, `residentBytes` — falta só variar `numCtx` por linha em vez de um valor só), então quando esse plano nascer não é trabalho de `core/` novo, só de tela — provavelmente um bloco a mais dentro do `Dialog` de Configurações, perto de `LoadedModels`, já que é informação por modelo, não por conversa.

---

## Validação com o advisor (Opus) — pendente, por decisão do usuário

O advisor esteve indisponível ("temporarily overloaded") nas duas tentativas feitas durante o planejamento. Por pedido explícito do usuário, a validação obrigatória do plano com Opus **não bloqueou o início da execução** — acontece **depois do passo 8** (QA ao vivo), antes de mover este plano para `implemented/` e fechar a entrada em `HISTORY.md`.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 18/08/2026 | 1 | Plano escrito: leitura do rascunho, 3 agentes de exploração em paralelo (composer/anexo, seletor de modelo/capabilities, sidebar/skills), validação da lista de capabilities do Ollama via web search contra o código-fonte, 4 perguntas de desambiguação respondidas pelo usuário (siglas, "memória", ações do rail, registro do gap de "Código"), advisor indisponível (decisão: validar só no fim). Execução dos passos 1-7 na mesma sessão, cada um com `check:fast` verde e commit próprio: primitivo `Switch`; seção Ferramentas no `AttachButton`; primitivo `Slider` (com `onChangeCommitted`, achado no caminho); `ContextControl` com o slider (achado: `<datalist>`/`<option>` vazava `role="option"` — trocado por posicionamento percentual; `ModelSelector.tsx` dividido em `ContextControl.tsx`+`modelFormat.ts` pela régua de tamanho); esquema de sigla+ícone das capabilities (`capabilities.ts`+`CapabilityChip.tsx`, separados pelo `react-refresh`); cards de 2 linhas + separador Locais/Nuvem; rail retraído da sidebar (`collapsedRail`, `NewConversationButton` ganhou `compact`, `App.test.tsx` novo). Linha do gap "Código" adicionada ao `ROADMAP.md` (passo 8, primeira metade) | passo 8: falta a verificação ao vivo (dois temas, Ollama real) e a chamada ao advisor antes de mover para `implemented/` |
