# Histórico de decisões e entregas — data-lab

Changelog em ordem cronológica inversa. **Uma entrada curta por marco**, com link para o plano correspondente em [`plan/implemented/`](plan/implemented/) ou [`plan/archive/`](plan/archive/). O detalhe completo vive no plano linkado; aqui fica só o "o quê + por quê". Pendências ficam em [`ROADMAP.md`](ROADMAP.md) e [`plan/active/`](plan/active/).

> **Fonte única de história.** O `CLAUDE.md` e as skills apenas **apontam** para cá — não narram plano concluído nem repetem justificativa de decisão.

---

## Como escrever uma entrada

Uma entrada nasce quando um plano sai de `active/` para `implemented/`. O formato é fixo:

```markdown
### Título do marco (mês/ano)
Origem: o que motivou. Entrega: o que passou a existir. Decisões: o que foi escolhido
e o que foi descartado, com o porquê. [`plan/implemented/NOME.md`](plan/implemented/NOME.md).
```

Três a oito linhas. Se precisar de mais, o detalhe pertence ao plano, não aqui.

**O que nunca pode faltar:** a alternativa descartada e o motivo do descarte. É o único conteúdo que não se recupera lendo o código depois — o código mostra o que foi feito, nunca o que foi considerado e rejeitado.

---

## Entregas (marcos)

*Nenhuma ainda. O projeto está na fase de fundação — ver [`plan/active/`](plan/active/README.md).*

### Escopo e plano de fundação definidos (ago/2026)
Origem: quatro commits no repositório, dos quais três eram documentação e um o scaffold do `electron-vite` intocado — a posição mais barata que existe para tomar decisões estruturais. Entrega: o [`ESCOPO.md`](ESCOPO.md) fecha o produto (bancada local de limpeza e transformação de arquivos, por pipeline de passos que compila para SQL do DuckDB); o [plano de fundação](plan/active/README.md) descreve oito fases, 33 passos, cada um com critério de aceite verificável e mensagem de commit; a [camada de IA](plan/active/09-camada-de-ia.md) registra como Ollama, Gemini, GLM e ML se encaixam sem exigir replanejamento. Critério que ordena tudo: **se eu adiar isto, quantos arquivos vou tocar quando finalmente fizer?** Nada de código foi escrito.

---

## Decisões arquiteturais (justificativas citáveis)

Decisões que valem além do plano onde nasceram. Cada uma é curta de propósito — o raciocínio completo mora no documento linkado.

### Decisão: erro que atravessa o IPC é dado, não exceção
Exceção não sobrevive ao `structured clone` do Electron. Se um handler lança, o `ipcRenderer.invoke` rejeita com um `Error` genérico prefixado com `Error invoking remote method`, e a classe, as propriedades customizadas e o stack original se perdem. Um `QuerySyntaxError { line, column }` chegaria ao React como texto inútil. Por isso toda operação que atravessa a fronteira retorna união discriminada. **Contrapartida deliberada:** payload fora do schema **lança** — é bug de programação, e um erro mutilado no console durante o desenvolvimento é a resposta certa. [`plan/active/02-contrato-ipc.md`](plan/active/02-contrato-ipc.md)

### Decisão: pipeline de passos, não SQL-first
A composição de uma transformação vive numa lista ordenada de operações que compila para SQL, e não numa consulta única. Descartado o modelo query-first do mill.tools: ele serve para *perguntar* ao dado, e aqui o trabalho é *tratar* o dado — iterativo, com o resultado de um passo mudando o que se quer no seguinte. Desfazer vira remover um passo, cada passo é inspecionável, e a sequência é uma receita reaplicável a outro arquivo. Descartada também a grade editável célula a célula: exigiria estado mutável, desfazer por diff e escrita através da virtualização. [`ESCOPO.md`](ESCOPO.md)

### Decisão: NL→passo, não NL→SQL
Revisão de uma decisão anterior. A intenção original era portar o `nl2sql` do mill.tools; o modelo de pipeline a invalidou. Gerar SQL opaco a partir de português contorna o que dá valor ao modelo — passo é editável e inspecionável, SQL de trinta linhas não é. A IA passa a produzir **a mesma estrutura de dados que a interface produz**, o que a torna barata e a obriga a vir depois do pipeline. Privacidade inegociável nos dois casos: o modelo recebe o esquema, nunca as linhas. [`plan/active/09-camada-de-ia.md`](plan/active/09-camada-de-ia.md)

### Decisão: chamada de modelo no main; cálculo sobre vetores no `utilityProcess`
Contraria a intuição criada pelo raciocínio do DuckDB, e a distinção é o ponto. O DuckDB precisa de processo separado porque é limitado por CPU e bloqueia a thread; uma requisição HTTP ao Ollama ou ao Gemini é limitada por entrada e saída, e o `fetch` assíncrono devolve o controle ao *event loop*. Já recuperação de RAG — cosseno sobre matriz, BM25, MMR — **é** limitada por CPU e acompanha o DuckDB. A fronteira é *quem bloqueia a thread*, não *o que parece pesado*. [`plan/active/09-camada-de-ia.md`](plan/active/09-camada-de-ia.md)

