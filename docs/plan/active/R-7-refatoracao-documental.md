# R-7 — Refatoração documental: o ruído sai, o fato fica

**Trilha:** R · Quatro cortes, um commit cada. **Nenhuma linha de `src/`.**

| | Corte | Escopo | Pré-req. |
|---|---|---|---|
| **A** | `reference/` — uma pasta por referência | ✅ | — |
| **B** | os registros — `HISTORY.md` fica só com marcos; `DECISOES.md` recupera a seção final | | — |
| **C** | produto e processo — `ESCOPO.md`, `ROADMAP.md`, `docs/README.md`, e os tetos novos | | A |
| **D** | leitura de toda sessão — `CLAUDE.md`, skills, `README.md` da raiz, fechamento | | A, B, C |

---

## Tetos — medidos em 06/09/2026

| Arquivo | Hoje | Vigente | Após o R-7 |
|---|---|---|---|
| `ARMADILHAS.md` | 117,0 kB | 80 | **150** (R7.1) |
| `ROADMAP.md` | 69,6 | 45 | 45 |
| `DECISOES.md` | 66,0 | 45 | **100** |
| `HISTORY.md` | 50,3 | 10 marcos | 10 marcos, **só marcos** |
| `ESCOPO.md` | 47,8 | 45 | 45 |
| `CLAUDE.md` | 39,4 | 25 | **35** (R7.7) |
| skill (8 arquivos, 120,0 total) | maior 24,2 | 40 | 40 — nenhuma estoura |

⚠️ **A série do [`ROADMAP § 2`](../../ROADMAP.md) mente em dois lugares** — registra `ROADMAP` 60,3 e `DECISOES` 58,7. Os dois foram medidos no passo de conservação da 6ª revisão e **editados depois, no mesmo dia**. Cada corte daqui remede no próprio último passo.

---

## A régua de redação, e ela muda por tipo de documento

O erro a evitar é aplicar a régua do `ESCOPO.md` em tudo: um documento atemporal e uma skill falham por motivos opostos.

| Documento | Sai | Fica |
|---|---|---|
| `ESCOPO.md` | marca temporal, narrativa, medição com proveniência, detalhe de código (nome de `.ts`, constante, assinatura) | o número que decide produto |
| `ROADMAP.md` | a entrega recontada dentro da célula | a linha de uma linha, e a **sigla** que leva ao dono |
| `docs/README.md` | história do gatilho, status de teto (dono é o `ROADMAP § 2`) | a régua, o ciclo, o formato |
| skill | **proveniência** — em que plano nasceu, quando, o que se pensava antes, o relato de reversão | o **fato** e o **aviso** |
| `CLAUDE.md` | o que tem outro dono; prosa que a tabela ao lado já diz | tabela (intocada) e a regra que decide a primeira linha |
| `HISTORY.md` | decisão arquitetural — desce para o archive | marco de ciclo de plano |

**O teste, um por tipo:** o `ESCOPO` pergunta *"esta frase envelhece sozinha?"*. A skill pergunta *"tirar isto enfraquece o aviso?"* — `"medido, não suposto: JSON venceu Arrow"` sem o *medido* vira opinião.

⚠️ **Verificar por `grep`, nunca por leitura.** Na 6ª revisão a leitura deixou passar cinco marcas temporais depois de nove passos de revisão consciente; o grep achou as cinco. Texto comprimido nunca parece incompleto — mesmo motivo pelo qual o `git diff` é a verificação da compressão.

---

## Decisões

**R7.1 — O corte do `ARMADILHAS.md` foi avaliado e abortado, com o número que justifica.** As 83 entradas ativas somam 93,6 kB (média 1,13); comprimir as ~20 maiores rende ~10 kB, e o teto de 80 seguiria estourado em 34%. **Mover de `## Ativas` para `## Arquivadas` não recupera um byte** — as duas seções vivem no mesmo arquivo. Restavam um `ARMADILHAS-archive.md` ou subir o teto; escolhido **150 kB**, pelo argumento que já vale para o `DECISOES.md`: busca-se **por sintoma**, nunca se lê inteiro, logo ninguém paga o tamanho. Gatilho de revisão, não dívida.

