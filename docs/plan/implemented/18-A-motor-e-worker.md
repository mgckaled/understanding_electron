# 18-A — Motor: instalação, endurecimento e a primeira travessia de processo

**Depende de:** nada além da fundação (fases 00–08) e do arco 13–17, já concluídos · **Entrega:** DuckDB instalado e validado, `shamefullyHoist: false`, o entrypoint do `utilityProcess` resolvido, a configuração restrita do motor (com a fase de carregar extensão por caminho explícito já presente, vazia), uma consulta trivial atravessando duas fronteiras de processo, e o app empacotado confirmando que o `.node` sobrevive ao `asar`.

> Primeiro dos sub-planos em que o 18 (Camada de dados) se divide — 18-A a 18-F, cada um com no máximo 7 passos, decisão tomada explicitamente para não repetir o custo do plano 17 (duas sessões, perda de contexto de auditoria por compactação automática). Este é só o mecanismo: **nenhuma linha em `shared/ipc.ts`, nenhum canal, nenhum Arrow em trânsito, nenhuma UI.** Isso é o 18-B. `study/05-proximos-passos.md` continua sendo o dono da visão geral; este plano executa os passos 1–3 dele, mais a verificação de empacotamento adiantada de propósito.

**Fora deste plano:** canal IPC/`window.api`, `apache-arrow` (instalação e transporte), SQL cru com UI (18-B) · pré-visualização de 50 linhas (18-C) · perfil nível 2 sob demanda + cartão aninhado (18-D) · Parquet/JSON/NDJSON (18-D–E) · Excel (18-F).

---

## Contexto

`study/05-proximos-passos.md` já argumenta o porquê de cada peça — `utilityProcess` porque o main é single-threaded, DuckDB pelo formato colunar, N-API porque não exige recompilação por versão do Electron. Este plano não reabre nenhuma dessas escolhas; executa a primeira fatia da ordem que o próprio documento sugere: instalar e validar isoladamente, aprender a API com uma consulta temporária, mover para o `utilityProcess`. A verificação de empacotamento (originalmente o passo 6 da lista do `study/05`) entra **aqui**, não no fim de uma cadeia mais longa — é módulo nativo, e a armadilha do `asarUnpack` só aparece depois de empacotado; quanto mais código se empilha antes de descobrir isso, mais difícil bissectar.

Duas incertezas técnicas foram levantadas na sessão em que este plano foi desenhado, e resolvidas por pesquisa (Context7, fonte primária) antes de qualquer passo ser escrito — não por suposição:

1. **Onde o entrypoint do `utilityProcess` nasce.** electron-vite não tem um terceiro bloco além de `main`/`preload`/`renderer` — mas o bloco `main` aceita múltiplas entradas via `rollupOptions.input`. Isso é config, não mecanismo novo (D18A.1).
2. **Como a extensão do Excel (18-F) vai coexistir com `lock_configuration = true`.** DuckDB aceita `LOAD 'caminho/para/extensão.duckdb_extension'` a partir de um caminho local explícito, sem tocar `autoinstall_known_extensions`/`autoload_known_extensions`. A resposta é de sequência, não de configuração: carregar antes de travar (D18A.3).

As duas ainda precisam de confirmação **ao vivo** — pesquisa resolve "é possível", não "funciona nesta máquina, com esta versão". É o que os passos 3 e 4 fazem.

---

## Decisões

### D18A.1 — Entrypoint do worker via `rollupOptions.input` multi-entrada, não build separado

```ts
// electron.vite.config.ts, bloco main
build: {
  rollupOptions: {
    input: {
      index: resolve(__dirname, 'src/main/index.ts'),
      duckdbWorker: resolve(__dirname, 'src/workers/duckdb/index.ts')
    }
  }
}
```

Confirmado contra a doc oficial do electron-vite (Context7): múltiplas entradas no mesmo bloco produzem múltiplos arquivos de saída em `out/main/`. **O nome exato do segundo arquivo não está confirmado** — a chave `duckdbWorker` é o mapeamento plausível, mas o electron-vite pode aplicar sua própria convenção de `entryFileNames`, e o Rollup pode acrescentar hash ao nome. `utilityProcess.fork()` aponta para o que o **passo 3 observar** em `out/main/`, nunca para um nome escrito de antemão neste documento. Uma config, não um pipeline de build paralelo — `src/workers/duckdb/` (hoje pasta vazia, per skill `architecture`) ganha seu primeiro arquivo aqui. **Também não confirmado por doc, só ao vivo (passo 3):** se `@duckdb/node-api` continua externalizado (não bundlado) nessa segunda entrada — o bloco `main` já externaliza dependências por padrão do electron-vite, mas isso nunca foi testado com duas entradas no mesmo bloco.

