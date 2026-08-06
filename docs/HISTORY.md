# Histórico de decisões e entregas — data-lab

Changelog em ordem cronológica inversa. **Uma entrada curta por marco**, com link para o plano correspondente em [`plan/implemented/`](plan/implemented/) ou [`plan/archive/`](plan/archive/). O detalhe completo vive no plano linkado; aqui fica só o "o quê + por quê". Pendências ficam em [`ROADMAP.md`](ROADMAP.md) e [`plan/active/`](plan/active/).

> **Fonte única de história.** O `CLAUDE.md` e as skills apenas **apontam** para cá — não narram plano concluído nem repetem justificativa de decisão.

---

## Como escrever uma entrada

Uma entrada nasce quando um plano sai de `active/` para `implemented/`. O formato é fixo:

```markdown
### Título do marco (mês/ano)
Origem: o que motivou. Entrega: o que passou a existir. Decisões: o que foi escolhido
e o que foi descartado, com o porquê. [`plan/implemented/NOME.md`](plan/implemented/NOME.md).
```

Três a oito linhas. Se precisar de mais, o detalhe pertence ao plano, não aqui.

**O que nunca pode faltar:** a alternativa descartada e o motivo do descarte. É o único conteúdo que não se recupera lendo o código depois — o código mostra o que foi feito, nunca o que foi considerado e rejeitado.

---

## Entregas (marcos)

### Fase 04 — testes rápidos (ago/2026)
Origem: um handler de IPC que é closure só é alcançável subindo o Electron inteiro — a fase 02 já resolveu isso ao tornar handlers funções exportadas, mas sem suíte nenhuma essa propriedade ficava sem prova. Entrega: Vitest com `test.projects` num único `vitest.config.ts` (dois projetos, `node` e `jsdom`, espelhando os dois `tsconfig`), coverage v8 em `core/` e `shared/` com piso de 85%, `check:fast` reunindo typecheck + lint + testes. Testes dos três primeiros níveis da pirâmide: handlers de `app` e `shell` sem subir o Electron, `Versions` com a API falsa `satisfies Api`, e os primeiros auxiliares de `core/` (`ok`/`err` do `Result`). Decisões: globals do Vitest declarados manualmente no ESLint em vez de importar o pacote `globals` (só disponível de forma transitiva — usá-lo sem declarar seria a dependência fantasma que o `shamefullyHoist: true` já deixa como risco conhecido). [`plan/implemented/04-testes-rapidos.md`](plan/implemented/04-testes-rapidos.md).

### Fase 03 — sandbox e segurança (ago/2026)
Origem: `sandbox: false` era herdado do template do electron-vite desde o scaffold, sem justificativa própria do projeto — pendência registrada desde as fases 00/01 e deliberadamente adiada até o preload ficar fino o bastante (fase 02) para a mudança custar uma linha, não uma tarde de depuração sob pressão. Entrega: `sandbox: true`, `contextIsolation` e `nodeIntegration` explícitos em `webPreferences`, `will-navigate` negando navegação para fora da origem do app (exceto o HMR em dev), `backgroundColor` provisório no `BrowserWindow`, e a tabela de estado da fronteira de segurança no `CLAUDE.md` substituindo a afirmação desatualizada. Decisões: `shamefullyHoist: true` mantido — desligar exige validar o primeiro módulo nativo, que ainda não existe; gatilho de revisão é a instalação do DuckDB. CSP e assinatura de código seguem adiadas — nada a proteger ou distribuir ainda. [`plan/implemented/03-sandbox-e-seguranca.md`](plan/implemented/03-sandbox-e-seguranca.md).

### Fase 02 — contrato IPC (ago/2026)
Origem: o exemplo de IPC do scaffold (`ipcMain.on('ping', ...)`) reunia os três problemas que a fase existe para fechar — string de canal não verificada nos dois lados, preload expondo `ipcRenderer.send/on/invoke` genéricos, e exceção de handler que chega ao renderer como `Error` genérico, com classe e stack originais perdidos no *structured clone*. Entrega: `src/shared/ipc.ts` (contrato tipado, `Result`/`AppError`, tipos de job reservados), `src/main/ipc/registry.ts` + `register-all.ts` (único lugar que conhece `ipcMain.handle`, valida payload com zod), handlers de `app` e `shell` como funções exportadas testáveis sem subir o Electron, preload reescrito expondo só `api: Api`, renderer consumindo o contrato. Decisões: `openExternal` já recebe a função de abertura por parâmetro (DIP) — antecipando o que a fase 04 pediria como ajuste, evitando retrabalho; validação só nos argumentos (`renderer → main`), nunca na saída do main, que é código próprio rodando privilegiado. [`plan/implemented/02-contrato-ipc.md`](plan/implemented/02-contrato-ipc.md).

