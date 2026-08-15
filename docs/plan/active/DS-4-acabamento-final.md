# DS-4 — Popover, tema manual e acabamento final da trilha DS

## Contexto

DS-1/DS-2/DS-3 levaram a interface do chat até `alvo-chat.png`. Uma sessão separada,
fora deste repositório, gerou um novo protótipo — [`docs/DS-04/reference/Chat Local
Design System.dc.html`](../../DS-04/reference/Chat%20Local%20Design%20System.dc.html)
— com cinco extensões de interface que o DS-3 não cobriu, e escreveu três documentos
(`README.md`, `IMPLEMENTATION_PLAN.md`, `DS-4-BASE.md`, em `docs/DS-04/`) que tentam
mapear o protótipo para o código real. A leitura desta sessão encontrou o
`IMPLEMENTATION_PLAN.md` desatualizado em pontos concretos (o `DS-4-BASE.md` já
substitui a maior parte dele) e o próprio `DS-4-BASE.md` com pontos próprios a
corrigir — ver "O que o `DS-4-BASE.md` não viu" abaixo. Este plano é a versão
executável, formal, com os três documentos conciliados contra o código real
(`Composer.tsx`, `ModelSelector.tsx`, `Settings.tsx`, `ConversationList.tsx`,
`OllamaStatus.tsx`, `useAiAvailability.ts`, `core/ai/budget.ts`, `core/ai/types.ts`,
`shared/ipc.ts`, `main/index.ts`, `main/ipc/register-all.ts`).

**Por que `DS-4-` e não `NN-` (o arco):** o `IMPLEMENTATION_PLAN.md` foi escrito fora
do repositório e sugere `NN-tailwind-e-interface-do-chat.md`, sem saber que a trilha DS
já existe com numeração própria ([`plan/active/README.md` § A trilha de design
system](README.md)). O pedido desta sessão confirma a leitura certa: "a última sobre
ds antes de seguirmos os planos do arco (16 em diante)" — é DS-4, quarto plano da
mesma trilha que DS-1/2/3, não um plano do arco 13–20. Confirmado: `plan/active/` e
`plan/implemented/` não tinham nenhum `DS-4-*` antes deste arquivo — era o próximo
número livre da trilha.

**O aceite global** é o mesmo da trilha: a tela medida contra o protótipo (agora
`Chat Local Design System.dc.html`, não mais `alvo-chat.png` — este é o handoff da
rodada seguinte), com os desvios conhecidos documentados. Cor e tipografia **não** vêm
do protótipo (ele não carrega `tokens.css`); a fonte de valor continua sendo
`tokens.css`.

---

## O que o `DS-4-BASE.md` não viu (verificado nesta sessão, com fonte primária)

Três simplificações técnicas reais, encontradas via Context7 (docs do Electron) e
busca na web, que tornam a implementação mais simples do que o `DS-4-BASE.md` propõe:

