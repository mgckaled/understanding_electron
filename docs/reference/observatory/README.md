# Observatório — fundamentação da trilha O

**Data:** 28/08/2026 · **Motivo:** a trilha O nasceu de uma conversa longa que leu o observatório do mill.tools no fonte, desenhou a superfície do crivo e produziu uma classificação de custo/trabalho/situação. Este documento existe para que a trilha possa ser **construída aos pedaços, ao longo de meses**, sem que cada plano O-n precise redescobrir o que já foi decidido aqui.

> **O que este documento é:** o inventário do que se pode observar, com cada item classificado, e o porquê de cada regra de contenção.
> **O que ele não é:** um plano. Nenhum passo, nenhum commit. Os planos são `O-1`, `O-2`, `O-3`… — numerados, nunca com letra, cada um do tamanho de um corte.
> **O que ele não repete:** o princípio de instrumentar no ponto de estrangulamento já é da [arte anterior](../arte-anterior-milltools.md) § _Para o observatório_. Aqui ele é aplicado, não reapresentado.

O material bruto — as cinco frentes do mill.tools descritas pelo usuário, com capturas — está em [`notes/observatory/brief.md`](../../../notes/observatory/brief.md).

---

## 1. A arte anterior, lida no fonte

Fontes lidas: `src/core/observatory/` (6 módulos, ~700 linhas), `src/gui/modules/observatory/` (14 arquivos, ~2.400), `src/cli/observatory.py`, `src/core/rag/{stats,analytics,eval,feedback}.py` e o caderno `docs/estudo/modulos/observatorio.md` do mill.tools.

### 1.1 A forma real

**5 abas, 13 painéis, 22 arquivos de estado observados.** A contagem visível engana: a aba `Índice/RAG` é aninhada (4 sub-abas) e a `Status` empilha 6 blocos independentes.

O mesmo núcleo puro alimenta **duas** interfaces — as abas da GUI e um subcomando de CLI (`observatory status|activity|logs|disk-usage`). O núcleo não sabe qual das duas o chama.

### 1.2 Os seis eixos — a resposta a "quão amplo"

Um observatório não é uma tela de logs. São seis perguntas distintas, cada uma com fonte, frequência e custo de leitura próprios:

| Eixo             | A pergunta                        | No mill.tools                                                                                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Capacidade**   | o que o app _consegue_ fazer?     | 9 gates opcionais, 4 binários externos, 6 modelos Ollama, 2 chaves de nuvem                                              |
| **Acervo**       | o que ele _acumulou_?             | índice RAG (docs · chunks · dimensão · modelo · bytes · mtime · por documento · drill-down no chunk) e varredura do disco |
| **Histórico**    | o que ele _fez_?                  | log de atividade (cap 200), log de falhas (cap 100), log de feedback 👍/👎 (cap 200)                                     |
| **Desempenho**   | quanto _custou_?                  | latência por `(domínio, modelo)`: n · média · mediana · p90, cap de 500 por balde                                        |
| **Qualidade**    | está funcionando _bem_?           | harness de avaliação: hit-rate@k, MRR, acurácia do aviso de baixa cobertura                                              |
| **Parâmetros**   | sob que _números_ ele opera?      | 5 limiares lidos por introspecção do código real                                                                        |

O sexto é o que quase todo mundo esquece, e é o mais barato de todos.

### 1.3 Detalhe por eixo, com o que decide implementação

**Capacidade.** Cada linha é `(nome, disponível, dica de instalação)`. O insight: toda funcionalidade opcional tem um gate, então a lista de gates é a auto-descrição honesta dos modos degradados do app. `[ml-viz]` ausente não quebra o mapa semântico — ele cai de UMAP para PCA, e a linha diz isso. O `X` num modelo vem com o aviso explícito de que **não é erro**.

**Acervo.** Duas coisas distintas coabitam: a _estrutura interna_ do índice e os _bytes brutos_ no disco. O painel de disco é varredura genérica recursiva, ordenada por tamanho, com glossário ao lado — store novo aparece sozinho, sem tocar a tela.

**Histórico.** O detalhe de engenharia mais reaproveitável do módulo inteiro: as falhas **não** são gravadas por cada worker. São gravadas uma vez, no ponto de _broadcast_ do `EventBus` — um hook central pega o `task_error` de todo módulo sem tocar nenhum `worker.py`. E cancelamento do usuário é filtrado antes de chegar lá: **cancelar não é falhar.**

**Desempenho.** O corte do log é **por balde `(domínio, modelo)`**, nunca achatado, porque `llm` é chamado muito mais que `vlm`/`embed` e um corte plano evictaria o histórico dos quietos em silêncio. Detalhe fino: o embedder soma o tempo dos sub-lotes e grava **uma** entrada por chamada — senão uma reindexação faria dezenas de reescritas do log por documento.

**Qualidade.** Golden set de perguntas _cobertas_ (com documento esperado) e _fora-do-acervo_ (onde a resposta certa é o aviso disparar), rodando pelo caminho de recuperação **de produção**. Retrieval-only por desenho: nenhuma chamada de LLM — determinístico, rápido, barato; julgar a resposta gerada ficou explicitamente fora de escopo.

