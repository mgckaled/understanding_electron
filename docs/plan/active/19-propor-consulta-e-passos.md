# 19 — Propor: consulta e passos

**Depende de:** [18-D — Perfil e cartão aninhado](../implemented/18-D-perfil-e-cartao-aninhado.md) (o `ColumnProfile`/`nullPercentage` que a verificação pós-execução consome) e do arco 18 completo (motor DuckDB, `ensureDatasetView`) · **Entrega:** pedido em português vira lista de passos tipada e editável, aplicada sobre o dataset já anexado — a IA entra no verbo *tratar* sem ganhar caminho de execução próprio.

> Fatia 2 do [plano 09](09-camada-de-ia.md) (D9.4), absorvida pelo arco como item **25** do [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência). Esboçado em sessão de conversa (25/08/2026), validado contra o código real antes de virar arquivo — não redescoberto na hora de executar.
>
> **Por que não é NL→SQL.** A versão anterior desta decisão portava o `nl2sql` do mill.tools. Não serve aqui: a composição deste app vive numa **lista de passos**, não numa consulta única, e SQL opaco gerado a partir de português contornaria o que dá valor ao modelo — passo é editável, inspecionável e reaplicável; SQL de trinta linhas não é. Texto completo da decisão em [D9.4](09-camada-de-ia.md#d94--nlpasso-antes-de-rag).
>
> **O ponto de privacidade permanece inegociável:** o modelo recebe o esquema (nomes e tipos de coluna), **nunca as linhas**. Já registrado no `CLAUDE.md § Segurança`; este plano não reabre a decisão, só a exercita.

---

## Decisões

### D19.1 — Catálogo inicial: seis operações, não a camada 1 inteira

`filter`, `sort`, `limit`, `dropColumns`, `renameColumn`, `fillMissing`. O resto da [camada 1 do `ESCOPO.md`](../../ESCOPO.md#camada-1--o-essencial) fica de fora deste corte, registrado no fechamento (Passo 7) como fast-follow — não esquecimento. Mesma régua de sempre: "uma variável por vez", "vinte operações medíocres valem menos que cinco em que se confia".

### D19.2 — `query` e `steps` compartilham o vocabulário de passo, até prova em contrário

A união discriminada que o [`plan/active/README.md`](README.md) já nomeia como entrega deste plano é `{ kind: 'query', steps: Step[] } | { kind: 'steps', steps: Step[] }` — a diferença é de apresentação (resposta imediata vs. pipeline reaplicável), não um segundo vocabulário. **Isto é falsificável no Passo 1**: se `query` precisar de forma que passo mutável não expressa (agregação, `GROUP BY`), o Passo 1 registra a forma própria antes de os Passos 2–4 construírem em cima do vocabulário errado.

### D19.3 — Uma fonte só para o schema: `z.toJSONSchema()` alimenta `format` e `.parse()`

Confirmado ao vivo nesta sessão: `z.toJSONSchema()` existe e funciona no zod 4.4.3 já instalado — sem dependência nova. O mesmo schema zod gera o JSON Schema que trava a decodificação do Ollama (`format`) e valida a resposta depois (`.parse()`). É a lição mais citada da pesquisa desta sessão: o gerador e o validador têm que ser a mesma definição, ou divergem em silêncio.

### D19.4 — Primeiro corte é pré-visualização, não persistência

`dataset:transform` devolve um `SELECT` de pré-visualização sobre a view já existente (`ensureDatasetView`) — não materializa uma tabela tratada. `buildMaterializeSql` hoje só serve o scratch de perfil (`dataset_profile_scratch`, descartado em `finally` — `src/workers/duckdb/index.ts`); persistir o resultado tratado como saída de verdade (o "dado tabular é entrada **e** saída" do `ESCOPO.md`) é decisão de armazenamento própria, fora deste plano.

### D19.5 — A chamada de proposta não usa streaming

Resposta estruturada não é utilmente incremental — o JSON só é válido completo. Essa chamada específica ao `ChatFn` não passa `onChunk`; espera o corpo inteiro, então roda `.parse()`.

### D19.6 — A verificação pós-execução mede salto parcial de nulo, não contagem de linhas

Zero linhas depois de um filtro costuma ser a resposta **certa** — um alarme aí vira ruído ignorado. O formato real da falha silenciosa (`HISTORY.md`, *"8 de 30 propostas produziram coluna inteiramente nula"*) é uma coluna que **tinha** poucos nulos e passa a ter muitos depois de uma conversão de tipo — sucesso aparente, linhas erradas caindo caladas. `ColumnProfile.nullPercentage` já existe; comparar antes/depois é quase de graça.

---

## Passos

### Passo 1 — Tipos do passo, schema zod, e a forma de `query | steps`

`src/core/pipeline/steps.ts`: união discriminada com as seis operações da D19.1, schema zod por tipo, `z.toJSONSchema()` exportado. Resolve a D19.2 aqui — não depois.

**Aceite:** nível 1 cobrindo serialização/validação de cada tipo de passo e a forma escolhida para `query | steps`; `pnpm typecheck` limpo.
**Commit:** `feat(core): tipos de passo e schema zod do pipeline`

### Passo 2 — Compilador de passos para SQL

`src/core/pipeline/compile.ts`: `compileSteps(steps, schema) → string`, pura, sem banco. Referência a coluna inexistente rejeitada na compilação, nunca vira erro do DuckDB em runtime.

**Aceite:** suíte de nível 1 cobrindo cada tipo isolado, combinações de dois passos, e o caso de coluna inválida.
**Commit:** `feat(core): compilador de passos para SQL`

### Passo 3 — Canal `dataset:transform` e o resumo pós-execução

`src/shared/ipc.ts` ganha o canal (os seis lugares da skill `ipc`). Handler chama o compilador do Passo 2, executa a `SELECT` de pré-visualização contra `ensureDatasetView` no worker (D19.4), devolve o resultado **e** o resumo antes/depois (linhas, `nullPercentage` por coluna) que o Passo 6 consome.

**Aceite:** nível 3 chamando o handler como função comum contra dataset fixture; payload fora do schema lança.
**Commit:** `feat(main): canal dataset:transform sobre o compilador de passos`

### Passo 4 — Saída estruturada no `ChatFn`

`ChatFn` (`core/ai/types.ts`) ganha `format?: JsonSchema` opcional. Adaptador Ollama repassa ao `/api/chat`. Sem `onChunk` nesta chamada (D19.5); roda `.parse()` do schema do Passo 1 sobre o corpo completo, com caminho de erro nomeado para falha de parse.

**Aceite:** nível 1 com `ChatFn` fake devolvendo JSON válido e inválido — os dois caminhos cobertos.
**Commit:** `feat(core): saída estruturada opcional no ChatFn`

### Passo 5 — Monta o pedido de proposta

`core/ai/proposal.ts`: esquema (níveis 1/2 do cartão — nunca linha, D9.4) + pedido em português → chamada estruturada do Passo 4. Aqui só confirma a forma decidida no Passo 1; não a reabre.

**Aceite:** nível 1 cobrindo a montagem do prompt (sem linha vazando) e o parse do resultado.
**Commit:** `feat(core): monta o pedido de proposta de passos`

### Passo 6 — Renderização e verificação pós-execução

`MessagePart` novo ao lado de `DatasetPart`/`DocumentPart` (`shared/ipc.ts`). Renderiza dentro da mensagem do assistente (a opção mais barata das duas que o `plan/active/README.md` deixou em aberto — revisitável, não definitiva) como lista de passos com remover + "Aplicar", chamando o canal do Passo 3. Resultado mostra o resumo antes/depois como banner, disparando aviso no salto parcial de nulo da D19.6.

**Aceite:** nível 2 do fluxo completo com fake; banner verificado com um caso fabricado de salto de nulo.
**Commit:** `feat(renderer): proposta de passos na conversa, com verificação pós-execução`

### Passo 7 — Fechamento

Validação manual ao vivo (`pnpm dev`: pergunta real, proposta, edição, aplicação, banner). Diário deste plano preenchido. Escalonamento para `HISTORY.md` do que surpreender (candidato: alguma armadilha do JSON Schema/XGrammar do Ollama). `ROADMAP § 1`, linha 25, sai de "planejado". Registro explícito, nesta sessão, do que ficou fora deste corte: resto da camada 1, persistência do resultado tratado (D19.4), "receita salva" (continua backlog — fatia 5/6 do plano 09 intocadas).

**Aceite:** `pnpm check:fast` verde; os quatro registros acima (diário, `HISTORY.md` se houver, `ROADMAP`, itens fora do corte) feitos na mesma sessão em que o Passo 6 fechar.
**Commit:** `docs(19): fecha o plano — propor consulta e passos`

---

## O que **não** esperar deste plano

Registrado para não virar surpresa:

- **Resto da camada 1** (dividir coluna, extrair por regex, agregação, etc.) — fast-follow, não esquecimento (D19.1).
- **Persistir o resultado tratado como tabela nova** — D19.4 escolhe pré-visualização; materializar é decisão de armazenamento própria.
- **"Receita salva"** (pipeline nomeado e reaplicável entre conversas) — continua sem plano numerado, fatia 5/6 do [plano 09](09-camada-de-ia.md) seguem no backlog.
- **UI de montagem manual de passo** — este plano nasce a partir da proposta do modelo; um construtor manual de pipeline, se vier, é decisão separada.
- **RAG sobre cartões/receitas** — dado de fora do escopo deste plano; ver [`reference/projetos-e-rag-por-projeto.md`](../../reference/projetos-e-rag-por-projeto.md) para o levantamento correlato, ainda sem plano.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-25 | — | esboçado | Plano nasceu como esboço de 7 passos numa conversa exploratória, validado contra o código real (`core/ai/types.ts`, `src/workers/duckdb/index.ts`, `core/ai/dataCard.ts`) e revisado pelo `advisor()` antes de virar arquivo. Nenhum passo executado ainda. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.
