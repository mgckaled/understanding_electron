# 05 — Próximos passos

A fundação está construída: contrato de comunicação tipado, fronteira de segurança fechada, cinco níveis de teste, uma feature atravessando os três processos de ponta a ponta e o aplicativo empacotado verificado. Este documento descreve o que vem em seguida — a camada de dados — e, mais importante, **por que o desenho é esse**.

Nada aqui está implementado ainda. É um plano com justificativa, para ser conferido contra a realidade quando a implementação acontecer.

> ⚠️ **O plano 18 (sub-planos 18-A a 18-F) já implementou a camada de dados, ago/2026.** As correções pontuais abaixo (Arrow montado em JS, ordem dos `SET`, etc.) continuam registradas aqui como parte do caderno de aprendizado — o valor pedagógico é justamente ver o que a implementação real corrigiu. Mas o que se **consulta enquanto se edita código** — motor restrito, `memory_limit`, extensão vendorizada, o veredito Arrow-vs-JSON, formatos suportados — tem dono na skill [`data`](../../.claude/skills/data/SKILL.md) desde R-3. Este documento continua sendo a explicação de conceito (por que `utilityProcess`, por que colunar, o que é ABI/N-API), não a fonte operacional.

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
DuckDB → objetos JS colunares → Arrow montado em JS → ArrayBuffer → React
```

⚠️ **Correção (plano 18-B, ago/2026): o DuckDB NÃO produz Arrow nativamente neste binding.** A frase original desta seção — "o DuckDB já produz Arrow nativamente, não há conversão na origem" — era verdade para o cliente Python (`.arrow()`/`to_arrow_reader()`), mas **não** para `@duckdb/node-api`: a exportação Arrow é uma [issue aberta](https://github.com/duckdb/duckdb-node-neo/issues/45), sem prazo. O que o binding devolve é dado JS nativo (`getColumnsObject()`), e a `Table` Arrow é **montada em JS**, via `apache-arrow` (`tableFromArrays`/`tableToIPC`) — ver `core/duckdb/arrow.ts`.

Essa correção muda o que domina o custo. `ArrayBuffer`/bytes Arrow continuam **copiados**, não transferidos, entre processos do sistema operacional — não há memória compartilhada para transferir posse sobre ela, e o IPC do Electron não aceita lista de transferência em `invoke`/`send` de qualquer forma (skill `ipc`). Mas **medido no plano 18-B, não suposto:** a cópia em si é barata nas duas formas — ≤20ms mesmo a 100 mil linhas, tanto para os bytes Arrow quanto para o texto JSON. O que pesa é **montar e desmontar a `Table` em JS**, porque o motor não entrega Arrow pronto: nessa mesma medição (100 mil linhas, sem `LIMIT`), o caminho por JSON (`JSON.stringify`/`JSON.parse`, embutidos e muito otimizados) venceu Arrow por ~2,4× no tempo total. A vantagem de Arrow sobre JSON que esta seção previa **não se confirmou** para este binding, nesta escala — números completos e o porquê o canal ficou com Arrow mesmo assim: [`docs/HISTORY-archive.md`](../HISTORY-archive.md) § Plano 18-B.

⚠️ Duas ressalvas. Primeiro: quando a transferência de posse *de fato* ocorre — dentro do mesmo processo — ela é real: depois de enviado, o `ArrayBuffer` fica inutilizável na origem, o que surpreende quem espera semântica de cópia. Segundo, a implementação do Electron tem limitações conhecidas nesta área — há relato de mensagem que chega vazia ao transferir um `ArrayBuffer` de renderer para main, e de crash com certos transferíveis na lista do `MessagePortMain`. Correção e decisão completas em [`docs/plan/implemented/00-visao-geral.md`](../plan/implemented/00-visao-geral.md#uma-correção-no-caderno-de-estudos) e [`docs/HISTORY.md`](../HISTORY.md).

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

Trocar o retorno de JSON para `ArrayBuffer` transferível. Medir a diferença — vale fazer o experimento com um arquivo grande de verdade, porque o número surpreende. **Feito no plano 18-B, e o número surpreendeu — só que ao contrário do que esta frase supunha:** JSON venceu Arrow no tempo total, nas duas escalas medidas. Ver a correção no topo desta seção e [`HISTORY-archive.md`](../HISTORY-archive.md) § Plano 18-B.

**6. Tabela virtualizada**

Só agora a interface de verdade.

Cada etapa termina com `pnpm dev` funcionando e um commit. Seis pontos de retorno conhecidos-bons.

---

## A armadilha que só aparece no instalador

Uma pendência específica desta etapa merece destaque, porque tem um padrão de falha traiçoeiro: biblioteca nativa não carrega de dentro do arquivo compactado em que o empacotador guarda o código — o sistema operacional precisa de um arquivo real no disco para carregar código binário.

**Correção do plano 18-A (ago/2026):** o `electron-builder` já resolve isso sozinho na maioria dos casos — `asar.smartUnpack` (default `true`) detecta `.node` automaticamente e o extrai para `app.asar.unpacked`, sem entrada manual nenhuma. Sabotado ao vivo: um build sem qualquer `asarUnpack` para o DuckDB ainda assim produziu o binário desempacotado corretamente. Continua valendo escrever a entrada explícita — documenta a dependência e blinda contra o default mudar numa versão futura —, mas "vai quebrar sem isso" era afirmação não testada nesta base; o app **não** teria quebrado. E o caminho do `.pnpm/` observado em disco (pnpm sem `shamefullyHoist`) não é o caminho que sobrevive dentro do pacote — `electron-builder` achata `node_modules` ao empacotar, então o glob mira a árvore achatada, nunca o layout de origem. Detalhe e como verificar: [`HISTORY.md`](../HISTORY.md).

Saber disso de antemão transforma uma tarde de investigação em cinco minutos. E é a razão de o projeto ter construído o teste do aplicativo empacotado **antes** de instalar o primeiro módulo nativo: quando o DuckDB chegar, a falha vem com o dedo apontado, em vez de misturada a dez outras coisas novas.

As demais pendências desta etapa — incluindo a que decide o layout de `node_modules` — estão no [`ROADMAP.md`](../ROADMAP.md), com o evento que reabre cada uma.

---

## O que este projeto ensina além do Electron

Vale registrar, porque é o retorno menos óbvio do esforço.

Escrever um app Electron de análise de dados obriga a pensar em coisas que frameworks web escondem: onde a memória está, quem é dono dela, o que custa atravessar uma fronteira de processo, por que um formato colunar é diferente de um orientado a linhas, o que é uma ABI.

São conceitos de sistemas, não de front-end. E são transferíveis — valem para qualquer contexto em que desempenho importe, muito depois de o Electron 42 ter virado história.

---

**Anterior:** [04 — Diário de bordo](04-diario-de-bordo.md) · **Índice:** [README](README.md)