### D18A.2 — `workers/duckdb/index.ts` não importa `electron`; fala por `process.parentPort`

Um script de `utilityProcess.fork()` roda como subprocesso Node — sem acesso a `app`, `BrowserWindow` ou qualquer módulo do processo main do Electron. A troca de mensagem é por `process.parentPort` (global injetado pelo runtime do Electron no processo filho), não por `require('electron')`. Consequência de testabilidade: a lógica pura (montar a config restrita, mais adiante montar consultas) mora em `core/duckdb/`, testável em nível 1 sem subir processo nenhum; `workers/duckdb/index.ts` é fiação fina — recebe mensagem, chama uma função de `core/`, devolve resposta — verificada só ao vivo, mesma classe de `main/index.ts`/`register-all.ts` (skill `testing`).

### D18A.3 — Config restrita nasce com uma fase vazia, para o 18-F não reabrir este arquivo

A ordem de start do worker, fixada agora mesmo sem nada para carregar ainda:

```
instanciar → carregar extensões de caminho explícito (array vazio hoje) →
  SET enable_external_access/autoinstall_known_extensions/
      autoload_known_extensions/allowed_directories/memory_limit/
      temp_directory → SET lock_configuration = true (por último)
```

**`allowed_directories` = [`userData/attachments`, `userData/duckdb-tmp`].** Vale registrar por que a lista é curta: o DuckDB nunca precisa enxergar o caminho original do arquivo do usuário — o anexo já foi copiado para `userData/attachments/<hash>` pelo mecanismo do plano 16, endereçado por conteúdo. É uma propriedade que sai de graça do desenho do 16, não deste plano, e vale a linha para o próximo leitor não presumir que caminho arbitrário do usuário precisaria estar liberado.

Se essa fase não existisse desde já, o 18-F precisaria reabrir a sequência de start que este plano escreve — exatamente o retrofit que o critério "caro de desfazer" da skill `architecture` manda evitar. `core/duckdb/config.ts` expõe uma função pura que recebe a lista de extensões (vazia aqui) e os parâmetros de caminho, e devolve a sequência de comandos na ordem certa — testável em nível 1 sem instanciar DuckDB nenhum.

### D18A.4 — `memory_limit`: remedido nesta sessão, não copiado do `ESCOPO.md`

O `~4 GB` que está escrito hoje no `ESCOPO.md` antecede as medições do plano 15. Remedido agora, nesta máquina: **7 GB livres** de 15,81 GB totais (`Get-CimInstance Win32_OperatingSystem`), num momento sem modelo Ollama residente — abaixo do "~9 GB só com o Electron" do `CLAUDE.md` e mais perto do "~7,5 GB só com VS Code". Um modelo de 7B residente (`qwen2.5:7b`, `qwen2.5-coder:7b`) pode segurar 4,7 GB sozinho — headroom real, no pior caso plausível, é bem mais apertado que 4 GB.

**Valor escolhido: `memory_limit = '2GB'`.** DuckDB derrama para disco acima do limite — errar para baixo é lento, não quebrado (a mesma régua do `ESCOPO.md`: "acima disso, deve funcionar mais devagar, nunca quebrar"). `temp_directory` aponta para `userData/duckdb-tmp`, para o derramamento ter onde acontecer. **Este número é um retrato de agora — o passo 4 reconfere a RAM livre no momento de executar, não usa este parágrafo cegamente.**

### D18A.5 — Nenhum canal em `shared/ipc.ts` neste plano; a prova de vida fica dentro de `main/`, verificada ao vivo

A consulta trivial dos passos 3 e 5 não passa por `window.api`. Ela é spawn do worker + mensagem + resposta, dentro do processo main, logada no terminal durante `pnpm dev` — sem UI, sem contrato tipado ainda. Duas razões: primeiro, `utilityProcess` é API exclusiva do Electron, então o código que o invoca já não é testável em nível 3 (D18A.2) — não há ganho em formalizar um canal para provar algo que só se prova ao vivo de qualquer forma. Segundo, e mais importante: o formato real do canal (`dataset:query`, ainda por nascer) já vai carregar Arrow desde o primeiro dia no 18-B — desenhar um canal provisório aqui só para descartá-lo customaria uma entrada em `shared/ipc.ts`/`preload`/`test/api-mock.ts` que nunca chega a servir usuário nenhum.

