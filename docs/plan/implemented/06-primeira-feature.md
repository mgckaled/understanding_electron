# 06 — Primeira feature vertical

**Depende de:** [02](02-contrato-ipc.md), [03](03-sandbox-e-seguranca.md), [04](04-testes-rapidos.md), [05](05-design-tokens.md) · **Entrega:** `open-dataset` de ponta a ponta, registro de jobs, organização em fatias

---

## Por que esta fase existe

As cinco fases anteriores entregaram peças que nunca funcionaram juntas. Contrato sem operação longa, testes sem lógica de domínio, tokens sem interface real, registro de jobs declarado mas não implementado.

Uma fatia vertical é o único jeito de descobrir o que não encaixa. E é melhor descobrir com uma feature deliberadamente pequena do que com a primeira query de DuckDB, onde os problemas de integração se misturariam com problemas de módulo nativo, `utilityProcess` e Arrow — quatro variáveis de uma vez, exatamente o que o [`CLAUDE.md`](../../../CLAUDE.md) proíbe.

## A feature escolhida

**Abrir um arquivo e resumir o que há nele.** O usuário escolhe um CSV pelo diálogo nativo; o app percorre o arquivo, conta as linhas, deduz o separador e lê o cabeçalho, mostrando progresso e permitindo cancelar.

Ela foi escolhida por exercitar tudo o que precisa ser validado, sem introduzir nada novo:

| Exercita | Onde aparece |
|---|---|
| Diálogo nativo | só o main consegue abrir |
| `Result` com erro real | arquivo apagado entre a escolha e a leitura, permissão negada |
| Operação longa com progresso | contar linhas de um arquivo grande demora de verdade |
| Cancelamento durante a operação | é o caso que a [fase 02](02-contrato-ipc.md) desenhou e não pôde provar |
| Total desconhecido | não se sabe quantas linhas há antes de terminar |
| Lógica pura em `core/` | dedução de separador e parsing de cabeçalho |
| `StateView` nos seis estados | todos ocorrem naturalmente |

E ela não é descartável: um app de análise de dados vai precisar abrir arquivo de qualquer forma.

**Zero dependências novas.** É o resultado da decisão D6.2 abaixo, e vale como sinal de que a fundação está no tamanho certo.

---

## Decisões tomadas

### D6.1 — Fatias verticais, não pastas por tipo

```
src/renderer/src/
├── shared/
│   ├── ui/        primitivos e tokens (fase 05)
│   └── hooks/     hooks genéricos
├── features/
│   └── open-dataset/     componentes, hooks, tipos e chamadas de IPC da feature
└── App.tsx
```

`components/`, `hooks/` e `utils/` na raiz é o arranjo que gera refatoração garantida por volta do trigésimo componente: as três pastas crescem sem relação entre si, e descobrir o que faz parte de quê vira arqueologia.

Duas regras a partir daqui:

- **Feature não importa feature.** Se precisar, o que ela precisa sobe para `shared/`.
- **Sobe para `shared/` a partir do terceiro uso.** Antes disso, abstração prematura.

> 🔍 É o mesmo princípio dos `blocks/` do projeto Python: cada parte devolve o que expõe, e quem monta só encaixa. A diferença é que aqui a régua entra antes de o arquivo inchar, porque o custo de mover é conhecido.

### D6.2 — Sem TanStack Query nesta fase

Esta decisão **inverte** a intenção original registrada na [visão geral](00-visao-geral.md), e a inversão é o próprio critério do plano funcionando.

O critério é: *se eu adiar, quantos arquivos toco depois?* Aqui a resposta é dois hooks. As duas operações são ações com efeito colateral — `useMutation`, não `useQuery` —, e a biblioteca não faz progresso nem cancelamento por assinatura. O que ela realmente entrega é cache com chave, invalidação e deduplicação de requisição, e nada disso tem uso antes de existirem consultas repetidas sobre o mesmo dado.

Adotá-la agora seria pagar por um problema que ainda não existe, que é a mesma falha do OCP recusada na D2 da visão geral.

**Gatilho de revisão:** a primeira query de DuckDB reexecutada sobre o mesmo dataset. Aí o cache passa a valer, e o custo da migração continua sendo os poucos hooks que existirem.

No lugar, um `useAsyncAction` de cerca de quarenta linhas em `shared/hooks/`, que devolve um `ViewState` — o mesmo tipo da [fase 05](05-design-tokens.md).

### D6.3 — `core/` recebe as linhas, não o caminho

```ts
export async function scanDelimited(input: {
  lines: AsyncIterable<string>
  onProgress?: (rows: number) => void
  signal?: AbortSignal
}): Promise<DatasetSummary>
```

`core/` **pode** importar `node:fs` — a tabela da [fase 01](01-camadas-e-fronteiras.md) permite. A decisão de não importar é sobre testabilidade: recebendo um iterável, o teste passa um array literal e cobre arquivo vazio, só cabeçalho, separador ambíguo, linha malformada e cancelamento no meio, tudo em milissegundos e sem tocar disco.

É a mesma injeção na fronteira de entrada/saída que o projeto Python faz com `embed_fn`.

