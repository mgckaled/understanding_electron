# R-4 — Reconciliação factual das cinco skills técnicas e dois ajustes pontuais no `CLAUDE.md`

**Entrega:** `architecture`, `comments`, `ipc`, `testing` e `data` (as cinco skills técnicas) reconciliadas com o estado real do repositório depois dos planos 16-18/N-1 — 6 correções factuais, 3 omissões e 2 reforços fechados na `architecture` (a mais desatualizada), mais contradição interna e referência temporal resolvidas na `comments`, proveniência e numeral corrigidos na `ipc`, ponteiro/proveniência/categoria corrigidos na `testing`, e a convenção transversal de escopo negativo (`Não cobre...`) adicionada ao frontmatter de quatro delas. Dois ajustes pontuais no `CLAUDE.md` (`shamefullyHoist`, tamanho do binário do Excel).

> Quarto da trilha **R (refatoração)**, transversal ao arco: zero mudança de comportamento do app, leva um padrão já decidido ao que precede. `R-1` aplicou a convenção de comentário a `src/`; `R-2` e `R-3` sincronizaram documentação e nasceram a skill `data`; este fecha a deriva que se acumulou nas cinco skills técnicas desde então.
>
> **Aceite global: nenhuma linha em `src/` muda de comportamento** — mais estrito que o `R-3` (que abria exceção para `preload/index.ts`/`main/index.ts`): aqui `git diff --stat` fora de `.claude/skills/` e `CLAUDE.md` fica **vazio** em todo commit, sem exceção nenhuma.

---

## O caso — por que este plano existe

Nasceu de um relatório externo (`notes/prompts/p_skills.md` + `notes/reports/r-skills.md`), com 22 itens de correção propostos para `architecture`/`comments`/`ipc`/`testing`/`data`, mais a convenção transversal de escopo negativo. Como chanceler da proposta, cada item foi verificado contra o repositório real (grep, leitura de fonte, `ROADMAP.md`, listagem ao vivo de `src/renderer/src/features/`) antes de aceitar — não só contra o texto do relatório.

**A verificação achou que 3 dos 22 itens tinham premissa falsa** — o relatório foi escrito contra estado lembrado, não conferido:

- **Item 4** (contagem de features "provavelmente mudou") — falso: `src/renderer/src/features/` ainda tem exatamente `conversation`, `attachment`, `settings`, igual ao que a skill já dizia.
- **Item 13** (bloco de 14 linhas no topo de `conversationsContext.ts`, citado como exemplo vivo do que sai) — o bloco já não existe: foi substituído por um comentário de 3 linhas (D14.4) numa sessão anterior.
- **Item 14** (link duplicado `[[ipc](../ipc/SKILL.md)](../ipc/SKILL.md)` na skill `comments`) — não existe no arquivo atual; dois greps independentes confirmam.

`advisor` (Opus) foi chamado **duas vezes**. A primeira, antes de qualquer edição, para filtrar o escopo: confirmou o filtro de chanceler, pediu verificar se `@remarks` aparecia numa quarta menção contraditória (não aparecia — só as 3 já achadas, todas do lado do veto) e apontou um risco de estrutura — o passo transversal de escopo negativo não podia ter dois donos (um passo por skill *e* um passo transversal), resolvido dando ao passo transversal a posse única das quatro frontmatters. A segunda, depois de todas as edições e antes do commit, achou um problema real introduzido pelas próprias edições: a proveniência nova da `testing` citava "49 arquivos, 452 testes" (R-2) ao lado de uma frase da mesma skill, quatro linhas abaixo, que proíbe abrir uma segunda lista de contagem (*"Gatilho e número atualizado ficam só no ROADMAP § 2; não abra uma segunda lista aqui"*) — e o `pnpm check:fast` desta própria sessão media 693 testes/80 arquivos, tornando o número copiado stale no mesmo instante em que era escrito. Corrigido antes do commit (Passo 4).

**Decisão tomada com o usuário:** aplicar a lista filtrada — 18 correções + 1 passo transversal + 2 ajustes no `CLAUDE.md` —, descartando os 3 itens de premissa falsa e os 2 itens opcionais de enriquecimento (10, 11). E, por pedido explícito nesta sessão: pular o ciclo `active/` → `implemented/`. Como o relatório já vinha detalhado item a item e o mapeamento (verificação contra o repositório, filtro de chanceler, consulta ao advisor) já tinha acontecido **antes** da primeira edição, este arquivo tem mais efeito de registro histórico e auto-conservação do que de guia para uma execução futura.

## Itens descartados, e por quê