**Parâmetros.** Sem UI de edição — é transparência, não configuração. E os números são lidos da fonte, nunca copiados:

```python
threshold_default = inspect.signature(dedup.near_duplicates).parameters["threshold"].default
```

O snapshot chega a reportar **dois** lambdas de MMR que hoje têm o mesmo valor, em vez de escolher um e esconder o outro — porque são constantes independentes e um dia vão divergir.

### 1.4 As duas exceções que escrevem

`core/observatory/` é 100% read-only, e a fronteira é explícita: _função pura não escreve log; quem registra é o worker no ponto de conclusão._ Mas duas sub-abas rodam pipeline de verdade — **Reindexar** e **Avaliar** — e vivem na camada `gui/`, nunca no pacote puro.

O padrão que isso revela, e que vale para o crivo: **o que escreve num observatório é sempre manutenção do que ele observa.** Não é feature nova; é a ação corretiva ao lado do diagnóstico.

E um bug real registrado ali: `build_index` recebe `force=is_stale_scheme(...)`. Sem o `force`, uma mudança de esquema não move o `mtime` dos arquivos — o indexador pula tudo, atualiza só o sidecar, e diz "índice novo" **sem ter reembeddado nada**. Falha silenciosa que invalidou uma calibração inteira.

### 1.5 Sete regras transplantáveis

1. **Chave de comparabilidade em todo artefato persistido.** `embed_space_id = "{modelo}:{dim}:{esquema}"` viaja com cada run de avaliação e cada entrada de feedback. Duas medições só são comparáveis se compartilham a chave — senão a reindexação vira falsa regressão. _É a ideia mais forte do módulo, e o crivo já a adotou_ (§ 2.6).
2. **Transparência por introspecção, nunca por cópia.**
3. **Um hook no ponto de broadcast** vence N chamadas espalhadas pelos produtores.
4. **Log tolerante por entrada** — linha malformada é pulada com aviso, nunca aborta a carga.
5. **Corte por balde, não achatado**, sempre que os produtores têm frequências diferentes.
6. **Leitura de status tem timeout.** O cliente do Ollama leva 5 s porque um serviço meio-aberto travaria a aba. Status é leitura, não workflow.
7. **Presença, nunca valor.** A linha de nuvem diz "configurado", jamais a chave.

E uma limitação **assumida e registrada** por eles: `append_capped` é read-modify-write sem lock entre processos. GUI e CLI logando no mesmo instante perdem uma entrada. Aceito, não consertado — _"observabilidade best-effort, não sistema de registro"_.

### 1.6 O defeito que o próprio módulo demonstra

O painel de disco é varredura genérica **e** um glossário `_FILE_DESCRIPTIONS` escrito à mão. `retrieval_feedback.json` e `rag_eval.json` são stores reais e **não estão** no glossário. O código antecipou o caso (_"an undocumented future file just doesn't get an explanation yet"_) e degrada com elegância — mas a varredura se atualiza sozinha e a lista escrita à mão não.

**A lição, e ela vira regra na § 4.3:** todo painel que **deriva** suas linhas do código não pode envelhecer; todo painel que as **lista** vai envelhecer. Onde houver escolha, derive.

---

## 2. O que o crivo tem e o mill.tools não podia ter

Nada aqui é adaptação. São consequências de arquitetura que o crivo já pagou por outros motivos.

### 2.1 O gargalo único de IPC já existe

Todo canal do contrato passa por **um** `handle()` genérico em `src/main/ipc/registry.ts`. Instrumentar ali dá contagem, latência e taxa de falha **por canal**, sem tocar um handler sequer. É o mesmo truque do hook no `EventBus`, com a diferença de que o crivo já tem o ponto — construído para tipagem e validação, não para observabilidade.

### 2.2 Risco registrado vira risco visível

A skill [`data`](../../../.claude/skills/data/SKILL.md) registra: _worker morto no meio da fila deixa toda chamada seguinte sem resposta nem erro, com a UI girando para sempre._ Um mostrador de **profundidade da fila** do `createDuckdbWorkerClient` (`src/main/duckdb/spawnWorker.ts`) e do tamanho do `Map<JobId, AbortController>` (`src/main/jobs.ts`) transforma um risco documentado num risco observável.

Um `Map` que só cresce é vazamento que teste nenhum pega — nenhum teste abre quarenta jobs seguidos. Um mostrador pega.

### 2.3 O veredito seria de graça — mas hoje não é gravado

O mill.tools precisou de golden set porque recuperação não tem verdade de campo. O crivo **executa** o passo proposto e já verifica por `nullPercentage` (D19.6), então teria uma métrica de qualidade nativa: proposta aceita vs. recusada, e das aceitas quantas passaram na verificação.