### D6.4 — Progresso é limitado a dez emissões por segundo

Emitir a cada linha inunda o IPC: um milhão de linhas viram um milhão de mensagens, e o renderer gasta mais tempo repintando barra de progresso do que o main gasta lendo o arquivo.

Uma emissão a cada 100ms, mais uma final garantida. O valor é token de configuração, não literal espalhado.

### D6.5 — Progresso é transmitido a todas as janelas

O `handle` da [fase 02](02-contrato-ipc.md) entrega ao handler **apenas os argumentos** — não o `IpcMainInvokeEvent`. É essa restrição que torna o handler uma função comum e testável no nível 3.

O preço é que o handler não sabe quem chamou. Como o app tem uma janela, `emitProgress` transmite para todas e o efeito é o mesmo.

**Gatilho de revisão:** a segunda janela. Aí o `handle` ganha uma variante que repassa o remetente, e só os handlers que precisam a usam.

Registrado como troca consciente: a testabilidade do nível 3 vale mais hoje do que um endereçamento que ninguém usa.

### D6.6 — Cancelamento é `Result`, não exceção

Cancelar devolve `{ ok: false, error: { kind: 'cancelled' } }`. Pela D2.2 da [fase 02](02-contrato-ipc.md), é desfecho esperado e acionável pela UI — o `StateView` tem um estado próprio para ele —, portanto é dado.

### D6.7 — O `AbortController` mora no main, indexado pelo `jobId`

`src/main/jobs.ts` guarda um `Map<JobId, AbortController>`. O canal `job:cancel` procura e aborta; a operação, ao terminar por qualquer via, remove a entrada.

O `jobId` vem do renderer (D2.7), o que resolve a corrida real: o usuário clica em cancelar antes de a promessa resolver, e o identificador já existe dos dois lados.

> ⚠️ Remover a entrada em `finally`, nunca só no caminho feliz. Um `Map` que só cresce é vazamento — e é o tipo de vazamento que não aparece em teste, porque teste não abre quarenta arquivos seguidos.

---

## Passos

### Passo 1 — A lógica pura e seus testes

Crie `src/core/dataset/scan.ts` com `scanDelimited` e o tipo `DatasetSummary` (que vai para `src/shared/ipc.ts`, por atravessar a fronteira).

Regras de dedução do separador, em ordem: contar candidatos (`,` `;` `\t` `|`) nas primeiras linhas e escolher o de contagem mais consistente entre elas. Consistência importa mais que frequência — vírgula dentro de campo entre aspas é comum e engana a contagem bruta.

Escreva os testes **junto**, não depois. Casos mínimos:

| Caso | Esperado |
|---|---|
| Vazio | `rowCount: 0`, sem colunas |
| Só cabeçalho | `rowCount: 0`, colunas preenchidas |
| Vírgula e ponto e vírgula concorrendo | escolhe o consistente |
| Campo com separador entre aspas | não conta como coluna nova |
| `signal` já abortado | retorna cancelado sem consumir o iterável |
| `signal` abortado no meio | para na linha em que abortou |

Os dois últimos são os que mais pagam: cancelamento é a parte que a implementação real vai errar primeiro.

**Aceite:** `pnpm test` verde; cobertura de `src/core/dataset/` acima do limite.
**Commit:** `feat(core): resumo de arquivo delimitado, puro e cancelável`

### Passo 2 — Registro de jobs e canais do main

Crie `src/main/jobs.ts` com `create(jobId)`, `cancel(jobId)` e `finish(jobId)`, mais seu teste de nível 3: criar, cancelar, confirmar sinal abortado, confirmar que `finish` limpa o mapa.

Acrescente ao contrato em `src/shared/ipc.ts`:

```
dataset:pick   → Result<DatasetRef | null>     null quando o usuário fecha o diálogo
dataset:scan   → Result<DatasetSummary>        args: { path, jobId }
job:cancel     → void
```

E o evento `job:event`, com o payload `JobEvent` já declarado na [fase 02](02-contrato-ipc.md). Esta feature emite **apenas** a variante `progress`; `chunk` e `log` continuam reserva.

> 🔍 `null` e erro são coisas diferentes. Fechar o diálogo é sucesso com resultado vazio; não conseguir abri-lo é falha. Colapsar os dois em `Result` de erro obrigaria a UI a mostrar mensagem para uma ação normal do usuário.

Handlers em `src/main/features/dataset/handlers.ts`, ambos recebendo suas dependências por parâmetro:

- `pickDataset` recebe a função de diálogo
- `scanDataset` recebe uma fábrica de iterável de linhas e a função de emissão de progresso

A implementação real de linhas usa `readline` sobre `fs.createReadStream`; o registro em `register-all.ts` é quem amarra as duas pontas. Os testes passam falsas.

**Aceite:** testes de nível 3 verdes; nenhum arquivo de teste importa `electron`.
**Commit:** `feat(main): canais dataset e registro de jobs canceláveis`

### Passo 3 — Assinatura de progresso no preload

Amplie `Api` com `dataset` e `job`, incluindo:

```ts
job: {
  cancel(jobId: JobId): Promise<void>
  onEvent(cb: (e: JobEvent) => void): () => void
}
```