- **Item 4** — a correção proposta (tirar o número fixo) entrou mesmo assim, mas por outro motivo: não porque a contagem mudou (não mudou), e sim porque a regra de auto-conservação do `CLAUDE.md` recomenda não copiar contagens que podem envelhecer.
- **Item 10** (regra de não-materialização do `ESCOPO.md`) — não virou passo próprio; a citação entrou **dentro** do Passo 1, como justificativa da remoção de "virtualização + DuckDB" de "barato de adiar", não como parágrafo adicional.
- **Item 11** (critério pilar-vs-produto) — enriquecimento genuíno, fora do escopo de um plano de reconciliação. Pode virar proposta própria depois, se a seção "critério: o que é caro de desfazer" da `architecture` precisar reforço.
- **Item 14** — nenhuma edição feita. O defeito relatado não existe no arquivo atual; "consertá-lo" teria editado uma linha que já está certa.

## Passo 0 — Nascimento do plano

Este arquivo nasce direto em `plan/implemented/` (não em `active/` — ver decisão acima), mais a linha `R-4` no [`ROADMAP § 1`](../../ROADMAP.md) e a entrada em [`HISTORY.md`](../../HISTORY.md).

## Passo 1 — `architecture`: reconciliação factual (9 edições)

`workers/` passa a refletir o DuckDB em produção, com ponteiro novo para a skill [`data`](../../../.claude/skills/data/SKILL.md) · virtualização de tabela e o próprio DuckDB saem de "barato de adiar", com a regra de não-materialização do `ESCOPO.md` citada no texto como o motivo (fecha também o item 10, dobrado aqui) · referência à régua de tamanho perde o número copiado (250), aponta só para a régua do `CLAUDE.md` · lista/contagem de features perde o número fixo, vira padrão genérico (`uma por assunto`) · Tailwind sai de "não entram por padrão", vira exemplo histórico com ponteiro para a stack fixada · `shamefullyHoist` atualizado de "pendente" para "`false`, gatilho cumprido no 18-A" · proveniência estendida (fases 13, 14, planos 16-18) · seção "Mapa de dependência entre fases" marcada como registro histórico, não orientação ativa.

## Passo 2 — `comments`: contradição interna e referência temporal (2 edições)

Contradição do `@remarks` resolvida a favor do veto — 3 menções vetam (`description`, corpo, reconciliação final) contra 1 que abria exceção na ordem do bloco; a exceção saiu, o veto ficou único · referência aos blocos de 14/6 linhas reescrita de forma atemporal, apontando para o `HISTORY.md` por sigla (D14.4) em vez de citar arquivo e contagem de linha que podem envelhecer de novo (e já tinham envelhecido: o bloco de 14 linhas não existe mais).

## Passo 3 — `ipc`: proveniência e numeral (2 edições)

Proveniência estendida até o plano 18-B (o veredito Arrow-vs-JSON que decide o canal `dataset:query` até hoje) · título "Os 29 canais de hoje" perde o numeral — a tabela logo abaixo já é conferível, e o texto de fechamento da seção já avisa para não declarar limiar sem medir.

## Passo 4 — `testing`: ponteiro, proveniência e categoria (3 edições)

Ponteiro do `handle()` corrigido de `architecture` para `ipc` — o contrato saiu de lá em ago/2026 e a `testing` não tinha acompanhado · proveniência estendida (fase 08, fase 14, R-2), **sem repetir contagem** (achado do advisor, ver acima: a primeira versão citava "49 arquivos, 452 testes" ao lado de uma frase da mesma skill que proíbe isso; corrigido para `check:fast` remedido, sem número) · seção "O jsdom não é um navegador" renomeada para "Limites de ambiente de teste" — o item `prefers-color-scheme` é comportamento do Playwright, não do jsdom, e estava na categoria errada.

## Passo 5 — `data`: nenhuma edição no corpo

O relatório propunha decidir a duplicação do tamanho do binário (22.704.662 bytes, em `data` e em `CLAUDE.md`); a skill `data` já era a dona correta, então a correção ficou inteira no `CLAUDE.md` (Passo 7), que passa a apontar em vez de repetir. A única mudança neste arquivo é o frontmatter — dono é o Passo 6, não este passo.

## Passo 6 — Escopo negativo transversal, um único dono para as quatro skills restantes

Frontmatter de `ipc`, `comments`, `testing` e `data` ganha a cláusula `Não cobre...` (texto do relatório § 6.1); `architecture` já tinha. Este é o **único** passo que toca frontmatter — os passos 1-5 não repetem a decisão, resolvendo o risco de dono duplicado que o `advisor` apontou na primeira chamada.

## Passo 7 — `CLAUDE.md`: dois ajustes pontuais

Tabela de segurança: `shamefullyHoist` de "**pendente** — gatilho de revisão: instalação do DuckDB" para "**desligado** (`false`) — gatilho cumprido no plano `18-A`" (confirmado contra `pnpm-workspace.yaml` antes de escrever) · linha do binário vendorizado do Excel perde o número de bytes copiado, vira ponteiro para a skill [`data`](../../../.claude/skills/data/SKILL.md).

