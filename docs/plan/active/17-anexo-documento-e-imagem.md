# 17 — Anexo: documento e imagem

**Depende de:** [16 — Anexo: o mecanismo, e o dataset como primeiro consumidor](../implemented/16-anexo-mecanismo-e-dataset.md) · **Entrega:** os extratores de `.txt`/`.md`/`.pdf` e de `.png`/`.jpeg`/`.svg`/`.webp`, a materialização de `MessagePart[]` para o provedor migrada para o main (necessária só por causa de imagem), o gate de `vision` nos dois pontos que `hasCapability` já promete atender, e o popover do composer com as três categorias completas.

> Quinto plano do arco conversacional (13→20). O 16 construiu o mecanismo sabendo que só existia dataset, de propósito — para não nascer com forma de dataset. Este plano é a cobrança dessa aposta: dois consumidores novos sobre um mecanismo não reescrito.

**Fora deste plano:** `/api/ps` em Configurações — já entregue em ago/2026 (`ai:loaded`/`ai:unload`, antecipado do 17 pelo motivo registrado em `docs/plan/active/README.md`). DuckDB e nível 2 de verdade (18). Múltiplos anexos por mensagem (D17.3, escopo recusado, não esquecido).

---

## Contexto

A conversa hoje só vê duas coisas: texto e um dataset tabular. `docs/ESCOPO.md` já fixa, como especificação de produto, que documento (`.txt`/`.md`/`.pdf`) e imagem (`.png`/`.jpeg`/`.svg`/`.webp`) entram como material de contexto — lidos, nunca tratados, nunca exportados — e que os dois são **nível 3 por construção**: não existe "perfil agregado" de um PDF, então todo anexo desse tipo já nasce com a exposição máxima ao modelo, sem meio-termo possível.

O gatilho é de produto: sem isto, a promessa central do app ("a pergunta real quase nunca é só sobre o CSV — é sobre o CSV **e** a especificação que diz o que cada coluna deveria conter") não se cumpre. O usuário pediu também, na sessão em que este plano nasceu, um redesenho do ponto de entrada — o botão de anexo no composer, até então um clipe que já abria um popover (só que direto para escolher um dataset), precisa virar um "+" cujo popover mostra três categorias, replicando a estética do menu kebab da lista de conversas.

Por que este plano não abre com uma medição, ao contrário do 16: os custos que decidiriam algo aqui (prefill de texto 25-29 tok/s, 3,7 char/token em português, +270 tokens/~80s por imagem independente de dimensão, ~3s em turno seguinte com cache de prefixo, teto prático de ~8k tokens) já estão medidos e fixados em `docs/ESCOPO.md`/`docs/HISTORY.md`. O único número que faltaria — custo de token de um documento — não precisa de medição prévia porque o texto entra **verbatim**, nunca resumido: é aritmética que `core/ai/budget.ts` já faz.

---

## Decisões

### D17.1 — Quatro canais novos, não dois

`dataset:pick` tem um filtro fixo (`csv/tsv/txt`) que não serve nem a documento nem a imagem — então cada categoria precisa do seu próprio par `pick`/`attach`, espelhando o par que já existe: `document:pick`+`document:attach`, `image:pick`+`image:attach`. Quatro canais, cada um tocando os seis pontos que a skill `ipc` exige (`argsSchema`, `IpcContract`, `Api`; handler exportado; `register-all.ts`; `preload/index.ts`; mock em `test/api-mock.ts`). Um canal unificado (`attachment:attach` com `kind` no payload) foi considerado e descartado: obrigaria despacho interno por tipo que `register-all.ts` já faz de graça ao escolher qual função chamar por canal.

### D17.2 — Assimetria deliberada entre `documentPartSchema` e `imagePartSchema`

```ts
export const documentPartSchema = z.object({
  kind: z.literal('document'),
  hash: z.string().min(1),
  fileName: z.string().min(1),
  format: z.enum(['txt', 'md', 'pdf']),
  text: z.string() // extraído — inline, não rederivado
})

export const imagePartSchema = z.object({
  kind: z.literal('image'),
  hash: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg'])
  // SEM bytes — lidos de userData/attachments/<hash> a cada envio
})
```

