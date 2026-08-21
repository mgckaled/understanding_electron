# 18-D — Perfil nível 2 e o cartão aninhado

**Depende de:** [18-A — Motor: instalação, endurecimento e a primeira travessia de processo](../implemented/18-A-motor-e-worker.md) (implementado) · [18-B — Canal, Arrow e a primeira consulta visível](../implemented/18-B-canal-e-consulta.md) (implementado) · [18-C — Pré-visualização automática](../implemented/18-C-pre-visualizacao.md) (implementado) · **Entrega:** o canal `dataset:profile` (`SUMMARIZE` + top-N gated por cardinalidade), um botão "Perfil" no `DatasetCard` abrindo o resultado numa seção recolhível, e o primitivo `Disclosure` extraído de `shared/ui/` — terceira ocorrência do mesmo padrão, a que a regra dos três manda extrair.

> Quarto dos sub-planos do 18, e o de maior peso de desenho do lote — o advisor sinalizou isto ao revisar o 18-C, antes deste plano existir. É aqui que o `DatasetCard` do plano 16 vira, de fato, "cartão de dados" no sentido do `ESCOPO.md`: uma avaliação da IA sobre o arquivo, não só chrome (nome, colunas, linhas).

**Fora deste plano:** Parquet/JSON/NDJSON (18-E) · Excel (18-F) · qualquer coisa que vá além de nível 2 — nível 3 (amostra de linhas crua para o modelo) é do `ESCOPO.md` e não tem plano numerado ainda.

---

## O que a leitura do 18-A implementado mudou neste desenho

Três fatos reais, não presumidos, que vieram de ler `docs/plan/implemented/18-A-motor-e-worker.md`, `src/core/duckdb/config.ts`, `src/workers/duckdb/index.ts` e `src/main/duckdb/spawnWorker.ts` antes de escrever qualquer decisão abaixo:

1. **`buildDuckDbStartupCommands` e `DUCKDB_MEMORY_LIMIT` são os nomes reais**, em `core/duckdb/config.ts` — `memory_limit = '2GB'`, remedido duas vezes (7 GB livres no desenho, 5,54 GB na execução, ambos folgados para 2 GB). Isto importa aqui porque o perfil nível 2 é a **primeira** consulta do arco sem `LIMIT` — `SUMMARIZE` varre a coluna inteira, e o top-N por coluna de baixa cardinalidade agrupa a tabela inteira, uma vez por coluna qualificada. É o primeiro ponto do arco onde 2 GB deixa de ser folga óbvia e vira algo a observar ao vivo (risco nomeado abaixo).
2. **O worker de hoje (`probeDuckdbWorker`, `main/duckdb/spawnWorker.ts`) é scaffolding de mão única, com prazo de validade documentado no próprio código:** `postMessage('SELECT 42')` como string crua, uma resposta, sem discriminador de tipo de pedido. O próprio comentário do arquivo diz "nada aqui é para sobreviver ao 18-B". Isso significa que, quando o 18-D for executado, o protocolo já terá mudado uma vez (pelo 18-B, para a forma hash+SQL+Arrow da D18B.3). O 18-D precisa mudá-lo de novo — de "um tipo de pedido" para "dois tipos de pedido" — porque é o primeiro plano do arco que faz o worker fazer duas coisas diferentes.
3. **A ordem dos `SET` que o D18A.3 original propôs estava errada**, e a correção real (`allowed_directories`/`temp_directory` antes de `enable_external_access = false`) já está em `config.ts`, testada e comentada no próprio código. Não muda nada aqui — só confirma que o motor que o perfil vai consultar está corretamente restrito, com a prova ao vivo já feita no 18-A (leitura fora de `allowed_directories` rejeitada, `SET` pós-lock rejeitado).

---

## Decisões

### D18D.1 — O protocolo do worker ganha discriminador de tipo de pedido

Mensagem de/para o worker passa de string crua (`'SELECT 42'`, hoje) para `{ kind: 'query'; hash: string; sql: string } | { kind: 'profile'; hash: string }`, e a resposta espelha o mesmo discriminador. **Este plano é quem faz essa mudança**, não o 18-B — o 18-B só precisa de um tipo de pedido (SQL cru contra uma view), e só quando o perfil chega é que existe um segundo. `workers/duckdb/index.ts` ganha um `switch` exaustivo sobre `kind`, mesma forma que `partForProvider` já usa em `core/ai/messages.ts` para `MessagePart['kind']` (plano 17) — precedente do próprio projeto para "união discriminada com switch exaustivo, sem `default`".