**Fora de escopo, registrado no `ROADMAP § 4` para não se perder:** duas outras menções do `CLAUDE.md` também estão desatualizadas (a frase "mantém fechado o gatilho do `shamefullyHoist` até o DuckDB" na seção de dependências, e "**nenhum segredo existe ainda**" na mesma tabela de segurança — stale desde N-1-A/N-1-B) — nenhuma das duas estava nos 22 itens do relatório, então não entraram aqui.

## Passo 8 — Fechamento

Portão: nenhum link relativo quebrado entre as cinco skills e o `CLAUDE.md` (checado por script — resolve cada `](...)` contra o sistema de arquivos —, zero achados) · `git diff --stat` fora de `.claude/skills/` e `CLAUDE.md` vazio · `pnpm check:fast` verde (693 testes, 80 arquivos, idêntico ao estado antes do plano — nenhuma linha de `src/` tocada) · `advisor` chamado duas vezes (antes de editar e depois, antes do commit — ver "O caso" acima) · entrada em `HISTORY.md`, linha no `ROADMAP § 1`, pendência registrada no `ROADMAP § 4`.

---

## Decisões

- **R4.1 — Sigla `R`, não `F`.** Zero mudança de comportamento do app; quarto da trilha "refatoração" (`R-1` comentários, `R-2` doc técnica/histórica, `R-3` sync docs + nasce a skill `data`).
- **R4.2 — Plano nasce direto em `implemented/`, sem passar por `active/`.** Pedido explícito do usuário: o relatório de origem já vinha detalhado item a item, e o mapeamento (verificação de cada item contra o repositório, filtro de chanceler, consulta ao advisor) já tinha acontecido **antes** de qualquer edição — o arquivo tem mais efeito de registro histórico e auto-conservação do que de guia para uma execução futura. Diverge do padrão do `R-1`/`R-2`/`R-3`, registrado aqui para não virar precedente silencioso: a próxima trilha R volta ao ciclo normal (`active/` → `implemented/`) a menos que a mesma condição se repita (relatório externo já mapeado, chanceler já filtrado antes da primeira edição).
- **R4.3 — `advisor` chamado duas vezes, não uma.** Antes de editar (filtrou escopo — confirmou os 3 itens de premissa falsa, achou o risco de dono duplicado do Passo 6) e depois de editar, antes do commit (achou a contagem duplicada na `testing`, item que o próprio plano existe para eliminar). A segunda chamada replicou o padrão do `R-3` (que também achou 3 problemas reais numa revisão pós-edição) — e confirmou que vale a pena mesmo quando a primeira chamada já filtrou bem o escopo: escopo correto não garante execução sem o mesmo tipo de deriva que o plano corrige.
- **R4.4 — 3 dos 22 itens do relatório tinham premissa falsa (4, 13, 14).** Nenhum recebeu edição correspondente ao "problema" descrito; onde a correção proposta ainda fazia sentido por outro motivo (item 4), o motivo registrado é o real (auto-conservação), não o do relatório (contagem mudou — não mudou).
- **R4.5 — Itens 10 e 11 (enriquecimento opcional) descartados do escopo de reconciliação.** O conteúdo do 10 não se perdeu: entrou como justificativa dentro do Passo 1. O 11 fica de fora até virar necessidade real.
- **R4.6 — Duas menções desatualizadas no `CLAUDE.md`, achadas de bônus, registradas no `ROADMAP § 4` em vez de corrigidas aqui.** Não estavam nos 22 itens do relatório; corrigi-las expandiria escopo em execução — o mesmo erro que a promessa "não precisar de uma R-3" do `R-2` não conseguiu evitar.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 24/08/2026 | 1 | Plano concluído numa sessão só, nascido direto em `implemented/` por pedido do usuário. Relatório (`notes/reports/r-skills.md`, 22 itens) avaliado item a item contra o repositório real antes de aceitar qualquer um; `advisor` consultado antes da primeira edição (filtrou escopo, confirmou os 3 itens de premissa falsa) e de novo depois de todas as edições, antes do commit (achou a contagem duplicada na proveniência nova da `testing` — corrigido antes de commitar). 3 itens descartados por premissa falsa (4, 13, 14), 2 por serem enriquecimento fora de escopo (10, 11 — conteúdo do 10 preservado como justificativa dentro do Passo 1). 18 correções aplicadas nas cinco skills + 1 passo transversal (escopo negativo, dono único) + 2 ajustes pontuais no `CLAUDE.md`. Duas menções desatualizadas adicionais do `CLAUDE.md`, fora dos 22 itens, registradas no `ROADMAP § 4` em vez de corrigidas em execução. Portão: link-check das cinco skills + `CLAUDE.md` sem achado, `pnpm check:fast` verde (693 testes, 80 arquivos, `git diff --stat -- src/` vazio). | Plano concluído — nasce e fecha na mesma sessão, sem pendência de retomada. |