Documento carrega o **texto extraído inline**, pela mesma razão que dataset carrega `columns`/`rowCount` inline: o extrator roda **uma vez**, no anexo; o que não pode se repetir é a extração (`unpdf`), não o reenvio — o chat é sem estado e todo turno já reenvia a conversa inteira. Teto prático medido (~8k tokens / ~30kB) garante que o texto inline não pesa na coluna JSON do SQLite. **Consequência que se propaga pelo resto do plano: documento resolve sua própria pré-visualização de graça** (o texto já está no `Message[]` que o renderer recebe via `conversation:messages`); **imagem não resolve nada de graça** — é o motivo de D17.5/D17.6 existirem, e é onde está todo o peso arquitetural extra deste plano comparado ao 16.

Imagem carrega só `hash`/`fileName`/`mimeType`; os bytes ficam em `userData/attachments/<hash>` e são lidos **a cada envio**, não só no anexo — o cache de prefixo que faz o turno 2 custar ~3s em vez de ~80s é do Ollama, casando bytes de request idênticos; o app ainda precisa colocar os bytes no corpo a cada turno para o provedor reconhecer o prefixo. Base64 inline no `MessagePart` infla o SQLite sem necessidade — a leitura de disco local é barata.

### D17.3 — Anexo continua único por mensagem; multi-anexo é escopo recusado, não esquecido

`Composer` guarda `attachment: X | null` hoje — um slot, não uma lista. Este plano não abre isso para N anexos por mensagem (nem para "um de cada tipo simultâneo"). `MessagePart[]` já permite múltiplas partes por construção, mas o *slot pendente do composer* é estado de UI, e `docs/HISTORY.md` já tem o número que mostra o custo de relaxar isso sem necessidade: duas imagens na mesma mensagem custam 529 tokens/158s, linear, sem otimização de cache entre elas. Multi-anexo é uma feature própria — sem gatilho declarado além de pedido real de usuário.

### D17.4 — `AttachmentPart` generalizado uma vez, no passo do documento

Hoje `AttachButton`/`Composer`/`useConversationChat.send`/`ConversationView` conhecem `DatasetPart` por nome, em quatro lugares. Este plano introduz `export type AttachmentPart = DatasetPart | DocumentPart | ImagePart` em `shared/ipc.ts` **no passo 2** (documento, o primeiro momento em que existe um segundo `kind`) e substitui `DatasetPart | null` por `AttachmentPart | null` nesses quatro lugares nesse mesmo passo. O passo de imagem herda o slot já genérico — só adiciona o terceiro membro da união e um `case` novo onde já existe um dispatcher. Sem esta decisão, a generalização seria refeita (provavelmente de formas discretamente diferentes) duas vezes.

Consequência de implementação: `Composer.tsx` hoje chama `formatDataCard(attachment).length` direto para contar caracteres do anexo pendente. Isso passa a chamar `partForProvider` (hoje interna a `core/ai/messages.ts`, passa a ser exportada) — é literalmente o mesmo texto que vai ao provedor, uma função só em vez de duas em paralelo.

`ConversationView.tsx`'s `datasetPartOf(message)` generaliza para `attachmentPartOf(message): AttachmentPart | null`; `<DatasetCard part={attachment} />` vira `<AttachmentCard part={attachment} />` (novo, em `features/attachment/`), um dispatcher que escolhe `DatasetCard`/`DocumentCard`/`ImageCard` por `part.kind`.

### D17.5 — `ai:chat` passa a carregar `Message[]`; o main materializa; ler do SQLite em vez de receber pelo IPC foi descartado

**Achado ao ler o código, não hipótese:** `toChatMessages`/`partForProvider` (`core/ai/messages.ts`) é chamado hoje **no renderer**, dentro de `useConversationChat.ts`, antes de invocar `ai:chat`. Funciona para `text`/`dataset`/`document` (formatação pura de string). **Quebra para `image`**: o renderer é sandboxed (`contextIsolation`, `nodeIntegration: false`, `sandbox: true`), sem `fs` — não há como ler `userData/attachments/<hash>` dali, e não deve existir canal que devolva bytes arbitrários ao renderer só para isso (reabriria o problema de payload binário que a skill `ipc` documenta, sem necessidade — o destino final é o Ollama, não a tela).

**Forma exata da mudança:**