---

## Passos

Sequenciados para um commit por passo, seguindo o padrão dos planos 16 e 17.

| # | Entrega | Testes | Aceite |
|---|---|---|---|
| **1** | `pnpm add @duckdb/node-api`; `pnpm approve-builds` se pedir script de build (`apache-arrow` fica fora — só entra no 18-B, onde é exercitado; instalar sem uso aqui só custaria bisseção extra se o passo 2 quebrar algo) | — | `pnpm dev` abre normalmente; a dependência aparece em `pnpm-lock.yaml` |
| **2** | `shamefullyHoist: false` em `pnpm-workspace.yaml`, isolado do passo 1 (uma variável por vez) | A suíte já existente é o teste — nenhum caso novo | `pnpm install && pnpm check:fast && pnpm dev` — os três verdes, nenhum import quebrado por dependência fantasma que o hoist antigo escondia |
| **3** | `src/workers/duckdb/index.ts` criado; `rollupOptions.input` multi-entrada (D18A.1); handshake mínimo via `process.parentPort` (echo) provando que o worker sobe como processo separado | Nenhum nível 1–3 (D18A.2/D18A.5) | `pnpm build` gera um arquivo próprio para o worker, separado de `index.js` — **o nome exato é observado, não suposto** (D18A.1 não garante `duckdbWorker.js` literal); o argumento de `fork()` deriva do que apareceu em `out/main/`. `pnpm dev` com spawn manual do worker mostra o echo no terminal do main; **confirma se `@duckdb/node-api` segue externo nessa segunda entrada** (achado da D18A.1 que só se prova aqui) |
| **4** | `core/duckdb/config.ts` — função pura que monta a sequência da D18A.3 (extensões vazias hoje, `allowed_directories` = `userData/attachments` + `userData/duckdb-tmp`, `memory_limit` remedido, `temp_directory` em `userData/duckdb-tmp`, `lock_configuration` por último); worker aplica contra uma `DuckDBInstance` real | Nível 1: a função devolve os comandos na ordem certa (lock por último), dado qualquer lista de extensões | Teste nível 1 verde. **Ao vivo, a trava precisa se provar, não só a ordem da lista:** `SELECT * FROM read_csv('<caminho fora de allowed_directories>')` falha com Permission Error; `SET memory_limit = '8GB'` depois do lock é rejeitado. Sem isso, um nome de configuração digitado errado passaria em silêncio — DuckDB tolera setting desconhecido em alguns caminhos, e só apareceria no 19, com SQL gerado por modelo em jogo |
| **5** | Substitui o echo do passo 3 por `SELECT 42` de verdade, contra a instância configurada no passo 4 — não `duckdb.version()`: essa é chamada de módulo, nunca toca instância nem config restrita, então não prova o que este passo precisa provar; resultado volta pela mensagem, main loga no terminal | Nenhum automatizado (D18A.5) | `pnpm dev`: o terminal do main mostra `42`, vindo do worker, através da instância e conexão configuradas no passo 4 — a travessia completa: renderer não entra ainda, é main↔worker |
| **6** | **Primeiro: inspecionar `node_modules` (já sob `shamefullyHoist: false` do passo 2) para achar o caminho real do `.node`** — `@duckdb/node-api` é um wrapper sobre `@duckdb/node-bindings`, que distribui o binário em pacotes **por plataforma** (`@duckdb/node-bindings-win32-x64` e afins), dependência opcional; o `.node` não mora no pacote que o passo 1 instalou. Só depois, escrever o glob de `asarUnpack` (`electron-builder.yml`) mirando o caminho observado — nunca `**/*.node` chutado; empacota (`pnpm build:win`); abre o app empacotado | Nenhum automatizado — verificação manual, mesma classe do passo 7 do plano 17 | `dist/win-unpacked/crivo.exe` abre; a mesma prova de vida do passo 5 se repete empacotado — sem isso, a armadilha do `study/05` (funciona em dev, falha só no instalador) passaria despercebida |
| **7** | Fechamento: diário preenchido; candidatos a `HISTORY.md` — a solução do entrypoint (D18A.1), a resolução da ordem load-antes-de-travar (D18A.3), o `memory_limit` remedido (D18A.4); `ROADMAP § 2` fecha o gatilho do `shamefullyHoist` | — | `pnpm check:fast` verde; nada pendente de registro |

---

## Ordem de dependência

```
1 (instalar) ──► 2 (hoist) ──► 3 (entrypoint) ──► 4 (config) ──► 5 (query real) ──► 6 (empacotar) ──► 7 (fechamento)
```

