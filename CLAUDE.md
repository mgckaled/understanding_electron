# data-lab

Aplicação **Electron** para limpeza e transformação de arquivos de dados (CSV, Parquet, Excel, JSON) por meio de um pipeline de passos que compila para SQL do DuckDB. O objetivo declarado do projeto é duplo: entregar essa ferramenta funcionando localmente e servir de veículo de aprendizado do ecossistema Electron com TypeScript.

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
| Fundação: camadas, contrato IPC, testes, tokens — com passos e aceite | [`docs/plan/active/`](docs/plan/active/README.md) |
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

### Idioma

Código em inglês, sempre — identificador, comentário, docstring e log, sem exceção de escopo (variável local inclusa) e sem exceção de fonte (nem citado dentro de um `.md` em português). Português fica reservado a texto visível ao usuário, mensagem de erro crua e documentação. Detalhe e armadilha diagnosticada: skill `architecture`.

### Segurança

- Todo acesso a dados passa pelo **preload** via `contextBridge` — o renderer nunca fala direto com o main
- Tipos do contrato IPC ficam declarados em `src/shared/ipc.ts`, e todo canal novo passa por lá
- Segredo é de mão única: o renderer grava e consulta se existe, **nunca lê** — ver [`docs/HISTORY.md`](docs/HISTORY.md)

Estado da fronteira renderer ↔ main, fixado na [fase 03](docs/plan/implemented/03-sandbox-e-seguranca.md):

| Item | Estado |
|---|---|
| `contextIsolation` | `true`, explícito |
| `nodeIntegration` | `false`, explícito |
| `sandbox` | `true` |
| Superfície do preload | apenas `window.api`, montada a partir de `src/shared/ipc.ts` |
| Abertura de link externo | canal `shell:openExternal`, com lista branca de esquemas |
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
- Os demais hooks já escritos em `.claude/hooks/` (`guard.mjs`, `format_fix.mjs`, `test_related.mjs`) ainda **não estão ligados** — fazem parte da fase [08](docs/plan/active/08-automacao-e-registro.md), ainda não iniciada. Não confundir "hook existe como arquivo" com "hook está ativo": só o que está registrado em `.claude/settings.json` roda.

---

## Armadilhas já diagnosticadas

Registradas para não repetir o trabalho de investigação. Detalhamento em [`docs/study/04-diario-de-bordo.md`](docs/study/04-diario-de-bordo.md).

**1. Configuração do pnpm em lugar morto.**
O template do electron-vite foi feito para pnpm 10 e trazia `"pnpm": { "onlyBuiltDependencies": [...] }` no `package.json` e `shamefully-hoist=true` no `.npmrc`. No pnpm 11 os dois são ignorados silenciosamente. Migrado para `pnpm-workspace.yaml`.

**2. `Error: Electron uninstall` no `pnpm dev`.**
O Electron 42 **não tem script de postinstall** — o binário é baixado preguiçosamente no primeiro `require('electron')`. O electron-vite 5.0.0 lê `node_modules/electron/path.txt` diretamente e falha antes de acionar esse download. Conserto: `pnpm exec install-electron`.
Diagnóstico rápido: `path.txt` existe?

**3. `@types/node` desalinhado.**
O template vinha com `^22`, mas o Electron 42 embute Node 24.18.0. Corrigido para `^24`. Ao subir de major do Electron, reconferir com `process.versions.node`.

---

## Decisões pendentes

Moveram-se para [`docs/ROADMAP.md § 3`](docs/ROADMAP.md), que é o dono único de pendência. As versões **em uso** ficam na tabela de stack acima; o que falta subir mora lá — Electron 42→43, Vite 7→8 e TypeScript 5.9→6, cada uma com o motivo de estar parada.

---

## Princípio de trabalho

**Uma variável por vez.** Este projeto tem quatro fontes independentes de incompatibilidade — Electron, bundler, TypeScript e módulos nativos. Quando algo quebra depois de mudar duas coisas, o custo de bissecção é alto. Instale, valide com `pnpm dev`, commite, só então siga.

E o corolário que já se provou verdadeiro aqui: **gerenciador de pacotes entrega reprodutibilidade, não corretude.** O `pnpm install` verde não significa aplicação que abre.