- `core/ai/messages.ts` mantém `toChatMessages(messages: Message[]): ChatMessage[]` **síncrona e pura, sem resolver bytes** — continua sendo usada pelo **renderer** para as duas finalidades que já tem (calibrar `sentChars` em `useConversationChat.ts`, montar `historyChars` para o medidor em `ConversationView.tsx`). Uma parte `image` contribui `''` para `content` — correto, não hack: no wire shape do Ollama, `content` e `images` já são campos separados. **Correção junto**: o `.map(partForProvider).join('\n\n')` atual não filtra vazios; uma contribuição `''` deixaria `\n\n` sobrando. Este passo filtra strings vazias antes do `join`.
- Uma função nova, **assíncrona, só chamada no main**, materializa `images` — recebe `Message[]` e um resolvedor de bytes injetado por parâmetro (mesmo DIP que `attachDataset` já usa para `createHashedLines`/`storeAttachment`): lê `userData/attachments/<hash>`, base64-encoda, popula `images?: string[]` em cada `ChatMessage` cuja mensagem original tinha parte(s) `image`. Reusa `partForProvider` para `content` — não duplica a lógica de texto. Itera `messages` diretamente, nunca por índice paralelo entre dois arrays.
- `ai:chat`'s `args.messages` troca de `z.array(chatMessageSchema)` para `z.array(messageSchema)` — schema que já existe, já validado em `conversation:append`.
- `ChatMessage` ganha `images?: string[]` opcional. O provider Ollama (`main/features/ai/providers/ollama.ts`) não muda de código além do tipo — o `JSON.stringify({ model, messages, ... })` já espalha os objetos inteiros.

**Descartado: o main relê a transcrição do SQLite em vez de receber `Message[]` pelo IPC.** Pareceria mais enxuto — descartado porque acopla o handler de IA ao banco (hoje `chat()` é testável em Node puro contra um `ChatFn` stub, sem conhecer `db`) e introduz uma corrida: o `append()` do turno do usuário precisaria ter commitado antes do `chat()` ler, ordem que o IPC não garante e que o design atual evita — o renderer já monta a lista completa (histórico + rascunho) e manda, sem "escreve, depois lê de volta o que acabou de escrever".

Este passo é feito como **refatoração pura**, provada contra o comportamento atual (texto/dataset/documento) sem nenhuma capacidade nova visível — isola o risco: o refactor mais denso do plano fica provado por teste antes de imagem entrar em cena para confundir "quebrei o refactor" com "imagem não funciona ainda".

### D17.6 — Preview de imagem: protocolo customizado; `data:` via IPC e `file://` direto descartados

A D16.6 do plano 16 já deixou isto em aberto: *"quando a pré-visualização de uma imagem precisar dos pixels na tela... a decisão a tomar — `data:` URI montada no main, protocolo customizado, ou arquivo servido de `userData` — é dele [17], não deste [16]"*. Resolvido: **`protocol.handle`**, confirmado via Context7 contra a doc oficial do Electron 42.

```js
// main/attachments/protocol.ts — chamado ANTES de app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'attachment', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

// dentro de registerAll(), onde attachmentsDir já é montado
protocol.handle('attachment', (req) => {
  const hash = new URL(req.url).hostname
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response('bad', { status: 400 })
  // sniffa magic bytes (PNG: 89 50 4E 47 · JPEG: FF D8 FF) — o blob não tem
  // extensão no nome (D16.3), então o Content-Type não pode vir da extensão
  return new Response(bytes, { headers: { 'content-type': mime } })
})
```

`<img src="attachment://<hash>">` no renderer carrega como recurso comum do Chromium, não como chamada IPC — evita a cópia dupla que a skill `ipc` documenta para binário grande.

**Duas restrições mecânicas confirmadas, não presumidas:**
- `registerSchemesAsPrivileged` só pode rodar uma vez, **antes** de `app.whenReady()` — e `src/main/index.ts` estava em **97 de 100 linhas** quando este plano foi escrito, teto sem exceção. O registro nasce em `main/attachments/protocol.ts`, novo módulo; `main/index.ts` ganha só um import + uma chamada.
- A CSP real (`src/renderer/index.html`, lida direto) tem `img-src` como diretiva própria: `img-src 'self' data:`. A mudança é uma linha (`img-src 'self' data: attachment:`), não um `default-src` mais permissivo.

**Descartado: `data:` URI devolvida por um canal IPC novo.** É o padrão que a skill `ipc` já desaconselha para binário — paga a cópia dupla que o protocolo evita, e precisaria ser reinvocado a cada render do card em vez de o `<img>` cachear como qualquer recurso de rede. **Descartado: `file://` direto.** Bloqueado pela CSP (não deveria entrar) e expõe caminho de disco cru — o protocolo com validação de hash é estritamente mais restrito.

### D17.7 — SVG e WebP convergem para um único rasterizador, produzindo PNG

