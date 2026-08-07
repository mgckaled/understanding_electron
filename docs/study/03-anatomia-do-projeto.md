# 03 — Anatomia do projeto

Este documento responde a uma pergunta prática: **onde as coisas moram, e por quê**. É o passeio pela árvore do projeto como ela está — não como o gerador de projetos a entregou.

A distinção importa. Um scaffold é um chute educado: alguém que não conhece o seu problema organizou pastas que servem para a maioria dos casos. O que você lê aqui é o resultado de sete fases de trabalho que moveram, dividiram e renomearam quase tudo — e cada mudança tem um motivo registrado.

> 🔍 Se quiser ver a distância percorrida, o [diário de bordo](04-diario-de-bordo.md) e o [`docs/HISTORY.md`](../HISTORY.md) contam o caminho. Aqui interessa o destino.

---

## Mapa geral

```text
data-lab/
├── src/
│   ├── shared/      contrato e vocabulário — os três processos conhecem
│   ├── core/        lógica pura — sem electron, sem react
│   ├── main/        ciclo de vida, janelas, roteamento de IPC
│   ├── workers/     entrypoints de processo auxiliar (ainda vazia)
│   ├── preload/     a única superfície exposta ao renderer
│   └── renderer/    a interface, em React
├── config/          o que é lido por mais de uma ferramenta
├── e2e/             testes que sobem o aplicativo de verdade
├── test/            apoio para os testes rápidos
├── scripts/         utilitários de desenvolvimento
├── build/           ícones e recursos do instalador
├── resources/       recursos que vão empacotados no aplicativo
└── docs/            esta documentação
```

Os arquivos de configuração da raiz — e são muitos — têm caderno próprio: [06 — A montanha de configuração](06-a-montanha-de-configuracao.md).

---

## As seis pastas de `src/`

A primeira coisa a entender é que **três delas não foram escolha nossa**. `main`, `preload` e `renderer` são impostas pelo Electron: são três ambientes de execução com globais diferentes e compilação separada. Qualquer projeto Electron tem essa divisão, com ou sem nome.

As outras três nomeiam o que sobra quando você para de misturar coisas.

### `shared/` — o vocabulário comum

O que os três processos precisam concordar: o contrato de comunicação, os tipos de domínio, as constantes de identidade.

```text
src/shared/
├── ipc.ts        o contrato: que canais existem, o que entra, o que sai
├── channels.ts   nomes de canal que o preload precisa em tempo de execução
└── meta.ts       identidade do aplicativo
```

⚠️ `channels.ts` existir separado de `ipc.ts` parece redundância e não é. `ipc.ts` importa uma biblioteca de validação; `channels.ts` não importa nada. A razão é o sandbox: o preload não consegue carregar biblioteca de terceiro, então **todo valor que o preload consome de `shared/` precisa vir de um arquivo sem dependência externa**. Ignorar isso derrubou a interface inteira uma vez, sem nenhum erro no terminal. O caso está no [diário de bordo](04-diario-de-bordo.md).

### `core/` — a lógica que não sabe onde está rodando

Funções puras: recebem dados, devolvem dados. Nenhum `import` de `electron`, nenhum de `react`.

```text
src/core/
├── result.ts        construtores de sucesso e falha
├── url.ts           validação de esquema antes de entregar ao sistema
└── dataset/scan.ts  dedução de separador e contagem de linhas
```

O critério que separa `core/` de `shared/` é **vocabulário contra comportamento**. `shared/` diz *o que as coisas são*; `core/` diz *o que se faz com elas*. Um tipo `DatasetSummary` é vocabulário. A função que percorre linhas e deduz o separador é comportamento.

Por que isso paga: `core/` é a única camada testável sem nenhuma cerimônia. Sem subir Electron, sem simular navegador, sem mock. É também a única com meta de cobertura, justamente porque é onde o teste é barato e o erro é caro.

### `main/` — coordena, e nada mais