### D18D.2 — `core/duckdb/profile.ts`: duas consultas, uma pura, a outra gated pela primeira

```ts
export interface ColumnProfile {
  column: string
  type: string
  nullPercentage: number
  approxUnique: number
  min: string | number | null
  max: string | number | null
  avg: number | null
  topValues?: { value: string; count: number }[]
}
```

Duas funções puras, testáveis em nível 1 sem DuckDB nenhum:

- `buildSummarizeSql(viewName: string): string` — `` SUMMARIZE "dataset" `` (o nome da view já sai citado com aspas duplas, mesmo padrão de identificador seguro que `sqlIdentifier` abaixo generaliza).
- `qualifiesForTopValues(approxUnique: number, rowCount: number): boolean` — **o limiar que o `ESCOPO.md` já reserva para `core/`**: `approxUnique <= 50 && approxUnique / rowCount <= 0.5`. Não é número medido — é raciocínio a partir do próprio exemplo do `ESCOPO.md` ("os cinco mais frequentes de `cpf` são vazamento com outro nome"): o segundo termo evita coluna quase-única (`cpf`, `id`), o primeiro evita top-N de uma coluna com 200 valores distintos, que não resume nada. **Registrado como juízo, não medição** — mesmo tratamento que o `RAM_MARGIN_BYTES` do `ROADMAP § 2` já recebe; gatilho de revisão: primeira vez que um perfil real produzir um top-N claramente inútil ou omitir um claramente útil.
- `buildTopValuesSql(viewName: string, column: string, limit = 5): string` — `` SELECT "<col>" AS value, COUNT(*) AS count FROM "dataset" GROUP BY "<col>" ORDER BY count DESC LIMIT 5 ``, com `sqlIdentifier(name: string): string` escapando aspas duplas internas — mesmo padrão de `sqlPath`/`sqlStringList` que já existe em `config.ts` (D18A.3), replicado aqui porque o alvo é identificador de coluna, não caminho de arquivo.

**`SUMMARIZE` sobre a *view* re-escaneia o arquivo a cada consulta — achado do advisor, endereçado com materialização, não ignorado.** `dataset` (D18B.3) é uma *view* sobre `read_csv_auto`, não uma tabela — sem projeção nem cache entre comandos, `SUMMARIZE` lê o CSV inteiro uma vez, e cada `GROUP BY` de top-N lê de novo. Cinco colunas qualificadas num CSV de 2 GB seriam seis leituras completas de texto. O worker materializa antes de perfilar: `` CREATE OR REPLACE TEMP TABLE dataset_profile_scratch AS SELECT * FROM "dataset" `` — uma leitura do CSV, e daí em diante `SUMMARIZE`/top-N/`COUNT(*)` rodam contra dado colunar em memória (dentro de `memory_limit`, derramando para `temp_directory` se precisar — os dois já vêm configurados desde o 18-A). É uma troca, não uma vitória óbvia: paga-se memória por não pagar I/O repetido, e o passo 6 mede se a troca vale a pena, não se "cabe em 2 GB". A tabela de rascunho é `CREATE OR REPLACE` a cada pedido (nunca acumula) e o worker a derruba (`DROP TABLE`) ao fim, para não deixar rascunho de um hash pendurado quando o próximo pedido de perfil for de outro arquivo.

O worker (D18D.1, `kind: 'profile'`) orquestra: materializa (acima), `SELECT COUNT(*) FROM dataset_profile_scratch` uma vez (fonte de `rowCount` — ver nota abaixo), `buildSummarizeSql`, aplica `qualifiesForTopValues` linha a linha, roda `buildTopValuesSql` **sequencialmente** para cada coluna qualificada — sem tentar uma única consulta com `UNPIVOT`/janela que faria tudo de uma vez; a versão simples primeiro, otimização é gatilho de `ROADMAP` se a medição do passo 6 mostrar necessidade.

**De onde vem `rowCount` para `qualifiesForTopValues` — resolvido agora, não durante o código (achado do advisor: três fontes existiam e discordavam).** `part.rowCount` (plano 16, `scanDelimited`) exigiria mudar os argumentos do canal (`{ hash }` → `{ hash, rowCount }`) só para isso. O `count` que o próprio `SUMMARIZE` devolve por coluna é contagem de **não-nulos**, não linhas totais — usá-lo enviesaria o limiar por coluna conforme a taxa de nulos, errado por construção. A fonte escolhida: `SELECT COUNT(*) FROM dataset_profile_scratch`, uma consulta a mais — mas barata, porque roda contra a tabela já materializada, não contra o CSV. Inequívoca, e o canal continua só com `{ hash }`.