O achado do `HISTORY.md` sobre WebP ("o Chromium emite VP8X sempre") descreve o Chromium **codificando**, não decodificando — não é evidência contra decodificar um `.webp` existente via `<img>`/canvas. Isso licencia o mesmo mecanismo para os dois formatos: carregar o arquivo original num `<img>` numa janela oculta, desenhar em canvas do tamanho natural, exportar como PNG — nunca reencodando como WebP, o que evita o problema do VP8X por completo. Consistente com "normalizado para PNG num ponto só" do ESCOPO.md.

**Spike antes do extrator, três candidatos concretos** (não "validar que funciona" em abstrato):
1. `show: false` (não offscreen) + `capturePage()` — provavelmente o mais confiável headless; precisa medir a dimensão natural e redimensionar a janela antes de capturar.
2. `executeJavaScript` retornando `canvas.toDataURL('image/png')` — evita o problema de dimensionamento; custa uma cópia de string, aceitável num job único.
3. `offscreen: true` + evento `paint` — a proposta original, mais exposta ao risco de composição sem aceleração nesta máquina.

Critério de saída: qual dos três produz PNG correto nesta máquina. Se um falhar, muda só este passo.

### D17.8 — Recusa de PDF escaneado usa `AppError.blocked`; conserta um bug real no caminho

`AppError` já tem `{ kind: 'blocked'; reason: string }`. **Achado por grep, não presumido:** nenhum lugar do renderer hoje exibe `error.reason` — `errorMessage()` em `shared/ui/messages.ts` é um `Record<ErrorKind, string>` estático que, para `blocked`, sempre devolve o texto genérico "Operação bloqueada.", ignorando `.reason`. O único uso existente de `blocked` (link recusado no markdown) nunca chega a essa exibição, então o bug nunca foi visível.

Para a recusa de PDF escaneado mostrar "este PDF não tem texto selecionável" (requisito literal do ESCOPO.md), `errorMessage()` precisa de um caso especial: `error.kind === 'blocked' ? error.reason : MESSAGES[error.kind]`. Estritamente mais informativo para qualquer `blocked` futuro — não é gambiarra local, mas entra explicitamente neste passo, não por acaso.

### D17.9 — Preview de documento: cartão compacto + expandir

*(resposta do usuário na sessão em que este plano foi escrito)* Mesmo peso visual do `DatasetCard` por padrão; um clique revela o texto extraído em densidade de leitura, renderizado como markdown via `react-markdown`/`remark-gfm` (já instalados) quando `.md` — fecha o gatilho do `ROADMAP § 2` ("o 17 traz o terceiro consumidor de markdown"; D16.7 subiu `MarkdownMessage` para `shared/ui/` prevendo isto).

### D17.10 — Aviso de custo: estimativa no rótulo do progresso, sem confirmação prévia

*(resposta do usuário na sessão em que este plano foi escrito)* Sem clique extra. O job começa assim que o arquivo é escolhido — mas o rótulo já nasce com a estimativa: imagem sempre mostra "~80s" (custo fixo, medido, independente de dimensão); documento estima do tamanho do arquivo **antes** de abrir o job (bytes ÷ 3,7 char/token ÷ ~27 tok/s). Ex.: `"Lendo imagem… ~80s"` / `"Lendo documento… ~12s"`, no lugar do `"Lendo arquivo…"` genérico anterior.

### D17.11 — Gate de visão: dois pontos de checagem, **uma única superfície visível**

*(resposta do usuário, reconciliada com uma tensão real que apareceu ao desenhar os passos — e corrigida depois de uma primeira reconciliação errada, registrada abaixo)* Quando o modelo ativo não declara `vision`, a opção "Imagens" nasce **desabilitada** no popover, com dica explicando o motivo. **Este é o único lugar do plano com texto/alerta específico de visão.**

**A tensão original, e por que ela se resolve sem contradizer nada:** o docstring de `hasCapability` já promete dois pontos de checagem ("compose and send paths"), e a regra do projeto contra UI pela metade poderia parecer, numa leitura rápida, incompatível com um item desabilitado. Não é — a regra proíbe **UI sem função por trás** (um rótulo de feature não implementada, entregue entre passos); não proíbe **um controle plenamente implementado, condicionalmente desabilitado por estado real**, o mesmo padrão que o botão Enviar já usa quando o orçamento de contexto estoura. A opção "Imagens" tem canal, extrator, protocolo e card completos por trás — só fica cinza quando `hasCapability(model, 'vision')` é falso.

