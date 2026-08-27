# Documentação — crivo

Esta pasta é a documentação versionada do projeto, organizada **por finalidade**: escopo, história, roadmap, estudo, referência e planos por estado.

> Este arquivo é o mapa. A tabela de fonte única aqui cobre a documentação em `docs/`; o [`CLAUDE.md`](../CLAUDE.md) traz a versão que inclui também os assuntos que ainda não têm dono próprio (IA de nuvem, ML, RAG — hoje em [`plan/active/09-camada-de-ia.md`](plan/active/09-camada-de-ia.md)) — é ela, hoje, a mais completa das duas.

---

## Mapa da pasta

```text
docs/
├── README.md        # este arquivo — mapa, ciclo de vida e convenção de fonte única
├── ESCOPO.md        # o que o app faz e não faz — definição de produto
├── HISTORY.md       # changelog: os 10 marcos mais recentes + decisões arquiteturais
├── HISTORY-archive.md  # marcos além dos 10 — fila de saída, só leitura
├── ARMADILHAS.md    # erro diagnosticado — buscável por sintoma, não por data
├── DECISOES.md      # índice tabular das decisões dentro de cada plano — derivado, não narra
├── ROADMAP.md       # o que ainda falta — pendências e gatilhos de revisão
├── study/           # cadernos didáticos: Electron, stack, anatomia, diário de bordo
├── reference/       # referência técnica: nem plano, nem história, nem tutorial
└── plan/
    ├── active/      # planos ainda não implementados — o backlog vivo
    ├── implemented/ # planos concluídos
    └── archive/     # planos abandonados ou superados — só leitura histórica
```

---

## Ciclo de vida de um plano