### Decisão: segredo é de mão única — o renderer escreve, nunca lê
O contrato de credenciais tem `set`, `status` e `clear`, e não tem `get`. Chave que chega ao renderer entra em estado do React, aparece no DevTools e vai parar em relatório de erro. Armazenamento é `safeStorage` (DPAPI no Windows) em `app.getPath('userData')` — **nunca `.env` na raiz**: o mill.tools pode fazer isso porque roda do fonte; app empacotado que lê `.env` da raiz distribui a chave junto com o instalador. Regra fixada antes de existir a primeira chave. [`plan/active/03-sandbox-e-seguranca.md`](plan/active/03-sandbox-e-seguranca.md)

### Decisão: SOLID entra parcial — ISP e DIP sim, OCP não
SOLID nasceu em OOP de classes, num mundo onde a biblioteca era distribuída em binário e não se podia editar o fonte. **ISP** é adotado — é o argumento contra expor um `invoke(canal, args)` genérico no preload. **DIP** é adotado na forma nativa da linguagem: parâmetro de função tipado, sem container de injeção, que é imposto de Java numa linguagem com função de primeira classe. **OCP é recusado**: somos donos do repositório e temos git, e ponto de extensão especulativo é retrabalho antecipado. SRP já está coberto pela régua de coesão; LSP é quase inaplicável com união discriminada. [`plan/active/00-visao-geral.md`](plan/active/00-visao-geral.md)

### Decisão: TanStack Query adiado, e a régua é que decidiu
A intenção declarada era adotá-lo na primeira feature vertical. Aplicado o critério do próprio plano — *se eu adiar, quantos arquivos toco depois?* — a resposta foi dois hooks. As duas operações são mutações; o que a biblioteca entrega de fato (cache com chave, invalidação, deduplicação) não tem uso antes de existirem consultas repetidas sobre o mesmo dado. Registrado como exemplo de decisão revista pela régua, e não por preferência. **Gatilho** em [`ROADMAP.md`](ROADMAP.md). [`plan/active/06-primeira-feature.md`](plan/active/06-primeira-feature.md)

### Decisão: tokens em CSS custom properties, sem Tailwind
Reversível de propósito, e vale registrar por quê. O `@theme` do Tailwind v4 resolve bem a fonte única, mas é dependência que afeta o build num projeto ainda validando a própria fundação. Como os tokens são custom properties, o Tailwind pode ser adicionado depois **lendo o mesmo arquivo**, sem reescrever token nenhum: adiar custa conveniência de escrita, não estrutura. Descartada sem volta a biblioteca de componentes (MUI, Chakra, shadcn) — trazem densidade e vocabulário de web, que é o oposto do que um app de desktop precisa. [`plan/active/05-design-tokens.md`](plan/active/05-design-tokens.md)

### Decisão: hooks do Claude Code em `.mjs`, não `.py`
O mill.tools usa Python porque Python **é** a stack dele. Aqui seria a exceção: Node já é dependência obrigatória, Python não — e no Windows um `python` no PATH pode ser o stub da Microsoft Store, que abre a loja em vez de executar. Ganho concreto além disso: o `guard.mjs` lê o `tokens.css` do próprio projeto e valida `var(--token)` contra as declarações reais, o que a versão em regex não fazia. Os binários são resolvidos pelo campo `bin` do `package.json` de cada dependência e executados com o próprio Node — sem shell, o que elimina PATHEXT e aspas em caminho com espaço. [`plan/active/08-automacao-e-registro.md`](plan/active/08-automacao-e-registro.md)

---

## Armadilhas diagnosticadas

Registradas para não repetir o trabalho de investigação. As da montagem inicial estão detalhadas em [`study/04-diario-de-bordo.md`](study/04-diario-de-bordo.md).

### `ArrayBuffer` transferível **não** é transferência de posse entre processos (ago/2026)
O [`study/05-proximos-passos.md`](study/05-proximos-passos.md) afirmava que o transferível torna a travessia "praticamente instantânea, independente do tamanho". Isso vale **dentro** de um processo — renderer para Web Worker, onde a memória é a mesma. Entre processos do sistema operacional os bytes são copiados de qualquer forma, e a implementação do Electron tem limitações conhecidas (mensagem que chega vazia ao transferir de renderer para main; crash com certos `ArrayBuffer` na lista de transferíveis do `MessagePortMain`). **A decisão por Arrow continua certa, por outro motivo:** o *structured clone* binário elimina a alocação de um milhão de objetos e a conversão para texto. É cópia rápida de bloco contíguo, não transferência de posse — e a diferença sobre JSON segue sendo de ordens de grandeza. Ação: medir no passo 5 daquele plano em vez de assumir milissegundos.

### Hook que se desliga sozinho em silêncio (ago/2026)
A primeira versão do `_shared.mjs` devolvia `null` quando não conseguia resolver o executável de uma dependência, e os hooks simplesmente não faziam nada. Um teste que parecia confirmar "o Prettier rodou e não alterou o arquivo" era falso positivo: o arquivo ficou intacto por inação. **Hook que se desliga sem avisar é pior que hook ausente**, porque se conta com ele. Corrigido com duas estratégias de resolução (caminho direto e o resolvedor do próprio Node, para os layouts em que a junction do pnpm não atravessa) e, principalmente, com um aviso no stderr quando o pacote **está** instalado mas não pôde ser resolvido. Pacote genuinamente ausente segue silencioso — é o caso legítimo do Vitest antes da fase 04.

---

## Mudanças de ambiente

*Nenhuma registrada. As exclusões do Windows Defender aplicadas na máquina de desenvolvimento estão no [`CLAUDE.md`](../CLAUDE.md), porque são configuração viva e não histórico.*