**Erro cometido na primeira versão desta decisão, e o conserto:** a primeira reconciliação manteve o item desabilitado no popover **e** acrescentou um segundo alerta visível no envio (`role="alert"`, texto próprio explicando a recusa) — copiando a forma do `canSend`/`overflows` do orçamento de contexto. Isso não é reconciliação, é a união das duas respostas: o usuário escolheu **uma** superfície ("bloqueia já no popover"), não duas. O segundo ponto de checagem continua **obrigatório** — o modelo pode trocar entre o anexo e o envio (a trava do par `(modelo, num_ctx)` só existe depois do primeiro envio, D15.13), e sem verificação no envio a falha documentada em `HISTORY.md` ("o modelo descreve, com números e confiança, uma imagem que nunca recebeu") reabriria pela borda que o popover não cobre — **mas ele não ganha texto próprio.** A checagem de envio se soma à computação existente de `canSend` (a mesma variável booleana que já desabilita Enviar por orçamento estourado): se há imagem pendente/no histórico do turno e o modelo ativo não declara `vision`, `canSend` vira falso, o botão desabilita, e **nenhum alerta novo é escrito** — no fluxo normal essa checagem nunca dispara (o popover já impediu o anexo), e no caso de borda (modelo trocado depois do anexo) o usuário vê o mesmo botão desabilitado que já veria por qualquer outro motivo de `canSend`, sem uma segunda mensagem específica de visão para manter consistente com a primeira.

### D17.12 — Orçamento ganha adendo fixo para imagem; calibração pula turnos com imagem

`budgetFor()` (`core/ai/budget.ts`) só converte caracteres em tokens por uma razão. Imagem não tem caracteres e custa um número de tokens **fixo e medido** (~270 no `gemma3:4b`, único modelo com `vision` na frota hoje), não proporcional a nada que o app envie. `budgetFor` ganha um parâmetro opcional (`flatTokens`) somado ao total estimado — `IMAGE_TOKEN_ESTIMATE` como constante nova, ao lado de `DEFAULT_CHARS_PER_TOKEN`, com docstring citando modelo e medição (a lição da D15.8: número medido num caso não é regra geral).

Simetricamente, a calibração de `useConversationChat.ts` (`setLastPrompt`, que divide `sentChars` pelo `promptTokens` exato devolvido pelo provedor) **pula** turnos cuja história ou rascunho contém imagem, em vez de subtrair 270 antes de dividir — subtrair envenenaria a razão para sempre com uma constante de um modelo só; pular degrada para a razão genérica, que já é a direção conservadora documentada no código.

### D17.13 — Encoding de documento: `TextDecoder` + BOM + fallback windows-1252, zero dependência nova

**Achado ao procurar:** não existe hoje nenhuma detecção de encoding no projeto — a frase do ESCOPO.md ("detecção de encoding como no CSV") é aspiracional; `hashedLines.ts` assume UTF-8 via `StringDecoder('utf8')`, sem sniff. Este plano constrói isso do zero: sniff de BOM; se ausente, tentar `new TextDecoder('utf-8', { fatal: true }).decode(buffer)` e, se lançar, recair para `new TextDecoder('windows-1252').decode(buffer)`. `TextDecoder` é global, disponível em `core/` sem `import` de `node:`.

**A provar com teste de nível 1, não presumir:** o Node 24 embutido no Electron 42 é `full-icu` por padrão, o que deveria fazer `'windows-1252'` resolver sem flag — fixture com bytes cp1252 na faixa 0x80–0x9F (aspas curvas, travessão — o que texto colado do Word em português usa) decodificando certo é o aceite. **Descartado:** dependência de detecção (`chardet`/`jschardet`) — desnecessária dado que o conjunto plausível é só UTF-8/cp1252 (o par que o próprio ESCOPO.md nomeia), e o projeto já tem precedente de preferir zero-dependência quando a superfície é pequena (`unpdf`, elogiado no `CLAUDE.md` por isso).

### D17.14 — Nenhum passo entrega opção de popover sem função por trás

Distinto de D17.11 (que é sobre um controle *implementado* ficando condicionalmente cinza): isto é sobre **sequência entre passos**. "Imagens" e "Documentos" nascem cada uma no mesmo commit que entrega seu extrator + canal + handler completos — nunca antes, como rótulo sem ação. O passo 1 mostra só "Dados tabulares"; nenhum passo intermediário deixa uma opção visível e sem função.

