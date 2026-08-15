# DS-4 — Base de implementação: replicar "Chat Local Design System"

> Escrito depois de ler o `IMPLEMENTATION_PLAN.md` anterior lado a lado com o código real (`Composer.tsx`, `ModelSelector.tsx`, `Settings.tsx`, `Sidebar.tsx`, `ConversationList.tsx`, `OllamaStatus.tsx`, `MarkdownMessage.module.css`, `tokens.css`, `base.css`). Este documento é a fonte para escrever o plano formal `NN-DS-4-....md` (confirmar número no `ROADMAP.md § 1`) — ele resolve as duas decisões em aberto e substitui qualquer trecho do plano anterior que contradiga o que segue.

## 0. Por que os 3 planos anteriores ficaram longe do protótipo

O `IMPLEMENTATION_PLAN.md` foi escrito a partir do protótipo sem cruzar cada item com o componente real que ele ia tocar. Resultado: algumas peças do protótipo já existiam no app, com contrato e comportamento próprios, e o plano pedia para "adicionar" o que já estava lá sob outro nome — Claude Code ou reconstruía por cima (duplicando lógica) ou recusava por conflito (ex.: o medidor de orçamento de contexto no composer não é legenda decorativa, é o gate de segurança D15.4/D15.5; apagá-lo quebra o `canSend`). Este documento existe para eliminar essa adivinhação: para cada peça do protótipo, diz se ela **já existe e só precisa de reestilo**, ou se é **lógica nova de verdade**.

## 1. Decisões fechadas nesta sessão

**(a) Alternador de tema manual — confirmado como decisão atual.**
Reverte a decisão registrada em `SKILL.md`/`BRIEF-claude-design.md` ("tema só por `prefers-color-scheme`, sem alternador"). Ação: atualizar os dois documentos com esta decisão e o porquê (usuário pediu explicitamente), e abrir entrada em `docs/HISTORY.md`. Implicações técnicas — ver § 3.2.

**(b) Informação de orçamento de contexto — migra para dentro do seletor de modelo.**
Não é remoção: hoje ela mora solta no rodapé do `Composer` (`<meter>` + texto "~N de M tokens" + aviso de overflow). Passa a viver dentro do popover do seletor de modelo (o mesmo lugar que já mostra "Contexto: N tokens" quando travado e o aviso "não cabe na memória"). O cálculo (`budgetFor`, `canSend`, o gate de envio) **não muda de lugar** — só a apresentação visual sai do composer solto e entra no popover do modelo. Ver § 3.1.

## 2. O que já existe e é só reestilo (não reconstruir)

| Peça do protótipo | Já implementado em | O que fazer |
|---|---|---|
| Botão de pausa + enviar | `Composer.tsx` — `Button variant="secondary" shape="circle"` (pausa, só quando `loading`) e `Button variant="primary" shape="circle" loading={loading}` (enviar) | Nada de lógica. Só compor com o restante do layout do DC. |
| Versão do Ollama no rodapé | `OllamaStatus.tsx`, via `useAiAvailability()` — já busca a versão real, não é hardcode | Só adicionar o clique → popover. Não recriar a busca de versão. |
| Editar/excluir conversa | `ConversationList.tsx` — `onStartRename`/`onRename`/`onRemove` já ligados a `useConversations()` (persistência real) | Só trocar o GATILHO visual (lápis/× sempre ali → kebab com popover). O contrato de props não muda. |
| Destaque de sintaxe em bloco de código | `MarkdownMessage.module.css` + `rehype-highlight`, já usando `--syntax-*` calibrados (plano 12) | Nada a construir. O parser do DC era só um substituto visual para a demo — não é para entrar no app. |
| Scrollbar fina/sutil | `base.css` linhas 90-108, `scrollbar-color: var(--color-border-strong) transparent`, já global (`*`) | Nada a construir. Só confirmar que a lista de conversas (`Sidebar` `overflow-y-auto`) e a rolagem de mensagens do `ConversationView` são scroll nativo — se algum estiver usando lib de scroll customizada, ela não herda essa regra. |
| Lógica do seletor de modelo (travado, teto de memória, badges, recarregar) | `ModelSelector.tsx` — completa e correta | **Não recriar.** Só uma casca visual nova por cima (§ 3.1). |

