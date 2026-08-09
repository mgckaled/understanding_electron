# Arte anterior — as skills do mill.tools

**Data:** 2026-08-09 · **Motivou:** a [virada de ago/2026](../HISTORY.md) reaproveitou várias ideias do mill.tools de forma dispersa, ao longo de uma sessão de planejamento. Este documento lê as skills dele de uma vez, com o arco 13–19 já desenhado, e separa o que converge, o que vale trazer e o que não vale — enquanto a comparação ainda está fresca.

> ⚠️ **Arte anterior, não fonte de regra.** Nada aqui vale para o data-lab por estar escrito aqui. Item adotado **sai deste documento e vira decisão no dono** — skill, [`ROADMAP`](../ROADMAP.md), [`HISTORY`](../HISTORY.md) ou o plano da vez. Este arquivo continua sendo o que era: notas de leitura de um projeto irmão, consultáveis quando a mesma pergunta voltar.

**O que foi lido** (`C:\rocketseat\projetos\python\yt-transcriber\.claude\skills\`):

| Arquivo | Linhas | Assunto |
|---|---|---|
| `architecture/SKILL.md` | 212 | camadas, régua de tamanho, decomposição, checklist de feature |
| `ml-rag/SKILL.md` | 428 | RAG, ML clássico, NLP, Observatório, modelos Ollama |
| `design-system/SKILL.md` | 247 | tokens, factories, quirks do Flet 0.85, help system |
| `design-system/events.md` | 192 | contrato de eventos, payloads por módulo, thread-safety |

---

## 1. A forma, antes do conteúdo

Três decisões sobre **como as skills são construídas**, independentes do que elas dizem.

**A skill orquestradora delega em vez de duplicar.** A `architecture` abre declarando-se orquestrador estrutural e fecha com *"sempre que um detalhe pertencer a uma delas, delegue — não duplique aqui"*. E o ponteiro está na **frontmatter**, não só no corpo: cada `description` termina listando as irmãs. Isso importa porque a frontmatter é o que decide **qual** skill abrir — um ponteiro ali vale mais que um no corpo, que só é lido depois da decisão já tomada. As três skills do data-lab não se citam na frontmatter.

**Skill com arquivo complementar.** `design-system/` é `SKILL.md` (tokens, factories, quirks) + `events.md` (contrato de eventos), com a instrução de abrir o segundo só ao emitir ou consumir evento. É divulgação progressiva *dentro* de uma skill. Relevante porque a `design-system` do data-lab vai crescer no arco: `Dialog`, `Select`, `Disclosure`, as duas densidades, a paleta categórica do gráfico.

**Exceção de camada registrada com data, motivo e limite.** O import `gui/ → cli/reference.py` está documentado com o plano que o criou, por que não há alternativa (a introspecção dos parsers não pode ser duplicada em `core/`), onde exatamente o import vive, e a linha que mais vale: *"não abrir uma segunda exceção parecida sem necessidade real equivalente — cada nova é uma revisão à parte"*. O data-lab torna a exceção **impossível** pelo ESLint, o que é mais forte — mas significa que, no dia em que uma for genuinamente necessária, não há modelo de como registrá-la.

---

## 2. O que já convergiu, sem cópia

Registrado porque convergência é evidência: quando dois projetos chegam à mesma regra por caminhos diferentes, ela provavelmente está certa.

| Regra | mill.tools | data-lab |
|---|---|---|
| Core puro, rede/modelo injetável | princípio inviolável nº 1 e nº 2 | D2 da visão geral · `ChatFn`/`ProbeFn` |
| Ping curto, operação longa | `AVAILABILITY_TIMEOUT=10s` / `EMBED_TIMEOUT=300s` | D9.3 · 10s / 300s na fatia 1 |
| Gate que desabilita com dica, nunca quebra | princípio nº 6 | `AppError.kind='unavailable'` + `hint` |
| IA de dados recebe só esquema, nunca linhas | regra de fronteira nº 3 | os três níveis do [`ESCOPO`](../ESCOPO.md) |
| Tokens sem dependência de framework | `tokens.py` é puro Python | `tokens.css` é a fonte única |
| Constante de layout é token | `Layout.form_width = 380` | largura da sidebar, plano 13 |
| Régua de tamanho + "divide-se ao tocar" | seção 3 | régua do [`CLAUDE.md`](../../CLAUDE.md) |
| Propor, nunca executar | `nl2cli` gera o comando e **só copia** | `kind: 'query' \| 'steps'` com revisão |
| Anti-drift por introspecção | `cli/reference.py` lê os parsers argparse reais | `z.toJSONSchema()` deriva do mesmo schema que valida |

A última linha é a mais interessante: os dois resolveram *"a descrição que o modelo vê não pode divergir do que o código aceita"* derivando uma da outra, em linguagens e domínios diferentes.

---

## 3. O que vale trazer, por destino

### Para o plano 15 — contexto e modelo

**`num_ctx` pequeno demais corrompe saída estruturada, e isso já aconteceu lá.** O `llm_factory` fixa `DEFAULT_OLLAMA_NUM_CTX = 8192` com o motivo escrito: *"o Ollama usa 2048 por padrão — pequeno demais p/ o JSON verboso (truncava → JSON inválido)"*. O data-lab vai pedir JSON estruturado a um 4B no plano 18; este é o modo de falha que aparece primeiro, e ele se parece com "o modelo é ruim" sem ser.

Junto vai a nota de precedência: `num_ctx` **por requisição** vence o slider do app Ollama, que é o nível mais baixo. Ou seja, o app controla, e o usuário não precisa configurar nada fora dele.

**Cache de disponibilidade com TTL, só no caminho quente.** `is_available(model, use_cache=False)` tem um opt-in de 60s, usado só no *hot path* da conversa; caminhos frios (painel de status, gate de reindexação, CLI) mantêm `False` para nunca reportar veredito velho. O data-lab vai pingar o Ollama a cada mensagem quando o seletor de modelo existir.

**Orçamento de contexto longo por modelo.** `LONG_CONTEXT_LOCAL_BUDGETS` dá a cada modelo local um teto em caracteres (`gemma3-4b`: 12000 ≈ 3K tokens) acima do qual volta a fatiar; nuvem nunca fatia. É uma forma concreta da política de truncamento que a D13/15 ainda deve.

### Para os planos 16 e 17 — o cartão de dados e seu cache

**A assinatura de cache precisa conter tudo que muda a saída — e ser uma função só.** É a ideia mais profunda do conjunto. O mill.tools compõe `embed_space_id = "{modelo}:{dim}:{esquema}"` e a **dobra em toda assinatura derivada**: protótipos de classificação, modelo supervisionado, mapa semântico. Antes disso, trocar o modelo de embedding deixava caches do espaço antigo válidos e *"prevendo lixo em silêncio"* — palavras deles.

O análogo no data-lab é direto e ainda não decidido: o **cartão de dados vai ser cacheado**. A chave óbvia é `(path, mtime)` — e ela é insuficiente no dia em que o prompt, o cálculo do perfil ou o modelo mudarem.

**E o corolário, que é um bug real que eles encontraram na validação:** o índice era incremental por `(path, mtime)`, então uma mudança de esquema **nunca movia o mtime de arquivo nenhum**. O botão "Reindexar" reescrevia o marcador afirmando o esquema novo **sem reembeddar nada**. A correção foi um parâmetro `force`, passado pelos três chamadores que persistem a versão. Lição transferível: **caminho rápido incremental precisa de um jeito de ser forçado, e quem versiona o conteúdo é quem decide forçar.**

**Marcador de versão de conteúdo, fonte única.** `CURRENT_EMBED_SCHEME` é uma constante com a instrução explícita: *"bump aqui sempre que uma mudança exigir reindexação; fonte única, nunca criar um segundo mecanismo de versionamento."*

**Onde o cache mora.** Lá é JSON em `~/.mill-tools/`, chaveado por `(path, mtime)` — `data_assessments.json` é literalmente a avaliação de qualidade da IA sobre um arquivo de dados. No data-lab isso é uma **tabela do SQLite** que o plano 14 já traz, o que é melhor: um mecanismo de armazenamento, uma escada de migração.

### Para o plano 18 — propostas

**Não use RAG sobre o catálogo, e o gatilho para reabrir está escrito.** A decisão do `nl2cli`: o corpus inteiro de CLI (~54 operações, ~8,5k caracteres) cabe no contexto de um modelo local, e *"RAG trocaria 'o modelo vê tudo' por 'vê top-k', o que pioraria a acurácia num corpus desse tamanho. Só reabrir se o corpus de CLI multiplicar de tamanho."* O catálogo camada 1 do data-lab tem ~25 operações — mesma ordem, mesma conclusão, mesmo gatilho.

**Protocolo de retry que o data-lab ainda não desenhou.** O `nl2cli` reprompta **uma vez** anexando o erro de validação; a segunda falha levanta. E resposta vazia é **recusa deliberada** (pedido fora do escopo do app), que nunca passa pelo validador. Três estados — válido, retentável, recusa — em vez de dois.

Contraste registrado por eles mesmos: o `condense.py` **não** tem retry, porque ali a falha tem um fallback natural e barato (usar a pergunta crua). A regra implícita é boa: *retry onde não há fallback; fallback silencioso onde há.*

**Avaliação determinística, LLM-as-judge fora de escopo por desenho.** O harness de avaliação do RAG é *retrieval-only*: nenhuma chamada de LLM, *"determinístico, rápido, barato"*. É exatamente a postura da verificação pós-execução que o data-lab decidiu — e vale saber que eles chegaram nela por escolha explícita, com a alternativa nomeada e recusada.

**Conjunto de avaliação com dois tipos de pergunta.** Golden set tem perguntas **cobertas** (o acervo responde) e **fora-do-acervo** (o acervo não responde — e o acerto é o aviso de baixa cobertura disparar). Transposto: um conjunto de avaliação de NL→SQL precisa de perguntas que o esquema responde **e** perguntas que ele não responde, medindo se o app recusa direito.

**Rodadas incomparáveis são sinalizadas, não viram falsa regressão.** `latest_and_previous` só compara rodadas do mesmo espaço de embedding. Vale para qualquer métrica acompanhada ao longo do tempo: mudou a base de cálculo, a série anterior não é comparável, e fingir que é produz alarme falso.

### Para o observatório

**Instrumente no ponto de estrangulamento, não em cada produtor.** Duas aplicações do mesmo princípio, e as duas são o motivo de o observatório deles ter saído barato:

- O log de falhas é alimentado por um **hook central em `EventBus.emit()`** — todo `task_error` de qualquer módulo, *"sem tocar em nenhum `worker.py`"*.
- A latência por modelo é medida por um callback que `make_llm()` anexa a **todo** modelo criado, cobrindo seis chamadores sem editar nenhum deles.

O data-lab tem os dois pontos de estrangulamento prontos e ociosos: **`src/main/ipc/registry.ts`**, por onde passa todo canal, e **`src/main/jobs.ts`**, onde vive todo job. Um observatório alimentado dali não toca handler nenhum.

**"Coleta primeiro, usa depois."** O log de 👍/👎 declara explicitamente que **nenhum uso automático** existe nesta fase — sem recalibração de limiar, sem treino de reranker. Coletar sinal é barato e reversível; agir sobre ele automaticamente não é nenhum dos dois.

**Scanner de disco genérico, sem nomes fixos.** *"Não lista nomes hardcoded — um store novo aparece sozinho."* Detalhe pequeno com efeito longo: a tela não envelhece quando o app ganha um armazenamento novo.

### Para as skills e a documentação

**Sinais nomeados de baixa coesão, com exemplo e número.** A régua deles combina tamanho **e** coesão, e o que a torna operacional são os exemplos concretos: *"uma função-builder com muitas closures cobrindo abas distintas (o antigo `data/view.py` com 47 closures e 3 abas)"*, *"um arquivo que reúne adaptadores de vários módulos (`registry.py` com 33 adaptadores de 7 módulos)"*, *"comentários de seção que separam mundos diferentes"*. O `CLAUDE.md` do data-lab tem *"coesão pesa abaixo do teto"* sem nenhum sinal nomeado — o que deixa a regra dependente de julgamento na hora.

**Sistema de ajuda com registro central.** `HELP_SHORT`/`HELP_LONG` num arquivo único, `help_icon_for(key)` devolvendo `None` para chave inexistente — *"seguro omitir sem `if`"*. O data-lab tem a estrutura equivalente para **erros** (`messages.ts`, `Record<ErrorKind, string>` com cobertura forçada pelo typecheck) e **nenhuma** para ajuda. O arco vai produzir coisas que precisam ser explicadas no lugar: `num_ctx`, `num_thread`, os três níveis de exposição, os avisos da verificação pós-execução.

---

## 4. O que **não** trazer

| Não trazer | Por quê |
|---|---|
| A tabela de 24 quirks do Flet, como forma | Flet 0.85 é framework jovem com API fina sendo forçada. React 19 + Chromium 148 não vão render 24 armadilhas de API — copiar a forma criaria uma tabela que fica vazia |
| A maquinaria de extras com gate (`[ml]`, `[nlp]`) | É empacotamento de Python. O análogo em JS é dependência normal, e o gate de **serviço** o data-lab já tem |
| Barramento de eventos com escopo por `module_id` | O data-lab já resolve mais fino: evento chaveado por `jobId`, decidido na fase 02 |
| RRF, MMR, piso de relevância, pool de candidatos | Calibrado para milhares de documentos. A D9.5 já registrou que o corpus do data-lab são centenas — essa sofisticação resolve um problema que ele não tem. As lições sobre **assinatura de cache**, essas transferem |
| Log append-only em JSON com cap | Lá é a escolha certa (sem banco). Aqui há SQLite a partir do plano 14 |

---

## 5. Duas observações críticas

Registradas porque a comparação também serve para não herdar problema.

**Regra escrita não é regra verificada, e três das invioláveis deles estão na prosa.** *"Core é puro"*, *"idioma do código em inglês"* e *"`subprocess` sempre em modo binário"* dependem de revisão. A terceira é a mais frágil: um `text=True` esquecido não quebra nada até alguém processar um arquivo com caractere cp1252. É a forma exata da armadilha que o data-lab já registrou — *a lista branca de esquemas existia, era testada, e o `main` não passava por ela* — cuja lição foi que **regra que nada verifica é decoração**. O data-lab converteu as suas em `no-restricted-imports` e `guard.mjs`.

**Densidade que vira custo de manutenção.** A `ml-rag` tem 428 linhas, e trechos como o do piso de relevância gastam quinze linhas explicando a reconciliação entre dois contratos. O raciocínio é excelente e claramente caro de reconstruir — mas está numa skill, que é lida **para agir**, não para entender. O `HISTORY.md` do data-lab existe justamente para essa camada. A separação que o próprio projeto deles pratica na `architecture` (*"esta skill não narra história — só a régua que continua valendo"*) não foi aplicada com o mesmo rigor na `ml-rag`.

---

**Índice:** [Referência](README.md) · [Escopo](../ESCOPO.md) · [Histórico](../HISTORY.md) · [Roadmap](../ROADMAP.md)