---

## Passo 0 — fora do escopo deste plano, mas primeiro na fila

As edições de `docs/ESCOPO.md`, `docs/ROADMAP.md` e `docs/reference/README.md` feitas numa sessão anterior (entrada de escopo de documento/imagem e dos planos 21-23) — commitadas em `bc2df28`, antes de qualquer código deste plano.

---

## Passos

Sequenciados para que cada um seja committável e revisável sozinho, seguindo o padrão do plano 16 (um commit por passo).

⚠️ **Por que a ordem no meio não é arbitrária.** `partForProvider` (`core/ai/messages.ts`) é um `switch` **exaustivo** sobre `MessagePart['kind']`, sem `default` — no instante em que `imagePartSchema` entra na união, o TypeScript exige um `case 'image'` imediatamente, e esse caso só pode ser síncrono/puro se a leitura de bytes já morar no processo certo. Por isso o refactor do `ai:chat` (D17.5, passo 4) é isolado, **antes** de qualquer código de imagem existir — puro, sem mudança de comportamento, verificável por comparação antes/depois. Documento não força essa migração (texto extraído é sempre string pura, igual ao cartão de dataset), por isso os passos 2-3 não dependem dela.

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | Popover redesenhado: ícone `Plus`, estrutura de lista do menu kebab (`Table2` + "Dados tabulares"), só essa opção funcional | Nível 2 | Popover abre, 1 opção com ícone à esquerda, aciona `dataset:pick`/`dataset:attach` sem mudança de comportamento |
| **2** | `documentPartSchema` + `document:pick`/`document:attach` + extrator `.txt`/`.md` (D17.13) + `AttachmentPart` generalizado (D17.4) + popover ganha "Documentos" + `DocumentCard` (D17.9) + rótulo de progresso com estimativa (D17.10, metade documento) | Nível 1 (encoding), nível 3 (handler), nível 2 (fluxo completo) | **Bloqueante, não opcional:** fixture com bytes cp1252 na faixa 0x80–0x9F decodifica corretamente via `new TextDecoder('windows-1252')` sob o ambiente `node` do Vitest **e** no runtime real do Electron 42 — se falhar em qualquer um dos dois, o passo não fecha até decidir o que substitui o fallback (a dependência `chardet`/`jschardet` foi descartada assumindo que isso funciona, D17.13). Só depois disso: `.txt`/`.md` anexados viram `MessagePart` com texto correto; segundo anexo do mesmo arquivo não escreve de novo |
| **3** | Extrator `.pdf` via `unpdf` (dependência nova) + recusa de PDF escaneado + `errorMessage()` mostra `.reason` para `blocked` (D17.8) | Nível 1 (fixture com texto e sem texto) | PDF com camada de texto extrai; PDF escaneado recusa com mensagem específica na tela, nunca tenta OCR |
| **4** | Refactor isolado (D17.5): `ai:chat` passa a levar `Message[]`; main materializa reusando `partForProvider`; `ChatMessage.images?` no schema (sem consumidor ainda); `join('\n\n')` filtra contribuição vazia | Nível 1 (comparação antes/depois), nível 3 (handler) | Uma conversa com texto+dataset+documento produz **exatamente** o mesmo payload para o Ollama que produzia antes — só o processo que monta mudou |
| **5** | Mecanismo de imagem, invisível: `imagePartSchema` + `image:pick`/`image:attach` + extrator PNG/JPEG (passagem direta) + materializador assíncrono de `images` (fecha D17.5) + protocolo `attachment://` + CSP (D17.6) | Nível 1 (materializador com resolver stub, validação de hash), nível 3 (handler) | PNG/JPEG anexados viram `MessagePart` com hash correto; `attachment://<hash>` serve bytes com Content-Type correto; hash inválido devolve 400 |
| **6** | Popover ganha "Imagens" — desabilitada sem `vision`, com dica (D17.11, única superfície visível) + `ImageCard` com miniatura real via protocolo + rótulo de progresso com estimativa (D17.10) + `canSend` passa a considerar `vision` como guarda silenciosa (D17.11, sem alerta próprio) + orçamento `flatTokens` (D17.12) | Nível 2 (fluxo completo + gate), nível 1 (`budgetFor`) | Com modelo sem `vision`: opção desabilitada com dica — único texto de visão do plano; se o modelo for trocado depois do anexo, `canSend` desabilita Enviar sem alerta novo (mesmo tratamento genérico de qualquer `canSend` falso); com `vision`: anexa, mostra miniatura, envia com `images` preenchido |
| **7** | Spike de rasterização (D17.7, 3 candidatos) → rasterizador único SVG/WebP→PNG + filtros dos diálogos ampliados | Dispatcher de decisão em nível 1; rasterização em si só ao vivo (nível 4) | SVG e WebP anexados produzem PNG válido, servido pelo protocolo |
| **8** | Integração nível 2 dos três tipos numa conversa (mensagens separadas, D17.3) + casos `document`/`image` em `gc.test.ts` | Nível 2 + nível 3 | Conversa com dataset+documento+imagem funciona ponta a ponta; `gc.test.ts` confirma as três hashes sobrevivendo/sendo varridas corretamente, sem mudar `gc.ts` |

