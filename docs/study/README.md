# Caderno de estudos — Electron

Esta pasta documenta a construção do `data-lab` do zero, com um objetivo específico: **explicar o porquê, não só o como**.

Tutorial de Electron é o que não falta na internet. O que costuma faltar é o registro honesto das decisões e dos erros — por que essa versão e não a outra, o que quebrou, como foi diagnosticado. É isso que estes documentos guardam.

## Como ler

A ordem é progressiva, mas cada documento se sustenta sozinho.

| # | Documento | O que responde |
|---|---|---|
| 01 | [O que é Electron](01-o-que-e-electron.md) | Como um app de desktop nasce de HTML, CSS e JavaScript. Os três processos, o IPC e o modelo de segurança. |
| 02 | [A stack e o porquê](02-a-stack-e-o-porque.md) | Por que cada versão foi escolhida. O que faz cada ferramenta do toolchain. |
| 03 | [Anatomia do projeto](03-anatomia-do-projeto.md) | Passeio arquivo por arquivo pelo que o scaffold gerou. |
| 04 | [Diário de bordo](04-diario-de-bordo.md) | Os problemas reais que apareceram e o raciocínio de diagnóstico de cada um. |
| 05 | [Próximos passos](05-proximos-passos.md) | Para onde o projeto vai: DuckDB, `utilityProcess` e Apache Arrow. |

## Convenção

Termo técnico aparece **em negrito na primeira vez** e é explicado ali mesmo. Não há pressuposto de conhecimento prévio de Electron. Há pressuposto de familiaridade básica com JavaScript e linha de comando.

Trechos marcados com 🔍 são digressões — informação que enriquece mas pode ser pulada numa primeira leitura.
