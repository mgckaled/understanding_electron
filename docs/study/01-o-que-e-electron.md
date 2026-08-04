# 01 — O que é Electron

## O problema que o Electron resolve

Um programa de desktop tradicional é escrito com as ferramentas do sistema operacional. No Windows você usaria C# ou C++ com as APIs da Microsoft; no macOS, Swift com as bibliotecas da Apple; no Linux, GTK ou Qt. Três linguagens, três conjuntos de bibliotecas, três equipes — ou uma equipe muito cansada.

A ideia do Electron é contornar isso: já existe uma plataforma que roda igual nos três sistemas e que milhões de pessoas sabem programar — o **navegador web**. Se a interface do seu programa é HTML, CSS e JavaScript, ela funciona em qualquer lugar sem reescrita.

O truque é que o Electron não pede para o usuário abrir o navegador. Ele **embala um navegador inteiro dentro do seu programa**.

## A composição: Chromium + Node.js

Todo aplicativo Electron é a fusão de duas peças que já existiam:

**Chromium** é o motor de navegador de código aberto que serve de base para o Google Chrome, o Microsoft Edge e vários outros. É ele que sabe interpretar HTML, aplicar CSS e desenhar pixels na tela. No nosso projeto, a versão embutida é a **148**.

**Node.js** é o ambiente que permite executar JavaScript fora do navegador, com acesso ao sistema operacional — ler arquivos, abrir conexões de rede, iniciar outros programas. No nosso projeto, a versão embutida é a **24.18.0**.

O JavaScript que roda no navegador comum é deliberadamente impedido de tocar no seu disco rígido. Isso é uma proteção: você não quer que qualquer site visitado leia seus documentos. Mas um aplicativo de desktop *precisa* dessa capacidade. O Electron resolve juntando as duas coisas — a capacidade de desenhar interface do Chromium com a capacidade de mexer no sistema do Node.

> 🔍 É por isso que aplicativos Electron ocupam tanto espaço. Você não está distribuindo só o seu código: está distribuindo um navegador completo junto. O binário do Electron que baixamos tem mais de 200 MB antes de qualquer linha nossa. Esse é o preço da portabilidade, e é a crítica mais comum ao framework.

Aplicativos que você provavelmente já usou e que são Electron: Visual Studio Code, Slack, Discord, Notion, Obsidian — e o próprio aplicativo de desktop do Claude.

---

## Os três processos

Aqui está o conceito central. Um aplicativo Electron não é um programa só: são vários programas conversando entre si. Entender essa divisão é entender o Electron.

### Processo principal (main)

É o processo que nasce quando o aplicativo abre e morre quando ele fecha. Um só, sempre.

**Processo**, no vocabulário de sistemas operacionais, é um programa em execução com sua própria fatia isolada de memória. Dois processos não enxergam as variáveis um do outro; para trocar informação precisam de um canal explícito.

O main roda em Node.js puro — sem interface, sem tela. É ele que:

- cria e destrói janelas
- acessa o sistema de arquivos
- monta menus, ícone de bandeja, notificações
- coordena tudo o mais

No projeto: `src/main/index.ts`.

⚠️ **Consequência prática importante:** o main é *single-threaded*, ou seja, executa uma coisa de cada vez. Se você mandar ele processar um arquivo de 2 GB, o aplicativo inteiro congela — janela, menus, botões, tudo — até terminar. Para um app de análise de dados isso é a armadilha número um, e é por isso que planejamos colocar o DuckDB num processo separado.

### Processo de renderização (renderer)

Um por janela. É aqui que sua interface vive: HTML, CSS, React, gráficos, tabelas.

O renderer é essencialmente uma aba de navegador. E, por padrão, ele tem as mesmas limitações de segurança de uma aba: **não pode ler arquivos do seu disco nem usar APIs do Node.** Isso é intencional, e é a decisão de design mais importante do Electron moderno.

Por quê? Porque a interface é a superfície de ataque. Se o seu app carrega qualquer conteúdo externo — uma imagem, um link, um trecho de HTML vindo de fora — e o renderer tiver acesso irrestrito ao sistema, uma falha vira controle total da máquina do usuário.

No projeto: `src/renderer/`.

### Script de pré-carregamento (preload)

A ponte entre os dois mundos, e o conceito que mais confunde no começo.

O preload roda **antes** da página carregar, dentro do renderer, mas com um privilégio especial: ele enxerga tanto as APIs do Node quanto o objeto `window` da página. Ele existe para expor, de forma controlada e explícita, apenas as funções que o renderer tem permissão de usar.

