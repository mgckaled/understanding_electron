# R-3 — Sincronização de documentação pós-18/N-1 e nascimento da skill `data`

**Entrega:** `CLAUDE.md`, `README.md` raiz, `docs/README.md`, `package.json`, `.claude/hooks/guard.mjs`, `eslint.config.mjs`, as 5 skills técnicas e uma skill nova (`data`) sincronizados com o estado real do projeto depois que os planos 18-A a 18-F e N-1-A/N-1-B fecharam — fato desatualizado corrigido, três lacunas de hook fechadas, e o assunto "camada de dados" ganhando dono próprio em vez de continuar em um caderno de estudo.

> Terceiro da **trilha R (refatoração)**, transversal ao arco: zero mudança de comportamento do app, leva um padrão já decidido ao que precede. `R-1` aplicou a convenção de comentário a `src/`; `R-2` aplicou atualidade + fonte única à documentação; este repete o gesto do `R-2` num ponto mais adiante da linha do tempo. **Vale dizer com todas as letras:** o próprio `R-2` registrou como objetivo *"não precisar de uma R-3"* — não deu certo, e o motivo está na seção seguinte.
>
> **Aceite global: nenhuma linha em `src/` muda de comportamento.** O que muda é documentação, configuração de hook/lint e material de skill — `git diff --stat -- src/` fica vazio em todo commit, à exceção do próprio `preload/index.ts` e `main/index.ts` não sofrerem edição de conteúdo (só o teto declarado deles muda, em `CLAUDE.md`).

---

## O caso — por que este plano existe

Nasceu de uma auditoria crítica pedida pelo usuário nesta sessão sobre `.claude/hooks/`, `.claude/skills/`, `CLAUDE.md` e `README.md` raiz — não uma leitura, uma verificação: cada achado abaixo foi conferido contra o repositório real (`wc -l`, `grep`, `git log`, `package.json`), não só contra o texto dos documentos.

**O que a verificação achou:**

- `CLAUDE.md` afirma que `pnpm typecheck` roda **dois** projetos; o `package.json` mostra **três** (`typecheck:node && typecheck:web && typecheck:e2e`) — o `README.md` já diz "três" corretamente, então só o `CLAUDE.md` está errado.
- A tabela "Stack fixada" do `CLAUDE.md` não tem linha para Tailwind CSS v4, apesar de `guard.mjs` ter regras dedicadas à gramática v4 e a skill `design-system` inteira ser construída sobre ele.
- A seção "Comandos" do `CLAUDE.md` não lista `pnpm test` nem `pnpm check:fast` — o comando que o próprio `README.md` chama de "o portão".
- `src/preload/index.ts` está em **74 linhas** contra o teto declarado como "**60, sem exceção**"; `src/main/index.ts` está em exatamente **100**, no próprio teto, sem folga. `guard.mjs` não tem nenhuma verificação de contagem de linha — as duas únicas réguas numéricas "sem exceção" do projeto não têm enforcement algum.
- `README.md` badgeia DuckDB e GLM como "planejado" e lista "Motor de dados DuckDB" em "O que ainda falta" — mas os planos `18-A` a `18-F` e `N-1-A`/`N-1-B` já estão em `docs/plan/implemented/`, `@duckdb/node-api`/`apache-arrow` são dependências reais, a extensão `excel` está vendorizada com contagem de bytes travada por versão, e os três últimos commits antes desta sessão fecham o adaptador GLM. Nenhuma entrada no `ROADMAP.md` registrava essa desatualização como pendência conhecida.
- `docs/plan/active/guia-animation-logo.html` é o guia de origem do plano **F-1** (já concluído e movido para `implemented/`), esquecido em `active/` depois que o plano que ele originou fechou.
- `guard.mjs` regra 4 (vazamento de segredo) só verifica `process.env`, não `import.meta.env` — o idioma nativo do Vite para expor variável de ambiente ao bundle do renderer, exatamente na hora em que a trilha N está inserindo chaves de API reais.
- `guard.mjs` regra 9 (isenção de comentário JSX) usa `raw.slice(0, m.index).trimEnd().endsWith('{')`, que não detecta `{/* */}` de fato — só verifica se há uma chave de abertura logo antes, o que também é verdade para qualquer objeto literal (`const x = { /* narrativa banida */ a: 1 }`), furando a regra que a skill `comments` existe para impor.
- Não existe bloco `no-restricted-imports` para `src/preload/**` no `eslint.config.mjs` — só há blocos para `src/shared/**`+`src/core/**` e para `src/renderer/**`. A tabela da skill `architecture` diz que `preload/` nunca importa `core/`/`main/`/`renderer/`, mas nada verifica isso hoje.
- `package.json` encadeia scripts internamente via `npm run` (não `pnpm run`) em `typecheck`, `check:fast`, `build` e outros — funciona porque `npm` vem com o Node, mas destoa da disciplina de "sempre pnpm" que o `CLAUDE.md` deixa explícita.
- O assunto "camada de dados" (DuckDB, `utilityProcess`, Arrow, `dataset:*`) tem como dono `docs/study/05-proximos-passos.md` — um caderno de estudo, não um documento de consulta durante edição — apesar de os planos 18-A a 18-F já terem fechado com veredito medido (Arrow perdeu de JSON em tempo total), motor restrito decidido (`enable_external_access = false`) e binário vendorizado travado por versão. É o mesmo perfil que disparou a separação da skill `ipc` da `architecture` no vigésimo canal.