### D18D.3 — A *view* nasce incondicionalmente a cada pedido de perfil; barato nos dois formatos de ciclo de vida possíveis

**Suposição que precisa ficar explícita, não implícita:** o worker de hoje (18-A) cria **uma** `DuckDBInstance`/conexão no start e a mantém para todos os pedidos — se o 18-B mantiver essa forma, a *view* de um hash sobrevive entre pedidos, e recriá-la é grátis (`CREATE OR REPLACE VIEW` sobre `read_csv_auto` é metadado, não leitura). **Se o 18-B, ao ser executado, abrir uma conexão por pedido em vez disso**, recriar a cada vez deixa de ser fallback e vira a única forma possível — e continua custando o mesmo (metadado). Por isso o pedido de perfil recria a *view* **incondicionalmente**, antes de materializar (D18D.2) — correto e sem custo extra sob as duas formas de ciclo de vida, então não precisa esperar o 18-B ser executado para saber qual das duas é real.

### D18D.4 — Transporte do perfil é JSON, não Arrow — decisão consciente, não default

Diferente de `dataset:query` (18-B), o resultado de `dataset:profile` **não** usa Arrow. Um perfil tem no máximo uma linha por coluna do arquivo — dezenas, não milhares — e a vantagem do Arrow (evitar alocação de objeto por linha num payload grande) não se aplica a um payload deste tamanho. Forçar Arrow aqui repetiria o erro que a D18B.1 já corrigiu uma vez (assumir vantagem sem medir): `Result<ColumnProfile[]>` puro, **tipado por TypeScript, sem `zod` na saída** — a skill `ipc` já é explícita ("`main → renderer` não [passa por zod]: o main é código próprio rodando privilegiado, e validar a própria saída é desconfiar de si mesmo ao custo de latência"). **Correção sobre um rascunho anterior desta decisão:** citar `settings:read` (D14.7) aqui estava errado — aquela exceção valida bytes **lidos do disco sem esquema**, e a validação **é** a migração; um perfil montado pelo próprio worker a partir do `SUMMARIZE` não é essa situação, é main confiando no que ele mesmo acabou de computar. Se o formato de colunas do `SUMMARIZE` mudar entre versões do DuckDB, isso é uma checagem de **versão**, e mora dentro do worker (um `assert` sobre as colunas esperadas, opcional, fora do escopo deste plano) — nunca na fronteira do IPC.

### D18D.5 — `Disclosure` extraído: terceira ocorrência, a regra dos três se paga

`DocumentCard.tsx` (D17.9) e a seção "Consultar" do `DatasetCard` (D18B.5) têm a mesma forma — `useState(false)` local, botão com `Chevron{Up,Down}`, render condicional — copiada, não compartilhada, por decisão explícita registrada no 18-B ("a segunda ocorrência não extrai"). O perfil é a terceira. `shared/ui/Disclosure.tsx` nasce aqui: `{ label, expanded, onToggle, children }`, sem estado próprio (controlado por quem chama — a seção "Consultar" do 18-B e o perfil deste plano já têm motivo para saber se estão abertos, ex.: para não rodar a consulta de novo). **Toca a skill `design-system`** — décimo primitivo da lista que hoje tem nove; a skill precisa da entrada, não só o código.

**O que este plano refatora, e o que não:** a seção "Consultar" do `DatasetCard` (mesmo arquivo que este plano já está tocando) migra para `Disclosure`. `DocumentCard.tsx` **não** — arquivo diferente, que este plano não tem motivo de abrir; fica registrado como oportunidade, não dívida obrigatória (mesmo critério "divide-se ao tocar" que a skill `comments` já aplica a outra coisa).

### D18D.6 — Cache por hash via TanStack Query, mesmo padrão do 18-C

`useDatasetProfile(hash)`, `queryKey: ['dataset', 'profile', hash]`, `staleTime: Infinity` — mesmo raciocínio da D18C.4 (conteúdo imutável por hash). Diferente da pré-visualização (D18C.5, dispara sozinha ao montar — a correção pós-18-C fez o `DatasetCard` esconder essa seção enquanto "Consultar" está aberto, mas o disparo automático em si não mudou), a consulta só dispara **quando o `Disclosure` abre** — `enabled: expanded` no `useQuery`, para não computar `SUMMARIZE` de arquivos que ninguém pediu perfil (a bifurcação 1 da sessão que abriu o arco 18: perfil é sob demanda, não automático).