⚠️ **Conferido no fonte nesta sessão, e o resultado foi negativo:** `stepProposalPartSchema` (em `src/shared/ipc.ts`) persiste a proposta como `MessagePart`, e **não há campo de veredito em lugar nenhum**. Esta métrica **não é derivável hoje** — depende de gravar o desfecho, que é registro inerente da conversa (§ 3.4), não telemetria.

### 2.4 O livro-razão de privacidade

O [`ESCOPO`](../../ESCOPO.md) define três níveis do que a IA vê — esquema, perfil agregado, amostra de linhas — opt-in por anexo, em qualquer provedor. O que nenhum registro guarda hoje é **o que de fato saiu da máquina**: por chamada de nuvem, qual anexo, qual nível, quantos bytes, para qual provedor.

Um app local-first deve isso ao usuário, e é o painel que mais o diferencia de um observatório genérico. Vale com a regra de mão única intacta: mostra o que saiu, nunca o segredo que autenticou a saída — `secrets:read` não existe por desenho (DN1A.3).

### 2.5 Duas melhorias sobre o original

**Um fluxo, não dois arquivos.** `activity.py` e `logs.py` eram ~90% idênticos — o próprio mill.tools admitiu isso extraindo o `_jsonlog.py`. São o mesmo evento com severidades diferentes. O crivo tem SQLite transacional já aberto: sem carga/append/corte à mão, sem escrita atômica caseira, sem a corrida de _lost update_ assumida lá. **Retenção vira `DELETE ... WHERE ts <`, não reescrita do arquivo inteiro.**

**Medir tokens/s, não segundos.** O gráfico de tempo de resposta deles compara média em segundos entre modelos — mas segundos não são comparáveis entre prompts de tamanhos diferentes. O crivo já conta tokens por conversa; `(prefill, decode, tokens/s)` sobrevive a uma mudança no tamanho do prompt, e segundos não.

### 2.6 O painel de RAG já nasce especificado — e o levantamento é dele

O [levantamento de "Projetos" e RAG particionado](../projetos-e-rag-por-projeto.md) (25/08/2026) decidiu, para outra finalidade, quatro coisas que **definem o painel de RAG antes de ele existir**. Ele é o dono desses fatos; aqui fica só o que muda a especificação do painel:

| Fato já decidido lá                                                                   | O que impõe ao painel                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `embed_space_id` (`modelo:dimensão:esquema`) é **coluna** da tabela de vetores          | a regra 1 da § 1.5 já está adotada — o painel **lê** a chave de comparabilidade, não precisa inventá-la                    |
| vetor vive em tabela DuckDB, nunca em arquivo `.npz`                                    | o inspetor é `SELECT`, não carga de arquivo; drill-down até o chunk é consulta paginada                                    |
| partição por `project_id`                                                               | o painel é **por projeto**, não global — e a comparação entre partições é a informação, não um extra                       |
| índice precisa de um **DuckDB em arquivo**, separado do motor de dataset (`:memory:`)   | é um store novo em `userData` que o painel de disco (§ 3.1) e o de processos (§ 7.1) passam a ver                          |

E dois números medidos lá que **classificam o painel** sem estimativa nova:

- **Busca por força bruta:** ~116 ms em 30 mil vetores; a partição por `project_id` achata o tempo em ~1 ms independente do tamanho do acervo global (contra ~4 s em 1 milhão sem partição). Por isso o painel de RAG é **Acessível**, não Caro — e por isso `vss`/HNSW não entra agora (a persistência do índice HNSW é experimental e desligada por padrão no DuckDB).
- **Indexação:** ~7,4 min para 20 documentos de ~4k tokens, cruzando com os 180 tok/s já medidos do `nomic-embed-text`. **Reindexar não é ação instantânea** — confirma, com número, a regra 4 da § 4.3: é job com progresso e cancelamento, exatamente como o botão _Reindexar_ do mill.tools.

⚠️ **E há um gate de capacidade que nasce junto:** existe **um único** embedder qualificado (`nomic-embed-text`, 768 dimensões, teto de 2.048 tokens), e nenhum adaptador de embedding de nuvem. A linha "Embedder" do painel de Capacidades é, hoje, uma escolha entre um e nada — que é exatamente o que a linha deve dizer, no espírito da § 1.3.

> 🔍 **Por que o mill.tools precisou do "Painel do Índice".** O `.npz` deles cresceu a ~50 MB misturando frentes de trabalho, e a busca degradou em **dois eixos ao mesmo tempo** — mais lenta e mais imprecisa. O painel "quais documentos concentram mais chunks" existia para achar essa causa depois do fato. No crivo a partição elimina a causa; o painel deixa de ser diagnóstico de emergência e vira o que sempre deveria ser: leitura de composição do acervo.

---

## 3. Onde isto mora

### 3.1 O equivalente de `~/.mill-tools/` já existe

`app.getPath('userData')` (em `%APPDATA%/crivo`) **é** esse diretório, e já guarda:

