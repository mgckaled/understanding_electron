# Histórico arquivado — crivo

Registro de **trilhas inteiramente encerradas** — fundação (fases 00-08), trilha DS (design system), trilha R (refatoração) e trilha F (features avulsas) migram para cá conforme fecham, comprimidas, para o [`HISTORY.md`](HISTORY.md) não crescer sem teto. `HISTORY.md` é a fonte para **tudo ativo**; aqui é só leitura histórica.

> ⚠️ Este arquivo é **só leitura histórica**, como [`plan/archive/`](plan/archive/). Link interno aqui não se conserta depois de escrito — o custo é real e o benefício, nenhum.

Formato e critério de arquivamento: [`docs/README.md`](README.md) e a entrada de nascimento da trilha R-2 em [`HISTORY.md`](HISTORY.md).

---

## Entregas (marcos)

### Fase 08 — automação e registro (ago/2026)
Origem: sete fases tomaram decisões que, sem registro, se perderiam na próxima feature. Entrega: quatro hooks em `.claude/settings.json` (três `PostToolUse` — formatar, guardar invariantes, `vitest related` — e um `Stop` com `check:fast`); `CLAUDE.md` reescrito para o estado pós-fundação; plano de fundação arquivado em `implemented/`. Decisões: `.prettierignore` passa a ignorar `*.md` (evita ruído no diff); E2E fica fora do hook, ciclo de retorno longo é trabalho agrupado. Descartado: tabela própria de armadilhas na skill `design-system` e consolidação de gatilhos no README — os dois já tinham dono (`HISTORY.md`/diário de bordo e `ROADMAP § 2`), duplicar violaria fonte única. [`plan/implemented/08-automacao-e-registro.md`](plan/implemented/08-automacao-e-registro.md)

### Caderno de estudos retomado, e a regra que o mantém vivo (ago/2026)
Origem: o caderno documentava o scaffold enquanto sete fases já tinham sido executadas, e parte dele ensinava o que o repositório já contradizia (`sandbox: false`, IPC pelo `ping` do template). Entrega: seis cadernos novos cobrindo as fases 01–07, reescrita do 03 para a árvore real, correção factual do 01 e do 05. Decisão: numeração não renumerada — 34 referências externas tornam link morto mais caro que índice fora de ordem. Descartado: dissolver o caderno 03 nos novos — mantém o papel de "onde as coisas moram", e o número preserva os links.

### Princípio: o caderno ensina o mecanismo, o número mora no dono
Documentação didática que cita versão/data de release precisa de manutenção a cada ciclo — e num framework de cadência curta, isso significa que não recebe manutenção e passa a mentir. Regra: o material de estudo explica o mecanismo e **aponta** para o dono quando o número for indispensável (`CLAUDE.md` para stack em uso, `ROADMAP.md` para o que falta subir) — fonte única aplicada ao tempo. Nasceu de um fato prático: validar as afirmações datadas do caderno 02 deu um resultado **errado** vindo da web, enquanto o `peerDependencies` do pacote instalado respondia em segundos. Corolário: **para saber o que um pacote suporta, leia o manifesto em `node_modules`, não um artigo.**

### Fase 07 — E2E e empacotamento (ago/2026)
Origem: defeito que só aparece com o app empacotado de verdade (caminho relativo à raiz dentro do `asar`, binário nativo não desempacotado). Entrega: Playwright em dois projetos (`dev` contra `out/`, `packaged` contra `dist/win-unpacked/`), três specs de nível 4, um smoke test de nível 5 provado pelo ciclo vermelho→verde. Decisão: nível 5 roda sob demanda, nunca no ciclo de edição. Achado sério: `.claude/settings.local.json` (chave de API pessoal) vazava para dentro do `app.asar`, junto com `coverage/`/`docs/`/`e2e/` — `electron-builder` empacota direto do disco, não do que o `git` rastreia, e `.gitignore` sozinho não protege o instalador. [`plan/implemented/07-e2e-e-empacotamento.md`](plan/implemented/07-e2e-e-empacotamento.md)

