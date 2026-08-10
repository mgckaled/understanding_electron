# 13 — Casca do aplicativo

**Depende de:** [12 — Realce de sintaxe](../implemented/12-realce-de-sintaxe.md) · **Entrega:** `App.tsx` deixa de ser pilha de painéis. Duas colunas, sidebar recolhível em três regiões por slot, conversa em altura cheia, composer fixo. Cria conversa, troca entre elas, some ao fechar.

> Primeiro plano do [arco conversacional](../active/README.md#o-arco-conversacional-1320), nascido da [virada de ago/2026](../../HISTORY.md). **Renderer puro: nenhum canal de IPC novo.** Se `argsSchema` ou `IpcContract` aparecerem no diff, algo escorregou do plano 14 para dentro deste.

---

## O caso

Hoje `App.tsx` empilha quatro coisas verticalmente — um painel de boas-vindas do template, `OpenDatasetPanel`, `AiChatPanel` e `Versions` — e quem rola é o documento. Cada painel é dono do seu estado e nenhum fala com o outro.

O alvo é uma **casca**: a conversa é o aplicativo, o resto orbita. É o que o [`ESCOPO.md`](../../ESCOPO.md) passou a descrever, e nenhuma linha de código ainda reflete.

Duas coisas que este plano entrega além de layout, e que estão aqui por serem caras de retrofitar:

- **A forma de `Message`**, que atravessa `shared/ipc.ts`, preload, renderer e main. Mudá-la no plano 16 tocaria as quatro camadas mais as linhas já gravadas.
- **O primitivo de modal**, que não existe e que o arco vai reusar — confirmação de sobrescrita, detalhe de artefato. Ver [D13.8](#d138--configurações-é-modal-não-destino-de-navegação).

**Fora deste plano:** persistência (14), orçamento de contexto e escolha de modelo (15), anexo (16). O composer continua enviando texto para o `useAiChat` que já existe.

---

## Decisões tomadas

### D13.1 — A casca conhece regiões, não conteúdo

`src/renderer/src/app/` é pasta nova, e é a terceira do renderer — nem primitivo reusável (`shared/ui/`, onde há exatamente um de cada) nem domínio (`features/`, onde há um por assunto). A casca não é nenhum dos dois: existe uma só, e não tem domínio.

```
app/AppShell.tsx        grid de regiões
app/Sidebar.tsx         chrome: recolher, três regiões, rodapé
features/conversation/  ConversationList · ConversationView · Composer · store
App.tsx                 só composição — quem entra em qual slot
```

**A regra que faz isto sobreviver ao arco: `app/` nunca importa de `features/`.** Quem compõe é o `App.tsx`.

```tsx
<AppShell
  sidebar={<Sidebar nav={<AppNav />} content={<ConversationList />} footer={<Versions />} />}
  main={<ConversationView />}
/>
```

Assim o bloco de passos revisáveis do plano 18 e a tela de configurações entram por composição, sem tocar a casca — e a régua de 250 linhas do [`CLAUDE.md`](../../../CLAUDE.md) não estoura no plano 15.

**A sidebar tem três regiões, não uma.** Nav em cima, conteúdo no meio, rodapé embaixo. Os dois aplicativos de referência têm exatamente isso — o Claude Desktop com *Novo/Projetos/Artefatos* acima de *Recentes*, o mill.tools com uma trilha de ícones ao lado. Uma sidebar que é só "lista de conversas" é reestruturada no dia em que existir a segunda coisa, e a segunda coisa é deste plano.

**`features/ai-chat/` passa a ser `features/conversation/`.** O nome atual descreve o mecanismo; o objeto de domínio é a conversa, e o plano 14 vai criar canais `conversation:*` servidos por um `src/main/features/conversation/`. Renomear custa dois testes e nenhum e2e (nenhum spec referencia o caminho); a janela é agora, enquanto a pasta já está sendo mexida.

> ⚠️ `AppShell` que renderiza `<ConversationView/>` direto teria **o mesmo número de linhas** que a versão com slot. Slot aqui não é ponto de extensão — é a recusa a fixar, na distinção registrada em [`HISTORY.md`](../../HISTORY.md#decisão-flexibilidade-é-forma-de-dado-e-slot-nunca-ponto-de-extensão).

### D13.2 — Estado de cliente atrás de hooks de propósito, e o streaming fora do store

Context + `useReducer`, consumido por `useConversations()` e `useActiveConversation()`. **Nenhum componente chama `useContext` direto.**

A escolha usa a régua do projeto — *se eu adiar, quantos arquivos toco depois?* — a mesma que adiou o TanStack Query na [fase 06](../implemented/06-primeira-feature.md):

| Opção neste plano | O que o plano 14 reescreve |
|---|---|
| Props a partir de `App.tsx` | `App.tsx` + `ConversationList` + `ConversationView` + `Composer` = **4 arquivos** |
| Zustand | 1 arquivo, mas custa dependência para um problema de re-render que não existe nesta escala |
| **Context atrás dos hooks** | **1 arquivo** — o corpo do hook |

Props seriam honestas: com a composição por slots a árvore tem dois níveis, não há *drilling* profundo. Mas elas são reescritas de qualquer forma no plano 14, quando cada componente passar a chamar o cache de servidor direto. O selo custa ~40 linhas agora e faz o 14 tocar um arquivo.

**O texto em fluxo não entra no store.** O `useAiChat` de hoje já separa `streaming` de `turns` (o arquivo virou [`useConversationChat.ts`](../../../src/renderer/src/features/conversation/useConversationChat.ts) neste mesmo plano); essa separação é preservada, e o `streaming` fica local ao `ConversationView`. Só o turno concluído é commitado. Sem isso, cada token re-renderiza a lista de conversas inteira — não é otimização prematura, é não desfazer o que já está certo.

**A divisão que vale para o arco todo:** estado de **cliente** (conversa ativa, sidebar recolhida, rascunho, `jobId` em voo) fica no Context para sempre; **cache de servidor** (lista de conversas, mensagens) migra para TanStack Query no plano 14. Store de cliente guardando dado de servidor que envelhece sem ninguém saber é o erro que produz reescrita.

### D13.3 — `Message` é lista de partes tipadas, e a forma nasce agora

```ts
type MessagePart =
  | { kind: 'text'; text: string }
  | { kind: 'image'; ref: string }
  | { kind: 'dataset'; ref: string }
  | { kind: 'proposal'; ... }
  | { kind: 'result'; summary: ... }
```

**Neste plano só existe `text`.** As outras variantes não são escritas — o que se decide aqui é que a mensagem é uma **lista**, não uma string com anexos pendurados ao lado.

O motivo de não adiar: essa forma atravessa `shared/ipc.ts`, preload, renderer, main e, a partir do plano 14, linhas já gravadas em disco. É o caso 1 da régua de [`HISTORY.md`](../../HISTORY.md#decisão-flexibilidade-é-forma-de-dado-e-slot-nunca-ponto-de-extensão) — a categoria onde retrofitar toca trinta arquivos e uma migração. Uma decisão que serve artefato, anexo de dados e modalidade nova de uma vez.

Os tipos entram em `src/shared/ipc.ts` **sem schema zod e sem canal**: schema existe para validar payload de IPC, e não há IPC ainda. Ele nasce no plano 14, junto do canal.

> O `ChatMessage` atual (`{ role, content: string }`) **continua existindo** e é o que vai ao provedor — a fatia 1 o definiu e o adaptador Ollama o consome. O que nasce aqui é o tipo da mensagem **do aplicativo**. A tradução de um para o outro é função pura, e é onde o plano 16 vai pendurar a fronteira de privacidade dos três níveis.

### D13.4 — Configuração tem duas escalas, e o modelo não trava

| Escala | O que é | Exemplos | Onde mora |
|---|---|---|---|
| **Máquina** | não muda a resposta, muda o apetite do computador | `num_thread` | Configurações gerais |
| **Conversa** | muda o que o modelo responde | modelo, `num_ctx`, prompt de sistema | a própria conversa |

`num_thread` sai do `AiChatPanel` e vai para a tela de Configurações. O critério não é "raramente escolhido" — é que ele é propriedade **da máquina**. Guardá-lo por conversa faz reabrir uma conversa antiga restaurar um número de threads que não diz respeito ao computador de hoje, e mudar de ideia exige editar todas as conversas.

**O modelo é da conversa e não trava depois da primeira resposta.** Travar resolveria a transcrição com autoria misturada, mas num aplicativo de modelo local *"este 4B falhou, sobe para o qwen 7B"* é a principal ação de recuperação — e travar obriga a abrir outra conversa e recolar o contexto. A autoria se resolve com dado, não com proibição: **o modelo fica registrado em cada mensagem do assistente**, o que também deixa visível, numa conversa que deu errado, qual modelo produziu o quê.

> ⚠️ Trocar de modelo no meio **invalida o cache de prefixo do Ollama por inteiro** — o modelo novo reprocessa toda a história. Numa CPU sem GPU esse é o custo dominante. Este plano não implementa aviso nenhum (não há troca de modelo ainda); fica registrado para o plano 15, que é quem constrói o seletor.

**Consequência de esquema para o plano 14**, decidida aqui porque é barata agora: **o que a sidebar lista vira coluna; o que só a chamada ao modelo lê vira `settings` JSON.** Título e modelo são coluna; os botões vivem no JSON. Sem isso, cada botão novo (`num_ctx`, temperatura, `top_p`, prompt de sistema) custa uma migração.

### D13.5 — A página não rola; a lista rola e ancora

Hoje os painéis empilham e o **documento** rola. Numa casca o documento nunca rola: `height: 100%` na raiz, `overflow: hidden` na casca, e só a lista de mensagens com `overflow-y: auto`.

E o comportamento que todo chat erra na primeira tentativa: **a lista gruda no fim enquanto o modelo escreve, exceto se o usuário tiver rolado para cima.** Sem a exceção, fica impossível reler o começo de uma resposta enquanto ela chega. São poucas linhas decididas agora e um remendo se descobertas depois — a mesma classe da lição de densidade da [fase 05](../implemented/05-design-tokens.md): "cada diferença descoberta tarde é uma varredura por todo componente já escrito".

### D13.6 — O aplicativo tem duas densidades, e os títulos são relativos ao corpo

O commit da superfície de leitura (18px, `--font-size-reading`) tomou em silêncio uma decisão de design system que ninguém escreveu: **o chrome continua compacto — a densidade de desktop da fase 05 — e a superfície de leitura ficou generosa.** Isso é correto e é o que todo chat faz, mas precisava estar escrito: sem isso, o próximo componente não sabe de que lado está.

| | Densidade | Quem |
|---|---|---|
| Chrome | compacta, fase 05 | sidebar, nav, rodapé, controles do composer, toolbar |
| Leitura | `--font-size-reading` | mensagem do usuário, resposta do assistente, artefatos |

E o efeito colateral que o mesmo commit deixou: com o corpo em 18px, `h2` e `h3` caem os dois no tamanho do corpo, porque a escala não tem degrau entre 16 e 20. **A conferência visual do passo 6 da [fase 12](../implemented/12-realce-de-sintaxe.md) mostrou que isso não aparece na prática** — a diferença de peso basta nessa superfície. Então o que segue é **refinamento opcional, não conserto**; e se for feito, não é acrescentando degrau à escala — título de superfície de leitura é proporcional ao **tamanho de leitura**, não à escala de chrome:

```css
.markdown h1 { font-size: 1.4em; }
.markdown h2 { font-size: 1.2em; }
.markdown h3 { font-size: 1.05em; }
```

`em` dentro de `.markdown` resolve relativo a `--font-size-reading`, que já está no pai. Zero token novo, hierarquia restaurada, e se um dia o tamanho de leitura mudar, os títulos acompanham sozinhos. Acrescentar um degrau de 18 à escala renomearia todo degrau acima dele por causa de um consumidor.

### D13.7 — O destino dos três painéis, com o e2e mandando

| Componente | Destino | Por quê |
|---|---|---|
| Painel de boas-vindas | **apagado** | Resíduo do template. Nenhum spec o toca; o `openExternal` que ele exercita continua coberto pelo teste do handler e pelo `security-boundary.spec.ts` |
| `OpenDatasetPanel` | **seção da sidebar**, inalterado por dentro — perde só o embrulho `Panel` | `e2e/dev/open-dataset.spec.ts:27` clica em `'Escolher arquivo'` e espera o resumo visível. **Não é preferência: é um nível 4 verde que ficaria vermelho.** O plano 16 o move para o composer quando anexo virar escopo de conversa; mover um componente entre dois slots é barato |
| `Versions` | **rodapé da sidebar**, uma linha compacta | É onde o Claude Desktop põe a conta do usuário. Preserva o teste de nível 2 existente |

### D13.8 — Configurações é modal, não destino de navegação

Revisão da forma prevista no passo 5, feita antes de qualquer linha de código.

**Configuração é desvio, não destino.** Abre-se por causa do que se está fazendo — *"o modelo está lento, deixa eu baixar as threads"* — e volta-se exatamente ao mesmo ponto. Um destino de navegação **desmonta** o `ConversationView`; um modal o mantém visível atrás, e "não perdi meu lugar" deixa de ser algo em que confiar e passa a ser algo que se vê. É o que Claude Desktop e mill.tools fazem, e é a convenção da plataforma: configuração em rota é padrão de web, e a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) abre dizendo *"app de desktop não é site"*.

**O custo disto, que é o ponto honesto:** o aceite do passo 5 era *"a casca abriga duas coisas no mesmo slot"*. Com o modal, **nada além da conversa ocupa o `main` neste plano** — e todo o resto do arco (16, 18, 19) acontece *dentro* da conversa. O slot da D13.1 fica, porque custa zero linha; mas **deixa de ser reivindicado como provado**. Inventar uma segunda tela só para exercitá-lo seria exatamente a cerimônia que a [regra de flexibilidade](../../HISTORY.md#decisão-flexibilidade-é-forma-de-dado-e-slot-nunca-ponto-de-extensão) recusa — slot é a recusa a fixar, não um recurso a demonstrar.

O aceite passa a ser o **comportamento do modal**, que é verificável e entrega um primitivo que o arco reusa:

- **`<dialog>` nativo com `showModal()`** — camada superior, foco preso, `Esc` fecha, `::backdrop` estilizável. O Chromium 148 do Electron 42 tem tudo, e isso significa **nenhuma dependência**: mesma linha em que a [fase 10](../implemented/10-cor-contraste-e-tema-claro.md) recusou uma biblioteca de contraste por quinze linhas de aritmética.
- **Abrir não desmonta o `ConversationView`** — o modal é irmão na árvore, não substituto. É o que torna o aceite observável: uma resposta em fluxo continua chegando atrás.
- **Fechar não altera nada da camada de baixo**, e o foco volta ao gatilho.
- `prefers-reduced-motion` zera a transição, como a base da [fase 05](../implemented/05-design-tokens.md) já exige.

O primitivo nasce em `shared/ui/Dialog/` e não na feature: diferente do `MarkdownMessage` (que a D11.1 manteve dentro de `ai-chat` por ter um consumidor só), este já tem consumidor previsto fora — a confirmação de sobrescrita que o [`ESCOPO.md`](../../ESCOPO.md) exige antes de gravar sobre o arquivo de origem.

> ⚠️ Confirmar no Chromium do Electron 42 se o atributo `closedby` (fechar clicando fora sem handler próprio) está disponível — **ler o comportamento real, não o artigo**, na forma da lição registrada em [`HISTORY.md`](../../HISTORY.md). Se não estiver, o clique no `::backdrop` é tratado à mão.

### D13.9 — O título vem da primeira mensagem, truncado; não do modelo

A lista da sidebar precisa mostrar alguma coisa, e a conversa nasce antes de existir resposta. Três formas, e a escolha é de **custo**, não de gosto:

| Forma | Custo |
|---|---|
| `"Nova conversa"` + renomear na mão | grátis, mas uma sidebar de dez "Nova conversa" não distingue nada |
| **Primeira mensagem do usuário, truncada** | grátis, instantâneo, e é o que o usuário acabou de escrever |
| Pedir ao modelo um título | uma ida ao modelo a 4–6 tok/s, **competindo com a resposta que o usuário está esperando** |

Adotado: `"Nova conversa"` enquanto está vazia, substituído pela primeira mensagem truncada no envio, e **renomear disponível sempre**. O título é o campo que a D13.4 manda ser **coluna** (a sidebar o lista), não `settings`.

Título gerado por modelo não está descartado — está **caro**. O Claude e o ChatGPT fazem isso porque a ida ao servidor deles é barata; numa CPU sem GPU ela não é. **Gatilho para reabrir:** provedor de nuvem em uso (fatia 3 do [plano 09](../active/09-camada-de-ia.md)), quando a ida deixa de competir com a resposta.

---

## Passos

### Passo 1 — A casca, embrulhando o que já existe

`app/AppShell.tsx` e `app/Sidebar.tsx` nascem, e o `main` recebe **a pilha de painéis atual, inalterada**. A sidebar nasce com as três regiões vazias e o botão de recolher.

Junto vai a rolagem estrutural (D13.5, parte estrutural só — a ancoragem é do passo 4): `height: 100%` na raiz em `base.css`, `overflow: hidden` na casca. E dois tokens de medida em `tokens.css` — largura aberta e recolhida —, porque a animação de recolher e a largura persistida do plano 14 leem o mesmo número.

> Este passo é o que mantém os e2e verdes por construção: nada do conteúdo mudou de lugar ainda.

**Aceite:** `pnpm dev` abre com duas colunas; a sidebar recolhe e volta; o documento não rola em nenhum tamanho de janela; `pnpm test:e2e:dev` 4/4.
**Commit:** `feat(renderer): casca de duas colunas com sidebar recolhível`

### Passo 2 — Cada painel no seu lugar

`OpenDatasetPanel` para a seção de conteúdo da sidebar, `Versions` para o rodapé, painel de boas-vindas apagado. `main` fica com o `AiChatPanel` sozinho, em altura cheia.

E o renome `features/ai-chat/` → `features/conversation/` (D13.1), com os dois testes acompanhando.

**Aceite:** `pnpm check:fast` verde; `pnpm test:e2e:dev` 4/4 — em especial `open-dataset.spec.ts`, que continua achando `'Escolher arquivo'`.
**Commit:** `refactor(renderer): painéis nas regiões da casca, ai-chat vira conversation`

### Passo 3 — O tipo e o store

`Conversation`, `Message` e `MessagePart` em `src/shared/ipc.ts` — **tipos apenas**, sem schema zod, sem canal (D13.3). O Context com `useReducer` e os hooks `useConversations()` / `useActiveConversation()` em `features/conversation/`.

Nenhuma UI muda neste passo. O que entra são as ações discretas: criar, selecionar, renomear, excluir, acrescentar mensagem.

**Aceite:** `pnpm typecheck` limpo nos dois projetos; teste do reducer cobrindo as cinco ações, incluindo excluir a conversa ativa (que precisa eleger outra ou voltar a nenhuma).
**Commit:** `feat(renderer): tipo da conversa e store de estado de cliente`

### Passo 4 — Lista de conversas, troca, e a ancoragem

`ConversationList` na região de conteúdo da sidebar; `ConversationView` lendo a conversa ativa em vez do estado local. O `streaming` fica local (D13.2).

E a ancoragem da rolagem (D13.5): gruda no fim durante o fluxo, solta se o usuário subiu.

**Aceite:** criar duas conversas, conversar nas duas, alternar entre elas e ver cada histórico preservado; rolar para cima durante uma resposta e a lista **não** puxar de volta; teste de nível 2 da troca de conversa.
**Commit:** `feat(renderer): lista de conversas com troca e rolagem ancorada`

### Passo 5 — O primitivo de modal e as configurações gerais

`shared/ui/Dialog/` nasce com `<dialog>` nativo (D13.8). A região de nav da sidebar ganha *Nova conversa* e o gatilho de Configurações; o `main` continua sendo a conversa, sempre.

O conteúdo do modal recebe o `num_thread`, que sai do painel de chat (D13.4) e não tem outro lugar para ir — então a tela nasce fazendo alguma coisa, não como espaço reservado.

**Aceite** — o mais importante do plano, porque é exatamente o que um destino de navegação quebraria: com uma resposta **em fluxo**, abrir Configurações, alterar `num_thread` e fechar; a resposta segue chegando atrás, sem remontagem e sem perder um token. Somado a: `Esc` fecha, o foco volta ao gatilho, e o valor novo chega na chamada seguinte ao Ollama (verificação ao vivo, com o serviço no ar).
**Commit:** `feat(renderer): primitivo de modal e configurações gerais`

### Passo 6 — A superfície de leitura

Os três títulos do markdown em `em` (D13.6), fechando o achado que o commit da superfície de leitura deixou aberto. E a tabela das duas densidades registrada na skill [`design-system`](../../../.claude/skills/design-system/SKILL.md).

**Aceite:** `h1`, `h2` e `h3` visivelmente distintos numa resposta real, nos dois temas; `pnpm check:fast` verde.
**Commit:** `feat(design): títulos do markdown proporcionais à superfície de leitura`

---

## O que este plano deixa registrado para o 14

Decisões tomadas aqui que o plano seguinte herda em vez de redescobrir:

- **`settings` como JSON, não coluna por botão** (D13.4) — o que a sidebar lista vira coluna.
- **O modelo é registrado por mensagem**, não só por conversa (D13.4).
- **`Message` é lista de partes** (D13.3) — o armazenamento pode começar como JSON numa coluna e virar tabela própria no plano 18, porque o `PRAGMA user_version` resolve; a **forma do tipo**, não.
- **O corpo do hook é o único ponto de troca** (D13.2) — o cache de servidor entra em `useConversations()`, e nenhum componente muda.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 9 ago 2026 | 1–6 | **concluído** | Plano inteiro numa sessão. `check:fast` verde (172 testes, 24 arquivos), `test:e2e` 4/4 em cada passo. Quatro achados subiram para o [`HISTORY.md`](../../HISTORY.md) na mesma sessão: a corrida do listener de `scroll` na ancoragem, o `<dialog>` ausente do jsdom, a emulação de `prefers-color-scheme` do Playwright, e o `core.autocrlf` sem `.gitattributes`. Três desvios do plano, todos deliberados: **(a)** *Nova conversa* entrou no passo 4, não no 5 — o aceite do 4 é "criar duas conversas e alternar", e sem o botão não há como chegar à segunda; **(b)** o composer ganhou Enter-para-enviar, além da letra do plano, porque um composer em que Enter não faz nada é defeito achado no primeiro minuto; **(c)** o `.gitattributes` foi feito fora do plano, em commit isolado, a pedido — 485 avisos de lint que não eram do repositório. O ponto aberto da D13.8 fechou por medição: Chromium 148.0.7778.280, `closedBy` no IDL, reflete `"any"` — nenhum tratamento manual de clique no `::backdrop`. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [12 — Realce de sintaxe](../implemented/12-realce-de-sintaxe.md) · **Índice:** [README](../active/README.md) · **Camada de IA:** [09 — Camada de IA e ML](../active/09-camada-de-ia.md)