| Entrada                                                       | O quê                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `crivo.db`                                                    | conversas, mensagens, configuração de máquina, escada de migração      |
| `attachments/<hash>`                                          | blobs endereçados por conteúdo, com GC de órfãos no boot               |
| `duckdb-tmp/`                                                 | derrame do motor acima de `memory_limit`                               |
| segredo do `safeStorage`                                      | chaves de provedor de nuvem                                            |
| **`Cache/`, `Code Cache/`, `GPUCache/`, `Local Storage/`…**    | **o Chromium, que o app não controla**                                 |
| _(futuro)_ `observatory.db`                                   | série temporal de observabilidade (§ 3.3)                              |
| _(futuro)_ DuckDB em arquivo do índice RAG                    | § 2.6 — sobrevive ao fechamento do app, ao contrário do motor `:memory:` |

O observatório **não cria** esse diretório. Ele o revela.

⚠️ **E a quinta linha é a diferença estrutural.** No mill.tools o diretório é 100% autoria do app, então a varredura genérica é honesta de ponta a ponta. Aqui a varredura ingênua devolveria `Cache/` no topo — verdadeiro, mas ruído. O painel precisa da separação **"o que o crivo escreveu" vs. "o que o runtime escreveu"**, ou a primeira leitura leva o leitor a investigar o Chromium.

### 3.2 O que custa de verdade — e não é o disco

Linha de SQLite é irrisória; o que cresce são anexos, e isso já é decisão fechada com GC. Os custos reais são três, e só um é perigoso:

**① Frequência de escrita — o único que morde.** O mill.tools reescreve o JSON inteiro a cada append, e por isso precisou somar os sub-lotes do embedder numa entrada só. O crivo não herda esse problema (INSERT indexado não reescreve nada), mas herda o irmão: um `job:event` de _stream_ dispara dezenas de vezes por segundo. **Regra: nunca uma linha por token ou chunk — agrega-se na borda e grava-se uma linha por operação concluída.** É a mesma fronteira que a skill `data` já impõe.

**② Migração.** Toda tabela nova é degrau permanente no `PRAGMA user_version`.

**③ Retenção.** Precisa de política, ou cresce sem teto. Aqui o crivo ganha de lavada: `DELETE` sobre índice, não reescrita.

### 3.3 `crivo.db` e `observatory.db` — dois arquivos, um critério

**Recomendação: banco separado**, com o mesmo `openDatabase()`, que já recebe o caminho por parâmetro (skill [`architecture`](../../../.claude/skills/architecture/SKILL.md)) — então custa quase nada.

O critério de repartição, em uma linha:

> **O que o _usuário_ sentiria falta se sumisse fica no `crivo.db`. O que só o _app_ sentiria falta vai para o `observatory.db`.**

Três razões, em ordem de força:

- **A política de retenção é oposta.** Conversa é registro do usuário e nunca se apaga sozinha; evento de observabilidade é descartável por desenho. Misturá-los põe uma tabela que se poda ao lado de uma que não se poda.
- **É best-effort, e o mill.tools registrou isso explicitamente.** Um store best-effort não deve compartilhar WAL com o sistema de registro — INSERT tagarela de um stream competindo com a escrita da conversa é risco desnecessário.
- **"Limpar o observatório" vira apagar um arquivo**, sem tocar migração nem cascata.

O que se perde: `JOIN` entre evento e conversa. Guarda-se o `conversationId` como coluna solta e resolve-se no renderer — é o que já se faz com o `sourceMessageId` do rascunho.

### 3.4 O que **só** o `crivo.db` pode guardar

Pelo critério acima, três coisas que a trilha O vai querer **não são telemetria** — são registro inerente que hoje falta, e cada uma é migração do `crivo.db`, não do `observatory.db`:

| Registro                                          | Por que é do usuário, não do app                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Veredito de proposta** (aplicada/recusada/desfeita) | é o desfecho da conversa; some junto com ela, e o usuário esperaria revê-lo ao reabrir              |
| **Nível de exposição escolhido por anexo**        | é decisão do usuário sobre o próprio dado; o livro-razão (§ 2.4) _cita_ esse valor, mas não é o dono |
| **Modelo e teto de contexto por mensagem**        | já existe (`message.model`, e o par travado no primeiro envio) — precedente que confirma o critério  |

⚠️ **Consequência de sequência:** os painéis que dependem destes três só ficam honestos **depois** que a informação passar a ser gravada. Marcá-los como _Gatilhado_ (§ 5.3) não é adiamento — é a única classificação verdadeira.

---

## 4. A superfície

### 4.1 Um modal com sidebar própria, e o precedente que o sustenta

Ícone no rodapé da sidebar, acima de Configurações, abrindo um modal quase de tela cheia com sidebar própria à esquerda e painéis à direita.

A escolha já foi feita uma vez, pelo motivo certo: **Configurações é modal, não rota, porque um destino de navegação desmonta o que está na tela** ([plano 13](../../plan/implemented/13-casca-do-aplicativo.md)) e uma resposta em fluxo precisa continuar chegando atrás. Um observatório tem exatamente a mesma propriedade — abre-se justamente _enquanto_ algo acontece. O primitivo `Dialog` (D13.8) já entrega camada superior, foco preso, `Esc` e clique-fora pela plataforma.