### Fase 06 — primeira feature vertical (ago/2026)
Origem: cinco fases anteriores entregaram peças que nunca funcionaram juntas. Entrega: `open-dataset` de ponta a ponta — diálogo nativo → leitura assíncrona → dedução de separador (`core/dataset/scan.ts`) → progresso throttled → cancelamento real via `AbortController` → `StateView` nos seis estados. Decisões: TanStack Query segue adiado; progresso transmitido a todas as janelas, não só ao remetente (gatilho: segunda janela); cancelamento de stream exige `stream.destroy()` além de `rl.close()` — medido, não suposto. [`plan/implemented/06-primeira-feature.md`](plan/implemented/06-primeira-feature.md)

### Fase 05 — design tokens (ago/2026)
Origem: renderer ainda era a tela de boas-vindas do template. Entrega: `tokens.css` em dois níveis (primitivo, semântico), tema claro via `prefers-color-scheme`, base de comportamento de desktop, quatro primitivos (`Button`/`Field`/`Panel`/`Toolbar`) em CSS Modules, `ViewState<T>`/`StateView`, registro de mensagens de erro com cobertura forçada no `typecheck`. Decisões: Tailwind v4 adiado, não descartado — tokens já são custom properties, dá para adotar depois sem reescrever; biblioteca de componentes descartada sem volta (densidade de web é o problema). [`plan/implemented/05-design-tokens.md`](plan/implemented/05-design-tokens.md)

### Fase 04 — testes rápidos (ago/2026)
Origem: handler de IPC como closure só é alcançável subindo o Electron inteiro; a fase 02 já resolveu isso, faltava suíte que provasse. Entrega: Vitest com `test.projects` (`node`+`jsdom`), coverage v8 em `core/`/`shared/` com piso de 85%, `check:fast` reunindo typecheck+lint+testes, primeiros testes dos três níveis. Decisão: globals do Vitest declarados manualmente no ESLint, não importando o pacote `globals` (só disponível de forma transitiva). [`plan/implemented/04-testes-rapidos.md`](plan/implemented/04-testes-rapidos.md)

### Fase 03 — sandbox e segurança (ago/2026)
Origem: `sandbox: false` herdado do template, adiado deliberadamente até o preload ficar fino o bastante para custar uma linha, não uma tarde. Entrega: `sandbox`/`contextIsolation`/`nodeIntegration` explícitos, `will-navigate` negando navegação para fora da origem, tabela de estado da fronteira no `CLAUDE.md`. Decisão: `shamefullyHoist: true` mantido até o primeiro módulo nativo (gatilho: DuckDB); CSP e assinatura de código adiadas — nada a proteger ou distribuir ainda. [`plan/implemented/03-sandbox-e-seguranca.md`](plan/implemented/03-sandbox-e-seguranca.md)

### Fase 02 — contrato IPC (ago/2026)
Origem: o exemplo de IPC do scaffold reunia três problemas — canal não verificado, preload genérico, exceção virando `Error` genérico no renderer. Entrega: `src/shared/ipc.ts` (contrato tipado, `Result`/`AppError`), `registry.ts`+`register-all.ts` como único lugar que conhece `ipcMain.handle`, handlers como funções exportadas testáveis, preload expondo só `api: Api`. Decisão: validação só nos argumentos (`renderer → main`), nunca na saída do main. [`plan/implemented/02-contrato-ipc.md`](plan/implemented/02-contrato-ipc.md)

### Fase 01 — camadas e fronteiras (ago/2026)
Origem: primeira fase executável do plano de fundação. Entrega: seis pastas em `src/`, aliases únicos (`@shared`/`@core`/`@renderer`), tabela de importação entre camadas virada regra de `no-restricted-imports`. Decisão: `shared/` e `core/` separados (vocabulário vs. comportamento); `eslint-plugin-boundaries` descartado por ser dependência nova para um problema ainda inexistente. [`plan/implemented/01-camadas-e-fronteiras.md`](plan/implemented/01-camadas-e-fronteiras.md)

### Escopo e plano de fundação definidos (ago/2026)
Origem: quatro commits no repositório, três de documentação e um o scaffold intocado — a posição mais barata para decisões estruturais. Entrega: `ESCOPO.md` fecha o produto inicial (bancada local de limpeza/transformação por pipeline de passos compilando para SQL do DuckDB); plano de fundação com oito fases, 33 passos, cada um com critério de aceite; a camada de IA registrada para não exigir replanejamento depois. Critério que ordenou tudo: **se eu adiar isto, quantos arquivos vou tocar quando finalmente fizer?**
