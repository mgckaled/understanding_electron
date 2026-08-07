# 02 — Contrato IPC

**Depende de:** [01](01-camadas-e-fronteiras.md) · **Entrega:** `src/shared/ipc.ts`, registro tipado de handlers, preload de superfície estreita, primeiros dois canais reais

---

## Por que esta fase existe

O scaffold traz um exemplo de IPC que resume tudo o que dá errado:

```ts
// main
ipcMain.on('ping', () => console.log('pong'))
// renderer
window.electron.ipcRenderer.send('ping')
```

Funciona. E é exatamente o padrão que, multiplicado por trinta canais, produz o retrabalho que este plano existe para evitar. Três problemas, em ordem crescente de gravidade.

**A string não é verificada.** `'ping'` no main e `'ping'` no renderer são dois literais sem relação. Renomear é busca textual; errar uma letra é um canal que nunca responde e não avisa. O argumento é `any` dos dois lados.

**A superfície exposta é larga demais.** O preload do template faz `contextBridge.exposeInMainWorld('electron', electronAPI)`, e com isso o renderer recebe `ipcRenderer.send`, `.on` e `.invoke` genéricos — permissão para falar em qualquer canal, inclusive os que ainda não existem. O `contextIsolation` foi ligado para tirar poder do renderer, e essa linha devolve boa parte dele pela porta dos fundos. É a violação de ISP em uma linha.

**A exceção não sobrevive à travessia.** Este é o caro. Se um handler lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico, prefixado com `Error invoking remote method '...'`, carregando o stack do renderer. A classe some, as propriedades customizadas somem, o stack original some.

Na prática: no dia em que o DuckDB devolver um erro de sintaxe com linha e coluna, essa informação chega ao React como uma string, e destacar a linha errada no editor deixa de ser possível. A correção não é local — é trocar a convenção de retorno de todos os handlers, todos os hooks e toda a UI de erro de uma vez.

Por isso esta fase vem antes de existirem canais para corrigir.

---

## Decisões tomadas

### D2.1 — Um mapa de canais, dois consumidores

`src/shared/ipc.ts` declara o mapa `canal → { args, result }`. O main tipa os handlers contra ele; o preload tipa as chamadas contra ele. Nenhum dos dois lados escreve o nome do canal duas vezes.

### D2.2 — `Result` para falha esperada, exceção para bug

Esta é a distinção que evita a cerimônia de embrulhar tudo:

| Situação | Convenção |
|---|---|
| O arquivo não existe · o SQL tem erro de sintaxe · o usuário cancelou | **`Result`** — é dado de domínio, a UI precisa reagir |
| O payload não bate com o schema · o handler tem um bug | **Exceção** — é defeito de programação |

A justificativa da segunda linha é o inverso da que motivou a primeira: a exceção chega mutilada ao renderer, e isso é **aceitável para um bug**, porque a resposta correta não é tratar na UI — é ver no console durante o desenvolvimento e corrigir o código.

Corolário: `app:info` **não** retorna `Result`, porque não tem como falhar. `Result` onde tudo pode falhar é ruído que treina a equipe a ignorar o `ok`.

### D2.3 — Uma superfície de domínio, não um `invoke` genérico

O que o renderer recebe é isto:

```ts
window.api.app.info()
window.api.shell.openExternal(url)
```

E **não** `window.api.invoke('app:info')`. Um `invoke` genérico é o `electronAPI` do template com outro nome — reintroduz a superfície larga que a fase acabou de remover.

### D2.4 — `IpcContract` é o fio; `Api` é a interface

São dois tipos escritos à mão, com nível de aninhamento diferente (`'app:info'` na fita, `api.app.info` na mão). Não vale a ginástica de tipos para derivar um do outro.

A propriedade que faz isso ser seguro: o **preload é o único arquivo que referencia os dois**. Divergência entre eles é erro de compilação em exatamente um lugar, e esse lugar tem 30 linhas.

### D2.5 — Validação com `zod`, schema como fonte dos tipos de argumento