Linear, sem ramificação — cada passo depende do anterior existir para ser verificado. É a natureza de um plano de mecanismo, diferente da árvore de dependência do 17 (onde documento e imagem corriam em paralelo depois do passo 1).

---

## Riscos

1. **Externalização do `@duckdb/node-api` sob duas entradas no bloco `main`** — nunca testado (nem pela doc, nem neste projeto). Se o comportamento padrão do electron-vite não externalizar, o `.node` pode acabar bundlado incorretamente; conserto é `rollupOptions.external` explícito (achado no Context7 durante a pesquisa da sessão), não redesenho.
2. **`memory_limit` remedido nesta sessão pode já estar desatualizado quando o passo 4 rodar de fato** — se houver hiato entre escrever e executar este plano, reconferir a RAM livre é parte do próprio passo, não uma suposição herdada deste documento.
3. **`pnpm approve-builds`/`allowBuilds`** — o `study/05` já avisa que o DuckDB pode pedir script de build; se pedir, entra em `allowBuilds` no `pnpm-workspace.yaml` como parte do passo 1, não como surpresa depois.
4. **A ordem load-antes-de-travar (D18A.3) nunca é exercitada de verdade neste plano** — a lista de extensões fica vazia até o 18-F. O risco que sobra é estrutural: se o 18-F descobrir que `LOAD` também precisa de alguma configuração que só pode ser setada **depois** do lock, a sequência da D18A.3 precisa reabrir — mas é um risco conhecido e nomeado, não uma surpresa. ✅ **Fechado no 18-F (ago/2026)**: `extensionPaths` recebeu sua primeira entrada real (a extensão `excel`), a ordem da D18A.3 se manteve sem alteração — nenhuma configuração extra precisou de `DuckDBInstance.create` — e a sequência não reabriu. Ver [`18-F`](18-F-excel.md) § D18F.1.
5. **O passo 2 (hoist) e o passo 6 (`asarUnpack`) interagem** — `shamefullyHoist: false` muda o layout de `node_modules` que o glob do passo 6 precisa mirar. O glob se escreve depois de observar o layout real (passo 6, primeira parte), nunca antes — apontado pelo advisor como o ponto de maior chance de falha silenciosa do plano.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `pnpm dev` ao vivo nos passos 3 e 5 — são a prova de vida em si, não têm substituto automatizado.
- `pnpm build:win` no passo 6, com abertura manual do app empacotado — confirma `asarUnpack` antes de qualquer outro código se apoiar nele.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 18/08/2026 | 1-7 | **concluído** — os 7 passos, um commit cada | **Duas correções reais à ordem dos `SET`, achadas só ao vivo, nunca pela doc.** E foi a troca de `stdio: 'inherit'` para `'pipe'` manual que as revelou: sem o output do worker, os dois erros de ordem **pareciam um hang**. `memory_limit` remedido no dia da execução, não copiado do dia do desenho — 5,54 GB livres contra os 7 GB de antes, e `2GB` seguiu folgado. A chamada final ao advisor deveria ter vindo **antes** do `build:win` e veio depois, por descuido: achou a verificação do `smartUnpack` incompleta (arquivo apagado antes de conferir o `asar list`), corrigida com um build isolado a mais. |
| 18/08/2026 | — | plano escrito | Sessão dedicada a desenhar o arco 18 inteiro em sub-planos de ≤7 passos, **para não repetir o custo do 17** (duas sessões, perda de contexto de auditoria por autocompactação). A revisão apontou o princípio que guiou os passos: o glob do `asarUnpack` se escreve **depois de observar o `node_modules` real**, nunca chutado; o nome do arquivo de saída do worker é observado, não escrito de antemão. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| A ordem exigida dos `SET` do motor restrito | skill [`data`](../../../.claude/skills/data/SKILL.md) + [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| `utilityProcess.fork` com `stdio: 'inherit'` não repassa output no Windows | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| `smartUnpack: true` já desempacota `.node` sozinho | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| `shamefullyHoist: false` expõe dependência fantasma (`@types/hast`) | [`ARMADILHAS.md`](../../ARMADILHAS.md) + skill [`architecture`](../../../.claude/skills/architecture/SKILL.md) |
| Decisões D18A.1–D18A.5 | [`DECISOES.md`](../../DECISOES.md) |

⚠️ **Scaffolding deliberado, removido depois:** `probeDuckdbWorker()` rodava a cada boot, inclusive empacotado (D18A.5) — o 18-B o trocou pelo canal real.