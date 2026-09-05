# Subproduto "Projetos" e RAG particionado (levantamento prévio)

**Data:** 25/08/2026. **Motivo:** conversa exploratória sobre adaptar ao crivo o padrão de "Projetos" do Claude Desktop/ChatGPT — agrupar conversas, prompt de sistema e busca semântica exclusivos por frente de trabalho. Rascunho original do usuário em [`notes/proposta_projetos-chat.md`](../../notes/proposta_projetos-chat.md) (fora de `docs/`, não versionado como plano).

**Status declarado pelo usuário: proposta sem compromisso, última prioridade do que já está previsto.** Este documento não abre plano, não toca `ESCOPO.md`, não decide se e quando "Projetos" será construído — registra o que a conversa apurou, para não precisar ser rederivado quando (e se) a decisão de construir chegar.

**O que este documento não é.** Não é o plano do subproduto — não tem passo numerado, não tem diário de execução. É levantamento: o que já está decidido em outro documento dono (só apontado, nunca duplicado), o que ficou como questão em aberto nesta conversa, e o que é estimativa de bancada, não medição em produção. Quando um plano nascer em `docs/plan/active/`, ele consome este guia — não o contrário.

**Legenda:**

| Marca | Significa |
|---|---|
| ✅ **decidido** | já é regra fixada em outro documento dono — este guia só aponta e explica a consequência |
| ❓ **questão em aberto** | identificada nesta conversa, sem resposta — um plano futuro decide, não este guia |
| ⚠️ **estimativa/não verificado** | conta de bancada ou fonte de terceiro, sem medição ao vivo nesta máquina — confirmar antes de virar código |