No projeto: `src/preload/index.ts`.

A analogia que funciona: pense num banco. O renderer é o cliente no saguão. O main é o cofre. O preload é o caixa — a única pessoa autorizada a atravessar, e que só executa operações de uma lista predefinida. O cliente nunca entra no cofre; ele pede ao caixa.

---

## Como os três conversam: IPC

**IPC** significa *Inter-Process Communication*, comunicação entre processos. É o mecanismo pelo qual o renderer pede algo ao main.

O template já traz um exemplo mínimo funcionando — o botão "Send IPC" da tela inicial. Vale seguir o caminho completo dele, porque **tudo** que você fizer neste app vai passar por aqui.

**Passo 1 — o preload abre a porta** (`src/preload/index.ts`):

```ts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
}
```

`contextBridge.exposeInMainWorld` é a função que cria uma ponte. Ela pega um objeto e o disponibiliza como uma variável global na página — aqui, `window.electron`.

O nome `exposeInMainWorld` merece explicação. O Electron mantém dois "mundos" de JavaScript separados dentro do renderer: o mundo isolado, onde o preload roda, e o mundo principal, onde o código da sua página roda. Eles não compartilham variáveis. Essa separação chama-se **context isolation** (isolamento de contexto) e existe para que código malicioso na página não consiga alcançar e modificar as funções privilegiadas do preload. A ponte é a única passagem, e ela copia valores em vez de compartilhar referências.

**Passo 2 — o renderer usa a ponte** (`src/renderer/src/App.tsx`):

```tsx
const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
```

O React não sabe nada sobre Electron. Ele só vê um objeto global chamado `window.electron`, que apareceu ali graças ao preload. `send('ping')` dispara uma mensagem nomeada `ping` e segue em frente sem esperar resposta.

**Passo 3 — o main escuta** (`src/main/index.ts`):

```ts
ipcMain.on('ping', () => console.log('pong'))
```

Quando a mensagem `ping` chega, o main executa a função. O `pong` aparece no **terminal** onde você rodou `pnpm dev` — não no DevTools do navegador. Isso costuma confundir: são processos diferentes, com saídas de log diferentes.

> 🔍 Existem dois estilos de IPC. O `send`/`on` que vimos é unidirecional — dispara e esquece. Quando você precisa de resposta, usa `invoke` no renderer e `handle` no main, que retorna uma `Promise`. Para o DuckDB vamos usar `invoke`, porque toda query tem resultado.

---

## Por que essa arquitetura é tão chata (e por que vale a pena)

A pergunta natural de quem está começando é: por que não deixar o renderer acessar o Node direto e pronto?

Dá para fazer. O Electron tem opções que desligam essas proteções — `nodeIntegration: true` e `contextIsolation: false`. Nas primeiras versões, era até o padrão.

O problema é o modelo de ameaça. Sua aplicação de análise de dados vai abrir arquivos que você não escreveu — CSVs baixados, planilhas recebidas por e-mail, Parquet de fontes terceiras. Se algum conteúdo desses arquivos acabar interpretado como HTML na tela e o renderer tiver acesso irrestrito ao Node, um CSV malformado vira execução de código arbitrário na máquina do usuário.

Com a arquitetura de três processos, o pior caso é bem menor: o atacante fica preso no renderer e só consegue chamar as funções que o preload explicitamente expôs. Se você expôs apenas `executarQuery(sql)`, é só isso que ele tem.

A chatice de escrever preload é o preço de um limite de segurança real. É o mesmo raciocínio de usar TypeScript: mais cerimônia agora, menos investigação de bug depois.

---

## Uma pendência honesta neste projeto

Ao revisar `src/main/index.ts`, você vai encontrar:

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false          // ← aqui
}
```

O **sandbox** é uma camada de isolamento adicional do Chromium que restringe ainda mais o que o processo de renderização pode fazer no sistema operacional, mesmo que alguém consiga executar código dentro dele.

O template do electron-vite vem com ele desligado, porque com o sandbox ativo o preload perde acesso à maior parte das APIs do Node — o que complica o uso de bibliotecas auxiliares nesse ponto.

Não é uma decisão que tomamos: é o padrão que veio. Está registrado no `CLAUDE.md` como pendência a revisitar antes de qualquer build de produção. E vale notar que ele influencia diretamente o desenho da camada de dados: com `sandbox: true`, um módulo nativo como o DuckDB definitivamente não carrega no renderer — o que reforça a decisão de colocá-lo num processo separado de qualquer forma.

---

**Próximo:** [02 — A stack e o porquê](02-a-stack-e-o-porque.md)