```text
src/main/
├── index.ts              ciclo de vida e criação de janela
├── jobs.ts               registro de tarefas canceláveis
├── ipc/
│   ├── registry.ts       o único arquivo que conhece ipcMain.handle
│   └── register-all.ts   liga cada canal ao seu handler
└── features/
    ├── app/handlers.ts
    ├── dataset/handlers.ts
    ├── dataset/lines.ts
    ├── job/handlers.ts
    └── shell/handlers.ts
```

A regra que mantém isso saudável: **`index.ts` não cresce**. Ele cria a janela e cuida do ciclo de vida do aplicativo. Lógica de negócio ali dentro fica intestável e imóvel — e mover para um processo auxiliar depois vira reescrita, não refatoração.

Repare em `features/`: cada assunto tem sua pasta, com o handler como **função exportada comum**. Não é detalhe de organização. Um handler escrito direto dentro do registro de IPC só é alcançável subindo o Electron inteiro; como função exportada, ele é chamável em Node puro, num teste de milissegundos. É a propriedade que mais paga em todo o desenho, e ela caiu de bônus.

### `workers/` — vazia, de propósito

Reservada para processos auxiliares, onde vai morar o trabalho pesado quando a camada de dados chegar. Está no repositório vazia porque o lugar já foi decidido; deixar a decisão registrada custa uma pasta e evita que alguém, com pressa, coloque uma query de dez segundos no lugar errado.

### `preload/` — fino a ponto de não ter o que testar

```text
src/preload/
├── index.ts     monta o objeto exposto e o publica na ponte
└── index.d.ts   informa ao TypeScript que window.api existe
```

O `index.d.ts` é onde TypeScript e Electron se encontram de forma elegante:

```ts
import type { Api } from '@shared/ipc'

declare global {
  interface Window {
    api: Api
  }
}
```

O problema que ele resolve: `window.api` só existe em tempo de execução, criado pelo preload. O TypeScript, analisando o renderer estaticamente, não teria como saber disso. `declare global` diz ao compilador que aquela propriedade existe — e, por vir do mesmo tipo `Api` que o main implementa, o autocompletar do renderer passa a refletir o contrato real.

A extensão `.d.ts` significa *declaration file*: só declarações de tipo, nada executável.

### `renderer/` — uma aplicação web comum

```text
src/renderer/src/
├── App.tsx
├── main.tsx
├── components/
├── features/
│   └── open-dataset/     uma fatia vertical completa
└── shared/
    ├── hooks/            comportamento reutilizável
    └── ui/               primitivos, tokens e estado de tela
```

Nada aqui sabe o que é Electron, exceto pelo `window.api`. Todo conhecimento de React se aplica sem tradução.

A organização em `features/` é uma **fatia vertical**: a pasta `open-dataset/` contém o painel, o hook que orquestra a operação e o CSS — tudo que aquela funcionalidade precisa, junto. O que é genérico o bastante para servir a duas features sobe para `shared/`.

⚠️ Existem dois `shared/` no projeto — `src/shared/` e `src/renderer/src/shared/` — e eles significam coisas diferentes. O primeiro atravessa a fronteira de processo; o segundo é reuso interno do renderer. A ambiguidade já custou uma métrica de cobertura distorcida em silêncio, porque um padrão de busca mal ancorado capturou os dois.

---

## A tabela de importação

Esta é a parte que transforma as pastas em arquitetura. Cada camada pode importar uma lista, e não pode importar o resto:

| Camada | Pode importar | Nunca importa |
|---|---|---|
| `shared/` | apenas a lib de validação | tudo o mais |
| `core/` | `shared/`, biblioteca padrão do Node | `electron`, `react`, qualquer camada acima |
| `main/` | `shared/`, `core/`, `electron` | `react`, `renderer/`, `preload/` |
| `workers/` | `shared/`, `core/` | `react`, `renderer/`, `main/` |
| `preload/` | `shared/` (**só tipos**), `electron` | `core/`, `main/`, `renderer/` |
| `renderer/` | `shared/` (só tipos), `core/`, `react` | `electron`, `main/`, `preload/` |

Duas linhas merecem atenção.