**Decisão tomada com o usuário:** implementar a lista completa acima (não só o subconjunto de custo trivial que a análise inicial recomendou), porque o valor de manter o registro técnico e histórico coerente vale a pena mesmo num projeto sem público externo — e nascer a skill `data`, separando-a de `docs/study/05-proximos-passos.md`.

---

## Passo 0 — Nascimento do plano

Este arquivo, mais a linha `R-3` no `ROADMAP § 1`. Nenhuma outra edição.

## Passo 1 — `CLAUDE.md`: correções factuais e régua de tamanho

- Seção "Comandos": `pnpm typecheck` de "dois" para "três" projetos (`tsconfig.node.json`, `tsconfig.web.json`, `tsconfig.e2e.json`), e o bloco de código ganha `pnpm test` e `pnpm check:fast`.
- Tabela "Stack fixada": nova linha para Tailwind CSS v4, com a versão e a nota "sobre `tokens.css`, sem substituí-los — trilha DS, ago/2026".
- Régua de tamanho: `src/preload/index.ts` sobe de 60 para 100 (iguala ao teto do `main/index.ts`, que fica como está). A tabela ganha uma nota explícita de que a contagem é o total de linhas do arquivo — comentário e linha em branco inclusos, o que `wc -l` mede — porque hoje nenhum documento define isso e a ambiguidade é o que permitiu o teto antigo ficar violado sem ninguém notar.

## Passo 2 — `README.md` raiz: status e badges

Badge "DuckDB" de "planejado" para refletir o motor concluído (18-A a 18-F); badge "GLM" de "planejado" para refletir o adaptador concluído (N-1-B) — badge "Gemini" continua "planejado", porque N-1-C não rodou. Tabela de stack perde o "(planejado)" do DuckDB. "O que ainda falta" revisado: o que já é verdade sai da lista (o motor em si), o que continua faltando fica (a IA propondo consulta/passos é o plano 19, ainda não começado). Conferir ao vivo se "tabela grande com fluidez" já é entregue pelo 18-C antes de decidir se esse bullet também sai.

## Passo 3 — Limpeza: `guia-animation-logo.html` órfão

Remove `docs/plan/active/guia-animation-logo.html`. Antes de apagar, `grep` por referências a ele fora do próprio `F-1` (que já cita as decisões extraídas dele nominalmente, não por link ao arquivo) — confirmar que nada mais aponta para lá.

## Passo 4 — `package.json`: scripts internos via `pnpm run`

Troca `npm run` por `pnpm run` em `typecheck`, `check:fast`, `build`, `build:unpack`, `build:win`, `test:e2e`, `test:e2e:packaged`. Confirma com `pnpm check:fast` verde depois — mudança de sintaxe, não de comportamento.

## Passo 5 — `guard.mjs`: três lacunas fechadas

- Regra 4 (vazamento de segredo): estende para também casar `import.meta.env`, ao lado de `process.env`, no renderer.
- Regra 9 (isenção de comentário JSX): substitui a checagem "termina com `{`" por uma que realmente distinga `{/* */}` de um objeto literal comum — fechando o caso `const x = { /* narrativa */ ... }` que hoje escapa.
- Nova regra: teto de linha para `src/main/index.ts` (100) e `src/preload/index.ts` (100, após o Passo 1), contando linhas totais do arquivo, mesma definição escrita no `CLAUDE.md`.

## Passo 6 — `eslint.config.mjs`: `no-restricted-imports` para `src/preload/**`

Novo bloco, no mesmo formato dos dois já existentes (`src/shared/**`+`src/core/**` e `src/renderer/**`): proíbe `**/core/**`, `**/main/**`, `**/renderer/**`, `**/workers/**` a partir de `src/preload/**`.

## Passo 7 — Descriptions das 5 skills técnicas, encurtadas

`architecture`, `ipc`, `design-system`, `testing`, `comments` — o front-matter `description` de cada uma passa de inventário de tópicos (200+ palavras) para o essencial + a cláusula de gatilho ("Use ao..."), que é a parte que de fato importa para recuperação. O inventário que sair daqui não se perde: já está no corpo de cada skill.

## Passo 8 — Nascimento da skill `data`

