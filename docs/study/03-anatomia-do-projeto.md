# 03 — Anatomia do projeto

O comando `pnpm create @quick-start/electron .` gerou cerca de vinte arquivos. Este documento percorre os que importam e explica o papel de cada um. Ler código de scaffold com atenção é uma das formas mais eficientes de aprender um framework — o template embute decisões que alguém experiente já tomou.

## Mapa geral

```
data-lab/
├── src/
│   ├── main/index.ts          ← processo principal (Node)
│   ├── preload/
│   │   ├── index.ts           ← a ponte
│   │   └── index.d.ts         ← tipos da ponte
│   └── renderer/
│       ├── index.html         ← ponto de entrada da página
│       └── src/               ← aplicação React
├── build/                     ← ícones e recursos do instalador
├── resources/                 ← recursos empacotados no app
├── out/                       ← saída compilada (não versionada)
├── electron.vite.config.ts    ← configuração de build dos 3 alvos
├── electron-builder.yml       ← configuração de empacotamento
├── tsconfig.json              ← raiz, só aponta para os outros dois
├── tsconfig.node.json         ← tipos para main + preload
├── tsconfig.web.json          ← tipos para renderer
├── pnpm-workspace.yaml        ← configuração do pnpm
└── package.json
```

A divisão de `src/` em três pastas **espelha exatamente os três processos**. Não é organização estética: são três alvos de compilação distintos, com regras diferentes.

---

## `src/main/index.ts` — o processo principal

O arquivo mais denso do template. Vamos por partes.

### Criando a janela

```ts
const mainWindow = new BrowserWindow({
  width: 900,
  height: 670,
  show: false,
  autoHideMenuBar: true,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false
  }
})
```

`BrowserWindow` é a classe que representa uma janela. Cada instância cria um processo de renderização novo.

**`show: false`** parece contraintuitivo — criar uma janela invisível. É uma técnica deliberada, explicada logo abaixo:

```ts
mainWindow.on('ready-to-show', () => {
  mainWindow.show()
})
```

A janela só aparece quando o conteúdo terminou de renderizar. Sem isso, o usuário veria um retângulo branco piscando antes da interface aparecer. Detalhe pequeno que separa app que parece profissional de app que parece protótipo.

**`preload`** aponta para o arquivo *compilado*, em `out/`, não para o `.ts` que você edita. Vale internalizar: o Electron nunca executa TypeScript diretamente — sempre o JavaScript gerado pelo build.

### Abrindo links externos com segurança

```ts
mainWindow.webContents.setWindowOpenHandler((details) => {
  shell.openExternal(details.url)
  return { action: 'deny' }
})
```

Isso intercepta qualquer tentativa de abrir uma nova janela. Em vez de permitir, abre a URL no navegador padrão do sistema e **nega** a abertura interna.

É uma proteção importante. Se um link abrisse numa janela Electron, ele carregaria conteúdo externo dentro do seu app, com o seu preload disponível. Empurrar para o navegador do sistema mantém a fronteira limpa.

### Desenvolvimento versus produção

```ts
if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}
```

Duas formas de carregar a interface:

- **Desenvolvimento:** a janela aponta para o servidor do Vite (`http://localhost:5173`). É isso que permite HMR — o Vite empurra as mudanças e a tela atualiza sem reiniciar.
- **Produção:** carrega o arquivo HTML compilado do disco. Não há servidor.

Por isso o `pnpm dev` mostra a URL do Vite no terminal antes de abrir a janela.

### O ciclo de vida do aplicativo

```ts
app.whenReady().then(() => { /* ... */ })
```

`app` representa a aplicação. `whenReady()` é uma `Promise` que resolve quando o Electron terminou de inicializar. Criar janela antes disso falha — e é um erro comum de quem está começando.