**`renderer/` nunca importa `electron`.** É o erro mais comum e mais silencioso em Electron, porque o TypeScript *aceita* — o pacote está instalado e os tipos resolvem. A falha só aparece em execução, no navegador, como `require is not defined`.

**`preload/` importa `shared/` só por tipo.** Tipo desaparece na compilação; valor não. É a regra que o `channels.ts` existe para respeitar.

E o detalhe que faz diferença: **essa tabela é verificada por lint**, não por revisão de código. Regra que existe só em documento é regra que se descobre violada seis arquivos depois.

---

## Os `tsconfig`

Talvez a parte mais confusa para quem chega, e uma das mais instrutivas. São quatro arquivos, três projetos.

**`tsconfig.json`** não configura nada — só aponta:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" },
    { "path": "./tsconfig.e2e.json" }
  ]
}
```

Isso é **project references**, um recurso do TypeScript para dividir uma base de código em projetos independentes.

| Projeto | Cobre | Ambiente |
|---|---|---|
| `tsconfig.node.json` | `main`, `preload`, `shared`, `core`, `workers`, `config` | Node: `fs`, `path`, `process` |
| `tsconfig.web.json` | `renderer`, `shared`, `core`, `test` | navegador: `document`, `window`, `fetch` |
| `tsconfig.e2e.json` | `e2e` | testes que dirigem o aplicativo real |

**Por que separar?** Porque a separação *é* a arquitetura. Com um `tsconfig` só, você poderia escrever `import fs from 'fs'` num componente React e o compilador aprovaria; o erro apareceria em execução. Com projetos separados, isso vira erro de compilação imediato.

**O sistema de tipos passa a reforçar o modelo de segurança do Electron** — a fronteira entre processos deixa de ser convenção e vira algo verificado por máquina. É por isso que `pnpm typecheck` roda os três: verificar um só dá cobertura parcial com aparência de cobertura total.

---

## Os aliases

Um arquivo pequeno com efeito desproporcional (`config/aliases.ts`):

```ts
export const aliases = {
  '@shared': resolve('src/shared'),
  '@core': resolve('src/core'),
  '@renderer': resolve('src/renderer/src')
}
```

Sem isso, um arquivo fundo na árvore importaria o contrato como `../../../../../shared/ipc`, e qualquer arquivo que mudasse de lugar quebraria a contagem de pontos.

⚠️ O ponto interessante é **por que este arquivo existe em vez de a lista estar escrita direto na configuração do bundler**: o mesmo alias precisa ser conhecido pelo bundler (para resolver na hora de compilar) e pelo TypeScript (para resolver na hora de checar). São ferramentas diferentes lendo arquivos diferentes. Um arquivo único que ambos consomem é o que impede que divirjam — e alias divergente produz um sintoma desconcertante: o editor reclama mas o build funciona, ou o contrário.

`@renderer` só existe no projeto web, deliberadamente: `main/` e `workers/` não devem importar do renderer, e a ausência do atalho é mais uma barreira.

---

## O que ler primeiro

Se for gastar meia hora com o código, siga o caminho de uma operação real — abrir um arquivo de dados. São seis paradas, e elas são o projeto inteiro em miniatura:

1. `src/renderer/src/features/open-dataset/OpenDatasetPanel.tsx` — onde o clique começa
2. `src/renderer/src/features/open-dataset/useOpenDataset.ts` — quem orquestra a operação
3. `src/shared/ipc.ts` — o contrato que descreve o que pode ser pedido
4. `src/preload/index.ts` — a travessia
5. `src/main/ipc/register-all.ts` — onde o pedido encontra quem o atende
6. `src/core/dataset/scan.ts` — o trabalho de verdade, em função pura

Repare no que acontece na terceira parada: o contrato é lido pelos dois lados. Essa é a diferença central entre este projeto e o exemplo de IPC que a maioria dos tutoriais mostra — e é o assunto do [caderno 07](07-camadas-e-contrato.md).

---

**Anterior:** [02 — Como escolher a stack](02-a-stack-e-o-porque.md) · **Índice:** [README](README.md) · **Próximo:** [04 — Diário de bordo](04-diario-de-bordo.md)
