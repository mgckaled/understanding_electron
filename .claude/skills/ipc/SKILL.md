---
name: ipc
description: O contrato IPC do crivo — src/shared/ipc.ts como fonte única de canal→{args,result}, a superfície de domínio window.api, os seis lugares que um canal novo toca, Result vs exceção, e a armadilha de zod vazando para o bundle do preload. Use ao criar ou mudar um canal, decidir se algo retorna Result, escolher entre canal e evento, ou mandar payload binário entre processos. Não cobre camadas/importação (skill architecture), testes de handler (skill testing) nem motor DuckDB (skill data).
---

# IPC — crivo

## O contrato é um mapa, e ele tem dois consumidores

`src/shared/ipc.ts` declara `Channel → { args, result }` **uma vez**. O `main` tipa os handlers contra ele; o `preload` tipa as chamadas contra ele. Nenhum dos dois escreve o nome do canal duas vezes.

O `preload` é o **único** arquivo que referencia tanto `IpcContract` (o fio — `'app:info'`) quanto `Api` (a interface — `api.app.info`). Divergência entre os dois é erro de compilação nesse único lugar, e é de propósito: são duas formas do mesmo fato, e o ponto de costura tem de ser um só.

## A superfície é de domínio, nunca `invoke` genérico

```ts
window.api.app.info() // sim
window.api.invoke('app:info') // não
```

Expor `invoke(canal, args)` devolveria ao renderer a superfície larga que o template do electron-vite traz — é a aplicação de ISP registrada na skill [`architecture`](../architecture/SKILL.md): o renderer recebe os métodos que usa, não a capacidade de chamar qualquer coisa. Também é o que faz o `satisfies Api` do mock de teste ter valor.

## Um canal novo toca seis lugares, nesta ordem

| # | Onde | O quê |
|---|---|---|
| 1 | `src/shared/ipc.ts` → `argsSchema` | o schema zod dos argumentos (`z.void()` quando não há) |
| 2 | `src/shared/ipc.ts` → `IpcContract` | `{ args: z.infer<...>; result: ... }` |
| 3 | `src/shared/ipc.ts` → `Api` | o método de domínio que o renderer vai chamar |
| 4 | `src/main/features/<x>/handlers.ts` | função **exportada**, recebendo as dependências por parâmetro |
| 5 | `src/main/ipc/register-all.ts` | `handle('x:y', (args) => fn(args, dependênciaReal))` |
| 6 | `src/preload/index.ts` | `invoke('x:y', { ... })` |

**O sétimo lugar avisa sozinho:** `test/api-mock.ts` é `satisfies Api`, então esquecer o mock quebra o `pnpm typecheck` no mesmo segundo — não em runtime, meses depois, como `undefined is not a function`.

⚠️ **Todo canal de `IpcContract` precisa de entrada em `argsSchema`.** O `handle()` faz `argsSchema[channel]` para qualquer canal; um canal declarado sem schema quebra no registro, não na chamada.

Nomeação: `domínio:verbo`, minúsculo antes dos dois pontos (`conversation:append`, `ai:unload`). O domínio agrupa em `Api`.

## `Result` ou exceção — e nem todo canal retorna `Result`

| Situação | Convenção |
|---|---|
| Arquivo não existe · serviço fora do ar · usuário cancelou | **`Result`** — dado de domínio, a UI precisa reagir |
| Payload fora do schema · bug no handler | **Exceção** — defeito de programação, deve doer no console |

`Result<T, E = AppError>` é `{ ok: true; value: T } | { ok: false; error: E }`, com `AppError` discriminada por `kind`.

**Canal que não tem como falhar não retorna `Result`** — embrulhar tudo treina o leitor a ignorar o `ok`. Os precedentes citáveis: `app:info`/`app:memory` (leitura de runtime) e todo o bloco de conversa e configuração — um `INSERT` indexado num SQLite local não tem falha que a UI precise distinguir, e ausência vira dado em vez de erro (lista vazia; um `append` endereçado a conversa já excluída é descartado pelo `changes` do próprio `UPDATE`).

Do outro lado, os `ai:*` retornam `Result` porque o provedor estar fora do ar é um estado que a interface desenha, com dica acionável.

