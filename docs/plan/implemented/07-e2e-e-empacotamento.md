# 07 — E2E e empacotamento

**Depende de:** [06](06-primeira-feature.md) · **Entrega:** níveis 4 e 5 da pirâmide, `asarUnpack` conferido, instalador validado

---

## Por que esta fase existe

Existe uma classe de defeito que nenhum dos três níveis anteriores alcança, e ela tem uma assinatura reconhecível:

> Funciona perfeitamente no `pnpm dev`. Quebra no instalador.

A causa é sempre a mesma família: caminho que era relativo à raiz do projeto e passa a estar dentro de um arquivo `asar`; binário nativo que não foi desempacotado; recurso que o `files` do `electron-builder` excluiu; entrypoint de `utilityProcess` que o bundler não emitiu porque ninguém o importou estaticamente.

Nada disso é lógica. É **onde os arquivos foram parar**, e por isso só um app empacotado de verdade revela.

O [`05-proximos-passos.md`](../../study/05-proximos-passos.md) já antecipa o caso específico: o `.node` do DuckDB vai precisar de entrada em `asarUnpack`, e isso vai aparecer no primeiro `pnpm build:win`, não em desenvolvimento. Ter o teste de nível 5 **antes** do DuckDB significa que, quando o módulo nativo chegar, a falha vem com o dedo apontado — e não misturada com dez outras coisas novas.

## Por que só agora

Os níveis 4 e 5 são lentos: dezenas de segundos um, minutos o outro. Colocá-los cedo teria custado tempo em todas as fases anteriores sem pegar nada — não havia comportamento de ponta a ponta para percorrer.

Agora há: a [fase 06](06-primeira-feature.md) entregou um caminho que atravessa os três processos, e é ele que vale percorrer.

---

## Decisões tomadas

### D7.1 — Playwright, com o Spectron fora de questão

O Playwright dirige o Electron pelo protocolo de DevTools do Chromium, via `_electron.launch`.

**Descartado:** Spectron. Foi a ferramenta oficial por anos e está arquivada, descontinuada desde o Electron 14. Aparece em muito material antigo — não é opção.

### D7.2 — Poucos testes, e escolhidos pelo que só eles pegam

De cinco a dez no nível 4. A régua para incluir: **o teste depende de algo que só existe quando o Electron sobe de verdade?**

| Vale nível 4 | Não vale — já está coberto |
|---|---|
| A janela abre e renderiza | — |
| O preload expôs `window.api` e nada além | — |
| Um caminho de ponta a ponta atravessando os três processos | — |
| Menu, atalho, diálogo nativo | — |
| Lógica de dedução de separador | nível 1 |
| Um estado de erro específico da UI | nível 2 |
| Validação de esquema de URL | nível 3 |

Teste de E2E que verifica regra de negócio é um teste de nível 1 rodando cem vezes mais devagar, e é assim que a suíte lenta cresce até ser desligada.

### D7.3 — O nível 5 roda sob demanda, nunca no ciclo de edição

Ele exige um `build:unpack` antes, o que leva minutos. Fica num script próprio, chamado à mão e — quando houver — na integração contínua depois do empacotamento.

O `check:fast` da [fase 04](04-testes-rapidos.md) não muda. É o compromisso que mantém o ciclo do agente abaixo de quinze segundos.

### D7.4 — O E2E tem `tsconfig` próprio

`e2e/` não pertence nem ao ambiente `node` do main nem ao `web` do renderer: usa os tipos do Playwright e não deve ser incluído em nenhum bundle. Um `tsconfig.e2e.json`, referenciado na raiz e acrescentado ao script `typecheck`, mantém a separação que o [`CLAUDE.md`](../../../CLAUDE.md) já defende para os outros dois.

### D7.5 — A saída do `electron-builder` é `dist/`, não `out/`

Detalhe pequeno que custa meia hora quando pega desprevenido.

O `electron-builder.yml` do projeto não define `directories.output`, então o padrão é `dist/`. Já o `out/` é a saída do `electron-vite` — os arquivos compilados, antes do empacotamento.