1. Nasce em [`plan/active/`](plan/active/), com passos, critérios de aceite e um **diário de execução** vazio.
2. Enquanto está sendo executado, cada sessão de trabalho acrescenta **uma linha** ao diário daquele plano.
3. Ao concluir, o arquivo **move** para [`plan/implemented/`](plan/implemented/) e ganha **uma entrada curta** em [`HISTORY.md`](HISTORY.md), com link — e, se o plano tiver algum heading `### D<id> — <título>`, essas linhas entram em [`DECISOES.md`](DECISOES.md); se não tiver nenhum, o próprio plano ganha uma linha lá, com a descrição igual ao título do marco recém-escrito em `HISTORY.md`. **Se essa entrada for a 11ª**, a mais antiga desce para [`HISTORY-archive.md`](HISTORY-archive.md) na mesma edição — ver [régua de tamanho de documento](#régua-de-tamanho-de-documento).
4. Plano abandonado ou superado por outro vai para [`plan/archive/`](plan/archive/), com uma linha em `HISTORY.md` dizendo **por que** foi abandonado. Isso importa: plano descartado em silêncio é reinventado seis meses depois.

> ⚠️ `archive/` é **só leitura histórica**. Seus links internos podem apodrecer, e **não se conserta referência dentro do archive** — o custo é real e o benefício, nenhum.

---

## Os dois registros, e por que são dois

Esta é a parte que decide se o histórico sobrevive. São dois registros com **vidas diferentes**, e confundi-los é o que faz projetos perderem meses de contexto.

| | Diário de execução | Entrada de histórico |
|---|---|---|
| **Onde** | dentro do plano, em `plan/active/` | `HISTORY.md` |
| **Unidade** | uma sessão de trabalho | um marco concluído |
| **Responde** | "onde eu parei?" | "por que isto é assim?" |
| **Público** | a próxima sessão, nesta semana | você daqui a seis meses |
| **Vida** | morre quando o plano é arquivado | permanente |
| **Tamanho** | uma linha de tabela | um parágrafo |

**Por que o diário mora dentro do plano, e não num arquivo à parte:** porque o plano já está aberto enquanto o trabalho acontece. Um `SESSOES.md` separado exige lembrar de abri-lo — e o que exige lembrar não acontece.

#### A linha do diário tem uma régua, e ela é curta

`| data | passos | estado | o que mudou |` — e a última coluna cabe em **~200 caracteres**. Não é estética: o que passa disso é narrativa de investigação, que tem dono fora do plano.

⚠️ **Estourar essa régua é o sintoma de escalonamento que não aconteceu.** Se a frase não cabe, a pergunta certa não é "como resumo?", é **"para onde isto sobe?"** — armadilha para [`ARMADILHAS.md`](ARMADILHAS.md), alternativa descartada para [`HISTORY.md`](HISTORY.md), número medido para o dono do número. Só o que sobra depois disso fica na linha. Medido em 26/08/2026: os diários somavam **193 KB**, com células de até **7.056 caracteres** — cada uma delas um escalonamento adiado.

⚠️ **Ao comprimir, o `git diff` é a verificação — reler o texto resultante não é.** O R-2 perdeu a alternativa descartada de seis marcos exatamente assim: o item de verificação existia, foi citado como feito, e o texto comprimido continuava lendo bem. Registrado em [`ARMADILHAS.md`](ARMADILHAS.md).

**Por que a unidade do `HISTORY.md` é o marco e não a sessão:** um marco costuma levar várias sessões. Se cada sessão virasse entrada, o histórico teria centenas delas e deixaria de ser lido — que é a mesma perda de contexto por outro caminho. O que precisa sobreviver não é "o que fiz na terça"; é "por que ficou assim e o que já foi descartado".

### O escalonamento é o que faz o sistema funcionar

Toda observação nasce no diário. Quando ela vale **além daquele plano**, sobe para o `HISTORY.md` **na mesma sessão**:

| Observação no diário | Sobe? | Para onde |
|---|---|---|
| "terminei o passo 3, falta o 4" | não | morre com o plano |
| "o `pnpm typecheck` levou 40s hoje" | não | ruído |
| "descobri que X quebra quando Y — perdi duas horas" | **sim** | [`ARMADILHAS.md`](ARMADILHAS.md) |
| "tentei A, não funcionou por Z, fui de B" | **sim** | `HISTORY.md` → decisão |
| "medi 1,2 GB de CSV em 8s" | **sim** | `HISTORY.md` ou `study/04-diario-de-bordo.md` |

A regra prática: **subiu se for custar tempo de novo.** Erro que já custou horas uma vez e não foi registrado custa as mesmas horas na segunda.

#### Número que se remede vira **linha de série**, nunca parágrafo concatenado

Alguns números são medidos de novo a cada plano — a duração do `check:fast` é o caso vivo. O valor deles **está na série**, não no último valor: foi comparar 88s contra 57s que provou que os ~88s eram ruído de máquina suja, não um patamar novo.

Por isso a forma importa: **uma linha por medição, numa tabela própria** (`data · plano · escala · resultado`). O que **não** fazer é acrescentar mais um parágrafo à mesma célula — foi o que aconteceu com o gatilho do `check:fast` no [`ROADMAP § 2`](ROADMAP.md), que chegou a **2.388 caracteres numa única célula**, ilegível e crescendo a cada plano.

A regra de conservação continua valendo por cima: **remedir é o ato de conservar** — nunca copie um número de um documento para outro sem reconferir a fonte na hora.

---

## Régua de tamanho de documento

A régua de tamanho do [`CLAUDE.md`](../CLAUDE.md#régua-de-tamanho) mede código porque arquivo grande é sintoma. Documento tem o mesmo problema com uma vítima diferente: **quem paga não é quem escreve, é quem lê** — e num projeto operado por conversa, ler custa tokens de contexto, que é o recurso mais escasso da sessão.

O gatilho é ago/2026, medido: os arquivos soltos de `docs/` somavam **~326 KB / ~100k tokens**, e `HISTORY.md` sozinho, **182 KB**. Duas leituras integrais estouravam o orçamento de uma sessão inteira e disparavam autocompactação — que apaga justamente o trabalho em curso.

Remedido em 27/08/2026, ao fechar a trilha E-1-A..D: **~1,8 MB / ~540k tokens** em 93 arquivos, dos quais `plan/implemented/` responde por **56%**. O mesmo número aparece no [`CLAUDE.md`](../CLAUDE.md#protocolo-de-leitura-da-documentação), que é quem o usa para decidir como ler — os dois se remedem juntos ou um mente.

| Arquivo | Teto | Quando estoura |
|---|---|---|
| `HISTORY.md` | **10 marcos** | a mais antiga desce para `HISTORY-archive.md`, na mesma edição |
| `ARMADILHAS.md` | ~80 KB | comprimir as mais antigas (número + mecanismo + conserto; a narrativa sai). ⚠️ **Estourado: 96,5 KB em 27/08/2026** — registrado no [`ROADMAP § 2`](ROADMAP.md) |
| `HISTORY-archive.md` | — | sem teto: é fila de saída, nunca lido inteiro |
| `ESCOPO.md`, `ROADMAP.md`, `DECISOES.md` | ~45 KB | desmembrar por assunto em `reference/`, com ponteiro |
| `CLAUDE.md` | **~25 KB** | é lido em **toda** sessão — o que tem outro dono sai e vira ponteiro. ⚠️ **Estourado: 30 KB em 27/08/2026** — registrado no [`ROADMAP § 2`](ROADMAP.md) |
| plano individual (`plan/**`) | **~35 KB** | o excesso é quase sempre diário de execução: comprimir à régua de uma linha por sessão (abaixo). O `15` (94 KB) já nasceu violando |
| skill (`SKILL.md`) | ~40 KB | dividir em arquivo auxiliar na pasta da skill |

**A regra que sustenta o teto** não é o número: é que **nenhum arquivo de `docs/` se lê na íntegra**. O teto só limita o dano quando alguém escorrega. O protocolo de leitura — `Grep` pelo termo, `Read` com `offset`/`limit` na linha achada — mora no [`CLAUDE.md`](../CLAUDE.md#protocolo-de-leitura-da-documentação), porque é lá que ele é lido antes de a primeira leitura acontecer.

> **Por que arquivar em vez de resumir:** resumo perde a alternativa descartada, que é o único conteúdo irrecuperável. O archive mantém o texto inteiro e buscável por `Grep`; o que ele tira é a obrigação de manter, não a informação.

---

## Convenção "fonte única + ponteiro"

Cada assunto tem **um** documento dono. Todos os demais **apontam** — nunca duplicam.

| Assunto | Fonte única | Os demais |
|---|---|---|
| O que o app faz e não faz, catálogo de operações, formatos, escala | [`ESCOPO.md`](ESCOPO.md) | apontam |
| Camadas, regra de importação, sandbox, jobs, régua de tamanho | skill `architecture` | apontam |
| Contrato IPC, `window.api`, `Result` vs exceção, eventos, payload binário | skill `ipc` | apontam |
| Tokens, primitivos, `ViewState`, convenções de desktop | skill `design-system` | apontam |
| Níveis de teste, mocks, o que não testar | skill `testing` | apontam |
| Convenção de comentário e docstring (TSDoc) | skill `comments` | apontam |
| Camada de dados (DuckDB, `utilityProcess`, Arrow, motor restrito) | skill `data` | apontam |
| Ferramentas do chat (busca web, MCP, raciocínio visível) | [`reference/web-fetch_mcp_thinking.md`](reference/web-fetch_mcp_thinking.md) | apontam |
| Frota Ollama instalada, peso/cache KV, ficha técnica dos modelos de nuvem opt-in, elegibilidade, inviáveis e descartados | [`reference/models/`](reference/models/README.md) | apontam — **inclusive a frota instalada**, desde ago/2026 |
| Stack fixada, versões, regras invioláveis, protocolo de leitura | [`CLAUDE.md`](../CLAUDE.md) | apontam |
| Armadilhas diagnosticadas | [`ARMADILHAS.md`](ARMADILHAS.md) + `study/04-diario-de-bordo.md` | apontam — saiu do `HISTORY.md` em ago/2026 |
| Histórico, decisões, alternativas descartadas | [`HISTORY.md`](HISTORY.md) | apontam |
| Índice tabular por decisão individual (trilha, sigla, título) | [`DECISOES.md`](DECISOES.md) | derivado — sem narrativa própria, nunca duplica `HISTORY.md` |
| Marcos além dos 10 mais recentes, comprimidos | [`HISTORY-archive.md`](HISTORY-archive.md) | apontam — nunca se conserta link interno lá dentro |
| Pendências e gatilhos de revisão | [`ROADMAP.md`](ROADMAP.md) | apontam |
| Fundamentos do Electron, anatomia, medições | [`study/`](study/README.md) | apontam |

> Quando um fato mudar, mude-o **no dono** e confira se os ponteiros ainda fazem sentido. Duplicar um fato em dois lugares é dívida: o segundo lugar envelhece calado, e ninguém descobre até seguir o conselho errado.

---

## O que vai em cada pasta quando há dúvida

| Se o documento… | vai para |
|---|---|
| descreve trabalho a fazer, com passos e aceite | `plan/active/` |
| explica um conceito para aprender | `study/` |
| é consulta técnica estável — comparativo, medição, especificação externa | `reference/` |
| registra o que já foi feito e por quê | `HISTORY.md` |
| registra um erro que custou tempo, para não custar de novo | `ARMADILHAS.md` |
| lista o que falta | `ROADMAP.md` |
| define o produto | `ESCOPO.md` |

Na dúvida entre `study/` e `reference/`: **`study/` se lê uma vez para entender; `reference/` se consulta muitas vezes para lembrar.**
