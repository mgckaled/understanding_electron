# data-lab

Aplicação **Electron**: uma bancada local de dados **operada por conversa** — abrir CSV, Parquet, Excel ou JSON, perguntar sobre o arquivo em português, e sair com uma resposta ou com o dado tratado. O motor é o DuckDB; o tratamento vive num pipeline de passos que compila para SQL. O objetivo declarado do projeto é duplo: entregar essa ferramenta funcionando localmente e servir de veículo de aprendizado do ecossistema Electron com TypeScript.

---

## ⚠️ Registro de trabalho — leia antes de começar

**Toda sessão de trabalho termina registrando o que foi feito.** Não é burocracia: é a diferença entre um projeto que acumula contexto e um que o perde. Dois registros, com vidas diferentes:

| | Onde | Unidade | Quando |
|---|---|---|---|
| **Diário de execução** | tabela no fim do plano em `docs/plan/active/` | uma sessão | antes de encerrar **toda** sessão |
| **Entrada de histórico** | [`docs/HISTORY.md`](docs/HISTORY.md) | um marco concluído | ao mover um plano para `implemented/` |

**Escalonamento — a regra que faz o sistema funcionar:** observação do diário que valha **além daquele plano** sobe para o `HISTORY.md` **na mesma sessão**. O teste é *"isto vai custar tempo de novo?"* — armadilha diagnosticada, alternativa tentada e descartada, número medido: sobe. "Terminei o passo 3": morre com o plano.

