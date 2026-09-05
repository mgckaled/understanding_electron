# Revisão de escopo (6ª) — identidade multiuso, instrumentação e o veredito de Projetos

**Entrega:** `ESCOPO.md` reescrito nos sete pontos em que ele descreve um produto que já não é o de hoje — identidade, administração de modelo, a segunda categoria do teste de escopo (instrumentação), a seção *Ferramentas do chat* (três erros factuais + o requisito de segurança do arco 22), o veredito de Projetos, as duas promessas não cumpridas (Parquet e código) e o diagrama de ordem de construção que duplica pior o `ROADMAP § 1`. Mais a correção do número de RAM livre da máquina nos seus donos, e o registro de 20/E-3 como pilares previstos.

> Sexta revisão de escopo. Precedente de formato: [`revisao-escopo-nivel-3-nuvem.md`](../implemented/revisao-escopo-nivel-3-nuvem.md) (5ª) — plano próprio, sem sigla de trilha, para não consumir a reserva de `R-7` (compressão documental, registrada pelo R-6).
>
> **Aceite global: nenhuma linha em `src/` muda de comportamento.** `git diff --stat -- src/` fica vazio em todo commit deste plano. O que muda é definição de produto e os documentos que a citam. As decisões de produto que este plano toma **habilitam** trabalho futuro (P-1, arco 22, F-6); nenhuma delas manda escrever código agora.

---

## O caso — por que este plano existe

As cinco revisões anteriores foram aplicadas **por emenda**: cada uma acrescentou um parágrafo corretivo ao lado do texto que ela contradiz, sem reescrever o texto antigo. O resultado é um documento cuja tese está certa e cuja **abertura está errada** — e abertura é o que o leitor rápido consome.

O sintoma canônico está nas linhas 15 e 17: a 15 abre em negrito com *"Uma bancada de dados local, operada por conversa"*; a 17 começa com *"Mas não é só isso, e fingir que é enfraquece o que o app já entrega"*. O documento discute consigo mesmo, e quem para no primeiro negrito sai com a identidade de duas revisões atrás. Hoje o [`CLAUDE.md`](../../../CLAUDE.md) descreve a identidade do produto melhor que o próprio dono do assunto — inversão da regra de fonte única.

**O gatilho:** o arco 21 fechou (raciocínio visível ponta a ponta, nos três provedores, com assinatura persistida e reenviada), a trilha O fechou os oito cortes previstos, e o próximo arco é o **22 — busca web**, que vai tocar exatamente a seção mais desatualizada do documento. Revisar depois de escrever o 22 seria pagar o retrofit.

### Investigação já feita — não repetir na execução

- `ESCOPO.md` lido nas seções de identidade (1–190) e de fronteira (352–443); catálogo de operações, formatos e escala **não** lidos, e este plano não os toca.
- `ROADMAP § 1` (o quadro de trilhas, linhas 13–58) e `§ 4` lidos; `docs/README.md` e `plan/active/README.md` lidos por inteiro.
- As sete skills invocadas pelo Skill tool nesta sessão.
- Conferido contra o código: `draft:*` é escopado por `conversationId` (`src/shared/ipc.ts`) — o rascunho **passa** no teste de escopo vigente, o que dá o contraste que sustenta o Passo 3.
- Inventário das citações de RAM livre: `CLAUDE.md:276` (dono), `.claude/skills/ai/SKILL.md` linhas 42 e 64, `reference/projetos-e-rag-por-projeto.md` § 7. As citações em `ARMADILHAS.md:159` e `HISTORY-archive.md` são **registro datado de decisão** e não se corrigem.
- [`reference/projetos-e-rag-por-projeto.md`](../../reference/projetos-e-rag-por-projeto.md) lido por inteiro (levantamento de 25/08/2026) — é o insumo do Passo 5, e ele próprio tem duas premissas envelhecidas, tratadas no Passo 5.

---

## Régua de redação — o que NÃO entra no `ESCOPO.md`

⚠️ **Vale para toda linha que este plano escrever ou reescrever, e é aceite de fechamento, não recomendação.** O `ESCOPO.md` define o produto **no presente**. Três classes de conteúdo ficam fora:

