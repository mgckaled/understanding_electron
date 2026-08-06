# 08 — Automação e registro

**Depende de:** [07](07-e2e-e-empacotamento.md) · **Entrega:** hooks de verificação, `CLAUDE.md` atualizado, três skills, plano arquivado

---

## Por que esta fase existe

As sete fases anteriores tomaram decisões. Esta fase decide **onde cada decisão continua existindo** depois que o plano for lido pela última vez.

O problema é concreto. Um documento de planejamento é consumido uma vez e depois vira arqueologia — ninguém abre `06-primeira-feature.md` seis meses depois para lembrar por que o `jobId` nasce no renderer. Se a decisão só mora ali, ela se perde, e a próxima feature reinventa outra convenção.

Há três destinos possíveis, e a escolha entre eles é o assunto desta fase:

| Destino | Custo | Serve para |
|---|---|---|
| **Verificação automática** | roda sempre | Regra que a máquina consegue checar |
| **`CLAUDE.md`** | ocupa contexto em toda sessão | O que muda a decisão logo na primeira linha de código |
| **Skill** | carregada só quando relevante | Detalhe de domínio: tabelas, catálogos, padrões |

A ordem é uma preferência real: **o que pode ser verificado não deve ser documentado.** Regra escrita é regra que se descobre violada em revisão; regra em lint é regra que não chega a ser escrita errada. A [fase 01](../implemented/01-camadas-e-fronteiras.md) já aplicou isso à tabela de importação, e é o mesmo princípio aqui em escala maior.

O que sobra — o que a máquina não consegue checar — se divide pelo critério de frequência. `CLAUDE.md` é caro: entra em toda sessão, então cada linha ali compete por atenção com todas as outras. Skill é barata: fica no disco e só custa quando é aberta.

---

## Decisões tomadas

### D8.1 — Quatro hooks, com custos e papéis diferentes

Os scripts **já existem** em `.claude/hooks/`, escritos e testados fora do plano. Esta fase os liga; não os escreve.

| Momento | Script | Bloqueia? | Custo |
|---|---|---|---|
| Depois de cada edição | `format_fix.mjs` — Prettier + ESLint `--fix` no arquivo tocado | não | sub-segundo |
| Depois de cada edição | `guard.mjs` — invariantes que o lint não expressa | **sim** (saída 2) | milissegundos |
| Depois de cada edição | `test_related.mjs` — `vitest related` no arquivo tocado | **sim** (saída 2) | 1–5s |
| Ao final de cada resposta | `pnpm check:fast` | sim | poucos segundos |

Três decisões embutidas aí:

**Rodar o `check:fast` inteiro a cada edição parece mais seguro e é pior.** Uma refatoração normal passa por estados intermediários que não compilam — arquivo criado antes de quem o importa, tipo movido antes das referências. Verificar nesses momentos produz erro previsível, que ensina a ignorar a saída do hook. E hook ignorado é hook desligado.

**Formatar a cada edição é diferente:** é idempotente, não falha por estado intermediário, e evita que estilo apareça no diff misturado com conteúdo.

**`vitest related` cabe no ciclo porque não roda a suíte inteira.** Ele percorre o grafo de módulos e executa só os testes que importam o arquivo tocado — o que é possível porque o Vitest já está configurado com os dois projetos da [fase 04](04-testes-rapidos.md).

> 🔍 Os quatro scripts em `.claude/hooks/` são `.mjs`, não `.py`. Node já é dependência obrigatória do projeto; Python não é — e no Windows um `python` no PATH pode ser o stub da Microsoft Store, que abre a loja em vez de executar. O `_shared.mjs` também resolve os binários lendo o `bin` do `package.json` de cada dependência e executando-os com o próprio Node, sem shell — o que elimina o problema de PATHEXT e de aspas em caminho com espaço no Windows.

### D8.1b — O `guard.mjs` cobre o que o lint não alcança

