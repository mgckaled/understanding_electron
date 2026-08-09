# Caderno de estudos — Electron

Esta pasta documenta a construção do `crivo` do zero, com um objetivo específico: **explicar o porquê, não só o como**.

Tutorial de Electron é o que não falta na internet. O que costuma faltar é o registro honesto das decisões e dos erros — por que essa escolha e não a outra, o que quebrou, como foi diagnosticado. É isso que estes documentos guardam.

---

## Como ler

Onze documentos, em três partes. Cada um se sustenta sozinho; a ordem abaixo é a de menor esforço para quem lê tudo.

### Parte I — Fundamentos

Valem para qualquer projeto Electron, não só para este.

| # | Documento | O que responde |
|---|---|---|
| 01 | [O que é Electron](01-o-que-e-electron.md) | Como um app de desktop nasce de HTML, CSS e JavaScript. Os três processos, o IPC e as camadas de segurança. |
| 02 | [Como escolher a stack](02-a-stack-e-o-porque.md) | O método de decidir versão e ferramenta — LTS, ABI, módulo nativo, e por que instalação verde não é aplicação que abre. |

### Parte II — O projeto real

O que sete fases de trabalho construíram, e o raciocínio por trás de cada peça.

| # | Documento | O que responde |
|---|---|---|
| 03 | [Anatomia do projeto](03-anatomia-do-projeto.md) | Onde as coisas moram: as seis camadas, os `tsconfig`, os aliases. |
| 06 | [A montanha de configuração](06-a-montanha-de-configuracao.md) | Por que um app sem funcionalidade exige mais de vinte arquivos de configuração. |
| 07 | [Camadas e o contrato](07-camadas-e-contrato.md) | Os três problemas do IPC ingênuo, e o contrato tipado que os resolve. |
| 08 | [A fronteira de segurança](08-a-fronteira-de-seguranca.md) | O modelo de ameaça de um app que abre arquivo de terceiro, e as quatro camadas de defesa. |
| 09 | [Testar um app de três processos](09-testar-tres-processos.md) | Os cinco níveis de teste, onde cada um roda, e o que só o app empacotado revela. |
| 10 | [A interface de um app de desktop](10-interface-de-desktop.md) | Por que desktop não é site, tokens em dois níveis, e o estado de uma operação como dado. |
| 11 | [Trabalho longo sem congelar a janela](11-trabalho-longo.md) | Streams, progresso, cancelamento que de fato cancela. |

### Parte III — Investigação e futuro

| # | Documento | O que responde |
|---|---|---|
| 04 | [Diário de bordo](04-diario-de-bordo.md) | Os problemas reais que apareceram, com o raciocínio de diagnóstico preservado. |
| 05 | [Próximos passos](05-proximos-passos.md) | Para onde o projeto vai: DuckDB, processo auxiliar e transporte colunar. |

> 🔍 **Sobre a numeração.** Ela é cronológica de escrita, não de leitura — por isso o 04 e o 05 aparecem por último. Renumerar quebraria as dezenas de links que apontam para esses dois documentos de fora desta pasta, e link morto custa mais que um índice fora de ordem.

---

## Convenções

**Termo técnico** aparece em negrito na primeira vez e é explicado ali mesmo. Não há pressuposto de conhecimento prévio de Electron. Há pressuposto de familiaridade básica com JavaScript e linha de comando.

| Marca | Significa |
|---|---|
| 🔍 | Digressão — enriquece, mas pode ser pulada numa primeira leitura |
| ⚠️ | Armadilha — geralmente uma que já custou tempo aqui |

### A regra que mantém estes documentos vivos

> **O caderno ensina o mecanismo. O número mora no dono e é apontado, nunca repetido.**

Versão, data de release e comparação do tipo "X saiu em tal mês" envelhecem a cada ciclo — e um caderno que precisa de manutenção a cada release não recebe manutenção nenhuma. Onde o número for indispensável, o texto aponta para quem é responsável por ele:

| Assunto | Dono |
|---|---|
| Versões em uso, regras invioláveis, ambiente | [`CLAUDE.md`](../../CLAUDE.md) |
| O que falta subir, e por que está parado | [`ROADMAP.md`](../ROADMAP.md) |
| Decisões tomadas, alternativas descartadas | [`HISTORY.md`](../HISTORY.md) |
| O que o aplicativo faz e não faz | [`ESCOPO.md`](../ESCOPO.md) |

O mesmo vale para conteúdo: estes cadernos **apontam** para os donos acima em vez de repetir o que eles dizem. Fato duplicado é dívida — o segundo lugar envelhece calado, e ninguém descobre até seguir o conselho errado.