1. **Marca temporal** — *"em ago/2026"*, *"medido em set/2026"*, *"desde a 5ª revisão"*, *"hoje não entrega"*. Ou a coisa é escopo, e vale agora, ou não é escopo.
2. **Narrativa** — o que foi tentado, o que foi descartado, o que mudou de ideia, quanto custou descobrir. Dono é o [`HISTORY.md`](../../HISTORY.md); o escopo **aponta pela sigla**, não reconta.
3. **Medição com proveniência** — o número que decide produto fica (o teto de ~8k tokens por documento); o relato de **como e quando** foi medido sai, e vira ponteiro para o dono (skill `ai`, `reference/`, `HISTORY.md`).

**O teste de uma frase: se ela envelhece sozinha, não é escopo.** *"O nível 3 é opt-in por anexo, em qualquer provedor"* é escopo. *"O nível 3 passou a ser opt-in em qualquer provedor na 5ª revisão, ago/2026"* é história com escopo dentro.

Onde a proveniência é a única garantia contra alguém reverter uma decisão sem saber que ela foi tomada, ela vira **ponteiro** — sigla ou documento dono —, nunca parágrafo.

⚠️ **A régua vale para a seção tocada inteira, não só para a linha nova.** Tocar uma seção e deixar a narrativa vizinha de pé é o que produziu o estado atual — e é a parte do ruído que o `R-7` não vai poder limpar, porque `R-7` não reabre escopo.

---

## Passo 0 — Nascimento do plano

Este arquivo, mais a linha nova no [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência) — a 6ª revisão de escopo, no padrão das linhas 3, 6, 19, 22 e 37 (trilha `—`).

## Passo 1 — A identidade, reescrita e não emendada

`ESCOPO.md § Em uma frase`. Inverter a ordem: a frase é a ferramenta multiuso operada por conversa; dados vem em seguida como **o pilar mais maduro e o que organiza os demais** — que é o que o `CLAUDE.md` já diz.

A frase acordada, a ajustar na redação final: *uma ferramenta local multiuso operada por conversa, que administra a inteligência que roda na sua máquina e a que você opta por chamar na nuvem.*

O parágrafo *"Mas não é só isso, e fingir que é..."* **sai** — ele existe para corrigir a frase anterior, e a frase anterior deixou de existir. O que ele enumera (documento, código, busca web, MCP, raciocínio) vira a lista de pilares, afirmativa.

**Verificação:** nenhuma linha do documento pode mais começar corrigindo a anterior. Grep por `Mas não é só isso` e `na verdade` no arquivo, zero resultados esperados.

## Passo 2 — Seção nova: a administração do modelo é parte do produto

Hoje o `ESCOPO.md` descreve exaustivamente o que o app faz **com arquivos** e quase nada do que ele faz **com modelos** — apesar de essa ser a maior massa de código entregue. O que existe e não está no dono do assunto: três provedores intercambiáveis com escolha por mensagem, segredo de mão única, orçamento de RAM e de contexto (faixas fixas, trava de janela no primeiro envio, `unaffordable`, ancoramento pós-fato), descarregamento do modelo anterior, gate de capacidade, raciocínio alternável por turno, e o motivo de parada `context-exhausted`.

Seção nova, com **um princípio próprio** que hoje é a tese não escrita de quatro decisões:

> **O app nunca deixa o modelo decidir em silêncio o que descartar.** Ele mede antes, recusa antes, e mostra o custo.

É o motivo de fundo de `GATE_MARGIN`, de `budgetFor.fits`, do gate de `vision` e de `context-exhausted` — hoje quatro decisões sem tese comum escrita, cada uma justificada isolada no seu plano.

⚠️ **A seção descreve o produto, não o mecanismo.** Fórmula de KV cache, `OVERHEAD`, nomes de seam e tabela de provedor são da skill [`ai`](../../../.claude/skills/ai/SKILL.md) — a seção **aponta** para ela. A linha que hoje mora enterrada em *"o que este escopo implica no plano"* (descarregar o modelo anterior ao trocar) sobe para cá.

## Passo 3 — O teste de escopo ganha a segunda categoria: instrumentação

O teste vigente diz que uma capacidade é pilar **enquanto viver dentro da conversa**; no instante em que precisar de estado próprio gerido fora dela, virou outro produto.

**O Observatório viola os três termos** — tela própria, `observatory.db` que grava, nada nele nasce ou morre com uma conversa. Oito painéis e nove canais IPC entregues. Ou seja: a trilha O inteira foi construída fora do escopo declarado, e o escopo nunca registrou isso. O contraste que prova que o teste não está simplesmente frouxo é o rascunho: `draft:*` é escopado por `conversationId` e passa com folga.