Sete invariantes, em ordem decrescente de dano se violadas: regressão de `webPreferences` em `src/main/`; `ipcMain` fora de `src/main/ipc/`; `exposeInMainWorld` com chave diferente de `'api'`; `process.env` em `src/renderer/`; `electron` importado de `core/` ou `shared/`; cor literal em módulo CSS; e `var(--token)` sem declaração correspondente em `tokens.css`.

A primeira é a que justifica o hook existir. `sandbox: false` reintroduzido não quebra nada visível — apenas apaga em silêncio a fronteira em que toda a arquitetura se apoia, e nenhuma revisão de código pega isso de forma confiável.

A última só entra em vigor quando o `tokens.css` da [fase 05](05-design-tokens.md) existir; até lá o guarda se desliga sozinho. Ela pega o defeito que nenhum linter pega: `var()` com nome errado não gera erro, o navegador simplesmente não aplica nada, e ninguém nota até olhar aquele componente específico.

> ⚠️ Duas guardas são propositalmente redundantes com o ESLint (pureza de camada e superfície do `contextBridge`). Isso contradiz a regra "o que pode ser verificado não deve ser duplicado" — e a exceção é deliberada: o hook dispara a **cada edição**, o lint só quando invocado. Para invariante de fronteira, o custo de descobrir tarde é maior que o custo da duplicação.

### D8.2 — E2E nunca entra em hook

Os níveis 4 e 5 continuam manuais, conforme a D7.3 da [fase 07](07-e2e-e-empacotamento.md).

O raciocínio já foi feito e vale repetir porque é a decisão mais fácil de reverter por engano: se o ciclo de retorno passa de alguns segundos, o trabalho passa a ser agrupado para amortizar a espera — e agrupar mudanças é exatamente o oposto do **uma variável por vez** que o [`CLAUDE.md`](../../../CLAUDE.md) estabelece como princípio.

Um ciclo lento não deixa de ser usado por preguiça. Ele deixa de ser usado porque contorná-lo passa a ser racional.

### D8.3 — `CLAUDE.md` guarda o que muda a primeira decisão

Entram apenas regras que, ignoradas, produzem código estruturalmente errado desde a primeira linha:

- A tabela de camadas e quem importa quem
- "Todo canal novo passa por `src/shared/ipc.ts`" — não existe `ipcMain.handle` avulso
- `Result` para falha esperada, exceção para bug
- Componente usa token semântico; nenhum literal de cor ou tamanho
- Os cinco níveis de teste e onde cada coisa é testada
- Régua de tamanho de arquivo

Não entram: catálogo de tokens, tabela de canais, lista de primitivos. São consulta, não decisão — e consulta é o que skill faz melhor.

### D8.4 — Três skills, espelhando a divisão que já funcionou

| Skill | Cobre |
|---|---|
| `architecture` | Camadas, contrato IPC, ciclo de vida de job, fluxo de adicionar feature de ponta a ponta, régua de tamanho |
| `design-system` | Catálogo de tokens, primitivos, `ViewState`, convenções de desktop, tabela de armadilhas |
| `testing` | Os cinco níveis, o que vai em cada um, mocks derivados do contrato, o que não testar |

É a mesma divisão do projeto Python, com uma diferença deliberada: **não há skill separada para IPC.** No mill.tools, `cli` e `design-system` são superfícies de tamanho comparável. Aqui o contrato IPC é o coração da arquitetura, não um domínio ao lado dela — separá-lo criaria duas skills que se referenciam a cada parágrafo.

Revisitar quando `src/shared/ipc.ts` passar de vinte canais.

### D8.5 — A régua de tamanho, calibrada pelo que existe

Números escolhidos olhando os arquivos que as fases produziram, não copiados de outro projeto:

| Tipo | Alvo | Teto |
|---|---|---|
| Módulo de `core/` | 200 | 300 |
| Handler de `main/features/` | 100 | 150 |
| Componente do renderer | 150 | 250 |
| Hook | 80 | 120 |
| `src/main/index.ts` | — | **100, sem exceção** |
| `src/preload/index.ts` | — | **60, sem exceção** |