### Fase 01 — camadas e fronteiras (ago/2026)
Origem: primeira fase executável do plano de fundação, sem dependências. Entrega: seis pastas em `src/` (`shared/`, `core/`, `main/`, `workers/`, `preload/`, `renderer/`), aliases únicos (`@shared`, `@core`, `@renderer`) declarados em `config/aliases.ts` e a tabela de importação entre camadas virada regra de `no-restricted-imports` no ESLint. Decisões: `shared/` e `core/` ficam separados — vocabulário versus comportamento — em vez de uma pasta só; `eslint-plugin-boundaries` descartado por ser dependência nova para um problema que ainda não existe (só há uma feature planejada), revisitar na sexta fatia de `features/`. [`plan/implemented/01-camadas-e-fronteiras.md`](plan/implemented/01-camadas-e-fronteiras.md).

### Escopo e plano de fundação definidos (ago/2026)
Origem: quatro commits no repositório, dos quais três eram documentação e um o scaffold do `electron-vite` intocado — a posição mais barata que existe para tomar decisões estruturais. Entrega: o [`ESCOPO.md`](ESCOPO.md) fecha o produto (bancada local de limpeza e transformação de arquivos, por pipeline de passos que compila para SQL do DuckDB); o [plano de fundação](plan/active/README.md) descreve oito fases, 33 passos, cada um com critério de aceite verificável e mensagem de commit; a [camada de IA](plan/active/09-camada-de-ia.md) registra como Ollama, Gemini, GLM e ML se encaixam sem exigir replanejamento. Critério que ordena tudo: **se eu adiar isto, quantos arquivos vou tocar quando finalmente fizer?** Nada de código foi escrito.

---

## Decisões arquiteturais (justificativas citáveis)

Decisões que valem além do plano onde nasceram. Cada uma é curta de propósito — o raciocínio completo mora no documento linkado.

### Decisão: erro que atravessa o IPC é dado, não exceção
Exceção não sobrevive ao `structured clone` do Electron. Se um handler lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado com `Error invoking remote method`, e a classe, as propriedades customizadas e o stack original se perdem. Um `QuerySyntaxError { line, column }` chegaria ao React como texto inútil. Por isso toda operação que atravessa a fronteira retorna união discriminada. **Contrapartida deliberada:** payload fora do schema **lança** — é bug de programação, e um erro mutilado no console durante o desenvolvimento é a resposta certa. [`plan/implemented/02-contrato-ipc.md`](plan/implemented/02-contrato-ipc.md)

### Decisão: pipeline de passos, não SQL-first
A composição de uma transformação vive numa lista ordenada de operações que compila para SQL, e não numa consulta única. Descartado o modelo query-first do mill.tools: ele serve para *perguntar* ao dado, e aqui o trabalho é *tratar* o dado — iterativo, com o resultado de um passo mudando o que se quer no seguinte. Desfazer vira remover um passo, cada passo é inspecionável, e a sequência é uma receita reaplicável a outro arquivo. Descartada também a grade editável célula a célula: exigiria estado mutável, desfazer por diff e escrita através da virtualização. [`ESCOPO.md`](ESCOPO.md)

### Decisão: NL→passo, não NL→SQL
Revisão de uma decisão anterior. A intenção original era portar o `nl2sql` do mill.tools; o modelo de pipeline a invalidou. Gerar SQL opaco a partir de português contorna o que dá valor ao modelo — passo é editável e inspecionável, SQL de trinta linhas não é. A IA passa a produzir **a mesma estrutura de dados que a interface produz**, o que a torna barata e a obriga a vir depois do pipeline. Privacidade inegociável nos dois casos: o modelo recebe o esquema, nunca as linhas. [`plan/active/09-camada-de-ia.md`](plan/active/09-camada-de-ia.md)

