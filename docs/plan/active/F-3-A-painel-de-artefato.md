# F-3-A — Painel de artefato: a terceira região, documento e imagem

> Terceiro item da **trilha F (features avulsas, fora do arco)**, e o primeiro dela a nascer dividido — `F-3-A`/`F-3-B`/`F-3-C`, na forma que o [N-1](../implemented/N-1-A-segredo-de-nuvem.md) já usou. A trilha é definida **por exclusão** (nem arco, nem envelope, nem refatoração), e este plano satisfaz a definição: é feature nova, não pertence ao arco 13–20 e nada no arco espera por ele. Peso não é critério da trilha — se fosse, o 18 não teria virado seis.
>
> ⚠️ **A sigla `F-3` estava reservada para outra coisa.** O [`F-2`](../implemented/F-2-composer-modelo-sidebar.md) § *Fora do escopo deste plano* deixou "F-3" apontando para uma tabela de custo de contexto por modelo nas Configurações. Aquele trabalho passa a ser **F-4**, e a linha do F-2 é corrigida no passo 1 — numeração aqui segue a ordem em que os planos são **escritos**, como DS-1…DS-8 e 18-A…18-F já fizeram.

**Origem:** pedido do usuário (26/08/2026), com três capturas — o painel de arquivo do Claude Desktop abrindo pela direita, uma variante do mesmo padrão, e o cartão recolhido de um `.webp` que deve **sobreviver** na transcrição como histórico do chat.

**Entrega:** uma terceira região na casca, aberta pela direita ao clicar num cartão de anexo, com cabeçalho (nome, copiar, fechar) e corpo para **documento e imagem**. Estado de janela em contexto próprio, sem persistência. Nenhum canal IPC novo. Uma linha de CSP alterada, deliberadamente (DF3A.7).

---

## O corte, e por que o dataset não está aqui

| | Entrega | Por que aqui |
|---|---|---|
| **F-3-A** (este) | A região, o estado, `ArtifactRef`, cabeçalho, documento e imagem, cartões viram gatilho | Casca pura, zero IPC. Termina com o painel **funcionando** |
| **F-3-B** | Arrasto com limites, atalho de teclado, seletor de anexos no cabeçalho, transição e acabamento | Todo o dinamismo junto, sem competir com estrutura |
| **F-3-C** | Dataset entra — pré-visualização, perfil, consulta e passos saem da bolha | Único que toca a camada de dados; único com pergunta em aberto (paginação) |

**Código não entra em nenhum dos três.** O pilar não existe mecanicamente: `src/main/features/document/handlers.ts:27` filtra `['txt','md','pdf']`, nenhuma extensão de código-fonte passa pelo seletor (gap F2.8 no [`ROADMAP`](../../ROADMAP.md)). Quando nascer, entra pelo contrato que o `DF3A.2` fixa, sem tocar o painel.

O motivo de A e B virem antes de C: as decisões que o usuário tomou (teto de 50%, arrastar, sumir ao trocar de conversa) são sobre **o painel**, não sobre dataset. Entregar o painel sem redimensionamento seria meia experiência; entregá-lo com dataset junto repetiria o erro medido do plano 19 (sete passos num arquivo só, 950k tokens, defeitos que só o teste ao vivo pegou).

---

## O que foi checado contra o código real antes de virar plano

Convenção da trilha: nada abaixo é suposição.