As duas últimas linhas são as que importam. Os limites dos outros tipos são convite à divisão; estes dois são a decisão D6 da [visão geral](00-visao-geral.md) tornada mensurável. Main que cresce virou lugar de lógica; preload que cresce virou lugar de lógica no pior sítio possível para testá-la.

E o corolário do projeto Python, que continua valendo: **divide-se ao tocar.** Não varra a base atrás de arquivos grandes. Divida o arquivo quando for estendê-lo.

### D8.6 — Coesão vale mesmo abaixo do teto

Tamanho é sintoma, não a doença. Sinais que exigem divisão independentemente da contagem de linhas:

- Um componente que orquestra estados de duas features distintas
- Um arquivo de handlers que reúne canais de domínios diferentes
- Comentários de seção separando mundos que não conversam

---

## Passos

### Passo 1 — Ligar os hooks

Os quatro scripts já estão em `.claude/hooks/`. Falta o `.claude/settings.json` que os aciona: `PostToolUse` filtrando `Edit|Write` para os três de arquivo, e `Stop` chamando `pnpm check:fast`.

Todos são invocados como `node .claude/hooks/<nome>.mjs` — sem `pnpm exec`, porque não são dependências, e sem shell.

> 🔍 O formato exato do arquivo de hooks acompanha a versão do Claude Code. Confirme o esquema atual com `/hooks` antes de escrever — os scripts recebem o *tool call* pela entrada padrão em JSON e leem `tool_input.file_path`, mas a chave que declara o *matcher* já mudou de nome entre versões.

Verifique que `.claude/settings.local.json` está no `.gitignore`: o `settings.json` é acordo do projeto e vai versionado; o `.local.json` é preferência de máquina e não deve viajar — mesma distinção que o [`CLAUDE.md`](../../../CLAUDE.md) já faz sobre as exclusões do Windows Defender.

**Teste cada um deliberadamente**, com uma violação real, e desfaça em seguida:

| Hook | Provocação | Esperado |
|---|---|---|
| `format_fix` | salvar um arquivo com indentação errada | volta formatado |
| `guard` | escrever `sandbox: false` em `src/main/` | bloqueia com a explicação |
| `test_related` | quebrar uma asserção de um teste existente | bloqueia com a saída do Vitest |
| `Stop` | deixar um erro de tipo | `check:fast` reclama no fim da resposta |

Hook que nunca foi visto falhar é hook que você não sabe se está ligado.

**Aceite:** as quatro provocações produzindo o efeito esperado; `.claude/settings.json` versionado, `.local.json` ignorado.
**Commit:** `chore(claude): liga os hooks de formatação, invariantes e testes`

### Passo 2 — Reescrever o `CLAUDE.md`

O arquivo está desatualizado desde a [fase 03](../implemented/03-sandbox-e-seguranca.md). Faça a revisão completa, não remendo.

**Sai:** "Pendência conhecida: `sandbox: false`" (resolvida). A afirmação de que os tipos do contrato ficam em `src/preload/index.d.ts` — mudou para `src/shared/ipc.ts`.

**Entra:** a lista da D8.3. Cada item em uma ou duas linhas, apontando para a skill que detalha.

**Fica:** stack fixada, exclusões do Windows Defender, armadilhas de pnpm e Electron, decisões adiadas (Vite 8, TS 6, Electron 43). Continuam corretos e continuam valiosos.

Acrescente a régua de tamanho da D8.5 e o "divide-se ao tocar".

> ⚠️ Resista a colar as tabelas do design system e do contrato aqui. `CLAUDE.md` entra em toda sessão; cada linha compete com todas as outras por atenção. Um `CLAUDE.md` de quinhentas linhas é lido com menos cuidado que um de cento e cinquenta.

**Aceite:** nenhuma afirmação falsa sobre o estado do repositório; nada de catálogo.
**Commit:** `docs: atualiza o CLAUDE.md para o estado pós-fundação`

### Passo 3 — As três skills

Crie `.claude/skills/<nome>/SKILL.md` para `architecture`, `design-system` e `testing`.