## 3. O que é lógica nova de verdade

### 3.1 Popover do seletor de modelo (substitui o `<select>` nativo)

O DC mostra um cartão dropdown (nome + RAM + contexto por modelo). O real é um `<select>` nativo dentro de `Field`, com regras que não podem se perder: opção desabilitada quando `locked`, aviso "não cabe na memória" (`contextWindow.status === 'too-large'`), aviso "travado" (`status === 'locked'`), campo de contexto editável (`status === 'open' && fits`), badges de capacidade, botão de recarregar.

**Construir:** um novo componente de apresentação (ex. `ModelSelectorPopover.tsx`) que recebe **exatamente os mesmos props** que `ModelSelector` já recebe (`state`, `selected`, `disabled`, `locked`, `onSelect`, `onReload`, `contextWindow`, `ceilingOf`, `scopeKey`, `onNumCtx`) e troca só o JSX interno: botão-gatilho com o nome do modelo + seta, abrindo um popover (`position:fixed`, ancorado, como o protótipo faz) com a lista de modelos em cartão. Todo estado (`too-large`, `unaffordable`, `locked`, `open`) e os badges continuam existindo dentro do popover — **é onde a informação de orçamento de contexto da decisão (b) entra**, no lugar do texto solto abaixo do composer.

**Aceite:** nenhuma prop de `ModelSelectorProps` muda de nome ou tipo; os 4 estados de `contextWindow` continuam todos renderizados, só que dentro do popover.

### 3.2 Alternador de tema manual

Hoje `tokens.css` decide claro/escuro só por `@media (prefers-color-scheme: light)`. Para o alternador manual funcionar sem duplicar a fonte de tokens:

- Adicionar `theme: 'system' | 'light' | 'dark'` a `AppSettings` (`shared/ipc.ts`), default `'system'`, persistido como o `numThread` já é (mesmo mecanismo, `settingsContext.ts`).
- Em `tokens.css`: manter o bloco `@media (prefers-color-scheme: light)` para o caso `'system'`, e adicionar um segundo bloco `[data-theme="light"]`/`[data-theme="dark"]` com as mesmas variáveis, aplicado a `<html>` — quem escreve o atributo é o processo principal via `nativeTheme.themeSource` (IPC, skill `ipc`), não CSS puro, porque o Electron precisa saber o tema para a chrome nativa da janela também.
- `Settings.tsx`: dois botões (Claro/Escuro) como no protótipo, chamando `setSettings` com o novo campo.

**Aceite:** os três estados (`system`/`light`/`dark`) refletem tanto no `tokens.css` quanto na chrome nativa da janela; `tokens.contrast.test.ts` continua passando sem alteração nos valores de cor.

### 3.3 Credenciais de nuvem (Gemini + GLM)

Não existe hoje nenhuma peça disso no `src` — nem campo em `Settings.tsx`, nem storage. É 100% novo:
- Storage: handler no processo principal usando `safeStorage` (mão única — grava, nunca devolve o valor em claro pro renderer). Expor por `window.api` só `write(provider, key)` e `has(provider): boolean` — nunca `read`.
- `Settings.tsx`: seção "Modelos de nuvem (opcional)", um bloco por provedor, `Field` + `input type={visible ? 'text' : 'password'}` + botão de olho, exatamente como o protótipo. O campo mostra o valor só enquanto o usuário digita nesta sessão (não há "leitura de volta" — ver `ESCOPO.md`, nenhuma chamada de inferência de nuvem ainda).
- Registrar GLM em `HISTORY.md`/`ROADMAP.md` como candidato novo, não presente em nenhum plano antes desta sessão.