O teste não está errado — está **incompleto**. Ele governa capacidades que produzem ou consomem *conteúdo do usuário*. Falta a segunda categoria, com fronteira igualmente mecânica:

> **Instrumentação** — capacidade que observa o próprio aplicativo, nunca o dado do usuário. Admitida enquanto (i) for leitura do que o app já faz, (ii) o que ela grava for sobre **si mesma** (`observatory.db`, nunca `crivo.db`), e (iii) não produzir artefato que saia do app. No instante em que virar relatório exportável ou painel configurável, cai de volta no teste original — e vira outro produto.

Isso legitima retroativamente O-1..O-8, mantém firme a fronteira (os três painéis fora da fila continuam gatilhados por sensor que falta, não por telemetria), e dá critério pronto para o futuro painel de RAG/ML. O `ESCOPO.md` passa a **conhecer** o Observatório, com ponteiro para [`reference/observatory/`](../../reference/observatory/README.md), que continua dono dos seis eixos e do inventário.

## Passo 4 — *Ferramentas do chat*: três erros factuais e o requisito do arco 22

A seção mais desatualizada do documento, e a que o próximo arco vai tocar.

**(a) A premissa do *tool calling* — a correção mais importante.** A linha 170 diz que as três capacidades *"chegam pelo tool calling do Ollama"*. **Falso, e provado falso pelo arco inteiro que acabou de fechar:** raciocínio chega por **campo nativo do fio** em cada provedor (`think` no Ollama, `includeThoughts`/Interactions API no Gemini, `thinking.type` no GLM), sem tool calling nenhum, nos três. Se o plano 22 nascer presumindo tool calling obrigatório, herda uma premissa já derrubada.

**A decisão de produto que este plano registra sem construir:** busca web pode chegar por (i) tool call do modelo local, (ii) **ação do usuário** — colar ou anexar uma URL, que não exige `tools` de modelo nenhum, ou (iii) capacidade nativa do provedor de nuvem. As três têm fronteiras de privacidade diferentes, e a (ii) é a única que funciona hoje em toda a frota. O escopo registra as três como caminhos legítimos; **qual delas o 22 constrói é decisão do 22.**

**(b)** A célula de raciocínio ainda diz *"ainda não recolhível — o bloco recolhível de verdade é do 21-B"* e *"No Gemini, hoje não entrega nada"*. Os dois superados: 21-B entregou o bloco; [`21-D-A`](../implemented/21-D-A-interactions-api-o-parser-novo.md) trouxe raciocínio real do Gemini pela Interactions API, e 21-D-B a assinatura persistida e reenviada.

**(c)** A linha 178 afirma que *nenhum modelo desta máquina declara `tools` e `vision` juntos* — falso desde `qwen3.5:2b`. Já registrado como **F-6** no `ROADMAP § 1`; o `ESCOPO.md` é quem afirma, e continua afirmando. Aqui o texto só deixa de mentir; **a decisão de produto sobre o gate continua sendo do F-6**, não deste plano.

**(d) Promover o requisito de segurança.** A linha 180 — `checkExternalUrl` hoje só confere esquema, e URL **escolhida pelo modelo** precisa recusar loopback e faixas privadas — está enterrada no último parágrafo de uma seção desatualizada. É a decisão de segurança que define o arco 22 e vira item de primeira classe, com o argumento explícito: abrir link no navegador do sistema nunca precisou disso porque quem escolheu a URL foi o usuário.

## Passo 5 — Projetos: escopo definido, não entregue — e desacoplado de RAG e ML

O caso está declarado como aberto na linha 31. Este plano **fecha o veredito** e o registra como escopo definido, sem compromisso de data.

**A separação que desfaz o nó** — três coisas coladas por acidente de origem, porque o padrão que inspirou a proposta entrega as três juntas:

| | O que é | Depende de RAG? | Onde vive |
|---|---|---|---|
| **Projeto como agrupador** | `project_id` na conversa, prompt de sistema do projeto, documentos do projeto no contexto de suas conversas | **não** | trilha nova (sugestão: **P**), sem arquivo |
| **RAG** | busca semântica, embedder, índice vetorial | é ele mesmo | fatia 5 do [plano 09](../active/09-camada-de-ia.md), gatilho já declarado |
| **ML clássico** | clusterizar, detectar outlier, imputar | não | fatia 6 do 09 — pertence ao **pilar de dados** |

