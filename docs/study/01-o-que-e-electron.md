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

Vale seguir um caminho completo, porque **tudo** que você fizer neste app vai passar por aqui. O exemplo abaixo é o mais simples que existe no projeto: o renderer pergunta ao main quais versões de Electron, Chromium e Node estão rodando.

**Passo 1 — o preload abre a porta** (`src/preload/index.ts`):

```ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  app: {
    info: () => ipcRenderer.invoke('app:info')
  }
}

contextBridge.exposeInMainWorld('api', api)
```

`contextBridge.exposeInMainWorld` é a função que cria uma ponte. Ela pega um objeto e o disponibiliza como uma variável global na página — aqui, `window.api`.

O nome `exposeInMainWorld` merece explicação. O Electron mantém dois "mundos" de JavaScript separados dentro do renderer: o mundo isolado, onde o preload roda, e o mundo principal, onde o código da sua página roda. Eles não compartilham variáveis. Essa separação chama-se **context isolation** (isolamento de contexto) e existe para que código malicioso na página não consiga alcançar e modificar as funções privilegiadas do preload. A ponte é a única passagem, e ela copia valores em vez de compartilhar referências.

Repare no formato do que atravessa: **uma função de domínio** (`api.app.info()`), não um `invoke` genérico. A diferença parece cosmética e não é. Se o preload expusesse `api.invoke(canal, args)`, o renderer poderia chamar qualquer canal registrado, e a ponte deixaria de ser uma lista de permissões para virar uma porta aberta com um nome.

**Passo 2 — o renderer usa a ponte** (`src/renderer/src/features/observatory/RuntimePanel.tsx`):

```tsx
useQuery({ queryKey: ['app', 'info'], queryFn: () => window.api.app.info() })
```

O React não sabe nada sobre Electron. Ele só vê um objeto global chamado `window.api`, que apareceu ali graças ao preload. A chamada devolve uma `Promise` — a resposta vem de outro processo, e isso leva tempo, então o componente desenha primeiro e preenche depois.

**Passo 3 — o main responde** (`src/main/ipc/register-all.ts`):

```ts
handle('app:info', () => getAppInfo(app.getVersion, is.dev))
```

Quando a mensagem `app:info` chega, o main executa a função e o valor de retorno viaja de volta, resolvendo a `Promise` do passo 2.

> 🔍 Existem dois estilos de IPC. O `invoke`/`handle` que vimos é bidirecional — pergunta e resposta, com `Promise`. Existe também `send`/`on`, unidirecional: dispara e esquece, sem valor de retorno. Este projeto usa `invoke` para tudo que é pergunta, e `send` só no sentido inverso, quando o main precisa avisar o renderer de algo que ninguém pediu — o progresso de uma tarefa longa, por exemplo.

⚠️ **Uma confusão clássica:** `console.log` no main aparece no **terminal** onde você rodou `pnpm dev`. `console.log` no renderer aparece no **DevTools** da janela (F12). São processos diferentes, com saídas diferentes, e procurar no lugar errado já custou tarde de gente experiente.

Esses três passos são o esqueleto. O que o projeto construiu por cima deles — para que o nome do canal não seja uma string solta escrita duas vezes, e para que um erro do main não chegue como texto inútil ao React — está no [caderno 07](07-camadas-e-contrato.md).

---

## Por que essa arquitetura é tão chata (e por que vale a pena)

A pergunta natural de quem está começando é: por que não deixar o renderer acessar o Node direto e pronto?

Dá para fazer. O Electron tem opções que desligam essas proteções — `nodeIntegration: true` e `contextIsolation: false`. Nas primeiras versões, era até o padrão.

O problema é o modelo de ameaça. Sua aplicação de análise de dados vai abrir arquivos que você não escreveu — CSVs baixados, planilhas recebidas por e-mail, Parquet de fontes terceiras. Se algum conteúdo desses arquivos acabar interpretado como HTML na tela e o renderer tiver acesso irrestrito ao Node, um CSV malformado vira execução de código arbitrário na máquina do usuário.

Com a arquitetura de três processos, o pior caso é bem menor: o atacante fica preso no renderer e só consegue chamar as funções que o preload explicitamente expôs. Se você expôs apenas `executarQuery(sql)`, é só isso que ele tem.

A chatice de escrever preload é o preço de um limite de segurança real. É o mesmo raciocínio de usar TypeScript: mais cerimônia agora, menos investigação de bug depois.

---

## A quarta camada: o sandbox

Ao revisar `src/main/index.ts`, você vai encontrar a fronteira escrita por extenso:

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false
}
```

O **sandbox** é uma camada de isolamento do Chromium que restringe o que o processo de renderização pode pedir ao sistema operacional — mesmo que alguém consiga executar código dentro dele. É a diferença entre "o invasor está preso numa sala" e "o invasor está preso numa sala e a sala não tem torneira, tomada nem janela".

As três opções acima já são o padrão do Electron moderno. Escrevê-las mesmo assim é uma decisão de legibilidade: um comentário curto no ponto de aplicação distingue *"padrão seguro"* de *"ninguém pensou nisso"* para quem abrir o arquivo daqui a seis meses — e qualquer alteração acidental passa a aparecer no diff.

**O preço do sandbox, que é real:** com ele ligado, o preload perde o `require` completo. Sobra um substituto limitado, incapaz de carregar bibliotecas de terceiros. Na prática, o preload precisa ser **um arquivo único e autossuficiente**, e essa restrição molda o código — ela já derrubou a interface inteira deste projeto uma vez, de um jeito que nenhum teste pegou. O caso está no [diário de bordo](04-diario-de-bordo.md).

> 🔍 O template do electron-vite vem com `sandbox: false`, e este projeto começou assim. A troca foi deliberadamente **adiada** até o preload ficar fino o bastante para que a mudança custasse uma linha em vez de uma tarde de depuração. Adiar sabendo o que se adia é diferente de esquecer — e a diferença entre as duas coisas é ter registrado. O raciocínio completo está no [`docs/HISTORY.md`](../HISTORY.md).

Isso também explica um ponto da camada de dados que vem mais à frente: com o sandbox ligado, um módulo nativo como o DuckDB definitivamente não carrega no renderer. A decisão de colocá-lo num processo separado deixa de ser preferência arquitetural e vira consequência.

---

**Próximo:** [02 — Como escolher a stack](02-a-stack-e-o-porque.md)