**Sem trabalho extra em `gc.ts`**: `referencedHashes` já lê `json_extract(p.value, '$.hash')` de qualquer elemento do array `parts` — `document` e `image` entram na varredura de órfãos de graça.

---

## Detalhe dos passos mais densos

### Passo 2 — o de maior risco de subestimativa

A generalização do slot de anexo (D17.4) é o ponto do plano com maior chance de ser subestimado: quatro arquivos de renderer tocados por uma mudança de tipo que parece pequena na superfície. Reservar tempo de sessão extra aqui especificamente, não distribuído uniformemente entre os 8 passos. Arquivos: `shared/ipc.ts`, novo `core/document/extractText.ts` (+ teste), novo `core/fsError.ts` (extraído de `mapFsError`, hoje privado em `main/features/dataset/handlers.ts` — terceiro call site nesta sessão, regra dos três), `main/features/document/handlers.ts` (+ teste), os 6 pontos ×2 canais, `core/ai/messages.ts` (`case 'document'`, exporta `partForProvider`), `AttachmentCard.tsx`/`DocumentCard.tsx` novos, e os quatro pontos de `DatasetPart`→`AttachmentPart` (`AttachButton.tsx`, `Composer.tsx`, `useConversationChat.ts`, `ConversationView.tsx`).

### Passo 4 — o checkpoint do plano

Nenhuma tela muda, nenhum teste de nível 2 existente quebra além de ajuste de tipo em mocks. Se algo aqui se comporta diferente do que o app fazia antes do passo, é bug deste passo — não trabalho pendente de imagem. Medir (não presumir) o custo de validar zod sobre a união discriminada em toda a história a cada turno, incluindo até ~30kB de texto de documento; registrar o número no diário. Quase certamente ruído frente aos segundos de prefill, mas o passo confirma em vez de assumir.

⚠️ **A metodologia do teste comparativo importa mais que o teste em si.** "Produz exatamente o mesmo payload" só é um aceite de verdade se o valor esperado for capturado **antes** de tocar `useConversationChat.ts` — rodar as 2-3 conversas fixture (texto puro, texto+dataset, texto+documento) contra o código de hoje e colar o `ChatMessage[]` resultante como constante literal no arquivo de teste, **antes** de escrever uma linha do refactor. Se o valor esperado for gerado chamando a função nova (ou uma versão já modificada da antiga) depois da mudança, o teste compara o código com ele mesmo e passa mesmo se o comportamento tiver mudado — é a mesma armadilha de teste vacuoso que a D15.10 do plano 15 já registrou, e o próprio diário do plano 16 avisa que "vermelho antes" só prova algo quando escrito antes do conserto.

### Passo 5 — mecanismo sem UI é invisível, não incompleto

Nenhuma opção nova no popover, nenhum card novo montado em `ConversationView` neste passo — os canais existem, funcionam, são testados, e nada na tela os alcança ainda (D17.14 permite isso: a UI só nasce junto com sua função, mas a função pode nascer um passo antes da UI que a expõe). `unpdf` sob Vitest sem `server.deps.inline`: a confirmar no passo 3, não herdar como garantia — `react-markdown` funcionou sem override no passado, mas cada biblioteca ESM nova é um teste novo dessa sorte.

### Passo 7 — a única peça do plano sem cobertura abaixo do nível 4

Não por descuido: é propriedade genuína de precisar de `BrowserWindow` real. O risco não é quebrar sem aviso (o spike existe para isso) — é regredir silenciosamente numa mudança futura não relacionada, porque nenhum `check:fast` pega. Vale considerar, fora deste plano, se um e2e dedicado ("anexar um `.svg`, ver o card") entra no `ROADMAP § 2` como gatilho de revisão.