| Afirmação plausível | O que existe de fato |
|---|---|
| "É só criar o painel" | **O `ESCOPO.md` diz o contrário, hoje.** Linha 124: *"o que seria 'aba de pré-visualização' é um bloco preso à mensagem em que o arquivo foi anexado, e some da vista junto com ela"*. Este plano contradiz um fato escrito, e por isso a revisão é o passo 1, não uma nota de rodapé |
| O corpo do anexo já está separado do cartão | Não está. `DatasetCard` renderiza `DatasetPreview` + `DatasetQueryPanel` + `DatasetProfile` + o formulário de passos **dentro da bolha**, em `max-w-[80%]`; `DocumentCard` expande o texto num `max-h-[400px]`; `ImageCard`, a imagem num `max-h-[280px]`. Os três têm `useState(expanded)` próprio |
| Vai precisar de canal IPC novo | **Não.** `DocumentPart.text` já carrega a extração inteira inline (D17.2), e a imagem já resolve por `attachment://<hash>` (D17.6). Este é o motivo real de documento e imagem virem primeiro |
| `fetch('attachment://…')` funciona, já que o protocolo tem `supportFetchAPI: true` | **Funciona no protocolo e é bloqueado pela CSP.** `src/renderer/index.html` declara `img-src 'self' data: attachment:` — por isso o `<img>` carrega — mas **não declara `connect-src`**, que cai no `default-src 'self'`. Copiar bytes de imagem exige alterar a CSP (DF3A.7) |
| O `AppShell` vai precisar saber a largura do painel | Não, e não deve. Terceira faixa `auto` + largura no próprio painel mantém a regra "a casca conhece regiões, não conteúdo" (D13.1) e evita levar estado de `features/` até `app/`, que a skill [`architecture`](../../../.claude/skills/architecture/SKILL.md) proíbe |
| Dá para escrever `grid-cols-[…var(--w)]` no Tailwind | Valor vindo de estado não existe na varredura estática. A **própria doc do Tailwind v4** manda usar `style` para `grid-template-columns` complexo (*"Inline Styles for Complicated Arbitrary Values"*, confirmado via Context7 em 26/08/2026). `guard.mjs` só recusa **cor** literal em `style={{}}`; largura passa |
| `min-w-0` resolve o encolhimento da faixa | Não neste projeto — a base `--spacing` está desligada e a forma numérica **não emite nada** (medido, comentado no `AppShell`). É `min-w-[0px]` |
| Abrir o painel é inofensivo para a rolagem da conversa | **É o risco técnico do plano.** `useStickToBottom` detecta rolagem do usuário comparando `scrollTop` com onde o deixou (`MOVED_TOLERANCE = 1`), justamente porque o evento `scroll` é assíncrono. Mudar a largura reflui a thread, muda `scrollHeight`, e o navegador pode reajustar `scrollTop` — o hook leria isso como *"o usuário rolou"* e **desancoraria sozinho**. Nenhum teste de nível 2 pega: jsdom não tem layout |
| `ConversationView` precisa ser dividido antes | Não — este plano **não o toca**. Ele está em 407 linhas contra um teto de 400, o que é real e pré-existente; a régua diz *"divide-se ao tocar"*, e o F-3-C é quem vai tocá-lo |
| Os ícones existem | Conferidos no pacote instalado (`lucide-react@1.31.0`): `copy`, `check`, `x`, `chevron-right`, `panel-right` |

---

## Decisões

### DF3A.1 — O artefato ganha uma lente, e continua preso à mensagem

Revisão do [`ESCOPO.md`](../../ESCOPO.md) § *A conversa é a interface*, linha 124.

A frase original recusava **aba fixa de bancada**, e essa recusa continua de pé. O que ela não previu é a diferença entre *onde o artefato mora* e *onde ele é olhado*. O painel não é destino: nasce de um clique num cartão, **morre ao trocar de conversa**, não persiste e não tem estado próprio que sobreviva à conversa — que é exatamente o teste que o `ESCOPO` já aplica ao gráfico (*"se precisar de estado próprio que sobreviva à conversa, virou painel, e painel está fora"*). O artefato continua preso à mensagem; o painel é uma **lente efêmera** sobre ele.

**Não abre uma 6ª revisão de escopo.** É um parágrafo, não um reposicionamento — vira esta decisão, edita a linha, e ganha uma entrada no [`HISTORY.md`](../../HISTORY.md) ao fechar o plano. Rotular de "revisão" prometeria mais do que a mudança entrega.

> Registro honesto de como isso chegou aqui: a linha 124 afirmava uma decisão que o dono do projeto não tomou — texto gerado que passou a valer sozinho. É a mesma família dos achados de 25–26/08 (`Disclosure`, `formatCell`, `checkLevel3`), com a diferença de que aqueles contradiziam o código e este contradizia o usuário.

### DF3A.2 — `ArtifactRef` é união própria, nunca `AttachmentPart`

Esta é a decisão que determina se o **gráfico do plano 20** encaixa de graça ou exige cirurgia.

Gráfico e resultado **não são anexos**: nascem de uma mensagem, não de um arquivo. Se o painel receber `AttachmentPart`, o dia do gráfico é o dia de refazer a fronteira. Ele recebe uma união discriminada própria, em `src/renderer/src/features/artifact/`, na qual `document` e `image` são dois membros entre os nove que o [`ESCOPO`](../../ESCOPO.md) § *A conversa é a interface* já cataloga.

Cada membro carrega **o que seu corpo precisa**, e todos carregam `id: string` — para o cartão saber que é ele o aberto. Para anexo, `id` é o `hash`. Dois cartões do mesmo arquivo compartilham hash e ficariam ambos marcados: **é o comportamento correto**, não um defeito — o painel mostra conteúdo idêntico, e os dois cartões são de fato aquele conteúdo.

Vive no renderer, não em `src/shared/`: é como o renderer decide desenhar, e o main não tem opinião sobre isso — mesmo argumento que mantém `ViewState` fora de `shared/`.

