# 00 — Visão geral

O projeto tem quatro commits. Três deles são documentação; o quarto é o scaffold do `electron-vite` sem uma linha alterada. Isso não é atraso — é a posição mais barata que existe para tomar decisões estruturais.

Este documento explica o critério que ordena as oito fases, registra as decisões que valem para todas elas, e delimita o que ficou de fora.

---

## O critério: o que é caro de desfazer

Existe uma pergunta que separa o que fazer agora do que adiar, e ela não é "isto é importante?". É:

> **Se eu adiar isto, quantos arquivos vou ter que tocar quando finalmente fizer?**

Algumas decisões custam um arquivo hoje e cinquenta daqui a seis meses. Outras custam o mesmo hoje ou depois — e essas devem ser adiadas, porque decidir cedo sobre código que ainda não existe é chutar.

**Caro de adiar** — a mudança se espalha por toda superfície já escrita:

| Decisão | Por que se espalha |
|---|---|
| Contrato IPC tipado | Cada canal novo escrito no padrão errado é um lugar a mais para corrigir depois |
| `Result` em vez de exceção na fronteira | Exceção não sobrevive ao IPC (ver abaixo). Trocar depois toca todo handler, todo hook e toda UI de erro de uma vez |
| Cancelamento e progresso no contrato | Retrofitar cancelamento numa API com vinte chamadas é reescrevê-la |
| `sandbox: true` | Com o preload vazio, custa zero. Com o preload ramificado, custa uma tarde |
| Tokens em fonte única | Duas fontes de verdade divergem em silêncio, e a correção é buscar hardcode em todo componente |
| Estrutura de camadas e regra de importação | Mover arquivo é fácil; desfazer dependência cruzada que já existe não é |
| `build:win` verde desde já | O instalador quebra por motivos que `pnpm dev` nunca revela |

**Barato de adiar** — nada do que existe hoje precisa mudar quando isso chegar:

Storybook, testes de componente exaustivos, estado global, i18n, sistema de plugins, atualização automática, virtualização de tabela, e — deliberadamente — o próprio DuckDB.

> 🔍 Este critério é a versão para o Electron do **"divide-se ao tocar"**: não refatore preventivamente a base inteira, mas não deixe apodrecer o que já estourou. A diferença é que aqui a régua se aplica *antes* de o código existir, porque o custo assimétrico é conhecido de antemão.

---

## Decisões globais

Estas atravessam todas as fases. As decisões locais ficam em cada documento.

### D1 — A fronteira de processo é a arquitetura

Não existe camada inventada neste projeto. As três que importam — `main`, `preload`, `renderer` — já são impostas pelo runtime, com globals diferentes e compilação separada. `core/`, `shared/` e `workers/` apenas nomeiam o que sobra.

**Descartado:** Clean Architecture com entities/usecases/repositories. A justificativa dessas camadas é isolar de infraestrutura que pode mudar. O DuckDB não vai ser trocado — ele é o produto. Um repositório sobre ele jogaria fora justamente o que ele tem de bom.

### D2 — SOLID entra parcial, não em bloco

SOLID nasceu em OOP de classes, num mundo onde a biblioteca era distribuída em binário e você não podia editar o fonte.

| | Veredicto |
|---|---|
| **SRP** | Já coberto pela régua de coesão e tamanho. Não adiciona nada. |
| **OCP** | **Descartado.** Você é dono do repositório e tem git. Ponto de extensão especulativo é retrabalho antecipado. |
| **LSP** | Quase inaplicável. União discriminada e composição cobrem os casos. |
| **ISP** | **Adotado.** É o argumento contra expor um `invoke(canal, args)` genérico no preload. |
| **DIP** | **Adotado**, na forma nativa da linguagem: parâmetro de função tipado. Nada de container de DI — é imposto de Java numa linguagem com função de primeira classe. |

### D3 — Erro é dado, não exceção

Se um handler do main lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado com `Error invoking remote method '...'`, com stack do renderer. A classe, as propriedades customizadas e o stack original se perdem no *structured clone*.

Na prática: um `QuerySyntaxError { line, column }` chega do outro lado como texto inútil, e você não consegue destacar a linha do erro no editor.

Por isso toda operação que atravessa a fronteira retorna união discriminada. Detalhes na [fase 02](02-contrato-ipc.md).

### D4 — Português na interface, inglês no código

