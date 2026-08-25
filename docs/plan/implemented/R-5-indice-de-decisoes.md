# R-5 — `DECISOES.md`: índice tabular das decisões dentro de cada plano

**Entrega:** [`docs/DECISOES.md`](../../DECISOES.md), índice de 213 linhas (203 de heading próprio `### D<id> — <título>` em 30 arquivos de plano + 10 de planos cujas decisões são só prosa) — três colunas (trilha, sigla com link, descrição verbatim), sem narrativa nova. `docs/README.md` e `CLAUDE.md` ganham a linha de fonte única e o passo extra no ciclo de vida do plano.

> Quinto da trilha **R (reconciliação de documentação)**, mesma família do `R-3`/`R-4`: zero mudança de comportamento do app. Resolve uma dor nomeada pelo usuário — achar "o que foi decidido sobre X" hoje custa abrir o `HISTORY.md` inteiro, documento que já passou do teto de leitura de uma chamada só (confirmado ao vivo nesta sessão, ao tentar).

---

## O caso — por que este plano existe

Pedido do usuário: um documento em `docs/` reunindo e tabulando todas as decisões do projeto, no máximo 3 colunas (trilha, sigla, descrição), para não repetir busca cara em tokens/tempo a cada sessão.

**Duas rodadas de `advisor` (Opus), intercaladas com verificação ao vivo — não uma pesquisa e uma escrita:**

1. **Antes de desenhar qualquer coisa.** A leitura inicial de "sigla" (os ~39 marcos com nome de plano — `DS-8`, `R-4`, `18-F`) estava incompleta: o `advisor` apontou que o `CLAUDE.md` já cita uma granularidade menor (`D15.2`, `D18A.3`, `DN1A.5`) que não aparecia nos headings de marco do `HISTORY.md`. Grep bloqueante pedido antes de escrever uma linha: `D18A.3` tem heading próprio dentro do plano que o define (`18-A-motor-e-worker.md:46`), citado depois em cinco lugares diferentes do repositório — confirmando um corpus atômico e mecanicamente extraível, maior que os marcos.
2. **Depois de mapear a extensão real do corpus, antes de gerar linha.** A contagem inicial (197, via regex que exigia ponto no id) tinha um furo: `00-visao-geral.md` usa `D1`–`D6` sem ponto, um formato que a regex perdeu — o mesmo tipo de erro que a convenção de auto-conservação do `CLAUDE.md` existe para pegar. Verificação arquivo a arquivo achou também que **9 dos 39 planos implementados** (`R-1`–`R-4`, `F-1`, `F-2`, `DS-6`–`DS-8`) não têm heading atômico algum — decisão registrada só como prosa corrida sob `## Decisões` — e que o `DS-5` cita ids (`DS5.1`, `DS5.2`, `DS5.4`, `DS5.6`, `DS5.7`) dentro de frase em negrito, não em heading, com `DS5.3`/`DS5.5` sem heading correspondente. O `advisor` confirmou o desenho de três formas (heading atômico → 1 linha por id; prosa-só → 1 linha por plano, reaproveitando o título do marco já escrito em `HISTORY.md`/`HISTORY-archive.md`; `DS-5` tratado como o segundo caso, para não fingir cobertura granular com buracos) e corrigiu um erro de desenho antes que ele virasse 200 links quebrados: o link por âncora de heading (`#d18a3`) fatiaria o heading **inteiro** num slug, não só o id — trocado por link de arquivo, sem fragmento.

## O que o plano não previu, e como foi resolvido

- **`active/09-camada-de-ia.md`** tem `D9.1`–`D9.6` citados em `plan/active/README.md`, mas o pedido original do usuário mencionava só `plan/implemented/`. Incluído com marca "(ativo)" e seção própria no fim do índice, em vez de omitido em silêncio ou decidido sem registrar — o `advisor` pediu para nomear a escolha, não tomá-la calada.
- **Gerador automático** foi cogitado e descartado: três formas estruturais diferentes (heading atômico, prosa-só, `DS-5`) tornariam um script mais complexo que o ganho, para uma tabela que cresce ~6 linhas por plano — mesma disciplina manual que já mantém o `HISTORY.md` (uma entrada por marco, à mão). A extração em si foi mecânica (grep + awk, ver Decisões), só não ficou como script commitado.

