# crivo

Aplicação **Electron**: uma ferramenta local multiuso **operada por conversa**, com análise de dados como o pilar mais maduro — abrir CSV, Excel ou JSON (Parquet está no escopo e **ainda não** no seletor — skill [`data`](.claude/skills/data/SKILL.md)), perguntar sobre o arquivo em português, e sair com uma resposta ou com o dado tratado; documento, imagem, código, busca web, documentação (MCP) e raciocínio visível entram pela mesma conversa, cada um como pilar próprio (critério em [`ESCOPO.md`](docs/ESCOPO.md)). O motor de dados é o DuckDB; o tratamento vive num pipeline de passos que compila para SQL. O objetivo declarado do projeto é duplo: entregar essa ferramenta funcionando localmente e servir de veículo de aprendizado do ecossistema Electron com TypeScript.

---

## ⚠️ Registro de trabalho — leia antes de começar

**Toda sessão de trabalho termina registrando o que foi feito.** Não é burocracia: é a diferença entre um projeto que acumula contexto e um que o perde. Dois registros, com vidas diferentes:

| | Onde | Unidade | Quando |
|---|---|---|---|
| **Diário de execução** | tabela no fim do plano em `docs/plan/active/` | uma sessão | antes de encerrar **toda** sessão |
| **Entrada de histórico** | [`docs/HISTORY.md`](docs/HISTORY.md) | um marco concluído | ao mover um plano para `implemented/` — **ou ao terminar um trabalho que mudou o projeto sem ter plano** (revisão de escopo, manutenção de documentação) |

**Escalonamento — a regra que faz o sistema funcionar:** observação do diário que valha **além daquele plano** sobe para o `HISTORY.md` **na mesma sessão** (ou para o [`ARMADILHAS.md`](docs/ARMADILHAS.md), se for erro diagnosticado). O teste é *"isto vai custar tempo de novo?"* — armadilha diagnosticada, alternativa tentada e descartada, número medido: sobe. "Terminei o passo 3": morre com o plano.

**Auto-conservação — o mesmo cuidado, voltado para fora do plano.** Ao encerrar um plano ou uma tarefa pontual, **três** tipos de deriva, tratados diferente porque cada um falha de um jeito:

- **(a) nome ou caminho que mudou** — ao renomear/mover algo, `grep` o nome antigo em `.claude/skills/` e `docs/` **antes** de commitar; se aparecer, é referência a atualizar junto, não depois.
- **(b) contagem que envelheceu** (canais IPC, número de teste, linhas de skill) — não é greppável por natureza, então remedir é o próprio ato de conservar: nunca copiar um número de um documento para outro sem reconferir a fonte (código, `pnpm test`) na hora.
- **(c) documento que estourou o teto** — ao escrever a 11ª entrada de marco em `HISTORY.md`, a mais antiga desce para o `HISTORY-archive.md` na mesma edição. Teto por arquivo e o que fazer quando estoura: [`docs/README.md`](docs/README.md#régua-de-tamanho-de-documento). Documento que cresce sem teto não avisa — ele cobra em tokens de leitura, na sessão de outra pessoa.

Se a mudança tocou um fato citável em mais de um lugar e nenhuma das três se aplicou, o próximo a ler paga sem saber que está pagando. É o motivo declarado da trilha R-2 (ver `HISTORY.md`), e o objetivo é não precisar de uma R-3.

Regra completa e formato em [`docs/README.md`](docs/README.md#os-dois-registros-e-por-que-são-dois).

---

## Organização da documentação

```text
docs/
├── README.md        # mapa, ciclo de vida do plano, convenção de fonte única
├── ESCOPO.md        # o que o app faz e não faz
├── HISTORY.md       # os 10 marcos mais recentes + decisões arquiteturais
├── HISTORY-archive.md  # marcos além dos 10 — fila, só leitura
├── ARMADILHAS.md    # erro diagnosticado, buscável por sintoma
├── DECISOES.md      # índice tabular das decisões dentro de cada plano — derivado
├── ROADMAP.md       # o que ainda falta
├── study/           # cadernos didáticos
├── reference/       # consulta técnica estável
└── plan/{active,implemented,archive}/
```

Ciclo de um plano: nasce em `active/` → cada sessão acrescenta uma linha ao diário dele → ao concluir, **move** para `implemented/` e ganha uma entrada em `HISTORY.md`. Plano abandonado vai para `archive/` **com o motivo** registrado no histórico.

### Protocolo de leitura da documentação

**Nenhum arquivo de `docs/` se lê na íntegra.** A pasta inteira soma **~1,8 MB / ~540k tokens** (94 arquivos) — os sete arquivos soltos são só ~113k dela, e `plan/implemented/` sozinho é mais que o dobro disso. Ler dois arquivos inteiros já é mais contexto do que a maior parte das sessões precisa, e o custo aparece como autocompactação, que apaga o trabalho da própria sessão. A regra é mecânica, não uma sugestão de bom senso:

| Arquivo | ~tokens | Como consultar |
|---|---|---|
| `ARMADILHAS.md` | ~27k | `Grep` no **sintoma** — símbolo, API, mensagem de erro. **Nunca** `Read` |
| `HISTORY-archive.md` | ~28k | `Grep` no nome do plano/fase. **Nunca** `Read` |
| `HISTORY.md` | ~18k | `Grep` no assunto; ou `Read` com `offset`/`limit` na seção achada |
| `ESCOPO.md` | ~12k | `Grep` no pilar ou na operação |
| `ROADMAP.md` | ~14k | `Grep` no item; `§ 2` e `§ 3` têm `offset` estável |
| `DECISOES.md` | ~11k | `Grep` na sigla `D<n>.<n>` — é tabela, uma linha responde |
| `README.md` | ~4k | único que cabe inteiro |
| **`plan/implemented/`** (54 arq.) | **~300k** | `Grep` no nome do plano, na sigla `D<n>.<n>` ou no símbolo. **Nunca** `Read` — nem "só para ver o diário". É a maior pasta do repositório e a de consulta mais rara |
| `reference/` (19 arq.) | ~56k | `Grep` no assunto; três documentos ali estão marcados `⛔ consumido` |
| `study/` (12 arq.) | ~42k | `Grep` no conceito; `Read` com `offset` na seção achada |
| `plan/active/` (2 arq.) | ~7k | o plano **em execução** se lê inteiro; os demais, `Grep` |

⚠️ **Estes números envelhecem — remeça antes de citá-los em outro lugar.** Foram remedidos em 27/08/2026; a ordem de grandeza é o que importa aqui, não o dígito. ⚠️ **Dois tetos estão estourados** (`ARMADILHAS.md`, este arquivo) — registrado com o conserto no [`ROADMAP § 2`](docs/ROADMAP.md).

**Como fazer certo, em ordem:** (1) `Grep -n` pelo termo → devolve linha e arquivo; (2) `Read` com `offset` = linha achada menos 5, `limit` 40–60; (3) se a seção continuar além, estenda o `limit`, não releia do zero. Um `Grep` com `-C 3` resolve a maioria das perguntas **sem nenhum `Read`**.

**As três exceções que se leem inteiras:** este `CLAUDE.md`, `docs/README.md` e o plano ativo em que se está trabalhando. Mais nada.

⚠️ **Plano em `implemented/` é o caso que mais engana.** Ele parece a fonte completa — e é, mas de um trabalho já terminado. O que dele ainda vale já subiu para `HISTORY.md`, `ARMADILHAS.md` ou `DECISOES.md`; abrir o plano inteiro paga **~20 KB de média** (o `15` custa 86 KB) para reler o que o dono já responde numa linha.

⚠️ **Isto vale também para você mesmo daqui a vinte turnos.** A tentação aparece como *"agora preciso do contexto completo"* — não precisa: a pergunta que motivou a leitura tem um termo, e o termo é grepável. Se realmente não houver termo, a pergunta ainda não está formada.

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
| IA local e de nuvem, ML, RAG | [`docs/plan/active/09-camada-de-ia.md`](docs/plan/active/09-camada-de-ia.md) |
| Frota Ollama instalada, peso/cache KV por faixa de contexto, ficha técnica dos modelos de nuvem opt-in, elegíveis, inviáveis, descartados | [`docs/reference/models/`](docs/reference/models/README.md) — **inclusive a frota instalada**, desde ago/2026 |
| Decisões, alternativas descartadas, marcos entregues | [`docs/HISTORY.md`](docs/HISTORY.md) (10 mais recentes) + [`HISTORY-archive.md`](docs/HISTORY-archive.md) |
| Armadilha diagnosticada — erro que já custou tempo uma vez | [`docs/ARMADILHAS.md`](docs/ARMADILHAS.md) — busca **por sintoma**, não por data |
| Índice tabular por decisão individual (trilha, sigla, título — sem narrativa) | [`docs/DECISOES.md`](docs/DECISOES.md) |
| Pendências e gatilhos de revisão | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Fundamentos do Electron, anatomia, medições | [`docs/study/`](docs/study/README.md) |

Este arquivo registra o que **não** se deduz do código nem cabe nos donos acima: stack fixada, regras invioláveis e ambiente de desenvolvimento.

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
| **CodeMirror 6** (`state`, `view`, `commands`, `language`, `lang-markdown`, `@lezer/highlight`) | seis entradas de **uma** biblioteca — ela é modular por desenho. Editor do rascunho (E-1-C). Composto à mão, **nunca `basicSetup`**; o tema é só `var(--color-*)`, porque o CSS que ele injeta fica fora do alcance do `guard`. `lang-markdown` arrasta `lang-html`: **352,8 kB** de bundle só pelo destaque de sintaxe, medido |

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

### O que está versionado

`.vscode/settings.json` exclui `node_modules`, `out` e `dist` do observador de arquivos — com pnpm, o `.pnpm` tem dezenas de milhares de entradas, e o padrão do VS Code só exclui o primeiro nível. Também fixa `typescript.tsdk` no TypeScript do projeto, para o editor não divergir do `pnpm typecheck`.

⚠️ **Consequência operacional:** com `node_modules` fora do watcher, o editor não percebe pacote novo sozinho. Depois de `pnpm add`, rode `Ctrl+Shift+P → Developer: Reload Window`. Sintoma quando esquecer: import válido marcado como não resolvido.

`.vscode/extensions.json` recomenda ESLint, Prettier e EditorConfig, e marca as extensões de Python como indesejadas.

### O que **não** está versionado (registrado aqui porque não deixa rastro)

**Exclusões do Windows Defender**, aplicadas em 3 de agosto de 2026 na máquina de desenvolvimento:

```powershell
Add-MpPreference -ExclusionPath "C:\rocketseat\projetos"
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\pnpm"
Add-MpPreference -ExclusionProcess "node.exe"
```

*Motivo:* o antivírus escaneia em tempo real cada arquivo lido. `pnpm install`, indexação do TypeScript e build do Vite leem dezenas de milhares de arquivos pequenos — no Windows, isso costuma responder pela maior parte da lentidão percebida.

*Custo assumido:* proteção em tempo real reduzida nesses caminhos. O raciocínio é que o conteúdo é controlado e o `minimumReleaseAge` do pnpm 11 já filtra pacote recém-publicado. **É uma troca, não um ajuste gratuito.**

*Para reverter:* `Remove-MpPreference -ExclusionPath "..."` com os mesmos caminhos.

*Ao trocar de máquina:* precisa ser refeito, e os caminhos provavelmente mudam.

**Máquina e modelos locais** — registrado aqui porque **decide escolhas do aplicativo** e não deixa rastro no repositório (medido em ago/2026):

| | |
|---|---|
| CPU | Intel i5-8265U — 4 núcleos / 8 threads |
| RAM | 16 GB. **Não há um número de "livre" — há três**, medidos em 10/08/2026: **~9 GB** com só o app Electron rodando · **~7,5 GB** com só o VS Code · **~6 GB** no ambiente de trabalho típico (VS Code, Edge, WhatsApp, Claude Code). A variação de 3 GB é maior que o peso da maioria dos modelos da frota, e é por isso que o teto de contexto se lê em runtime em vez de ser chumbado — ver [`plan/implemented/15`](docs/plan/implemented/15-orcamento-de-contexto-e-modelo.md) § D15.2 |
| GPU | NVIDIA MX150, 2 GB VRAM, CUDA configurado (herança do mill.tools, que a reserva para o Whisper) — mas o app roda **CPU-only por decisão testada, não por ausência de hardware**: `num_gpu` forçado no `gemma3:1b` foi medido e descartado para geração, penalidade já presente em contexto comum (não só extremo), sem estouro de VRAM — números e protocolo em [`docs/reference/models/ollama-models-gpu-analysis.md`](docs/reference/models/ollama-models-gpu-analysis.md) |
| Ollama | 0.32.14 (atualizado fora do app, 18/08/2026 — era 0.32.6), servindo de `C:\ollama-models` (`OLLAMA_MODELS` do `ollama serve`; o app é agnóstico ao caminho) |

**Frota Ollama: 8 modelos distintos** (13 entradas no `/api/tags`, 5 delas variantes `-custom`). O que decide escolha, em uma linha cada: `gemma3:4b` é o **default** e o único com visão · `gemma3:1b` é o fallback de baixa RAM · `qwen2.5-coder:3b` é o candidato a default do NL→SQL (único que junta código e folga de RAM) · `qwen3:4b` é o único com `thinking`, e o cache mais caro da frota.

📖 **Tabela completa** — peso, teto treinado, KV/token, `capabilities`, papel, desinstalados e o porquê de o teto de contexto ser da máquina: [`docs/reference/models/README.md`](docs/reference/models/README.md#frota-instalada). O dono mudou de lugar em ago/2026 justamente porque este arquivo é lido em **toda** sessão, inclusive nas que não tocam IA. **Ao instalar ou remover um modelo, é lá que se atualiza.**

⚠️ **Ao sondar o Ollama, um modelo residente por vez.** `keep_alive` de no máximo 1, e descarregar explicitamente com `keep_alive: 0` entre medidas — o default é 5 minutos, então modelos se acumulam em silêncio ao longo de sondas sucessivas, e dois residentes nesta máquina é *swap*. `ollama ps` vazio antes de começar e ao terminar. `/api/tags` e `/api/show` são metadados e **não** carregam nada, então catálogo é sempre seguro; o que exige o protocolo é inferência.

⚠️ **`capabilities` vem do `/api/show`, nunca do `/api/tags`** — o `/api/tags` traz o campo e omite `vision`. Carregar o `gemma3:4b` do disco frio custa **~50 s**, o preço real de trocar de modelo.

**Ao trocar de máquina, refazer a medição** antes de reaproveitar qualquer decisão que dependa destes números (default de `num_thread`, modelo padrão, recusa de *tool calling*).

### Pendente

**Perfil do VS Code.** A extensão do Python continua ativa e carregando neste workspace; `python.analysis.exclude` silencia os avisos do node-gyp, mas não impede o carregamento. Um perfil (`File → Preferences → Profiles`) contendo só ESLint, Prettier e EditorConfig resolveria de verdade. Note que perfil é configuração de máquina — não viaja no repositório.

---

## Regras do projeto

### Ao escrever código novo — o que decide a primeira linha

Cada uma, ignorada, produz código estruturalmente errado desde a primeira linha. Aqui fica o essencial e o ponteiro; o porquê está na skill indicada.

- **Camadas e quem importa quem.** Seis pastas em `src/` (`shared`, `core`, `main`, `workers`, `preload`, `renderer`), com a regra de importação verificada por ESLint. Decida a camada antes de criar o arquivo — skill [`architecture`](.claude/skills/architecture/SKILL.md).
- **Todo canal novo nasce em `src/shared/ipc.ts`** e toca seis lugares, na ordem que a skill lista; é registrado pelo `handle()` genérico de `src/main/ipc/`, e não existe `ipcMain.handle` avulso. O handler é função exportada, testável sem subir o Electron — skill [`ipc`](.claude/skills/ipc/SKILL.md).
- **`Result` para falha esperada, exceção para bug.** O que atravessa o IPC e pode falhar retorna união discriminada (`AppError`); payload fora do schema **lança**. Canal que não tem como falhar não embrulha — skill `ipc`.
- **Componente só toca token semântico** (`var(--color-*)`): nenhum `#hex` nem `var(--gray-N)` fora de `tokens.css` — skill [`design-system`](.claude/skills/design-system/SKILL.md).
- **O design system é um envelope: define a linguagem visual, não constrói feature.** Diante de um alvo visual, o que **já existe** ganha a linguagem (é da trilha DS); o que **ainda não existe** nasce depois, no plano da própria feature, já vestido. Alvo não é checklist de feature — ler a régua antes de tratar uma ausência como pendência, skill `design-system`.
- **Cinco níveis de teste**, cada coisa no seu. `core`/`shared` (1), `renderer` (2) e handlers do `main` (3) rodam em `check:fast` e no hook de edição; E2E em dev (4) e empacotado (5) ficam fora do ciclo — skill [`testing`](.claude/skills/testing/SKILL.md).
- **Todo comentário e docstring sai no padrão ao tocar o arquivo.** Duas perguntas em ordem — comentar? (só o que o código não diz; narrativa de decisão vai ao `HISTORY.md` citada por id, não ao `.ts`) e, se for docstring, forma TSDoc (`@param nome - desc`, `@returns`, sem tipo entre chaves, só tags Core). Divide-se ao tocar, não varre a base — skill [`comments`](.claude/skills/comments/SKILL.md).
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

- Todo acesso a dados passa pelo **preload** via `contextBridge` — o renderer nunca fala direto com o main
- Tipos do contrato IPC ficam declarados em `src/shared/ipc.ts`, e todo canal novo passa por lá
- Decisão de segurança que dois processos precisam tomar nasce em `core/`, nunca ao lado de um dos chamadores — validação colocada junto de um deles vira bypass no segundo, ver [`docs/HISTORY.md`](docs/HISTORY.md)
- Segredo é de mão única: o renderer grava e consulta se existe, **nunca lê** — ver [`docs/HISTORY.md`](docs/HISTORY.md)
- O que a IA vê do dado tem **três níveis** — esquema · perfil agregado · amostra de linhas. Os três são **opt-in por anexo**, em qualquer provedor (local ou nuvem) — nível 3 não tem bloqueio a mais na nuvem desde a revisão de escopo (5ª, ago/2026): o usuário decide caso a caso o que anexa. A montagem do contexto mora em `core/`, com teste que falha se um valor do arquivo vazar nos níveis 1 e 2. Dono: [`docs/ESCOPO.md`](docs/ESCOPO.md)
- SQL gerado por modelo roda com o **motor restringido** (`allowed_directories`, `enable_external_access = false`, `lock_configuration = true`), nunca com o texto inspecionado por expressão regular — ver [`docs/HISTORY.md`](docs/HISTORY.md)

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

- Commit nunca leva `Co-authored-by` mencionando Claude, Anthropic ou qualquer assistente de IA. Autoria é de quem revisa e decide, não de quem redige o texto.
- Isto é aplicado por hook, não por convenção lembrada em cada sessão: [`.claude/hooks/no_ai_coauthor.mjs`](.claude/hooks/no_ai_coauthor.mjs), registrado como `PreToolUse` em `.claude/settings.json` para `Bash` e `PowerShell`. Bloqueia (saída 2) qualquer comando cujo texto contenha esse trailer, antes do commit acontecer.
- Além do `no_ai_coauthor`, o `.claude/settings.json` liga três hooks `PostToolUse` (`Edit|Write`) — `format_fix` (Prettier + ESLint `--fix`), `guard` (**11 invariantes** que o lint não expressa, bloqueia com saída 2 — dez sobre código, e a 11ª sobre `.md`: link relativo cujo alvo não existe, a única verificação automática que a documentação tem) e `test_related` (`vitest related` no arquivo tocado) — e um `Stop` que roda `pnpm check:fast`. O princípio segue de pé: só o que está registrado em `.claude/settings.json` roda; hook que existe como arquivo não é hook ativo.
- ⚠️ **O `command` de um hook leva a linha inteira, com caminho absoluto via `$CLAUDE_PROJECT_DIR`.** Não existe campo `args` no schema, e caminho relativo deixa de resolver assim que o diretório da sessão muda. As duas formas erradas falham com saída 1, que **não bloqueia** — o hook fica inerte e o aviso vira ruído. Ambas já aconteceram aqui: [`ARMADILHAS.md`](docs/ARMADILHAS.md). **Ao mexer num hook, prove por provocação** — dispare a violação e confirme que ele recusa.

---

## Armadilhas — o conserto rápido

O diagnóstico completo — **92 entradas, da fundação ao arco atual** — é dono de [`docs/ARMADILHAS.md`](docs/ARMADILHAS.md), com as da montagem inicial detalhadas em [`docs/study/04-diario-de-bordo.md`](docs/study/04-diario-de-bordo.md). Aqui fica só o conserto de um toque, para o erro que reaparece ao montar o ambiente:

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