**O argumento é do próprio escopo, não uma opinião nova:** a linha 312 fixa o teto de ~8k tokens por documento e registra que *abaixo dele RAG perde* — o trecho recuperado muda a cada pergunta, mata o cache de prefixo e paga tokens novos para sempre, enquanto o documento inteiro paga uma vez. Enquanto os documentos de um projeto couberem nesse teto, mandar tudo é melhor que recuperar. RAG entra quando estourar — mesmo gatilho, e vale igual para conversa avulsa. ML em Projetos é erro de categoria: ML opera sobre dataset, não sobre conversa.

**O veredito, aplicando o teste com honestidade:**

- **Dentro:** agrupar conversas sob um prompt de sistema e um conjunto de documentos. São *"contexto consumido"* e *"artefato que o app já sabe persistir"* — os dois termos permitidos da linha 27. O `project_id` é uma coluna, e o slot de prompt de sistema **já existe** no `settings JSON` por conversa (D14.1); falta elevá-lo de conversa para projeto.
- **Fora:** a superfície de **gerência** — biblioteca de documentos com status de reindexação, seletor de embedder, painel de índice. Tela própria com estado próprio, do lado "outro produto". Reforço prático de [`projetos-e-rag-por-projeto.md`](../../reference/projetos-e-rag-por-projeto.md) § 6: existe **um** embedder qualificado na máquina (`nomic-embed-text`), então "escolher embedder" hoje é escolher entre um e nada.

⚠️ **Duas premissas do levantamento envelheceram, e este plano as corrige lá também** — senão o documento que um plano futuro vai consumir continua apoiado em fato morto:

1. **§ 2 corrige uma leitura errada apoiando-se em fato errado.** A conclusão (o teste *aprova* Projetos) está certa, mas a evidência citada é *"essas três chegam pelo tool calling do Ollama"* — a mesma premissa que o Passo 4(a) derruba. Trocar a evidência pelo termo literal da linha 27 (*contexto consumido / artefato que o app já sabe persistir*), que sustenta a conclusão sozinho.
2. **§ 7 chama de "a restrição que discrimina de verdade"** o fato de o modelo padrão com `vision` não ter `tools`. Deixou de discriminar com `qwen3.5:2b`. A seção inteira precisa da anotação; a tabela de bancada dela usa as faixas de RAM que o Passo 9 corrige.

## Passo 6 — As duas promessas que o documento faz e o app não cumpre

Parquet (linhas 15 e 41) e código-fonte (linhas 41 e 239) aparecem na tabela de formatos como entrada válida; nenhum dos dois chega ao seletor — `dataset:pick` não lista `.parquet`, e `document:pick` filtra só `txt/md/pdf`. Dois casos do mesmo tipo é padrão, não acaso: **o escopo admite formato antes de o caminho existir**, e o leitor não distingue "suportado" de "prometido".

Marcação única e explícita na tabela para os dois, com o gatilho nomeado em cada caso, e ponteiro para o `ROADMAP § 4` (que já registra o do código). Sem inventar plano para nenhum dos dois aqui.

## Passo 7 — Gráfico (20) e `.pptx` (E-3) como pilares previstos, com a dependência dita

A seção *Onde passa a linha do gráfico* define bem a fronteira, mas o documento não diz que o gráfico é o **plano 20**, ainda não entregue, nem que **E-3 depende dele** — o motor `.pptx` aproveita as imagens de gráfico que o 20 produz. Hoje `.pptx` só aparece no *Fora do escopo* dizendo "tem plano próprio, depois do arco de gráficos", o que lê como recusa e não como sequência.

Registrar a dependência 20 → E-3 e marcar os dois como previstos, com estado vindo do `ROADMAP § 1` — sem duplicar a tabela de lá.

## Passo 8 — Apagar a *Ordem de construção*

O diagrama (linhas 423–437) termina em "camada 2 do catálogo" e não conhece exportação, nuvem, raciocínio, observatório nem busca web. Ele duplica o `ROADMAP § 1` — pior, e envelhecido: ainda afirma que a camada de dados vem "no meio". Pela convenção de fonte única do próprio projeto: **apagar e apontar**. É o item mais barato do plano e o que já enganou.

## Passo 9 — RAM livre: remedir e corrigir os donos

Números novos, informados pelo usuário nesta sessão (05/09/2026), substituindo os três de 10/08/2026:

| Cenário | Livre | Nota |
|---|---|---|
| Só o terminal (Claude Code) | **~8,5 GB** | conservador — o gerenciador de tarefas reporta 8,7–8,9; arredondado para baixo de propósito |
| Com VS Code aberto | **6,5–7,0 GB** | varia conforme o que o VS Code está fazendo |