## Onde plugou no código real

Nenhuma linha de `src/` tocada. `docs/DECISOES.md` novo; `docs/README.md` (mapa da pasta, tabela de fonte única, passo 3 do ciclo de vida do plano) e `CLAUDE.md` (tabela de fonte única) ganham o ponteiro.

## Verificação

`grep -c` da contagem final antes de escrever qualquer linha (203 headings atômicos, confirmado duas vezes com regex diferentes) · zero `|` literal nos títulos extraídos (quebraria célula de tabela) · amostragem visual de três trechos do arquivo gerado (abertura, fronteira DS→F→N, fechamento) conferida contra o fonte.

---

## Decisões

- **R5.1 — Unidade da linha é o heading, não o marco.** `203` das `213` linhas vêm de `### D<id> — <título>` dentro do próprio plano; o marco (`DS-8`, `18-F`) é grosso demais para a busca que motivou o pedido — errar pelo grão fino, com o marco como link, não como unidade.
- **R5.2 — Descrição é o título copiado verbatim, nunca um resumo novo.** Um resumo autoral seria um segundo fato a envelhecer calado (o problema que a convenção "fonte única" do próprio `docs/README.md` existe para evitar); o título já foi escrito, curto, na hora da decisão.
- **R5.3 — Link aponta pro arquivo, sem âncora de heading.** Correção do `advisor`: o slug de heading do GitHub/VS Code inclui o texto inteiro, não só o id — um link por fragmento quebraria em silêncio a cada retitulação. A sigla já está na linha; abrir o arquivo e `Ctrl+F` resolve.
- **R5.4 — Planos sem heading atômico (`R-1`–`R-4`, `F-1`, `F-2`, `DS-5`–`DS-8`) ganham uma linha cada, não zero.** Nove planos ausentes do índice pareceriam um censo incompleto para quem pediu "todas as decisões". A descrição reaproveita o título do marco já escrito em `HISTORY.md`/`HISTORY-archive.md` — zero autoria nova, mesma regra da R5.2.
- **R5.5 — `DS-5` entra pela regra da R5.4, não pela dos headings atômicos**, apesar de ter `### Fase N` com alguns ids DS5.x citados em negrito dentro do corpo — extrair só os ids que aparecem em heading teria produzido uma cobertura parcial (`DS5.3`/`DS5.5` sem linha) disfarçada de completa.
- **R5.6 — `active/09` entra, marcado "(ativo)", em seção própria ao final.** Fora do pedido original ("`plan/implemented`"), mas os ids `D9.1`–`D9.6` já são citados por outros documentos — um índice que devolve vazio para `D9.4` tem um buraco. Registrado explicitamente, não decidido em silêncio.
- **R5.7 — Sem gerador commitado.** Extração mecânica (grep dos headings + `awk` para montar `trilha`/link/descrição), rodada uma vez no scratchpad da sessão, não como `scripts/*.mjs`. Três formas estruturais tornariam o script mais complexo que o ganho; se `DECISOES.md` ficar tedioso de manter à mão, a régua muda quando isso acontecer, não antes.
- **R5.8 — Plano nasce direto em `implemented/`, sem passar por `active/`.** Mesmo padrão do `R-3`/`R-4`/`DS-6`/`DS-7`: o mapeamento (duas rodadas de `advisor`, verificação arquivo a arquivo) já aconteceu antes da primeira linha escrita — um plano em `active/` teria sido um documento nascendo pra morrer na mesma sessão.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 24/08/2026 | 1 | Plano concluído numa sessão só, nascido direto em `implemented/`. Duas rodadas de `advisor` (antes de desenhar; depois de mapear a extensão real do corpus) — a segunda corrigiu a contagem (197→203, furo do `00-visao-geral.md` sem ponto no id) e o mecanismo de link (âncora de heading quebraria; virou link de arquivo). `docs/DECISOES.md` gerado por grep+awk (213 linhas: 203 atômicas + 10 de plano prosa-só, `DS-5` incluído nessa segunda categoria); `docs/README.md` e `CLAUDE.md` a atualizar na sequência desta mesma sessão. | Plano concluído — falta só propagar o ponteiro em `README.md`/`CLAUDE.md` e a entrada em `HISTORY.md`, já em andamento na mesma sessão. |