---

## Passos

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `core/duckdb/profile.ts` — `buildSummarizeSql`, `buildMaterializeSql` (D18D.2), `qualifiesForTopValues`, `buildTopValuesSql`, `sqlIdentifier` | Nível 1: `qualifiesForTopValues` com casos de fronteira (49/50/51 valores distintos; razão 0.49/0.5/0.51); `sqlIdentifier` escapa aspas duplas internas no nome da coluna | Testes verdes; nenhuma dependência de DuckDB ou Electron neste arquivo |
| **2** | `workers/duckdb/index.ts` ganha o discriminador `kind: 'query' \| 'profile'` (D18D.1) — o `switch` exaustivo orquestra: view incondicional (D18D.3) → materializa em `dataset_profile_scratch` (D18D.2) → `COUNT(*)` (fonte de `rowCount`) → `SUMMARIZE` → top-N sequencial para colunas qualificadas → `DROP TABLE` | Nenhum nível 1–3 (mesma classe do 18-A/18-B: `utilityProcess` é API do Electron) | `pnpm dev` ao vivo: pedido `profile` contra um dataset real devolve um `ColumnProfile[]` plausível — pelo menos uma coluna de baixa cardinalidade com `topValues`, pelo menos uma de alta sem; um segundo pedido de perfil, de outro hash, não encontra rascunho do primeiro (`DROP TABLE` funcionou) |
| **3** | Canal `dataset:profile` de ponta a ponta — os seis pontos da skill `ipc`: `argsSchema`/`IpcContract`/`Api` (`{ hash }` → `Result<ColumnProfile[]>`, **tipado, sem `zod` na saída** — D18D.4), handler com `runProfile` injetado (mesmo padrão de `queryDataset`/D18B.6), `register-all.ts`, `preload/index.ts`, `test/api-mock.ts` | Nível 3: handler com `runProfile` dublê | Teste nível 3 verde; `pnpm typecheck` quebra em `test/api-mock.ts` até `dataset.profile` existir (mesmo sinal esperado do 18-B, skill `ipc`) |
| **4** | `shared/ui/Disclosure.tsx` (D18D.5) — extraído, controlado por quem chama; a seção "Consultar" do `DatasetCard` (18-B) migra para ele; entrada nova na skill `design-system` (décimo primitivo). **`DocumentCard.tsx` não migra neste passo** — arquivo diferente, que este plano não abre; a migração dele fica registrada como oportunidade, não dívida (precisaria elevar seu `useState` local para controlado, não é troca mecânica) | Nível 2 do `Disclosure` isolado + os testes existentes da seção "Consultar" continuam verdes após a migração | `Disclosure` renderiza fechado/aberto conforme prop, sem estado interno; **nenhuma regressão visual na seção "Consultar", verificada pelo mesmo instrumento da DS1.7** (despejo de `getBoundingClientRect` antes/depois + diff de pixel), não por inspeção visual solta |
| **5** | `useDatasetProfile(hash)` (D18D.6) + botão "Perfil" no `DatasetCard`, usando `Disclosure` (passo 4); tabela do perfil — coluna, tipo, % nulos, min/máx/média quando aplicável, top 5 quando `topValues` existir | Nível 2: `Disclosure` fechado não dispara a query (`enabled: expanded`); abrir dispara; fixture com coluna de baixa e de alta cardinalidade mostra a diferença (`topValues` presente só na primeira) | Fluxo completo em nível 2; **ao vivo** (`pnpm dev`) contra um dataset já anexado |
| **6** | Medição ao vivo contra um fixture real, na escala alvo do `ESCOPO.md` (~2 GB, ou o maior fixture disponível) — **a pergunta certa não é "cabe em 2 GB", é "a materialização (D18D.2) valeu a pena"**: tempo da leitura única do CSV (materializar) contra o que seriam N+1 leituras se `SUMMARIZE`/top-N rodassem direto sobre a *view*; e, com a tabela materializada, se `memory_limit = '2GB'` derrama para `temp_directory` ou não | — | Dois números registrados no diário: o tempo de materializar + perfilar, e uma estimativa do que custaria sem materializar (mesmo que estimada, não recronometrada) — **é o primeiro ponto do arco em que uma consulta sem `LIMIT` roda de verdade**, não presumir que 2 GB segue folgado só porque foi folgado nos passos capados do 18-B/18-C |
| **7** | Fechamento: diário; `HISTORY.md` se o passo 6 revelar algo (derramamento, tempo alto, limiar da D18D.2 claramente errado); `ROADMAP § 2` ganha o gatilho do limiar de cardinalidade (D18D.2, não medido) se ainda não tiver um equivalente | — | `pnpm check:fast` verde; nada pendente de registro |

