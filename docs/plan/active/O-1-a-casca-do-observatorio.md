# O-1 — A casca do observatório, e os dois painéis que não custam nada

> Primeiro plano da trilha O. A fundamentação inteira — os seis eixos, o inventário classificado, o critério `crivo.db` vs. `observatory.db`, as regras de leveza — é de [`docs/reference/observatory/`](../../reference/observatory/README.md). Este plano **não a repete: aplica**. Toda referência a "§ n" abaixo é seção daquele documento.

**Origem:** a trilha nasceu do brief em [`notes/observatory/brief.md`](../../../notes/observatory/brief.md) e da leitura do observatório do mill.tools no fonte. A classificação de custo/trabalho/situação escolheu este corte: são os únicos painéis **Grátis** que também leem estado que já existe.

**Entrega:** `features/observatory/` — o gatilho no rodapé da sidebar, o modal largo com sidebar própria e registro de painéis, o carregamento tardio do módulo inteiro, e **dois** painéis: _Runtime_ (versões e memória, absorvendo o `Versions` de hoje) e _Processos_ (`app.getAppMetrics`, um canal novo). Nenhuma persistência nova, nenhum `observatory.db`, nenhuma instrumentação em caminho quente.

---

## O que a sondagem achou, e que o desenho não previa

Context7 (Electron, React, TanStack Query) e leitura do fonte em 28/08/2026:

| Afirmação plausível | O que é verdade |
| --- | --- |
| O painel de Runtime é código novo | ⚠️ **Metade dele já existe e está no lugar errado:** `components/Versions.tsx` lê `app:info` e vive **dentro de Configurações** — junto de `LoadedModels` e `CloudSecrets`, que são conteúdo de _Capacidades_ (O-4). Configurações virou um observatório acidental |
| Basta um painel para provar a casca | ⚠️ **Não.** A invariante da § 4.2 — "só o painel ativo monta" — é **intestável com um painel só**: não há o que desmontar. Dois é o mínimo para o teste existir |
| `lazy`/`Suspense` já devem estar em uso | **Não estão** — `grep` não acha nenhum uso em `src/renderer/`. O-1 é o primeiro consumidor, e a regra 2 da § 4.3 depende dele |
| `app.getAppMetrics()` só enxerga janela e main | Enxerga **todos**, e `type` inclui `'Utility'` — **o worker do DuckDB aparece sozinho**, sem uma linha de instrumentação |
| Memória é memória | ⚠️ **Duas unidades.** `SystemMemory` (`app:memory`) é `{ freeBytes, totalBytes }` em **bytes**; `ProcessMetric.memory` do Electron é **kilobytes**. Misturar as duas num painel é o defeito que ninguém revisa |
| `idleWakeupsPerSecond` é uma coluna útil | **Sempre 0 no Windows.** Renderizá-la nesta máquina é renderizar um zero permanente |
| O `Dialog` serve como está | Não: `width: min(420px, 90vw)` está no `Dialog.module.css`, e o observatório precisa ser largo. Precisa de variante — **não** de um segundo `<dialog>` |
| `Settings` precisaria de refatoração para servir de molde | Não. Ele já é **exatamente** o molde: gatilho + `Dialog` no mesmo componente, estado local, **duas instâncias** em `App.tsx` (rodapé e trilho recolhido), sem estado içado |

Achado de graça: `lazy` **memoiza depois da primeira carga** — abrir, fechar e reabrir o modal não repete o `fallback`. O custo do carregamento tardio é pago uma vez por sessão, e só se o usuário abrir.

---

## Decisões

### DO1.1 — A casca copia o padrão de `Settings`, não inventa provider

`Observatory.tsx` carrega gatilho e `Dialog` no mesmo componente, com `useState` local, e entra em `App.tsx` **duas vezes** — rodapé e `collapsedRail` —, exatamente como `Settings`. Nada de `ObservatoryProvider`: o estado de "qual painel está aberto" não é lido por ninguém fora do modal, e um provider a mais no topo da árvore paga render em toda a aplicação para servir a um consumidor que fica fechado a maior parte do tempo.

### DO1.2 — Dois painéis, porque um não prova a invariante

A regra que sustenta a leveza do modal inteiro é "só o painel ativo monta" (§ 4.2). Com um painel só, o teste que a defende não pode existir — não há transição para observar. O segundo painel não é conteúdo extra: **é o instrumento**.

### DO1.3 — `lazy` + `Suspense` na fronteira do modal, não por painel

O `import()` dinâmico envolve o **módulo inteiro** do observatório (casca + painéis), não cada painel. Dividir por painel multiplicaria os _chunks_ sem ganho: a partir do momento em que o modal abre, o usuário vai navegar entre eles, e um `fallback` a cada clique de categoria é pior que um único na abertura.

O `Suspense` fica **dentro** do `Observatory.tsx`, ao redor do conteúdo do `Dialog` — não em volta do gatilho, que precisa renderizar sempre.

### DO1.4 — `Versions` muda de casa

> **Configurações é o que você muda. Observatório é o que você olha.**

