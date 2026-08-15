# Plano — Camada Tailwind v4 + ajustes de interface do chat

> Segue a convenção de `docs/README.md`: nasce em `plan/active/`, ganha diário de execução por sessão, e move para `implemented/` com entrada em `HISTORY.md` ao concluir. **Confirme o próximo número livre no `ROADMAP.md § 1`** antes de salvar este arquivo como `NN-tailwind-e-interface-do-chat.md` — este pacote foi escrito fora do repositório e não sabe se o 16 (anexo) já fechou.

## Fonte única deste plano
Tokens: `tokens.css` (dono). Comportamento de desktop, `<dialog>`, IPC, camadas: skills `design-system`, `ipc`, `architecture` (donas). Este plano é dono só da **composição Tailwind sobre os tokens** e das **quatro extensões de interface** abaixo — nada aqui redefine token, redesenha a casca existente, ou duplica o que as skills já fixam.

## ✅ Decisão resolvida — ver `DS-4-BASE.md` § 1
Alternador manual mantido como decisão atual (opção b abaixo). Detalhe técnico de implementação em `DS-4-BASE.md` § 3.2. Texto original da decisão em aberto mantido abaixo por rastreabilidade.

## ⚠️ Decisão em aberto — resolver antes da Fase 3 (histórico, já resolvida acima)
O `SKILL.md` (`design-system`) e o `BRIEF-claude-design.md` do usuário registram, os dois, a mesma decisão: **tema segue só `prefers-color-scheme`, sem alternador manual** — "*se os protótipos já tiverem sido gerados com `data-theme`, converter para `prefers-color-scheme` — o app não tem, e não vai ter, alternador manual.*"

Nesta sessão, a pedido explícito do usuário, o protótipo (`reference/Chat Local Design System.dc.html`) ganhou um alternador manual Claro/Escuro dentro de Configurações — reversão deliberada dessa decisão, não um esquecimento. **As duas fontes não podem ficar contraditórias.** Antes de implementar a Fase 3, uma pessoa com autoridade sobre o produto decide:
- (a) manter a decisão antiga — reverter o alternador do protótipo, tema só por SO; ou
- (b) confirmar a reversão — atualizar `SKILL.md` e o `BRIEF-claude-design.md` para registrar o alternador manual como decisão atual, com o porquê.

Qualquer que seja a escolha, ela ganha uma entrada em `docs/HISTORY.md` — é exatamente o tipo de decisão que a convenção do projeto pede para não se perder.

## Objetivo
Duas frentes, na mesma sessão de trabalho por tocarem o mesmo arquivo (`Settings.tsx`) e o mesmo composer:

1. **Camada Tailwind v4** sobre os tokens existentes (`tokens.css`), conforme `BRIEF-claude-design.md` — zero paleta padrão, `@theme inline` só de nomes seguros, `@utility` para os quatro sólidos, duas densidades (chrome/leitura).
2. **Quatro extensões de interface**, construídas e validadas nesta sessão sobre o protótipo:
   - Botão de pausa no composer, habilitado só durante uma resposta em andamento.
   - Rodapé da sidebar: "Ollama (v0.32.6)" clicável → popover com host:porta em fonte monoespaçada.
   - Configurações: Threads de CPU como 3 opções fixas (2/4/6, não mais slider livre); Gemini/GLM como campo de texto sempre visível + ícone de olho aberto/fechado para mascarar a chave (substituindo o switch on/off da rodada anterior).
   - Composer: campo de mensagem migrado de `<input>` para `<textarea>` com auto-crescimento até 3 linhas e rolagem interna depois disso; legendas de contexto/RAM removidas do composer e de abaixo de cada resposta.
   - Resposta do assistente renderiza Markdown (parágrafo, lista, **negrito**, `código inline`, blocos ```fenced``` com rótulo de linguagem).