**Consequência que muda texto em três lugares: a variação é de ~1,5–2 GB, não de ~3 GB.** O argumento que ela sustenta (o teto de contexto se lê em runtime em vez de ser chumbado; uma janela travada enquanto ocioso pode não alocar depois) **continua de pé** — só o número muda. Corrigir em:

- [`CLAUDE.md`](../../../CLAUDE.md) § *Máquina e modelos locais* — o dono, linha 276.
- [`skill ai`](../../../.claude/skills/ai/SKILL.md) — duas menções a "~3 GB" (`freeBytes` lido no momento da chamada; `ConversationWindow`/`unaffordable`).
- [`reference/projetos-e-rag-por-projeto.md`](../../reference/projetos-e-rag-por-projeto.md) § 7 — a tabela de bancada compara contra as três faixas antigas.

⚠️ **Não corrigir** `ARMADILHAS.md:159` nem `HISTORY-archive.md`: são registro **datado** de uma decisão tomada com o número da época. Reescrevê-los apagaria a evidência de por que a decisão foi tomada assim, e `archive/` é só leitura.

⚠️ **O terceiro cenário antigo ("ambiente de trabalho típico: VS Code, Edge, WhatsApp, Claude Code") não foi remedido.** Ou ele deixa de existir na tabela, ou o usuário mede uma vez. **A decidir na execução, não presumir** — auto-conservação (b) do `CLAUDE.md`: nunca copiar número sem reconferir a fonte na hora.

## Passo 10 — Conservação e fechamento

Auto-conservação, os três tipos, aplicados a esta mudança:

- **(a) nome/caminho:** nada renomeia. Mesmo assim, `grep` por *"bancada de dados"* em `.claude/skills/` e `docs/` — a frase antiga da identidade é citável e pode ter viajado.
- **(b) contagem que envelheceu:** remedir o tamanho do `ESCOPO.md` **antes e depois**. Ele já está estourado (45,8 kB contra o teto de ~45), e este plano acrescenta duas seções. O resultado alimenta o `ROADMAP § 2` e é insumo direto do **R-7** (compressão documental) — que passa a ter o `ESCOPO.md` como alvo nomeado, não genérico.
- **(c) teto de documento:** a entrada em `HISTORY.md` é a 11ª → a mais antiga desce para `HISTORY-archive.md` **na mesma edição**.

Fechamento: `ROADMAP § 1` ganha a linha da 6ª revisão e o registro de **P** (trilha nova, sem arquivo); `ROADMAP § 4` perde o item de Projetos, que deixou de ser "proposta sem prioridade" e virou escopo definido; `DECISOES.md` ganha as linhas `RE6.x`; plano move para `implemented/` com `git mv`, status e caminho no mesmo commit (o hook `guard` pega link quebrado).

---

## Decisões

- **RE6.1 — A identidade se reescreve, não se emenda.** Quinta emenda consecutiva produziria o sexto parágrafo corretivo. O texto antigo sai.
- **RE6.2 — Administração do modelo vira seção de produto, com princípio próprio.** *O app nunca deixa o modelo decidir em silêncio o que descartar.* Descreve produto; mecanismo continua na skill `ai`.
- **RE6.3 — O teste de escopo ganha a categoria "instrumentação".** Legitima a trilha O retroativamente e dá critério mecânico ao que vier. Fronteira: grava sobre si mesmo, nunca sobre o dado do usuário.
- **RE6.4 — Raciocínio (e possivelmente busca web) NÃO chega por *tool calling*.** Corrige a premissa da linha 170 com o resultado do arco 21. Os três caminhos possíveis do arco 22 ficam registrados; a escolha é do 22.
- **RE6.5 — Projeto mínimo entra no escopo como definido e não entregue; RAG e ML ficam de fora dele.** Três itens independentes com gatilhos próprios, em vez de um arco que bloqueia em dois trabalhos caros que não precisa. Trilha **P** sugerida, sem arquivo.
- **RE6.6 — O diagrama de ordem de construção é apagado, não atualizado.** Duplica pior o `ROADMAP § 1`; a convenção de fonte única já decide isso.
- **RE6.7 — Números datados em `ARMADILHAS.md`/`HISTORY-archive.md` não se corrigem.** São evidência da decisão da época, não afirmação sobre a máquina de hoje.
- **RE6.9 — O `ESCOPO.md` é atemporal e sem narrativa; a régua acima é aceite, não estilo.** Pedido explícito do usuário, e é boa parte do motivo declarado de o `R-7` existir: ruído de história, narração e medição onde não deveria haver. Seção tocada sai limpa por inteiro — não só a linha nova.
- **RE6.8 — Este plano não abre plano de código.** F-6 (gate vision+tools), arco 22, P-1 e o conserto de `readAttention` continuam onde estão. Uma variável por vez.