`components/Versions.tsx` vai para `features/observatory/`, absorvido pelo painel Runtime; a linha some do modal de Configurações. É a primeira aplicação do critério, e ele volta em O-4 para `LoadedModels`/`CloudSecrets` — que são _Capacidades_ morando no lugar errado pelo mesmo motivo histórico (não havia observatório quando nasceram).

⚠️ **É mudança visível ao usuário**, não refatoração interna. Registrada como decisão para poder ser vetada antes do passo 3, não depois.

### DO1.5 — Um canal novo, e ele não devolve `Result`

`app:processes` entra no domínio `app`, ao lado de `info` e `memory`, e segue a régua da skill [`ipc`](../../../.claude/skills/ipc/SKILL.md): **não embrulha em `Result`**, porque não tem como falhar — `app.getAppMetrics()` é leitura de runtime, o mesmo argumento que já isenta `app:info` e `app:memory`.

Um canal, não três: Runtime já é servido pelos dois canais existentes.

### DO1.6 — A normalização é pura, e mora em `core/observatory/`

O handler não formata. `summarizeProcesses()` em `src/core/observatory/processes.ts` recebe os metrics crus, **converte kilobytes para bytes** (a unidade única do contrato, DO1.7), ordena por memória e descarta o que não se exibe. Puro, sem `electron`, nível 1 com a meta de 85% que `core/` já tem.

O handler fica com uma linha, e recebe a fonte por parâmetro — `readProcesses(getMetrics)` —, o mesmo DIP que `getAppInfo(app.getVersion, is.dev)` já usa em `main/features/app/handlers.ts`. É o que o torna chamável em Node puro, sem subir o Electron.

### DO1.7 — Bytes em todo o contrato

`AppProcess.memoryBytes`, nunca `memoryKb`. O contrato já fixou bytes em `SystemMemory`, e a conversão acontece **uma vez**, no limite de `core/`. Duas unidades atravessando o IPC é o tipo de defeito que passa por revisão e aparece como "a memória do processo está 1000× menor".

### DO1.8 — `idleWakeupsPerSecond` não entra no contrato

Não é decisão de layout: é o campo **não ser coletado**. Um número que o sistema operacional garante ser zero não vira coluna para depois alguém investigar por que é zero. Se o app um dia rodar em macOS/Linux, o campo entra com a plataforma que o preenche.

### DO1.9 — O `Dialog` ganha variante de tamanho, e não um irmão

`Dialog` recebe `size?: 'default' | 'wide'`, que só troca a classe do módulo CSS. A alternativa — um `<dialog>` próprio do observatório — reimplementaria três coisas que o comentário do `Dialog.module.css` documenta como carregadas de motivo: o `[open]`-escopo do `display` (sem ele, um diálogo **fechado** intercepta clique), o `::backdrop` e o `@starting-style`. Duplicar isso para mudar uma largura é o pior negócio disponível.

### DO1.10 — A sidebar do modal é derivada de um registro, nunca escrita à mão

`panels.ts` exporta `{ id, group, label, Panel }[]`; a sidebar renderiza os grupos que **têm** painel. Em O-1 aparece só _Estado_; cada plano seguinte acrescenta uma entrada e a navegação acompanha sozinha.

É a regra 5 da § 4.3, e a razão dela está registrada: no mill.tools, a única parte do painel de disco escrita como lista à mão foi a única que envelheceu (§ 1.6).

### DO1.11 — Nada persiste, e isso é o corte

Sem `observatory.db`, sem tabela, sem migração, sem contador acumulado. Os dois painéis leem o **agora**. É o que mantém O-1 num corte pequeno e o que o deixa entregável sem decidir nada sobre retenção — que é assunto de O-6.

---

## O canal, nos seis lugares

| # | Onde | O quê |
| --- | --- | --- |
| 1 | `src/shared/ipc.ts` → `argsSchema` | `'app:processes': z.void()` |
| 2 | `src/shared/ipc.ts` → `IpcContract` | `{ args: …; result: AppProcess[] }` |
| 3 | `src/shared/ipc.ts` → `Api` | `app.processes: () => Promise<AppProcess[]>` |
| 4 | `src/main/features/app/handlers.ts` | `readProcesses(getMetrics)` — exportada, dependência por parâmetro |
| 5 | `src/main/ipc/register-all.ts` | `handle('app:processes', () => readProcesses(() => app.getAppMetrics()))` |
| 6 | `src/preload/index.ts` | `invoke('app:processes')` |

O sétimo avisa sozinho: `test/api-mock.ts` é `satisfies Api` e para de compilar sem o método.

```ts
export type AppProcess = {
  pid: number
  type: string // 'Browser' | 'Tab' | 'Utility' | 'GPU' | …
  name?: string
  cpuPercent: number
  memoryBytes: number // residentSet, convertido de KB na fronteira de core/ (DO1.7)
}
```

---

## Passos

### 1. A casca (DO1.1, DO1.9, DO1.10)