### 4.2 A armadilha que mata "leve e rápido" antes de tudo

⚠️ **`<dialog>` mantém os filhos montados quando fechado.** Já é armadilha registrada em [`ARMADILHAS.md`](../../ARMADILHAS.md) — foi ela que exigiu o `loaded` no controle que copia valor. Se o modal montar os painéis todos e alternar `visible`, **todo `useEffect` de todo painel dispara no boot do app**: varredura de disco, ping no Ollama, contagem de tabelas — com o modal fechado.

É exatamente o que o mill.tools faz (`ft.Stack` com `visible=False`, cinco abas montadas). Lá é inofensivo porque cada `apply()` só roda ao clicar. **Aqui, montar é executar.**

> **Regra:** só o painel ativo se renderiza — `{ativo === 'db' && <PainelBanco />}`. Nunca um `Stack` com visibilidade alternada.

### 4.3 As cinco regras de leveza

1. **Só o painel ativo monta** (§ 4.2).
2. **O modal inteiro entra por `import()` dinâmico.** É a feature que a maioria das sessões nunca abre, e vai atrair tabela virtualizada e biblioteca de gráfico. Depois do E-2 — onde 27 gramáticas custaram **+261,75 kB medidos**, mais que o dobro da estimativa — o argumento se defende sozinho: sem code-splitting, todo boot paga por um painel fechado.
3. **Cada subelemento abre com resumo, nunca com a coisa inteira.** "Banco de dados" abre listando tabelas com contagem; a tabela em si só carrega ao clicar. Mantém o custo de abrir **constante**, independente do quanto o painel _pode_ mostrar.
4. **Leitura pesada é job, não função.** `src/main/jobs.ts` já dá progresso, cancelamento e `job:event` — e resolve por construção o problema de não travar a janela. Inventar caminho novo aqui seria escrever um segundo mecanismo de progresso. A reindexação de RAG (~7,4 min, § 2.6) é o caso que torna isto obrigatório, não opcional.
5. **Derive as linhas do código, nunca de uma lista.** `sqlite_master` em vez de lista de tabelas; as chaves de `IpcContract` em vez de lista de canais; varredura de diretório em vez de lista de arquivos. É a lição da § 1.6, e é a resposta ao "engordar" no sentido de manutenção.

E a regra que amarra tudo: **o painel caro exibe a idade do próprio número** — _"medido há 4 min · ↻"_. Um observatório que mente sobre o frescor do que exibe é pior que nenhum, e é literalmente a lição que o mill.tools aprendeu caro com o `force=is_stale_scheme`.

### 4.4 As categorias

Quatro grupos, na ordem em que a pergunta costuma nascer — que é também a ordem de custo crescente, então o topo abre instantâneo:

```
Estado          Visão geral · Capacidades · Modelos
Armazenamento   Banco de dados · Anexos · Uso de disco
Índices         RAG · ML
Atividade       Eventos · Desempenho · Privacidade
```

A busca (o campo "Procurar" do exemplo de referência) se paga acima de ~12 painéis. Com onze de nome curto, fica adiada.

### 4.5 O gatilho que mudaria este desenho

Modal é o container certo para **consultar**, e o errado para **acompanhar**. Se um painel ao vivo — job em execução, fila do worker enchendo — virar o motivo principal de abrir o observatório, ele estará cobrindo justamente a tela onde a coisa acontece.

Não é motivo para mudar o desenho agora. É o gatilho que, se disparar, tira **aquele painel** do modal e o põe como indicador no rodapé da sidebar.

---

## 5. A classificação

Dois eixos e uma situação. A prioridade entre os eixos está declarada: **peso pesa mais que trabalho** — custo de memória, carga e leitura ao vivo é mais danoso que custo de refatoração.

A assimetria 4×3 é proposital: impede parear os níveis numa diagonal e tratar "Caro + Pesado" como uma nota só.

### 5.1 Custo — definido por **quando se paga**

Cada nível carrega uma consequência mecânica. Sem isso a classificação vira decoração.

| Nível          | Quando se paga                       | O que obriga                                          |
| -------------- | ------------------------------------ | ----------------------------------------------------- |
| **Grátis**     | nunca — memória, já no caminho       | lê a cada abertura                                    |
| **Barato**     | ao abrir, poucos ms                  | lê a cada abertura, com `staleTime`                   |
| **Acessível**  | centenas de ms                       | cache obrigatório; não bloqueia a abertura do painel  |
| **Caro**       | segundos, rede, ou trava algo        | **só sob botão explícito**, e exibe a idade do número |

⚠️ **O peso permanente não é nível — é invariante.** Bundle e memória residente pagam-se com o painel _fechado_, que é o custo mais danoso de todos. Ele não escalona: ou o painel entra por `import()` dinâmico, ou está errado. Se virasse um nível, acabaria aceitando "só um pouquinho de Caro no boot".

### 5.2 Trabalho — definido pelo que **toca**