Regra completa e formato em [`docs/README.md`](docs/README.md#os-dois-registros-e-por-que-são-dois).

---

## Organização da documentação

```text
docs/
├── README.md        # mapa, ciclo de vida do plano, convenção de fonte única
├── ESCOPO.md        # o que o app faz e não faz
├── HISTORY.md       # decisões e entregas (cronológico inverso)
├── ROADMAP.md       # o que ainda falta
├── study/           # cadernos didáticos
├── reference/       # consulta técnica estável
└── plan/{active,implemented,archive}/
```

Ciclo de um plano: nasce em `active/` → cada sessão acrescenta uma linha ao diário dele → ao concluir, **move** para `implemented/` e ganha uma entrada em `HISTORY.md`. Plano abandonado vai para `archive/` **com o motivo** registrado no histórico.

### Fonte única por assunto

Cada assunto tem **um** dono. Os demais apontam — nunca duplicam. Fato duplicado é dívida: o segundo lugar envelhece calado.

| Assunto | Dono |
|---|---|
| O que o app faz e não faz, catálogo de operações, formatos, escala | [`docs/ESCOPO.md`](docs/ESCOPO.md) |
| Camadas, regra de importação, contrato IPC, sandbox, régua de tamanho | skill [`architecture`](.claude/skills/architecture/SKILL.md) |
| Tokens, primitivos, `ViewState`, convenções de desktop | skill [`design-system`](.claude/skills/design-system/SKILL.md) |
| Níveis de teste, mocks, o que não testar | skill [`testing`](.claude/skills/testing/SKILL.md) |
| Camada de dados (DuckDB, `utilityProcess`, Arrow) | [`docs/study/05-proximos-passos.md`](docs/study/05-proximos-passos.md) |
| IA local e de nuvem, ML, RAG | [`docs/plan/active/09-camada-de-ia.md`](docs/plan/active/09-camada-de-ia.md) |
| Decisões, alternativas descartadas, armadilhas | [`docs/HISTORY.md`](docs/HISTORY.md) |
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
| TypeScript | 5.9.3 | migração para 6 planejada, ver abaixo |
| electron-builder | 26.x | empacotamento e instaladores |

### Camada de dados (planejada, ainda não instalada)

- `@duckdb/node-api` — DuckDB via N-API, roda em `utilityProcess`, **nunca** no renderer
- `apache-arrow` — transporte de resultados main → renderer sem serializar para JSON

---

## Comandos

```bash
pnpm dev          # desenvolvimento com HMR
pnpm typecheck    # checa tipos nos dois ambientes (node + web)
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm build        # typecheck + build de produção
pnpm build:win    # instalador NSIS para Windows
```

`pnpm typecheck` roda **dois** projetos TypeScript separados (`tsconfig.node.json` e `tsconfig.web.json`) porque main/preload e renderer vivem em ambientes diferentes. Rodar só um dá falsa sensação de segurança.

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

### Pendente

**Perfil do VS Code.** A extensão do Python continua ativa e carregando neste workspace; `python.analysis.exclude` silencia os avisos do node-gyp, mas não impede o carregamento. Um perfil (`File → Preferences → Profiles`) contendo só ESLint, Prettier e EditorConfig resolveria de verdade. Note que perfil é configuração de máquina — não viaja no repositório.

---

## Regras do projeto

### Ao escrever código novo — o que decide a primeira linha

Cada uma, ignorada, produz código estruturalmente errado desde a primeira linha. Aqui fica o essencial e o ponteiro; o porquê está na skill indicada.

- **Camadas e quem importa quem.** Seis pastas em `src/` (`shared`, `core`, `main`, `workers`, `preload`, `renderer`), com a regra de importação verificada por ESLint. Decida a camada antes de criar o arquivo — skill [`architecture`](.claude/skills/architecture/SKILL.md).
- **Todo canal novo nasce em `src/shared/ipc.ts`** e é registrado pelo `handle()` genérico de `src/main/ipc/`; não existe `ipcMain.handle` avulso. O handler é função exportada, testável sem subir o Electron — skill `architecture`.
- **`Result` para falha esperada, exceção para bug.** O que atravessa o IPC e pode falhar retorna união discriminada (`AppError`); payload fora do schema **lança** — skill `architecture`.
- **Componente só toca token semântico** (`var(--color-*)`): nenhum `#hex` nem `var(--gray-N)` fora de `tokens.css` — skill [`design-system`](.claude/skills/design-system/SKILL.md).
- **Cinco níveis de teste**, cada coisa no seu. `core`/`shared` (1), `renderer` (2) e handlers do `main` (3) rodam em `check:fast` e no hook de edição; E2E em dev (4) e empacotado (5) ficam fora do ciclo — skill [`testing`](.claude/skills/testing/SKILL.md).
- **Régua de tamanho** — arquivo que cresce é sintoma. Tabela abaixo.

#### Régua de tamanho

| Tipo | Alvo | Teto |
|---|---|---|
| Módulo de `core/` | 200 | 300 |
| Handler de `main/features/` | 100 | 150 |
| Componente do renderer | 150 | 250 |
| Hook | 80 | 120 |
| `src/main/index.ts` | — | **100, sem exceção** |
| `src/preload/index.ts` | — | **60, sem exceção** |

As duas últimas linhas são a decisão de manter main e preload finos, tornada mensurável: main que cresce vira lugar de lógica; preload que cresce, lugar de lógica no pior sítio para testá-la. **Divide-se ao tocar** — não varra a base atrás de arquivo grande; divida quando for estendê-lo. E coesão pesa abaixo do teto: componente que orquestra duas features, ou handlers de domínios diferentes no mesmo arquivo, dividem mesmo curtos.

### Idioma

Código em inglês, sempre — identificador, comentário, docstring e log, sem exceção de escopo (variável local inclusa) e sem exceção de fonte (nem citado dentro de um `.md` em português). Português fica reservado a texto visível ao usuário, mensagem de erro crua e documentação. Detalhe e armadilha diagnosticada: skill `architecture`.

### Segurança

- Todo acesso a dados passa pelo **preload** via `contextBridge` — o renderer nunca fala direto com o main
- Tipos do contrato IPC ficam declarados em `src/shared/ipc.ts`, e todo canal novo passa por lá
- Decisão de segurança que dois processos precisam tomar nasce em `core/`, nunca ao lado de um dos chamadores — validação colocada junto de um deles vira bypass no segundo, ver [`docs/HISTORY.md`](docs/HISTORY.md)
- Segredo é de mão única: o renderer grava e consulta se existe, **nunca lê** — ver [`docs/HISTORY.md`](docs/HISTORY.md)
- O que a IA vê do dado tem **três níveis** — esquema · perfil agregado · amostra de linhas. Os níveis 1 e 2 são livres; o nível 3 é opt-in por anexo e **bloqueado na nuvem**. A montagem do contexto mora em `core/`, com teste que falha se um valor do arquivo vazar nos níveis 1 e 2. Dono: [`docs/ESCOPO.md`](docs/ESCOPO.md)
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
| CSP | `default-src 'self'` no `index.html` |
| Segredos | regra fixada (mão única, `safeStorage`, `userData`); **nenhum segredo existe ainda** |
| `shamefullyHoist` | **pendente** — gatilho de revisão: instalação do DuckDB |

### Arquitetura de dados

- Query pesada **nunca** roda no processo main — trava a UI inteira, incluindo menus e a própria janela. Use `utilityProcess`.
- Resultados grandes viajam como **Arrow IPC** (`ArrayBuffer` transferível), não como JSON.
- O renderer nunca renderiza mais que ~200 linhas de DOM por vez. Use virtualização.

### Dependências

- `pnpm-lock.yaml` é commitado, sempre.
- Toda configuração do pnpm mora em `pnpm-workspace.yaml`. O campo `pnpm` do `package.json` e o `.npmrc` **não são lidos** no pnpm 11 (exceto auth/registry no `.npmrc`).
- Módulo nativo novo exige entrada em `allowBuilds` e um `pnpm dev` de validação antes de seguir.

### Commits

- Commit nunca leva `Co-authored-by` mencionando Claude, Anthropic ou qualquer assistente de IA. Autoria é de quem revisa e decide, não de quem redige o texto.
- Isto é aplicado por hook, não por convenção lembrada em cada sessão: [`.claude/hooks/no_ai_coauthor.mjs`](.claude/hooks/no_ai_coauthor.mjs), registrado como `PreToolUse` em `.claude/settings.json` para `Bash` e `PowerShell`. Bloqueia (saída 2) qualquer comando cujo texto contenha esse trailer, antes do commit acontecer.
- Além do `no_ai_coauthor`, o `.claude/settings.json` liga três hooks `PostToolUse` (`Edit|Write`) — `format_fix` (Prettier + ESLint `--fix`), `guard` (invariantes que o lint não expressa, bloqueia com saída 2) e `test_related` (`vitest related` no arquivo tocado) — e um `Stop` que roda `pnpm check:fast`. O princípio segue de pé: só o que está registrado em `.claude/settings.json` roda; hook que existe como arquivo não é hook ativo.

---

## Armadilhas — o conserto rápido

O diagnóstico completo, com o que as fases 03–07 descobriram, é dono de [`docs/HISTORY.md`](docs/HISTORY.md) § Armadilhas e de [`docs/study/04-diario-de-bordo.md`](docs/study/04-diario-de-bordo.md). Aqui fica só o conserto de um toque, para o erro que reaparece ao montar o ambiente:

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
