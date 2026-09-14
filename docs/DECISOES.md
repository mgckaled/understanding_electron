# Decisões — crivo

Índice tabular das decisões registradas **dentro do texto de cada plano**. Não é uma fonte nova: a coluna *descrição* nomeia a decisão e o link vai até o plano, onde mora a narrativa completa (alternativa descartada, medição, porquê).

⚠️ **A descrição NÃO é cópia verbatim, e dizer o contrário já envelheceu aqui.** O preâmbulo original prometia *"copiado verbatim, nunca reescrito"*, e as linhas do arco 23 são paráfrase declarada: o título dentro do plano costuma ser curto demais para se sustentar sozinho num índice (`D23F.1 — corte 100% renderer` não diz de que corte), então a linha acrescenta o bastante para responder sem abrir o plano. **O que não pode mudar é o sentido**; o que pode é a forma. Corrigido no 23-K (D23K.6). O dono de história e narrativa continua sendo [`HISTORY.md`](HISTORY.md); este arquivo só resolve uma busca que hoje custava abrir um documento acima do teto de leitura de uma chamada só para achar um parágrafo.

## Como as linhas nasceram

Levantamento mecânico (grep sobre os planos, não transcrição manual), feito no plano `R-5` (ago/2026). ⚠️ **Os números abaixo são o retrato daquele levantamento, não o total de hoje** — a tabela cresce a cada plano (**615 linhas** em 14/09/2026, conferidas por `grep -cE '^\| [^|]+ \| \['`). Remeça antes de citar, nunca copie daqui:

- **203 linhas** vêm de um heading próprio, `### D<id> — <título>`, dentro de 30 arquivos de plano — 29 em [`plan/implemented/`](plan/implemented/) e 1 em [`plan/active/09`](plan/active/09-camada-de-ia.md), marcado "(ativo)" por ainda não ter fechado.
- **10 linhas** vêm de planos cuja seção `## Decisões` é só prosa corrida, **sem sigla própria** (`R-1`–`R-4`, `F-1`, `F-2`, `DS-5`–`DS-8`) — cada um ganha **uma** linha, com a própria sigla do plano e a descrição igual ao título do marco já escrito em `HISTORY.md`/`HISTORY-archive.md`.
- ⚠️ **O que decide uma linha é a decisão ter sigla própria, não o formato em que ela foi escrita.** Três formatos convivem nos planos — `### D<id> — título`, `**D<id> — título.**` e `- **D<id> — título.**` — e os três rendem uma linha **por decisão**. O critério antigo ("heading atômico") descreveria 23-C, 23-D, 23-E, 23-F, 23-H, 23-I e 23-J como uma linha cada, o que nunca foi a prática: eles escrevem em negrito e têm uma linha por sigla. Ajustado no 23-K (D23K.6), junto da régua correspondente em [`README.md`](README.md).
- **Alguns desses 10 planos citam ids próprios** (`R4.1`–`R4.6`, `R5.1`–`R5.8`, `DS5.1`–`DS5.7`) — mas como início de frase em **negrito**, dentro do parágrafo, nunca como heading. Este índice resolve esses ids só na granularidade do plano inteiro; não abre uma linha por `R4.x`/`DS5.x`.
- O link de cada linha aponta para o **arquivo** do plano, sem âncora de heading. Um link por fragmento (`#d18a3`) pareceria mais preciso, mas o GitHub fatia o **heading inteiro** num slug — não só o id — e quebraria em silêncio a cada edição de título. A sigla já está na linha; `Ctrl+F` no arquivo aberto resolve o resto sem depender de um slug frágil.

## Fora deste índice

- **Armadilhas**, em `HISTORY.md` e `HISTORY-archive.md`: já têm dois donos ([`HISTORY.md`](HISTORY.md) + [`study/04-diario-de-bordo.md`](study/04-diario-de-bordo.md)) e se buscam por **sintoma**, não por id — indexá-las aqui duplicaria sem ajudar a busca real.
- **17 blocos "Decisão: …" soltos em `HISTORY.md`** (`grep -c '^### Decisão:'`, ago/2026), anteriores à convenção `D<id>` (arquitetura global, pré-fase-01): não nasceram dentro de um plano, então ficam fora do critério que dá título a este arquivo.
- **`plan/archive/`**: vazio em ago/2026 — nada a indexar.

---

## Transversais

Decisões que valem além do plano onde nasceram — a narrativa de cada uma está em
[`HISTORY-archive.md`](HISTORY-archive.md) § *Decisões arquiteturais*.

| trilha | sigla | descrição |
|---|---|---|
| — | [DT1](ESCOPO.md) | Pipeline de passos, não SQL-first |
| — | [DT2](plan/active/09-camada-de-ia.md) | Dois verbos: NL→SQL para *perguntar*, NL→passo para *tratar* |
| — | [DT3](plan/implemented/19-propor-consulta-e-passos.md) | Um schema zod restringe a geração **e** valida a resposta |
| — | [DT4](plan/implemented/14-persistencia-das-conversas.md) | Persistência em `node:sqlite`; relacional descartado |
| — | [DT5](plan/implemented/18-A-motor-e-worker.md) | SQL gerado por modelo roda com o motor restringido, não com o texto inspecionado |
| — | [DT6](plan/active/09-camada-de-ia.md) | RAG entra por capacidade, nunca por eficiência — o cache de prefixo é o motivo |
| — | [DT7](plan/active/README.md) | Flexibilidade é forma de dado e slot, nunca ponto de extensão |
| — | [DT8](plan/implemented/14-persistencia-das-conversas.md) | Um hook público sobrevive à troca de fonte quando o tipo que ele devolve tem nome próprio |
| — | [DT9](plan/implemented/14-persistencia-das-conversas.md) | O mock de armazenamento delega aos handlers reais, não a uma fake escrita à mão |

**Outras oito decisões do mesmo bloco não ganharam sigla nova, porque já tinham uma** — a narrativa
desceu ao archive e o índice continua sendo a linha que já existia: erro que atravessa o IPC é dado
(`D3`), segredo é de mão única (`D3.4`), SOLID entra parcial (`D2`), TanStack Query adiado (`D6.2`),
tokens em custom properties (`D5.1`), realce com `highlight.js` (`D12.1`), hooks em `.mjs` (`D8.1`),
chamada de modelo no main (`D9.1`).

---

## Fundação (planos 00–12)

| trilha | sigla | descrição |
|---|---|---|
| 00 | [D1](plan/implemented/00-visao-geral.md) | A fronteira de processo é a arquitetura |
| 00 | [D2](plan/implemented/00-visao-geral.md) | SOLID entra parcial, não em bloco |
| 00 | [D3](plan/implemented/00-visao-geral.md) | Erro é dado, não exceção |
| 00 | [D4](plan/implemented/00-visao-geral.md) | Português na interface, inglês no código |
| 00 | [D5](plan/implemented/00-visao-geral.md) | Nenhuma dependência nova sem justificativa registrada |
| 00 | [D6](plan/implemented/00-visao-geral.md) | `src/main/index.ts` não cresce |
| 01 | [D1.1](plan/implemented/01-camadas-e-fronteiras.md) | Seis pastas em `src/` |
| 01 | [D1.2](plan/implemented/01-camadas-e-fronteiras.md) | A tabela de importação é a lei |
| 01 | [D1.3](plan/implemented/01-camadas-e-fronteiras.md) | Aliases em vez de caminhos relativos |
| 01 | [D1.4](plan/implemented/01-camadas-e-fronteiras.md) | `paths` sem `baseUrl` |
| 01 | [D1.5](plan/implemented/01-camadas-e-fronteiras.md) | A regra de importação é verificada pelo ESLint, não pela revisão |
| 02 | [D2.1](plan/implemented/02-contrato-ipc.md) | Um mapa de canais, dois consumidores |
| 02 | [D2.2](plan/implemented/02-contrato-ipc.md) | `Result` para falha esperada, exceção para bug |
| 02 | [D2.3](plan/implemented/02-contrato-ipc.md) | Uma superfície de domínio, não um `invoke` genérico |
| 02 | [D2.4](plan/implemented/02-contrato-ipc.md) | `IpcContract` é o fio; `Api` é a interface |
| 02 | [D2.5](plan/implemented/02-contrato-ipc.md) | Validação com `zod`, schema como fonte dos tipos de argumento |
| 02 | [D2.6](plan/implemented/02-contrato-ipc.md) | Só os argumentos são validados |
| 02 | [D2.7](plan/implemented/02-contrato-ipc.md) | O `jobId` nasce no renderer |
| 02 | [D2.8](plan/implemented/02-contrato-ipc.md) | O listener nunca vaza o evento do Electron |
| 03 | [D3.1](plan/implemented/03-sandbox-e-seguranca.md) | `sandbox: true`, e o preload é bundle único |
| 03 | [D3.2](plan/implemented/03-sandbox-e-seguranca.md) | O que é padrão seguro fica escrito assim mesmo |
| 03 | [D3.3](plan/implemented/03-sandbox-e-seguranca.md) | Navegação é negada por padrão |
| 03 | [D3.4](plan/implemented/03-sandbox-e-seguranca.md) | Segredo é de mão única: o renderer escreve, nunca lê |
| 03 | [D3.5](plan/implemented/03-sandbox-e-seguranca.md) | `shamefullyHoist: true` fica, registrado |
| 04 | [D4.1](plan/implemented/04-testes-rapidos.md) | Vitest com dois projetos, espelhando os dois `tsconfig` |
| 04 | [D4.2](plan/implemented/04-testes-rapidos.md) | `jsdom`, não `happy-dom` |
| 04 | [D4.3](plan/implemented/04-testes-rapidos.md) | Os aliases vêm do mesmo lugar do bundler |
| 04 | [D4.4](plan/implemented/04-testes-rapidos.md) | O mock de `window.api` é derivado do tipo do contrato |
| 04 | [D4.5](plan/implemented/04-testes-rapidos.md) | Meta de cobertura só em `core/` e `shared/` |
| 04 | [D4.6](plan/implemented/04-testes-rapidos.md) | `pnpm build` não roda testes |
| 05 | [D5.1](plan/implemented/05-design-tokens.md) | Custom properties do CSS, sem Tailwind |
| 05 | [D5.2](plan/implemented/05-design-tokens.md) | Dois níveis de token, e componente só toca o segundo |
| 05 | [D5.3](plan/implemented/05-design-tokens.md) | Tema pelo sistema operacional, sem alternador |
| 05 | [D5.4](plan/implemented/05-design-tokens.md) | Seleção de texto desligada por padrão |
| 05 | [D5.5](plan/implemented/05-design-tokens.md) | `ViewState` é vocabulário de interface, não do contrato |
| 05 | [D5.6](plan/implemented/05-design-tokens.md) | O texto de erro fica num registro central |
| 06 | [D6.1](plan/implemented/06-primeira-feature.md) | Fatias verticais, não pastas por tipo |
| 06 | [D6.2](plan/implemented/06-primeira-feature.md) | Sem TanStack Query nesta fase |
| 06 | [D6.3](plan/implemented/06-primeira-feature.md) | `core/` recebe as linhas, não o caminho |
| 06 | [D6.4](plan/implemented/06-primeira-feature.md) | Progresso é limitado a dez emissões por segundo |
| 06 | [D6.5](plan/implemented/06-primeira-feature.md) | Progresso é transmitido a todas as janelas |
| 06 | [D6.6](plan/implemented/06-primeira-feature.md) | Cancelamento é `Result`, não exceção |
| 06 | [D6.7](plan/implemented/06-primeira-feature.md) | O `AbortController` mora no main, indexado pelo `jobId` |
| 07 | [D7.1](plan/implemented/07-e2e-e-empacotamento.md) | Playwright, com o Spectron fora de questão |
| 07 | [D7.2](plan/implemented/07-e2e-e-empacotamento.md) | Poucos testes, e escolhidos pelo que só eles pegam |
| 07 | [D7.3](plan/implemented/07-e2e-e-empacotamento.md) | O nível 5 roda sob demanda, nunca no ciclo de edição |
| 07 | [D7.4](plan/implemented/07-e2e-e-empacotamento.md) | O E2E tem `tsconfig` próprio |
| 07 | [D7.5](plan/implemented/07-e2e-e-empacotamento.md) | A saída do `electron-builder` é `dist/`, não `out/` |
| 08 | [D8.1](plan/implemented/08-automacao-e-registro.md) | Quatro hooks, com custos e papéis diferentes |
| 08 | [D8.2](plan/implemented/08-automacao-e-registro.md) | E2E nunca entra em hook |
| 08 | [D8.3](plan/implemented/08-automacao-e-registro.md) | `CLAUDE.md` guarda o que muda a primeira decisão |
| 08 | [D8.4](plan/implemented/08-automacao-e-registro.md) | Três skills, espelhando a divisão que já funcionou |
| 08 | [D8.5](plan/implemented/08-automacao-e-registro.md) | A régua de tamanho, calibrada pelo que existe |
| 08 | [D8.6](plan/implemented/08-automacao-e-registro.md) | Coesão vale mesmo abaixo do teto |
| 10 | [D10.1](plan/implemented/10-cor-contraste-e-tema-claro.md) | Um token de cor de estado tem **duas** formas, e confundi-las é a causa raiz |
| 10 | [D10.2](plan/implemented/10-cor-contraste-e-tema-claro.md) | Primitivo continua sendo fato; o tema escolhe qual fato usar |
| 10 | [D10.3](plan/implemented/10-cor-contraste-e-tema-claro.md) | O espelhamento `--gray-N → --gray-(13-N)` morre; o tema claro mapeia por intenção |
| 10 | [D10.4](plan/implemented/10-cor-contraste-e-tema-claro.md) | O par verificado é **declarado**, não inferido |
| 10 | [D10.5](plan/implemented/10-cor-contraste-e-tema-claro.md) | `--syntax-*` fica de fora |
| 11 | [D11.1](plan/implemented/11-markdown-na-resposta-do-assistente.md) | O componente nasce **dentro** da fatia `ai-chat`, não em `shared/ui/` |
| 11 | [D11.2](plan/implemented/11-markdown-na-resposta-do-assistente.md) | `react-markdown` + `remark-gfm`, e o argumento é segurança, não conveniência |
| 11 | [D11.3](plan/implemented/11-markdown-na-resposta-do-assistente.md) | Link e imagem: as duas armadilhas que já estão armadas e não dão erro |
| 11 | [D11.4](plan/implemented/11-markdown-na-resposta-do-assistente.md) | Durante o streaming o markdown é renderizado, com o texto parcial fechado antes |
| 11 | [D11.5](plan/implemented/11-markdown-na-resposta-do-assistente.md) | Sem realce de sintaxe nesta fatia |
| 11 | [D11.6](plan/implemented/11-markdown-na-resposta-do-assistente.md) | A mensagem do usuário continua texto cru |
| 11 | [D11.7](plan/implemented/11-markdown-na-resposta-do-assistente.md) | O teste muda de forma, e o de segurança é o que paga |
| 12 | [D12.1](plan/implemented/12-realce-de-sintaxe.md) | `highlight.js` (via `rehype-highlight`), não `shiki` |
| 12 | [D12.2](plan/implemented/12-realce-de-sintaxe.md) | `rehype-highlight` é um `rehypePlugin`, e a D11.2 continua valendo |
| 12 | [D12.3](plan/implemented/12-realce-de-sintaxe.md) | A paleta vem do `@primer/primitives` atual, **não** do `github.css` do `highlight.js` |
| 12 | [D12.4](plan/implemented/12-realce-de-sintaxe.md) | Sete tokens, camada única, e um deles diverge do Primer de propósito |
| 12 | [D12.5](plan/implemented/12-realce-de-sintaxe.md) | Sem cerca com linguagem, sem cor |
| 12 | [D12.6](plan/implemented/12-realce-de-sintaxe.md) | Durante o streaming, colore-se só bloco fechado |
| 12 | [D12.7](plan/implemented/12-realce-de-sintaxe.md) | `.tsx` fica degradado, com estopim registrado |