### DF3A.3 — O corpo já nasce podendo ser assíncrono

Documento e imagem são **síncronos** — o texto já está na parte, a imagem resolve pelo protocolo. Dataset é assíncrono, paginado e com erro possível.

Se o contrato do corpo for desenhado contra o caso fácil, o F-3-C o quebra. Então o slot do corpo já aceita renderizar `StateView` desde agora, mesmo que os dois primeiros inquilinos nunca usem. **É a única concessão a um consumidor futuro neste plano** — e ela cabe porque é forma de dado, não ponto de extensão: nenhum registro de tipos, nenhuma barra de ações extensível, nenhuma segunda tela para provar que o slot funciona.

### DF3A.4 — A largura mora no estado desde já, entregando valor fixo

O `F-3-B` traz a alça de arrasto. Se o `F-3-A` chumbar a largura no CSS, o B reescreve o A.

A largura é um número no contexto, aplicado por `style` no próprio painel, com os limites já em `clamp()`:

```
largura = clamp(22rem, <estado>, min(50vw, 100vw - 32rem))
```

O teto de 50% é o do usuário. **O piso e o segundo termo do `min` são o que impede o caso feio:** numa janela de 1100px, 50% deixaria a conversa em 550px e as bolhas de `max-w-[80%]` virariam tiras. A conversa nunca desce abaixo de uma coluna legível, mesmo que isso custe ao painel.

⚠️ **Os quatro números são provisórios e se confirmam no passo 5, ao vivo.** `100vw` não desconta a sidebar — se o `32rem` se mostrar apertado com a sidebar expandida, o ajuste é aqui e não em outro lugar.

### DF3A.5 — Estado de janela, em contexto próprio, sem persistir

Irmão de "sidebar retraída", não de "conversa". Não sobrevive ao reinício (decisão do usuário) e **fecha ao trocar de conversa ou criar uma nova** — o provider observa a conversa ativa do `conversationsContext` e limpa.

Não pode morar no cartão: o cartão desmonta ao trocar de conversa, e o painel precisa saber que morreu. Segue a D13.2 — estado de cliente atrás de hook de propósito.

A API do contexto é `open(ref, trigger?)` / `close()` / `current`. O segundo argumento é o elemento DOM que disparou a abertura, entregue pelo próprio cartão — é o que torna a DF3A.8 possível sem procurar nó por `id` no documento.

### DF3A.6 — A seta do cartão muda de direção, e o cartão perde `expanded`

O cartão **sobrevive** na transcrição como histórico (decisão do usuário). O que muda:

- `ChevronDown` → `ChevronRight`. A direção passa a codificar *para onde o conteúdo vai*: baixo era "expande aqui", direita é "abre ao lado". Afordância honesta, e é uma linha por cartão.
- `useState(expanded)` **sai** de `DocumentCard` e `ImageCard`, junto com o `max-h-[400px]` e o `max-h-[280px]`. Os dois viram botões puros.
- Clicar no mesmo cartão fecha; clicar em outro **troca sem fechar** — o painel não pisca entre um anexo e outro.
- O cartão aberto se marca com `aria-current`, não com `aria-expanded`: nada expande mais, e uma etiqueta que mente é pior que nenhuma. Visualmente, a mesma composição que a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) já fixa para item selecionado.

### DF3A.7 — `connect-src 'self' attachment:` entra na CSP, deliberadamente

Copiar um documento é copiar `part.text`. Copiar uma **imagem** exige os bytes, e o único caminho até eles no renderer sandboxed é `fetch('attachment://<hash>')` → `ClipboardItem`. Hoje isso é bloqueado: a CSP não declara `connect-src`, então ele herda `default-src 'self'`.

A alternativa sem CSP — desenhar o `<img>` já renderizado num `<canvas>` e usar `toBlob()` — **não funciona**: esquema diferente é origem diferente, o canvas fica *tainted* e `toBlob` lança `SecurityError`.

A mudança é estreita e coerente com o que já está autorizado: `attachment:` já é confiável em `img-src`, serve **apenas** blobs locais de `userData` endereçados por hash, e o handler valida o hash antes de ler. Declarar `connect-src 'self' attachment:` não alarga a superfície além do que o `img-src` já concede.

⚠️ **Duas consequências que não podem ficar implícitas:** a tabela de segurança do [`CLAUDE.md`](../../../CLAUDE.md) resume a CSP como `default-src 'self'` e passa a estar incompleta — atualiza junto, no mesmo commit. E se a linha se mostrar problemática no passo 5, o recuo barato é **desabilitar copiar para imagem** e manter para documento, não inventar um canal IPC para bytes que o protocolo já serve.