"Leve/Moderado/Pesado" no olho envelhece e cada leitor calibra diferente. Amarrado à arquitetura, fica decidível em segundos:

| Nível         | O que caracteriza                                                                            |
| ------------- | -------------------------------------------------------------------------------------------- |
| **Leve**      | compõe sobre canal que **já existe** — só renderer                                            |
| **Moderado**  | **canal novo** (o ritual dos seis lugares da skill [`ipc`](../../../.claude/skills/ipc/SKILL.md)) ou handler novo |
| **Pesado**    | migração, store novo, worker, ou instrumentação em caminho quente                             |

E isso não é só arrumação: **prevê por onde começar.** Runtime e Capacidades caem em _Leve_ porque `app:info`, `app:memory`, `ai:models` e `secrets:has` já existem. Nenhum outro critério teria apontado esses dois primeiro.

### 5.3 Situação — o eixo que ordena a trilha

| Situação        | Significado                                                          |
| --------------- | -------------------------------------------------------------------- |
| **Disponível**  | dá para fazer hoje                                                   |
| **Gatilhado**   | o trabalho está dimensionado; falta o **evento** — o sensor nascer   |
| **Inviável**    | com o **motivo medido** junto, ou não resiste a seis meses           |

⚠️ **Sem esta coluna o backlog desordena.** "Painel RAG" seria marcado _Pesado_ — e não é: o trabalho é Moderado, ele só não pode começar porque não existe RAG. Confundir bloqueado com caro é o erro que uma trilha gatilhada não pode cometer.

### 5.4 O que deliberadamente **não** se classifica

**Valor.** Um terceiro eixo produziria um backlog ordenado por barateza com uma nota de importância pendurada — e planilha de pontuação ninguém preenche na segunda vez. O **gatilho já é o sinal de valor**: algo passou a existir, logo passou a valer a pena observar.

---

## 6. O inventário classificado

Custo primeiro, porque é o eixo declarado mais danoso. Cada linha nomeia a fonte que já existe — é este o registro de reaproveitamento.

| Painel                                                         | Custo         | Trabalho | Situação       | Fonte que já existe                                                    |
| -------------------------------------------------------------- | ------------- | -------- | -------------- | ----------------------------------------------------------------------- |
| **Runtime** — versões, memória do app                          | Grátis        | Leve     | Disponível     | canais `app:info` / `app:memory`                                        |
| **Processos** — pid, tipo, CPU, memória por processo           | Grátis        | Moderado | Disponível     | `app.getAppMetrics()` (§ 7.1)                                           |
| **Canais IPC** — contagem, latência, última falha              | Grátis        | Moderado | Disponível     | contadores em memória no `handle()` de `main/ipc/registry.ts`           |
| **Jobs** — ativos e tamanho do `Map`                           | Grátis        | Moderado | Disponível     | `src/main/jobs.ts`                                                      |
| **Fila do worker DuckDB** — profundidade                       | Grátis        | Moderado | Disponível     | `tail` promise de `spawnWorker.ts`                                      |
| **Motor em vigor** — `memory_limit`, extensões, versão fixada  | Grátis        | Moderado | Disponível     | `duckdb_settings()` / `duckdb_extensions()` (§ 7.2)                     |
| **Banco de dados** — esquema, contagem, migração, bytes        | Barato        | Moderado | Disponível     | `sqlite_master`, `PRAGMA user_version` / `page_count` / `freelist_count` (§ 7.3) |
| **Anexos** — blobs, bytes, economia de dedup, órfãos           | Barato        | Moderado | Disponível     | diretório por hash + a lógica de `main/attachments/gc.ts`               |
| **Uso de conversa** — modelos usados, respostas interrompidas  | Barato        | Moderado | Disponível     | `message.model` e o marcador `stopped` (§ 7.4)                          |
| **Cache do Chromium** — tamanho, e limpar                      | Acessível     | Leve     | Disponível     | `session.getCacheSize()` (§ 7.5)                                        |
| **Capacidades** — Ollama, modelos, `vision`, embedder, chaves  | Caro          | Leve     | Disponível     | `ai:isAvailable` / `models` / `loaded` + `secrets:has`                  |
| **Uso de disco** — varredura de `userData/`                    | Caro          | Pesado   | Disponível     | walk como job, com a separação da § 3.1                                 |
| **Eventos** — fluxo único, filtrado por severidade             | Barato        | Pesado   | Disponível     | store novo em `observatory.db`                                          |
| **Desempenho** — latência e tokens/s por modelo                | Barato        | Pesado   | Disponível     | store novo; instrumentação na borda de `ai:*`                           |
| **Privacidade** — o que saiu da máquina                        | Barato        | Pesado   | Disponível     | store novo + nível por anexo (§ 3.4)                                    |
| **Propostas** — aceitas, recusadas, verificação                | Barato        | Pesado   | **Gatilhado**  | falta gravar o veredito (§ 2.3)                                         |
| **Índice RAG** — por projeto, composição, `embed_space_id`     | Acessível     | Moderado | **Gatilhado**  | não existe RAG; especificação pronta na § 2.6                           |
| **Índices de ML**                                              | Acessível     | Moderado | **Gatilhado**  | não existe ML clássico (D9.6)                                           |

