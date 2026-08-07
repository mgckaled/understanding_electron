# 03 — Sandbox e segurança

**Depende de:** [02](02-contrato-ipc.md) · **Entrega:** `sandbox: true`, `webPreferences` explícito, guarda de navegação, pendências registradas

---

## Por que esta fase existe

O `src/main/index.ts` tem uma linha que o [`CLAUDE.md`](../../../CLAUDE.md) já registra como pendência conhecida:

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false
}
```

O `sandbox: false` veio do template. Não é decisão do projeto, e ninguém sabe por que o template o traz — provavelmente para que exemplos com `require` no preload funcionem sem explicação.

**O que o sandbox faz.** Com ele ligado, o processo do renderer roda dentro do sandbox do próprio Chromium: sem acesso direto a disco, rede ou processos, com toda syscall passando pelo processo de navegador. É a mesma barreira que protege você ao abrir uma aba num site desconhecido. Sem ele, uma execução de código no renderer — via dependência comprometida, via conteúdo malicioso renderizado, via qualquer coisa — herda os privilégios do processo.

**O que ele custa.** O preload deixa de ter Node completo. O `require` vira um polyfill limitado, que dá acesso ao `electron` e a um punhado de APIs, e **não** consegue carregar múltiplos arquivos do seu próprio código. Preload sandboxed também roda como JavaScript comum, sem contexto ESM.

## Por que agora, e não depois

Essa limitação é a razão pela qual a decisão é assimétrica no tempo.

Depois da [fase 02](02-contrato-ipc.md), o preload é um arquivo que importa `electron` e um tipo. Nada mais. Ligar o sandbox custa apagar uma linha.

Daqui a três meses, o preload provavelmente terá se dividido em `ipc.ts`, `channels.ts` e um utilitário qualquer — e aí a mesma mudança é uma tarde de reorganização, feita sob a pressão de um app que já funciona, que é o pior momento possível para mexer na fronteira de segurança.

> 🔍 A ordem entre 02 e 03 não é acidental. Ligar o sandbox **antes** de reescrever o preload significaria depurar o `electronAPI` do template contra o ambiente restrito — que é trabalho jogado fora, já que ele ia ser removido de qualquer forma. Uma variável por vez, na ordem que evita trabalho morto.

---

## Decisões tomadas

### D3.1 — `sandbox: true`, e o preload é bundle único

Não há concessão aqui. O preload permanece um arquivo, e o `electron-vite` continua empacotando tudo o que ele importar dentro de um único artefato.

> ⚠️ **Não adicione `externalizeDepsPlugin()` ao bloco `preload`** do `electron.vite.config.ts`. Ele existe para deixar dependências fora do bundle e ser resolvido por `require` em runtime — o que é exatamente o que o preload sandboxed não sabe fazer. Se um dia o `pnpm dev` reclamar de módulo não encontrado no preload, esta é a primeira hipótese.

### D3.2 — O que é padrão seguro fica escrito assim mesmo

O `contextIsolation: true` e o `nodeIntegration: false` já são o padrão do Electron. Ainda assim vão para o `webPreferences` explicitamente.

O motivo é de leitura: quem abrir o arquivo daqui a seis meses não distingue "padrão seguro" de "ninguém pensou nisso". Escrito, com um comentário curto, a intenção fica registrada onde ela é aplicada — e uma alteração acidental aparece no diff.

### D3.3 — Navegação é negada por padrão

O `setWindowOpenHandler` já nega janelas novas. Falta o caso irmão: a janela existente navegando para outra origem, por um `window.location` ou por um link que escape.

Renderer que navega para fora carrega conteúdo de terceiros **com o seu preload anexado**. É pouca linha e fecha o caso.

### D3.4 — Segredo é de mão única: o renderer escreve, nunca lê

Nenhum segredo existe hoje, e mesmo assim a regra entra aqui — porque ela precisa valer **antes** da primeira chave, não depois.

Quando houver credencial (chave de API de serviço de nuvem, token de qualquer coisa), o contrato terá exatamente três formas:

| Operação | Assinatura |
|---|---|
| Gravar | `set(service, key): Promise<Result<void>>` |
| Consultar se existe | `status(service): Promise<{ configured: boolean }>` |
| Apagar | `clear(service): Promise<Result<void>>` |

Não existe `get`. O valor entra e não sai.

O motivo é que uma chave que chega ao renderer não fica no renderer: ela entra em estado do React, aparece no DevTools, e vai parar em qualquer relatório de erro ou captura de tela. Quem precisa do segredo é o main, que faz a chamada de rede — o renderer só precisa saber se pode oferecer o botão.

O armazenamento é `safeStorage.encryptString` do Electron, que usa a criptografia do sistema operacional (DPAPI no Windows), com o blob resultante em `app.getPath('userData')`. **Nunca em `.env` na raiz do repositório**: o projeto Python pode fazer isso porque roda do fonte; um app empacotado que lê `.env` da raiz ou embute a chave no bundle a está distribuindo junto com o instalador.

O `guard.mjs` em `.claude/hooks/` já bloqueia `process.env` em `src/renderer/`, que é a forma mais provável de essa regra ser violada por distração.

### D3.5 — `shamefullyHoist: true` fica, registrado

O `pnpm-workspace.yaml` tem `shamefullyHoist: true`, herdado do recuo por compatibilidade com o `electron-builder`. Ele abre mão da proteção do pnpm contra dependência fantasma — código que importa um pacote que nunca foi declarado, e que funciona por acidente da árvore de `node_modules`.

**Não mexemos nesta rodada.** Desligar exige validar o `install-app-deps` e, muito provavelmente, o primeiro módulo nativo — que ainda não existe. O gatilho para revisitar é o DuckDB: se ele instalar e carregar sem hoist, o campo sai.

Registrar a pendência com o gatilho é o que a diferencia de esquecimento.

---

## Passos

### Passo 1 — Ligar o sandbox

Em `src/main/index.ts`, substitua o bloco `webPreferences`:

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,            // renderer no sandbox do Chromium
  contextIsolation: true,   // padrão — explícito por ser fronteira de segurança
  nodeIntegration: false    // idem
}
```