1. **`nativeTheme.themeSource` já propaga `prefers-color-scheme` para o renderer.**
   Doc do Electron: *"Settings this property to 'dark' will have the following
   effects: ... The `prefers-color-scheme` CSS query will match 'dark' mode."* Isso
   significa que o `[data-theme="light"]`/`[data-theme="dark"]` que o `DS-4-BASE.md
   § 3.2` propõe **não é necessário** — `tokens.css` continua com **zero linhas
   mudadas**, mais forte que o próprio aceite do `DS-4-BASE.md` ("sem alteração nos
   valores de cor"). O main só precisa setar `nativeTheme.themeSource`; o `@media
   (prefers-color-scheme: light)` que já existe faz o resto sozinho.

2. **`field-sizing: content` (CSS, Chromium 123+) substitui o cálculo em JS do
   `DS-4-BASE.md § 3.5`.** Confirmado suportado no Chromium 148 que o Electron 42
   embute. `textarea { field-sizing: content; max-height: 3lh; overflow-y: auto }`
   cresce de 1 a 3 linhas e rola depois, sem um `onInput` sequer.

3. **O primitivo `Popover` (`DS-4-BASE.md § 4`) pode nascer sobre o atributo nativo
   `popover` + CSS anchor positioning**, em vez de `position:fixed` calculado à mão e
   um listener de clique-fora manual — o mesmo padrão que já fez o `Dialog` nascer
   sobre `<dialog>` nativo em vez de `<div>` + overlay. Chromium 148 suporta os dois.

Confirmado por busca dedicada: nenhum dos cinco padrões de interação novos do
protótipo (Popover, menu kebab, popover de host:porta, threads segmentado, campo de
credencial com olho) tem precedente no pacote `docs/DS-04/design-system/` nem no app
real — são território novo, desenhados aqui em cima dos tokens confirmados.

---

## Três decisões resolvidas nesta sessão (perguntadas ao usuário, não assumidas)

| # | Pergunta | Resposta | Efeito no plano |
|---|---|---|---|
| DS4.6 | Credenciais de nuvem (Gemini/GLM) — `DS-4-BASE.md § 3.3` inclui como "lógica nova", mas `plan/active/README.md`/`ROADMAP.md` já atribuem isso à **fatia 3 do plano 09**, depois do arco inteiro | **Devolvido ao plano 09.** Não é a única peça do `DS-4-BASE.md` que não é reestilo (migration nova, domínio IPC `cloud:*`, primeiro `safeStorage`) — sai do DS-4 | DS-4 fica **9 fases**, envelope puro |
| DS4.7 | Threads de CPU segmentado 2/4/6 — já **recusado** quando a trilha DS fechou o alvo (`plan/active/README.md`: "threads em 2/4/6 numa máquina de 8"), e a máquina de desenvolvimento tem 8 threads | **2/4/6 literal, como o protótipo.** Reabre a recusa conscientemente — o usuário escolheu fidelidade ao protótipo sobre cobrir o teto real da máquina | Fase 1 implementa 2/4/6 sem adaptar à máquina |
| DS4.5 | O aviso de recusa de envio (`role="alert"`) — `DS-4-BASE.md § 1(b)` manda tudo (medidor + aviso) para o popover do modelo, tensionando com D15.5 ("recusa aparece na tela") e DS3.3 ("nada do 15 desaparece") | **Dividir**: medidor + "~N de M tokens" + "Contexto: N tokens · travado" entram no popover; o aviso de recusa continua sempre visível no Composer | Fase 7 implementa a divisão, não a leitura literal do `DS-4-BASE.md` |

---

## Fases

Ordem: mudanças autocontidas primeiro, depois o primitivo novo, depois seus
consumidores (do mais simples ao mais acoplado ao plano 15), depois o tema (toca o
processo main), e o seletor de modelo por último.

### Fase 0 — Registro e correções de ponteiro

- Este arquivo, criado com diário vazio.
- `plan/active/README.md` e `ROADMAP.md § 1`: linha do DS-4 acrescentada à trilha.
- `DS-4-BASE.md § 6` corrigido: a referência de QA da Fase 8 é o `.dc.html` aberto no
  navegador, **não** `docs/DS-04/screenshots/*.png` — verificado que o conjunto mistura
  duas rodadas do protótipo (`01`, `03`, `04`, `06` mostram a versão antiga do modal de
  Configurações — slider livre, switch on/off; `02` e `05` mostram a versão atual —
  segmentado 2/4/6, campo com olho — a mesma do `.dc.html`). Escalado para
  `HISTORY.md` — mesma armadilha "nome de arquivo não descreve o conteúdo" que o DS-3
  diagnosticou nos seis `alvo/*.png`.
- **Levantamento de e2e**: `grep -rn "Modelo\|Recarregar\|Ollama\|select\|Renomear\|Excluir" e2e/`
  — **um único ponto de quebra confirmado**: `e2e/dev/persistence.spec.ts:61`
  (`getByRole('button', { name: 'Renomear Nova conversa' })`, direto após o hover —
  quebra na Fase 4, quando o kebab substitui os dois botões sempre-no-DOM). Os outros
  quatro specs (`open-dataset.spec.ts`, `security-boundary.spec.ts`, `window.spec.ts`,
  `packaged/smoke.spec.ts`) não têm seletor tocado por este plano.

**Aceite:** plano em `active/` com diário vazio; `README`/`ROADMAP` apontam para ele;
a contradição do § 6 documentada e escalada; um único spec de e2e identificado como
afetado, atribuído à Fase 4.

### Fase 1 — Threads de CPU: segmentado 2/4/6 (DS4.7)

`src/renderer/src/features/settings/Settings.tsx`.

- Trocar o `<input type="number">` de `ThreadsField` por três `Button`
  (`variant="primary"` no valor ativo, `"secondary"` nos outros — nunca classe
  própria, mesmo grupo de "duas utilidades resolvidas por ordem na folha" que já
  mordeu DS-1/DS-2/DS-3). Cada botão chama `setSettings((previous) => ({ ...previous,
  numThread: valor }))`, valores fixos `[2, 4, 6]`.
- Mesmo idioma de segmentado que a Fase 6 (tema) reusa: `<div role="group">` com os
  `Button`s, ativo decidido por `settings.numThread === valor`.
- `numThread` guarda hoje qualquer inteiro positivo (o `<input>` livre nunca validou
  além de `min={1}`) — um valor persistido fora de `{2,4,6}` não marca nenhum botão
  como ativo (não clampar em silêncio); clicar substitui pelo valor exato.

**Aceite:** clicar num dos três botões grava exatamente 2, 4 ou 6, e só esse fica
marcado ativo; um valor antigo fora do conjunto não marca nenhum botão ativo em vez de
ser arredondado; `check:fast` verde.

### Fase 2 — Composer: textarea auto-crescente via CSS

`src/renderer/src/features/conversation/Composer.tsx`.

- Remover `rows={3}`. Acrescentar `field-sizing: content` (`[field-sizing:content]`),
  `min-h-[1lh]` (sem isso o composer vazio encolhe abaixo de uma linha), `max-h-[3lh]`
  e `overflow-y-auto`. Sem `onInput` novo.

**Aceite:** composer vazio nunca renderiza abaixo de 1 linha; digitar 1 linha não
rola; passar de 3 linhas rola sem crescer o composer além disso; zero JS novo;
`check:fast` verde.

### Fase 3 — Primitivo novo: `Popover`

`src/renderer/src/shared/ui/Popover/Popover.tsx` (+ `Popover.module.css`).
`test/setup-renderer.ts` (shim, mesma família do polyfill de `<dialog>`).

- Verificar AO VIVO antes de escrever: com `popover="auto"`, o clique-fora fecha o
  popover antes do `onClick` do gatilho rodar — se o gatilho reabre incondicionalmente,
  clicar para fechar reabre. Controle 100% imperativo não evita isso sozinho.
  - Se reabrir: trocar para `popovertarget` declarativo (dá a referência de âncora
    implícita de graça); `.d.ts` de projeto se `@types/react@19.2.7` não tipar.
  - Se não reabrir: controle imperativo puro (`open` prop → `useEffect` →
    `showPopover()`/`hidePopover()`, como o `Dialog`).
- `popover="auto"`, não `"manual"`.
- Fechamento pelo navegador sincroniza de volta via `toggle`
  (`node.addEventListener('toggle', (e) => { if (e.newState === 'closed') onClose() })`).
- Posicionamento por `position-anchor` + `position-try-fallbacks` em
  `Popover.module.css`; origem do `anchor-name` depende do resultado do teste acima.
- Fade de entrada com `@starting-style`, mesma forma do `Dialog.module.css`.
- Shim de teste no nível 2 (jsdom não implementa `popover`/`showPopover()`);
  *light-dismiss* e *anchor-position* são nível 4 apenas.
- `Popover.module.css` ganha o mesmo cabeçalho "por que sobreviveu" de
  `Dialog.module.css`/`MarkdownMessage.module.css`.

**Aceite:** `Popover` abre/fecha por `open`; fechamento por clique-fora e `Esc`
sincroniza `onClose`; posicionado sem `position:fixed` calculado; `check:fast` verde
com o shim; nível 4 confirma *light-dismiss* nos dois temas.

### Fase 4 — Menu kebab na lista de conversas

`src/renderer/src/features/conversation/ConversationList.tsx`,
`e2e/dev/persistence.spec.ts`.

- Trocar os dois `Button` sempre-no-DOM por um kebab (mesma classe `ACTION`) que abre
  um `Popover` com "Editar título" e "Excluir", chamando exatamente
  `onStartRename`/`onRemove`. "Excluir" em `--color-danger-text`.
- Reescrever `persistence.spec.ts:61` para hover → abrir kebab → clicar "Editar
  título".

**Aceite:** kebab só visível no hover/foco da linha; popover com as duas ações sem
alterar contrato; `persistence.spec.ts` atualizado e verde; `check:fast` verde.

### Fase 5 — Popover "Ollama (versão)" + host:porta + repetir a verificação

`src/renderer/src/components/OllamaStatus.tsx` (+ `.test.tsx`),
`src/renderer/src/features/conversation/useAiAvailability.ts`,
`src/renderer/src/features/conversation/ConversationView.tsx`,
`src/main/features/ai/providers/ollama.ts`, `src/main/features/ai/handlers.ts`,
`src/shared/ipc.ts`, `test/api-mock.ts`.

- `AiAvailability` ganha `host?: string`. `ProbeFn` **não muda de forma** (o seam é
  deliberadamente não moldado como HTTP, para um provedor de nuvem cumprir de uma
  tabela): `ollama.ts` exporta `ollamaDisplayHost`, `handlers.ts` ganha um terceiro
  parâmetro opcional `isAvailable(args, probe, host?)`, `register-all.ts` passa
  `ollamaDisplayHost`.
- `useAiAvailability` ganha `retry`, espelhando `{ state, reload }` de `useAiModels` —
  **não** vira `useQuery` (medido e descartado no DS-3).
- `OllamaStatus.tsx`: "Ollama (vX)" vira gatilho de `Popover` com "Conectado" +
  `{host}` em `--font-mono`.
- Botão "Tentar novamente" no estado de erro de `ConversationView.tsx`, chamando
  `retry`.

**Aceite:** popover mostra host:porta reais; "Tentar novamente" refaz a sondagem;
`check:fast` verde (`api-mock.ts`, `OllamaStatus.test.tsx` atualizados).

### Fase 6 — Alternador de tema manual (DS4.2)

`src/shared/ipc.ts`, `src/main/index.ts`, `src/main/ipc/register-all.ts`,
`src/renderer/src/features/settings/Settings.tsx`,
`.claude/skills/design-system/SKILL.md`, `docs/reference/BRIEF-claude-design.md`,
`docs/HISTORY.md`.

- `themeSchema = z.enum(['system', 'light', 'dark'])`, `theme` obrigatório em
  `appSettingsSchema`, `DEFAULT_APP_SETTINGS.theme = 'system'`.
- `register-all.ts`: lê `readSettings` ao abrir o banco, seta
  `nativeTheme.themeSource` antes de registrar handlers; `settings:write` também seta
  quando `args.theme !== undefined`; retorna `{ close, shouldUseDarkColors }`.
- `main/index.ts`: `createWindow(backgroundColor)`, escolhido por
  `shouldUseDarkColors`. Orçamento de linha: 93/100 hoje, válvula de escape é
  `main/window.ts` se estourar.
- Zero mudança em `tokens.css`.
- `Settings.tsx`: seção "Aparência", três botões (Sistema/Claro/Escuro — terceira
  opção além do protótipo, para haver caminho de volta ao SO).
- Reverter a decisão em `SKILL.md`/`BRIEF-claude-design.md`; entrada em `HISTORY.md`.
- Grep de testes de settings antes de tocar o schema (`theme` obrigatório quebra
  `toEqual({ numThread: ... })` sem o campo novo).

**Aceite:** os três estados mudam a UI inteira; reabrir com tema salvo não dá flash;
`tokens.contrast.test.ts` passa sem alteração; `SKILL.md`/`BRIEF` não contradizem mais
o app; `check:fast` verde.

### Fase 7 — Popover do seletor de modelo + orçamento de contexto (DS4.5, DS4.8)

`src/renderer/src/features/conversation/ModelSelector.tsx`,
`src/renderer/src/features/conversation/Composer.tsx`,
`src/renderer/src/features/conversation/ConversationView.tsx`.

- `ModelSelector.tsx` muda por dentro, não de nome/arquivo. As 10 props atuais não
  mudam; ganham `budget: Budget | null`. Gatilho vira pílula; dentro do `Popover`: a
  lista de modelos, os 4 estados de `contextWindow`, os badges, o ↻ (sempre
  disponível), e o medidor (`<meter>` + "~N de M tokens").
- O que não entra no popover: o aviso de recusa `role="alert"` — fica no `Composer`.
- `Composer.tsx`: `modelSelector` muda de `ReactNode` para
  `(budget: Budget | null) => ReactNode` — render-prop (DS4.8): a função é definida em
  `ConversationView`, mas só é chamada dentro do `Composer` (onde `budget` existe,
  porque `draft` é local dele, D13.2).
- Aviso de recusa e `canSend`/`submit` não mudam uma linha.
- Teclado: lista ganha `role="listbox"`/`role="option"`/`aria-selected`,
  `↑`/`↓`/`Enter`/`Esc`. Nome acessível do gatilho **conferido** na árvore de
  acessibilidade, não assumido.

**Aceite:** pílula abre popover com nome acessível conferido; lista navega por
teclado; os 4 estados de `contextWindow` renderizam dentro do popover; medidor
migrado; aviso de recusa continua sempre visível no Composer; `modelSelection.test.tsx`
e `contextBudget.test.tsx` passam; `check:fast` verde; nível 4 nos dois temas.

### Fase 8 — QA visual e fechamento

- Revisão ao vivo nos dois temas, três estados de tema, contra o `.dc.html` aberto no
  navegador — não os `screenshots/*.png`.
- Não-alvos: onboarding do protótipo, chips de sugestão no vazio, cartão de anexo
  (plano 16), linha de metadados sob a resposta (nunca existiu no app real), acento/
  fontes do protótipo (tokens.css é a fonte), credenciais de nuvem (plano 09).
- Bundle medido.
- `check:fast` verde; diário preenchido; entrada em `HISTORY.md`; mover este arquivo
  para `implemented/`; `ROADMAP.md`/`plan/active/README.md` atualizados.

**Aceite:** protótipo reproduzido no essencial, nos três estados de tema; registro
fechado pelo ciclo de vida do plano.

---

## Decisões

### DS4.1 — Fonte: `DS-4-BASE.md` corrigido em 3 pontos técnicos

Ver "O que o `DS-4-BASE.md` não viu" acima — tema, textarea e Popover simplificados
com fonte primária (docs do Electron, suporte do Chromium 148), não assumidos.

### DS4.2 — Alternador de tema manual, com `nativeTheme.themeSource` como único mecanismo

`tokens.css` não muda uma linha — `nativeTheme.themeSource` já propaga
`prefers-color-scheme` para o renderer (confirmado na documentação do Electron). Três
estados (Sistema/Claro/Escuro), não dois como o protótipo, porque sem "Sistema" não
haveria caminho de volta a seguir o SO.

### DS4.3 — Textarea auto-crescente é CSS puro

`field-sizing: content` substitui o cálculo em JS que o `DS-4-BASE.md` propunha —
Chromium 148 suporta nativamente, e o app roda só nesse motor.

### DS4.4 — `Popover` nasce sobre o atributo nativo, não `position:fixed` manual

Mesmo raciocínio que já pôs o `<dialog>` nativo no `Dialog`. `popover="auto"` dá
*light-dismiss* e `Esc` de graça. **Verificado ao vivo na Fase 3** (script Playwright
descartável contra Chromium real, headless shell 151 — mesma família do 148 que o
Electron 42 embute): controle 100% imperativo (`open` prop → `useEffect` →
`showPopover()`/`hidePopover()`, com um listener de `toggle` sincronizando o
fechamento nativo de volta ao React) **não sofre o duplo-toggle** — clicar no
gatilho para fechar um popover aberto não o reabre, porque `showPopover()`/
`hidePopover()` num estado já correspondente é *no-op* de especificação.
`popovertarget` declarativo não foi necessário.

### DS4.5 — Orçamento de contexto: medidor migra, aviso de recusa fica

Ver tabela de decisões acima. Resolve a tensão entre `DS-4-BASE.md § 1(b)` e D15.5/
DS3.3.

### DS4.6 — Credenciais de nuvem devolvidas ao plano 09, fatia 3

`DS-4-BASE.md § 3.3` reatribuiu essa peça ao DS-4 sem reconhecer que
`plan/active/README.md`/`ROADMAP.md` já a atribuíam à fatia 3. Não é reestilo (migration
nova, domínio IPC `cloud:*`, primeiro `safeStorage`) — mantém o DS-4 como envelope
puro, 9 fases.

### DS4.7 — Threads segmentado 2/4/6, reabrindo a recusa anterior conscientemente

A trilha DS já tinha recusado "threads em 2/4/6 numa máquina de 8" ao fechar o alvo
do DS-3. Reaberta nesta sessão a pedido explícito do usuário — fidelidade ao
protótipo escolhida sobre cobrir o teto real da máquina de desenvolvimento.

### DS4.8 — `modelSelector` como render-prop, não fusão de arquivos

`Composer` mantém `draft`/`budget` locais (D13.2); `ConversationView` não tem
`budget`. Duas alternativas descartadas: levantar `draft` para `ConversationView`
(reabriria D13.2 sem necessidade) e dois popovers independentes (não é o que um
clique na pílula deveria abrir). O render-prop entrega `budget` como argumento de
chamada, no ponto exato em que existe, sem virar prop de ninguém.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