### Decisão: chamada de modelo no main; cálculo sobre vetores no `utilityProcess`
Contraria a intuição criada pelo raciocínio do DuckDB, e a distinção é o ponto. O DuckDB precisa de processo separado porque é limitado por CPU e bloqueia a thread; uma requisição HTTP ao Ollama ou ao Gemini é limitada por entrada e saída, e o `fetch` assíncrono devolve o controle ao *event loop*. Já recuperação de RAG — cosseno sobre matriz, BM25, MMR — **é** limitada por CPU e acompanha o DuckDB. A fronteira é *quem bloqueia a thread*, não *o que parece pesado*. [`plan/active/09-camada-de-ia.md`](plan/active/09-camada-de-ia.md)

### Decisão: segredo é de mão única — o renderer escreve, nunca lê
O contrato de credenciais tem `set`, `status` e `clear`, e não tem `get`. Chave que chega ao renderer entra em estado do React, aparece no DevTools e vai parar em relatório de erro. Armazenamento é `safeStorage` (DPAPI no Windows) em `app.getPath('userData')` — **nunca `.env` na raiz**: o mill.tools pode fazer isso porque roda do fonte; app empacotado que lê `.env` da raiz distribui a chave junto com o instalador. Regra fixada antes de existir a primeira chave. [`plan/implemented/03-sandbox-e-seguranca.md`](plan/implemented/03-sandbox-e-seguranca.md)

### Decisão: SOLID entra parcial — ISP e DIP sim, OCP não
SOLID nasceu em OOP de classes, num mundo onde a biblioteca era distribuída em binário e não se podia editar o fonte. **ISP** é adotado — é o argumento contra expor um `invoke(canal, args)` genérico no preload. **DIP** é adotado na forma nativa da linguagem: parâmetro de função tipado, sem container de injeção, que é imposto de Java numa linguagem com função de primeira classe. **OCP é recusado**: somos donos do repositório e temos git, e ponto de extensão especulativo é retrabalho antecipado. SRP já está coberto pela régua de coesão; LSP é quase inaplicável com união discriminada. [`plan/active/00-visao-geral.md`](plan/active/00-visao-geral.md)

### Decisão: TanStack Query adiado, e a régua é que decidiu
A intenção declarada era adotá-lo na primeira feature vertical. Aplicado o critério do próprio plano — *se eu adiar, quantos arquivos toco depois?* — a resposta foi dois hooks. As duas operações são mutações; o que a biblioteca entrega de fato (cache com chave, invalidação, deduplicação) não tem uso antes de existirem consultas repetidas sobre o mesmo dado. Registrado como exemplo de decisão revista pela régua, e não por preferência. **Gatilho** em [`ROADMAP.md`](ROADMAP.md). [`plan/active/06-primeira-feature.md`](plan/active/06-primeira-feature.md)

### Decisão: tokens em CSS custom properties, sem Tailwind
Reversível de propósito, e vale registrar por quê. O `@theme` do Tailwind v4 resolve bem a fonte única, mas é dependência que afeta o build num projeto ainda validando a própria fundação. Como os tokens são custom properties, o Tailwind pode ser adicionado depois **lendo o mesmo arquivo**, sem reescrever token nenhum: adiar custa conveniência de escrita, não estrutura. Descartada sem volta a biblioteca de componentes (MUI, Chakra, shadcn) — trazem densidade e vocabulário de web, que é o oposto do que um app de desktop precisa. [`plan/active/05-design-tokens.md`](plan/active/05-design-tokens.md)

### Decisão: hooks do Claude Code em `.mjs`, não `.py`
O mill.tools usa Python porque Python **é** a stack dele. Aqui seria a exceção: Node já é dependência obrigatória, Python não — e no Windows um `python` no PATH pode ser o stub da Microsoft Store, que abre a loja em vez de executar. Ganho concreto além disso: o `guard.mjs` lê o `tokens.css` do próprio projeto e valida `var(--token)` contra as declarações reais, o que a versão em regex não fazia. Os binários são resolvidos pelo campo `bin` do `package.json` de cada dependência e executados com o próprio Node — sem shell, o que elimina PATHEXT e aspas em caminho com espaço. [`plan/active/08-automacao-e-registro.md`](plan/active/08-automacao-e-registro.md)