---

## Ordem de dependência

```
1 (popover shell)
  └─► 2 (documento txt/md + slot genérico) ──► 3 (documento pdf)
                                                    │
           4 (refactor ai:chat) ◄───────────────────┘  (mais seguro depois de 2/3
              │                                          fecharem partForProvider)
              ▼
         5 (imagem, invisível)
              ▼
         6 (imagem, visível + gate)
              ▼
         7 (svg/webp)
              ▼
         8 (integração)
```

2 precisa de 1 (o item "Documentos" entra num popover que já existe na forma nova). 3 precisa de 2 (mesmo handler, mesmo dialog). 4 não precisa tematicamente de 2/3, mas é mais seguro depois — evita fazer o refactor e o `case 'document'` no mesmo commit. 5 precisa de 4 (a materialização assíncrona é construída sobre a forma que 4 estabelece). 6 precisa de 5. 7 amplia um filtro que 6 já criou. 8 fecha.

---

## Riscos

1. **Passo 2 subestimado** — ver "Detalhe dos passos mais densos" acima.
2. **Passo 7 sem teste abaixo do nível 4** — propriedade genuína, não descuido; risco de regressão silenciosa, não de falha visível.
3. ~~**Tensão entre gate desabilitado e regra de UI pela metade**~~ — **resolvida** na sessão em que este plano foi escrito, ver D17.11, incluindo o conserto da primeira reconciliação (que tinha unido as duas respostas — item desabilitado *e* alerta no envio — em vez de escolher uma). Não é mais um risco em aberto.
4. **Custo de validar zod sobre `messageSchema` a cada turno (passo 4)** — aposta de "quase certamente ruído"; o passo mede e registra, não presume. Se surpreender, é achado para `HISTORY.md`, não bloqueio.
5. **`unpdf` sob Vitest sem `server.deps.inline`** — a confirmar no passo 3, não herdar como garantia de outra biblioteca.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo depois dos passos 1, 2, 6 e 8 — os pontos onde a UI muda de forma visível: anexar cada um dos 3 tipos, cancelar um anexo em andamento, reabrir conversa com anexo salvo (persistência), PDF escaneado (mensagem de recusa), arquivo grande o bastante para cancelar. Trocar de modelo com imagem já anexada (D17.11): o observável esperado é **Enviar desabilitado, sem alerta novo** — se aparecer uma mensagem específica de visão nesse momento, é regressão da D17.11, não confirmação dela.
- Passo 4 merece teste comparativo dedicado: capturar o `ChatMessage[]` que o caminho antigo produzia para conversas fixture (texto puro, texto+dataset, texto+documento) e comparar com o que o novo caminho no main produz para o mesmo `Message[]` de entrada.
- Passos 5 (protocolo) e 7 (rasterização) exigem validação contra o Electron real antes de qualquer teste automatizado — não simuláveis em Vitest/jsdom.
- `pnpm build:win` ao final — confirma que `unpdf` empacota corretamente e que o protocolo customizado sobrevive ao app empacotado, não só ao `electron-vite dev`.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 16/08/2026 | 0–1 | plano escrito; passos 0 e 1 concluídos | Plano desenhado com 3 agentes Explore (mecanismo do plano 16; Popover/kebab/AttachButton; gate de capacidades/job/dependências) + 1 agente Plan, revisado pelo advisor em duas rodadas. A primeira reconciliação do gate de visão (D17.11) uniu as duas respostas do usuário e do agente de design em vez de escolher uma — corrigida antes de ExitPlanMode, ver D17.11. **Passo 0**: commit `bc2df28` (edições de ESCOPO/ROADMAP/reference da sessão anterior, bloqueadas pelo plan mode). **Passo 1**: `AttachButton.tsx` — ícone `Paperclip`→`Plus`, `aria-label` "Anexar arquivo"→"Adicionar anexo", `aria-haspopup` "dialog"→"true" (agora alinhado ao kebab, que é o padrão replicado); popover mostra a lista de categorias (só "Dados tabulares", ícone `Table2`) quando `attachment === null`, e mantém a view de detalhe do schema inalterada quando `attachment !== null`. 9 asserções de teste realinhadas em `AttachButton.test.tsx` e `ConversationView.test.tsx`. `check:fast` verde (375 testes). Sem verificação visual ao vivo nesta sessão — sem ferramenta de screenshot/navegador disponível; pendente para quem revisar com `pnpm dev`. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.