### DF3A.8 — Foco de ida e de volta, e `Esc`

O painel **não é modal** — o usuário precisa poder clicar de volta na conversa com ele aberto. Então não há foco preso, e ele não é um `Dialog`.

O que existe: abrir move o foco para o painel; `Esc` fecha **e devolve o foco ao cartão que o abriu** (o `trigger` guardado na DF3A.5). Sem a volta, quem navega por teclado abre o painel e some no vazio. São poucas linhas e é a diferença inteira entre "funciona" e "é um app de desktop".

---

## Passos

Cada passo é commitável sozinho.

### 1. A revisão de escopo, antes de qualquer código

`ESCOPO.md` linha 124 reescrita conforme DF3A.1; `F-2` § *Fora do escopo* passa a apontar **F-4**; `ROADMAP` ganha a linha do F-3. Commit isolado — a mudança de escopo é uma decisão, não um efeito colateral de código.

### 2. A terceira faixa e o estado

`AppShell` ganha o slot `artifact` e a faixa `auto` (`grid-cols-[auto_minmax(0,1fr)_auto]`), sem saber largura nenhuma. `features/artifact/` ganha contexto, provider e `useArtifact`, espelhando `conversationsContext`. `App.tsx` compõe. O painel ainda é um retângulo com o nome do arquivo.

Testes de nível 2: abre, fecha no mesmo cartão, troca entre dois, some ao trocar de conversa.

### 3. O painel: cabeçalho e os dois corpos

`ArtifactPanel` com cabeçalho (mesmo ícone e mesmo nome do cartão, para o olho ligar os dois), copiar com confirmação visível (o ícone vira `Check` por ~1,2s — copiar sem retorno é a ação mais insatisfatória que existe) e fechar. Corpo despachado por `kind`, na mesma forma que `AttachmentCard` já usa. `connect-src` na CSP e a tabela do `CLAUDE.md` (DF3A.7).

**O cabeçalho leva um título simples, não um gatilho preparado.** O seletor é do F-3-B e nasce lá — slot é recusa a fixar, não recurso a demonstrar.

Os três estados sem graça, que ninguém lembra e todo mundo encontra: documento com texto vazio (PDF que não extraiu nada), imagem cujo `attachment://` falha, e conversa sem nenhum anexo. Cada um com uma frase em português, nenhum com painel em branco.

### 4. Os cartões viram gatilho

`DocumentCard` e `ImageCard` conforme DF3A.6. `DatasetCard` **não muda** neste plano — continua expandindo inline até o F-3-C. Suítes dos dois cartões reescritas: o que testava "expande o texto" passa a testar "chama `open` com o `ref` certo".

### 5. Foco, `Esc` e a prova ao vivo

DF3A.8, e então `pnpm dev` com um `.md`, um `.pdf` e um `.png` reais. O que só a tela responde:

- **o `useStickToBottom` sobrevive à mudança de largura?** Abrir o painel com a thread rolada até o meio, e com ela ancorada no fim durante uma resposta em streaming. Se desancorar, o conserto é reconhecer o reflow — e vira armadilha escalonada, não remendo local.
- os quatro números da DF3A.4, com a sidebar expandida e retraída;
- contraste e quebra dos botões do cabeçalho — defeito recorrente registrado, e jsdom não pega;
- copiar imagem de verdade, colando fora do app.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo no passo 5, com os três formatos.
- Nível 2 cobre estado, despacho e teclado. **Não cobre** largura, `clamp`, reflow nem foco visível — jsdom não tem layout nem CSS, e afirmar o contrário seria teste que passa com o defeito presente.

---

## Fora do escopo deste plano

| | Onde vai |
|---|---|
| Arrasto, atalho de teclado, seletor de anexos, transição de abertura | `F-3-B` |
| Dataset no painel, e a pergunta da paginação | `F-3-C` |
| Código como artefato | nenhum dos três — o pilar não existe (`document:pick` não aceita) |
| Gráfico como artefato | plano 20 do arco; encaixa pelo contrato da DF3A.2 |
| Dividir `ConversationView` (407/400) | quem tocá-lo — hoje, o `F-3-C` |

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 26/08/2026 | — | plano escrito e revisado, ainda não executado | Escrito lendo o **código** (cartões, `AppShell`, `useStickToBottom`, CSP, protocolo de anexo), não os planos anteriores. Context7 (`tailwindcss.com`) confirmou que `grid-template-columns` com variável é caso de `style` inline pela doc oficial, não de classe arbitrária. Dois achados que mudaram o plano antes de ele existir: a CSP bloqueia `fetch('attachment:')` apesar de o protocolo permitir, e o `useStickToBottom` pode ler um reflow de largura como rolagem do usuário. |
