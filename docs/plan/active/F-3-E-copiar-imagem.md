# F-3-E — Copiar imagem: o canal `image:bytes`, e o galho que o JPEG obriga

> Quinto plano do painel de artefato, depois do [F-3-A](../implemented/F-3-A-painel-de-artefato.md), [F-3-B](../implemented/F-3-B-como-se-chega-ao-painel.md), [F-3-C](../implemented/F-3-C-o-painel-como-objeto-de-desktop.md) e [F-3-D](../implemented/F-3-D-o-dataset-no-painel.md). É o **único do corte que toca contrato IPC** — por isso saiu do F-3-C: raio de explosão diferente, camada diferente, nível de teste diferente.

**Origem:** a **DF3A.7** registrou que a imagem não pode ser copiada e mapeou os três caminhos fechados — `fetch('attachment://…')` barrado por CORS antes da CSP (o esquema não tem o privilégio `corsEnabled`), o canvas contaminado pelo `<img>`, e nenhum canal servindo bytes. O usuário decidiu em 26/08 abrir o **canal**, não o privilégio.

**Entrega:** o canal `image:bytes`, a validação de hash extraída para `core/`, e o botão ⧉ passando a existir para imagem no painel. Nada muda para dataset (que não copia, DF3D.10) nem para documento (que já copia).

---

## O que a pesquisa achou, e que o desenho registrado não previa

O `ROADMAP § 3` fixou "canal `image:bytes`" com um argumento de **custo** (os bytes pagos duas vezes na fronteira são irrelevantes no tamanho de uma imagem). O argumento continua verdadeiro. O que ninguém sabia é que o desenho tem um buraco de **formato**:

| Afirmação plausível | O que é verdade |
|---|---|
| Pegar os bytes e escrever na área de transferência resolve | ⚠️ **Só para PNG.** O Chromium aceita **apenas `image/png`** em `ClipboardItem`; `image/jpeg` lança. E `ImagePart.mimeType` é `z.enum(['image/png', 'image/jpeg'])` — um `.jpg` anexado continua JPEG |
| O `clipboard.writeImage` do main seria mais simples | É — e `nativeImage.createFromBuffer` decodifica **exatamente** PNG e JPEG, os dois formatos que o app armazena. Mas **perde transparência no Windows**: `CF_DIB` não tem canal alfa, limitação conhecida e ainda aberta no Electron ([#1961](https://github.com/electron/electron/issues/1961), [#17081](https://github.com/electron/electron/issues/17081)) |
| O canvas está fechado, como a DF3A.7 disse | ⚠️ **Fechado para o `<img>`, não para bytes vindos do IPC.** A contaminação vem da origem `attachment://`; um `Blob` montado a partir de um `Uint8Array` que chegou por `invoke` é limpo, e `createImageBitmap` sobre ele também |
| A validação de hash é nova | Não — existe **duas vezes**, e uma delas se declara cópia: `main/attachments/protocol.ts` e `core/duckdb/query.ts` (*"Mirrors main/attachments/protocol.ts's HASH_PATTERN"*) |
| Precisa de um `kind` novo em `AppError` | Não. `mapFsError` já dá `not-found`/`permission`/`unknown`, e `messages.ts` já mapeia os três |

---

## Decisões

### DF3E.1 — Desenho C: o canal registrado, com um galho para o JPEG

Três desenhos foram pesados:

| | Como | JPEG | Transparência | Bytes na fronteira |
|---|---|---|---|---|
| **A** — o registrado, literal | `image:bytes` → `ClipboardItem` direto | ❌ lança | ✅ | sim |
| **B** — no main | `clipboard.writeImage` | ✅ | ❌ perde no Windows | não |
| **C** — escolhido | `image:bytes`; PNG direto, JPEG recodificado para PNG | ✅ | ✅ | sim |

**C** é o desenho registrado com um galho, não uma decisão nova. As duas contas fecham:

- **JPEG não tem canal alfa**, então recodificar para PNG não perde nada que importe;
- a recodificação é `createImageBitmap(blob)` → `OffscreenCanvas` → `convertToBlob({ type: 'image/png' })`, e **não contamina** pelo motivo da tabela acima.

**Por que B foi recusado, com evidência e não por gosto:** a captura de uso real do usuário (27/08) tem quatro imagens anexadas, e uma delas é `logo-proposta-monograma-c.svg` — um monograma, rasterizado para PNG pela D17.7, quase certamente com fundo transparente. B falharia visivelmente no primeiro caso do corpus dele. Perder alfa é o defeito mais visível que esta feature pode ter, e o app aceita PNG justamente por causa dele.

### DF3E.2 — A ramificação é pelo `mimeType`, nunca pela extensão do nome

⚠️ **`fileName` e conteúdo divergem por desenho.** A D17.7 rasteriza SVG e WebP para PNG antes de armazenar, mas guarda o nome original: `logo-proposta-monograma-c.svg` tem bytes **PNG** e `mimeType: 'image/png'`. `image_4.webp` idem.

Quem ramificar por extensão escreve um defeito que nenhum teste de string pega e que só aparece em runtime. O `mimeType` é a única fonte, e é um `enum` de dois valores — então o `switch` é exaustivo e um terceiro formato futuro quebra o `typecheck`.

### DF3E.3 — `Result`, sem `kind` novo

Arquivo ausente é dado de domínio, não defeito: o blob pode ter sido varrido pelo `collectOrphanedAttachments` na inicialização. `Result<Uint8Array>`, com `mapFsError` — nenhuma entrada nova em `AppError` nem em `messages.ts`.

O precedente é o `dataset:query`, que já devolve `Result<Uint8Array>` pelo mesmo canal de raciocínio.

### DF3E.4 — `isAttachmentHash` sai para `core/`

O handler novo é o **terceiro** consumidor da mesma expressão regular. A régua dos três dispara — mas o motivo aqui é mais forte que contagem: essa regex é o que impede travessia de caminho, e o [`CLAUDE.md`](../../../CLAUDE.md#segurança) nomeia exatamente este cenário — *"decisão de segurança que dois processos precisam tomar nasce em `core/`; validação colocada junto de um deles vira bypass no segundo"*.

Nasce `src/core/attachments/hash.ts`, com os dois consumidores atuais migrados **sem mudança de comportamento**.

### DF3E.5 — Documento continua copiando no renderer; `copyArtifact` vira despacho

`navigator.clipboard.writeText` funciona e não tem nada quebrado. Mover o documento para o main por simetria seria trocar código que funciona por código equivalente.

`copyArtifact` passa a despachar por `kind`: documento escreve texto no renderer, imagem busca bytes e escreve blob, dataset devolve `false` (nunca é chamado, porque `canCopy` já o barra). Assimétrico, e honesto.

### DF3E.6 — O cartão da transcrição não ganha ⧉

O F-3 inteiro é sobre o painel. Um botão de copiar no cartão é outra decisão, com outra pergunta (o cartão é histórico da conversa ou barra de ações?), e não tem pedido.

### DF3E.7 — A ativação transitória é risco conhecido, com conserto conhecido

`navigator.clipboard.write` exige ativação transitória do usuário, e o desenho C faz **duas** coisas assíncronas antes de escrever: o `invoke` e, no caminho JPEG, a recodificação.

⚠️ **Não presumir que funciona nem que falha.** Se falhar com `NotAllowedError`, o conserto é passar uma `Promise<Blob>` ao `ClipboardItem` em vez de reestruturar o fluxo — mas **a documentação em circulação diverge** sobre o Chromium aceitar promessa (Safari exige; Chromium historicamente exigia `Blob` resolvido). Verificar no Chromium 148 na hora, contra o app real, e registrar o que for medido.

---

## O canal, nos seis lugares

| # | Onde | O quê |
|---|---|---|
| 1 | `shared/ipc.ts` → `argsSchema` | `'image:bytes': z.object({ hash: z.string().min(1) })` |
| 2 | `shared/ipc.ts` → `IpcContract` | `{ args, result: Result<Uint8Array> }` |
| 3 | `shared/ipc.ts` → `Api` | `image.bytes(hash: string): Promise<Result<Uint8Array>>` |
| 4 | `main/features/image/handlers.ts` | `readImageBytes(args, attachmentsDir, readFile)` — função exportada, dependências por parâmetro |
| 5 | `main/ipc/register-all.ts` | `handle('image:bytes', (args) => readImageBytes(args, attachmentsDir, readFile))` — `attachmentsDir` já existe ali |
| 6 | `preload/index.ts` | `bytes: (hash) => invoke('image:bytes', { hash })` |

**O sétimo avisa sozinho:** `test/api-mock.ts` é `satisfies Api`, então esquecê-lo quebra o `pnpm typecheck` no mesmo segundo.

⚠️ **Nada de zero-cópia aqui, e a skill [`ipc`](../../../.claude/skills/ipc/SKILL.md) já mediu:** `invoke` serializa por `v8::ValueSerializer`, que copia a fundo. Os bytes são pagos duas vezes em memória, momentaneamente — aceitável no tamanho de uma imagem anexada, que é o argumento original do `ROADMAP`, e é o motivo de o canal **não** servir para dataset.

---

## Passos

### 1. `isAttachmentHash` para `core/` (DF3E.4)

Refactor puro. Os dois consumidores atuais passam a importar; o comentário que se declara cópia some porque deixa de ser verdade.

**Zero mudança de comportamento** — as suítes de `protocol` e de `query` são o contrato, e nenhuma asserção deve mudar. Se alguma mudar, a extração passou do ponto. Nível 1 para o módulo novo, incluindo o caso que ele existe para barrar: hash com `..` ou `/`.

### 2. O canal (DF3E.3, e os seis lugares)

Nível 3: `readImageBytes` chamado como função comum, em Node puro, sem subir o Electron — recusa hash fora do padrão **sem tocar o `fs`**, devolve os bytes para um hash válido, e mapeia arquivo ausente para `not-found`.

⚠️ Nenhum `import` de `electron` por valor no arquivo de handler, nem como default de parâmetro — fora do binário, `node_modules/electron/index.js` exporta uma *string*.

### 3. Copiar imagem (DF3E.1, DF3E.2, DF3E.5)

`canCopy` passa a aceitar imagem; `copyArtifact` vira despacho por `kind`, com o galho PNG/JPEG decidido pelo `mimeType`.

Nível 2, com a área de transferência mockada — o que se prova aqui é a **decisão**, não a escrita: PNG vai direto, JPEG passa pela recodificação, e um erro do canal não deixa o botão confirmar. A escrita real não tem sentido sob jsdom, e um teste que a estubasse estaria asseverando contra o próprio mock.

O painel já está pronto: ele desenha o botão quando `canCopy` é verdadeiro, e a suíte dele já cobre os dois lados.

### 4. Uma conferência ao vivo

Curta e específica, porque só o sistema operacional responde: colar em um editor de imagem e em um app de chat, com **as duas** origens — o PNG com transparência (o monograma rasterizado de SVG) e o JPEG. O que se olha é se o alfa sobreviveu e se o JPEG chegou.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- Provocação obrigatória, **uma sabotagem por vez**: aceitar hash fora do padrão (o nível 3 tem de reprovar), ramificar por extensão do `fileName` em vez de `mimeType` (o caso do JPEG tem de reprovar).
- **Sem caso E2E novo.** O que falta provar é o comportamento da área de transferência do sistema operacional, que o Playwright não observa de dentro do app — e um caso que só confirmasse "o botão existe" seria nível 2 vestido de nível 4.

---

## Fora do escopo deste plano

| | Onde vai |
|---|---|
| A aba **Passos** e o pipeline como estado | `F-3-F` |
| Copiar do cartão na transcrição | sem pedido (DF3E.6) |
| Exportar imagem como arquivo | trilha **E** |
| ⚠️ **A armadilha que a trilha E vai encontrar:** exportar `logo-proposta-monograma-c.svg` produziria bytes PNG dentro de um arquivo `.svg`. O nome sugerido no `showSaveDialog` tem de sair do `mimeType`, não do `fileName` guardado (é a DF3E.2 outra vez, do outro lado) | trilha **E** |
| Copiar o **arquivo** (colar numa pasta) em vez da imagem | não entra — é formato de área de transferência específico por plataforma |

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | — | plano escrito, ainda não executado | Escrito depois de um levantamento com Context7 + web. Ele achou **dois** furos no desenho que o `ROADMAP` tinha fixado em 26/08: o Chromium só aceita `image/png` em `ClipboardItem`, e o `ImagePart` admite JPEG; e a saída óbvia (`clipboard.writeImage` no main) perde transparência no Windows. O desenho C mantém o canal registrado e resolve os dois. A recusa do desenho B tem **evidência do corpus do usuário**, não julgamento: uma captura de uso real tinha um monograma rasterizado de SVG anexado, o caso exato que B estragaria. Achado de graça: a divergência entre `fileName` e conteúdo (D17.7) vira decisão nomeada em vez de detalhe, e ela reaparece na trilha E. |