---

## Verificação

1. `git diff --stat -- src/` **vazio** em todo commit.
2. `pnpm check:fast` verde no fechamento (o `guard` valida os links relativos criados).
3. Nenhuma linha do `ESCOPO.md` começa corrigindo a anterior (grep do Passo 1).
4. Toda afirmação factual tocada foi reconferida na fonte na hora — capacidades contra `/api/show`, estado de plano contra o `ROADMAP § 1`, tamanho contra `wc`/bytes.
5. As duas premissas envelhecidas de `projetos-e-rag-por-projeto.md` corrigidas no próprio documento (Passo 5).
6. `ESCOPO.md` remedido depois, e o número entregue ao `ROADMAP § 2` como alvo do R-7.
7. **Régua de redação (RE6.9), verificada por grep e não por leitura:** nas seções tocadas, zero ocorrências de `ago/2026`, `set/2026`, `20\d\d`, `revisão de escopo`, `medido em`, `hoje não`, `passou a`, `deixou de`. Uma ocorrência sobrevivente só é aceitável como ponteiro nomeado a documento dono — e então é ponteiro, não frase.

---

## Diário de execução

| Sessão | O que foi feito |
|---|---|
| 2 (05/09/2026) | Execução completa, um commit por passo. Régua RE6.9 fixada antes da primeira linha, a pedido do usuário. Passos 1–8 no `ESCOPO.md`: identidade reescrita; seção nova de administração do modelo (absorvendo o gate de capacidade, que nunca foi sobre exposição de dado, e a linha do modelo residente, enterrada no fim do documento); segunda categoria do teste; *Ferramentas do chat* com os três erros corrigidos e o requisito de URL promovido a subseção; seção de projeto; marca ⌛ em quatro linhas de formato; gráfico/`.pptx` com a dependência dita e `.pptx` retirado de *Fora do escopo*, onde estava classificado errado; diagrama de ordem apagado e a seção final renomeada para *Consequências arquiteturais*. Passo 9: RAM remedida em três donos vivos, dois arquivos datados deixados intactos (RE6.7), terceiro cenário removido em vez de mantido velho. Passo 10: **a verificação da régua por grep achou cinco marcas temporais que a revisão tinha deixado passar** — incluindo uma que narrava a correção de um valor anterior de `memory_limit` e outra que citava "o erro da terceira revisão de escopo"; documento fecha com zero ocorrências. `ESCOPO.md` 45,8 → 47,8 kB, nomeado como alvo do `R-7` no § 2. Fechamento: `HISTORY.md` ganha o marco no topo e empurra o `O-5` para o archive; `DECISOES.md` ganha a seção da 6ª revisão com as nove siglas; `ROADMAP § 1` marca a linha 44 concluída e abre a **trilha P**; `ROADMAP § 4` perde o item de Projetos, que deixou de ser pendência. |
| 1 (05/09/2026) | Plano nasceu. Sete skills invocadas; `ESCOPO.md` lido nas seções de identidade e fronteira, `ROADMAP § 1`/§ 4, `docs/README.md` e `plan/active/README.md` inteiros. Análise crítica entregue ao usuário: sete achados, sendo o mais forte que a trilha O inteira foi construída fora do teste de escopo declarado. Três decisões de produto confirmadas pelo usuário (identidade, instrumentação, Projetos). RAM remedida pelo usuário: ~8,5 GB só terminal, 6,5–7,0 GB com VS Code — variação é ~1,5–2 GB, não os ~3 GB citados em três documentos. `projetos-e-rag-por-projeto.md` lido: confirma a separação Projeto/RAG/ML e revela duas premissas próprias envelhecidas (a § 2 apoia conclusão certa em fato que o arco 21 derrubou; a § 7 chama de restrição decisiva algo que `qwen3.5:2b` desfez). Numeração resolvida pelo precedente da 5ª revisão — arquivo próprio, sem sigla, deixando `R-7` livre para a compressão documental. |
