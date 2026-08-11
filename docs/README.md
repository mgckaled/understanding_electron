# Documentação — crivo

Esta pasta é a documentação versionada do projeto, organizada **por finalidade**: escopo, história, roadmap, estudo, referência e planos por estado.

> Este arquivo é o mapa. A tabela de fonte única aqui é a versão completa; o [`CLAUDE.md`](../CLAUDE.md) traz uma versão resumida no topo.

---

## Mapa da pasta

```text
docs/
├── README.md        # este arquivo — mapa, ciclo de vida e convenção de fonte única
├── ESCOPO.md        # o que o app faz e não faz — definição de produto
├── HISTORY.md       # changelog de decisões e entregas (cronológico inverso)
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
3. Ao concluir, o arquivo **move** para [`plan/implemented/`](plan/implemented/) e ganha **uma entrada curta** em [`HISTORY.md`](HISTORY.md), com link.
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

**Por que a unidade do `HISTORY.md` é o marco e não a sessão:** um marco costuma levar várias sessões. Se cada sessão virasse entrada, o histórico teria centenas delas e deixaria de ser lido — que é a mesma perda de contexto por outro caminho. O que precisa sobreviver não é "o que fiz na terça"; é "por que ficou assim e o que já foi descartado".

### O escalonamento é o que faz o sistema funcionar

Toda observação nasce no diário. Quando ela vale **além daquele plano**, sobe para o `HISTORY.md` **na mesma sessão**:

| Observação no diário | Sobe? | Para onde |
|---|---|---|
| "terminei o passo 3, falta o 4" | não | morre com o plano |
| "o `pnpm typecheck` levou 40s hoje" | não | ruído |
| "descobri que X quebra quando Y — perdi duas horas" | **sim** | `HISTORY.md` → armadilha |
| "tentei A, não funcionou por Z, fui de B" | **sim** | `HISTORY.md` → decisão |
| "medi 1,2 GB de CSV em 8s" | **sim** | `HISTORY.md` ou `study/04-diario-de-bordo.md` |

A regra prática: **subiu se for custar tempo de novo.** Erro que já custou horas uma vez e não foi registrado custa as mesmas horas na segunda.

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
| Stack fixada, versões, regras invioláveis | [`CLAUDE.md`](../CLAUDE.md) | apontam |
| Armadilhas diagnosticadas | [`HISTORY.md`](HISTORY.md) + `study/04-diario-de-bordo.md` | apontam |
| Histórico, decisões, alternativas descartadas | [`HISTORY.md`](HISTORY.md) | apontam |
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
| lista o que falta | `ROADMAP.md` |
| define o produto | `ESCOPO.md` |

Na dúvida entre `study/` e `reference/`: **`study/` se lê uma vez para entender; `reference/` se consulta muitas vezes para lembrar.**
