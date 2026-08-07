# Plano de fundação — data-lab

Oito fases que levam o projeto do scaffold do electron-vite até uma fundação pronta para receber a camada de dados. Nada aqui envolve DuckDB — a camada de dados continua descrita em [`docs/study/05-proximos-passos.md`](../../study/05-proximos-passos.md) e começa quando a fase 08 terminar.

> Este diretório é o `active/` do [ciclo de vida de plano](../../README.md#ciclo-de-vida-de-um-plano). Fase concluída **move** para [`../implemented/`](../implemented/) e ganha uma entrada em [`HISTORY.md`](../../HISTORY.md).

---

## Para que serve este diretório

Estes documentos são **especificações executáveis**, não exploração. Todas as decisões de projeto já foram tomadas e estão registradas com a alternativa descartada e o motivo do descarte. A intenção é que a implementação aconteça direto, sem uma rodada nova de planejamento — replanejar o que já está decidido é exatamente o retrabalho que o plano existe para evitar.

Cada fase segue a mesma estrutura:

| Seção | O que contém |
|---|---|
| **Por que esta fase existe** | O problema real, em prosa. É a parte que sobrevive quando as versões mudarem. |
| **Decisões tomadas** | Fechadas. Cada uma com a alternativa descartada e o porquê. Não reabrir sem motivo novo. |
| **Passos** | Numerados. **Cada passo é um commit.** |
| **Critério de aceite** | Comandos verificáveis. Se não passarem, a fase não terminou. |
| **O que fica para depois** | Escopo explicitamente adiado, para não ser confundido com esquecimento. |
| **Diário de execução** | Uma linha por sessão. Preenchido **antes de encerrar cada sessão**. |

---

## Regras de execução

1. **Uma fase por vez, na ordem.** As fases têm dependência real entre si — a 03 quebra sem a 02, a 06 não tem o que testar sem a 04.
2. **Um passo, um commit.** O princípio de "uma variável por vez" do [`CLAUDE.md`](../../../CLAUDE.md) vale aqui na granularidade do passo, não da fase.
3. **`pnpm dev` abre a janela ao final de cada passo.** Se não abrir, o passo não terminou — não siga acumulando mudanças em cima de um estado quebrado.
4. **Critério de aceite é portão, não sugestão.** Fase sem aceite verde não é fase concluída.
5. **Toda sessão termina preenchendo o diário** da fase em que trabalhou. Observação que valha além da fase sobe para o [`HISTORY.md`](../../HISTORY.md) na mesma sessão — a regra completa está em [`docs/README.md`](../../README.md#os-dois-registros-e-por-que-são-dois).
6. **Ao concluir uma fase**, mova o arquivo para [`../implemented/`](../implemented/) no mesmo commit do último passo, e escreva a entrada no `HISTORY.md`.

> ⚠️ Se algo no repositório contradisser o que está escrito aqui, o **repositório ganha** e o documento é que está desatualizado. Corrija o documento na mesma passagem, com uma nota do que mudou. Plano que mente é pior que plano ausente.

---

## As fases

| # | Fase | O que entrega | Dependências |
|---|---|---|---|
| [00](00-visao-geral.md) | Visão geral | O princípio, as decisões globais, o mapa | — |
| [01](../implemented/01-camadas-e-fronteiras.md) | Camadas e fronteiras — **implementada** | Estrutura de pastas, aliases, regra de importação verificada pelo ESLint | — |
| [02](../implemented/02-contrato-ipc.md) | Contrato IPC — **implementada** | `src/shared/ipc.ts`, `Result`, preload tipado, registro de handlers, cancelamento | 01 |
| [03](../implemented/03-sandbox-e-seguranca.md) | Sandbox e segurança — **implementada** | `sandbox: true`, superfície estreita, pendências registradas | 02 |
| [04](../implemented/04-testes-rapidos.md) | Testes rápidos — **implementada** | Vitest com dois projetos, níveis 1–3 da pirâmide | 02 |
| [05](../implemented/05-design-tokens.md) | Design tokens — **implementada** | `tokens.css`, primitivos, densidade de desktop, `StateView` | 01, 04 |
| [06](../implemented/06-primeira-feature.md) | Primeira feature vertical — **implementada** | `open-dataset` de ponta a ponta, com progresso e cancelamento | 02–05 |
| [07](../implemented/07-e2e-e-empacotamento.md) | E2E e empacotamento — **implementada** | Playwright em dev e contra o instalador | 06 |
| [08](08-automacao-e-registro.md) | Automação e registro | Hooks, `check:fast`, atualização do `CLAUDE.md`, skills | 07 |

E, sem número de fase por não ser executável ainda:

| | Documento | O que é | Depende de |
|---|---|---|---|
| [09](09-camada-de-ia.md) | Camada de IA e ML | As **decisões** sobre Ollama, Gemini, GLM, RAG e ML — tomadas com o contexto fresco, para a implementação não redescobri-las | fundação + camada de dados + pipeline |

---

## Depois da fase 08

A fundação está pronta e a camada de dados começa. O documento [`05-proximos-passos.md`](../../study/05-proximos-passos.md) descreve os seis passos do DuckDB, e continua válido — com uma correção registrada na [visão geral](00-visao-geral.md#uma-correção-no-caderno-de-estudos) a respeito do custo real de atravessar a fronteira de processo com `ArrayBuffer`.

Daí em diante, a sequência até o produto do [`ESCOPO.md`](../../ESCOPO.md) está no [`ROADMAP.md`](../../ROADMAP.md).