Mesma regra do projeto Python: identificadores, comentários, docstrings e logs em inglês. Português apenas em texto visível ao usuário e em mensagens de erro que chegam cruas à interface.

Estes documentos de planejamento são português, porque são leitura, não código.

### D5 — Nenhuma dependência nova sem justificativa registrada

O plano inteiro adiciona três grupos de pacotes, e a [fase 06](06-primeira-feature.md) — a que mais entrega — não adiciona nenhum. Cada um aparece na fase que o introduz, com a alternativa descartada:

| Pacote | Fase | Descartado no lugar |
|---|---|---|
| `zod` | 02 | Validação manual — repetitiva, e o tipo continua sendo escrito à parte |
| `vitest`, `jsdom`, `@testing-library/*` | 04 | Jest — segunda cadeia de transformação num projeto que já roda em Vite |
| `@playwright/test`, `electron-playwright-helpers` | 07 | Spectron — arquivado e descontinuado desde o Electron 14 |

**Não entra:** Tailwind, biblioteca de componentes, container de DI, gerenciador de estado global.

**Adiado com gatilho registrado:** `@tanstack/react-query`. A intenção original era adotá-lo na fase 06, e o próprio critério de "caro de adiar" reprovou a ideia — o que ele entrega (cache com chave, invalidação, deduplicação) não tem uso antes de existirem consultas repetidas, e migrar depois custa os poucos hooks que existirem. O raciocínio completo está na [D6.2](06-primeira-feature.md#d62--sem-tanstack-query-nesta-fase), e vale como exemplo de decisão revista pela régua em vez de por preferência.

### D6 — `src/main/index.ts` não cresce

O arquivo é ciclo de vida e criação de janela. Handler de IPC vive em `src/main/features/<x>/`, registrado por um wrapper genérico. Se lógica de negócio entrar no main, ela fica intestável e imóvel — e mover para `utilityProcess` depois vira reescrita, não refatoração.

---

## Uma correção no caderno de estudos

O documento [`05-proximos-passos.md`](../../study/05-proximos-passos.md) afirma que o `ArrayBuffer` transferível torna a travessia entre processos "praticamente instantânea, independente do tamanho".

Isso vale **dentro** de um processo — renderer para Web Worker, por exemplo, onde a memória é a mesma e só a posse muda. Entre processos do sistema operacional os bytes precisam ser copiados de qualquer forma. Além disso a implementação do Electron tem limitações conhecidas: há relato de mensagem que chega vazia ao transferir transferível de renderer para main, e de crash com certos `ArrayBuffer` na lista de transferíveis do `MessagePortMain`.

**A decisão por Arrow continua certa**, mas por outro motivo: o *structured clone* binário elimina a alocação de um milhão de objetos e a conversão para texto. É cópia rápida de bloco contíguo, não transferência de posse — a diferença sobre JSON continua sendo de ordens de grandeza.

Ação: ajustar o texto do documento 05 e **medir** no passo 5 daquele plano, em vez de assumir milissegundos.

---

## O que fica explicitamente fora

Registrado para não ser confundido com esquecimento:

- **DuckDB, `utilityProcess` e Arrow.** Continuam no `05-proximos-passos.md`. A fundação existe justamente para que aquele plano seja executável sem improviso.
- **Virtualização de tabela.** Chega junto com dados de verdade para virtualizar.
- **Atualização automática.** O `electron-builder.yml` já tem um `publish` apontando para `https://example.com/auto-updates` — placeholder do template, não configuração nossa. Fica como está até existir distribuição real.
- **`shamefullyHoist: true`.** Registrado como pendência de segurança na [fase 03](03-sandbox-e-seguranca.md), sem ação nesta rodada.
- **Assinatura de código e notarização.** Só faz sentido com distribuição.

---

## Mapa de dependência entre fases

```
01 camadas ──► 02 contrato ──┬─► 03 sandbox ─────────────┐
                             │                           │
                             └─► 04 testes ──► 05 tokens ─┴─► 06 feature ──► 07 e2e ──► 08 automação
```

A 05 é a de posição mais flexível: estruturalmente ela só precisa da 01, e é a 04 que ela usa no critério de aceite. Se preferir alternar entre trabalho de estrutura e trabalho visível, ela é a folga — pode ser antecipada para logo depois da 01, adiando apenas a verificação.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| — | — | não iniciada | — |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Índice:** [README](README.md) · **Próximo:** [01 — Camadas e fronteiras](01-camadas-e-fronteiras.md)