`.claude/skills/data/SKILL.md` nasce dona de: motor DuckDB em `utilityProcess`, canais `dataset:*`, o veredito medido do 18-B (Arrow perdeu de JSON em tempo total), o motor restrito (`allowed_directories`, `enable_external_access = false`, `lock_configuration = true`), e a extensão `excel` vendorizada e travada por versão. Conteúdo extraído de `docs/study/05-proximos-passos.md` (que mantém só o que for genuinely aprendizado/tutorial, perdendo a posse do que virou fato de arquitetura consultável) e dos parágrafos "Instaladas na trilha do DuckDB"/"Binário vendorizado" do `CLAUDE.md` (que passam a apontar, não duplicar). As duas tabelas de fonte única — `CLAUDE.md` e `docs/README.md` — ganham a linha "camada de dados" apontando para a skill nova; `docs/README.md` não tinha essa linha antes (o próprio `CLAUDE.md` registrava isso: "a versão que inclui também os assuntos que não têm dono dentro desta pasta" — deixa de valer para este assunto).

## Passo 9 — Fechamento

Diário preenchido, plano movido para `plan/implemented/`, entrada própria em `HISTORY.md`, `pnpm check:fast` verde, `advisor` chamado com o resultado final.

---

## Decisões

- **R3.1 — Sigla `R`, não `F`.** A trilha `F` é para feature nova de comportamento (F-1 mudou o que a tela faz); nada aqui muda comportamento do app. A trilha `R` é "refatoração, zero mudança de comportamento, leva um padrão já decidido ao que precede" — descrição exata do `R-2`, e exata disto.
- **R3.2 — Teto de `preload/index.ts` sobe para 100, `main/index.ts` fica como está.** Iguala os dois pontos de entrada num único número redondo, em vez de encolher código que já funciona só para caber num teto que a prática mostrou apertado demais. A contagem passa a ter definição explícita (linhas totais, comentário incluso) para não repetir a ambiguidade que deixou o teto antigo violado sem detecção.
- **R3.3 — Escopo é a lista completa, por pedido explícito do usuário, não o mínimo recomendado.** A triagem inicial (por "caro de desfazer") teria deixado de fora o `no-restricted-imports` do preload, a correção do bypass JSX e a normalização `npm`→`pnpm` dos scripts, classificados como baixo ROI individual num projeto sem outro colaborador. O usuário pesou o valor do registro histórico coerente acima desse critério, mesmo em projeto pessoal — decisão dele, respeitada aqui.
- **R3.4 — O Stop hook (`pnpm check:fast` como string crua em `settings.json`) fica como está, por decisão, não por esquecimento.** É um encadeamento de scripts do `package.json` (`typecheck && lint && test`), não a invocação de um binário isolado — replicar via `resolveBin`/`_shared.mjs` exigiria escrever um runner próprio reimplementando esse encadeamento em JS, e o comando não tem nenhum argumento dinâmico que gere risco real de quoting no Windows. Custo de mudar supera o risco de manter.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 22/08/2026 | 1 | Plano registrado (Passo 0) — nasceu de uma auditoria crítica de `.claude/hooks/`, `.claude/skills/`, `CLAUDE.md` e `README.md` pedida pelo usuário, com cada achado verificado contra o repositório real antes de entrar no plano. Escopo (lista completa, não o mínimo recomendado), sigla (`R-3`) e o novo teto de `preload/index.ts` (60→100) confirmados em conversa com o usuário. Nenhum passo de execução rodou ainda. | Próxima sessão começa no Passo 1 (`CLAUDE.md`). |
| 22/08/2026 | 2 | **Plano concluído, os 10 passos (0-9), um commit por passo** — Passo 3 sem commit próprio (o HTML órfão nunca foi rastreado pelo git; removê-lo não deixa diff). Sequência: `9d6eb19` (0, achado retroativamente sem commit — corrigido nesta sessão) · `784be3c` (1, CLAUDE.md) · `bf9a08e` (2, README.md — achou de bônus que Parquet nunca foi suportado pelo seletor de arquivo, apesar de citado como formato pronto) · (3, sem commit) · `db3ac1b` (4, package.json — Context7/pnpm confirmou a sintaxe antes de trocar) · `3bf8320` (5, guard.mjs — três regras testadas ao vivo: editar um arquivo que viola cada uma, confirmar `exit 2`, reverter; Context7/Vite confirmou o mecanismo de `import.meta.env`) · `6949312` (6, eslint.config.mjs — Context7/ESLint confirmou a forma de `no-restricted-imports`, testado ao vivo com um import real de `core/` dentro de `preload/`) · `287ef15` (7, descriptions das 5 skills) · `b48e862` (8, nasce a skill `data` — Context7/duckdb-node-neo confirmou que a API real não expõe Arrow nativamente, antes de escrever essa afirmação na skill). `pnpm check:fast` verde depois de cada passo que tocou código/config (4, 5, 6, 8) — sempre 693 testes, 80 arquivos, `git diff --stat -- src/` vazio em todo commit. `advisor` chamado uma única vez ao final, como pedido. | Plano concluído — movido para `plan/implemented/`, sem pendência de retomada. |