Companheiros: [`ESCOPO.md § O teste que separa pilar de produto novo`](../ESCOPO.md#o-teste-que-separa-pilar-de-produto-novo) e [`§ Ferramentas do chat`](../ESCOPO.md#ferramentas-do-chat), [`plan/active/09-camada-de-ia.md`](../plan/active/09-camada-de-ia.md) (D9.2, D9.5), [`HISTORY.md`](../HISTORY.md) (§ RAG entra por capacidade; § flexibilidade é forma de dado e slot), [`plan/implemented/14-persistencia-das-conversas.md`](../plan/implemented/14-persistencia-das-conversas.md), [`reference/arte-anterior-milltools.md`](arte-anterior-milltools.md), [`CLAUDE.md § Máquina e modelos locais`](../../CLAUDE.md).

---

## Índice

1. [A proposta original, em quatro peças](#1-a-proposta-original-em-quatro-peças)
2. [O teste de escopo — leitura corrigida](#2-o-teste-de-escopo--leitura-corrigida)
3. [Duas trilhas ortogonais: cartão/receita vs. "projeto"](#3-duas-trilhas-ortogonais-cartãoreceita-vs-projeto)
4. [Onde ficam os números — nada de `.npz`](#4-onde-ficam-os-números--nada-de-npz)
5. [Cartão de dados — o que entra, com exemplos](#5-cartão-de-dados--o-que-entra-com-exemplos)
6. [Embedder — travamento e o limite de hoje](#6-embedder--travamento-e-o-limite-de-hoje)
7. [Busca como *tool call* — não é injeção automática](#7-busca-como-tool-call--não-é-injeção-automática)
8. [O custo real: cache de prefixo e o que muda com *tool calling*](#8-o-custo-real-cache-de-prefixo-e-o-que-muda-com-tool-calling)
9. [Mensurações feitas nesta conversa](#9-mensurações-feitas-nesta-conversa)
10. [O que fica fora deste documento](#10-o-que-fica-fora-deste-documento)

---

## 1. A proposta original, em quatro peças

1. Um ou mais "projetos", cada um agrupando várias conversas.
2. Sistema de anexação de arquivos ao projeto.
3. Prompt de sistema próprio do projeto, texto livre com limite de caracteres definido pelo usuário.
4. Índice de busca semântica (RAG) exclusivo por projeto, com embedder escolhido pelo usuário (local ou nuvem) e limite de documentos.

O custo das quatro peças **não é uniforme** — é o fio condutor do resto do documento:

| Peça | Custo real | Depende de |
|---|---|---|
| (1) agrupar conversas | schema + IPC + UI, um degrau de migração | nada além do que já existe |
| (2) anexar documento ao projeto | reaproveita o mecanismo de anexo de documento já existe (plano 17) | nada novo |
| (3) system prompt do projeto | quase grátis — texto estático no prefixo do prompt | ✅ o slot já existe: `settings JSON` por conversa (D14.1) reservou `num_ctx`, temperatura e "prompt de sistema"; falta só elevar de conversa para projeto |
| (4) RAG por projeto | a peça cara e a que mais interage com decisões já tomadas | plano 09 fatia 5 (RAG sobre cartões/receitas), ainda `active` |

---

## 2. O teste de escopo — leitura corrigida

Primeira leitura desta conversa (incorreta, registrada aqui para não se repetir): apliquei [`ESCOPO.md` linha 27](../ESCOPO.md#o-teste-que-separa-pilar-de-produto-novo) — *"projeto paralelo com vida própria... ela virou outro produto"* — como se a proposta de "Projetos" fosse o exemplo que a régua recusa. **Errado.**

✅ **Decidido, e a evidência que corrige a leitura:** a própria régua permite *"ação executada, contexto consumido, ou artefato que o app já sabe persistir"* — prompt de sistema de projeto e documento anexado caem no lado permitido, e conversa é artefato que o app já persiste.

> ⚠️ **A evidência original desta seção envelheceu, e foi substituída pela acima (6ª revisão de escopo).** Ela dizia que busca web, MCP e raciocínio visível *"chegam pelo tool calling do Ollama"*, e usava esse padrão comum como analogia para a busca em documentos de projeto. **O arco 21 derrubou a premissa:** raciocínio chega por campo nativo do fio em cada provedor, sem *tool calling* em nenhum — e o `ESCOPO.md` deixou de tratar raciocínio como ferramenta. A conclusão desta seção não dependia dessa analogia e segue de pé pelo texto literal da régua; a analogia, não. Como uma busca de projeto seria acionada é decisão do plano que a construir, não algo que este levantamento possa presumir.

O que de fato dispara o teste (linha 29) é **"artefato que sobrevive fora da conversa E uma tela própria para gerenciá-lo"** — os exemplos reais recusados são "PDF anotado salvo" e "painel com filtros cruzados", ambos de natureza BI/exportação, não configuração de chat. Uma tela de projeto (nome, prompt, lista de documentos) é da mesma família de superfície que a sidebar de conversas e o seletor de modelo já são hoje.

❓ **Questão em aberto, não resolvida por este documento:** a recusa de "camada de workspace antes de existir o segundo tipo de coisa" ([`HISTORY.md` § flexibilidade é forma de dado e slot](../HISTORY.md)) foi uma recusa de **sequência** (não construir especulativamente), não de conceito. Se "Projetos" vier a ser decidido, vale registrar isso como uma decisão explícita — o mecanismo já usado para revisão de escopo é [`plan/implemented/revisao-escopo-nivel-3-nuvem.md`](../plan/implemented/revisao-escopo-nivel-3-nuvem.md), citado aqui só como precedente de formato, não como recomendação de abrir um agora.

---

## 3. Duas trilhas ortogonais: cartão/receita vs. "projeto"

❓ **Questão que a conversa resolveu por dependência, não por regra fixada em outro lugar.**

**Cartão de dados** (resumo textual de um dataset perfilado) **não depende de RAG nem de "projeto".** O mecânico é só formatar em texto o que `profileScratchTable()` (`src/workers/duckdb/index.ts`) **já calcula hoje** — zero embedding envolvido. Pode ser construído como recurso de exibição, isolado, antes de qualquer coisa de busca.

**Receita salva** (pipeline reaproveitável) também não depende de RAG nem de "projeto" — e **ainda não existe no app**: o `ROADMAP.md` lista "receitas salvas" como item próprio, separado da fatia 5 do plano 09, "depois do arco". É pré-requisito de D9.5, não parte dela.

**RAG é a camada de busca, não a de existência** — D9.5 já registra o gatilho: *"RAG entra na fila quando existirem cartões de dados suficientes para busca ser melhor que uma lista."* Poucos cartões, uma lista resolve.

```
cartão de dados (exibição)  ──┐
                               ├──► RAG sobre cartões/receitas ──► "projeto" só entra aqui,
receita salva (persistência) ──┘        (precisa de volume)         se quiser particionar
```

"Projeto" e "cartão/receita" só se cruzam num ponto: **se a busca sobre cartão/receita deve ser particionada por `project_id`.** Não é obrigatório construir as duas trilhas juntas.

**Se cartão/receita ficarem presos ao chat que os criou** (uma opção cogitada nesta conversa), o caso de uso que o próprio D9.5 registra para justificar RAG-sobre-cartões — *"em qual arquivo eu vi aquela tabela, há três semanas, não lembro em qual chat"* — fica sem resposta, porque você precisaria já saber o chat. Recomendação desta conversa (não é regra fixada): cartão/receita gerados em qualquer chat de um projeto entram na **mesma** partição do projeto que os documentos anexados — mesmo mecanismo, mesma tabela, mesmo filtro `project_id`.

---

## 4. Onde ficam os números — nada de `.npz`

O mill.tools (projeto irmão, Python) indexava num arquivo `.npz` — formato NumPy, matriz inteira carregada em RAM, regravada no disco a cada atualização. Cresceu para ~50MB misturando frentes de trabalho diferentes, e a busca degradou em dois eixos ao mesmo tempo: ficou mais lenta (mais linhas para rankear) e pior (mais conteúdo irrelevante disputando o topo do ranking).

✅ **Decidido (D9.5, plano 09):** o vetor não ganha formato de arquivo próprio — vive como coluna numa tabela DuckDB, ao lado das demais colunas do chunk (texto, origem, `project_id`).

⚠️ **Sintaxe confirmada via Context7 (`/duckdb/duckdb-web`), não testada nesta máquina:**

```sql
CREATE TABLE vectors (
  project_id VARCHAR,
  chunk_text VARCHAR,
  embed_space_id VARCHAR,  -- "modelo:dimensão:esquema", ver seção 6
  vec FLOAT[768]
);

SELECT chunk_text FROM vectors
WHERE project_id = 'projeto-x'
ORDER BY array_cosine_distance(vec, $consulta::FLOAT[768])
LIMIT 5;
```

⚠️ **Achado que muda a recomendação sobre `vss`/HNSW:** a persistência em disco do índice HNSW é **experimental e desligada por padrão** na documentação do DuckDB — "por causa de risco de recuperação de WAL" (`hnsw_enable_experimental_persistence`). Consequência: não vale ativar `vss` agora. A bancada da seção 9 já mostra que busca por força bruta (sem índice, só o `WHERE project_id`) numa partição de até 30 mil linhas leva ~116ms — nenhum projeto real deve chegar perto disso. Se um dia um projeto único crescer ordens de grandeza além do razoável, `vss` é o caminho, mas exigiria vendorizar a extensão como já foi feito para `excel` (plano 18-F) — mesmo obstáculo (`enable_external_access = false` bloqueia `INSTALL` em runtime), mesma solução já validada, não problema novo.

❓ **Questão em aberto:** o motor de consulta a dataset (`src/workers/duckdb/index.ts`) abre `:memory:` — efêmero, nunca persiste. Um índice de RAG precisa sobreviver ao fechamento do app, então precisa de um DuckDB **em arquivo**, dentro de `userData` — provavelmente uma segunda instância/arquivo, separada do motor de dataset. Não decidido: mesmo processo com duas instâncias, ou um `utilityProcess` dedicado.

---

## 5. Cartão de dados — o que entra, com exemplos

**Cartão mecânico** (gerado do `ColumnProfile[]` que o app já calcula, zero custo de LLM):

> `clientes.csv — 1.204 linhas, 5 colunas: id (INTEGER, único), nome (VARCHAR), idade (INTEGER, 18–95), cidade (VARCHAR, top: São Paulo, Rio de Janeiro, Belo Horizonte), data_cadastro (DATE, 2019-01-03 a 2024-11-20). Perfilado em 2026-08-25.`

**Cartão enriquecido** (uma chamada de modelo por dataset indexado, não por busca):

> `vendas_2023.parquet — 458.302 linhas, 12 colunas [...]. Descrição gerada: parece ser a base de vendas anual usada para calcular comissão regional — ver receita 'comissao-regional-q4', que consome este arquivo.`

**Cartão de receita:**

> `receita 'clientes-ativos-sp': filtra clientes.csv onde cidade = 'São Paulo' e data_cadastro > 2023-01-01; agrupa por mês; conta clientes. Última execução: 2026-08-15, resultado: 87 linhas.`

**Contraste com documento real (PDF/`.md`/`.txt`):** para tabular, só o cartão (resumo) entra no índice — a tabela em si nunca é tocada, e perguntas sobre os dados continuam indo por SQL. Para documento, o **conteúdo real** entra, cortado em chunks — buscar "o que o contrato diz sobre rescisão" acha o trecho porque o trecho indexado é o texto original, não um resumo sobre ele.

---

## 6. Embedder — travamento e o limite de hoje

✅ **Decidido pelo usuário nesta conversa:** o embedder trava no primeiro evento que precisa de embedding (documento anexado **ou** cartão/receita gerado, o que vier primeiro) — mesmo princípio de travar modelo/contexto no primeiro envio de uma conversa. Depois de travado, não muda dentro daquele projeto.

✅ **Lição já paga pelo mill.tools, citada em [`arte-anterior-milltools.md`](arte-anterior-milltools.md):** *"a assinatura de cache precisa conter tudo que muda a saída"* — a tabela de vetores precisa de uma coluna `embed_space_id` (`modelo:dimensão:esquema`) junto de cada linha, para nunca comparar cosseno entre dois espaços de embedding diferentes sem perceber ("prevendo lixo em silêncio", nas palavras deles).

⚠️ **Limite prático hoje, verificado por grep em `src/main/features/ai/providers/`:** existe **um único** embedder qualificado — `nomic-embed-text` (274 MB, 768 dims, teto de contexto **2.048 tokens** — documento precisa de chunking antes de indexar). Não existe adaptador de embedding de nuvem — os provedores hoje (`Gemini`, `GLM`) só têm completion. "Escolher entre embedders antes do primeiro arquivo" hoje é escolher entre um e nada; virar escolha real exige construir um segundo adaptador na fronteira injetável do `embed_fn` (D9.2).

---

## 7. Busca como *tool call* — não é injeção automática

Ponto levantado pelo usuário e que corrige a primeira resposta desta conversa: a proposta não é recolocar trechos recuperados numa posição fixa do prompt a cada pergunta (o design que o `HISTORY.md` já mediu como caro) — é dar ao modelo uma **ferramenta** de busca semântica com filtros, que ele aciona quando decide.

⚠️ **Corrigido na 6ª revisão de escopo — este parágrafo dizia que *"busca web, MCP e raciocínio chegam assim"*, e a segunda metade é falsa** (ver a correção na § 2). O [`ESCOPO.md § Ferramentas do chat`](../ESCOPO.md#ferramentas-do-chat) hoje registra **três** formas possíveis de acionar uma ferramenta — *tool call* do modelo, endereço fornecido pelo usuário, ou capacidade nativa do provedor de nuvem — sem eleger uma canônica. Busca em documento de projeto pode ser qualquer uma delas, e a escolha é do plano que a construir.

❓ **A restrição que esta seção chamava de decisiva deixou de decidir.** O argumento era: *tool calling* exige `capabilities: tools`, e o modelo padrão com `vision` não as tem, logo uma conversa de projeto com busca abriria mão de visão. **`qwen3.5:2b` junta `vision`, `tools` e `thinking`** — a exclusão deixou de ser universal, e o que fazer com o gate é decisão de produto própria (`F-6`, [`ROADMAP § 1`](../ROADMAP.md#1-a-sequência)). A restrição continua real para *outros* modelos da frota: quais juntam o quê é de [`reference/models/`](models/README.md).

⚠️ **Aritmética de bancada, candidatos com `tools` + `nomic-embed-text` (274 MB), contra as três faixas de RAM livre medidas ([`CLAUDE.md`](../../CLAUDE.md): ~9 GB só Electron · ~7,5 GB só VS Code · ~6 GB sessão típica):**

| Chat + embedder | Peso + cache a 8k ctx | Peso + cache no teto declarado |
|---|---|---|
| `qwen2.5-coder:3b` (1,9 GB, 36 KB/tok) | ~2,45 GB | ~3,3 GB (32k) |
| `phi4-mini` (2,5 GB, 128 KB/tok) | ~3,77 GB | ~6,77 GB (32k, teto real 131k inatingível) |
| `qwen2.5:7b` (4,7 GB, 56 KB/tok) | ~5,4 GB | ~6,72 GB (32k) |

`qwen2.5-coder:3b` sobra folga nos dois cenários e nos dois recortes de RAM — e já é candidato cogitado a padrão do NL→SQL, então não é escolha nova. Os outros dois apertam contra a faixa de 6 GB (sessão típica) no teto maior de contexto.

---

## 8. O custo real: cache de prefixo e o que muda com *tool calling*

✅ **Medido, `HISTORY.md` § RAG entra por capacidade:** injeção automática numa posição fixa custa 200s (1º turno) / ~3s (seguintes) para documento inteiro, contra 39s de indexação + **~27s por turno** para RAG — porque o trecho recuperado muda a cada pergunta e invalida o cache de prefixo dali para frente. Empate em ~6 turnos.

⚠️ **Busca via *tool call* não elimina esse custo — desloca para outro formato**, e a fonte que mudou minha avaliação: parte do resultado recuperado numa pergunta permanece no contexto (mensagem de `tool_result`) mesmo depois que deixou de ser relevante — o contexto cresce de forma monótona com resultado velho, em vez de recalcular tudo a cada turno. Cálculo de bancada: `qwen2.5-coder:3b` (36 KB/token de cache), 10 buscas numa conversa, ~3 trechos de 400 tokens cada = 12.000 tokens acumulados ≈ **37% do teto de 32.768**, e **~422 MB** de cache só desse acúmulo.

⚠️ **Achado de pesquisa na web, fonte não-oficial (ver Fontes), que exige verificação ao vivo antes de virar decisão:** alguns *templates* de chat do Ollama reposicionam ou removem a definição de ferramentas conforme a conversa alterna tipo de mensagem — quebrando o casamento byte-a-byte do prefixo mesmo num desenho *append-only*, custando "dezenas de segundos" extras por turno em hardware lento, segundo a fonte. Precisa de medição ao vivo com o modelo candidato real antes de assumir que busca-como-ferramenta preserva cache melhor que injeção — a intuição arquitetural aponta que sim, mas não está confirmada nesta máquina.

---

## 9. Mensurações feitas nesta conversa

⚠️ **Bancada descartável (Node puro, cosseno sobre `Float32Array` de 768 dimensões, sem DuckDB), rodada uma vez nesta máquina:**

```
total=     300  busca global=    1.20 ms  busca em partição de 300=  1.46 ms
total=    3000  busca global=   12.90 ms  busca em partição de 300=  1.04 ms
total=   30000  busca global=  116.14 ms  busca em partição de 300=  1.56 ms
total=  300000  busca global= 1327.13 ms  busca em partição de 300=  1.05 ms
total= 1000000  busca global= 4073.67 ms  busca em partição de 300=  1.17 ms
```

Leitura: "total" é a soma de **todos** os projetos já indexados pelo app. Sem partição, a busca cresce junto — de imperceptível a ~4s no acervo geral de 1 milhão de vetores. Com partição por `project_id`, o tempo fica achatado em ~1ms **independente do quanto os outros projetos cresceram** — o sintoma do mill.tools (mais lento e mais impreciso com o tempo) some porque a causa (busca sem fronteira) deixa de existir.

⚠️ **Extrapolações de conta, não medição nova:**

- **Chunking:** a 400 tokens/chunk, um documento de 8k tokens (teto do `ESCOPO.md` antes de RAG virar obrigatório) vira ~20 chunks. Mesmo um projeto sozinho acumulando 30 mil chunks (~1.500 documentos desse tamanho, cenário exagerado) ainda busca em ~116ms — nenhum projeto real deve precisar de `vss`.
- **Indexação**, cruzando com os 180 tok/s do `nomic-embed-text` já medidos no `HISTORY.md`: um projeto de 5 documentos de ~2k tokens indexa em ~56s; 20 documentos de ~4k tokens (80.000 tokens), **~7,4 minutos**. Reindexar não é ação instantânea a partir de um certo tamanho — precisa do mesmo tratamento de job/progresso que o app já usa para perfilar dataset grande.

---

## 10. O que fica fora deste documento

- Não decide **se** "Projetos" será construído, nem em que ordem relativa às demais fatias do plano 09.
- Não define nomes de canal IPC, nomes de tabela definitivos, nem o esquema exato de migração — isso é trabalho de plano, quando (e se) existir.
- Não resolve a questão em aberto da seção 4 (arquitetura de duas instâncias DuckDB) nem confirma a fonte não-oficial da seção 8 (templates do Ollama e cache) — ambas precisam de investigação/medição própria antes de virar decisão.
- Não estende `ESCOPO.md` nem abre uma revisão de escopo — se a decisão de construir chegar, o precedente de formato é [`revisao-escopo-nivel-3-nuvem.md`](../plan/implemented/revisao-escopo-nivel-3-nuvem.md).

---

## Fontes

- Context7, `/duckdb/duckdb-web` — extensão `vss`, `array_cosine_distance`, persistência experimental do índice HNSW.
- [Prompt Caching — Ollama in Action](https://leanpub.com/read/ollama/prompt-caching)
- [Ollama cache upgrade announcement (X/Twitter)](https://x.com/ollama/status/2038835455777763762?lang=en)
- [Ollama Tool support (aka Function Calling) — Medium](https://medium.com/@laurentkubaski/ollama-tool-support-aka-function-calling-23a1c0189bee)
- [How to Improve Ollama Tool-Calling Prompt Cache Reuse — nanobot docs](https://nanobot.wiki/docs/0.3.0/guides/configure-ollama-prompt-cache)
- [Ollama Tool Calling: The Practical Function Calling Guide](https://localaimaster.com/blog/ollama-function-calling-tools)
- [Tool Calling and Function Execution — DeepWiki](https://deepwiki.com/ollama/ollama/7.2-tool-calling-and-function-execution)
- [Streaming responses with tool calling — Ollama Blog](https://ollama.com/blog/streaming-tool)
