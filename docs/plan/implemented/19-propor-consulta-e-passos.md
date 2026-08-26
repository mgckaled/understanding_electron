# 19 — Propor: consulta e passos

**Status: implementado em ago/2026** (sete passos, `pnpm check:fast` verde). Revisado em duas rodadas depois do fechamento — advisor (D19.7) e clique manual na GUI pelo usuário (D19.8), esta última achando o que nenhum teste automático alcança: uma UX de confirmação com escopo errado, um card sem saída da conversa, e um bug real de schema na camada DuckDB. Entrada em [`HISTORY.md`](../../HISTORY.md).

**Depende de:** [18-D — Perfil e cartão aninhado](18-D-perfil-e-cartao-aninhado.md) (o `ColumnProfile`/`nullPercentage` que a verificação pós-execução consome) e do arco 18 completo (motor DuckDB, `ensureDatasetView`) · **Entrega:** pedido em português vira lista de passos tipada e editável, aplicada sobre o dataset já anexado — a IA entra no verbo *tratar* sem ganhar caminho de execução próprio.

> Fatia 2 do [plano 09](../active/09-camada-de-ia.md) (D9.4), absorvida pelo arco como item **25** do [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência). Esboçado em sessão de conversa (25/08/2026), validado contra o código real antes de virar arquivo — não redescoberto na hora de executar.
>
> **Por que não é NL→SQL.** A versão anterior desta decisão portava o `nl2sql` do mill.tools. Não serve aqui: a composição deste app vive numa **lista de passos**, não numa consulta única, e SQL opaco gerado a partir de português contornaria o que dá valor ao modelo — passo é editável, inspecionável e reaplicável; SQL de trinta linhas não é. Texto completo da decisão em [D9.4](../active/09-camada-de-ia.md#d94--nlpasso-antes-de-rag).
>
> **O ponto de privacidade permanece inegociável:** o modelo recebe o esquema (nomes e tipos de coluna), **nunca as linhas**. Já registrado no `CLAUDE.md § Segurança`; este plano não reabre a decisão, só a exercita.

---

## Decisões

### D19.1 — Catálogo inicial: seis operações, não a camada 1 inteira

`filter`, `sort`, `limit`, `dropColumns`, `renameColumn`, `fillMissing`. O resto da [camada 1 do `ESCOPO.md`](../../ESCOPO.md#camada-1--o-essencial) fica de fora deste corte, registrado no fechamento (Passo 7) como fast-follow — não esquecimento. Mesma régua de sempre: "uma variável por vez", "vinte operações medíocres valem menos que cinco em que se confia".

### D19.2 — `query` e `steps` compartilham o vocabulário de passo, até prova em contrário

A união discriminada que o [`plan/active/README.md`](../active/README.md) já nomeia como entrega deste plano é `{ kind: 'query', steps: Step[] } | { kind: 'steps', steps: Step[] }` — a diferença é de apresentação (resposta imediata vs. pipeline reaplicável), não um segundo vocabulário. **Isto é falsificável no Passo 1**: se `query` precisar de forma que passo mutável não expressa (agregação, `GROUP BY`), o Passo 1 registra a forma própria antes de os Passos 2–4 construírem em cima do vocabulário errado.

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
- **"Receita salva"** (pipeline nomeado e reaplicável entre conversas) — continua sem plano numerado, fatia 5/6 do [plano 09](../active/09-camada-de-ia.md) seguem no backlog.
- **UI de montagem manual de passo** — este plano nasce a partir da proposta do modelo; um construtor manual de pipeline, se vier, é decisão separada.
- **RAG sobre cartões/receitas** — dado de fora do escopo deste plano; ver [`reference/projetos-e-rag-por-projeto.md`](../../reference/projetos-e-rag-por-projeto.md) para o levantamento correlato, ainda sem plano.
- **Edição de parâmetro de um passo** — o passo 6 só permite remover; trocar `column`/`value`/`operator` de um passo proposto pede um construtor de formulário por tipo de passo, fora do corte (ver D19.7 abaixo, o motivo prático que torna essa lacuna mais sentida do que parecia no esboço).
- **Filtro de exclusão múltipla ou de união** ("remover nomes com A, D e F", "manter só X ou Y") — decisão adiada pelo usuário na revisão ao vivo (D19.8): o catálogo de seis operações só combina condições em E entre passos, sem `notContains`/`isIn`. Gatilho em [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão).

## Nota de fechamento (D19.7) — dois desvios do esboço, um achado ao vivo

Registrado porque quem retomar este plano (ou copiar o padrão para o próximo) vai perguntar "por que não bate com o esboço de 7 passos original?".

**Dois desvios de fiação, ambos necessários, nenhum surpreendente em retrospecto:** (1) `Step`/`StepProposal` nasceram em `core/pipeline/steps.ts` no esboço, mas tiveram que se mudar para `shared/ipc.ts` no passo 3 — `dataset:transform` precisa deles como schema zod na fronteira IPC, e `shared/` não pode importar de `core/` (regra de camada, skill `architecture`); `core/pipeline/steps.ts` virou reexportação, mesmo padrão de `ColumnProfile`. (2) O esboço não previa como a proposta chegaria à conversa — resolvido no passo 5 com um canal novo, `ai:propose`, em vez de uma opção a mais em `ai:chat`: dobrar a chamada de modelo por turno custaria a latência inteira de novo nos 4 núcleos desta máquina, e cada verbo que produz `MessagePart` já tem canal próprio (`dataset:attach`, `document:attach`, `image:attach`).

**Achado ao vivo, real e não anedótico — e um segundo, no código, que a revisão do advisor achou por cima do primeiro:** confirmado com `gemma3:4b` de verdade (não simulado) — o pedido em português "filtre as linhas onde idade é maior que 18" às vezes gera `{ operator: 'isNotNull', value: 18 }` em vez de `{ operator: 'gt', value: 18 }`. Isso continua sendo o modelo escolhendo o operador errado, não algo que este plano controla. Mas o passo era, na primeira versão do compilador, **válido contra o schema** (isNotNull aceita `value` ausente ou presente) e o compilador aceitava silenciosamente — `IS NOT NULL`, descartando o `18` sem aviso — o que transformava um operador errado do modelo num resultado **incorreto e silencioso**, não numa falha visível. Corrigido na revisão do advisor que fechou este plano: `compileSteps` agora rejeita `value` junto de `isNull`/`isNotNull` como erro de compilação (`invalidQuery`), então o mesmo passo hoje aparece como recusa explícita, não como filtro que silenciosamente não filtrou. O usuário ainda só percebe a causa raiz (operador errado) revisando a lista antes de Aplicar, e o passo 6 só permite **remover**, não corrigir o operador — editar exigiria o formulário por tipo de passo que D19's escopo já recusa. Registrado em [`HISTORY.md`](../../HISTORY.md); se a taxa de erro se mostrar alta o bastante para incomodar no uso real, é o gatilho para (a) reforçar a instrução do prompt, (b) tentar `qwen2.5-coder:3b` (tem `tools`, mais forte em tarefa estruturada) em vez de `gemma3:4b`, ou (c) adiantar a edição de parâmetro — não algo a adivinhar sem mais uso.

## Nota de fechamento (D19.8) — rodada de clique manual, três correções e um gap deixado aberto

Registrado porque é a diferença entre "`pnpm check:fast` verde" e "funciona de verdade" — nenhum dos três problemas abaixo tinha teste que o pegasse antes de alguém clicar na tela.

**1. Confirmação de exclusão, redesenhada duas vezes na mesma sessão.** Primeira tentativa pôs ícone de lixeira vermelho + diálogo em cada botão de remover passo — tecnicamente correto por D10.1 (cor sólida só em botão preenchido), mas errado no escopo: toda linha da lista passou a parecer tão destrutiva quanto excluir o card inteiro. O usuário esclareceu a intenção: só descartar o card da conversa é irreversível; editar quais passos vão rodar antes de Aplicar não é — reversível a qualquer momento até clicar Aplicar. Redesenhado para **um** ícone de lixeira por card (sempre visível, independente de quantos passos restam), com diálogo; o "x" de cada passo voltou a ser clique direto, sem confirmação.

**2. O card não tinha como sair da conversa.** Mesmo com a exclusão de passo funcionando, remover o último deixava "Nenhum passo restante." para sempre na tela — nada apagava a mensagem persistida, e um reload trazia os passos originais de volta. Canal novo, `conversation:removeMessage` (os seis pontos de contato de sempre, skill `ipc`), apagando por id — reaproveita a mesma varredura de anexos órfãos que `conversation:remove` já dispara, já que a mensagem apagada podia (em outro caso de uso) carregar um anexo que ninguém mais referencia.

**3. Bug real na camada DuckDB, achado testando um pedido de exclusão múltipla.** "Remover nomes com A, D e F" voltou como três passos `filter/contém` encadeados — em SQL isso vira **E**, não OU (ver D19.8 abaixo sobre o vocabulário), e o resultado ficou com zero linhas. Isso expôs um bug de verdade, não do modelo: `reader.getColumnsObject()` da API do DuckDB devolve `{}` — nenhuma coluna, não colunas vazias — quando o resultado tem zero linhas. A tabela Arrow saía **sem nenhuma coluna**, e a tela mostrava uma caixa em branco sem cabeçalho, indistinguível de "Aplicar não fez nada". Corrigido com `columnNames()` (carrega o schema independente de quantas linhas voltaram); a mesma falha existia em `dataset:query` (a caixa de SQL manual), corrigida junto. Confirmado contra o motor real nos dois casos (zero linhas e com linhas) — armadilha registrada em [`HISTORY.md`](../../HISTORY.md) § Armadilhas diagnosticadas.

**Gap de vocabulário, deixado em aberto por decisão explícita do usuário:** o catálogo de seis operações (D19.1) não tem `notContains` nem `isIn` — filtros só se combinam em E entre passos. Um pedido de exclusão múltipla ou de união nunca compila certo com esse vocabulário, não importa o quanto o modelo acerte a intenção; fechar isso pede pelo menos um operador novo, tocando schema, compilador, `describeStep` e os três conjuntos de teste. Gatilho de revisão em [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão).

Commits desta rodada: `bee4f20`, `700afe9`, `aaf311a`, `487c82f`, `b4b9b57`, `93b7d1f`.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 25/08/2026 | 1–7 | **concluído** | Sete passos numa sessão. Rodada de fechamento com o advisor achou **dois furos bloqueantes que os 821 testes existentes não pegavam** — entre eles, `value` sobrando num `isNull` era descartado em silêncio, transformando erro semântico do modelo em resultado incorreto sem aviso. |
| 25/08/2026 | achado ao vivo | medido, não anedótico | Confirmado contra `gemma3:4b` real: o pedido "filtre onde idade é maior que 18" às vezes devolve `isNotNull` em vez de `gt`. A escolha do operador é sempre do modelo — mas até a correção acima o **compilador também tinha parte**: aceitava `value` junto de `isNotNull` e o ignorava, compilando para algo que não filtrava, com sucesso e sem aviso. Gatilho no [`ROADMAP § 2`](../../ROADMAP.md). |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| `reader.getColumnsObject()` devolve `{}` com zero linhas — tabela sem cabeçalho | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Um schema zod restringe a geração **e** valida a resposta | [`HISTORY.md`](../../HISTORY.md) |
| Pipeline de passos, não SQL-first; os dois verbos | [`HISTORY.md`](../../HISTORY.md) + [`ESCOPO.md`](../../ESCOPO.md) |
| `topValues` nunca entra no prompt — é conteúdo de célula, o que a fronteira de privacidade veta | [`ESCOPO.md`](../../ESCOPO.md) |
| Decisões D19.1–D19.8 | [`DECISOES.md`](../../DECISOES.md) |