`Dialog` ganha `size`; `features/observatory/` ganha `Observatory.tsx` (gatilho + modal), `panels.ts` (o registro) e `ObservatoryShell.tsx` (as duas colunas). Um painel de mentira, com um texto fixo, serve de conteúdo até o passo 3 — ele existe para a casca ser verificável antes de haver dado.

`App.tsx` recebe o gatilho nos dois lugares onde `Settings` já está.

Nível 2: o modal fechado não renderiza painel nenhum; trocar de categoria **desmonta** a anterior (a asserção que a DO1.2 existe para permitir); `Esc` fecha e devolve o foco ao gatilho.

⚠️ A verificação de que o `Dialog` largo continua fechando corretamente é **ao vivo** — jsdom não implementa `<dialog>`, e o shim de `test/setup-renderer.ts` só permite montar.

### 2. O carregamento tardio (DO1.3)

O corpo do modal passa a `lazy(() => import('./ObservatoryShell'))`, com `Suspense` dentro de `Observatory.tsx`. O gatilho continua estático.

A prova é de **build, não de teste**: `pnpm build` tem de mostrar um _chunk_ separado, e o bundle inicial do renderer tem de **encolher** em relação à medição anterior. Anotar os dois números no diário — a estimativa do E-2 errou por 2,2×, e o que se cita é o número do build.

### 3. Painel Runtime (DO1.4)

`Versions` sai de `components/` e vira o painel, com o teste junto. Ganha a memória do sistema (`app:memory`) ao lado das versões, sob TanStack Query: `app:info` com `staleTime: Infinity` (fatos imutáveis do build), `app:memory` com janela curta (muda enquanto o app está aberto — é o que a D15.2 registra).

A linha some de Configurações no mesmo commit; deixar as duas seria a duplicação que a DO1.4 recusa.

### 4. O canal e o painel Processos (DO1.5–DO1.8)

`core/observatory/processes.ts` primeiro, com nível 1: converte KB para bytes, ordena, e **não** inventa campo para plataforma que não preenche. Depois o canal nos seis lugares, com nível 3 chamando `readProcesses` como função comum, contra uma fonte de metrics falsa.

⚠️ Nenhum `import` de `electron` por valor no arquivo de handler — nem como default de parâmetro. Fora do binário, `node_modules/electron/index.js` exporta uma _string_.

Nível 2 do painel: a linha do processo `Utility` aparece com o rótulo que o identifica como o worker de dados — é o retorno que justifica o painel, e é o que um teste sobre dado falso consegue provar.

### 5. Conferência ao vivo — com o usuário

Curta, e só o que teste nenhum alcança:

1. O modal abre largo, fecha por `Esc` e por clique fora, e a conversa continua atrás dele (o argumento inteiro de ser modal).
2. Com `pnpm dev`, os números de memória batem com o Gerenciador de Tarefas na ordem de grandeza — a prova de que a DO1.7 não inverteu a conversão.
3. **Abrir um dataset antes de abrir o observatório**: o processo `Utility` do DuckDB tem de aparecer na lista. Sem dataset aberto ele pode não existir ainda, e a ausência seria lida como defeito.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- **Provocação obrigatória, uma sabotagem por vez:**
  - trocar `{ativo === id && <Painel />}` por renderizar todos e esconder com CSS → o teste do passo 1 tem de reprovar (é a invariante da § 4.2);
  - remover a conversão de KB para bytes em `summarizeProcesses` → o nível 1 tem de reprovar;
  - fazer `readProcesses` importar `electron` por valor → o nível 3 tem de quebrar ao carregar o módulo.
- **Sem caso E2E novo.** O que resta provar depois dos níveis 1–3 é comportamento de `<dialog>` e número do sistema operacional — o primeiro já é coberto pelo E2E de fronteira existente, o segundo não é observável de dentro do app.

---

## Fora do escopo deste plano

- **`observatory.db`** e qualquer persistência (DO1.11) — é O-6.
- **Instrumentar `registry.ts`, `jobs.ts` ou a fila do worker** — é O-2, e é o plano que dá sentido a contador acumulado.
- **`LoadedModels` e `CloudSecrets` saindo de Configurações** — mesma lógica da DO1.4, mas o destino deles é o painel de _Capacidades_, que é O-4. Mover agora criaria um painel sem casa.
- **A idade do número e o botão de remedir** (§ 4.3) — nenhum painel deste plano é _Caro_. O mecanismo nasce em O-4, com o primeiro consumidor real.
- **Busca dentro do modal** — se paga acima de ~12 painéis; aqui são dois.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data       | Passo(s) | Estado                          | Observação                                                                                                                                                                                            |
| ---------- | -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28/08/2026 | —        | plano escrito, ainda não executado | Escrito depois da fundamentação em `reference/observatory/`. A sondagem achou dois furos no desenho: `Versions` já existe dentro de Configurações (virou a DO1.4, mudança visível ao usuário), e `ProcessMetric.memory` vem em kilobytes contra os bytes do resto do contrato (DO1.7). A DO1.2 saiu de uma pergunta de teste, não de produto: um painel só torna a invariante da leveza intestável. |
