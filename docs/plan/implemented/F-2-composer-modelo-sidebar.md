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
| "Memória" no card do modelo | Ambíguo no rascunho. **Resolvido com o usuário**: é o teto prático desta máquina — `contextCeiling(model, freeBytes, marginBytes)`, já calculado via `ceilingOf` e usado para decidir "não cabe". Não é `kvBytesPerToken` (o custo por token, que também existe em `core/ai/memory.ts` mas não foi o que o usuário pediu — esse número fica para um F-4, ver seção própria abaixo). |
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

Três descobertas no caminho, nenhuma delas visível ao planejar:

- **`<datalist>`/`<option>` carrega `role="option"` implícito.** A primeira versão do `Slider` usava o mecanismo nativo do Chromium (`list="..."` + `<datalist>`) para desenhar as marcas de tick no trilho — e isso **vazou** para qualquer `getAllByRole('option', { hidden: true })` de outro teste no mesmo DOM (o listbox de `ModelPicker` também usa `role="option"`), inflando a contagem de 2 para 10 num teste que não tinha nada a ver com o slider. Resolvido trocando por rótulos posicionados por `left: pct%` calculado a partir do valor real (nunca `flex justify-between`, que distribuiria igualmente marcas que são potências de 2 — não-lineares no eixo do trilho, o que deslocaria toda marca menos a primeira/última).
- **Commit no `onChange` de um range espancaria o IPC.** `onNumCtx` persiste via `updateSettings.mutate(...)` a cada chamada — e o `onChange` do React para `<input type="range">` mapeia pro evento nativo `input`, que dispara a cada passo de um arraste (podendo ser dezenas por gesto), não só ao soltar. O `Slider` ganhou um segundo callback, `onChangeCommitted` (mouseup/touchend/keyup/blur), e só ele chama `onNumCtx` — o `onChange` continua livre para mover a alça visualmente a cada passo. Mesma razão que já existia para o antigo `onBlur` do input numérico, só que expressa de outro jeito.
- **Índice de marca no lugar do token bruto — tentado, revertido na revisão do advisor.** A QA ao vivo achou as marcas coladas no início do trilho (F2.5 embaixo) e a correção de primeira mão trocou o domínio do slider de token bruto para o ÍNDICE da marca (0..5), o que espaça toda marca igualmente por construção. O advisor (chamado ao final, D-padrão do plano) pegou o defeito real: uma conversa de antes deste controle pode ter `numCtx` em qualquer múltiplo de 1024 (ex. 12288), não só numa potência de 2 — a versão por índice arredondava a alça para a marca mais próxima (8192) enquanto o rótulo continuava lendo o valor real (12k), e um blur sem arraste nenhum bastava para persistir o valor arredondado via `onChangeCommitted`. É o exato defeito que o comentário do `ThreadsField` (`Settings.tsx`) já registra para "valor que predata um controle". Revertido: o domínio volta a ser o token bruto (idêntico ao `<input type="number">` que substituiu), e o amontoamento — que É um problema de RÓTULO, não de granularidade — foi resolvido por `thinLabels()` (mantém só marcas que não colidem, sempre com a primeira/última) mais o popover alargado (300px→360px, a pedido do usuário: preferir mais espaço a descartar marca).

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