O `electron-playwright-helpers` assume `out/` por convenção de outro fluxo de trabalho. **Passe `dist/` explicitamente** ao localizar o build.

---

## Passos

### Passo 1 — Instalar e configurar

```bash
pnpm add -D @playwright/test electron-playwright-helpers
```

Crie `playwright.config.ts` na raiz com dois projetos:

| Projeto | `testMatch` | Quando roda |
|---|---|---|
| `dev` | `e2e/dev/**/*.spec.ts` | `pnpm test:e2e` |
| `packaged` | `e2e/packaged/**/*.spec.ts` | `pnpm test:e2e:packaged` |

Ajuste `workers: 1` — instâncias paralelas do Electron disputam o mesmo diretório de dados do usuário e produzem falha intermitente que parece bug do app.

Crie `tsconfig.e2e.json` incluindo `e2e/**/*` e `playwright.config.ts`, referencie-o no `tsconfig.json` da raiz e acrescente ao script `typecheck`.

Scripts novos no `package.json`:

```jsonc
"test:e2e": "playwright test --project=dev",
"test:e2e:packaged": "npm run build:unpack && playwright test --project=packaged"
```

> ⚠️ O `test:e2e` de desenvolvimento precisa de `out/` atualizado — o Playwright lança o Electron contra o código compilado, não contra o servidor do Vite. Faça o `pnpm build` fazer parte do fluxo ou documente a ordem. Rodar E2E contra um `out/` velho produz falha que não corresponde ao código na tela, e é frustração pura.

**Aceite:** `pnpm typecheck` incluindo o projeto do E2E; `pnpm test:e2e` roda e reporta zero testes.
**Commit:** `chore(e2e): configura Playwright para dev e empacotado`

### Passo 2 — Nível 4: os testes de desenvolvimento

Em `e2e/dev/`, com `_electron.launch({ args: ['.'] })`:

**`janela.spec.ts`** — a janela abre, o título está certo, o `#root` tem conteúdo. Trivial e valioso: pega qualquer quebra de inicialização, incluindo falha de carregamento do preload.

**`fronteira.spec.ts`** — avaliando no contexto do renderer:

| Expressão | Esperado |
|---|---|
| `typeof window.api` | `'object'` |
| `window.electron` | `undefined` |
| `window.require` | `undefined` |
| `window.process` | `undefined` |
| `Object.keys(window.api)` | exatamente as chaves do contrato |

Este é o teste mais valioso do arquivo inteiro. Toda a fase 03 é uma configuração que ninguém revisita, e um `sandbox: false` reintroduzido por um merge distraído não quebra nada visível — só apaga a barreira em silêncio. A última linha também pega o oposto: alguém expondo algo a mais no preload "só para depurar".

**`abrir-dataset.spec.ts`** — o caminho completo da [fase 06](06-primeira-feature.md). O diálogo nativo não é dirigível pelo Playwright; use `electron.evaluate` para instalar um `dialog.showOpenDialog` falso no main antes de clicar, devolvendo um arquivo de teste versionado em `e2e/fixtures/`.

**Aceite:** os três arquivos verdes; `pnpm test:e2e` abaixo de 60 segundos.
**Commit:** `test(e2e): janela, fronteira de segurança e abertura de dataset`

### Passo 3 — Conferir o que vai para dentro do pacote

Antes de escrever o teste do nível 5, olhe o que o `electron-builder` está montando. Rode `pnpm build:unpack` e inspecione `dist/win-unpacked/`.

Confira:

1. `resources/app.asar` existe e tem tamanho plausível.
2. Os fixtures do E2E **não** foram incluídos — `e2e/` precisa entrar no `files` como exclusão, junto com `test/`, `docs/` e `.claude/` (o `electron-builder.yml` já exclui `.vscode/`; siga o mesmo padrão).
3. `asarUnpack` continua com `resources/**`, e nada mais precisa dele ainda. Quando o DuckDB chegar, é aqui que a entrada do `.node` entra.
4. O executável abre com duplo clique e a feature da fase 06 funciona contra um arquivo real.

O item 4 é manual e insubstituível. Faça uma vez, com atenção.