---

## Armadilhas diagnosticadas

Registradas para não repetir o trabalho de investigação. As da montagem inicial estão detalhadas em [`study/04-diario-de-bordo.md`](study/04-diario-de-bordo.md).

### Import de `electron` no arquivo do handler quebra em teste Node puro, mesmo só como valor default (ago/2026)
Fora do binário real, o pacote npm `electron` tem `module.exports = getElectronPath()` — o módulo inteiro é uma *string* (o caminho do executável), não o objeto com `app`/`shell`/etc. Um handler como `openExternal(args, fn = shell.openExternal)` ainda importa `{ shell } from 'electron'` no topo do arquivo, e isso é resolvido pelo dep-optimizer do Vite mesmo que o valor nunca seja de fato acessado nos testes (que sempre passam o parâmetro explícito). Isolado, o teste desse handler passou; rodado junto com o teste de outro handler que também importava `electron`, um dos dois quebrou com `SyntaxError: Named export '...' not found` — dependente do cache do otimizador, não determinístico. Correção: nenhum handler testável importa `electron` por valor, nem como default de parâmetro. O parâmetro fica obrigatório, e só o composition root (`register-all.ts`, que nenhum teste alcança) importa `electron` de verdade. [`plan/implemented/04-testes-rapidos.md`](plan/implemented/04-testes-rapidos.md)

### `types` explícito no `tsconfig` remove a inclusão implícita de `@types/*` (ago/2026)
Sem o campo `types` em `compilerOptions`, o TypeScript inclui automaticamente todo `@types/*` presente em `node_modules`. Adicionar `"types": ["vitest/globals"]` ao `tsconfig.web.json` (necessário para `describe`/`it`/`expect` globais) substitui essa lista inteira pela declarada — `@types/node` (dono do namespace `NodeJS` usado em `shared/ipc.ts`) parou de entrar, e `pnpm typecheck:web` passou a falhar com `Cannot find namespace 'NodeJS'`. Corrigido listando `"node"` explicitamente ao lado de `"vitest/globals"`. Vale para qualquer `tsconfig` que ganhe `types` pela primeira vez. [`plan/implemented/04-testes-rapidos.md`](plan/implemented/04-testes-rapidos.md)

### `ArrayBuffer` transferível **não** é transferência de posse entre processos (ago/2026)
O [`study/05-proximos-passos.md`](study/05-proximos-passos.md) afirmava que o transferível torna a travessia "praticamente instantânea, independente do tamanho". Isso vale **dentro** de um processo — renderer para Web Worker, onde a memória é a mesma. Entre processos do sistema operacional os bytes são copiados de qualquer forma, e a implementação do Electron tem limitações conhecidas (mensagem que chega vazia ao transferir de renderer para main; crash com certos `ArrayBuffer` na lista de transferíveis do `MessagePortMain`). **A decisão por Arrow continua certa, por outro motivo:** o *structured clone* binário elimina a alocação de um milhão de objetos e a conversão para texto. É cópia rápida de bloco contíguo, não transferência de posse — e a diferença sobre JSON segue sendo de ordens de grandeza. Ação: medir no passo 5 daquele plano em vez de assumir milissegundos.

### Hook que se desliga sozinho em silêncio (ago/2026)
A primeira versão do `_shared.mjs` devolvia `null` quando não conseguia resolver o executável de uma dependência, e os hooks simplesmente não faziam nada. Um teste que parecia confirmar "o Prettier rodou e não alterou o arquivo" era falso positivo: o arquivo ficou intacto por inação. **Hook que se desliga sem avisar é pior que hook ausente**, porque se conta com ele. Corrigido com duas estratégias de resolução (caminho direto e o resolvedor do próprio Node, para os layouts em que a junction do pnpm não atravessa) e, principalmente, com um aviso no stderr quando o pacote **está** instalado mas não pôde ser resolvido. Pacote genuinamente ausente segue silencioso — é o caso legítimo do Vitest antes da fase 04.

---

## Mudanças de ambiente

*Nenhuma registrada. As exclusões do Windows Defender aplicadas na máquina de desenvolvimento estão no [`CLAUDE.md`](../CLAUDE.md), porque são configuração viva e não histórico.*