## Não-negociáveis (por que ambos importam)
Do `BRIEF-claude-design.md`:
1. `@theme inline`, nunca `@theme` — os tokens continuam em `:root` + `@media (prefers-color-scheme: light)`, inalterados, por causa do audit de contraste que os lê.
2. Nenhuma classe da paleta/escala padrão do Tailwind compila (`bg-slate-800`, `p-4`=16px etc.) — só o que vier dos tokens do projeto.
3. Os quatro sólidos (`accent`, `danger`, `warn`, `ok`) saem do `@theme inline` e recebem só `@utility bg-*` — nunca `text-*`, pela regra de contraste medida (2,96:1 foi bug real).
4. Zero cor literal em JSX (`bg-[#fff]`, `style={{color:'...'}}`) e zero classe da paleta padrão.
5. Duas densidades sem unificar: chrome em `text-sm` (13px), leitura em `text-reading` (18px) — mensagem, resposta e o que se digita no composer são leitura; sidebar/composer-controles/modal são chrome.
6. `<dialog>` nativo continua sendo o modal — não substituir por `<div>` + overlay, não introduzir Radix/Ark/Headless UI.
7. Markdown renderizado (`react-markdown`) continua em CSS puro — não tentar `@apply` em massa nem plugin de typography.

Desta sessão, além do brief:
8. Threads de CPU: só 2, 4 ou 6 — não expor um input livre.
9. Chave de API de nuvem: sempre visível como campo de texto (não atrás de switch on/off); o controle de privacidade é só a máscara olho aberto/fechado, nunca escondendo o campo inteiro.
10. Nenhuma legenda de `num_ctx`/RAM sobra visível nem no composer nem abaixo da resposta — ver ressalva abaixo sobre o orçamento de contexto já implementado.

## ✅ Decisão resolvida — ver `DS-4-BASE.md` § 1 e § 3.1
Informação de orçamento migra para dentro do popover do seletor de modelo; o gate de envio (`budgetFor`/`canSend`) não muda de lugar, só a apresentação. Texto original mantido abaixo por rastreabilidade.

## ⚠️ Segunda decisão em aberto — orçamento de contexto (plano 15) (histórico, já resolvida acima)
O `ROADMAP.md` registra o **plano 15 — orçamento de contexto e modelo — como já implementado**, com fórmula de custo de KV cache por modelo, medição de RAM livre em runtime e trava de "janela travada" (`unaffordable`). As mudanças desta sessão removem **toda** exibição de contexto/RAM do composer e da resposta, a pedido do usuário — o que pode estar removendo a única superfície visível desse sistema. Confirmar com quem mantém o plano 15 se a informação deveria migrar para outro lugar (ex.: só dentro do seletor de modelo, sem legenda solta) ou se ficar oculta é intencional agora.

## Tokens exatos (não são placeholder — vieram de `tokens.css`, ver handoff anterior)
Reaproveitar a tabela publicada em `README.md` deste mesmo pacote (`--color-*`, `--space-1..9`, `--text-*`, `--radius-*`, alturas de controle, durações, `--font-ui`/`--font-mono`, `--sidebar-width*`). Este plano não repete a tabela para não duplicar fonte.

## Fases

### Fase 1 — `@theme inline` e `@utility` dos sólidos
- Criar o bloco `@theme inline` mapeando os nomes exatos do brief para `var(--token)` de `tokens.css`, sem tocar a estrutura do arquivo de tokens.
- Os 5 `@utility` (`bg-accent`, `bg-accent-hover`, `bg-danger`, `bg-warn`, `bg-ok`) fora do `@theme inline`.
- **Aceite:** `bg-accent` compila, `text-accent` não existe; `bg-slate-800`/`p-4`-como-16px não compilam; audit de contraste (`tokens.contrast.test.ts`) continua passando sem alteração.

### Fase 2 — Migrar os 5 primitivos e a casca existentes para utilidade
- `Button`, `Field`, `Dialog`, primitivos do renderer: variantes (`variant`, `size`, `loading`) extraídas para constante fora do JSX (objeto de strings ou `cva`); layout de 3-4 classes fica inline.
- `@layer base`: `user-select:none` + `.selectable`, `overscroll-behavior:none`, scrollbar fina, `:focus-visible` só por teclado, `prefers-reduced-motion`.
- **Aceite:** nenhum componente tocado usa `#hex` ou `style={{color}}` literal; exceção só para hairline 1-2px.

### Fase 3 — Alternador de tema (bloqueada pela decisão em aberto acima)
- Se (a): remover o alternador do protótipo/handoff, confirmar `prefers-color-scheme` propagando pelo `@theme inline` sozinho.
- Se (b): implementar o switch em `Settings.tsx`, persistir via `settingsContext.ts`/`app_settings` (mesmo mecanismo do `numThread`), sincronizar `nativeTheme.themeSource` no main por IPC (skill `ipc`), e atualizar `SKILL.md` + `BRIEF-claude-design.md`.
- **Aceite:** comportamento e documentação concordam — nenhuma fonte contradiz outra depois desta fase.

