# 09 — Camada de IA e ML

> **Fatia 1 implementada em 2026-08-07** — o *gate* de disponibilidade, o provedor Ollama e o chat local em fluxo (a primeira linha da [ordem sugerida](#ordem-sugerida)). O documento **continua em `active/`** porque as fatias 2–6 seguem no backlog: NL→passo, nuvem, cartão de dados, RAG e ML dependem da camada de dados ([`docs/study/05-proximos-passos.md`](../../study/05-proximos-passos.md)) e do pipeline de passos ([`docs/ESCOPO.md`](../../ESCOPO.md)), que ainda não existem. A fatia 1 não precisou de nenhuma das duas: sua única dependência real é o registro de jobs da [fase 06](../implemented/06-primeira-feature.md), como a própria [ordem sugerida](#ordem-sugerida) explicita.
>
> O que está aqui são **as decisões**, tomadas enquanto o contexto estava fresco; a fatia 1 as seguiu (D9.1, D9.2, D9.3) sem redescobri-las. As fatias seguintes herdam o mesmo registro de decisões.
>
> Referência do que se pretende portar: o `CLAUDE.md` e a skill `ml-rag` do projeto **mill.tools**. O que define o produto é o [escopo](../../ESCOPO.md) — este documento decide como a IA se encaixa nele, nunca o contrário.

---

## A pergunta que originou este documento

*A fundação de oito fases comporta IA local (Ollama) + nuvem (Gemini, GLM) + ML, ou é preciso replanejar?*

Comporta, e por um motivo que não é sorte: as decisões que a camada de IA exige são as mesmas que a fundação já tomou por outros motivos.

| O que a IA exige | Onde a fundação já resolveu |
|---|---|
| Fronteira de rede/modelo injetável e testável sem Ollama | D2 da [visão geral](../implemented/00-visao-geral.md) — DIP como parâmetro de função; `core/` puro |
| Falha esperada e acionável (serviço fora do ar, chave ausente, limite de taxa) | D2.2 da [fase 02](../implemented/02-contrato-ipc.md) — `Result` com `AppError` |
| Operação longa com progresso e cancelamento | D2.7 e D6.7 — `jobId` do renderer, `AbortController` no main |
| Recurso opcional que degrada em vez de quebrar | `AppError.kind = 'unavailable'` com `hint` — o formato do *gate* |
| Segredo que nunca chega ao renderer | D3.4 da [fase 03](../implemented/03-sandbox-e-seguranca.md) |
| Resposta em fluxo, token a token | Variante `chunk` de `JobEvent`, [fase 02](../implemented/02-contrato-ipc.md) |

As três últimas linhas foram **acrescentadas à fundação** por causa desta conversa. As outras já estavam lá.

---

## Decisões tomadas

### D9.1 — A chamada de LLM roda no main, não no `utilityProcess`

Isto contraria a intuição criada pelo raciocínio do DuckDB, e a distinção importa.

O DuckDB precisa de processo separado porque é **limitado por CPU** e suas chamadas N-API bloqueiam a thread — uma agregação de dez segundos congela a janela inteira.

Uma requisição HTTP ao Ollama ou ao Gemini é **limitada por entrada e saída**. O `fetch` assíncrono devolve o controle ao *event loop* imediatamente; o main fica ocioso esperando a rede, e a janela continua desenhando. Um processo a mais não compraria nada e custaria um canal a mais.

**A exceção, e ela é importante:** recuperação de RAG **é** limitada por CPU. Cosseno sobre uma matriz `N × 768`, pontuação BM25 e reordenação por MMR são laços numéricos em JavaScript. Para poucas centenas de documentos isso é sub-milissegundo e cabe no main; para milhares, não cabe.

Regra: **a chamada ao modelo fica no main; o cálculo sobre vetores acompanha o DuckDB no `utilityProcess`.** É a mesma fronteira, traçada pelo critério certo — quem bloqueia a thread vai para fora, quem espera rede fica.

### D9.2 — Uma fronteira de rede, injetável, exatamente como o `embed_fn`

`src/core/ai/` contém prompts, montagem de contexto, parsing de resposta e validação — tudo puro. A única função que toca a rede é passada por parâmetro:

```ts
export type ChatFn = (
  messages: Message[],
  opts: { model: string; signal?: AbortSignal; onChunk?: (t: string) => void }
) => Promise<string>
```

Os adaptadores concretos (Ollama, Gemini, GLM) vivem em `src/main/features/ai/providers/`. `core/` nunca sabe qual provedor está em uso — é o mesmo desenho de `embed_fn` e `make_llm_fn` do mill.tools, e o mesmo motivo: o teste de nível 1 roda sem Ollama instalado.

### D9.3 — Nuvem é opt-in, e o gate é o mesmo formato para os três

`isAvailable(service)` resolve pacote, binário e serviço, e devolve `Result`. Ollama fora do ar e chave de Gemini ausente produzem o **mesmo** `{ kind: 'unavailable', service, hint }` — a UI desabilita o card com a dica, e nenhum caminho quebra.

Detalhe herdado da skill `ml-rag` que vale copiar: **tempo limite curto para o *ping* de disponibilidade, longo para a operação real.** No mill.tools são 10s contra 300s. Sem isso, a tela de status trava por minutos quando o Ollama está fora do ar.

### D9.4 — NL→passo antes de RAG

Esta é a decisão de sequência mais importante do documento, e ela foi **revisada** depois que o [escopo](../../ESCOPO.md) fechou no modelo de pipeline de passos.

A versão anterior desta decisão era **NL→SQL**, portada do `nl2sql` do mill.tools. Num app onde a composição vive numa consulta única, é o alvo certo. Aqui não é: a composição vive numa **lista de passos**, e gerar SQL opaco a partir de português contornaria justamente o que dá valor ao modelo — passo é editável, inspecionável e reaplicável; SQL de trinta linhas não é.

O alvo correto:

> Pedido em português + **apenas o esquema** (nomes e tipos de coluna) → o modelo devolve **uma lista de passos tipados**, validada contra o catálogo de operações → inserida no pipeline, onde o usuário revisa antes de executar.

*"tira os duplicados por CPF e preenche cidade vazia com 'não informado'"* vira dois passos que aparecem na lista como qualquer outro — o usuário vê, ajusta, remove.

Três vantagens sobre gerar SQL, e a terceira é a decisiva:

1. **A validação é estrutural, não textual.** O retorno é conferido contra o catálogo de passos e o esquema real; não é preciso um `ensureSelect` defendendo contra DML, `COPY` e `ATTACH` no texto gerado.
2. **O erro do modelo é corrigível.** Passo errado se edita; SQL errado se reescreve.
3. **O resultado entra na receita.** Um pipeline gerado por IA é salvo e reaplicado como qualquer outro — a IA vira ponto de partida, não caixa-preta de uso único.

O passo de **SQL cru** do catálogo continua existindo, e nada impede um NL→SQL futuro que o alimente. Mas ele é a escotilha, não o caminho principal.

O ponto de privacidade permanece inegociável: **o modelo recebe o esquema, nunca as linhas.** É o que torna aceitável usar um provedor de nuvem sobre dados locais, e precisa estar registrado no `CLAUDE.md` quando a feature chegar.

> 🔍 O núcleo de `core/pipeline/` — os tipos de passo e o compilador para SQL — é construído pelo produto, muito antes da IA. Quando a IA chegar, ela não ganha caminho de execução próprio: **produz a mesma estrutura de dados que a interface produz.** É a razão de esta feature ser barata, e a razão de ela vir depois do pipeline, nunca antes.

### D9.5 — RAG entra quando existir corpus, e o corpus não são as linhas

RAG se aplica, mas sobre um acervo diferente do que a pergunta original imagina — e a distinção não é uma opinião sobre o produto, é a mesma que o próprio mill.tools faz ao indexar arquivos de dados pelo **cartão de dados**, nunca pelas linhas cruas. Buscar dentro de uma tabela é trabalho de SQL; RAG serve para achar **qual** tabela, receita ou anotação interessa.

| Indexável | Não indexável |
|---|---|
| Cartões de dados (esquema + perfil + avaliação da IA) | Linhas das tabelas |
| Receitas salvas, com nome e descrição em português | — |
| Notas e anotações do usuário sobre datasets | — |

São talvez centenas de documentos pequenos, não milhares. Isso muda a engenharia: uma matriz `500 × 768` em `Float32Array` ocupa cerca de 1,5 MB e o cosseno sobre ela é sub-milissegundo. **Não é preciso banco vetorial**, e possivelmente nem `utilityProcess`.

E há uma consequência agradável do stack: se o RAG chegar, o armazenamento de vetores é uma **tabela do DuckDB** — ele tem `array_cosine_similarity` nativo e a extensão `vss` para HNSW, se um dia o volume justificar. Não há `.npz` a inventar, porque o motor já está no projeto.

**Gatilho:** RAG entra na fila quando existirem cartões de dados suficientes para busca ser melhor que uma lista. Antes disso, é índice sem acervo.

### D9.6 — ML clássico entra por último, e provavelmente menor

O mill.tools usa scikit-learn atrás do extra `[ml]`. No ecossistema JavaScript não há equivalente maduro, e a resposta correta é **não portar por simetria**.

Cada capacidade tem um caminho próprio nesta stack:

| Capacidade | Caminho no data-lab |
|---|---|
| Detecção de *outliers* | SQL no DuckDB (quartis, desvio) — sem biblioteca |
| Perfil e estatística descritiva | `SUMMARIZE` do DuckDB — nativo |
| Agrupamento e projeção (PCA, t-SNE) | só se houver uso real; avaliar `druid`/`ml-matrix` na época |
| Similaridade e MMR | dezenas de linhas de álgebra em `core/` |

O que no Python exigia scikit-learn, aqui em boa parte é uma consulta. Vale reavaliar cada item na hora, não decidir agora.

---

## Ordem sugerida

```
fases 01-08 (fundação)
   └─► camada de dados — docs/study/05-proximos-passos.md
          └─► pipeline de passos + catálogo camada 1 — docs/ESCOPO.md
                 └─► 1. gate + provedores + chat local (Ollama)  ← primeira fatia de IA
                     2. NL→passo sobre o esquema                 ← o maior retorno
                     3. nuvem opt-in (Gemini, GLM) + segredos    ← D3.4 sai do papel
                     4. cartão de dados                          ← cria o corpus
                     5. RAG sobre cartões e receitas             ← só agora faz sentido
                     6. ML, item a item, se sobrar necessidade
```

Note que a IA agora depende de **duas** camadas, não de uma: sem o pipeline não há passo para o NL→passo produzir. É a consequência direta da D9.4 revisada, e é uma dependência boa — significa que a IA reusa a estrutura do produto em vez de criar um caminho paralelo.

O passo 1 é a fatia mínima que prova a arquitetura inteira: um gate, um provedor, uma resposta em fluxo usando a variante `chunk` de `JobEvent`, cancelável pelo registro de jobs que a fase 06 já construiu.

---

## O que **não** esperar da fundação

Registrado para não virar surpresa:

- **Nada de IA é implementado nas oito fases.** A fundação apenas deixa de atrapalhar.
- **Não há `utilityProcess` até o DuckDB.** A pasta `src/workers/` nasce vazia na fase 01 e continua assim.
- **A regra de segredo (D3.4) é regra, não código.** O `safeStorage` só é escrito quando houver a primeira chave.

---

**Índice do plano de fundação:** [README](README.md)

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-07 | Fatia 1 — gate + provedor Ollama + chat local em fluxo | concluída | Vertical `core`→`main`→`preload`→`renderer`: `core/ai` (`ChatFn`/`ProbeFn`/`runChat` puros), adaptador Ollama por `fetch` cru contra `127.0.0.1:11434` (zero dependência nova — `ollama` npm descartado), handlers com dois timeouts (ping 10s / chat 300s) e a flag `timedOut` separando cancelamento de estouro de prazo no mesmo `AbortController`. Streaming pela variante `chunk` de `JobEvent` (primeiro consumidor dela) + hook `useJobChunks`. Reusou `AppError` `unavailable`/`upstream` sem novos `kind`. Modelo padrão `gemma3:4b`; teto de threads de CPU (`options.num_thread`) configurável na UI, default 4 — a inferência roda no processo do Ollama, então esse é o único controle que o app tem sobre o apetite de CPU. `check:fast` verde (93 testes; os avisos `␍` do ESLint são CRLF pré-existentes em arquivos não tocados), build limpo (preload 1,15 kB, sem arrastar `zod`) e e2e dev 4/4. **Validado ao vivo**: `gemma3:4b` servido de `C:\ollama-models` (o path é config do `ollama serve` via `OLLAMA_MODELS`; o app é agnóstico a ele), streaming em tempo real ~4-6 tok/s, `ollama-server` ~52% de CPU com `num_thread=4`. **Aberto para próximas sessões**: (a) injeção do esquema do dataset no chat — colunas, nunca linhas (D9.4); exige o 1º estado compartilhado entre features + registro da regra de privacidade no `CLAUDE.md`; (b) gate via `/api/tags` para verificar o modelo específico e popular um dropdown. Fatias 2–6 seguem bloqueadas pela camada de dados + pipeline. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.