- `pnpm check:fast` depois de cada passo — verde nos 8 passos de código (471 testes).
- Nível 2 (jsdom) nos dois primitivos novos e em cada componente que passou a consumi-los.
- **Verificação ao vivo (passo 8):** `pnpm build` + Playwright dirigindo o build (`_electron.launch`), Ollama real (frota de 7 modelos), roteiro descartável não commitado (mesmo raciocínio do F-1). Screenshots nos dois temas (`page.emulateMedia`) de: popover de anexo (Arquivos/Ferramentas, Código desabilitado, 3 switches desligados), popover de modelo (7 cards reais com sigla+ícone, separador Nuvem com Gemini/GLM bloqueados), slider de contexto (arrastado via teclado até o teto), rail retraído de 44px.
  - **Achado 1:** as marcas do slider (potências de 2) não são igualmente espaçadas num eixo linear de tokens — "1k" e "2k" ficavam coladas, e a marca da ponta empurrava a própria largura pra fora do popover. Nenhum dos dois aparece em `check:fast` (jsdom não mede layout real). Primeira correção (índice de marca) **revertida na revisão do advisor** por reescrever em silêncio o `numCtx` de conversas antigas — ver "O que o plano não previu" acima. Correção final: `thinLabels()` (rótulo, não granularidade) + popover alargado.
  - **Achado 2, revisão do usuário sobre os próprios screenshots:** cards de `ModelPicker` sem borda própria e o destaque de hover invisível — a cor de destaque (`bg-surface-raised`) era **idêntica** à cor de fundo do próprio popover (`Popover.tsx`), então o realce nunca aparecia sobre o próprio fundo. Corrigido dando a cada card uma borda (`border-border` em repouso, `border-border-strong` + `bg-surface` — um tom diferente do popover — em hover/destaque). O divisor Locais/Nuvem, pelo mesmo motivo de pouco contraste, subiu de `border-border`/`my-1` para `border-border-strong`/`my-2`.
  - **Achado 3, pedido do usuário:** o ícone de Configurações no rail retraído deveria ficar embaixo, não ao lado dos outros três — `App.tsx` ganhou um `<div className="mt-auto">` em volta da segunda instância de `Settings`, empurrando-o para o fim da coluna (`Sidebar.tsx` já renderiza o rail como `flex-col`, então `mt-auto` bastou, sem tocar `Sidebar.tsx`).
  - Achado do advisor, sem imagem: o aviso "O modelo atual não processa imagens" ficava colado ao item "Código" (que vem logo abaixo de "Imagens" no DOM), lido como se explicasse Código — movido para ficar imediatamente abaixo de "Imagens".
  - Nível 4 (`pnpm test:e2e`, `e2e/dev/attach-dataset.spec.ts`) rodado após a reestruturação do popover de anexo, por indicação do advisor — resultado registrado no diário desta sessão.

---

## Fora do escopo deste plano — candidato a F-4

Durante a revisão, o usuário trouxe uma referência visual (captura de tela das configurações do Ollama: "Memória estimada para `qwen3:4b`") mostrando uma tabela por modelo — contexto (4k/8k/16k/32k/128k...) × cache KV aproximado × peso do modelo × total aproximado. É genuinamente diferente do que o F2.2 entrega: o card do `ModelPicker` mostra **um número** (`ceilingOf`, o teto que a decisão de orçamento já usa); esta tabela seria uma **função de consulta** — o usuário compara faixas de contexto contra memória antes de escolher, sem o app decidir nada por ele. Mesmo teste de pilar do `ESCOPO.md` (vive na tela, sem estado próprio fora da conversa), papel diferente do dado já mostrado.

Decisão: **deixar aberto para um F-4 ainda não escrito.** ⚠️ Esta seção dizia "F-3" até 26/08/2026, quando a sigla foi tomada pelo [painel de artefato](../active/F-3-A-painel-de-artefato.md) — a numeração da trilha segue a ordem em que os planos são **escritos**, e este ainda não foi. A matemática já existe pronta em `core/ai/memory.ts` (`kvBytesPerToken`, `residentBytes` — falta só variar `numCtx` por linha em vez de um valor só), então quando esse plano nascer não é trabalho de `core/` novo, só de tela — provavelmente um bloco a mais dentro do `Dialog` de Configurações, perto de `LoadedModels`, já que é informação por modelo, não por conversa.

---

## Validação com o advisor (Opus) — concluída

O advisor esteve indisponível ("temporarily overloaded") nas duas tentativas feitas durante o planejamento. Por pedido explícito do usuário, a validação obrigatória do plano com Opus **não bloqueou o início da execução** — aconteceu **depois do passo 8** (QA ao vivo), como planejado. Achou um bug bloqueante real (índice de marca arredondando `numCtx` em silêncio), um gap de auto-conservação (contagem de primitivos), um gap de verificação (nível 4 não rodado) e um achado menor de posicionamento — os quatro corrigidos na mesma sessão (ver Diário, sessão 2, e "O que o plano não previu").

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| ago/2026 | todos | **concluído** | Acabamento do composer, seletor de modelo e sidebar. `Switch` e `Slider` entraram como primitivos — nenhum limite físico, então nenhum ganhou CSS Module. |

| 18/08/2026 | 2 | QA ao vivo | **Alternativa tentada na sessão 1 e revertida:** um slider por **índice de marca** arredondava em silêncio o `numCtx` de conversas **pré-existentes** — voltou a domínio contínuo com rótulos ralos (`thinLabels()`). O `pnpm test:e2e` pedido na revisão revelou dois specs parados desde o plano 17, **sem relação com o F-2** — remediados junto, mas registrados como achado alheio ao plano. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| `absolute` perde para o `relative` do `BASE` de `Button` — a ordem do stylesheet decide | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Os sete primitivos e o critério do oitavo | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) |
| Decisões F2.x | [`DECISOES.md`](../../DECISOES.md) |