Repare na linha de **Capacidades**: **Caro + Leve**. É o par que uma classificação de eixo único esconderia — um painel que se escreve numa tarde e mesmo assim precisa nascer atrás de um botão.

Renderização, para todos: `Dialog`, `DatasetTable`, `formatCell`, `StateView`/`ViewState` e `errorMessage()` cobrem a casca inteira sem componente novo de base (skill [`design-system`](../../../.claude/skills/design-system/SKILL.md)).

### Inviáveis registrados

| Item                                                              | Motivo medido                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Observar o repositório** (contagem de teste, tetos, deriva)      | o observatório observa o app rodando na máquina do usuário, não o código-fonte. É ferramenta de desenvolvimento; misturar faria o painel mentir sobre para quem serve |
| **Varredura recursiva no processo main**                          | trava a janela inteira, menus inclusive. Não é o _dado_ que é inviável — é o **lugar**: vai para job/`utilityProcess` (§ 4.3)              |
| **`vss`/HNSW no índice de RAG**                                   | a persistência do índice HNSW é experimental e desligada por padrão no DuckDB; e a força bruta resolve em ~116 ms a 30 mil vetores (§ 2.6)  |

⚠️ **Um "Inviável" desta sessão foi derrubado pela sondagem, e o caso vale mais que a linha:** eu havia declarado a varredura do `Cache/` do Chromium inviável por serem milhares de arquivos. `session.getCacheSize()` devolve o número em uma chamada (§ 7.5). O veredito estava certo sobre o _método_ e errado sobre a _pergunta_. É a prova de por que "Inviável" tem de carregar o motivo medido: com o motivo escrito, a linha se refuta; sem ele, teria virado dogma.

---

## 7. A sondagem — o que foi verificado nesta sessão

Consultas via Context7 (documentação oficial do Electron) e busca web em 28/08/2026. **Reconferir contra a versão em uso antes de citar em código.**

### 7.1 Electron — métricas de processo, de graça

`app.getAppMetrics()` devolve `ProcessMetric[]`, um por processo do app:

| Campo                     | Conteúdo                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| `pid`                     | id do processo                                                        |
| `type`                    | `Browser`, `Tab`, **`Utility`**, `Zygote`, `Sandbox helper`, `GPU`, … |
| `serviceName`, `name`     | nome não localizado do processo                                       |
| `cpu`                     | `percentCPUUsage`, `cumulativeCPUUsage`, `idleWakeupsPerSecond`       |
| `creationTime`            | ms desde a época — com `pid`, identifica o processo unicamente        |
| `memory`                  | `residentSet`, `private`, `shared` — **em kilobytes**                  |
| `sandboxed`, `integrityLevel` | Windows/macOS                                                     |

⚠️ **`type: 'Utility'` cobre o worker do DuckDB** — ele aparece sozinho, sem instrumentação nenhuma. E `child.pid` do `utilityProcess` é `undefined` antes do evento `spawn` e depois do `exit`, o que dá o vínculo entre as duas fontes.

⚠️ **`idleWakeupsPerSecond` é sempre 0 no Windows.** Exibir a coluna nesta máquina é exibir um zero permanente.

`process.getSystemMemoryInfo()` devolve `total`, `free`, `swapTotal`, `swapFree` (Windows/Linux), **em kilobytes** — exatamente o que o [`CLAUDE.md`](../../../CLAUDE.md) descreve como "não há um número de RAM livre, há três". Lido em runtime, deixa de ser número chumbado.

### 7.2 DuckDB — o motor se descreve melhor que uma constante

| Função                                            | O que responde                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `duckdb_settings()` / `current_setting('memory_limit')` | **o valor em vigor**, não o declarado                                                                              |
| `duckdb_extensions()`                             | `extension_name`, `installed`, versão e caminho de instalação                                                            |
| `duckdb_memory()`                                 | `tag`, `memory_usage_bytes`, `temporary_storage_bytes` — tags `BASE_TABLE`, `HASH_TABLE`, `CSV_READER`, `ART_INDEX`, …    |
| `PRAGMA database_size`                            | `database_size`, `block_size`, `total_blocks`, `used_blocks`, `free_blocks`, `wal_size`, `memory_usage`, `memory_limit`   |

**Isto supera o truque do mill.tools.** Lá, `inspect.signature(...)` lê o _default declarado_; aqui o motor devolve o _valor aplicado_. A diferença aparece justamente no caso que interessa: um `SET` que não pegou, ou um `lock_configuration` que não travou, seriam invisíveis na leitura de constante e visíveis na leitura do motor.

E `duckdb_extensions()` resolve um aviso que hoje só vive em documentação: a extensão `excel` é vendorizada e **travada à versão exata do binding que a gerou** — um bump não quebra `typecheck` nem teste, só runtime. Com a versão instalada legível, o aviso vira linha conferível.