Se um handler lançar, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado por `Error invoking remote method`: classe, propriedades e stack se perdem no *structured clone*. **É esse limite de processo que torna erro esperado dado, não exceção** — não uma preferência de estilo.

## Validação: zod nos argumentos, nunca na saída

`renderer → main` passa por zod. `main → renderer` **não**: o main é código próprio rodando privilegiado, e validar a própria saída é desconfiar de si mesmo ao custo de latência em todo resultado.

```ts
// src/main/ipc/registry.ts — o único arquivo que conhece ipcMain.handle
const parsed = argsSchema[channel].safeParse(raw)
if (!parsed.success) throw new Error(`IPC ${channel}: payload inválido — ...`)
```

**Uma exceção existe e é justificada:** `settings:read` valida com zod o que leu do disco (D14.7). Não é a saída do main sendo desconfiada — são bytes de uma tabela chave-valor sem esquema para migrar, e a validação na leitura **é** a migração ali.

> 🔍 **A validação funciona; quem costuma mentir é o chamador.** Em ago/2026 o `conversation:settings` passou a recusar payload com `numCtx: 0`, e a causa não estava no schema: um controle numérico desenhado com `max={0}` clampava um 1024 digitado para zero. Ler a recusa do zod como "o schema está apertado demais" teria escondido o defeito. Ver [`ARMADILHAS.md`](../../../docs/ARMADILHAS.md).

## Evento não é canal, e o nome dele mora noutro arquivo

`job:event` viaja por `webContents.send`, nunca por `ipcMain.handle`, então **não entra** em `IpcContract` nem em `argsSchema`. Seu nome mora em `src/shared/channels.ts`.

⚠️ **E o arquivo separado não é organização, é uma armadilha que já mordeu.** `src/shared/ipc.ts` importa `zod` **como valor** (para o `argsSchema`). O preload sandboxed não tem `require`, e o bundle dele nunca leva `externalizeDepsPlugin` — então importar por valor qualquer coisa de `ipc.ts` arrasta `zod` para dentro do bundle do preload, que o build deixa como `require('zod')` externo não resolvido. Sintoma: o preload falha ao carregar, `window.api` fica `undefined`, e **a janela abre vazia sem nenhum erro no terminal** — só no DevTools da própria janela. Nem `typecheck`, nem `lint`, nem `test` pegam isso.

**Regra:** valor que o preload vai consumir de `shared/` nasce em arquivo que não importa nada de fora. Tipo pode vir de `ipc.ts` (`import type` é apagado); valor, não.

Duas regras de evento que vêm junto:

- **Nunca vaze o `IpcRendererEvent` para o renderer** — ele carrega `event.sender`, referência viva ao `webContents`. O callback recebe só o payload, e toda assinatura devolve uma função de cancelamento.
- **Progresso é transmitido a todas as janelas** (`BrowserWindow.getAllWindows()`), não endereçado ao remetente: o `handle()` genérico entrega só os argumentos ao handler, nunca o `IpcMainInvokeEvent`, e é essa restrição que o mantém testável em Node puro. Gatilho de revisão: a segunda janela do app.

## Identidade nasce em quem age

`JobId` é gerado no **renderer** (`crypto.randomUUID()`), nunca devolvido pelo main — o usuário cancela antes de a promessa resolver, e um id que só chega na resposta não deixa o que cancelar na janela em que isso importa. O mesmo argumento vale para o `id` e o `createdAt` de conversa e mensagem (D14.5): **nenhum handler gera identidade nem carimba tempo**, ele insere o que recebe. Efeito colateral que se paga: invalidação de cache fica previsível.

## O handler é função exportada, não closure

É a decisão que cria o nível 3 da pirâmide de testes, e o argumento inteiro é da skill [`testing`](../testing/SKILL.md) § *O nível 3 é o que quase ninguém tem* — incluindo a armadilha de importar `electron` por valor em arquivo de handler. Aqui basta a regra: o passo 4 da tabela acima diz **função exportada, dependências por parâmetro**, e não há exceção de "só este aqui".

## Payload binário: **não existe zero-cópia**, e a palavra "transferível" engana