Aproveite e defina `backgroundColor` no `BrowserWindow` com um cinza escuro provisório. O `show: false` + `ready-to-show` já evita o flash branco na abertura; o `backgroundColor` cobre redimensionamento e o quadro que o sistema desenha antes do primeiro *paint*. A [fase 05](05-design-tokens.md) volta aqui para alinhar o valor com o token `--color-bg` — são dois mundos que não compartilham CSS, e é o único lugar do projeto onde uma cor precisa aparecer duas vezes.

**Verificação, nesta ordem:**

1. `pnpm dev` — a janela abre e o console do DevTools está limpo. Se o preload tivesse falhado, apareceria `Unable to load preload script`.
2. `window.api` no DevTools — o objeto continua lá. É a prova de que o `contextBridge` sobreviveu ao sandbox.
3. `pnpm build` e inspecione `out/preload/index.js` — deve ser **CommonJS** (`require(`, `exports.`), não `import`. O `package.json` não declara `"type": "module"`, então o `electron-vite` já produz CJS; a inspeção confirma em vez de supor.

**Aceite:** os três itens acima.
**Commit:** `feat(seguranca): liga o sandbox do renderer`

### Passo 2 — Negar navegação para fora

No `createWindow`, junto ao `setWindowOpenHandler` que já existe:

```ts
mainWindow.webContents.on('will-navigate', (event, url) => {
  const permitido = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? new URL(url).origin === new URL(process.env['ELECTRON_RENDERER_URL']).origin
    : false
  if (!permitido) {
    event.preventDefault()
    shell.openExternal(url)
  }
})
```

A exceção do desenvolvimento existe porque o HMR do Vite navega dentro da própria origem do servidor. Em produção a página é `file://` e nenhuma navegação é legítima.

**Aceite:** `pnpm dev` com HMR funcionando (salve um arquivo do renderer e veja atualizar); um `window.location.href = 'https://example.com'` no DevTools abre o navegador externo e a janela do app não muda.
**Commit:** `feat(seguranca): nega navegação para fora da origem do app`

### Passo 3 — Registrar o estado da fronteira

Atualize o [`CLAUDE.md`](../../../CLAUDE.md): a seção **Segurança** hoje diz que `sandbox: false` é pendência conhecida. Substitua pelo estado real, e registre a pendência que sobrou:

| Item | Estado |
|---|---|
| `contextIsolation` | `true`, explícito |
| `nodeIntegration` | `false`, explícito |
| `sandbox` | `true` |
| Superfície do preload | apenas `window.api`, montada a partir de `src/shared/ipc.ts` |
| Abertura de link externo | canal `shell:openExternal`, com lista branca de esquemas |
| Navegação e janela nova | negadas por padrão |
| CSP | `default-src 'self'` no `index.html` |
| Segredos | regra fixada (mão única, `safeStorage`, `userData`); **nenhum segredo existe ainda** |
| `shamefullyHoist` | **pendente** — gatilho de revisão: instalação do DuckDB |

**Aceite:** o `CLAUDE.md` não contém mais afirmação falsa sobre o estado do projeto.
**Commit:** `docs: atualiza o estado da fronteira de segurança no CLAUDE.md`

---

## Critério de aceite da fase

```bash
pnpm typecheck && pnpm lint && pnpm dev && pnpm build
```

E, no DevTools:

| Verificação | Esperado |
|---|---|
| `window.api.app.info()` | responde |
| `window.electron` | `undefined` |
| `window.require` | `undefined` |
| `window.process` | `undefined` |

As duas últimas são o sandbox funcionando. Se qualquer uma responder, algo continua desligado.

---

## O que fica para depois

- **`shamefullyHoist: false`** — gatilho registrado acima.
- **Endurecer a CSP para produção** — a atual permite `style-src 'unsafe-inline'`, que o React e o Vite usam. Revisitar quando o design system estiver estável, não antes.
- **Assinatura de código e notarização** — só com distribuição real.
- **Auditoria de permissões (`setPermissionRequestHandler`)** — nada no app pede câmera, microfone ou localização hoje. Entra quando pedir.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-06 | 1, 2, 3 | concluída | Verificação do DevTools feita pelo usuário (sem display gráfico neste ambiente de CLI): `window.api` responde, `window.electron`/`require`/`process` undefined, HMR ok. `pnpm typecheck`, `pnpm lint` (arquivo tocado), `pnpm build` e inspeção do `out/preload/index.js` (CommonJS) verdes. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [02 — Contrato IPC](02-contrato-ipc.md) · **Índice:** [README](../active/README.md) · **Próximo:** [04 — Testes rápidos](04-testes-rapidos.md)
