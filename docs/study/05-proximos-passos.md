# 05 — Próximos passos

A fundação está construída: contrato de comunicação tipado, fronteira de segurança fechada, cinco níveis de teste, uma feature atravessando os três processos de ponta a ponta e o aplicativo empacotado verificado. Este documento descreve o que vem em seguida — a camada de dados — e, mais importante, **por que o desenho é esse**.

Nada aqui está implementado ainda. É um plano com justificativa, para ser conferido contra a realidade quando a implementação acontecer.

---

## O problema real

Um aplicativo de análise de dados precisa de três coisas que brigam entre si:

1. **Ler arquivos grandes** — CSV, Parquet, com milhões de linhas
2. **Agregar rápido** — somas, agrupamentos, filtros, em tempo interativo
3. **Manter a interface responsiva** — o usuário precisa poder cancelar, rolar, clicar

A arquitetura do Electron torna o item 3 surpreendentemente difícil, e vale entender por quê antes de escrever qualquer linha.

---

## A armadilha do processo principal

Como visto no [documento 01](01-o-que-e-electron.md), o processo main é **single-threaded** — executa uma coisa de cada vez.

Se você colocar uma query de dez segundos no main, o que congela não é só a query. É:

- a janela inteira (ela não redesenha)
- os menus
- o botão de fechar
- qualquer outra janela do aplicativo

O sistema operacional provavelmente vai marcar o app como "não está respondendo". E não há como cancelar, porque o código que responderia ao clique de cancelamento está na fila atrás da query.

O renderer também não serve. Ele é um navegador: sem acesso a arquivos, e módulos nativos não carregam ali — menos ainda com o sandbox ligado, que é o estado atual da fronteira.

**A solução é um terceiro lugar.**

---

## `utilityProcess`

O Electron oferece uma API chamada `utilityProcess`: um processo Node adicional, filho do main, sem interface gráfica.

```
┌─────────────┐   IPC    ┌──────────────┐   IPC    ┌─────────────────┐
│  renderer   │ ───────► │     main      │ ───────► │ utilityProcess  │
│  (React)    │ ◄─────── │  (coordena)   │ ◄─────── │    (DuckDB)     │
└─────────────┘          └──────────────┘          └─────────────────┘
     UI                    orquestração              trabalho pesado
```

Uma query de dez segundos ali dentro não afeta ninguém. A janela continua desenhando, o botão de cancelar continua clicável, o usuário continua no controle.

> 🔍 Existem alternativas — `child_process.fork` do Node, ou `worker_threads`. O `utilityProcess` é a opção específica do Electron, integrada ao ciclo de vida da aplicação (morre junto com o app, aparece corretamente no gerenciador de tarefas) e com um canal de mensagens mais eficiente que o IPC genérico.

---

## DuckDB

**O que é:** um banco de dados analítico que roda embutido no seu processo — sem servidor, sem instalação separada, sem porta de rede. A comparação usual é "o SQLite da análise de dados".

**Por que ele e não SQLite:** a diferença está no formato de armazenamento.

O SQLite é **orientado a linhas**: guarda registro por registro, um do lado do outro. Ótimo para "me dê o pedido 4521 inteiro". Ruim para "me dê a média de uma coluna em dez milhões de registros" — porque para ler uma coluna ele precisa passar por todas as outras.

O DuckDB é **orientado a colunas**: guarda cada coluna em bloco contíguo. Uma agregação em uma coluna lê só aquela coluna. Para o padrão de acesso da análise de dados, a diferença é de ordens de grandeza.

**Por que não Python com pandas:** foi uma opção considerada. Rodar um processo Python paralelo daria acesso ao ecossistema científico maduro. O custo é dobrar a complexidade: dois runtimes para empacotar, duas cadeias de dependências, um protocolo entre eles, e o desafio nada trivial de distribuir um interpretador Python dentro de um instalador. Num projeto cujo objetivo declarado é aprender Electron, essa complexidade compete com o aprendizado em vez de servi-lo.

**O pacote:** `@duckdb/node-api`. A versão a fixar fica em [`CLAUDE.md`](../../CLAUDE.md) quando a instalação acontecer.