O main não confia no renderer. Isso não é paranoia sobre o usuário — é que o renderer é conteúdo web, o TypeScript some em runtime, e um handler que faz `readFile(args.path)` com `path` não validado é uma leitura arbitrária de disco a um bug de distância.

Os schemas moram em `src/shared/ipc.ts`, e os tipos de argumento são **derivados deles** com `z.infer`. Escrever schema e tipo separadamente cria duas verdades que divergem no primeiro campo opcional.

**Descartado:** validação manual com `typeof`. Repetitiva, e o tipo continua sendo escrito à parte — o problema que a decisão resolve permanece.

> 🔍 O `zod` entra no bundle do renderer via `shared/`. Como o renderer usa apenas os tipos (apagados na compilação), o `argsSchema` é removido por *tree-shaking*. E mesmo que não fosse: em Electron não há download, o custo de bundle é espaço em disco.

### D2.6 — Só os argumentos são validados

`renderer → main` passa por `zod`. `main → renderer` não passa. O main é código nosso rodando em processo privilegiado; validar a própria saída é desconfiar de si mesmo ao custo de latência em todo resultado — inclusive nos grandes que virão do DuckDB.

### D2.7 — O `jobId` nasce no renderer

Operações longas recebem um `jobId` gerado no renderer com `crypto.randomUUID()`, e não devolvido pelo main.

O motivo é temporal: o usuário costuma clicar em "cancelar" **antes** de a promessa da operação resolver. Se o identificador viesse na resposta, não haveria o que cancelar durante justamente a janela em que o cancelamento importa.

Nesta fase os tipos de `job` são **declarados** em `shared/ipc.ts`; o registro que os implementa chega na [fase 06](06-primeira-feature.md), junto com a primeira operação longa de verdade. Declarar cedo é o que garante que a API não precise mudar; implementar sem consumidor seria especulação.

### D2.8 — O listener nunca vaza o evento do Electron

Quando o preload assinar eventos do main (fase 06), o callback do renderer recebe **apenas o payload**. O `IpcRendererEvent` fica no preload.

Ele carrega `event.sender`, que é uma referência viva ao `webContents` — entregá-la ao renderer é vazar um objeto privilegiado através do `contextBridge`. Toda assinatura devolve uma função de cancelamento; sem ela, todo componente React que assina vira um vazamento no `useEffect`.

---

## Passos

### Passo 1 — Declarar o contrato

Instale o `zod`. Crie `src/shared/ipc.ts` com quatro blocos, nesta ordem:

**1. Vocabulário de erro.** União discriminada por `kind`, com os campos que a UI precisa para reagir:

```ts
export type AppError =
  | { kind: 'not-found'; path: string }
  | { kind: 'permission'; path: string }
  | { kind: 'blocked'; reason: string }
  | { kind: 'cancelled' }
  | { kind: 'timeout'; afterMs: number }
  | { kind: 'unavailable'; service: string; hint: string }
  | { kind: 'upstream'; service: string; status: number | null; message: string }
  | { kind: 'unknown'; message: string }

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

Os três `kind` do meio não têm uso na fundação e entram mesmo assim. `unavailable` é o formato do *gate* — serviço opcional ausente, com dica de como resolver, degradando o recurso em vez de quebrar o app; `upstream` e `timeout` são a forma de falha de qualquer chamada de rede. Declarar agora custa três linhas e evita que a primeira integração externa invente um oitavo formato de erro paralelo.

**2. Tipos de domínio.** `AppInfo` com versões (`electron`, `chrome`, `node`, `app`), plataforma e um indicador de desenvolvimento.

**3. Tipos de job**, declarados agora e usados na fase 06:

```ts
export type JobId = string

export type JobEvent =
  | { jobId: JobId; type: 'progress'; phase: string; done: number; total: number | null }
  | { jobId: JobId; type: 'chunk'; text: string }
  | { jobId: JobId; type: 'log'; level: 'info' | 'warn' | 'error'; message: string }