⚠️ `duckdb_memory()` e as colunas de `PRAGMA database_size` variam entre versões — conferir contra a versão que `@duckdb/node-api` embute antes de desenhar a tabela.

### 7.3 SQLite via `node:sqlite`

`PRAGMA` funciona pelo caminho normal de statement:

```js
const pageCount = db.prepare('PRAGMA page_count').get()
const freelist = db.prepare('PRAGMA freelist_count').get()
```

`page_count × page_size` dá o tamanho lógico; `freelist_count` alto indica que um `VACUUM` recuperaria espaço — e é o análogo direto do botão _Reindexar_ do mill.tools: **a manutenção ao lado do diagnóstico** (§ 1.4).

⚠️ **`COUNT(*)` não é grátis no SQLite** — não há contagem armazenada; a consulta percorre páginas. Para tabela grande, ou se aceita o custo sob a classe _Acessível_, ou se mostra estimativa. Não classifique contagem de linha como _Grátis_ por reflexo.

### 7.4 O que já está gravado e ninguém lê

Verificado em `src/shared/ipc.ts` nesta sessão:

- **`message.model`** — modelo por mensagem, gravado desde o [plano 14](../../plan/implemented/14-persistencia-das-conversas.md) (D13.4), mantido mesmo com o par travado no primeiro envio. Dá **volume real por modelo** sem instrumentar nada. Não dá latência: ninguém cronometra ainda.
- **marcador `stopped`** (`cancelled` | `timeout`, D14.3) — **quantas respostas não terminaram, e por quê.** É sinal de qualidade puro, no banco desde o plano 14, nunca agregado.

### 7.5 A chamada que derrubou um "Inviável"

`session.getCacheSize()` devolve `Promise<Integer>` com o tamanho do cache da sessão **em bytes**. Uma chamada, sem varrer diretório nenhum. Com o par `clearCache`, o painel de cache ganha diagnóstico **e** manutenção — o padrão da § 1.4 outra vez.

---

## 8. Como a trilha anda

**A trilha O não é fechada nem sequencial.** Ela cresce à medida que o app ganha o que observar. Cada plano é `O-n`, numerado, do tamanho de um corte — planos pequenos, nunca um plano-arco.

Três regras de ordem, todas derivadas da § 5:

1. **Situação decide se entra na fila; custo e trabalho decidem a posição dentro dela.** _Gatilhado_ não é fim de fila — é fora da fila até o evento disparar.
2. **O gatilho é evento, não data**, como todo gatilho do projeto ([`ROADMAP`](../../ROADMAP.md) § 2 é o dono). "Quando existir RAG", não "no quarto trimestre".
3. **Um painel _Pesado_ que depende de registro inerente ausente (§ 3.4) não vira plano O sozinho** — a gravação do dado pertence ao plano da feature que o produz; o painel a lê depois. Senão a trilha O passa a implementar feature dos outros.

E o corolário que a § 6 mostra: os primeiros O-n saem dos painéis **Grátis/Leve** e **Grátis/Moderado**, porque leem estado que já existe e não pedem `observatory.db`. Este só nasce quando alguém quiser **série temporal** — latência, fluxo de eventos, livro-razão de privacidade —, a única coisa que exige gravar o que hoje não se grava.

---

## Fontes

Leitura de fonte (mill.tools, `C:\rocketseat\projetos\python\yt-transcriber`): `src/core/observatory/*.py`, `src/gui/modules/observatory/*.py`, `src/cli/observatory.py`, `src/core/rag/{stats,analytics,eval,feedback}.py`, `docs/estudo/modulos/observatorio.md`.

Documentos deste repositório que são donos de fatos citados aqui: [`projetos-e-rag-por-projeto.md`](../projetos-e-rag-por-projeto.md) (§ 2.6), [`arte-anterior-milltools.md`](../arte-anterior-milltools.md) (§ 1.5), [`plano 09`](../../plan/active/09-camada-de-ia.md) (D9.5, D9.6), [`models/`](../models/README.md) (frota e embedder).

Documentação externa consultada em 28/08/2026:

- [Electron — `app.getAppMetrics()`](https://www.electronjs.org/docs/latest/api/app) · [`ProcessMetric`](https://www.electronjs.org/docs/latest/api/structures/process-metric) · [`process.getSystemMemoryInfo()`](https://www.electronjs.org/docs/latest/api/process) · [`session.getCacheSize()`](https://www.electronjs.org/docs/latest/api/session) · [`utilityProcess`](https://www.electronjs.org/docs/latest/api/utility-process)
- [DuckDB — Configuration](https://duckdb.org/docs/current/configuration/overview) · [Extensions](https://duckdb.org/docs/current/extensions/overview) · [Memory Management](https://duckdb.org/2024/07/09/memory-management)
- [Node.js — SQLite (`node:sqlite`)](https://nodejs.org/api/sqlite.html) · [The `freelist_count` PRAGMA](https://awjunaid.com/sqlite/the-freelist_count-pragma-in-sqlite/)