### Fase 4 — Threads de CPU (2/4/6)
- Trocar o `<input type="range">` do `ThreadsField` atual por 3 botões segmentados, valor default 4.
- Persistir em `app_settings` como hoje.
- **Aceite:** só 2, 4 ou 6 chegam ao Ollama; nenhum outro valor é alcançável pela UI.

### Fase 5 — Credenciais de nuvem (Gemini + GLM)
- Seção "Modelos de nuvem (opcional)" em `Settings.tsx`: um bloco por provedor — nome do modelo acima, campo de texto (tipo alterna `password`/`text`) + botão de olho aberto/fechado ao lado.
- Armazenamento via `safeStorage` (ou equivalente já adotado) — mão única, nunca lido de volta pelo renderer, nunca logado.
- Registrar em `HISTORY.md`/`ROADMAP.md` que GLM entra como candidato novo (não estava em nenhum documento antes desta sessão) e que isto é só a UI de credencial — nenhuma chamada de inferência de nuvem ainda, e o `ESCOPO.md` continua bloqueando dado de nível 3 para qualquer nuvem.
- **Aceite:** alternar o olho troca `type` do input sem perder o valor digitado; nenhum estado do renderer expõe a chave em claro fora do próprio input.

### Fase 6 — Composer: pausa, textarea, remoção de legendas técnicas
- Botão de pausa (ícone de duas barras) ao lado do enviar, habilitado só quando uma resposta está em andamento (ligado ao estado de streaming que o plano 15/16 já expõe — não inventar um novo).
- `<input>` → `<textarea rows="1">` com auto-crescimento via JS (altura = `min(scrollHeight, 3× altura de uma linha)`), rolagem interna (`overflow-y:auto`) só depois de passar o teto.
- Remover a legenda de contexto (`selectedModel.ctx`) do composer e a linha de metadados (`modelo · contexto · tokens · tempo`) abaixo de cada resposta do assistente — ver decisão em aberto acima sobre onde essa informação deveria viver, se em algum lugar.
- **Aceite:** digitar 1 linha não rola; ultrapassar 3 linhas rola sem empurrar a resposta anterior para fora da tela; pausa nunca é clicável fora de uma resposta em andamento.

### Fase 7 — Popover Ollama (rodapé da sidebar)
- Rodapé: "Ollama ({{ versão }})" clicável → popover com "Conectado" + `host:porta` em `--font-mono`.
- Posicionar fora de qualquer ancestral com `overflow:hidden` (o container da sidebar usa `overflow:hidden` para a transição de largura) — usar `position:fixed` ancorado ao botão, como o dropdown de modelo no composer já faz.
- Versão do Ollama: ler de `/api/version` (ou equivalente já em uso) em vez de hardcode — o protótipo fixa `v0.32.6` como placeholder.
- **Aceite:** popover visível em qualquer estado da sidebar (expandida/colapsada — ou ocultar o botão quando colapsada, a decidir); nunca clipado.

### Fase 8 — Markdown na resposta do assistente
`docs/ROADMAP.md` já lista **plano 11 — markdown na resposta do assistente — como implementado**, com `MarkdownMessage` candidato a subir para `shared/ui/` no gatilho "segundo consumidor fora de `features/conversation/`". **Não recriar esse componente** — o protótipo desta sessão usa um parser próprio só para demonstrar a intenção visual (parágrafo, lista, **negrito**, `código inline`, bloco ```fenced``` com rótulo de linguagem e realce). Ao implementar de fato:
- Reusar `MarkdownMessage` e a tipografia de bloco existentes.
- Ligar o realce de sintaxe aos tokens `--syntax-*` já calibrados no plano 12, em vez de estilo genérico.
- **Aceite:** um bloco de código SQL (o exemplo do protótipo) renderiza com o mesmo realce que o resto do app já usa para código.

### Fase 9 — QA e diário
- `pnpm check:fast`. Conferir os dois temas (ou só escuro, se a Fase 3 resolver pela opção "a"), threads 2/4/6, campos de credencial com olho, textarea em 1/3/5 linhas, popover em todos os cantos de tela, markdown com bloco de código.
- Preencher o diário abaixo antes de mover para `implemented/`.

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| | | | |
