# DS-3 — a interface chega ao alvo (casca, lista, mensagem; composer por último)

**Depende de:** [DS-1](DS-1-fundacao-tailwind.md) e [DS-2](DS-2-migracao-da-casca-e-features.md), concluídos em ago/2026 · **Entrega:** a interface levada ao alvo [`alvo-chat.png`](../../reference/handoff-ds-ago2026/alvo-chat.png), ordenada do menos ao mais acoplado ao plano 15.

> Terceiro e último da [trilha DS](../active/README.md#a-trilha-de-design-system-ds-n). **Aceite global oposto ao de DS-1/DS-2: a tela muda, e a mudança é a entrega** — medida contra `alvo-chat.png`.
>
> **O design system é um envelope** — a régua é da skill [`design-system`](../../../.claude/skills/design-system/SKILL.md), o alvo é do [handoff](../../reference/handoff-ds-ago2026/README.md). Este plano **não constrói feature nenhuma**: leva ao alvo o que **já existe** no app. O que ainda não existe (clipe, cartão de anexo) é do [plano 16](./16-anexo-mecanismo-e-dataset.md); credencial de nuvem é do [plano 09](../active/09-camada-de-ia.md).

---

## O caso

DS-1 provou a camada Tailwind e DS-2 migrou casca e features, ambos com o aceite mais forte que existe para migração — *zero mudança visual*. DS-3 tem o aceite inverso e é o destino visual da trilha.

**O achado que reenquadra o escopo (levantado ao planejar):** **não há fronteira de *feature* entre DS-3 e um eventual DS-4.** A tabela de distância inteira (itens 1–13 do handoff) é trabalho de **renderer, sem canal IPC novo e sem dado novo**:

- `Conversation` já carrega `createdAt`/`updatedAt` ([`shared/ipc.ts`](../../../src/shared/ipc.ts)) → agrupar por data é view pura;
- os títulos já estão em memória → busca é filtro de cliente;
- a maquinaria de orçamento de contexto do plano 15 (medidor, teto, `locked`/`unaffordable`/`too-large`, calibração) **já existe** → mover o seletor para o composer é *deslocamento*, não construção;
- o rodapé de status consome o canal `ai:isAvailable` que **já existe** (retorna `AiAvailability` com `version`) — nenhum canal novo;
- os únicos recortes reais — clipe, cartão de anexo, credenciais de nuvem — **já pertencem ao plano 16 / plano 09**.

**Logo o eixo que resta é risco / acoplamento ao plano 15**, não "feature vs. envelope" — o mesmo critério da [DS2.2](DS-2-migracao-da-casca-e-features.md#ds22--a-ordem-é-por-quanto-o-ds-3-preserva-não-por-tamanho). Daí um **plano único**, ordenado do menos ao mais acoplado, com o composer e o seletor nos **últimos passos** (7–8). Se o plano se mostrar longo, esses passos viram um `DS-4-*.md` ao custo de um arquivo — a opção fica preservada sem ser gasta (ver DS3.1).

**O que este plano não é:** um redesenho do modal de Configurações. Ver o veredito dos `alvo/*.png` abaixo.

### O veredito dos seis `alvo/*.png`

⚠️ Os nomes dos arquivos não descrevem o conteúdo. Conferidos imagem a imagem:

| Arquivo | Conteúdo real | Contribui ao DS-3? |
|---|---|---|
| `01-onboarding.png` | modal Configurações (claro), slider de threads | **Não** — modal herda o envelope de DS-1/2 |
| `02-chat-active.png` | modal Configurações (escuro), threads **2/4/6** | **Não** — 2/4/6 é **recusado** (máquina de 8 threads) |
| `03-chat-empty.png` | modal Configurações (claro), slider | **Não** |
| `04-chat-error.png` | modal (claro) com "Tentar novamente" atrás | **Não** |
| `05-settings-modal-dark.png` | idem 02 (2/4/6, alternador Claro/Escuro) | **Não** — alternador de tema é **recusado** |
| `06-settings-modal-light.png` | modal claro | **Não** |

Os estados de `alvo/` são dominados pelo **modal de Configurações**, cujas diferenças são **recusadas** (alternador Claro/Escuro; threads em 2/4/6) ou de **outro dono** (credenciais de nuvem = plano 09). **DS-3 não redesenha o modal.** O alvo do DS-3 é `alvo-chat.png`.

> **Os "seis estados" são quatro imagens.** `02-chat-active.png`, `05-settings-modal-dark.png` e o `composer-e-configuracoes.png` do nível de cima são **byte a byte o mesmo arquivo** (md5 `05454009fbc3ae864752a6bb18e53ac6`).

---

## Princípios que atravessam o plano

- **Cada passo tem aceite como fato observável, não "parece com o alvo".** Sem isso o plano cai no defeito que o [README](../active/README.md) descreve — *um plano que não consegue fechar um passo*. Pixel-diff contra o mockup **não serve** (cor/tipografia não vêm dele, e o protótipo reprova pelo menos um par AA); o instrumento é despejo de `getBoundingClientRect` durante o trabalho + revisão ao vivo nos dois temas ao fim de cada passo.
- **Persistir o harness de revisão Playwright** (o do DS-1 não foi persistido, e o DS-2 fechou sem ele). ⚠️ O padrão do Playwright é `colorScheme: 'light'` — usar `page.emulateMedia({ colorScheme })` ou o tema escuro nunca é exercitado (skill [`testing`](../../../.claude/skills/testing/SKILL.md)).
- **A guarda 8 do [`guard.mjs`](../../../.claude/hooks/guard.mjs)** vale a cada edição `.tsx`. Nenhum token de cor novo é necessário — `bg-ok` (ponto verde) e `border-accent-text` (barra de acento) já existem.
- **A escala de tipo (item 12) mexe só na superfície de leitura.** A mensagem já usa `--font-size-reading` (18px); o chrome fica em `--font-size-sm` (13px). **Nenhum token de `tokens.css` muda** (DS3.2).

---

## Passos

### Passo 0 — Registro e instrumentação (sem código de app)

- Este arquivo, com a tabela de diário (feito).
- **Corrigir os donos que ainda contradizem o alvo** (fonte única): a linha 3 e a linha 7 da tabela de distância do [handoff](../../reference/handoff-ds-ago2026/README.md); a linha do DS-3 no [`ROADMAP`](../../ROADMAP.md); e no [README](../active/README.md) a linha do DS-3 e a promessa "Mais os estados de `alvo/`".
- Persistir um script Playwright de revisão em `e2e/dev/` que despeja retângulos e captura os dois temas com `emulateMedia({ colorScheme })`.

**Aceite:** arquivo com diário; ponteiros corrigidos; as quatro linhas contraditórias nos donos consertadas.

### Passo 1 — `Sidebar`: cabeçalho (item 1)

`src/renderer/src/app/Sidebar.tsx`. Título **"Chat local"** à esquerda + botão de recolher à direita, na `row-start-1`. Preservar a transição de largura da D13.5.

**Aceite:** título visível; botão de recolher à direita; recolher/expandir anima na mesma duração; **recolhido não mostra o título nem estoura a largura** (a `row-start-1` está fora do `{!collapsed && …}`, então o título entra sob a condição de recolhido); `Sidebar.test.tsx` passa.

### Passo 2a — Extrair `useAiAvailability` (mecanismo, zero mudança visual)

Novo hook em `features/conversation/`, `useConversationChat.ts`, `ConversationView.tsx`. Extrair a leitura de `ai:isAvailable` de dentro do `useConversationChat` (hoje `useState`+`useEffect`) para um hook próprio, **espelhando `useAiModels`** (`useQuery`, chave `['ai','availability']`, `ViewState`). `useConversationChat` deixa de retornar `availability`; os cinco usos em `ConversationView` passam a ler do hook novo. Sem canal novo, dedupe do TanStack.

**Aceite:** a tela **não muda** (troca de mecanismo); disponibilidade/erro/loading iguais; `check:fast` verde; retângulos idênticos.

### Passo 2b — Rodapé de status + engrenagem (item 6)

`components/Versions.tsx`, `features/settings/Settings.tsx`, `App.tsx`, `ConversationView.tsx`.

- `Versions.tsx` vira o rodapé: ponto verde (`bg-ok` quando `status==='ready'`) + "Ollama (v{version})" + engrenagem. Electron/Chromium/Node saem da vista principal.
- **Remover a versão duplicada** que o header desenha (`ConversationView.tsx`), neste passo.
- Engrenagem = gatilho de Configurações movido para o rodapé: em `Settings.tsx` o botão vira ícone; em `App.tsx` o `<Settings/>` sai do slot `nav` e entra no `footer`.
- ⚠️ **O ponto verde precisa continuar vivo:** `staleTime: Infinity` global (`queryClient.ts`), então somar `['ai','availability']` à invalidação do ↻, **ou** o aceite declara o ponto como retrato do boot.

**Aceite:** rodapé com ponto + versão + engrenagem; Configurações abre pela engrenagem; versão do Ollama fora do header; `check:fast` verde.

### Passo 3 — `Button` variante `outline` + "Nova conversa" (item 2)

`shared/ui/Button/Button.tsx`, `features/conversation/NewConversationButton.tsx`. Criar a variante `outline` (fundo transparente, borda visível), **nascendo com seu consumidor**; ⚠️ cor/borda **não** vão no BASE (armadilha de ordem — DS-1). `NewConversationButton`: `outline`, `w-full`, `+` à esquerda.

**Aceite:** botão contornado, largura cheia, `+` prefixado; nenhum token de cor novo; `check:fast` verde.

### Passo 4 — `ConversationList`: agrupamento por data + barra de acento (itens 4, 5)

`ConversationList.tsx`, `conversations.ts`. Função pura **`groupByDate(conversations, now)`** (recebe `now`, não lê o relógio dentro — teste de nível 1 não pode depender da hora), grupos **Hoje/Ontem/Anteriores** por `updatedAt`; a ordem interna já vem do `ORDER BY updated_at DESC` do handler. Rótulos micro caixa-alta. **Barra de acento** à esquerda na ativa (`border-l-2 border-accent-text`) sem deslocar o título.

**Aceite:** conversa de hoje sob "Hoje"; ordem interna desc; barra de 2px na ativa; o título **não desloca** entre ativo/inativo (`dx`=0); ações no hover sem mover o título (nível 4); `conversations.test.ts` cobre `groupByDate`.

### Passo 5 — Campo de busca (item 3)

Input acima da lista; filtra **em memória** por título (case-insensitive), estado local. É filtro de cliente (nota de revisão de 12/08 do handoff), **não** a FTS5 do [`ROADMAP § 2`](../../ROADMAP.md). Nenhum IPC.

**Aceite:** digitar filtra; limpar restaura; **grupo sem resultado não desenha o rótulo**; `check:fast` verde.

### Passo 6 — `ConversationView`: forma das mensagens (itens 7, 10)

`ConversationView.tsx`. Mensagem do usuário → **bolha à direita**; assistente → **texto puro à esquerda**. Preservar densidade de leitura, `whitespace-pre-wrap`, `select-text`, `MarkdownMessage`.

- ⚠️ **Realocar o marcador D14.3 `stopped`.** Hoje é filho do `<span>` do rótulo de autor. `stopped` só existe em mensagem do **assistente** (`useConversationChat.ts`) — a que fica em texto puro e **não** ganha bolha. O lar é no bloco do assistente (legenda micro), nunca "na bolha". Removê-lo em silêncio apaga a decisão de distinguir "sem resposta" de "resposta cortada".
- Item 7 (título como cabeçalho) **já está feito** — só revisar o fallback do estado sem conversa.
- **Não** mexer no `useStickToBottom` nem trocar o elemento de rolagem.

**Aceite:** usuário em bolha à direita, assistente em texto puro à esquerda; marcador `stopped` visível e legível (D14.3 preservada); stick-to-bottom em streaming intacto (nível 4); `ConversationView.test.tsx` e `contextBudget.test.tsx` passam.

### Passo 7 — Desmonte da toolbar; seletor de modelo como pílula no composer (item 8)

**Fronteira natural de um eventual DS-4.** Maior acoplamento ao plano 15. `ConversationView.tsx`, `Composer.tsx`, `ModelSelector.tsx`.

- Mover o `ModelSelector` do header para **dentro do `Composer`**; header fica só com o título.
- **A "pílula" é o `<select>` atual reestilizado** (chevron nativo), **não** popover — preserva o nome acessível do `Field label="Modelo"`. Popover seria padrão novo do DS, com justificativa própria.
- ⚠️ **O que a pílula NÃO absorve fica fora dela:** os alertas `too-large`/`unaffordable` são `role="alert"` (recusas, não configuração); o ↻ é **sempre disponível** por decisão (instalar modelo é evento de sistema que o app não observa).
- ⚠️ **Fato:** o `ModelSelector` desenha o campo numérico de contexto, "até {N}k", "Contexto: N · travado" e os selos — **não** o medidor (o `<meter>` é do `Composer`, passo 8). A fiação de oito props do `ConversationView` continua.
- **Fixar por slot, não fundir:** `Composer` recebe o `ModelSelector` como `ReactNode` — fundir (155+210) daria ~365 contra o teto de 400.

**Aceite:** toolbar removida; a pílula abre o seletor com nome acessível intacto; alertas de recusa e ↻ visíveis fora da pílula; todos os estados do `contextWindow` renderizam (`locked`/`unaffordable`/`too-large`/`open` ao vivo); envio recusado ainda recusa; `modelSelection.test.tsx` e `contextBudget.test.tsx` passam. Nível 4 nos dois temas.

### Passo 8 — Composer arredondado; envio circular + pausa (item 9)

`Composer.tsx`, `Button.tsx`. Depende do passo 7. Composer vira contêiner arredondado único; "Enviar" → **ícone circular `↑`**; "Cancelar" → **pausa**. Criar a **forma circular** no `Button` **com seu consumidor**; ⚠️ `rounded-full` e o `rounded-md` do BASE são o mesmo grupo — o `rounded-md` **sai do BASE** e vira eixo `shape`. O clipe é do plano 16.

- ⚠️ **O alvo não mostra, mas não pode sumir:** o `<meter>` (D15.4) e o `<p role="alert">` de estouro (D15.5) vivem no `Composer`. Reescrever o DOM seguindo a imagem ao pé da letra os apagaria. Eles ficam.

**Aceite:** composer arredondado; envio circular `↑`; pausa em loading; Enter/Shift+Enter preservados; **medidor visível e envio recusado ainda recusa com o motivo na tela**; `contextBudget.test.tsx` passa; `check:fast` verde; nível 4 nos dois temas.

### Passo 9 — Fechamento

- Revisão pixel/retângulo persistida nos dois temas contra `alvo-chat.png`, com os desvios anotados: clipe e cartão de anexo = plano 16; credenciais de nuvem = plano 09; alternador de tema e threads 2/4/6 = recusados; **`OpenDatasetPanel` (item 13) permanece** — envelopado no DS-2, sai no plano 16.
- Medir bundle (CSS/JS).
- `check:fast` verde; diário preenchido; entrada em [`HISTORY.md`](../../HISTORY.md); **mover** este arquivo para `implemented/`.

**Aceite:** `alvo-chat.png` reproduzido no essencial nos dois temas; registro fechado.

---

## Decisões

### DS3.1 — Um plano só, composer por último, DS-4 preservado sem ser gasto

Não há fronteira de feature separando as duas metades (tudo é renderer, sem IPC novo), então o argumento de "aceite oposto" que fez de DS-1/DS-2/DS-3 três planos **não** se aplica aqui — DS-3 e um DS-4 teriam o mesmo aceite. Dividir agora decidiria sobre um palpite de tamanho e arriscaria duas metades desiguais. A ordenação por acoplamento ao plano 15 põe o composer/seletor nos passos 7–8; se a execução mostrar que são muitas sessões, movê-los para um `DS-4-*.md` custa um arquivo. Validado por dois revisores Opus e pelo próprio contrato escrito, que já listava o composer como DS-3.

### DS3.2 — A escala de tipo mexe só na superfície de leitura

O alvo mostra o texto maior que o chrome, e a mensagem **já** usa `--font-size-reading` (18px) contra os 13px de `--font-size-sm`. Subir a escala de chrome onduraria por toda a sidebar/header/composer/modal e reabriria a calibração de desktop da fase 05 — o maior raio de alcance do plano, e por gosto. Decisão do usuário: chrome fica 13px, **nenhum token de tipo muda**.

### DS3.3 — Nada do plano 15 desaparece ao mover o seletor

O alvo não mostra o medidor, o campo de contexto, os selos nem os alertas de recusa — mas todos são decisões registradas (D15.4, D15.5, D15.13). Seguir a imagem ao pé da letra os apagaria em silêncio. A pílula é o `<select>` reestilizado; o resto continua, fora da pílula onde for recusa (`role="alert"`) ou ação sempre-disponível (↻).

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 13/08/2026 | 1 | **Planejamento do DS-3.** Lidos os quatro donos de `docs/` e o handoff inteiro; invocadas as skills `design-system`, `architecture`, `testing`, `ipc`. Achado que reenquadrou o escopo: a tabela de distância inteira é renderer sem IPC/dado novo, logo não há fronteira de feature entre DS-3 e DS-4 (DS3.1). Decidido plano único (composer por último) e escala de tipo só na leitura (DS3.2). Validado por dois revisores Opus; achados incorporados (medidor é do `Composer` não do `ModelSelector`; a pílula não pode esconder os `role="alert"` nem o ↻; passo 2 dividido em 2a/2b; `groupByDate(…, now)` puro; lar do `stopped`; ponto verde não congela; armadilha de ordem do `rounded`). **Passo 0 iniciado:** este arquivo criado, ponteiros dos donos corrigidos | Passo 0 — persistir o harness Playwright, depois Passo 1 |
| 13/08/2026 | 2 | **Passos 0–9 — plano concluído.** Todos os passos executados, um commit por passo. Passo 1 (cabeçalho Sidebar); 2a (extração de `useAiAvailability`) — **desvio medido: `useState`+`useEffect`, não `useQuery`**, porque a cadência da query resolve o availability um tick depois do medidor e o gate do composer corria com o teste que digita (2 testes de contextBudget falhavam de forma não-determinística); 2b (rodapé de status + engrenagem; `OllamaStatus` novo, `Versions` intacto realocado ao modal; api-mock passa a resolver `app.info` realista); 3 (variante `outline`); 4 (`groupByDate` + 4 testes, barra de acento); 5 (busca por título); 6 (bolha à direita, `stopped` realocado sob o assistente); 7 (toolbar desmontada, `ModelSelector` como slot do `Composer`); 8 (eixo `shape` no Button, composer arredondado, envio circular). **Verificação em três níveis:** `check:fast` **340 testes** (333→340: +3 `OllamaStatus`, +4 `groupByDate`); **e2e dev 5/5** — o `persistence.spec` esperava o heading "Conversas" removido no passo 4 (consertado, e2e não roda no `check:fast`); **revisão visual ao vivo nos dois temas** (harness Playwright descartável, `emulateMedia`), tudo próximo do `alvo-chat.png`, modal centralizado com as versões movidas. Bundle: CSS **41,58 → 42,99 kB** (+1,41), JS **~1.558 → 1.563,68 kB** (+~5). Desvios documentados: `OpenDatasetPanel`/ABRIR ARQUIVO fica (plano 16); sem clipe/cartão (plano 16); sem nuvem (plano 09); sem alternador de tema/2-4-6 (recusados) | **DS-3 concluído.** Trilha DS encerrada; próximo é o arco (plano 16) |