```ts
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

Esses dois blocos existem por uma diferença cultural entre sistemas operacionais. No Windows e no Linux, fechar a última janela encerra o programa. No macOS (`darwin`), o aplicativo continua vivo na dock — e clicar no ícone recria a janela.

É um bom exemplo de que "multiplataforma" não significa "idêntico em toda plataforma". O Electron entrega a mesma base de código, mas as convenções de cada sistema continuam sendo sua responsabilidade.

### O IPC de exemplo

```ts
ipcMain.on('ping', () => console.log('pong'))
```

Uma linha, mas é o embrião de tudo. `ipcMain` escuta mensagens vindas dos renderers. Quando o botão "Send IPC" é clicado, esta função roda e imprime `pong` **no terminal** — não no DevTools.

---

## `src/preload/index.ts` — a ponte

Curto e carregado de significado:

```ts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
```

`process.contextIsolated` informa se o isolamento de contexto está ativo. Se estiver (o padrão e o recomendado), o código usa a ponte formal; se não, atribui direto no `window`. O `else` existe só para compatibilidade com configurações legadas — no nosso caso, ele nunca executa.

**`const api = {}`** é o seu espaço. Está vazio de propósito: é aqui que as funções do seu aplicativo vão ser expostas. Quando o DuckDB entrar, algo assim vai aparecer:

```ts
const api = {
  executarQuery: (sql: string) => ipcRenderer.invoke('db:query', sql)
}
```

E o renderer chamaria `window.api.executarQuery('SELECT ...')`.

Repare no desenho: o renderer nunca ganha acesso genérico ao banco. Ele ganha acesso a *uma função específica*. Se amanhã você quiser validar o SQL, registrar log ou limitar o número de linhas, o ponto de intervenção é único e óbvio.

---

## `src/preload/index.d.ts` — o contrato tipado

```ts
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
  }
}
```

Este arquivo é onde TypeScript e Electron se encontram de forma elegante.

O problema: `window.electron` só existe em tempo de execução, criado pelo preload. O TypeScript, analisando o código do renderer estaticamente, não teria como saber disso — reclamaria que a propriedade não existe.

`declare global` resolve dizendo ao compilador: "confie em mim, o objeto `Window` tem essas propriedades". A extensão `.d.ts` significa *declaration file* — arquivo que contém apenas declarações de tipo, sem código executável.

**`api: unknown`** é o ponto a evoluir. `unknown` é o tipo "não sei o que é", e obriga verificação antes de qualquer uso. Quando você popular o `api` no preload, troque por uma interface de verdade:

```ts
interface DataLabAPI {
  executarQuery: (sql: string) => Promise<Uint8Array>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DataLabAPI
  }
}
```

A partir daí o autocompletar funciona no renderer, e mudar a assinatura no preload sem atualizar quem chama vira erro de compilação. **É esse arquivo que transforma o IPC — que é essencialmente troca de mensagens sem garantias — em algo verificável.** Sem ele, você teria strings mágicas de um lado e `any` do outro.

---

## `src/renderer/` — a aplicação React

### `index.html`

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
/>
```

**CSP** (*Content Security Policy*) é uma política que declara de onde a página pode carregar recursos. Aqui, `'self'` significa "apenas da própria origem" — nenhum script de domínio externo executa, mesmo que alguém consiga injetar uma tag `<script>`.

É mais uma camada de defesa, complementar ao isolamento de contexto. E é a razão de você não conseguir simplesmente colar um `<script src="https://cdn...">` e esperar que funcione.

### `main.tsx` e `App.tsx`

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

React padrão, sem nada de Electron. É o ponto: o renderer é uma aplicação web comum. Todo conhecimento de React se aplica sem tradução.

A única linha que revela o contexto Electron está em `App.tsx`:

```tsx
const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
```

### `components/Versions.tsx`

```tsx
const [versions] = useState(window.electron.process.versions)
```

É esse componente que desenha a barra inferior com Electron v42.8.0, Chromium v148 e Node v24.18.0.

Vale reparar: `window.electron.process` **não é** o `process` global do Node. É uma cópia limitada, exposta deliberadamente pelo preload. O renderer não tem o `process` de verdade — só o que a ponte permitiu passar. É o modelo de segurança funcionando na prática, visível num componente de cinco linhas.

---

## Os três `tsconfig`