---

## Arco conversacional (planos 13–19)

| trilha | sigla | descrição |
|---|---|---|
| 13 | [D13.1](plan/implemented/13-casca-do-aplicativo.md) | A casca conhece regiões, não conteúdo |
| 13 | [D13.2](plan/implemented/13-casca-do-aplicativo.md) | Estado de cliente atrás de hooks de propósito, e o streaming fora do store |
| 13 | [D13.3](plan/implemented/13-casca-do-aplicativo.md) | `Message` é lista de partes tipadas, e a forma nasce agora |
| 13 | [D13.4](plan/implemented/13-casca-do-aplicativo.md) | Configuração tem duas escalas, e o modelo não trava |
| 13 | [D13.5](plan/implemented/13-casca-do-aplicativo.md) | A página não rola; a lista rola e ancora |
| 13 | [D13.6](plan/implemented/13-casca-do-aplicativo.md) | O aplicativo tem duas densidades, e os títulos são relativos ao corpo |
| 13 | [D13.7](plan/implemented/13-casca-do-aplicativo.md) | O destino dos três painéis, com o e2e mandando |
| 13 | [D13.8](plan/implemented/13-casca-do-aplicativo.md) | Configurações é modal, não destino de navegação |
| 13 | [D13.9](plan/implemented/13-casca-do-aplicativo.md) | O título vem da primeira mensagem, truncado; não do modelo |
| 14 | [D14.1](plan/implemented/14-persistencia-das-conversas.md) | Duas tabelas, e `parts` é coluna JSON |
| 14 | [D14.2](plan/implemented/14-persistencia-das-conversas.md) | A escada de migração nasce **exercitada**, não só escrita |
| 14 | [D14.3](plan/implemented/14-persistencia-das-conversas.md) | Resposta interrompida grava o parcial, com marcador |
| 14 | [D14.4](plan/implemented/14-persistencia-das-conversas.md) | TanStack Query entra para o cache de servidor; o Context fica com o cliente |
| 14 | [D14.5](plan/implemented/14-persistencia-das-conversas.md) | O renderer continua cunhando `id` e `createdAt` |
| 14 | [D14.6](plan/implemented/14-persistencia-das-conversas.md) | Ao abrir, a conversa mais recente |
| 14 | [D14.7](plan/implemented/14-persistencia-das-conversas.md) | Configurações de máquina numa tabela chave-valor |
| 14 | [D14.8](plan/implemented/14-persistencia-das-conversas.md) | Escrita síncrona no main, e o que a reabre |
| 14 | [D14.9](plan/implemented/14-persistencia-das-conversas.md) | O cartão de dados **não** nasce aqui, porque não há escritor |
| 15 | [D15.1](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | O catálogo é `/api/tags` **mais** um `/api/show` por modelo |
| 15 | [D15.2](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | `num_ctx` é escolha da conversa, e o default sobe |
| 15 | [D15.3](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | Janela deslizante **descartada**, com número |
| 15 | [D15.4](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | O contador é estimativa antes, exato depois — e a própria conversa o calibra |
| 15 | [D15.5](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | Nada é truncado em silêncio: o aplicativo recusa e explica |
| 15 | [D15.6](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | `settings` viaja na linha de `conversation:list` |
| 15 | [D15.13](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | O par `(modelo, num_ctx)` trava no **primeiro envio** |
| 15 | [D15.14](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | A calibração do medidor divide dois momentos diferentes, e a fórmula se cancela |
| 15 | [D15.8](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | Dos quatro modelos instalados, dois ficam e dois saem — e o mais barato é o que muda o aplicativo |
| 15 | [D15.9](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | Os modelos de nuvem **não** entram neste plano, e a costura que entra custa uma palavra |
| 15 | [D15.10](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | Teto zero **não é uma janela**, e a margem de RAM não é um custo fixo |
| 15 | [D15.11](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | O catálogo **relata**; a lista do seletor **julga** |
| 15 | [D15.12](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | O teto cobra do candidato a memória que carregá-lo vai liberar |
| 16 | [D16.1](plan/implemented/16-anexo-mecanismo-e-dataset.md) | O anexo pertence à **mensagem**, não à conversa |
| 16 | [D16.2](plan/implemented/16-anexo-mecanismo-e-dataset.md) | Nenhuma tabela nova, e a coleta é por varredura |
| 16 | [D16.3](plan/implemented/16-anexo-mecanismo-e-dataset.md) | Copiar, endereçado por conteúdo, inclusive o dataset |
| 16 | [D16.4](plan/implemented/16-anexo-mecanismo-e-dataset.md) | O cartão é um só, mora em `core/`, e a regra de privacidade vira teste |
| 16 | [D16.5](plan/implemented/16-anexo-mecanismo-e-dataset.md) | O medidor passa a medir **o que é enviado**, não a transcrição |
| 16 | [D16.6](plan/implemented/16-anexo-mecanismo-e-dataset.md) | Anexar é um job, e o job é a leitura |
| 16 | [D16.7](plan/implemented/16-anexo-mecanismo-e-dataset.md) | `MarkdownMessage` sobe para `shared/ui/` |
| 17 | [D17.1](plan/implemented/17-anexo-documento-e-imagem.md) | Quatro canais novos, não dois |
| 17 | [D17.2](plan/implemented/17-anexo-documento-e-imagem.md) | Assimetria deliberada entre `documentPartSchema` e `imagePartSchema` |
| 17 | [D17.3](plan/implemented/17-anexo-documento-e-imagem.md) | Anexo continua único por mensagem; multi-anexo é escopo recusado, não esquecido |
| 17 | [D17.4](plan/implemented/17-anexo-documento-e-imagem.md) | `AttachmentPart` generalizado uma vez, no passo do documento |
| 17 | [D17.5](plan/implemented/17-anexo-documento-e-imagem.md) | `ai:chat` passa a carregar `Message[]`; o main materializa; ler do SQLite em vez de receber pelo IPC foi descartado |
| 17 | [D17.6](plan/implemented/17-anexo-documento-e-imagem.md) | Preview de imagem: protocolo customizado; `data:` via IPC e `file://` direto descartados |
| 17 | [D17.7](plan/implemented/17-anexo-documento-e-imagem.md) | SVG e WebP convergem para um único rasterizador, produzindo PNG |
| 17 | [D17.8](plan/implemented/17-anexo-documento-e-imagem.md) | Recusa de PDF escaneado usa `AppError.blocked`; conserta um bug real no caminho |
| 17 | [D17.9](plan/implemented/17-anexo-documento-e-imagem.md) | Preview de documento: cartão compacto + expandir |
| 17 | [D17.10](plan/implemented/17-anexo-documento-e-imagem.md) | Aviso de custo: estimativa no rótulo do progresso, sem confirmação prévia |
| 17 | [D17.11](plan/implemented/17-anexo-documento-e-imagem.md) | Gate de visão: dois pontos de checagem, **uma única superfície visível** |
| 17 | [D17.12](plan/implemented/17-anexo-documento-e-imagem.md) | Orçamento ganha adendo fixo para imagem; calibração pula turnos com imagem |
| 17 | [D17.13](plan/implemented/17-anexo-documento-e-imagem.md) | Encoding de documento: `TextDecoder` + BOM + fallback windows-1252, zero dependência nova |
| 17 | [D17.14](plan/implemented/17-anexo-documento-e-imagem.md) | Nenhum passo entrega opção de popover sem função por trás |
| 18-A | [D18A.1](plan/implemented/18-A-motor-e-worker.md) | Entrypoint do worker via `rollupOptions.input` multi-entrada, não build separado |
| 18-A | [D18A.2](plan/implemented/18-A-motor-e-worker.md) | `workers/duckdb/index.ts` não importa `electron`; fala por `process.parentPort` |
| 18-A | [D18A.3](plan/implemented/18-A-motor-e-worker.md) | Config restrita nasce com uma fase vazia, para o 18-F não reabrir este arquivo |
| 18-A | [D18A.4](plan/implemented/18-A-motor-e-worker.md) | `memory_limit`: remedido nesta sessão, não copiado do `ESCOPO.md` |
| 18-A | [D18A.5](plan/implemented/18-A-motor-e-worker.md) | Nenhum canal em `shared/ipc.ts` neste plano; a prova de vida fica dentro de `main/`, verificada ao vivo |
| 18-B | [D18B.1](plan/implemented/18-B-canal-e-consulta.md) | Arrow montado em JS no worker, não recebido pronto do motor |
| 18-B | [D18B.2](plan/implemented/18-B-canal-e-consulta.md) | SQL cru restrito a somente-leitura, e a guarda é sintática, não a fronteira real |
| 18-B | [D18B.3](plan/implemented/18-B-canal-e-consulta.md) | A consulta roda contra uma *view* por hash; o caminho é resolvido **no worker**, não no main — correção sobre o rascunho original, feita ao ler o código real do 18-A |
| 18-B | [D18B.4](plan/implemented/18-B-canal-e-consulta.md) | Teto de 200 linhas via `LIMIT 201`, sem dependência de virtualização — e o embrulho é parametrizado, não fixo |
| 18-B | [D18B.5](plan/implemented/18-B-canal-e-consulta.md) | A UI entra como seção recolhível dentro do `DatasetCard`, não uma tela nova |
| 18-B | [D18B.6](plan/implemented/18-B-canal-e-consulta.md) | `AppError` ganha `invalidQuery`; handler testável via injeção, execução real não é nível 3 |
| 18-C | [D18C.1](plan/implemented/18-C-pre-visualizacao.md) | Sem paginação; um retrato único, não um cursor |
| 18-C | [D18C.2](plan/implemented/18-C-pre-visualizacao.md) | Reaproveita `dataset:query`; zero canal novo, zero contrato tocado — o teto entra no próprio SQL |
| 18-C | [D18C.3](plan/implemented/18-C-pre-visualizacao.md) | "Há mais linhas" vem do `rowCount` já conhecido, não de uma linha extra pedida |
| 18-C | [D18C.4](plan/implemented/18-C-pre-visualizacao.md) | Cache por hash via TanStack Query, mesmo padrão de `useAiModels` |
| 18-C | [D18C.5](plan/implemented/18-C-pre-visualizacao.md) | Sempre visível dentro do `DatasetCard`; a única seção do card sem clique |
| 18-C | [D18C.6](plan/implemented/18-C-pre-visualizacao.md) | `NULL` renderiza distinto de string vazia — reaproveitando a forma real do 18-B, não uma nova |
| 18-C | [D18C.7](plan/implemented/18-C-pre-visualizacao.md) | Escopo de formato: só o leitor delimitado de hoje |
| 18-D | [D18D.1](plan/implemented/18-D-perfil-e-cartao-aninhado.md) | O protocolo do worker ganha discriminador de tipo de pedido |
| 18-D | [D18D.2](plan/implemented/18-D-perfil-e-cartao-aninhado.md) | `core/duckdb/profile.ts`: duas consultas, uma pura, a outra gated pela primeira |
| 18-D | [D18D.3](plan/implemented/18-D-perfil-e-cartao-aninhado.md) | A *view* nasce incondicionalmente a cada pedido de perfil; barato nos dois formatos de ciclo de vida possíveis |
| 18-D | [D18D.4](plan/implemented/18-D-perfil-e-cartao-aninhado.md) | Transporte do perfil é JSON, não Arrow — decisão consciente, não default |
| 18-D | [D18D.5](plan/implemented/18-D-perfil-e-cartao-aninhado.md) | `Disclosure` **não** extraído — a decisão foi revista na implementação: a correção pós-18-C tirou a forma de disclosure do toggle Preview/Consultar, então esta virou a **segunda** ocorrência, não a terceira |
| 18-D | [D18D.6](plan/implemented/18-D-perfil-e-cartao-aninhado.md) | Cache por hash via TanStack Query, mesmo padrão do 18-C |
| 18-E | [D18E.1](plan/implemented/18-E-json-ndjson.md) | Formato é detectado pelo **conteúdo**, uma função só, nunca por um parâmetro novo no canal |
| 18-E | [D18E.2](plan/implemented/18-E-json-ndjson.md) | `DatasetPart` ganha `format`; `delimiter` vira opcional — montados em `attachDataset`, `DatasetSummary`/`scanDelimited` ficam como estão |
| 18-E | [D18E.3](plan/implemented/18-E-json-ndjson.md) | Esquema de JSON vem do motor, não de um parser manual novo; e a ordem do anexo se inverte |
| 18-E | [D18E.4](plan/implemented/18-E-json-ndjson.md) | JSON aninhado é recusado explicitamente — o motor não erra sozinho, o app precisa |
| 18-E | [D18E.5](plan/implemented/18-E-json-ndjson.md) | `kind: 'schema'` reaproveita `ensureView`; `scanDelimited` fica intocado |
| 18-E | [D18E.6](plan/implemented/18-E-json-ndjson.md) | Interface: filtro do diálogo, linha condicional, e o resto do arco só precisa de prova ao vivo |
| 18-F | [D18F.1](plan/implemented/18-F-excel.md) | Vendorizar o binário da extensão; `LOAD` por caminho explícito finalmente exercitado |
| 18-F | [D18F.2](plan/implemented/18-F-excel.md) | Caminho do recurso resolvido no *main*, nunca no bundle do worker |
| 18-F | [D18F.3](plan/implemented/18-F-excel.md) | Terceiro formato decidido por bytes mágicos, não por texto |
| 18-F | [D18F.4](plan/implemented/18-F-excel.md) | Hash de arquivo binário não passa por `StringDecoder` |
| 18-F | [D18F.5](plan/implemented/18-F-excel.md) | `read_xlsx` via o mesmo `ensureDatasetView`; `runSchema`/`hasNestedType` sem mudança |
| 18-F | [D18F.6](plan/implemented/18-F-excel.md) | Interface e os limites explícitos do caminho simples |
| 19 | [D19.1](plan/implemented/19-propor-consulta-e-passos.md) | Catálogo inicial: seis operações, não a camada 1 inteira |
| 19 | [D19.2](plan/implemented/19-propor-consulta-e-passos.md) | `query` e `steps` compartilham o vocabulário de passo, até prova em contrário |
| 19 | [D19.3](plan/implemented/19-propor-consulta-e-passos.md) | Uma fonte só para o schema: `z.toJSONSchema()` alimenta `format` e `.parse()` |
| 19 | [D19.4](plan/implemented/19-propor-consulta-e-passos.md) | Primeiro corte é pré-visualização, não persistência |
| 19 | [D19.5](plan/implemented/19-propor-consulta-e-passos.md) | A chamada de proposta não usa streaming |
| 19 | [D19.6](plan/implemented/19-propor-consulta-e-passos.md) | A verificação pós-execução mede salto parcial de nulo, não contagem de linhas |
| 19 | [D19.7](plan/implemented/19-propor-consulta-e-passos.md) | Nota de fechamento: dois desvios do esboço (Step/StepProposal para `shared/ipc.ts`, canal `ai:propose` próprio) e o achado ao vivo com `gemma3:4b` |
| 19 | [D19.8](plan/implemented/19-propor-consulta-e-passos.md) | Rodada de clique manual: escopo do diálogo de confirmação, `conversation:removeMessage` novo, bug de schema em resultado vazio, vocabulário de filtro deixado em aberto |

---

## Trilha DS — design system

| trilha | sigla | descrição |
|---|---|---|
| DS-1 | [DS1.1](plan/implemented/DS-1-fundacao-tailwind.md) | A camada mora em arquivo próprio, e `tokens.css` não muda |
| DS-1 | [DS1.2](plan/implemented/DS-1-fundacao-tailwind.md) | O passo 0 tem poder de veto, e o fallback é decidido antes |
| DS-1 | [DS1.3](plan/implemented/DS-1-fundacao-tailwind.md) | A guarda nasce antes da migração, não depois |
| DS-1 | [DS1.4](plan/implemented/DS-1-fundacao-tailwind.md) | Zero mudança visual é o aceite, e não é uma formalidade |
| DS-1 | [DS1.5](plan/implemented/DS-1-fundacao-tailwind.md) | A auto-referência funciona porque `tokens.css` está **fora** de toda `@layer`, e isso vira invariante |
| DS-1 | [DS1.6](plan/implemented/DS-1-fundacao-tailwind.md) | O preflight fica, e as divergências com o `base.css` são corrigidas uma a uma |
| DS-1 | [DS1.7](plan/implemented/DS-1-fundacao-tailwind.md) | Diff de tela é aceite de fim de passo, não ferramenta de depuração |
| DS-2 | [DS2.1](plan/implemented/DS-2-migracao-da-casca-e-features.md) | Migração mínima é sobre quanto se **organiza**, nunca sobre quanto se migra |
| DS-2 | [DS2.2](plan/implemented/DS-2-migracao-da-casca-e-features.md) | A ordem é por quanto o DS-3 preserva, não por tamanho |
| DS-2 | [DS2.3](plan/implemented/DS-2-migracao-da-casca-e-features.md) | Zero mudança visual continua valendo, e é ele que torna este plano barato |
| DS-2 | [DS2.4](plan/implemented/DS-2-migracao-da-casca-e-features.md) | Não construir o que o alvo pede |
| DS-3 | [DS3.1](plan/implemented/DS-3-a-interface-chega-ao-alvo.md) | Um plano só, composer por último, DS-4 preservado sem ser gasto |
| DS-3 | [DS3.2](plan/implemented/DS-3-a-interface-chega-ao-alvo.md) | A escala de tipo mexe só na superfície de leitura |
| DS-3 | [DS3.3](plan/implemented/DS-3-a-interface-chega-ao-alvo.md) | Nada do plano 15 desaparece ao mover o seletor |
| DS-4 | [DS4.1](plan/implemented/DS-4-acabamento-final.md) | Fonte: `DS-4-BASE.md` corrigido em 3 pontos técnicos |
| DS-4 | [DS4.2](plan/implemented/DS-4-acabamento-final.md) | Alternador de tema manual, com `nativeTheme.themeSource` como único mecanismo |
| DS-4 | [DS4.3](plan/implemented/DS-4-acabamento-final.md) | Textarea auto-crescente é CSS puro |
| DS-4 | [DS4.4](plan/implemented/DS-4-acabamento-final.md) | `Popover` nasce sobre o atributo nativo, não `position:fixed` manual |
| DS-4 | [DS4.5](plan/implemented/DS-4-acabamento-final.md) | Orçamento de contexto: medidor migra, aviso de recusa fica |
| DS-4 | [DS4.6](plan/implemented/DS-4-acabamento-final.md) | Credenciais de nuvem devolvidas ao plano 09, fatia 3 |
| DS-4 | [DS4.7](plan/implemented/DS-4-acabamento-final.md) | Threads segmentado 2/4/6, reabrindo a recusa anterior conscientemente |
| DS-4 | [DS4.8](plan/implemented/DS-4-acabamento-final.md) | `modelSelector` como render-prop, não fusão de arquivos |
| DS-4 | [DS4.9](plan/implemented/DS-4-acabamento-final.md) | `host` não entra em `ProbeFn`; entra como parâmetro de `isAvailable` |
| DS-4 | [DS4.10](plan/implemented/DS-4-acabamento-final.md) | `useAiAvailability` ganha `retry` espelhando `useAiModels`, não `useQuery` |
| DS-5 | [DS-5](plan/implemented/DS-5-icones-fonte-e-acabamento.md) | ícones, JetBrains Mono e o acabamento que o DS-4 não pediu |
| DS-6 | [DS-6](plan/implemented/DS-6-fundacao-desktop-robusta.md) | fundação de desktop robusta em `base.css`/`tailwind.css` |
| DS-7 | [DS-7](plan/implemented/DS-7-consolidacao-de-tokens-css.md) | consolidação de `tokens.css`: convenções registradas, zero token novo |
| DS-8 | [DS-8](plan/implemented/DS-8-primitivos-refino-e-limpeza.md) | primitivos: dois apagados, contrato de a11y fechado nos que ficam |

---

## Trilha F — features avulsas

| trilha | sigla | descrição |
|---|---|---|
| F-1 | [F-1](plan/implemented/F-1-marca-pensando.md) | a trilha "features avulsas", e a marca "pensando" no chat |
| F-2 | [F-2](plan/implemented/F-2-composer-modelo-sidebar.md) | acabamento do composer, seletor de modelo e sidebar |
| F-3-A | [DF3A.1](plan/implemented/F-3-A-painel-de-artefato.md) | O artefato ganha uma lente efêmera, e continua preso à mensagem — revisão do `ESCOPO.md` |
| F-3-A | [DF3A.2](plan/implemented/F-3-A-painel-de-artefato.md) | `ArtifactRef` é união própria, nunca `AttachmentPart` — é o que faz o gráfico do plano 20 encaixar sem cirurgia |
| F-3-A | [DF3A.3](plan/implemented/F-3-A-painel-de-artefato.md) | O corpo do painel já nasce podendo ser assíncrono, contra o caso difícil (dataset, F-3-D), não contra os fáceis |
| F-3-A | [DF3A.4](plan/implemented/F-3-A-painel-de-artefato.md) | A largura mora no estado desde já; o teto desconta `--sidebar-width`, medido depois de a conversa cair a 248px |
| F-3-A | [DF3A.5](plan/implemented/F-3-A-painel-de-artefato.md) | Estado de janela em contexto próprio, sem persistir; reset ajustado durante a renderização, não em efeito |
| F-3-A | [DF3A.6](plan/implemented/F-3-A-painel-de-artefato.md) | A seta do cartão vira `ChevronRight` e `aria-expanded` dá lugar a `aria-current` — nada expande mais |
| F-3-A | [DF3A.7](plan/implemented/F-3-A-painel-de-artefato.md) | **Revista na execução:** copiar existe para documento e não para imagem; a CSP não foi aberta, porque o bloqueio é CORS (`corsEnabled`), não CSP |
| F-3-A | [DF3A.8](plan/implemented/F-3-A-painel-de-artefato.md) | Foco de ida e de volta, e `Esc` — o painel não é modal, então não prende foco |
| F-3-B | [DF3B.1](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | O clipe abre o anexo mais recente e fecha se já estiver aberto — um clique tem de chegar a conteúdo |
| F-3-B | [DF3B.2](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | Sem anexo, sem ícone; a contagem mora em `core/`, não no componente |
| F-3-B | [DF3B.3](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | O atalho é ouvido no renderer — `globalShortcut` dispara sem foco, e o acelerador local exige um menu que o app não tem |
| F-3-B | [DF3B.4](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | `Ctrl+B` para o painel, invertendo o VS Code: o acorde fácil vai para a ação frequente |
| F-3-B | [DF3B.5](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | O seletor lista os artefatos da conversa; **revista na execução:** a lista subiu para o contexto, e escolher o item aberto não fecha o painel |
| F-3-B | [DF3B.6](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | `ConversationView` se divide por coesão; **revista na execução:** o corte ficou um nível abaixo, e o `div` que rola não se move |
| F-3-B | [DF3B.7](plan/implemented/F-3-B-como-se-chega-ao-painel.md) | O clipe conta o que o painel **consegue abrir** — dataset fica fora até o F-3-D — decisão nascida na execução |
| F-3-C | [DF3C.1](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | Fade na entrada e na saída; a saída obriga o desmonte a esperar, porque `@starting-style` só vale na entrada |
| F-3-C | [DF3C.2](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | O `collapsed` da sidebar sobe para o `App.tsx` — o painel avisa que abriu, a casca decide, e `app/` segue sem importar de `features/` |
| F-3-C | [DF3C.3](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | Recolhe só na abertura, só quando não couber, e nunca reexpande; expandir na mão desliga a regra pela sessão |
| F-3-C | [DF3C.4](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | O teto do painel passa a ler a largura **viva** da sidebar (`--sidebar-width-now`) — 271px → 416px de conversa |
| F-3-C | [DF3C.5](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | A alça é o *window splitter* da WAI-ARIA, com `aria-value*` em pixels e `Enter` fechando sem restaurar |
| F-3-C | [DF3C.6](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | A largura mora no provider e sobrevive à troca de anexo; o arrasto escreve no nó por `ref`, sem passar pelo React |
| F-3-C | [DF3C.7](plan/implemented/F-3-C-o-painel-como-objeto-de-desktop.md) | Arrastar 40px além do piso fecha o painel — registrado como o item mais provável de cair na prova ao vivo |
| F-3-D | [DF3D.1](plan/implemented/F-3-D-o-dataset-no-painel.md) | O corpo do dataset é um `tablist`, e ele **absorve** o *post-18-C fix* em vez de mantê-lo como condição |
| F-3-D | [DF3D.2](plan/implemented/F-3-D-o-dataset-no-painel.md) | O `tablist` mora em `features/artifact/` — a régua é dois chamadores, e uma segunda aba não é um segundo chamador |
| F-3-D | [DF3D.3](plan/implemented/F-3-D-o-dataset-no-painel.md) | O rodapé de paginação nasce inteiro, com o tamanho de página funcionando de verdade e a navegação reservada |
| F-3-D | [DF3D.4](plan/implemented/F-3-D-o-dataset-no-painel.md) | Setas desabilitadas em vez de ausentes — é a DF3A.7 aplicada a um caso em que a premissa dela é falsa |
| F-3-D | [DF3D.5](plan/implemented/F-3-D-o-dataset-no-painel.md) | Número alinha à direita com `tabular-nums`, lido da primeira célula não-nula em vez de um schema |
| F-3-D | [DF3D.6](plan/implemented/F-3-D-o-dataset-no-painel.md) | `DatasetCard` encolhe para gatilho, mas mantém "Propor passos" — é fala ao modelo, não vista do arquivo |
| F-3-D | [DF3D.7](plan/implemented/F-3-D-o-dataset-no-painel.md) | A aba Consulta ganha `Ctrl+Enter`, tempo medido, resultado que não pisca e erro que não apaga o anterior |
| F-3-D | [DF3D.8](plan/implemented/F-3-D-o-dataset-no-painel.md) | SQL digitado e aba escolhida morrem ao fechar o painel — paridade com o cartão, dita em voz alta |
| F-3-D | [DF3D.9](plan/implemented/F-3-D-o-dataset-no-painel.md) | A aba Passos não entra: a proposta é mensagem, o pipeline é estado que ainda não existe (F-3-F) |
| F-3-D | [DF3D.10](plan/implemented/F-3-D-o-dataset-no-painel.md) | Dataset não ganha ⧉ e documento mantém o dele; exportar resultado é da trilha E |
| F-3-E | [DF3E.1](plan/implemented/F-3-E-copiar-imagem.md) | Desenho C: o canal `image:bytes` com o JPEG recodificado no renderer; `clipboard.writeImage` no main recusado por perder alfa no Windows |
| F-3-E | [DF3E.2](plan/implemented/F-3-E-copiar-imagem.md) | A ramificação é pelo `mimeType`, nunca pela extensão — a D17.7 guarda o nome original de um SVG rasterizado |
| F-3-E | [DF3E.3](plan/implemented/F-3-E-copiar-imagem.md) | `Result<Uint8Array>`, sem `kind` novo em `AppError` — blob varrido pelo GC de anexos é dado, não defeito |
| F-3-E | [DF3E.4](plan/implemented/F-3-E-copiar-imagem.md) | A validação de hash sai para `core/` antes do terceiro consumidor: é decisão de segurança, não contagem |
| F-3-E | [DF3E.5](plan/implemented/F-3-E-copiar-imagem.md) | Documento continua copiando no renderer; `copyArtifact` vira despacho por `kind` |
| F-3-E | [DF3E.6](plan/implemented/F-3-E-copiar-imagem.md) | O cartão da transcrição não ganha ⧉ — o F-3 inteiro é sobre o painel |
| F-3-E | [DF3E.7](plan/implemented/F-3-E-copiar-imagem.md) | A ativação transitória fica medida ao vivo; a saída documentada é `Promise<Blob>` no `ClipboardItem` |
| F-3-F | [DF3F.1](plan/implemented/F-3-F-a-aba-de-passos.md) | A proposta continua sendo mensagem; o cartão vira linha — some da tela só quando é apagada de verdade |
| F-3-F | [DF3F.2](plan/implemented/F-3-F-a-aba-de-passos.md) | A aba mostra a proposta que foi aberta, e a transcrição é o índice — nenhuma navegação dentro da aba |
| F-3-F | [DF3F.3](plan/implemented/F-3-F-a-aba-de-passos.md) | Passo se desliga e fica riscado na lista; só a proposta inteira se apaga |
| F-3-F | [DF3F.4](plan/implemented/F-3-F-a-aba-de-passos.md) | `Ver resultado`, não `Aplicar` — nada é gravado, e a trilha E é que terá um botão que grava |
| F-3-F | [DF3F.5](plan/implemented/F-3-F-a-aba-de-passos.md) | O antes-e-depois sobe para o topo; mostrar contagem de linhas não é alarmar com ela (D19.6 intacta) |
| F-3-F | [DF3F.6](plan/implemented/F-3-F-a-aba-de-passos.md) | Apagar no painel apaga a mensagem, e a linha some da conversa junto — uma ação, dois lugares |
| F-3-F | [DF3F.7](plan/implemented/F-3-F-a-aba-de-passos.md) | Passos ligados e resultado vivem em `ArtifactDataset`: sobrevivem à troca de aba, morrem com o painel |
| F-3-F | [DF3F.8](plan/implemented/F-3-F-a-aba-de-passos.md) | Caixa de marcação, não `Switch` — a APG reserva o switch para ação binária, não para item de lista |

---

## Trilha E — exportação de documento

| trilha | sigla | descrição |
|---|---|---|
| E-1-A | [DE1A.1](plan/implemented/E-1-A-o-rascunho-existe.md) | O rascunho é **tabela própria**, não parte de mensagem |
| E-1-A | [DE1A.2](plan/implemented/E-1-A-o-rascunho-existe.md) | `source_message_id` é **procedência**, não posse — e por isso não é chave estrangeira |
| E-1-A | [DE1A.3](plan/implemented/E-1-A-o-rascunho-existe.md) | "Já rascunhei esta resposta?" é estado **derivado**, nunca um sinalizador |
| E-1-A | [DE1A.4](plan/implemented/E-1-A-o-rascunho-existe.md) | O título nasce da primeira linha, e a regra mora em `core/` |
| E-1-A | [DE1A.5](plan/implemented/E-1-A-o-rascunho-existe.md) | `draft:*` **não** retorna `Result` |
| E-1-A | [DE1A.6](plan/implemented/E-1-A-o-rascunho-existe.md) | Identidade nasce no renderer |
| E-1-A | [DE1A.7](plan/implemented/E-1-A-o-rascunho-existe.md) | Este plano **não** tem painel, e isso é o corte, não um adiamento |
| E-1-B | [DE1B.1](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | Um alvo aberto, duas seleções: a exclusão é estrutural |
| E-1-B | [DE1B.2](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | A casca sai para `shared/ui/SidePanel/`; o corpo fica onde está |
| E-1-B | [DE1B.3](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | Cada inquilino guarda a própria largura |
| E-1-B | [DE1B.4](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | `Tabs` não sobe neste plano |
| E-1-B | [DE1B.5](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | `Ctrl+D` no mesmo ouvinte do `Ctrl+B` |
| E-1-B | [DE1B.6](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | O `Esc` do `Dialog` para de vazar, e o conserto é no primitivo |
| E-1-B | [DE1B.7](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | Apagar o rascunho aberto cai para o mais recente que sobrou |
| E-1-B | [DE1B.8](plan/implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) | O contador vira botão, e continua nunca somado ao clipe |
| E-1-C | [DE1C.1](plan/implemented/E-1-C-o-rascunho-se-edita.md) | CodeMirror 6, montado à mão, sem invólucro de React |
| E-1-C | [DE1C.2](plan/implemented/E-1-C-o-rascunho-se-edita.md) | Um objeto de tema serve aos **dois** temas do app |
| E-1-C | [DE1C.3](plan/implemented/E-1-C-o-rascunho-se-edita.md) | Extensões compostas à mão, nunca `basicSetup` |
| E-1-C | [DE1C.4](plan/implemented/E-1-C-o-rascunho-se-edita.md) | `Tabs` sobe para `shared/ui/`, com montagem persistente **opt-in** |
| E-1-C | [DE1C.5](plan/implemented/E-1-C-o-rascunho-se-edita.md) | `Tab` sai do campo, e agora por padrão do próprio editor |
| E-1-C | [DE1C.6](plan/implemented/E-1-C-o-rascunho-se-edita.md) | Grava no `blur`; trocar de rascunho grava antes e **reinicia o documento** |
| E-1-C | [DE1C.7](plan/implemented/E-1-C-o-rascunho-se-edita.md) | Editar retitula, e o título continua derivado |
| E-1-C | [DE1C.8](plan/implemented/E-1-C-o-rascunho-se-edita.md) | O que o nível 2 alcança, e o que só a prova ao vivo alcança |
| E-1-C | [DE1C.9](plan/implemented/E-1-C-o-rascunho-se-edita.md) | A prévia não ganha código |
| E-1-D | [DE1D.1](plan/implemented/E-1-D-o-caminho-de-saida.md) | Um canal só, do diálogo à gravação |
| E-1-D | [DE1D.2](plan/implemented/E-1-D-o-caminho-de-saida.md) | A escrita atômica ganha repetição, porque no Windows ela não é atômica |
| E-1-D | [DE1D.3](plan/implemented/E-1-D-o-caminho-de-saida.md) | `file-in-use` é um `kind` novo, e a razão é o Windows, não a novidade da falha |
| E-1-D | [DE1D.4](plan/implemented/E-1-D-o-caminho-de-saida.md) | O nome sugerido é saneado em `core/`, e o teste é a tabela do Windows |
| E-1-D | [DE1D.5](plan/implemented/E-1-D-o-caminho-de-saida.md) | A última pasta é lembrada, e mora onde configuração de máquina já mora |
| E-1-D | [DE1D.6](plan/implemented/E-1-D-o-caminho-de-saida.md) | `.txt` é markdown despido, e o remark chega aqui |
| E-1-D | [DE1D.7](plan/implemented/E-1-D-o-caminho-de-saida.md) | A confirmação é uma linha `role="status"` no rodapé; o Toast vira **F-5** |
| E-1-D | [DE1D.8](plan/implemented/E-1-D-o-caminho-de-saida.md) | O que se exporta é o documento do editor, não o gravado |
| E-1-D | [DE1D.9](plan/implemented/E-1-D-o-caminho-de-saida.md) | O bundle do `main` ganha uma checagem, porque nenhum teste o alcança |
| E-1-E | [DE1E.1](plan/implemented/E-1-E-o-rascunho-vira-word.md) | `docx` cru + emissor próprio, não conversor pronto |
| E-1-E | [DE1E.2](plan/implemented/E-1-E-o-rascunho-vira-word.md) | O parse vira fonte única, e GFM sozinho **não** bastava — corrigida pela DE1E.9 |
| E-1-E | [DE1E.3](plan/implemented/E-1-E-o-rascunho-vira-word.md) | Externo ou embutido é decidido por sonda, e é o passo 1 |
| E-1-E | [DE1E.4](plan/implemented/E-1-E-o-rascunho-vira-word.md) | Lista numerada custa configuração, e a profundidade é travada em 5 níveis |
| E-1-E | [DE1E.5](plan/implemented/E-1-E-o-rascunho-vira-word.md) | `render` vira assíncrono; é a única costura no `main` |
| E-1-E | [DE1E.6](plan/implemented/E-1-E-o-rascunho-vira-word.md) | O que decide mora em dado plano; o `docx` só serializa |
| E-1-E | [DE1E.7](plan/implemented/E-1-E-o-rascunho-vira-word.md) | O emissor nunca perde texto: o que não mapeia vira parágrafo |
| E-1-E | [DE1E.8](plan/implemented/E-1-E-o-rascunho-vira-word.md) | O documento sai parecendo Word, não parecendo o crivo |
| E-1-E | [DE1E.9](plan/implemented/E-1-E-o-rascunho-vira-word.md) | O `.txt` sai do mesmo `Block[]` do `.docx`, e o `strip-markdown` deixa o projeto |
| E-1-E | [DE1E.10](plan/implemented/E-1-E-o-rascunho-vira-word.md) | Tabela vira `Table` de verdade; o gatilho adiado disparou na primeira exportação |
| E-1-E | [DE1E.11](plan/implemented/E-1-E-o-rascunho-vira-word.md) | O `styles.xml` do `docx` vem sem espaçamento nenhum, e é preciso repor |
| E-1-F | [DE1F.1](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | `printToPDF`, e o HTML sai do `Block[]` — terceiro renderizador, não segundo pipeline |
| E-1-F | [DE1F.2](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | A janela offscreen copia o molde do `rasterizeToPng`, e a carga é em dois tempos |
| E-1-F | [DE1F.3](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | Todo texto é escapado, e o documento nasce com `default-src 'none'` |
| E-1-F | [DE1F.4](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | Paginação é CSS, e são quatro regras que importam |
| E-1-F | [DE1F.5](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | Tipografia do sistema; só normal × monoespaçada precisam diferir |
| E-1-F | [DE1F.6](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | A impressão é injetada, como o diálogo já era |
| E-1-F | [DE1F.7](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | Sem `generateDocumentOutline`/`generateTaggedPDF` — experimentais, um com issue aberta |
| E-1-F | [DE1F.8](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | O doctype pertence à **primeira** carga, ou o PDF sai em modo quirks |
| E-1-F | [DE1F.9](plan/implemented/E-1-F-o-rascunho-vira-pdf.md) | Número de página entra, e o template do Chromium não herda estilo nenhum |
| E-2-A | [DE2A.1](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | Código é um rascunho, e a distinção viaja no item |
| E-2-A | [DE2A.2](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | `kind` e `language` são duas colunas, não uma |
| E-2-A | [DE2A.3](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | `hasDraftOf` filtra por `kind`, ou o botão do turno mente |
| E-2-A | [DE2A.4](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | O título de código não passa pelo `strip` da prosa |
| E-2-A | [DE2A.5](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | O seletor distingue por chip, e o contador não se divide |
| E-2-A | [DE2A.6](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | O botão chega ao `CodeBlock` por prop, e `components` deixa de ser constante |
| E-2-A | [DE2A.7](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | O canal não nasce novo; `draft:create` ganha dois campos |
| E-2-A | [DE2A.8](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | O botão do bloco tem estado, e a chave inclui o conteúdo |
| E-2-A | [DE2A.9](plan/implemented/E-2-A-o-rascunho-aceita-codigo.md) | Código não passa pelo renderizador de markdown, em nenhuma das duas abas |
| E-2-B | [DE2B.1](plan/implemented/E-2-B-cada-linguagem-no-seu-dialeto.md) | Um `Highlighter` só, duas renderizações |
| E-2-B | [DE2B.2](plan/implemented/E-2-B-cada-linguagem-no-seu-dialeto.md) | `legacy-modes`, não os `lang-*` oficiais |
| E-2-B | [DE2B.3](plan/implemented/E-2-B-cada-linguagem-no-seu-dialeto.md) | A cerca é texto livre, então a tabela normaliza e mapeia numa etapa |
| E-2-B | [DE2B.4](plan/implemented/E-2-B-cada-linguagem-no-seu-dialeto.md) | Cerca sem linguagem continua sem gramática e sai `.txt` |
| E-2-B | [DE2B.5](plan/implemented/E-2-B-cada-linguagem-no-seu-dialeto.md) | Rascunho de código exporta verbatim, e o seletor de formato vira rótulo |
| E-2-B | [DE2B.6](plan/implemented/E-2-B-cada-linguagem-no-seu-dialeto.md) | Numeração, rolagem lateral e linha do cursor: a premissa da DE1C.3 mudou |

---

## Trilha N — nuvem opt-in

| trilha | sigla | descrição |
|---|---|---|
| N-1-A | [DN1A.1](plan/implemented/N-1-A-segredo-de-nuvem.md) | `.env` só em desenvolvimento, só como semente, nunca lido pelo app empacotado |
| N-1-A | [DN1A.2](plan/implemented/N-1-A-segredo-de-nuvem.md) | Tabela `secrets` própria, não reaproveita `app_settings` |
| N-1-A | [DN1A.3](plan/implemented/N-1-A-segredo-de-nuvem.md) | Três canais, `secrets:read` não existe |
| N-1-A | [DN1A.4](plan/implemented/N-1-A-segredo-de-nuvem.md) | Backend fraco (`basic_text`) grava com aviso, não recusa |
| N-1-A | [DN1A.5](plan/implemented/N-1-A-segredo-de-nuvem.md) | `CloudProvider` como array `as const`, dois valores hoje, um segredo por **provedor** |
| N-1-B | [DN1B.1](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | Segundo valor de `AiService` |
| N-1-B | [DN1B.2](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | Tabela chumbada (Peça C), fileira própria no seletor |
| N-1-B | [DN1B.3](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | Adaptador GLM: fetch cru, sem SDK |
| N-1-B | [DN1B.4](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | Decifrar no ponto de montagem da chamada, nunca em `secrets/handlers.ts` |
| N-1-B | [DN1B.5](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | `register-all.ts` vira o resolver que o próprio arquivo já previa |
| N-1-B | [DN1B.6](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | Recusa de nível 3: reaproveita `AppError.kind === 'blocked'`, não inventa um novo |
| N-1-B | [DN1B.7](plan/implemented/N-1-B-provedor-glm-ponta-a-ponta.md) | A costura do renderer é só o que enviar-uma-mensagem-ao-GLM exige |

---

## Trilha O — observatório

| trilha | sigla | descrição |
|---|---|---|
| O-1 | [DO1.1](plan/implemented/O-1-a-casca-do-observatorio.md) | A casca copia o padrão de `Settings`, não inventa provider |
| O-1 | [DO1.2](plan/implemented/O-1-a-casca-do-observatorio.md) | Dois painéis, porque um não prova a invariante |
| O-1 | [DO1.3](plan/implemented/O-1-a-casca-do-observatorio.md) | `lazy` + `Suspense` na fronteira do modal, não por painel |
| O-1 | [DO1.4](plan/implemented/O-1-a-casca-do-observatorio.md) | `Versions` muda de casa |
| O-1 | [DO1.5](plan/implemented/O-1-a-casca-do-observatorio.md) | Um canal novo, e ele não devolve `Result` |
| O-1 | [DO1.6](plan/implemented/O-1-a-casca-do-observatorio.md) | A normalização é pura, e mora em `core/observatory/` |
| O-1 | [DO1.7](plan/implemented/O-1-a-casca-do-observatorio.md) | Bytes em todo o contrato |
| O-1 | [DO1.8](plan/implemented/O-1-a-casca-do-observatorio.md) | `idleWakeupsPerSecond` não entra no contrato |
| O-1 | [DO1.9](plan/implemented/O-1-a-casca-do-observatorio.md) | O `Dialog` ganha variante de tamanho, e não um irmão |
| O-1 | [DO1.10](plan/implemented/O-1-a-casca-do-observatorio.md) | A sidebar do modal é derivada de um registro, nunca escrita à mão |
| O-1 | [DO1.11](plan/implemented/O-1-a-casca-do-observatorio.md) | Nada persiste, e isso é o corte |
| O-2 | [DO2.1](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | Um painel, três blocos — não três entradas na sidebar |
| O-2 | [DO2.2](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | Sem `refetchInterval`: reabrir é a atualização |
| O-2 | [DO2.3](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | Os contadores de IPC vivem em `core/`, a fiação em `registry.ts` |
| O-2 | [DO2.4](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | `lastError` é pegajoso: um sucesso depois não apaga a última falha |
| O-2 | [DO2.5](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | `job:list` devolve só os ids, sem inventar metadado |
| O-2 | [DO2.6](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | A fila do worker mede profundidade, não tempo por requisição |
| O-2 | [DO2.7](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | Nenhum payload entra no registro |
| O-2 | [DO2.8](plan/implemented/O-2-ipc-jobs-e-fila-do-worker.md) | Payload inválido (zod) não conta como falha do canal |
| O-3 | [DO3.1](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | Dois painéis, não um: os grupos da fundamentação já os separam |
| O-3 | [DO3.2](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | `dataset:engineInfo` toca o worker, e por isso herda o risco do O-2 |
| O-3 | [DO3.3](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | `database:info` não retorna `Result` |
| O-3 | [DO3.4](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | A lista de tabelas é derivada de `sqlite_master`, nunca escrita à mão |
| O-3 | [DO3.5](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | `currentVersion()` é reaproveitado, não duplicado |
| O-3 | [DO3.6](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | O motor DuckDB não ganha botão de manutenção neste plano |
| O-3 | [DO3.7](plan/implemented/O-3-os-dois-motores-se-descrevem.md) | Extensões filtradas a `loaded OR installed` |
| O-4 | [DO4.1](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | Um painel, "Capacidades", grupo `state` |
| O-4 | [DO4.2](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | O painel nasce sem query automática; um botão dispara a sondagem, e o resultado carrega a própria idade |
| O-4 | [DO4.3](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | Uma sondagem, três serviços, um timestamp só |
| O-4 | [DO4.4](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | O catálogo é o cru de `ai:models`, nunca `selectableModels` |
| O-4 | [DO4.5](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | O embedder é uma linha derivada, não um campo novo |
| O-4 | [DO4.6](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | Só `CapabilityChip.tsx` sobe para `shared/ui/`; `capabilities.ts` fica |
| O-4 | [DO4.7](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | `LoadedModels` migra inteiro, sob o mesmo botão; `CloudSecrets` fica |
| O-4 | [DO4.8](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | Nenhum canal novo |
| O-4 | [DO4.9](plan/implemented/O-4-capacidades-o-primeiro-painel-caro.md) | `CAPABILITY_META` ganha `audio`; `image` fica de fora, nomeado |
| O-5 | [DO5.1](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | Dois painéis, não um |
| O-5 | [DO5.2](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | `session.getCacheSize()` mede só `Cache/` |
| O-5 | [DO5.3](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | O walk de disco reaproveita `getCacheSize()` para a entrada `Cache/`, **se o Passo 0 confirmar que os números batem** |
| O-5 | [DO5.4](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | Classificação por allowlist pequena; o bucket do Chromium é **um número**, não uma lista |
| O-5 | [DO5.5](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | Erro de leitura numa subpasta não aborta o job inteiro |
| O-5 | [DO5.6](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | Dois domínios de canal novos: `session` e `disk` |
| O-5 | [DO5.7](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | `formatAge` sobe para `shared/format.ts` |
| O-5 | [DO5.8](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | Correção registrada da própria classificação do inventário |
| O-5 | [DO5.9](plan/implemented/O-5-uso-de-disco-e-cache-do-chromium.md) | Os dois painéis Caro/Acessível vivem no cache do `QueryClient`, nunca só em `useState` |
| O-6 | [DO6.1](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Reaproveita `ipcStats.wrap`; nenhum segundo hook |
| O-6 | [DO6.2](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | `core/` mede, `main/` grava; o sink é estado mutável do store, não argumento de construtor |
| O-6 | [DO6.3](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Um id de domínio por evento, nunca um `observationId` novo |
| O-6 | [DO6.4](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Retenção: intervalo fechado no schema Zod, sem "nunca apagar" |
| O-6 | [DO6.5](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | A varredura de retenção espelha `collectOrphanedAttachments`, sem inventar mecanismo novo |
| O-6 | [DO6.6](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | O painel entra no grupo `activity`, primeira ocupação real do grupo |
| O-6 | [DO6.7](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Transparência sobre retenção em dois lugares, textos curtos e fixos |
| O-6 | [DO6.8](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Um canal novo só: `events:list`, sem `Result`; nenhum canal para escrever |
| O-6 | [DO6.9](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Duas correções da revisão do advisor, achadas antes do teste ao vivo |
| O-6 | [DO6.10](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | O sink também enxerga `Result.ok:false`, não só exceção — achado no teste ao vivo |
| O-6 | [DO6.11](plan/implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) | Canais IPC (O-2) também passa a contar `Result.ok:false` — pedido do usuário, mesma sessão |
| O-7 | [DO7.1](plan/implemented/O-7-desempenho-por-modelo.md) | Três marcas de tempo por wall-clock, não os campos nativos como métrica primária |
| O-7 | [DO7.2](plan/implemented/O-7-desempenho-por-modelo.md) | Campos nativos do Ollama entram como colunas extras, não como segunda métrica de decode |
| O-7 | [DO7.3](plan/implemented/O-7-desempenho-por-modelo.md) | Tabela própria, não uma coluna a mais em `events` (O-6) |
| O-7 | [DO7.4](plan/implemented/O-7-desempenho-por-modelo.md) | Só registra quando `evalTokens` chega, nunca fabrica linha parcial |
| O-7 | [DO7.5](plan/implemented/O-7-desempenho-por-modelo.md) | `performance:list` devolve o resumo já agregado; a linha crua nunca sai do main |
| O-7 | [DO7.6](plan/implemented/O-7-desempenho-por-modelo.md) | Retenção reaproveita `eventRetentionDays`, com o texto de Configurações ampliado |
| O-7 | [DO7.7](plan/implemented/O-7-desempenho-por-modelo.md) | `performance:list` entra na mesma exclusão do sink que `events:list` |
| O-7 | [DO7.8](plan/implemented/O-7-desempenho-por-modelo.md) | Resposta curta demais não produz taxa: piso de 5 tokens, decidido com dado real, não com correção matemática |
| O-7 | [DO7.9](plan/implemented/O-7-desempenho-por-modelo.md) | A decomposição em três vira quatro números: rede+prefill, decode, tokens/s de entrada e de saída |
| O-8 | [DO8.1](plan/implemented/O-8-livro-razao-de-privacidade.md) | O tipo do anexo é o proxy do nível de exposição, decisão herdada do § 9.3 |
| O-8 | [DO8.2](plan/implemented/O-8-livro-razao-de-privacidade.md) | Só chamada de nuvem grava linha; local não produz nada |
| O-8 | [DO8.3](plan/implemented/O-8-livro-razao-de-privacidade.md) | Grava no envio da requisição, não na resolução da resposta |
| O-8 | [DO8.4](plan/implemented/O-8-livro-razao-de-privacidade.md) | Contagem por tipo, nunca o hash do anexo |
| O-8 | [DO8.5](plan/implemented/O-8-livro-razao-de-privacidade.md) | Toda chamada de nuvem grava, mesmo sem anexo — contagem zero é dado, não lacuna |
| O-8 | [DO8.6](plan/implemented/O-8-livro-razao-de-privacidade.md) | Tabela própria (`privacy_events`), mesmo arquivo, retenção herdada de `eventRetentionDays` |
| O-8 | [DO8.7](plan/implemented/O-8-livro-razao-de-privacidade.md) | `privacy:list` devolve linhas cruas, não um resumo agregado |
| O-8 | [DO8.8](plan/implemented/O-8-livro-razao-de-privacidade.md) | `LIMIT 200` não sustenta a DO8.5 sozinho; o canal devolve linhas + contadores da janela inteira |
| O-8 | [DO8.9](plan/implemented/O-8-livro-razao-de-privacidade.md) | `ai:propose` também é chamada de nuvem, e também grava |

---

## Arco 21 — raciocínio visível

| trilha | sigla | descrição |
|---|---|---|
| 21-A | [D21A.1](plan/implemented/21-A-o-raciocinio-atravessa.md) | A presença de `onThinking` é o sinal, não um booleano paralelo |
| 21-A | [D21A.2](plan/implemented/21-A-o-raciocinio-atravessa.md) | `JobEvent` ganha uma variante, `job:event` não muda de forma |
| 21-A | [D21A.3](plan/implemented/21-A-o-raciocinio-atravessa.md) | Raciocínio é `MessagePart`, não coluna — e não é reenviado ao provedor |
| 21-A | [D21A.4](plan/implemented/21-A-o-raciocinio-atravessa.md) | O nome errado é o que já existe, não o que vai nascer |
| 21-A | [D21A.5](plan/implemented/21-A-o-raciocinio-atravessa.md) | O toggle destrava, não nasce |
| 21-A | [D21A.6](plan/implemented/21-A-o-raciocinio-atravessa.md) | Gemini precisa do filtro antes de ligar `includeThoughts` |
| 21-A | [D21A.7](plan/implemented/21-A-o-raciocinio-atravessa.md) | `ai:propose` fica de fora |
| 21-A | [D21A.8](plan/implemented/21-A-o-raciocinio-atravessa.md) | Exibição em tela é mínima nesta sessão |
| 21-A | [D21A.9](plan/implemented/21-A-o-raciocinio-atravessa.md) | Default desligado, escolha do usuário por conversa |
| 21-A | [D21A.10](plan/implemented/21-A-o-raciocinio-atravessa.md) | Gemini degrada graciosamente: manda `includeThoughts`, mas hoje não recebe nada de volta |
| 21-B | [D21B.1](plan/implemented/21-B-o-raciocinio-aparece-bem.md) | Rótulo de duas fases no `RespondingMark`, derivado do estado que já existe |
| 21-B | [D21B.2](plan/implemented/21-B-o-raciocinio-aparece-bem.md) | O monograma não escala com o container; precisa de um multiplicador próprio |
| 21-B | [D21B.3](plan/implemented/21-B-o-raciocinio-aparece-bem.md) | Disclosure com auto-open/auto-collapse por streaming, clique manual sempre vence |
| 21-B | [D21B.4](plan/implemented/21-B-o-raciocinio-aparece-bem.md) | `SERVICE_LABEL` consolidado numa fonte única, wording do `CapabilitiesPanel` |
| 21-B | [D21B.5](plan/implemented/21-B-o-raciocinio-aparece-bem.md) | Animação de altura via `calc-size(auto, size)`, sem opt-in global |
| 21-B | [D21B.6](plan/implemented/21-B-o-raciocinio-aparece-bem.md) | Achatamento de raciocínio sem `strip-markdown`, sem `remark-stringify` — lição do DE1E.9 reaplicada |
| 21-C-A | [D21C.1](plan/implemented/21-C-A-orcamento-de-geracao.md) | `REASONING_OUTPUT_RESERVE_RATIO` (35%) reserva espaço de geração no `budgetFor`, ponto de partida a calibrar ao vivo |
| 21-C-A | [D21C.2](plan/implemented/21-C-A-orcamento-de-geracao.md) | A reserva só se aplica quando `costed && reasoningActive` — nunca contra um `num_ctx` client-side de nuvem |
| 21-C-A | [D21C.3](plan/implemented/21-C-A-orcamento-de-geracao.md) | Média móvel exponencial avança uma vez por turno assentado, não por render |
| 21-C-B | [D21C.4](plan/implemented/21-C-B-motivo-de-parada.md) | `messageStoppedSchema` ganha `'context-exhausted'`, motivo de parada de uma resposta bem-sucedida, não de uma chamada interrompida |
| 21-C-B | [D21C.5](plan/implemented/21-C-B-motivo-de-parada.md) | Os três adaptadores passam a ler o campo de parada do provedor (`done_reason`/`finish_reason`/`finishReason`) — sondagem ao vivo confirmou `'length'` antes do desenho |
| 21-C-C | [D21C.6](plan/implemented/21-C-C-faixas-fixas-de-contexto.md) | `CONTEXT_BANDS` fixas (4k–256k), `MIN_NUM_CTX` mantido em 1024 |
| 21-C-C | [D21C.7](plan/implemented/21-C-C-faixas-fixas-de-contexto.md) | O teto do modelo sempre entra na lista de opções, mesmo fora das faixas |
| 21-C-C | [D21C.8](plan/implemented/21-C-C-faixas-fixas-de-contexto.md) | `SegmentedField` sobe para `shared/ui/` no segundo chamador fora de `settings/` |
| 21-C-C | [D21C.9](plan/implemented/21-C-C-faixas-fixas-de-contexto.md) | `Slider` sai do repositório — único chamador era `ContextSlider`, mesmo precedente do DS-8 |
| 21-C-C | [D21C.10](plan/implemented/21-C-C-faixas-fixas-de-contexto.md) | `exposesReasoning()` desliga o switch de raciocínio só para Gemini — `hasCapability` continua `true` |
| 21-C-C | [D21C.11](plan/implemented/21-C-C-faixas-fixas-de-contexto.md) | Migração para a Interactions API do Gemini documentada, não implementada — causa do D21A.10 fechada via Context7 |
| 21-C-A | [D21C.12](plan/implemented/21-C-A-orcamento-de-geracao.md) | `promptTokens`/`evalTokens` reais persistidos (migração `v5`), não descartados após calibrar — legenda visível em `MessageList.tsx` |
| 21-C-A | [D21C.13](plan/implemented/21-C-A-orcamento-de-geracao.md) | Ancoramento pós-fato: `budgetFor` estima só o delta desde a última medição real; `anchorFromHistory()` hidrata ao reabrir conversa; ignorado quando `removeMessage` encolhe a história abaixo do anchor |

---

## Arco 23 — documentação por Context7

| corte | sigla | descrição |
|---|---|---|
| 23-A | [D23A.1](plan/implemented/23-A-cliente-context7.md) | O cliente mora em `core/`, com o `fetch` injetado — não em `main/`, nem pelo SDK oficial |
| 23-A | [D23A.2](plan/implemented/23-A-cliente-context7.md) | `CONTEXT7_BASE_URL` é constante em `core/` como default sobrescrevível — exceção nomeada a DM-20 |
| 23-A | [D23A.3](plan/implemented/23-A-cliente-context7.md) | Estado de tela volta como união; falha de serviço lança `UpstreamError` — 400/404 nunca viram `AppError` |
| 23-A | [D23A.4](plan/implemented/23-A-cliente-context7.md) | Ordenação total com quatro chaves: o desempate por `id` não basta, porque `id` se repete |
| 23-A | [D23A.5](plan/implemented/23-A-cliente-context7.md) | Identidade sintética por resultado — `id` não serve de chave de React nem de seleção |
| 23-A | [D23A.6](plan/implemented/23-A-cliente-context7.md) | `stars: -1` vira `null`; `versions[]` filtra `__branch__*` e mantém a ordem crua |
| 23-A | [D23A.7](plan/implemented/23-A-cliente-context7.md) | `codeId` → URL por tentativa (`new URL` em `try`/`catch`), nunca por formato presumido |
| 23-A | [D23A.8](plan/implemented/23-A-cliente-context7.md) | `rules` é parseado e devolvido em campo próprio — o descarte é do 23-C, não do cliente |
| 23-A | [D23A.9](plan/implemented/23-A-cliente-context7.md) | Fixtures `.json` verbatim coladas ao módulo — a suíte nunca chama a API |
| 23-A | [D23A.10](plan/implemented/23-A-cliente-context7.md) | Timeout próprio composto com o signal do chamador via `AbortSignal.any` |
| 23-A | [D23A.11](plan/implemented/23-A-cliente-context7.md) | O texto do 429 sai do cliente, com data local do `Ratelimit-Reset` e ciente da chave |

| 23-B | [D23B.1](plan/implemented/23-B-a-fronteira.md) | `invoke` simples com `Result`, sem job — cancelar não devolve cota, e a medição ao vivo (2,2 s) manteve o veredito |
| 23-B | [D23B.2](plan/implemented/23-B-a-fronteira.md) | Domínio `docs` no canal, serviço `context7` no cofre — o canal nomeia a operação, o segredo nomeia o portador |
| 23-B | [D23B.3](plan/implemented/23-B-a-fronteira.md) | Tipos normalizados sobem para `shared/ipc.ts`; os de fio e o seam ficam em `core/` |
| 23-B | [D23B.4](plan/implemented/23-B-a-fronteira.md) | `'context7'` entra em `CLOUD_PROVIDERS` — quatro `Record` exaustivos, e duas seções deixam de dizer "nuvem" |
| 23-B | [D23B.5](plan/implemented/23-B-a-fronteira.md) | Mapeamento de erro próprio, não `mapProviderError`, que é keyed por `AiService` |
| 23-B | [D23B.6](plan/implemented/23-B-a-fronteira.md) | `query` com `min(1)`: campo vazio é bug, não estado de tela |
| 23-B | [D23B.7](plan/implemented/23-B-a-fronteira.md) | A chave é lida fresca a cada chamada, molde do `makeGlmChat` |
| 23-B | [D23B.8](plan/implemented/23-B-a-fronteira.md) | O teste de nível 3 prova o embrulho, nunca o parse |
| 23-B | [D23B.9](plan/implemented/23-B-a-fronteira.md) | O teto do preload estoura conscientemente, com gatilho antes do 23-C |
| 23-B | [D23B.10](plan/implemented/23-B-a-fronteira.md) | Memo de sessão no handler — só `found`/`ready` entram; `indexing` e falha nunca |
| 23-B | [D23B.11](plan/implemented/23-B-a-fronteira.md) | `DocSnippet` carrega `blocks[]`, não um `code` grudado — o `codeList` são variantes do mesmo exemplo |
| 23-C | [D23C.1](plan/implemented/23-C-a-parte-e-a-persistencia.md) | `DocsPart` é a sétima variante, fora de `AttachmentPart` — e o filtro por negação de `attachmentPartOf` a adotava calado |
| 23-C | [D23C.2](plan/implemented/23-C-a-parte-e-a-persistencia.md) | A parte carrega `id` cunhado no renderer; o desligar endereça por ele, nunca por índice de array |
| 23-C | [D23C.3](plan/implemented/23-C-a-parte-e-a-persistencia.md) | O recusado persiste só como título e custo — o congelamento vira estrutura, e resolve a contradição do `painel.md` |
| 23-C | [D23C.4](plan/implemented/23-C-a-parte-e-a-persistencia.md) | `rules` persiste e nunca se materializa; sem persistir, o registro da injeção sumiria ao reabrir o app |
| 23-C | [D23C.5](plan/implemented/23-C-a-parte-e-a-persistencia.md) | Os quatro tipos do fio viram schema zod, porque agora atravessam `conversation:append` |
| 23-C | [D23C.6](plan/implemented/23-C-a-parte-e-a-persistencia.md) | `conversation:setDocsEnabled`, não `docs:toggle` — a operação é editar a transcrição |
| 23-C | [D23C.7](plan/implemented/23-C-a-parte-e-a-persistencia.md) | `json_set` numa statement; a guarda `EXISTS` foi escrita e **removida** por não mudar nada observável |
| 23-C | [D23C.8](plan/implemented/23-C-a-parte-e-a-persistencia.md) | O preload se divide por papel (mecânica · tabela · composição), não por domínio |
| 23-C | [D23C.9](plan/implemented/23-C-a-parte-e-a-persistencia.md) | O livro-razão de privacidade não conta a consulta neste corte — vai para o `O-9`, painel próprio do Observatório, junto da pergunta enviada ao Context7 (saiu do arco 23 em 12/09/2026) |
| 23-D | [D23D.1](plan/implemented/23-D-o-painel-nasce.md) | `PanelKind` ganha `'docs'`, sem tecla de atalho — `b` e `d` já estão tomadas e o desenho não pede uma terceira |
| 23-D | [D23D.2](plan/implemented/23-D-o-painel-nasce.md) | A composição mora no provider, carimbada com a conversa: fechar preserva o texto, navegar descarta |
| 23-D | [D23D.3](plan/implemented/23-D-o-painel-nasce.md) | `Documentação` nunca trava por anexo pendente; os três de arquivo travam — consulta não disputa o slot do composer |
| 23-D | [D23D.4](plan/implemented/23-D-o-painel-nasce.md) | O corpo do popover vira `AttachMenu.tsx` — coesão, não teto |
| 23-D | [D23D.5](plan/implemented/23-D-o-painel-nasce.md) | A linha `mcp` com `Switch` desabilitado deixa de existir (DM-29) |
| 23-D | [D23D.6](plan/implemented/23-D-o-painel-nasce.md) | `Consultar` nasce ligado, com render provisório que o 23-E substitui |
| 23-D | [D23D.7](plan/implemented/23-D-o-painel-nasce.md) | O estado da busca é `useAsyncAction<SearchOutcome>`, não TanStack Query |
| 23-D | [D23D.8](plan/implemented/23-D-o-painel-nasce.md) | Um ícone para o assunto inteiro (`Library`), em módulo próprio |
| 23-D | [D23D.9](plan/implemented/23-D-o-painel-nasce.md) | O cabeçalho não tem `histórico` nem `+` — os dois pressupõem consulta anexada (23-G) |
| 23-D | [D23D.10](plan/implemented/23-D-o-painel-nasce.md) | O aviso de privacidade é permanente sob o campo, nunca consentimento de uma vez |
| 23-E | [D23E.1](plan/implemented/23-E-a-desambiguacao.md) | Corte 100% renderer — `docs:fetch` já aceitava `version?` desde o 23-B |
| 23-E | [D23E.2](plan/implemented/23-E-a-desambiguacao.md) | Qual tela aparece é derivado do resultado da busca, nunca um terceiro valor a sincronizar |
| 23-E | [D23E.3](plan/implemented/23-E-a-desambiguacao.md) | A busca sobe para o provider — mas não pela razão escrita no plano: `DocsPanel` retorna `null` e nunca desmonta |
| 23-E | [D23E.4](plan/implemented/23-E-a-desambiguacao.md) | A seleção endereça `key`, jamais `id`, que se repete dentro de uma resposta |
| 23-E | [D23E.5](plan/implemented/23-E-a-desambiguacao.md) | Rádios nativos: o Chromium já implementa o padrão Radio Group do APG inteiro |
| 23-E | [D23E.6](plan/implemented/23-E-a-desambiguacao.md) | O primeiro nasce marcado — conveniência de teclado, e **não** o melhor palpite (contrariado em `pandas`) |
| 23-E | [D23E.7](plan/implemented/23-E-a-desambiguacao.md) | `<select>` nativo para versão, divergindo de DS-4 passo 7: `color-scheme` já dá o tema, e a opção é uma string |
| 23-E | [D23E.8](plan/implemented/23-E-a-desambiguacao.md) | Trocar de candidato zera versão e resultado — ambos pertencem à biblioteca sob a qual foram escolhidos |
| 23-E | [D23E.9](plan/implemented/23-E-a-desambiguacao.md) | Sem versão indexada o seletor fica ausente, não desabilitado — é o caso comum, não a borda |
| 23-E | [D23E.10](plan/implemented/23-E-a-desambiguacao.md) | O `Consultar` da tela 2 nasce ligado, com render provisório — molde de D23D.6 |
| 23-E | [D23E.11](plan/implemented/23-E-a-desambiguacao.md) | O cabeçalho não muda: `/lib · versão` pressupõe consulta resolvida (23-F) |
| 23-F | [D23F.1](plan/implemented/23-F-o-resultado.md) | Corte 100% renderer — `docs:fetch` já devolvia o `DocsResult` inteiro desde o 23-B |
| 23-F | [D23F.2](plan/implemented/23-F-o-resultado.md) | A terceira tela é derivada do resultado da consulta, como a segunda era do da busca |
| 23-F | [D23F.3](plan/implemented/23-F-o-resultado.md) | `Voltar` da tela 3 vai à tela 2, nunca ao formulário — o caminho de volta é a lista |
| 23-F | [D23F.4](plan/implemented/23-F-o-resultado.md) | O cabeçalho nomeia a biblioteca e a versão só quando há resposta sob o nome |
| 23-F | [D23F.5](plan/implemented/23-F-o-resultado.md) | Sem `Consultar de novo` neste corte: o memo devolveria a mesma resposta, e o botão seria no-op |
| 23-F | [D23F.6](plan/implemented/23-F-o-resultado.md) | O rodapé diz o total exato e não tem `Anexar` — a seleção é do 23-G |
| 23-F | [D23F.7](plan/implemented/23-F-o-resultado.md) | A aba Regras aparece quando há **regra**, não quando o campo existe — `rules` pode vir com três listas vazias |
| 23-F | [D23F.8](plan/implemented/23-F-o-resultado.md) | A aba Regras distingue a procedência das três listas: só `libraryOwn` vem do repositório |
| 23-F | [D23F.9](plan/implemented/23-F-o-resultado.md) | Cada trecho é um retrátil, com o primeiro já aberto |
| 23-F | [D23F.10](plan/implemented/23-F-o-resultado.md) | `↗` ausente, não desabilitado, quando o `codeId` não parseia como URL |
| 23-F | [D23F.11](plan/implemented/23-F-o-resultado.md) | Blocos idênticos dentro do mesmo trecho aparecem uma vez — `codeList[]` são variantes, não partes |
| 23-F | [D23F.12](plan/implemented/23-F-o-resultado.md) | O destaque de sintaxe reusa o `tokenize` de `features/draft`; promover a primitivo espera o terceiro chamador |
| 23-F | [D23F.13](plan/implemented/23-F-o-resultado.md) | Densidade: metadado em chrome, código e prosa em leitura — e a descrição, que a tabela não previa, é markdown |
| 23-G | [D23G.1](plan/implemented/23-G-selecao-e-orcamento.md) | O `Composer` continua dono único do `budgetFor` e devolve o `Budget` pronto ao painel — dois seriam livres para divergir |
| 23-G | [D23G.2](plan/implemented/23-G-selecao-e-orcamento.md) | Token de Context7 entra pelo `flatTokens`, nunca por caractere: converter jogaria fora a única medida exata do app |
| 23-G | [D23G.3](plan/implemented/23-G-selecao-e-orcamento.md) | A seleção guarda o conjunto do que está **de fora**, não do que está dentro — vazio significa "tudo vai" |
| 23-G | [D23G.4](plan/implemented/23-G-selecao-e-orcamento.md) | Notas têm caixa de marcação, como os trechos |
| 23-G | [D23G.5](plan/implemented/23-G-selecao-e-orcamento.md) | Sem "marcar todos": o caso medido é de 5 trechos, e o estado misto do APG exige `indeterminate` por `ref` |
| 23-G | [D23G.6](plan/implemented/23-G-selecao-e-orcamento.md) | `Anexar` desabilita por dois motivos, e o rodapé ao lado nomeia qual deles |
| 23-G | [D23G.7](plan/implemented/23-G-selecao-e-orcamento.md) | `Anexar` congela **um** pendente por vez, carimbado pela conversa |
| 23-G | [D23G.8](plan/implemented/23-G-selecao-e-orcamento.md) | O envio limpa tudo e o painel volta ao Estado 1 — a via de volta a uma consulta enviada é o histórico |
| 23-G | [D23G.9](plan/implemented/23-G-selecao-e-orcamento.md) | Divergência deliberada: nenhum sinal fora do painel neste corte, e o buraco é nomeado em vez de disfarçado |
| 23-G | [D23G.10](plan/implemented/23-G-selecao-e-orcamento.md) | O montador da parte é função pura em `core/`, com o `id` cunhado no renderer |
| 23-H | [D23H.1](plan/implemented/23-H-a-conversa.md) | O desligar mora nos **dois** lugares (linha e histórico), com um dono só: nenhum dos dois guarda estado |
| 23-H | [D23H.2](plan/implemented/23-H-a-conversa.md) | `DocsLine` mora em `features/docs/`, não em `conversation/` — o assunto é a consulta |
| 23-H | [D23H.3](plan/implemented/23-H-a-conversa.md) | Três irmãos num contêiner flex, nunca botão dentro de botão: o React não avisa e o HTML é inválido |
| 23-H | [D23H.4](plan/implemented/23-H-a-conversa.md) | O contador usa `aria-pressed` como os dois irmãos, **contra** o que a APG recomenda — três consistentes valem mais que um certo sozinho |
| 23-H | [D23H.5](plan/implemented/23-H-a-conversa.md) | A releitura é componente próprio, não um modo do `DocsResult`, que carrega seleção, congelamento e veredito |
| 23-H | [D23H.6](plan/implemented/23-H-a-conversa.md) | O omitido aparece como título e custo, nunca como código — a parte nunca guardou o código do recusado |
| 23-H | [D23H.7](plan/implemented/23-H-a-conversa.md) | Invalidação simples, sem escrita otimista: o `onMutate` fica registrado como conserto se o piscar aparecer |
| 23-H | [D23H.8](plan/implemented/23-H-a-conversa.md) | Os dois totais na tela medem coisas diferentes de propósito — tokens exatos contra chars estimados, unidos pelo mesmo conjunto |
| 23-H | [D23H.9](plan/implemented/23-H-a-conversa.md) | Acrescentada em execução: na releitura, o omitido ganha aba própria, presente só quando existe |
| 23-I | [D23I.1](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | O mapeamento de falha é função pura no renderer e **não** entra em `messages.ts`, dono da tradução de `AppError['kind']` |
| 23-I | [D23I.2](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | O `StateView` não ganha *slot* de erro: o painel trata o ramo antes de chamá-lo, pela régua do envelope |
| 23-I | [D23I.3](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | 401/403 ganham texto próprio no renderer; só o 429 passa intacto, porque o cliente já compõe a data real |
| 23-I | [D23I.4](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | As situações 5 e 7 não abrem Configurações: **nomeiam** — `Settings` é autocontido em duas instâncias do `App.tsx` |
| 23-I | [D23I.5](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | O portão da chave fica no `Consultar`, e o item `Documentação` do menu `+` continua nunca travando |
| 23-I | [D23I.6](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | A cota e o estado da chave só existem na tela 1 — administração não segue a pessoa pelo processo |
| 23-I | [D23I.7](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | Sem número é `sem consulta nesta sessão`, nunca zero: não existe endpoint de cota, só o header da última resposta |
| 23-I | [D23I.8](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | O número exibido é sempre o do header, nunca a constante documentada |
| 23-I | [D23I.9](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | A cota viaja por um *seam* injetado (`onQuota`), chamado **antes** de qualquer checagem de status — o 429 lança |
| 23-I | [D23I.10](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | `docs:quota` não devolve `Result`, pela régua de `dataset:queueDepth` |
| 23-I | [D23I.11](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | `Ver de novo` e `Consultar de novo` são dois botões, e a diferença é uma palavra no payload |
| 23-I | [D23I.12](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | O `202` **não se caça**: custa cota sem garantia de achar, e o que o app precisava dela era o texto |
| 23-I | [D23I.13](plan/implemented/23-I-os-erros-a-chave-e-a-cota.md) | A soma dos dois regimes de cota, se existir um dia, nunca é automática — recuo anunciado ou nada |
| 23-J | [D23J.1](plan/implemented/23-J-as-minucias.md) | O `+` do cabeçalho do painel **não existe**, e o veredito é o entregável — zero linha de código |
| 23-J | [D23J.2](plan/implemented/23-J-as-minucias.md) | `MarkdownMessage` ganha `inline`, com a exceção à régua do envelope escrita: `.inline` não declara `font-size` |
| 23-J | [D23J.3](plan/implemented/23-J-as-minucias.md) | A amplitude se chama `broad` no app e `fast` só no fio — o vocabulário do vendor é invertido |
| 23-J | [D23J.4](plan/implemented/23-J-as-minucias.md) | A chave do memo passa a incluir a amplitude: sem ela, o caminho amplo devolve a resposta estreita já paga |
| 23-J | [D23J.5](plan/implemented/23-J-as-minucias.md) | `broad` mora na composição e volta a `false` quando ela zera — "desligada por padrão" é por consulta, não por sessão |
| 23-J | [D23J.6](plan/implemented/23-J-as-minucias.md) | A caixa fica em linha própria sob o campo Pergunta, e não no `DocsAdmin`: altera a requisição, não descreve a conta |
| 23-J | [D23J.7](plan/implemented/23-J-as-minucias.md) | `<input type="checkbox">`, nunca `Switch`: só age quando `Consultar` é apertado |
| 23-J | [D23J.8](plan/implemented/23-J-as-minucias.md) | `marcar todos`/`desmarcar todos` reabrem D23G.5 só onde a premissa dela caiu — 5 trechos viraram 25 |
| 23-J | [D23J.9](plan/implemented/23-J-as-minucias.md) | A parte persistida não registra a amplitude: a contagem de trechos já é o registro |
| 23-J | [D23J.10](plan/implemented/23-J-as-minucias.md) | Os três `aria-expanded` ficam adiados, e o adiamento se escreve no registro que os prometeu |
| 23-J | [D23J.11](plan/implemented/23-J-as-minucias.md) | A linha na transcrição conta os descartados em vez de listá-los — 18 riscados enterravam os 7 enviados |

---

## Trilha R — reconciliação de documentação

| trilha | sigla | descrição |
|---|---|---|
| R-1 | [R-1](plan/implemented/R-1-comentarios-e-tsdoc.md) | a convenção de comentário aplicada a todo o código de produção |
| R-2 | [R-2](plan/implemented/R-2-documentacao-tecnica-e-historica.md) | documentação técnica e histórica sincronizada, `HISTORY.md` comprimido e arquivado |
| R-3 | [R-3](plan/implemented/R-3-sincronizacao-de-docs-e-skill-de-dados.md) | sincronização de docs pós-18/N-1 e nascimento da skill `data` |
| R-4 | [R-4](plan/implemented/R-4-reconciliacao-das-skills-tecnicas.md) | reconciliação factual das cinco skills técnicas |
| R-5 | [R-5](plan/implemented/R-5-indice-de-decisoes.md) | índice tabular das decisões dentro de cada plano, `DECISOES.md` |
| R-6 | [R-6](plan/implemented/R-6-nascimento-da-skill-ai.md) | nascimento da skill `ai`, alívio dirigido de `docs/`/`CLAUDE.md`, achado real reverte hipótese sobre `reference/reasoning/` (R6.5) |

---

## Trilha R-7 — refatoração documental

| trilha | sigla | descrição |
|---|---|---|
| R-7 | [R7.1](plan/implemented/R-7-refatoracao-documental.md) | o corte do `ARMADILHAS.md` é avaliado e **abortado**, com o número que justifica — teto vai a 150 kB |
| R-7 | [R7.2](plan/implemented/R-7-refatoracao-documental.md) | uma pasta por referência (`<slug>/README.md`), com slug fiel ao nome citado |
| R-7 | [R7.3](plan/implemented/R-7-refatoracao-documental.md) | a decisão do R-2 de *marcar em vez de mover* os consumidos é revista por fato novo, não por preferência |
| R-7 | [R7.4](plan/implemented/R-7-refatoracao-documental.md) | em registro histórico, o **alvo** do link se conserta; o **texto** do link, não |
| R-7 | [R7.5](plan/implemented/R-7-refatoracao-documental.md) | o `HISTORY-archive.md` recebe, mas não se reescreve — acrescentar à fila não é editar o que já está lá |
| R-7 | [R7.6](plan/implemented/R-7-refatoracao-documental.md) | as 17 decisões do `HISTORY.md` descem para o **fim** de uma seção que já existia com esse nome |
| R-7 | [R7.7](plan/implemented/R-7-refatoracao-documental.md) | o teto de 25 kB do `CLAUDE.md` era inalcançável; o novo é **35** |
| R-7 | [R7.8](plan/implemented/R-7-refatoracao-documental.md) | ao acrescentar ao archive, a **seção** é escolhida — append cego escreve no fim do arquivo, não da seção |
| R-7 | [R7.9](plan/implemented/R-7-refatoracao-documental.md) | decisão que já tem sigla não ganha outra; a narrativa desce e o índice fica onde está |
| R-7 | [R7.10](plan/implemented/R-7-refatoracao-documental.md) | trilha concluída comprime; trilha planejada **sem arquivo** não — a célula é o único dono do desenho |
| R-7 | [R7.11](plan/implemented/R-7-refatoracao-documental.md) | gatilho cumprido sai do `ROADMAP.md`, que é dono do que **falta** |
| R-7 | [R7.12](plan/implemented/R-7-refatoracao-documental.md) | número que se remede vira série, não parágrafo — a regra existia e o documento vizinho a violava |
| R-7 | [R7.13](plan/implemented/R-7-refatoracao-documental.md) | mover um arquivo conserta os links **para** ele e quebra os **de dentro** dele |
| R-7 | [R7.14](plan/implemented/R-7-refatoracao-documental.md) | ponteiro por seção (`§ Nome`) apodrece sem sinal; **cite a sigla**, que não se move |
| R-7 | [R7.15](plan/implemented/R-7-refatoracao-documental.md) | verificação mora em script versionado, não em one-liner dentro do `.md` |
| R-7 | [R7.16](plan/implemented/R-7-refatoracao-documental.md) | no `CLAUDE.md` sai seção inteira que muda de dono, não frase comprimida — a tabela viaja junto |
| R-7 | [R7.17](plan/implemented/R-7-refatoracao-documental.md) | numa skill sai a **proveniência**; o fato e o aviso ficam — régua oposta à do `ESCOPO.md` |

---

## Revisão de escopo (5ª)

| trilha | sigla | descrição |
|---|---|---|
| — | [revisão 5ª](plan/implemented/revisao-escopo-nivel-3-nuvem.md) | nível 3 liberado na nuvem — supersede DN1B.6, a recusa que este plano remove |

---

## Revisão de escopo (6ª)

| trilha | sigla | descrição |
|---|---|---|
| — | RE6.1 | a identidade se reescreve, não se emenda — a frase de abertura deixa de ser "bancada de dados" |
| — | RE6.2 | a administração do modelo vira seção de produto, com princípio próprio |
| — | RE6.3 | o teste de escopo ganha a segunda categoria, **instrumentação** — legitima a trilha O |
| — | RE6.4 | raciocínio (e possivelmente busca web) **não** chega por *tool calling* — três caminhos registrados, escolha é do plano |
| — | RE6.5 | projeto entra como escopo definido e não construído, desacoplado de RAG e ML |
| — | RE6.6 | o diagrama de ordem de construção é apagado, não atualizado |
| — | RE6.7 | número datado em `ARMADILHAS.md`/`HISTORY-archive.md` não se corrige — é evidência da decisão da época |
| — | RE6.8 | a revisão não abre plano de código — F-6, arco 22 e o agrupador de projeto seguem onde estão |
| — | RE6.9 | o `ESCOPO.md` é atemporal e sem narrativa; a régua é aceite, verificada por grep |

| N-3-A | [DN3A.1](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | A guarda de raciocínio vai aos **três** adaptadores, não só ao `ollama.ts` que a sondagem mediu |
| N-3-A | [DN3A.2](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | O portão do renderer entra mesmo sendo segunda linha de defesa — é ele que torna o estado **persistido** inexpressável |
| N-3-A | [DN3A.3](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | O predicado de nuvem cobre as duas grafias (`-cloud` e `:cloud`) — errata de `DNC-9`, achada por busca web |
| N-3-A | [DN3A.4](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | O descarte acontece em `ollamaModels`, antes do `/api/show`, nunca em `selectableModels` |
| N-3-A | [DN3A.5](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | `offeredCeiling`/`costsLocalRam` nascem em `core/ai/memory.ts` — e eram **duas** cópias do ternário, não uma |
| N-3-A | [DN3A.6](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | `AiModelAttention` ganha dois campos descritivos; toda a aritmética híbrida fica com um dono só |
| N-3-A | [DN3A.7](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | O divisor de cabeças é 4 por `config.json` publicado, não por confundimento — e não é constante de família |
| N-3-A | [DN3A.8](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | `OVERHEAD` passa a depender da arquitetura: 1,06 pura, 1,2 híbrida |
| N-3-A | [DN3A.9](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | A regra de admissão exige o intervalo, e é isso que mantém o embedder fora do custeio |
| N-3-A | [DN3A.10](plan/implemented/N-3-A-a-trava-antes-da-porta.md) | Errata: a tabela de verificação do recorte cita `até 32k` e `qwen3:4b`, os dois mortos |
| N-3-B | [DN3B.1](plan/implemented/N-3-B-o-popover-em-uma-linha.md) | A linha vira `flex-row`, e **qual** alinhamento sai daí é escolha do olho: as duas formas foram construídas e olhadas |
| N-3-B | [DN3B.2](plan/implemented/N-3-B-o-popover-em-uma-linha.md) | O `title` da linha de nuvem tem um dono por estado — a dica de chave vence o limite, por ser a única acionável |
| N-3-B | [DN3B.3](plan/implemented/N-3-B-o-popover-em-uma-linha.md) | O limite de faixa gratuita sai da linha **inteiro**, qualquer que seja o `kind` — revertida contra a tela |
| N-3-B | [DN3B.4](plan/implemented/N-3-B-o-popover-em-uma-linha.md) | `até <n>k` nos dois grupos, e `não cabe` sozinho: o teto só aparece quando há teto útil |
| N-3-B | [DN3B.5](plan/implemented/N-3-B-o-popover-em-uma-linha.md) | Um destaque só, em união discriminada — "duas linhas destacadas" vira estado inexpressável |
| N-3-B | [DN3B.6](plan/implemented/N-3-B-o-popover-em-uma-linha.md) | `560px` é ponto de partida, e o juiz é a janela estreita; `max-w` porque jsdom não reprova transbordo |
| N-3-C | [DN3C.1](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | `'ollama-cloud'` entra em `aiServiceSchema` **e** em `CLOUD_PROVIDERS` — primeiro valor nos dois conjuntos |
| N-3-C | [DN3C.2](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | `resolveProvider` vira mapa exaustivo: o ramo padrão roteava serviço desconhecido para o daemon **local** |
| N-3-C | [DN3C.3](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | O adaptador é `ollama.ts` parametrizado por alvo — e o filtro `-cloud` **não** viaja com a parametrização |
| N-3-C | [DN3C.4](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | Lista fixa de um modelo, aplicada **antes** do `/api/show`: 1+1 requisições, não 1+20 |
| N-3-C | [DN3C.5](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | `attention` e `sizeBytes` forçados; `contextLength` e `capabilities` herdados — o ganho da sonda |
| N-3-C | [DN3C.6](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | Disponibilidade por `hasKey()` **apesar** de o ping funcionar, e o comentário existe para impedir o 'conserto' |
| N-3-C | [DN3C.7](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | A sonda só acontece com chave guardada — sem chave não há linha, contra a convenção de GLM/Gemini |
| N-3-C | [DN3C.8](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | `loaded` devolve lista vazia e `unload` é no-op: `/api/ps` responde 401, resposta verdadeira |
| N-3-C | [DN3C.9](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | `ai:propose` recusa **todo** serviço de nuvem — limite do app que a nuvem só tornou visível |
| N-3-C | [DN3C.10](plan/implemented/N-3-C-o-servico-e-o-catalogo-sondado.md) | `think` continua booleano neste corte: `gemma4:31b` o respeita, e `ThinkValue` é do `N-3-D` |
| N-3-D | [DN3D.1](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | `ThinkLevel` sobe ao `ChatFn`, e quem o preenche é o handler — o `N-3-E` troca só quem decide o valor |
| N-3-D | [DN3D.2](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | Quem exige nível é reconhecido pelo **nome de família**: `capabilities` reporta `thinking`, nunca 'exige nível' |
| N-3-D | [DN3D.3](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | Com o interruptor desligado, o `gpt-oss` recebe `'low'` mesmo assim — não há off, e o padrão custa 7× |
| N-3-D | [DN3D.4](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | Entra `gpt-oss:120b`; o `20b` fica fora por HTTP 400 com `tools` e por ser dominado |
| N-3-D | [DN3D.5](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | `total_duration` vira coluna própria — refinar `Rede+Prefill` mudaria um número documentado sem aviso |
| N-3-D | [DN3D.6](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | A coluna do banco é degrau novo (`v5`), nunca edição do `v2`: linha antiga fica `NULL`, não zero |
| N-3-D | [DN3D.7](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | Quanto `'low'` reduz é medição do corte — e o roteiro que pedia delta de geração era inválido por construção |
| N-3-D | [DN3D.8](plan/implemented/N-3-D-o-segundo-modelo-e-o-nivel-de-raciocinio.md) | Escolher esforço vira `N-3-E` e o fechamento desce para `N-3-F`: três dos quatro serviços têm nível |
| N-3-E | [DN3E.1](plan/implemented/N-3-E-o-fechamento-da-trilha.md) | O piso do `gpt-oss` vai de `'low'` para `'medium'` — esforço compra qualidade de resposta, não só rastro |
| N-3-E | [DN3E.2](plan/implemented/N-3-E-o-fechamento-da-trilha.md) | A escolha de esforço sai da N-3 e vira escopo declarado da `N-2`; `DN3D.8` revogada por medição |
| N-3-E | [DN3E.3](plan/implemented/N-3-E-o-fechamento-da-trilha.md) | O levantamento de esforço ganha dono em `reference/reasoning/`, não em `models/` nem em `ollama-cloud/` |
| N-3-E | [DN3E.4](plan/implemented/N-3-E-o-fechamento-da-trilha.md) | `200` não prova que o modelo honra o nível: quem valida o `ThinkValue` é o servidor |
| N-3-E | [DN3E.5](plan/implemented/N-3-E-o-fechamento-da-trilha.md) | O destino triplo de `DNC-30` executado — skill `ai` (regra), `cloud-optin.md` (ficha viva), pasta consumida |
| N-3-E | [DN3E.6](plan/implemented/N-3-E-o-fechamento-da-trilha.md) | A renumeração é desfeita no que é estado atual e mantida no que é história |

---

## Plano ainda ativo

Este plano não fechou — as linhas abaixo podem mudar de id, ou desaparecer, até `active/09-camada-de-ia.md` mover para `implemented/`.

| trilha | sigla | descrição |
|---|---|---|
| 09 (ativo) | [D9.1](plan/active/09-camada-de-ia.md) | A chamada de LLM roda no main, não no `utilityProcess` |
| 09 (ativo) | [D9.2](plan/active/09-camada-de-ia.md) | Uma fronteira de rede, injetável, exatamente como o `embed_fn` |
| 09 (ativo) | [D9.3](plan/active/09-camada-de-ia.md) | Nuvem é opt-in, e o gate é o mesmo formato para os três |
| 09 (ativo) | [D9.4](plan/active/09-camada-de-ia.md) | NL→passo antes de RAG |
| 09 (ativo) | [D9.5](plan/active/09-camada-de-ia.md) | RAG entra quando existir corpus, e o corpus não são as linhas |
| 09 (ativo) | [D9.6](plan/active/09-camada-de-ia.md) | ML clássico entra por último, e provavelmente menor |