Verificado no fonte do Electron 42 em ago/2026, não suposto:

- `invoke`, `send` e `sendSync` serializam por `CloneableMessage` e **não aceitam lista de transferência nenhuma**;
- a lista de transferência do `postMessage` extrai **apenas `MessagePort`** — `ArrayBuffer` não entra nem ali;
- toda a serialização passa por `v8::ValueSerializer`, que **copia a fundo** `ArrayBuffer` e `Buffer`.

Transferir posse funciona **dentro** de um processo (renderer → Web Worker, mesma memória). Entre processos do sistema operacional, os bytes são copiados de qualquer forma. É cópia de bloco contíguo, não transferência de posse — então **todo resultado grande é pago duas vezes em memória, momentaneamente**, o que dá dentes à regra do [`ESCOPO`](../../../docs/ESCOPO.md) de nenhuma etapa materializar o resultado completo em JavaScript.

⚠️ **A vantagem de tempo do Arrow sobre JSON não é automática** — ela só existe quando o formato de origem já chega pronto, e neste app **não chega**: medido no 18-B, JSON venceu Arrow nas duas escalas. Antes de escolher Arrow num canal novo, leia o veredito e a razão na skill [`data`](../data/SKILL.md) § *Arrow: montado em JS*.

**Para binário que precisa chegar ao DOM a resposta já existe, e não é um canal:** bytes de imagem viajam do disco ao `<img>` do renderer pelo protocolo customizado `attachment://` (`src/main/attachments/protocol.ts`, `protocol.handle` + `registerSchemesAsPrivileged`, D17.6) — nunca por `invoke`/JSON.

⚠️ **Mas isso vale para o DOM, não para a área de transferência.** O esquema não tem o privilégio `corsEnabled`, então `fetch('attachment://…')` é recusado antes da CSP, e o `<img>` contamina um canvas. Por isso o `image:bytes` existe (DF3E.1): é o **único** caminho do renderer até os bytes quando o destino não é uma tag. A contaminação é da origem, não dos bytes — um `Blob` montado a partir do que chegou por `invoke` desenha em canvas limpo.

## Canais de hoje

**39 canais em `IpcContract`**, conferidos contra o código em 29/08/2026.

| Domínio | Canais | `Result`? |
|---|---|---|
| `app` | `info`, `memory`, `processes` | não |
| `shell` | `openExternal` | sim |
| `dataset` | `pick`, `attach`, `query`, `profile`, `transform` | sim |
| `document` | `pick`, `attach` | sim |
| `image` | `pick`, `attach`, `bytes` | sim |
| `job` | `cancel` | não |
| `ai` | `isAvailable`, `models`, `loaded`, `unload`, `chat`, `propose` | sim |
| `conversation` | `list`, `messages`, `create`, `rename`, `remove`, `removeMessage`, `append`, `settings` | não |
| `draft` | `list`, `create`, `update`, `remove` | não |
| `export` | `save` | **sim** — arquivo em uso, permissão e disco cheio são estados que a interface desenha |
| `settings` | `read`, `write` | não |
| `secrets` | `write` (`Result`), `has`, `remove` | `write` só — `has`/`remove` seguem a régua de `conversation` |

`secrets:read` **não existe** — nem por omissão, por desenho (DN1A.3): a regra de mão única do [`CLAUDE.md`](../../../CLAUDE.md#segurança) proíbe o renderer de reler um segredo já gravado, só perguntar se ele existe.

Fora do mapa, por não passar por `handle()`: `job:event`, declarado em `src/shared/channels.ts`.

⚠️ **Esta tabela envelhece a cada plano — reconfira antes de citá-la**, nunca copie a contagem daqui para outro documento. O `grep -c "^  '[a-z]*:" src/shared/ipc.ts` conta as chaves de `argsSchema` (dois blocos, então o dobro dos canais); a lista fiel sai lendo o bloco `IpcContract`. O gatilho do vigésimo canal já foi disparado e cumprido (nasceu esta skill); **o próximo limiar fica deliberadamente não declarado** — escolher outro número por reflexo repetiria o erro de fixar régua sem consequência medida.