### 3.4 Popover Ollama host:porta

`OllamaStatus.tsx` já expõe a versão via `useAiAvailability()`, mas **não expõe host/porta** no hook atual. Antes de construir o popover: localizar onde o cliente Ollama do processo principal guarda `host`/`porta` (provavelmente uma config fixa ou de settings) e decidir se `useAiAvailability` ganha esses dois campos ou se é uma leitura separada. Isso é investigação, não deve ser assumido — não inventar um endpoint novo sem confirmar o que já existe.

### 3.5 Textarea com auto-crescimento até 3 linhas

`Composer.tsx` hoje usa `<textarea rows={3} className="resize-none" ...>` — fixo, sem crescer de 1 para 3 linhas dinamicamente nem rolar depois. Adicionar o cálculo de altura (mesmo padrão do `handleComposerInput` do protótipo: `min(scrollHeight, altura de 3 linhas)`, `overflow-y` só depois de estourar) num `onInput`/`onChange` adicional, **sem tocar** em `draft`, `onKeyDown` (Enter envia, Shift+Enter quebra linha) ou `submit` — é só a caixa crescendo, a lógica de envio já está certa.

### 3.6 Menu de conversa (kebab)

`ConversationList.tsx` hoje: lápis e × sempre no DOM, `invisible group-hover:visible`. Trocar por: um botão kebab (mesmo padrão `invisible group-hover:visible` — já existe a classe `ACTION`, só muda o conteúdo) que abre um popover com "Editar título" (lápis) e "Excluir" (lixeira), cada um com ícone, chamando os mesmos `onStartRename`/`onRemove` que já existem. Não mexer em `onRename` (blur/Enter/Escape do input de edição já está correto e é o mesmo padrão que o protótipo usa).

### 3.7 Threads de CPU — segmentado 2/4/6

`ThreadsField` hoje é `<input type="number">` livre. Trocar por 3 `Button` (`variant="secondary"`, estado ativo com `variant="primary"`) com valores fixos 2/4/6, chamando o mesmo `setSettings((previous) => ({ ...previous, numThread: valor }))` que já existe — só a UI de escolha muda, o campo e a persistência continuam os mesmos.

## 4. Um primitivo novo vale a pena: `Popover`

Depois deste levantamento, três peças pedem a mesma coisa — botão-gatilho + painel `position:fixed` ancorado que fecha ao clicar fora: o popover Ollama (§3.4), o popover do seletor de modelo (§3.1) e o menu kebab de conversa (§3.6). Em vez de reescrever "clique fora fecha" três vezes, vale extrair **um** componente `shared/ui/Popover/Popover.tsx` (trigger + painel + overlay-close, sem lib nova — o mesmo padrão que o protótipo já usa) e os três consumirem ele. Isso é consistente com o critério do projeto de só componentizar quando há repetição real com contrato — aqui há.

## 5. Mapa de tokens — DC (protótipo) → `tokens.css` real