---

## Ordem de dependência

```
1 (SQL puro) ──► 2 (worker orquestra) ──► 3 (canal)
                                              │
4 (Disclosure extraído) ─────────────────────┼──► 5 (UI do perfil) ──► 6 (medição) ──► 7 (fechamento)
```

4 não depende de 1–3 (é refactor da seção "Consultar" do 18-B, já existente) — pode ser feito em paralelo, mas precisa terminar antes do 5, que já nasce usando `Disclosure`.

---

## Riscos

1. ~~**`SUMMARIZE` sobre a *view* re-escaneia o CSV a cada consulta**~~ — **endereçado por desenho** (D18D.2/D18D.3): materializar antes de perfilar troca N+1 leituras de disco por uma leitura + memória. O que sobra de risco genuíno é se a troca vale a pena na prática — é a pergunta do passo 6, não mais uma suposição. `memory_limit = '2GB'` nunca foi testado sob carga sem `LIMIT` (18-A testou config, 18-B/18-C testam consultas capadas), e o passo 6 mede isso também.
2. **O limiar da D18D.2 (`<= 50` e `<= 50%`) é juízo, não medição** — pode gerar top-N inútil (coluna com exatamente 50 valores numa tabela de 100) ou omitir um útil (coluna com 51 valores numa tabela de 10.000). Gatilho de `ROADMAP` já nomeado; não é bloqueante para fechar este plano.
3. **O `switch` exaustivo do passo 2 é o segundo ponto de mudança no protocolo do worker em dois planos** (18-B muda de string crua para `{hash, sql}`; este muda para `{kind, ...}`). Se o 18-B, ao ser executado, tiver desenhado o protocolo de um jeito que este plano não previu, o passo 2 pode precisar de ajuste — nomeado, não ignorado.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo nos passos 2 e 5 — a prova de vida do worker e o fluxo completo, respectivamente.
- Passo 6 exige um fixture na escala do `ESCOPO.md`, não um arquivo de teste de algumas linhas — é o único jeito de saber se `memory_limit = '2GB'` segura.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 18/08/2026 | — | plano escrito, revisado pelo advisor, ainda não executado | Escrito **depois** de ler o 18-A implementado (código real, não o plano) — três fatos mudaram o desenho: os nomes reais de `core/duckdb/config.ts` (`buildDuckDbStartupCommands`, `DUCKDB_MEMORY_LIMIT`), o worker de hoje (`probeDuckdbWorker`) é scaffolding com prazo documentado de expirar no 18-B, e a correção de ordem dos `SET` (D18A.3) já está resolvida e testada. Decisão central nova: o protocolo do worker ganha discriminador `kind` **neste** plano (D18D.1), não no 18-B. Transporte do perfil é JSON, não Arrow (D18D.4). `Disclosure` extraído na terceira ocorrência do padrão (D18D.5). Revisão do advisor (Opus) apontou quatro correções, todas aplicadas: `SUMMARIZE` sobre a *view* re-escaneia o CSV a cada consulta (achado que eu não tinha visto) — corrigido materializando numa `TEMP TABLE` antes de perfilar (D18D.2/D18D.3), o que também resolveu de graça a origem do `rowCount` para o limiar de cardinalidade (um `COUNT(*)` barato contra a tabela materializada, não uma quarta fonte ambígua); a citação de `settings:read`/D14.7 para justificar `zod` na saída do canal estava errada — aquele precedente é sobre migração de bytes sem esquema, não sobre confiar na própria computação, e a validação de saída foi removida (D18D.4); o passo 4 ganhou o instrumento real de "sem regressão visual" (`getBoundingClientRect` + diff, DS1.7) em vez da alegação solta; nota registrada sobre `DocumentCard` não migrar para `Disclosure` neste plano (estado hoje é local, não controlado — migração não é mecânica). |