⚠️ Existe um pacote mais antigo chamado apenas `duckdb`, que aparece primeiro em muita busca e em tutorial desatualizado. Ele foi **descontinuado** em favor do `@duckdb/node-api`. Vale conferir a data do que você estiver lendo antes de copiar o comando de instalação.

### Por que ele não vai exigir recompilação

O DuckDB é um **módulo nativo** — contém código C++ compilado. Como visto no [documento 02](02-a-stack-e-o-porque.md), isso normalmente cria o problema de ABI: um binário compilado para um runtime pode não carregar em outro.

O `@duckdb/node-api` usa **N-API** (também chamada Node-API), uma camada de interface deliberadamente estável. Módulos escritos contra a N-API funcionam em diferentes versões do Node — e do Electron — sem recompilar.

Foi um critério explícito na escolha. A alternativa seria assumir a manutenção de uma matriz de builds: plataforma × arquitetura × versão de ABI, multiplicada a cada atualização do Electron.

> 🔍 O mecanismo de recompilação existe e já está funcionando no projeto — é o `electron-builder install-app-deps` que roda a cada `pnpm install`, chamando o `@electron/rebuild`. Ter isso validado *antes* de adicionar o DuckDB foi deliberado: se algo falhar agora, você sabe que não é o pipeline.

---

## Apache Arrow: o transporte

Este é o detalhe que mais impacta desempenho e que é mais fácil de errar.

### O problema

Processos não compartilham memória. Para o resultado de uma query chegar ao React, ele precisa atravessar uma fronteira de processo. O caminho ingênuo é serializar para JSON:

```
DuckDB → objetos JS → JSON.stringify → texto → JSON.parse → objetos JS → React
```

Para um milhão de linhas, isso significa: alocar um milhão de objetos, converter tudo para texto (com nomes de campo repetidos em cada linha), transmitir megabytes de string, e reconstruir tudo do outro lado. São segundos de CPU e picos violentos de memória.

### A solução

**Apache Arrow** é um formato de memória colunar padronizado. Os dados ficam como blocos binários contíguos — um por coluna — em vez de objetos individuais.

```
DuckDB → Arrow (já é o formato nativo dele) → ArrayBuffer transferível → React
```

Duas propriedades fazem a diferença:

1. **O DuckDB já produz Arrow nativamente.** Não há conversão na origem — os dados saem no formato final.
2. **`ArrayBuffer` é transferível — dentro de um processo.** Entre renderer e um Web Worker, por exemplo, onde a memória é a mesma, o IPC pode *transferir a posse* do bloco em vez de copiá-lo, e a operação é praticamente instantânea. **Entre processos do sistema operacional — o caso daqui — os bytes são copiados de qualquer forma**; a posse não muda de dono, porque não há memória compartilhada para transferir posse sobre ela.

A vantagem sobre JSON não desaparece por isso — só muda de origem. O *structured clone* binário do Arrow copia um bloco contíguo por coluna; o caminho por JSON aloca um milhão de objetos e os converte para texto, com nomes de campo repetidos em cada linha. É cópia rápida contra reconstrução objeto a objeto, e a diferença continua sendo de ordens de grandeza — mas **meça no passo 5 abaixo antes de assumir milissegundos**: é uma cópia de bytes, não uma operação grátis.