Uma assinatura para a união inteira, não uma por variante — quem consome estreita pelo `type`, e uma variante nova não altera a superfície exposta.

O `onEvent` é a primeira aplicação da D2.8 da [fase 02](02-contrato-ipc.md): o listener registrado no `ipcRenderer` descarta o `IpcRendererEvent` e repassa **só o payload**; o retorno é a função que remove o listener.

Sem esse retorno, todo componente React que assinar vira vazamento — o `useEffect` não tem o que devolver na limpeza, e cada remontagem empilha mais um ouvinte.

**Aceite:** `pnpm typecheck` limpo; no DevTools, `window.api.job` existe e `onEvent` devolve uma função.
**Commit:** `feat(preload): assinatura de progresso com cancelamento de escuta`

### Passo 4 — A fatia do renderer

Dois hooks genéricos em `src/renderer/src/shared/hooks/`:

- `useAsyncAction` — executa, devolve `ViewState`, permite reexecutar
- `useJobProgress(jobId)` — assina `onEvent`, filtra pelo `jobId` e pela variante `progress`, **desassina na limpeza**

E a fatia `src/renderer/src/features/open-dataset/`, com o painel, seu módulo CSS e o hook que orquestra escolher → gerar `jobId` → escanear → cancelar.

Os seis estados usam o `StateView` da [fase 05](05-design-tokens.md), sem componente novo de carregamento ou erro. Se algum estado pedir algo que o `StateView` não faz, o ajuste é nele — não uma variante local. É assim que design system não se dissolve.

Testes de nível 2 com a API falsa da [fase 04](04-testes-rapidos.md):

| Cenário | Verifica |
|---|---|
| Escolher e resumir com sucesso | o resumo aparece |
| Fechar o diálogo (`null`) | volta a ocioso, sem erro |
| Erro `not-found` | mensagem em português do registro da [fase 05](05-design-tokens.md) |
| Cancelar durante o progresso | `job.cancel` foi chamado com o `jobId` correto |
| Desmontar durante a operação | a função de desassinatura foi chamada |

O último é o único que pega o vazamento do passo 3, e é o mais fácil de não escrever.

**Aceite:** `pnpm check:fast` verde.
**Commit:** `feat(renderer): fatia open-dataset com progresso e cancelamento`

### Passo 5 — Validar com arquivo grande de verdade

Nenhum teste automatizado pega o que este passo pega. Gere um CSV de algumas centenas de megabytes (um script curto em `scripts/` serve, ou um dataset público) e verifique, à mão:

1. A janela **continua respondendo** durante o escaneamento — arraste, redimensione, clique.
2. A barra de progresso avança sem travar a interface.
3. Cancelar interrompe **de fato** — confirme pelo Gerenciador de Tarefas que a leitura parou, não apenas que a UI mudou de estado.
4. Cancelar e escanear de novo funciona; nada ficou preso no `Map` de jobs.

O item 1 é o que revela o erro clássico: leitura de arquivo grande no processo main trava a janela inteira, e é por isso que a camada de dados vai para `utilityProcess`. Com `readline` sobre stream, a leitura é assíncrona e a janela sobrevive — **confirme, não presuma.** Se travar, o diagnóstico já está escrito em [`05-proximos-passos.md`](../../study/05-proximos-passos.md).

Registre o que observou (tamanho do arquivo, tempo, se travou) no [`04-diario-de-bordo.md`](../../study/04-diario-de-bordo.md). É a primeira medição real de desempenho do projeto, e vai ser a referência contra a qual o DuckDB será comparado.

**Aceite:** os quatro itens, com o registro no diário.
**Commit:** `docs: registra a primeira medição de leitura de arquivo grande`

---

## Critério de aceite da fase

```bash
pnpm check:fast && pnpm build
```

E a validação manual do passo 5, que é a que importa.

---

## O que fica para depois

- **TanStack Query** — gatilho registrado na D6.2.
- **Endereçar progresso a uma janela específica** — gatilho registrado na D6.5.
- **Virtualização** — o resumo cabe numa tela. Chega com a tabela de dados.
- **Histórico de arquivos abertos** — precisa de persistência, que ainda não existe.
- **Inferência de tipo por coluna** — mora naturalmente em `src/core/dataset/`, mas pertence à camada de dados.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| ago/2026 | todos | **concluído** | Primeira feature vertical, atravessando as seis camadas de ponta a ponta — é ela que provou o contrato IPC, o registro de jobs canceláveis e o nível 3 de teste funcionando juntos. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| Doc do `readline` diz que erros do stream não são propagados — na prática o `for await` lança | [`ARMADILHAS.md`](../../ARMADILHAS.md) § Arquivadas |
| Handler é função exportada, e é isso que cria o nível 3 | skill [`testing`](../../../.claude/skills/testing/SKILL.md) |
| Decisões D6.x | [`DECISOES.md`](../../DECISOES.md) |
**Anterior:** [05 — Design tokens](05-design-tokens.md) · **Índice:** [README](../active/README.md) · **Próximo:** [07 — E2E e empacotamento](07-e2e-e-empacotamento.md)
