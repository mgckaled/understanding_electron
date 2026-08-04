# data-lab

Aplicação **Electron** de análise de dados. O objetivo declarado do projeto é duplo: entregar uma ferramenta de análise que funcione localmente e servir de veículo de aprendizado do ecossistema Electron com TypeScript.

Documentação didática em [`docs/study/`](docs/study/README.md).

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

### Segurança

- `contextIsolation` fica em `true` (padrão do Electron, não mexer)
- Todo acesso a dados passa pelo **preload** via `contextBridge` — o renderer nunca fala direto com o main
- Tipos do contrato IPC ficam declarados em `src/preload/index.d.ts`
- **Pendência conhecida:** `src/main/index.ts` está com `sandbox: false`. É o padrão do template, não uma decisão nossa. Revisitar antes de qualquer build de produção.

### Arquitetura de dados

- Query pesada **nunca** roda no processo main — trava a UI inteira, incluindo menus e a própria janela. Use `utilityProcess`.
- Resultados grandes viajam como **Arrow IPC** (`ArrayBuffer` transferível), não como JSON.
- O renderer nunca renderiza mais que ~200 linhas de DOM por vez. Use virtualização.

### Dependências

- `pnpm-lock.yaml` é commitado, sempre.
- Toda configuração do pnpm mora em `pnpm-workspace.yaml`. O campo `pnpm` do `package.json` e o `.npmrc` **não são lidos** no pnpm 11 (exceto auth/registry no `.npmrc`).
- Módulo nativo novo exige entrada em `allowBuilds` e um `pnpm dev` de validação antes de seguir.

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

**Vite 7 → 8.** O Vite 8 (com bundler Rolldown, em Rust) é estável desde mar/2026, mas o electron-vite 5.0.0 é da mesma época e não declara suporte. Ficamos no 7 conscientemente. Se for migrar, o `vite-plugin-electron` declara suporte a 7 e 8 e é o plano B.

**TypeScript 5.9 → 6.** O TS 6 é release de transição com remoções reais: `moduleResolution: "node"`, `baseUrl`, target ES5, módulos `amd`/`umd`/`systemjs`. Um ponto de quebra já mapeado: `baseUrl: "."` em `tsconfig.web.json` (o campo `paths` funciona sem ele desde o TS 4.1). Fazer como exercício isolado, com `tsc --ts6-migration` gerando o relatório.

**Electron 42 → 43.** O Electron 43 já saiu. A política é manter as 3 majors mais recentes suportadas, então o 42 segue coberto — mas o ciclo é de 8 semanas e o bump precisa ser tarefa agendada, não reativa. É o Chromium embutido que carrega as CVEs.

---

## Princípio de trabalho

**Uma variável por vez.** Este projeto tem quatro fontes independentes de incompatibilidade — Electron, bundler, TypeScript e módulos nativos. Quando algo quebra depois de mudar duas coisas, o custo de bissecção é alto. Instale, valide com `pnpm dev`, commite, só então siga.

E o corolário que já se provou verdadeiro aqui: **gerenciador de pacotes entrega reprodutibilidade, não corretude.** O `pnpm install` verde não significa aplicação que abre.