⚠️ Duas ressalvas. Primeiro: quando a transferência de posse *de fato* ocorre — dentro do mesmo processo — ela é real: depois de enviado, o `ArrayBuffer` fica inutilizável na origem, o que surpreende quem espera semântica de cópia. Segundo, a implementação do Electron tem limitações conhecidas nesta área — há relato de mensagem que chega vazia ao transferir um `ArrayBuffer` de renderer para main, e de crash com certos transferíveis na lista do `MessagePortMain`. Correção e decisão completas em [`docs/plan/active/00-visao-geral.md`](../plan/active/00-visao-geral.md#uma-correção-no-caderno-de-estudos) e [`docs/HISTORY.md`](../HISTORY.md).

---

## Virtualização na interface

Última peça, e a mais fácil de esquecer.

Mesmo com os dados chegando instantaneamente, renderizar um milhão de linhas em HTML trava o navegador. Cada linha vira elementos no **DOM** (*Document Object Model*, a árvore de objetos que representa a página), e o Chromium não foi feito para milhões de nós.

A técnica é **virtualização**: renderizar apenas as linhas visíveis na tela — tipicamente algumas dezenas — e substituí-las conforme o usuário rola. A tabela *parece* ter um milhão de linhas; o DOM tem cinquenta.

Biblioteca sugerida: **TanStack Table** com **TanStack Virtual**. Para gráficos, **ECharts** lida bem com volumes grandes.

**Regra prática:** nunca mais que ~200 linhas no DOM simultaneamente. Está registrada no `CLAUDE.md`.

---

## Ordem de implementação sugerida

Seguindo o princípio de **uma variável por vez**:

**1. Instalar e validar isoladamente**

```powershell
pnpm add @duckdb/node-api apache-arrow
pnpm approve-builds   # se algum pedir script de build
pnpm dev              # a janela ainda abre?
```

Só isso. Sem escrever código. Confirmar que adicionar um módulo nativo não quebrou nada.

**2. Query no processo main, temporariamente**

Sim, contrariando tudo que foi dito acima. O objetivo é isolar variáveis: aprender a API do DuckDB sem misturar com a complexidade do `utilityProcess`. Uma query trivial (`SELECT 42`), resultado no console.

**3. Mover para o `utilityProcess`**

Agora sim. Query já funcionando, muda-se apenas o *onde*. Se quebrar, o problema está claramente na comunicação entre processos.

**4. Ligar ao renderer pelo contrato**

Diferente do que este documento previa quando foi escrito: não há mais um `api = {}` vazio para preencher. O contrato tipado existe desde a fase 02, e estender é acrescentar uma entrada em `src/shared/ipc.ts` — o canal, o formato dos argumentos e o formato do resultado — e registrar o handler correspondente. O preload e o tipo de `window.api` derivam daí sozinhos.

Uma operação só, para começar. O caminho completo está no [caderno 07](07-camadas-e-contrato.md).

**5. Arrow no transporte**

Trocar o retorno de JSON para `ArrayBuffer` transferível. Medir a diferença — vale fazer o experimento com um arquivo grande de verdade, porque o número surpreende.

**6. Tabela virtualizada**

Só agora a interface de verdade.

Cada etapa termina com `pnpm dev` funcionando e um commit. Seis pontos de retorno conhecidos-bons.

---

## A armadilha que só aparece no instalador

Uma pendência específica desta etapa merece destaque, porque tem um padrão de falha traiçoeiro: **o `.node` do DuckDB provavelmente vai precisar de entrada em `asarUnpack`.**

Biblioteca nativa não carrega de dentro do arquivo compactado em que o empacotador guarda o código — o sistema operacional precisa de um arquivo real no disco para carregar código binário. Sem essa entrada, o aplicativo funciona perfeitamente em desenvolvimento e falha só depois de empacotado.

Saber disso de antemão transforma uma tarde de investigação em cinco minutos. E é a razão de o projeto ter construído o teste do aplicativo empacotado **antes** de instalar o primeiro módulo nativo: quando o DuckDB chegar, a falha vem com o dedo apontado, em vez de misturada a dez outras coisas novas.

As demais pendências desta etapa — incluindo a que decide o layout de `node_modules` — estão no [`ROADMAP.md`](../ROADMAP.md), com o evento que reabre cada uma.

---

## O que este projeto ensina além do Electron

Vale registrar, porque é o retorno menos óbvio do esforço.

Escrever um app Electron de análise de dados obriga a pensar em coisas que frameworks web escondem: onde a memória está, quem é dono dela, o que custa atravessar uma fronteira de processo, por que um formato colunar é diferente de um orientado a linhas, o que é uma ABI.

São conceitos de sistemas, não de front-end. E são transferíveis — valem para qualquer contexto em que desempenho importe, muito depois de o Electron 42 ter virado história.

---

**Anterior:** [04 — Diário de bordo](04-diario-de-bordo.md) · **Índice:** [README](README.md)