**R7.2 — Uma pasta por referência, com slug fiel ao nome citado.** `<slug>/README.md` deixa a referência ganhar anexo sem que o anexo vire um segundo arquivo solto. O slug preserva o nome pelo qual a referência é citada — `grep` pelo nome antigo ainda acha o destino. Só normalização de forma; nada de encurtar.

**R7.3 — A decisão do R-2 de *marcar em vez de mover* os consumidos é revista por fato novo.** Ela registrava que mover quebraria links de registro em `plan/implemented/` e `HISTORY.md`. Mudou o que a sustentava: a `guard` ganhou a invariante de link relativo quebrado, e o inventário mediu o custo — **26 links em 15 arquivos**, mecânico e verificável. Consumido ganha pasta igual; `reference/` **não** ganha um `arquivo/`.

**R7.4 — Em registro histórico, o alvo do link se conserta; o texto do link, não.** Em `plan/implemented/` e `HISTORY-archive.md` a substituição toca só o que está dentro de `](…)`. A menção em prosa é o registro do que aquela sessão leu; reescrevê-la falsificaria o registro. O link aponta para hoje, o texto conta o que era.

**R7.5 — O `HISTORY-archive.md` recebe, mas não se reescreve.** A isenção declarada nele existe para poupar trabalho, não para preservar link quebrado quando o conserto é gratuito — um link entrou no mesmo `sed` dos outros 25. Acrescentar à fila não é editar o que já está lá.

**R7.6 — As 16 decisões do `HISTORY.md` vão para o fim de uma seção que já existe com esse nome.** `HISTORY-archive.md § Decisões arquiteturais (justificativas citáveis)` já abre com *"decisões que valem além do plano onde nasceram"*. Entram no **fim**, ponto cronologicamente mais antigo — são da fundação e dos planos 00–15. Furar a fila pelo topo invalidaria o propósito do archive.

**R7.7 — O teto de 25 kB do `CLAUDE.md` era inalcançável; o novo é 35.** Tabela 16,5 kB (42%), prosa 22,8 (58%): comprimir a prosa em 40% daria 30,2, ainda 21% acima. O conteúdo se paga — o protocolo que ele carrega reduz o consumo de toda sessão. Tabela não se toca; o que sai são seções que mudam de dono, e a tabela viaja junto com a seção.

---

## O que cada corte restante precisa saber

**B.** As 16 seções `### Decisão:` são 19,4 kB — 39% do `HISTORY.md`, contra 26,6 kB dos dez marcos. Saem porque o teto do arquivo é *10 marcos* e não as alcança: são bloco permanente dentro de um mecanismo de contenção que não as vê. Há duplicação real — `SOLID entra parcial` = `D2`, `Erro é dado` = `D3`, ambas também regra viva em skill. Junto: `DECISOES.md § Plano ainda ativo` tem **68 linhas, 62 apontando para `plan/implemented/`** — as trilhas E-1/E-2 fecharam e as linhas nunca saíram; sobram as seis `D9.x`.

**C.** O cabeçalho do `ROADMAP § 1` promete *"entrega em uma linha"* e há células de 1.500+ caracteres.

**D.** Seis defasagens no `README.md` da raiz: a identidade é a anterior à 6ª revisão; raciocínio visível e exportação de documento estão em *"o que ainda falta"* estando entregues; a trilha O não é mencionada; `.pptx` lê como recusa depois de a 6ª revisão movê-lo para *previsto*; e três documentos dão três números diferentes para o tamanho de `docs/` (~490k, ~523k, ~525k).

---

## Diário de execução

| # | Data | O que aconteceu |
|---|---|---|
| 1 | 06/09/2026 | Brief medido antes do plano. Dois achados mudaram o desenho: a série do `§ 2` já mentia por medição feita antes da última edição, e mover armadilha entre seções do mesmo arquivo não recupera byte — o corte do `ARMADILHAS` foi abortado com teto de 150 kB (R7.1). Corte A executado. |