export type JobProgress = Extract<JobEvent, { type: 'progress' }>
```

Um canal, união extensível — e não três canais paralelos. A variante `progress` é a única que a [fase 06](06-primeira-feature.md) usa; `total: null` cobre o caso comum de não se saber o total antes de terminar.

> 🔍 As outras duas variantes são reserva deliberada, e são o motivo de esta ser uma união em vez de um objeto simples. `chunk` é resposta em fluxo — texto que chega pedaço a pedaço, como um modelo de linguagem gerando token a token. `log` é a linha de pipeline que o projeto Python resolve com os prefixos `[i]`/`[~]`/`[✓]`.
>
> Nenhuma das duas tem uso na fundação. Estão aqui porque o custo é de três linhas hoje e de um segundo mecanismo de eventos depois — que é a definição de decisão cara de adiar. Se a reserva não se justificar, apagar é trivial; o inverso não é.

**4. Schemas e o mapa de canais**, com os argumentos derivados dos schemas:

```ts
export const argsSchema = {
  'app:info': z.void(),
  'shell:openExternal': z.object({ url: z.string().url() })
} as const

export type IpcContract = {
  'app:info':            { args: z.infer<(typeof argsSchema)['app:info']>; result: AppInfo }
  'shell:openExternal':  { args: z.infer<(typeof argsSchema)['shell:openExternal']>; result: Result<void> }
}

export type Channel = keyof IpcContract
export type Args<C extends Channel> = IpcContract[C]['args']
export type ResultOf<C extends Channel> = IpcContract[C]['result']
```

E o tipo da superfície exposta:

```ts
export type Api = {
  app: { info(): Promise<AppInfo> }
  shell: { openExternal(url: string): Promise<Result<void>> }
}
```

**Aceite:** `pnpm typecheck` limpo. Ainda não há implementação.
**Commit:** `feat(ipc): declara o contrato tipado entre processos`

### Passo 2 — O registro genérico e os dois handlers

Crie `src/main/ipc/registry.ts` com a função que registra e valida:

```ts
export function handle<C extends Channel>(
  channel: C,
  fn: (args: Args<C>) => Promise<ResultOf<C>> | ResultOf<C>
): void {
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    const parsed = argsSchema[channel].safeParse(raw)
    if (!parsed.success) {
      throw new Error(`IPC ${channel}: payload inválido — ${parsed.error.message}`)
    }
    return fn(parsed.data as Args<C>)
  })
}
```

O `throw` aqui é intencional e segue a D2.2: payload fora do schema é bug, e bug deve doer no desenvolvimento.

Crie os handlers como **funções exportadas**, não como closures dentro do `handle`:

- `src/main/features/app/handlers.ts` → `getAppInfo(): AppInfo`
- `src/main/features/shell/handlers.ts` → `openExternal({ url }): Promise<Result<void>>`, que aceita apenas os esquemas `http:` e `https:` e devolve `{ ok: false, error: { kind: 'blocked', reason } }` para qualquer outro

> ⚠️ A validação de esquema não é redundante com o `z.string().url()`. O `zod` confirma que é uma URL; ele não impede `file:///C:/Windows/System32` nem um esquema registrado por outro aplicativo. Abrir URL arbitrária vinda do renderer é um vetor real.

Crie `src/main/ipc/register-all.ts` chamando `handle` para os dois canais, e chame-o uma vez no `app.whenReady()`. **Remova o `ipcMain.on('ping', ...)`** e o import de `ipcMain` do `src/main/index.ts` — o main não conhece mais `ipcMain` diretamente.

Essa separação é o que torna os handlers testáveis: na [fase 04](04-testes-rapidos.md), `getAppInfo` e `openExternal` são chamadas como funções comuns, em Node puro, e `ipcMain.handle` nunca aparece num arquivo de teste.

**Aceite:** `pnpm dev` abre; nenhum erro no terminal do main.
**Commit:** `feat(ipc): registro validado de handlers e canais app/shell`

### Passo 3 — Reescrever o preload

Substitua o conteúdo de `src/preload/index.ts` por uma superfície montada a partir do contrato: um `invoke` genérico **privado** ao arquivo e o objeto `api: Api` que o usa, exposto com `contextBridge.exposeInMainWorld('api', api)`.

Três remoções, todas deliberadas:

1. **`exposeInMainWorld('electron', electronAPI)`** — é a superfície larga da D2.3.
2. **A ramificação `if (process.contextIsolated)`** — o `else` só existe para quando o isolamento está desligado, e o [`CLAUDE.md`](../../../CLAUDE.md) registra que ele fica ligado. Código morto que documenta o contrário da regra.
3. **A dependência `@electron-toolkit/preload`** — deixa de ser usada. Remova do `package.json`.

Reescreva `src/preload/index.d.ts`:

```ts
import type { Api } from '@shared/ipc'

declare global {
  interface Window {
    api: Api
  }
}
```

Note o que sumiu: `window.electron`. A partir daqui, o renderer que tentar usá-lo não compila.

**Aceite:** `pnpm typecheck` limpo. O `pnpm dev` vai falhar na compilação do renderer — o `Versions.tsx` ainda usa `window.electron`. É o passo seguinte.
**Commit:** `feat(preload): expõe superfície de domínio e remove o bridge genérico`

### Passo 4 — Ligar o renderer

Ajuste `src/renderer/src/components/Versions.tsx` para buscar as versões pelo canal, com `useEffect` + `useState` por enquanto — a [fase 06](06-primeira-feature.md) troca isso por TanStack Query, e antecipar seria adicionar dependência sem o problema que a justifica.

Em `App.tsx`, troque as âncoras `<a target="_blank">` por botões que chamam `window.api.shell.openExternal(...)` e tratam o `Result`. Remova o `ipcHandle` e o link "Send IPC".

> 🔍 Mantenha o `setWindowOpenHandler` devolvendo `deny` no main. Ele deixa de ser o caminho de abertura de links e passa a ser o que sempre deveria ter sido: a rede de segurança para o link que escapar.

**Aceite:** janela abre, versões aparecem, botão abre o navegador padrão. Console do DevTools limpo.
**Commit:** `feat(renderer): consome o contrato tipado e abandona window.electron`

---

## Critério de aceite da fase

```bash
pnpm typecheck && pnpm lint && pnpm dev
```

E, no DevTools da janela:

| Comando | Esperado |
|---|---|
| `window.electron` | `undefined` — a superfície larga sumiu |
| `window.api` | objeto com `app` e `shell`, e nada mais |
| `await window.api.app.info()` | as versões |
| `await window.api.shell.openExternal('file:///C:/')` | `{ ok: false, error: { kind: 'blocked', ... } }` |

A última linha é a que prova que a validação de esquema está ativa. Vale testar à mão uma vez.

---

## O que fica para depois

- **Registro de jobs, progresso e cancelamento** — tipos declarados aqui, implementação na [fase 06](06-primeira-feature.md) com a primeira operação longa.
- **`MessageChannelMain` entre renderer e `utilityProcess`** — só faz sentido quando existir um worker. Fica para a camada de dados.
- **Versionamento do contrato** — irrelevante enquanto os dois lados são compilados juntos e distribuídos juntos.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-04 | 1, 2, 3, 4 | concluída | Os quatro passos e commits feitos. `pnpm typecheck`, `pnpm lint` (código desta fase) e `pnpm dev` limpos. Validação de ponta a ponta feita com Playwright `_electron` instalado temporariamente (revertido após o teste, não é dependência do projeto — isso é escopo da fase 07): versões aparecem, `window.api` só tem `app`/`shell`, `window.electron` é `undefined`, esquema bloqueado devolve `{ ok: false, error: { kind: 'blocked' } }` sem tocar o sistema, zero erros no console. `openExternal` já recebe a função de abertura por parâmetro (DIP) — antecipando o que a fase 04 pede, para não ser retrabalho depois. Skill `architecture` atualizada com D2.1–D2.8. Fase movida para `implemented/`. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [01 — Camadas e fronteiras](01-camadas-e-fronteiras.md) · **Índice:** [README](../active/README.md) · **Próximo:** [03 — Sandbox e segurança](03-sandbox-e-seguranca.md)

> 🔍 Fase implementada em 2026-08-04. Com a fundação inteira arquivada em `plan/implemented/` (fase 08), todas as fases vizinhas ficam no mesmo diretório; só o índice `README`, que permanece em `active/`, sobe um nível (`../active/`).