> 🔍 Se algo falhar aqui, o valor da fase já foi entregue — você encontrou uma quebra de empacotamento com **uma** feature no app, e não com quinze.

**Aceite:** os quatro itens; ajustes no `files` do `electron-builder.yml` se necessário.
**Commit:** `chore(build): ajusta o conteúdo do pacote e confere o desempacotado`

### Passo 4 — Nível 5: o teste contra o pacote

Em `e2e/packaged/smoke.spec.ts`, use `findLatestBuild('dist')` e `parseElectronApp` do `electron-playwright-helpers` para localizar o executável, lance-o e verifique **o mínimo**: a janela abre, o `#root` tem conteúdo, `window.api` existe.

Não replique os testes do nível 4 aqui. O que este nível prova é que os arquivos foram parar no lugar certo — comportamento já está coberto.

Faça o teste **falhar de propósito** uma vez: acrescente `'!out/preload/**'` ao `files` do `electron-builder.yml`, empacote, rode. Ele deve falhar por preload ausente. Desfaça.

Sem essa verificação você não sabe se o teste está checando algo ou apenas passando — e um teste de fumaça que passa incondicionalmente é pior que nenhum, porque dá confiança falsa exatamente onde ela custa mais caro.

**Aceite:** verde com o pacote correto; vermelho com o pacote sabotado.
**Commit:** `test(e2e): smoke contra o aplicativo empacotado`

### Passo 5 — Registrar as armadilhas encontradas

Acrescente ao [`04-diario-de-bordo.md`](../../study/04-diario-de-bordo.md) o que apareceu de fato nos passos 3 e 4 — não o que era esperado. Se nada quebrou, registre isso também, com a configuração exata que funcionou: é a linha de base contra a qual a primeira quebra vai ser comparada.

**Aceite:** o diário reflete a realidade do empacotamento.
**Commit:** `docs: registra o comportamento do primeiro empacotamento validado`

---

## Critério de aceite da fase

```bash
pnpm check:fast          # continua abaixo de 15s — o E2E não entrou aqui
pnpm test:e2e            # verde, abaixo de 60s
pnpm test:e2e:packaged   # verde
```

E o executável de `dist/win-unpacked/` abrindo com duplo clique, com a feature funcionando.

---

## O que fica para depois

- **`pnpm build:win` completo com NSIS** — o `build:unpack` já prova o que importa para a fundação. O instalador tem uma classe própria de problemas (atalhos, desinstalação, permissões) que pertence à distribuição.
- **Integração contínua** — a decisão de plataforma não foi tomada. Os scripts já estão prontos para quando for.
- **E2E de múltiplas janelas** — não há a segunda janela.
- **Captura de tela como verificação visual** — útil quando houver interface que valha comparar.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-07 | 1–5 | concluída | Playwright 1.62.1 não baixa browsers no install (sem postinstall; `_electron.launch` usa o Electron do projeto) — nada a ajustar em `allowBuilds`. `findLatestBuild('dist')` funcionou sem fallback: `win-unpacked` contém o token `win`. Achado sério no passo 3: `app.asar` empacotava `.claude/settings.local.json` (chave de API pessoal do MCP Context7) junto com `coverage/`, `docs/`, `e2e/`, `scripts/`, `test/`, `test-results/`, `playwright-report/` e três configs de teste — corrigido em `electron-builder.yml`, reconferido com `@electron/asar list` (87 entradas a menos). Ciclo vermelho→verde do smoke test provado sabotando e revertendo `files`. Nomes de arquivo em `e2e/dev/` copiados em português direto do texto do plano — corrigido para inglês (`window`, `security-boundary`, `open-dataset`), recaída na mesma armadilha da fase 03. `pnpm check:fast` segue vermelho pela falha pré-existente de `guard.mjs` (ROADMAP §4, não desta fase); `test:e2e` (15,4s) e `test:e2e:packaged` verdes, ambos abaixo do limite. Executável de `dist/win-unpacked/` validado pelo usuário: abre e a feature funciona contra arquivo real. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [06 — Primeira feature vertical](06-primeira-feature.md) · **Índice:** [README](../active/README.md) · **Próximo:** [08 — Automação e registro](08-automacao-e-registro.md)