| Nome no protótipo (`theme.*`) | Token real | Observação |
|---|---|---|
| `canvas` | `--color-bg` | fundo da janela |
| `surface` | `--color-surface` | superfície padrão (sidebar, composer) |
| `surfaceElevated` | `--color-surface-raised` | item ativo, hover |
| `surfaceStrong` | usar `--color-surface-raised` também, ou `--color-surface` + borda mais forte | o protótipo tinha um 4º nível que o repo não tem — não inventar um novo token, escolher um dos dois existentes por contexto |
| `hairline` | `--color-border` | |
| `hairlineStrong` | `--color-border-strong` | também usado no scrollbar thumb |
| `ink` / `bodyStrong` | `--color-text` | |
| `body` | `--color-text-muted` | |
| `muted` | `--color-text-muted` | |
| `mutedSoft` | `--color-text-faint` | |
| `primary` | `--color-accent` (fundo) / `--color-accent-text` (texto/borda) — nunca `text-accent`, regra de contraste D-* já medida | |
| `onPrimary` | `--color-on-accent` | |
| `success` | `--color-ok` (fundo) / `--color-ok-text` (texto) | |
| `error` | `--color-danger` (fundo) / `--color-danger-text` (texto) | usar nos botões "Excluir" do menu kebab |
| `successBg`/`errorBg` | não existem como token — usar `--color-surface-sunken` + borda `--color-ok-text`/`--color-danger-text`, não inventar rgba novo | |
| espaçamento (`sp.itemPad`, `sp.composerPad`...) | `--space-1` a `--space-9` | mapear cada valor do protótipo para o step mais próximo da escala, não usar px livre |
| raio dos cartões/botões | `--radius-sm/md/lg/full` | protótipo usa 8-16px livres; `--radius-lg` (10px) e `--radius-md` (6px) cobrem a maioria |
| fonte de código | `--font-mono` no repo é `ui-monospace, 'Cascadia Code', Consolas...` — **decisão do usuário nesta sessão foi manter JetBrains Mono no protótipo**; confirmar se isso é só para o protótipo de design ou se `--font-mono` muda de verdade no app (não assumir) | |
| cores de sintaxe | `--syntax-keyword/entity/constant/string/builtin/comment/tag` | já existem, já corretas, não recalibrar |

## 6. Fase de QA visual (adicionar como Fase 9, antes do diário)

> ⚠️ **Correção (plano `DS-4-acabamento-final.md`, Fase 0):** o item 1 abaixo está
> errado. `screenshots/*.png` **mistura duas rodadas do protótipo** — `01-onboarding`,
> `03-chat-empty`, `04-chat-error` e `06-settings-modal-light` mostram a versão
> **antiga** do modal de Configurações (slider livre de threads, switch on/off para
> Gemini); só `02-chat-active` e `05-settings-modal-dark` mostram a versão atual
> (segmentado 2/4/6, campo com olho) — a mesma do `.dc.html`. A referência de QA é o
> **`Chat Local Design System.dc.html` aberto no navegador**, nunca os PNGs. Mesma
> armadilha "nome de arquivo não descreve o conteúdo" que o DS-3 diagnosticou nos seis
> `alvo/*.png` — ver `docs/HISTORY.md`.

Testes automatizados (`pnpm check:fast`) garantem que o código roda — não que ficou igual ao protótipo. Para cada tela implementada:
1. Rodar o app, capturar screenshot no mesmo estado do `Chat Local Design System.dc.html` (chat ativo, vazio, erro, configurações claro/escuro — o `.dc.html` não tem onboarding no app real).
2. Colocar lado a lado com a referência e listar toda divergência de espaçamento, cor, raio ou tipografia — usando a tabela do § 5 para apontar qual token deveria ter sido usado.
3. Corrigir e recapturar até não haver divergência não-justificada (uma divergência é aceitável só se vier de uma regra não-negociável do projeto, ex. contraste, e deve ser anotada como tal, não corrigida às cegas).

## 7. Índice rápido — onde cada coisa mora

- Composer: `src/features/conversation/Composer.tsx`
- Seletor de modelo: `src/features/conversation/ModelSelector.tsx`
- Conversas (lista, renomear, excluir): `src/features/conversation/ConversationList.tsx`, `conversationsContext.ts`
- Configurações: `src/features/settings/Settings.tsx`, `settingsContext.ts`
- Status/versão Ollama: `src/components/OllamaStatus.tsx`, `useAiAvailability.ts`
- Sidebar (casca, colapso): `src/app/Sidebar.tsx`
- Markdown/código da resposta: `src/features/conversation/MarkdownMessage.tsx` + `.module.css`
- Tokens: `src/shared/ui/tokens.css`, resets/scrollbar: `src/assets/base.css`
- Primitivos: `src/shared/ui/{Button,Field,Dialog,Panel,Toolbar}`