Cada uma leva um cabeçalho com `name` e `description`. A `description` é o que decide se a skill é carregada na hora certa: precisa nomear os gatilhos concretos — os caminhos de arquivo que a acionam, os verbos ("criar canal", "adicionar token", "escrever teste de handler") e a fronteira com as irmãs.

O conteúdo vem das fases, **condensado e no presente**. A diferença de gênero é importante: o plano diz "vamos fazer assim, e aqui está o porquê"; a skill diz "é assim, e aqui está a tabela". Copiar o plano cru produz skill longa e narrativa, que é o formato errado para consulta.

A `design-system` recebe a seção que o projeto Python provou ser a mais valiosa: **uma tabela única de armadilhas.** Semeie com o que o `CLAUDE.md` já registra (o `Error: Electron uninstall`, a configuração do pnpm em lugar morto, o `@types/node` desalinhado) e com o que as fases 03 e 07 descobrirem — o `externalizeDepsPlugin` no preload sandboxed, a saída em `dist/` e não `out/`, e o que mais tiver aparecido.

Regra que mantém isso saudável: **uma armadilha, um lugar.** O `CLAUDE.md` aponta para a tabela; não a duplica.

**Aceite:** as três skills carregam quando esperado e não carregam quando não deveriam; nenhum conteúdo duplicado entre elas e o `CLAUDE.md`.
**Commit:** `docs(skills): architecture, design-system e testing`

### Passo 4 — Arquivar o plano

Crie `docs/planning/implemented/` e mova os nove arquivos de `active/`.

No `README.md` do plano, troque o índice por um bloco curto de encerramento: o que foi entregue, o que foi adiado com gatilho registrado, e o link para [`05-proximos-passos.md`](../../study/05-proximos-passos.md), que é onde o trabalho continua.

Junte os gatilhos que ficaram espalhados numa lista só — é a informação mais fácil de perder no arquivamento:

| Gatilho | Revisita |
|---|---|
| DuckDB instalado | `shamefullyHoist: false` |
| Primeira query reexecutada | TanStack Query |
| Segunda janela | progresso endereçado ao remetente |
| Sexta fatia em `features/` | `eslint-plugin-boundaries` |
| Vigésimo canal | skill própria para IPC |
| Design system estável | endurecer a CSP |

**Aceite:** `docs/planning/active/` vazio; nenhum link quebrado nos documentos que apontam para o plano.
**Commit:** `docs: arquiva o plano de fundação e consolida os gatilhos de revisão`

---

## Critério de aceite da fase

```bash
pnpm check:fast && pnpm test:e2e && pnpm build
```

E a verificação que realmente importa, porque é o objetivo declarado desta fase:

> Abra uma sessão nova, sem contexto desta conversa, e peça um canal de IPC novo — algo trivial, como devolver o caminho do diretório de dados do usuário.

O resultado esperado: o canal nasce em `src/shared/ipc.ts` com schema `zod`, o handler nasce como função exportada em `src/main/features/`, o teste de nível 3 vem junto, o preload é ampliado, e nada disso precisa ser pedido.

Se algum desses passos precisar ser solicitado, a informação faltante está no lugar errado — ou não foi escrita, ou foi escrita numa skill que não carregou. **Corrija onde ela mora, não repetindo a instrução.** Essa distinção é a diferença entre um repositório que ensina e um que exige ser explicado toda vez.

---

## O que fica para depois

- **Integração contínua** — os scripts estão prontos; falta decidir a plataforma.
- **Skill de IPC** — gatilho registrado.
- **Hook de pré-commit fora do Claude Code** — os hooks desta fase valem para sessões com o agente. Um `husky` cobriria commits manuais, e só vale se o trabalho manual for frequente o bastante.
- **Métrica de duração do `check:fast`** — vale a pena quando ele passar de dez segundos. Antes disso, medir custa mais que ganha.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| — | — | não iniciada | — |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [07 — E2E e empacotamento](07-e2e-e-empacotamento.md) · **Índice:** [README](README.md)

**Fim do plano de fundação.** O trabalho continua em [`docs/study/05-proximos-passos.md`](../../study/05-proximos-passos.md).
