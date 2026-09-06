# crivo

Aplicação **Electron**: uma ferramenta local multiuso **operada por conversa**, com análise de dados como o pilar mais maduro — abrir CSV, Excel ou JSON (Parquet está no escopo e **ainda não** no seletor — skill [`data`](.claude/skills/data/SKILL.md)), perguntar sobre o arquivo em português, e sair com uma resposta ou com o dado tratado; documento, imagem, código, busca web, documentação (MCP) e raciocínio visível entram pela mesma conversa, cada um como pilar próprio (critério em [`ESCOPO.md`](docs/ESCOPO.md)). O motor de dados é o DuckDB; o tratamento vive num pipeline de passos que compila para SQL. O objetivo declarado do projeto é duplo: entregar essa ferramenta funcionando localmente e servir de veículo de aprendizado do ecossistema Electron com TypeScript.

---

## ⚠️ Registro de trabalho — leia antes de começar

**Toda sessão de trabalho termina registrando o que foi feito.** Não é burocracia: é a diferença entre um projeto que acumula contexto e um que o perde. Dois registros, com vidas diferentes:

| | Onde | Unidade | Quando |
|---|---|---|---|
| **Diário de execução** | tabela no fim do plano em `docs/plan/active/` | uma sessão | antes de encerrar **toda** sessão |
| **Entrada de histórico** | [`docs/HISTORY.md`](docs/HISTORY.md) | um marco concluído | ao mover um plano para `implemented/` — **ou ao terminar um trabalho que mudou o projeto sem ter plano** (revisão de escopo, manutenção de documentação) |

**Escalonamento — a regra que faz o sistema funcionar:** observação do diário que valha **além daquele plano** sobe **na mesma sessão** — para o `HISTORY.md`, ou para o [`ARMADILHAS.md`](docs/ARMADILHAS.md) se for erro diagnosticado. O teste é *"isto vai custar tempo de novo?"*: armadilha diagnosticada, alternativa tentada e descartada, número medido — sobe. "Terminei o passo 3" morre com o plano.

**Auto-conservação — o mesmo cuidado, voltado para fora do plano.** Ao encerrar um plano ou tarefa, **quatro** tipos de deriva, tratados diferente porque cada um falha de um jeito:

- **(a) nome ou caminho que mudou** — `grep` o nome antigo em `.claude/skills/` e `docs/` **antes** de commitar. ⚠️ Mover um arquivo conserta os links **para** ele e quebra os **de dentro** dele: `pnpm exec node scripts/check-doc-links.mjs`.
- **(b) contagem que envelheceu** (canais IPC, número de teste, tamanho de documento) — não é greppável, então **remedir é o próprio ato de conservar**: nunca copiar um número de um documento para outro sem reconferir a fonte na hora. E remeça **depois** de terminar de editar, nunca no meio.
- **(c) ponteiro por seção** (`arquivo.md § Nome`) — apodrece sem sinal quando a seção muda de arquivo, porque o alvo do link continua existindo. **Cite a sigla** (`DT7`, `D15.2`), que não se move; o mesmo script acima pega o resto.
- **(d) documento que estourou o teto** — ao escrever a 11ª entrada de marco em `HISTORY.md`, a mais antiga desce para o `HISTORY-archive.md` na mesma edição. Tetos e o que fazer: [`docs/README.md`](docs/README.md#régua-de-tamanho-de-documento).

Se a mudança tocou um fato citável em mais de um lugar e nenhuma das quatro se aplicou, o próximo a ler paga sem saber que está pagando.

Regra completa e formato em [`docs/README.md`](docs/README.md#os-dois-registros-e-por-que-são-dois).

---

## Princípio: funil antes de abrir

**Nunca passe para o LLM o que uma ferramenta de shell pode filtrar primeiro.** Vale para ler, buscar, mapear, escrever e verificar — em documentação e em código igualmente.

Para **ler, buscar e mapear**, o guarda-chuva vira o **funil arquivo → linha → bloco**: `Grep`/`rg -l` decide o arquivo, `-n` decide a linha, `-A`/`-B`/`offset`+`limit` decide o bloco. Nunca abrir um arquivo inteiro para confirmar o que uma linha de contexto já mostraria, nem reler do zero quando o `limit` não bastou. **Escrever e verificar não têm bloco a decidir** e seguem o mesmo princípio por outro caminho: ferramenta certa para a escrita, filtro na saída do comando.

Duas seções aplicam isto a domínios diferentes, cada uma guardando só a particularidade que o princípio não cobre: o **protocolo de leitura da documentação** (a tabela por-arquivo de `docs/`) e as **operações de arquivo** (a tabela por-ferramenta, sobre código, log e saída de comando).

---

## Organização da documentação

A tabela do protocolo abaixo lista cada arquivo de `docs/`, o peso dele e como consultá-lo — é o mapa e a régua no mesmo lugar. O mapa completo da pasta, o ciclo de vida de um plano e a convenção de fonte única são de [`docs/README.md`](docs/README.md).

Ciclo de um plano, em uma linha: nasce em `plan/active/` → cada sessão acrescenta uma linha ao diário dele → ao concluir, **move** para `plan/implemented/` e ganha uma entrada em `HISTORY.md`. Plano abandonado vai para `plan/archive/` **com o motivo** registrado.

### Protocolo de leitura da documentação

Aplica o funil arquivo → linha → bloco do princípio acima; a tabela é a particularidade de `docs/` — qual exceção cada arquivo impõe.

**Nenhum arquivo de `docs/` se lê na íntegra.** A pasta soma **~2,45 MB / ~660k tokens** em 117 arquivos, e `plan/implemented/` sozinho responde por **60%** dela. Ler dois arquivos inteiros já é mais contexto do que a maior parte das sessões precisa, e o custo aparece como autocompactação, que apaga o trabalho da própria sessão.

| Arquivo | ~tokens | Como consultar |
|---|---|---|
| **`plan/implemented/`** (74 arq.) | **~392k** | `Grep` no nome do plano, na sigla `D<n>.<n>` ou no símbolo. **Nunca** `Read` — nem "só para ver o diário". A maior pasta do repositório e a de consulta mais rara |
| `reference/` (22 arq.) | ~77k | `Grep` no assunto; três documentos ali estão marcados `⛔ consumido` |
| `HISTORY-archive.md` | ~53k | `Grep` no nome do plano/fase ou da decisão. **Nunca** `Read` |
| `study/` (12 arq.) | ~39k | `Grep` no conceito; `Read` com `offset` na seção achada |
| `ARMADILHAS.md` | ~31k | `Grep` no **sintoma** — símbolo, API, mensagem de erro. **Nunca** `Read` |
| `DECISOES.md` | ~18k | `Grep` na sigla (`D<n>.<n>`, `DT<n>`) — é tabela, uma linha responde |
| `ROADMAP.md` | ~14k | `Grep` no item; `§ 2` e `§ 3` têm `offset` estável |
| `ESCOPO.md` | ~12k | `Grep` no pilar ou na operação |
| `HISTORY.md` | ~8k | `Grep` no assunto; ou `Read` com `offset`/`limit` na seção achada |
| `plan/active/` (3 arq.) | ~9k | o plano **em execução** se lê inteiro; os demais, `Grep` |
| `README.md` | ~4k | único que cabe inteiro |

⚠️ **Estes números envelhecem — remeça antes de citá-los em outro lugar.** O status de cada teto, com a série medida, é do [`ROADMAP § 2`](docs/ROADMAP.md).

**Como fazer certo, em ordem:** (1) `Grep -n` pelo termo → devolve linha e arquivo; (2) `Read` com `offset` = linha achada menos 5, `limit` 40–60; (3) se a seção continuar além, estenda o `limit`, não releia do zero. Um `Grep` com `-C 3` resolve a maioria das perguntas **sem nenhum `Read`**.

**As três exceções que se leem inteiras:** este `CLAUDE.md`, `docs/README.md` e o plano ativo em que se está trabalhando. Mais nada.

⚠️ **Plano em `implemented/` é o caso que mais engana.** Parece a fonte completa — e é, mas de um trabalho terminado. O que dele ainda vale já subiu para `HISTORY.md`, `ARMADILHAS.md` ou `DECISOES.md`; abrir o plano inteiro paga ~20 KB de média para reler o que o dono responde numa linha. **E vale para você mesmo daqui a vinte turnos:** a tentação aparece como *"agora preciso do contexto completo"* — não precisa. A pergunta que motivou a leitura tem um termo, e o termo é grepável; se não houver termo, a pergunta ainda não está formada.

### Fonte única por assunto

Cada assunto tem **um** dono. Os demais apontam — nunca duplicam. Fato duplicado é dívida: o segundo lugar envelhece calado.

| Assunto | Dono |
|---|---|
| O que o app faz e não faz, catálogo de operações, formatos, escala | [`docs/ESCOPO.md`](docs/ESCOPO.md) |
| Camadas, regra de importação, sandbox, jobs, régua de tamanho | skill [`architecture`](.claude/skills/architecture/SKILL.md) |
| Contrato IPC, `window.api`, `Result` vs exceção, eventos, payload binário | skill [`ipc`](.claude/skills/ipc/SKILL.md) |
| Tokens, primitivos, `ViewState`, convenções de desktop | skill [`design-system`](.claude/skills/design-system/SKILL.md) |
| Níveis de teste, mocks, o que não testar | skill [`testing`](.claude/skills/testing/SKILL.md) |
| Convenção de comentário e docstring (TSDoc) | skill [`comments`](.claude/skills/comments/SKILL.md) |
| Camada de dados (DuckDB, `utilityProcess`, Arrow, motor restrito) | skill [`data`](.claude/skills/data/SKILL.md) |
| Camada de IA — provedor/streaming, orçamento de contexto e RAM, raciocínio, proposta NL→passo | skill [`ai`](.claude/skills/ai/SKILL.md) (R-6, set/2026) |
| RAG e ML clássico — fatias 5/6 do plano 09, ainda não iniciadas | [`docs/plan/active/09-camada-de-ia.md`](docs/plan/active/09-camada-de-ia.md) |
| Frota Ollama instalada, peso/cache KV por faixa de contexto, ficha técnica dos modelos de nuvem opt-in, elegíveis, inviáveis, descartados | [`docs/reference/models/`](docs/reference/models/README.md) — **inclusive a frota instalada**, desde ago/2026 |
| Decisões, alternativas descartadas, marcos entregues | [`docs/HISTORY.md`](docs/HISTORY.md) (10 mais recentes) + [`HISTORY-archive.md`](docs/HISTORY-archive.md) |
| Armadilha diagnosticada — erro que já custou tempo uma vez | [`docs/ARMADILHAS.md`](docs/ARMADILHAS.md) — busca **por sintoma**, não por data |
| Índice tabular por decisão individual (trilha, sigla, título — sem narrativa) | [`docs/DECISOES.md`](docs/DECISOES.md) |
| Pendências e gatilhos de revisão | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Fundamentos do Electron, anatomia, medições | [`docs/study/`](docs/study/README.md) |

Este arquivo registra o que **não** se deduz do código nem cabe nos donos acima: stack fixada, regras invioláveis e ambiente de desenvolvimento.

---

## Operações de arquivo — leitura, busca, escrita, verificação e mapeamento

Estende o guarda-chuva do princípio no topo do arquivo às cinco operações abaixo, sobre código-fonte, log e saída de comando: ler, buscar e mapear aplicam o funil arquivo → linha → bloco; escrever e verificar seguem o mesmo guarda-chuva por outro caminho. A tabela abaixo é a particularidade deste domínio: qual ferramenta cobre cada operação.

| Operação | Estratégia de economia |
|---|---|
| Ler | `sed -n`, `head`/`tail`, `grep -A/-B`, `offset`/`limit` |
| Escrever | `sed -i`, `>>`, heredoc, patch |
| Buscar | `rg -l`, `fd`, `ctags`, funil (arquivo → linha → bloco) |
| Verificar | `vitest related`, `grep "Error:"`, `--reporter=dot`, filtrar antes de entregar |
| Mapear | `grep` de definição (não ocorrência), imports só no `head`, respeitar camadas de `architecture` |

### Ler

| Situação | Regra |
|---|---|
| Arquivo de código dentro da régua de tamanho (tabela acima) | `Read` direto — 400 linhas (teto de componente) já é pouco |
| Arquivo de código acima do próprio teto (já é sintoma por si só) | `grep -n` pelo símbolo primeiro; `Read` com `offset` = linha achada − 5, `limit` 40–60 |
| Log, saída de comando salva em arquivo, config grande | acima de ~150 linhas, nunca inteiro — no Bash, `sed -n 'N,Mp'`, `head -n`/`tail -n`, `grep -n -A/-B`; no PowerShell, `Select-String`, `Get-Content -TotalCount`/`-Tail` |
| Arquivo de dataset (CSV/Excel/JSON anexado) | nunca lido bruto — nível 1 (schema) e nível 2 (perfil agregado) via DuckDB, nível 3 é amostra de linhas, nunca o arquivo inteiro. Dono: skill [`data`](.claude/skills/data/SKILL.md) |
| `docs/` | mesmo funil, exceções próprias — tabela já fixada acima, não repetir aqui |

⚠️ Um `limit`/`-n` que não bastou não se resolve relendo do zero — aumenta-se mantendo o mesmo ponto de partida.

### Escrever

| Ferramenta | Quando |
|---|---|
| `Edit` | padrão para todo arquivo já versionado, inclusive troca pontual num arquivo grande — nunca reescrever o arquivo inteiro só para mudar uma linha |
| Heredoc | só para conteúdo **novo** de uma vez — arquivo criado do zero, corpo de commit multi-linha — nunca para reintroduzir um trecho apagado de um arquivo existente |
| `sed -i` / `-replace` do PowerShell | renomeação mecânica que atravessa **muitos arquivos** e o `replace_all` do `Edit` não cobre sozinho (opera um arquivo por vez); confirmar com `git status`/`git diff` logo depois, nunca em lote sem checar |
| `>>` (append) | só quando a mudança é **estritamente** o fim do arquivo — nova linha de log, última entrada de uma lista. Qualquer edição no meio do arquivo não é isto |
| `git apply --cached --recount` / patch | para dividir um diff grande em commits menores — nunca apagar um trecho e colar de volta só para separar em dois commits |

⚠️ Reescrever um arquivo tocado na sessão para "deixar mais limpo" não é a mesma operação que corrigir um erro — conteúdo já correto não se regenera do zero.

### Buscar

Aplica o funil arquivo → linha → bloco do princípio no topo do arquivo. Nunca abrir um arquivo inteiro para confirmar o que uma linha de contexto já mostrou.

| Situação | Regra |
|---|---|
| `rg -l` devolve mais de ~15 arquivos | refinar antes de abrir qualquer um: `--type`/`--glob` restringe pasta ou extensão, termo mais específico, ou `-C 3` decide pela linha sem abrir nada |
| Procurando onde um símbolo é **definido** | `rg` sem escapar o `\|`: `export (function|const|class|interface|type) Nome` — o `\|` **não** é alternação no regex do `rg`/`Grep` (Rust), é barra literal, e a busca some silenciosamente. Não confundir com a linha de `pnpm lint` abaixo, que é `grep` de verdade |
| `ctags`, `fd` | nenhum dos dois está instalado nesta máquina (checado 30/08/2026) — o funil de `rg` (arquivo → linha → bloco) e o grep de definição acima são o substituto de fato, não uma alternativa em segundo plano; se instalados depois, `fd` some com o passo de refinar `rg -l --files` por nome de arquivo |
| Import por caminho relativo longo (`../../../../core/...`) | grep pelo **alias** (`@core`, `@shared`, `@renderer`), nunca pela cadeia de pontos — skill [`architecture`](.claude/skills/architecture/SKILL.md) |
| Canal IPC e seus seis pontos de toque | grep pelo **nome do canal** (ex.: `dataset:attach`) em vez de abrir os seis arquivos da lista — skill [`ipc`](.claude/skills/ipc/SKILL.md) |
| Levantamento aberto ("onde X é tratado no app inteiro", "que arquivos usam Y") | `Agent` com `subagent_type: "fork"` quando o resultado intermediário não precisa voltar ao contexto principal — o ruído da busca fica fora do fork, só a síntese retorna |

### Verificar

Saída bruta de `pnpm` é o caso mais comum de contexto desperdiçado: os comandos abaixo já são verbosos por padrão, mesmo quando passam.

| Comando | Filtro |
|---|---|
| `pnpm test` | tocar só o módulo editado — `pnpm exec vitest related <file>` (o mesmo que o hook `test_related` já roda) em vez da suíte inteira; `--reporter=dot` quando a suíte inteira precisa mesmo rodar; em falha, ler o bloco entre `Error:`/`FAIL` e o próximo `PASS`/`FAIL`, não o relatório completo. Nível a rodar e o que não vale mock: skill [`testing`](.claude/skills/testing/SKILL.md) |
| `pnpm test:coverage` | só quando a meta de 85% em `core`/`shared` está em jogo — não rodar para confirmar um teste isolado |
| `pnpm typecheck` | sucesso imprime só o banner de cada script encadeado (`$ tsc --noEmit ...`), sem lista de arquivo — nada a ler além disso; em falha, `grep "error TS"` localiza e conta sem repetir o contexto do compilador |
| `pnpm lint` | `--quiet` restringe a erro e descarta aviso quando o que importa é o portão de commit; senão, `grep -E "error|warning"` na saída antes de decidir abrir algum arquivo — `-E` para não depender de `\|` como alternação (BRE do `grep` aceita, o regex do `rg` não) |
| `pnpm dev` | sempre `run_in_background` — nunca esperar o processo terminar; filtrar só a confirmação de subida (porta, "ready"), não o stream inteiro |
| `pnpm list` / `pnpm why` | escopar ao pacote (`pnpm list <pkg>`, `--depth 0`) — nunca a árvore inteira para confirmar uma versão |
| Qualquer chamada de ferramenta, não só `pnpm` | resultado acima de ~200 linhas não se aceita bruto — rodar de novo mais estreito (mais filtro, termo mais específico) em vez de ler o que voltou |

⚠️ "Passou" não dispensa olhar a saída — mas olhar é **grep no resumo final** (contagem de suites/testes), não rolar o log inteiro atrás de um `FAIL` que o grep já teria achado.

### Mapear

| Situação | Regra |
|---|---|
| "Onde X é usado" | grep pelo nome, mas separar **definição** (um resultado, quase sempre) de **uso** (muitos) — comece pela definição |
| "O que este arquivo importa" | `Read` com `limit` ~30 (ou `head -n 30`) — o bloco de import já responde a camada, sem ler o corpo inteiro |
| Atravessar camada ao mapear | a tabela de importação é lei, não convenção: `shared → core → main/workers/preload → renderer`. Resultado de grep que cruza uma seta proibida (ex.: `renderer` importando de `main`) é violação já pega pelo `no-restricted-imports`, não um caminho legítimo a seguir — skill [`architecture`](.claude/skills/architecture/SKILL.md) |
| Mapear canal IPC | grep pelo nome do canal em `src/shared/ipc.ts`, depois nos seis lugares que a skill lista — nunca abrir os seis para descobrir qual toca o canal — skill [`ipc`](.claude/skills/ipc/SKILL.md) |
| Mapear passo do pipeline de dados | grep pelo nome do passo em `src/core/pipeline/` (`compile.ts` é quem compila para SQL) — skill [`data`](.claude/skills/data/SKILL.md) |

---

## Stack fixada

Estas versões foram escolhidas deliberadamente, não por padrão do template. Os porquês estão em [`docs/study/02-a-stack-e-o-porque.md`](docs/study/02-a-stack-e-o-porque.md).

| Camada | Versão | Observação |
|---|---|---|
| Node (local) | 24.19.0 | Active LTS, suporte até abr/2028 |
| pnpm | 11.18.0 | instalado via Chocolatey |
| Electron | 42.8.0 | embute Chromium 148 e **Node 24.18.0** |
| electron-vite | 5.0.0 | build tool específica para Electron |
| Vite | 7.x | **não subir para 8** — ver abaixo |
| React | 19.2.8 | apenas no renderer |
| Tailwind CSS | ^4.3.3 | sobre `tokens.css`, sem substituí-los — trilha DS, ago/2026 |
| TanStack Query | 5.101.4 | cache de servidor no renderer; estado de cliente segue em Context — ver [`HISTORY.md`](docs/HISTORY.md) |
| TypeScript | 5.9.3 | migração para 6 planejada, ver abaixo |
| electron-builder | 26.x | empacotamento e instaladores |

O que não é pacote npm comum, e a restrição que cada um impõe:

| | Restrição que decide código |
|---|---|
| `node:sqlite` (SQLite 3.53.1) | dentro do binário do Electron, sem pacote. Conversas e config de máquina em `userData/crivo.db`, escada de migração por `PRAGMA user_version` |
| `@duckdb/node-api` | roda em `utilityProcess`, **nunca** no renderer — skill [`data`](.claude/skills/data/SKILL.md) |
| `apache-arrow` | o binding **não** exporta Arrow nativo: monta-se em JS, no worker e no renderer — skill [`ipc`](.claude/skills/ipc/SKILL.md) |
| `resources/duckdb-extensions/excel.duckdb_extension` | binário vendorizado, **travado à versão exata de `@duckdb/node-api` que o gerou**. Um bump não quebra `typecheck` nem teste — só runtime: rerodar `scripts/fetch-duckdb-excel-extension.mjs` faz parte do bump ([`ROADMAP § 2`](docs/ROADMAP.md)) |
| `unpdf` | zero dependências; o `peerDependency` `@napi-rs/canvas` **não entra** |
| **remark** + **remark-gfm** | ESM-only, como toda a família remark — **embutidos** no bundle do `main` por `externalizeDepsPlugin({ exclude })`, porque externalizado um pacote ESM chega como `{ default }` e mata o app ao carregar (DE1D.9). ⚠️ **Usados só para `parse`, nunca para serializar:** o `remark-stringify` escapa o que pareça marcação e troca indentação por `&#x20;`, o que destrói código — `.txt` e `.docx` saem do mesmo `Block[]` de `core/export/`, não de um serializador (DE1E.9, [`ARMADILHAS.md`](docs/ARMADILHAS.md)). `strip-markdown` foi usado no E-1-D e **removido** no E-1-E |
| **docx** (dolanmiu) | o contraexemplo da linha acima, e por isso registrado: publica CJS **e** ESM, e o `dist/index.cjs` **embute as próprias dependências** — inclusive o `nanoid@5`, que é ESM puro. Fica **externo**, sem entrar no `exclude`. Medido, não lido do `package.json` (DE1E.3) |
| **CodeMirror 6** (`state`, `view`, `commands`, `language`, `lang-markdown`, `legacy-modes`, `@lezer/highlight`) | sete entradas de **uma** biblioteca — ela é modular por desenho. Editor do rascunho (E-1-C), com gramática por linguagem desde a E-2-B. Composto à mão, **nunca `basicSetup`**; o tema é só `var(--color-*)`, porque o CSS que ele injeta fica fora do alcance do `guard`. **Custo de bundle, medido no build e não estimado:** `lang-markdown` arrasta `lang-html` (352,8 kB no E-1-C); as ~27 gramáticas de código do `legacy-modes` somaram **+261,75 kB** no E-2-B — mais que o dobro do que a sonda daquele plano previu, e é o número do build que se cita. ⚠️ **Extensão do CodeMirror tem ORDEM: `syntaxHighlighting` aplica a UNIÃO dos highlighters registrados, e um tema posterior sobrescreve o anterior** — dois dialetos no mesmo editor não coexistem |

---

## Comandos

```bash
pnpm dev          # desenvolvimento com HMR
pnpm typecheck    # checa tipos nos três ambientes (node + web + e2e)
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm test         # testes dos níveis 1 a 3
pnpm check:fast   # o portão: tipos + lint + testes rápidos (o que roda antes de cada commit)
pnpm build        # typecheck + build de produção + carga do bundle do main (DE1D.9)
pnpm build:win    # instalador NSIS para Windows
```

`pnpm typecheck` roda **três** projetos TypeScript separados (`tsconfig.node.json`, `tsconfig.web.json` e `tsconfig.e2e.json`) porque main/preload, renderer e os specs de ponta a ponta vivem em ambientes diferentes. Rodar só um dá falsa sensação de segurança.

---
## Ambiente de desenvolvimento

Exclusões do Windows Defender, ajustes do VS Code, ficha da máquina (CPU, RAM livre medida, GPU, versão do Ollama) e o que está pendente: [`docs/reference/ambiente/`](docs/reference/ambiente/README.md). Nada ali decide a primeira linha de um arquivo — por isso não é lido em toda sessão.

⚠️ **A RAM livre desta máquina é uma faixa, não um número** (~8,5 GB só com o terminal · 6,5–7,0 GB com o VS Code aberto), e a variação é da ordem do peso de um modelo da frota. É o motivo de o teto de contexto ser lido em runtime em vez de chumbado. Frota Ollama instalada e custo por modelo: [`docs/reference/models/`](docs/reference/models/README.md); regras de escolha: skill [`ai`](.claude/skills/ai/SKILL.md).

---

## Regras do projeto

### Ao escrever código novo — o que decide a primeira linha

Cada uma, ignorada, produz código estruturalmente errado desde a primeira linha. Aqui fica a regra; o porquê está na skill indicada.

- **Camadas e quem importa quem.** Seis pastas em `src/` (`shared`, `core`, `main`, `workers`, `preload`, `renderer`), com a regra de importação verificada por ESLint. Decida a camada **antes** de criar o arquivo — skill [`architecture`](.claude/skills/architecture/SKILL.md).
- **Todo canal novo nasce em `src/shared/ipc.ts`** e toca seis lugares, na ordem que a skill lista. Não existe `ipcMain.handle` avulso, e o handler é função **exportada**, testável sem subir o Electron — skill [`ipc`](.claude/skills/ipc/SKILL.md).
- **`Result` para falha esperada, exceção para bug.** O que atravessa o IPC e pode falhar retorna união discriminada (`AppError`); payload fora do schema **lança**. Canal sem modo de falha não embrulha — skill `ipc`.
- **Componente só toca token semântico** (`var(--color-*)`): nenhum `#hex` nem `var(--gray-N)` fora de `tokens.css` — skill [`design-system`](.claude/skills/design-system/SKILL.md).
- **O design system é um envelope: define a linguagem visual, não constrói feature.** O que **já existe** ganha a linguagem; o que **ainda não existe** nasce no plano da própria feature, já vestido. Alvo visual não é checklist de feature — skill `design-system`.
- **Cinco níveis de teste**, cada coisa no seu. `core`/`shared` (1), `renderer` (2) e handlers do `main` (3) rodam em `check:fast`; E2E em dev (4) e empacotado (5) ficam fora do ciclo — skill [`testing`](.claude/skills/testing/SKILL.md).
- **Comentário e docstring saem no padrão ao tocar o arquivo.** Duas perguntas em ordem: comentar? (só o que o código não diz — narrativa vai ao `HISTORY.md`, citada pela sigla) e, se for docstring, forma TSDoc. Divide-se ao tocar, não varre a base — skill [`comments`](.claude/skills/comments/SKILL.md).
- **Régua de tamanho** — arquivo que cresce é sintoma. Tabela abaixo.

#### Régua de tamanho

| Tipo | Alvo | Teto |
|---|---|---|
| Módulo de `core/` | 200 | 300 |
| Handler de `main/features/` | 100 | 150 |
| Componente do renderer | 250 | 400 |
| Hook | 80 | 120 |
| `src/main/index.ts` | — | **100, sem exceção** |
| `src/preload/index.ts` | — | **100, sem exceção** |

Contagem = linhas totais do arquivo, comentário e linha em branco inclusos (o que `wc -l` mede) — sem essa definição explícita o teto pode ser violado sem que ninguém note, como aconteceu com o `preload/index.ts` antes de R-3.

As duas últimas linhas são a decisão de manter main e preload finos, tornada mensurável: main que cresce vira lugar de lógica; preload que cresce, lugar de lógica no pior sítio para testá-la. **Divide-se ao tocar** — não varra a base atrás de arquivo grande; divida quando for estendê-lo. E coesão pesa abaixo do teto: componente que orquestra duas features, ou handlers de domínios diferentes no mesmo arquivo, dividem mesmo curtos.

⚠️ **A linha do componente subiu de 150/250 para 250/400 em ago/2026, ao decidir o Tailwind** — e a subida é de **caractere, não de escopo**. Uma `<div>` passa a carregar 8–15 classes, e os componentes que motivaram a subida estourariam o teto antigo sem ganhar uma responsabilidade sequer. Só esta linha muda: hook, `core/`, handler, main e preload não têm JSX. **O que divide continua sendo coesão** — 400 linhas de classe não é o mesmo sinal que 400 linhas de decisão, e a régua perdeu poder de alarme na troca. Motivo em [`HISTORY.md`](docs/HISTORY.md).

### Idioma

Código em inglês, sempre — identificador, comentário, docstring e log, sem exceção de escopo (variável local inclusa) e sem exceção de fonte (nem citado dentro de um `.md` em português). Português fica reservado a texto visível ao usuário, mensagem de erro crua e documentação. Detalhe e armadilha diagnosticada: skill `architecture`.

### Comentários

**O comentário diz o que o código não consegue dizer, em até ~3 linhas** — restrição externa que o próximo leitor violaria sem saber (`capabilities` vem do `/api/show` porque o `/api/tags` omite `vision`), número medido, armadilha diagnosticada. Narrativa do que mudou, alternativa descartada e razão longa **não**: têm dono no [`HISTORY.md`](docs/HISTORY.md), e o fonte aponta pela sigla da decisão (`D15.2`). O doc-comment que sobra sai em **TSDoc** (`/** */`, sumário em terceira pessoa, `@param nome - desc`, `@returns`, sem tipo entre chaves, só tags Core — `@remarks`/`@example` ficam fora porque convidam de volta a narrativa banida). Regra completa, o antes/depois no fonte real e a reconciliação que impede reverter a decisão de ago/2026: skill [`comments`](.claude/skills/comments/SKILL.md).

### Segurança

- Todo acesso a dados passa pelo **preload** via `contextBridge`; o renderer nunca fala com o main direto, e todo canal novo nasce em `src/shared/ipc.ts`.
- **Decisão de segurança que dois processos tomam nasce em `core/`**, nunca ao lado de um dos chamadores — validação colocada junto de um deles vira bypass no segundo ([`HISTORY-archive.md`](docs/HISTORY-archive.md)).
- **Segredo é de mão única:** o renderer grava e consulta se existe, **nunca lê** — `secrets:read` não existe por desenho (`DN1A.3`).
- **O que a IA vê do dado tem três níveis** — esquema · perfil agregado · amostra de linhas —, todos **opt-in por anexo**, em qualquer provedor. A montagem mora em `core/`, com teste que falha se um valor do arquivo vazar nos níveis 1 e 2. Dono: [`docs/ESCOPO.md`](docs/ESCOPO.md).
- **SQL gerado por modelo roda com o motor restringido**, nunca com o texto inspecionado por expressão regular. A garantia é do motor, e a ordem dos `SET` não é livre: skill [`data`](.claude/skills/data/SKILL.md).

Estado da fronteira renderer ↔ main, fixado na [fase 03](docs/plan/implemented/03-sandbox-e-seguranca.md):

| Item | Estado |
|---|---|
| `contextIsolation` | `true`, explícito |
| `nodeIntegration` | `false`, explícito |
| `sandbox` | `true` |
| Superfície do preload | apenas `window.api`, montada a partir de `src/shared/ipc.ts` |
| Abertura de link externo | `checkExternalUrl` em `src/core/url.ts` (lista branca `http:`/`https:`), **único** caminho até `shell.openExternal` — usado pelo canal `shell:openExternal`, pelo `setWindowOpenHandler` e pelo `will-navigate` |
| Navegação e janela nova | negadas por padrão |
| CSP | `default-src 'self'` no `index.html`, com uma abertura nomeada: `img-src` aceita `attachment:` (D17.6). ⚠️ `connect-src` **não** foi aberto — `fetch('attachment://…')` é bloqueado por CORS antes da CSP, porque o esquema não tem o privilégio `corsEnabled` (medido, DF3A.7) |
| Segredos | regra fixada (mão única, `safeStorage`, `userData`) e **em uso desde a trilha N-1** — chaves de provedor de nuvem em `main/features/secrets/`. `secrets:read` não existe por desenho (DN1A.3) |
| `shamefullyHoist` | **desligado** (`false`) — gatilho cumprido no plano `18-A` |

### Arquitetura de dados

- Query pesada **nunca** roda no processo main — trava a UI inteira, incluindo menus e a própria janela. Use `utilityProcess`.
- Resultados grandes viajam como **Arrow IPC**, não como JSON — e o motivo **não** é transferência de posse: o IPC do Electron copia todo binário, sem exceção; todo resultado grande é pago **duas vezes** em memória, momentaneamente. **A vantagem de tempo sobre JSON não é automática** — só quando o formato de origem já chega pronto, o que não é o caso de `@duckdb/node-api` (Arrow é montado em JS, plano 18-B): medido, JSON venceu Arrow em tempo total nas duas escalas testadas, porque a fronteira de processo custa pouco e quem pesa é a montagem em JS — skill [`ipc`](.claude/skills/ipc/SKILL.md).
- O renderer nunca renderiza mais que ~200 linhas de DOM por vez. Use virtualização.

### Dependências

- `pnpm-lock.yaml` é commitado, sempre.
- Toda configuração do pnpm mora em `pnpm-workspace.yaml`. O campo `pnpm` do `package.json` e o `.npmrc` **não são lidos** no pnpm 11 (exceto auth/registry no `.npmrc`).
- Módulo nativo novo exige entrada em `allowBuilds` e um `pnpm dev` de validação antes de seguir.

### Commits

- **Commit nunca leva `Co-authored-by`** mencionando Claude, Anthropic ou qualquer assistente de IA. Autoria é de quem revisa e decide, não de quem redige — e isso é **hook**, não convenção lembrada: [`no_ai_coauthor.mjs`](.claude/hooks/no_ai_coauthor.mjs) bloqueia o comando antes do commit acontecer.
- Os outros quatro, em `.claude/settings.json`: `format_fix` (Prettier + ESLint `--fix`), `guard` (**11 invariantes** que o lint não expressa — dez sobre código, a 11ª sobre link relativo quebrado em `.md`), `test_related` (`vitest related` no arquivo tocado) e um `Stop` que roda `pnpm check:fast`. **Só o que está registrado em `settings.json` roda** — hook que existe como arquivo não é hook ativo.
- ⚠️ **O `command` leva a linha inteira, com caminho absoluto via `$CLAUDE_PROJECT_DIR`.** Não há campo `args` no schema, e caminho relativo deixa de resolver quando o diretório da sessão muda. As duas formas erradas falham com saída 1, que **não bloqueia**: o hook fica inerte e o aviso vira ruído. Ambas já aconteceram aqui ([`ARMADILHAS.md`](docs/ARMADILHAS.md)). **Ao mexer num hook, prove por provocação.**
- ⚠️ **O `guard` só vê escrita por `Edit`/`Write`.** `sed`/`python` via Bash não dispara hook nenhum — para essas, `pnpm exec node scripts/check-doc-links.mjs` verifica caminho e seção citada.

---

## Armadilhas — o conserto rápido

O diagnóstico completo — **107 entradas, da fundação ao arco atual** — é dono de [`docs/ARMADILHAS.md`](docs/ARMADILHAS.md), com as da montagem inicial detalhadas em [`docs/study/04-diario-de-bordo.md`](docs/study/04-diario-de-bordo.md). Aqui fica só o conserto de um toque, para o erro que reaparece ao montar o ambiente:

| Sintoma | Conserto |
|---|---|
| `Error: Electron uninstall` no `pnpm dev` | `pnpm exec install-electron`. O Electron 42 não tem postinstall — o binário baixa no primeiro `require('electron')`, e o electron-vite falha antes ao ler `node_modules/electron/path.txt`. Diagnóstico: `path.txt` existe? |
| Config do pnpm ignorada em silêncio | no pnpm 11 só `pnpm-workspace.yaml` é lido; o campo `pnpm` do `package.json` e o `.npmrc` (fora de auth/registry) são mortos |
| `@types/node` desalinhado | fixar no major que o Electron embute (hoje `^24`); reconferir com `process.versions.node` ao subir de major do Electron |

---

## Decisões pendentes

Moveram-se para [`docs/ROADMAP.md § 3`](docs/ROADMAP.md), que é o dono único de pendência. As versões **em uso** ficam na tabela de stack acima; o que falta subir mora lá — Electron 42→43, Vite 7→8 e TypeScript 5.9→6, cada uma com o motivo de estar parada.

---

## Princípio de trabalho

**Uma variável por vez.** Este projeto tem quatro fontes independentes de incompatibilidade — Electron, bundler, TypeScript e módulos nativos. Quando algo quebra depois de mudar duas coisas, o custo de bissecção é alto. Instale, valide com `pnpm dev`, commite, só então siga.

E o corolário que já se provou verdadeiro aqui: **gerenciador de pacotes entrega reprodutibilidade, não corretude.** O `pnpm install` verde não significa aplicação que abre.