Talvez a parte mais confusa do template para quem chega, e uma das mais instrutivas.

**`tsconfig.json`** — não configura nada:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

Isso é **project references**, um recurso do TypeScript para dividir uma base de código em projetos independentes. O arquivo raiz só aponta para os dois reais.

**`tsconfig.node.json`** cobre `src/main` e `src/preload`. Herda de uma base voltada a Node: tipos de `fs`, `path`, `process` disponíveis; APIs de navegador, não.

**`tsconfig.web.json`** cobre `src/renderer`. Herda de uma base voltada ao navegador: `document`, `window`, `fetch` disponíveis; `fs` e `path`, não.

**Por que separar?** Porque a separação *é* a arquitetura. Se houvesse um tsconfig só, você poderia escrever `import fs from 'fs'` num componente React e o TypeScript aprovaria. Só descobriria o erro quando a aplicação quebrasse em execução.

Com dois projetos separados, essa tentativa vira erro de compilação imediato. **O sistema de tipos passa a reforçar o modelo de segurança do Electron** — a fronteira entre os processos deixa de ser convenção e vira algo verificado por máquina.

É por isso que o `package.json` tem dois comandos de verificação:

```json
"typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
"typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
"typecheck": "npm run typecheck:node && npm run typecheck:web"
```

`--noEmit` significa "verifique os tipos, mas não gere JavaScript" — a geração é trabalho do Vite. Rodar só um dos dois dá cobertura parcial com aparência de cobertura total.

---

## `electron.vite.config.ts`

```ts
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react()]
  }
})
```

Três chaves, uma por alvo de compilação. `main` e `preload` estão vazias — os padrões bastam.

O renderer precisa de duas coisas: o plugin do React (para transformar JSX) e um **alias**, que permite escrever `import Botao from '@renderer/components/Botao'` em vez de contar `../../..`.

⚠️ O alias precisa ser declarado **em dois lugares**: aqui (para o Vite resolver na hora de compilar) e em `tsconfig.web.json`, no campo `paths` (para o TypeScript resolver na hora de checar). Esquecer um dos dois produz um erro desconcertante — o editor reclama mas o build funciona, ou o contrário.

---

## `electron-builder.yml`

Configuração de empacotamento. Dois pontos que vão importar em breve:

```yaml
asarUnpack:
  - resources/**
```

**ASAR** é um formato de arquivo compactado onde o electron-builder guarda o código da aplicação. O problema: bibliotecas nativas (`.node`) **não carregam de dentro de um ASAR** — o sistema operacional precisa de um arquivo real no disco para carregar código binário. `asarUnpack` lista o que fica de fora.

Quando o DuckDB entrar, essa lista provavelmente vai precisar de uma entrada. Fica anotado.

```yaml
npmRebuild: false
```

Desliga a recompilação automática de módulos nativos durante o empacotamento — porque isso já é feito antes, pelo `postinstall` do `package.json`:

```json
"postinstall": "electron-builder install-app-deps"
```

É esse comando que você viu rodar em todo `pnpm install`, imprimindo `executing @electron/rebuild electronVersion=42.8.0`. Ele garante que módulos nativos batam com a ABI do Electron. **É o mesmo mecanismo que o DuckDB vai exercitar** — e é bom que já esteja provado funcionando.

---

## O que ler primeiro

Se for gastar meia hora com o código antes de seguir, a sugestão é seguir o caminho do botão "Send IPC":

1. `src/renderer/src/App.tsx` — onde o clique dispara
2. `src/preload/index.ts` — a ponte que tornou a chamada possível
3. `src/main/index.ts` — onde a mensagem chega (procure por `ipcMain.on`)

São três arquivos e umas dez linhas relevantes. Mas esse trajeto é o Electron inteiro em miniatura, e tudo que este projeto fizer com dados vai percorrer exatamente o mesmo caminho.

---

**Anterior:** [02 — A stack e o porquê](02-a-stack-e-o-porque.md) · **Próximo:** [04 — Diário de bordo](04-diario-de-bordo.md)
