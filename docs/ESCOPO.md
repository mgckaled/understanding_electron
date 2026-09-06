# Escopo — crivo

O que o aplicativo faz, o que ele não faz, e as consequências arquiteturais de cada decisão.

> Este documento é a **definição de produto**. O [`CLAUDE.md`](../CLAUDE.md) diz como o código é escrito; o [`ROADMAP § 1`](ROADMAP.md#1-a-sequência) diz em que ordem construir; o [caderno de estudos](study/README.md) explica o Electron. Aqui está o que se está construindo, e por quê.
>
> ⚠️ **O escopo descreve o produto, não um teto para a arquitetura.** A seção [Fora do escopo](#fora-do-escopo) é firme sobre o que **não se constrói** — e continua firme. O que ela não autoriza é estrutura que só saiba abrigar o que está escrito aqui. O critério que separa "não construir" de "não impedir" é dono de [`HISTORY-archive.md`](HISTORY-archive.md) § *flexibilidade é forma de dado e slot* (`DT7`): forma de dado que atravessa camadas e costura que custa zero decidem-se agora; feature constrói-se quando existir.

---

## Em uma frase

**Uma ferramenta local multiuso, operada por conversa, que administra a inteligência que roda na sua máquina e a que você opta por chamar na nuvem.**

Ela sustenta vários pilares, e **dados é o mais maduro deles** — o que organiza os demais: abrir CSV, Excel ou JSON, perguntar sobre o arquivo em português, e sair com uma resposta ou com o dado tratado. Na mesma conversa entram o documento que explica o dado (o `.md` da especificação, o PDF do contrato, a captura de tela da planilha), o trecho de código para revisar ou entender, a busca na web, a consulta a documentação de biblioteca, e o raciocínio do modelo em voz alta.

Administrar a inteligência é pilar como os outros, e tem [seção própria](#a-administração-do-modelo-é-parte-do-produto): qual modelo responde, quanto de contexto ele reserva, o que ele é capaz de receber, e o que sai da máquina quando o provedor é de nuvem.

Não é uma ferramenta de BI. Um gráfico pode aparecer no meio de uma conversa, para você entender um resultado que já está na tela; painel, relatório e atualização automática ficam fora — pelo mesmo teste que decide toda fronteira nova, descrito a seguir.

---

## O teste que separa pilar de produto novo

Um chat multiuso corre um risco que uma ferramenta de um pilar só não corre: toda ideia parece caber, porque "está dentro da mesma conversa" é critério fraco demais para recusar coisa nenhuma. A régua precisa ser mecânica, não de gosto — e são **duas**, porque há dois tipos de capacidade.

**A primeira governa tudo que produz ou consome conteúdo do usuário:**

> **Uma capacidade é pilar do crivo enquanto viver dentro da conversa** — como ação executada, contexto consumido, ou um dos artefatos que o app já sabe persistir (mensagem, receita, dado tratado e exportado). **No instante em que ela precisar de estado próprio, gerido fora da conversa** — layout salvo, arquivo reexportado — **ela virou outro produto.**

É o teste que responde "salvar o PDF anotado" e "painel com filtros cruzados": os dois pedem um artefato que sobrevive fora da conversa e uma tela própria para gerenciá-lo.

**A segunda governa o que o aplicativo faz sobre si mesmo.** O observatório — os painéis em que o app se descreve: memória e processos, canais e jobs, os dois motores, uso de disco, fluxo de eventos, desempenho por modelo e o livro-razão do que saiu da máquina — **não passa no teste acima, e não deveria**: nada ali vive dentro de uma conversa, tem tela própria e grava estado que sobrevive a todas elas. Não é exceção aberta ao primeiro teste; é outra categoria, com fronteira própria e igualmente mecânica:

> **Instrumentação é pilar enquanto observar o próprio aplicativo, nunca o dado do usuário** — (i) lendo o que o app já faz, (ii) gravando apenas sobre si mesma, em armazenamento separado do da conversa, e (iii) sem produzir artefato que saia do app. **No instante em que virar relatório exportável ou painel configurável, cai de volta no primeiro teste** — e virou outro produto.

O que faz as duas conviverem é o limite do que cada uma grava: instrumentação registra o que o **aplicativo** fez — nunca o conteúdo do que o usuário digitou, anexou ou recebeu. É por isso que ela mede um envio de nuvem sem guardar o que foi enviado.

Eixos, inventário e o critério de qual armazenamento recebe o quê: [`reference/observatory/`](reference/observatory/README.md).

O caso que mais exercita os dois testes ao mesmo tempo é o **projeto** — agrupar conversas sob contexto comum. Ele passa em parte e é recusado em parte, e por isso tem [seção própria](#projeto-agrupar-conversas).

---

## Duas classes de arquivo, e a linha entre elas

O aplicativo abre duas coisas muito diferentes, e confundi-las corrompe os dois verbos abaixo — que só valem para dado tabular, nunca para documento.

| | **Dado tabular** | **Documento** |
|---|---|---|
| Formatos | CSV, JSON/NDJSON, Excel · ⌛ Parquet | `.txt`, `.md`, `.pdf` com texto · `.png`, `.jpeg`, `.svg`, `.webp` · ⌛ código-fonte |
| Relação | *perguntar* e *tratar* — os dois verbos abaixo | **ler como contexto**, e nada mais |
| Motor | DuckDB | nenhum: vai direto ao modelo |
| Produz | consulta, passos, receita, resultado, gráfico | texto no contexto da conversa |
| Vira arquivo de saída? | sim — é o ponto do aplicativo | **nunca** |
| Exposição ao modelo | três níveis, o terceiro opt-in | sempre integral — ver adiante |

⌛ **é formato admitido pelo escopo cujo caminho ainda não existe na interface** — o seletor de arquivo não o oferece. A marca vale em toda tabela de formato deste documento, e existe porque "admitido" e "disponível" leem igual numa tabela: sem ela, o documento promete. O que falta em cada caso está em [`ROADMAP § 4`](ROADMAP.md#4-pendências-pontuais).

Ninguém deduplica um PNG por CPF. **Os dois verbos valem para dado tabular**; documento tem uma terceira relação, mais fraca: material de contexto, que entra na conversa para ser lido e sai dela sem virar arquivo.

**Por que está no escopo:** são os arquivos com que se trabalha diariamente, e a pergunta real quase nunca é só sobre o CSV — é sobre o CSV **e** a especificação que diz o que cada coluna deveria conter. Manter as duas coisas em duas ferramentas é exatamente o atrito que este aplicativo existe para remover.

**O que isto não autoriza:** editar, anotar, converter ou exportar documento. Um `.pdf` entra e não sai; um `.png` entra e não sai. No dia em que "salvar o PDF anotado" for pedido, a resposta é que isso é outro produto — pelo [teste que separa pilar de produto novo](#o-teste-que-separa-pilar-de-produto-novo), o mesmo que já recusa o painel de BI.

---

## Os dois verbos

Toda pergunta dirigida a um arquivo **de dado tabular** cai em um de dois verbos, e eles pedem respostas de **formatos diferentes**. Confundi-los é a origem da maior parte do que dá errado numa ferramenta assim.

| | **Perguntar** | **Tratar** |
|---|---|---|
| Exemplo | *"qual a média de idade por cidade?"* | *"tira os duplicados por CPF"* |
| Resposta certa | uma consulta SQL | uma lista de passos |
| Vida útil | consumida uma vez | vira **receita**, reaplicada a outro arquivo |
| O que o usuário revisa | uma frase e o SQL, antes de executar | os passos, que continuam editáveis depois |

O aplicativo produz os dois, e **o roteamento entre eles é decisão do modelo, validada pelo app**: uma proposta é uma união discriminada (`kind: 'query'` ou `kind: 'steps'`), nunca texto livre a interpretar.

> 🔍 **A pergunta que parece de consulta mas é de tratamento.** *"Liste os tipos de produto e sua quantidade"* sobre um arquivo em que `quantidade` mistura `2`, `3` e `"dois"` **não tem resposta em SQL** — antes de agrupar é preciso converter a coluna, e isso é um passo. Uma consulta única não consegue dizer "aliás, esta coluna precisa de limpeza"; ela devolve uma tabela vazia, sem erro nenhum. É o modo de falha mais caro da ferramenta, e o motivo de os dois verbos existirem separados. A anatomia do caso está no [`ARMADILHAS.md`](ARMADILHAS.md).

---

## O modelo mental do verbo *tratar*: pipeline de passos

A composição de uma transformação vive numa **lista ordenada de operações**, não numa consulta única.

```
dataset.csv
  │
  ├─ 1. remover colunas vazias
  ├─ 2. renomear "dt_nasc" → "data_nascimento"
  ├─ 3. converter "data_nascimento" para data (formato dd/MM/yyyy)
  ├─ 4. filtrar: idade >= 18
  ├─ 5. preencher "cidade" ausente com "não informado"
  └─ 6. deduplicar por "cpf"
        │
        └─► exportar
```

Quatro propriedades decorrem dessa escolha, e são elas que a justificam:

**Desfazer é remover um passo.** Não há histórico de diffs a manter, nem estado mutável a reverter. O dataset de entrada nunca muda; o resultado é sempre recomputado a partir dele.

**Cada passo é inspecionável.** Dá para ver o que entrou e o que saiu de cada operação — que é justamente o que uma consulta SQL de trinta linhas não permite.

**A sequência é reaplicável.** A lista de passos é uma **receita**: salva, nomeada, e aplicável a outro arquivo com o mesmo formato. É o que transforma limpeza manual em processo repetível, e é o maior retorno do modelo.

**Compila para SQL.** Os passos não executam nada por conta própria — eles geram uma consulta do DuckDB. O motor faz o trabalho pesado; o pipeline é apenas uma forma tipada e editável de escrever SQL.

> 🔍 Existe um tipo de passo **"SQL cru"**, que recebe uma consulta escrita à mão e a encadeia como qualquer outro. É a escotilha para o que o catálogo não cobre. Sem ela, toda operação incomum viraria pedido de feature; com ela, o catálogo pode crescer devagar e por demanda real.

**Descartado:** SQL-first como modelo **único**. Para *tratar* o dado — iterativo, tentativa e erro, com o resultado de um passo mudando o que se quer no seguinte — a consulta única é o formato errado: desfazer vira edição de texto, e não há como reaplicar "a mesma limpeza" a outro arquivo sem copiar SQL na mão. O que mudou desde a primeira versão deste documento é que SQL deixou de ser *descartado* e passou a ser *o outro verbo*: ele responde bem quando a pergunta é perguntar.

**Descartado:** grade editável célula a célula. Exigiria estado mutável do dataset, desfazer por diff, e escrita através da camada de virtualização. É outro produto, muito mais caro, e mal servido por um motor colunar.

---

## A conversa é a interface

Uma mensagem não é só texto em markdown. Ela carrega **artefatos** — blocos tipados e recolhíveis, abertos quando o usuário quiser:

| Artefato | Nasce de | Ação que oferece |
|---|---|---|
| pré-visualização | anexar um arquivo de dado tabular | — |
| cartão de dados | avaliação do arquivo pela IA | indexar para busca |
| **documento** | anexar `.txt`, `.md` ou `.pdf` | — |
| **imagem** | anexar ou colar uma imagem | — |
| proposta de consulta | pergunta que virou SQL | executar |
| proposta de passos | pedido que virou tratamento | executar · salvar como receita |
| resultado | execução de uma proposta | plotar |
| gráfico | um resultado agregado | — |
| **exportação** | resposta do modelo, sob pedido explícito | baixar · salvar em disco |

Isso substitui as abas fixas de uma bancada tradicional: o artefato é um bloco **preso à mensagem** em que nasceu, e some da vista junto com ela. Onde ele **mora** e onde ele é **olhado**, porém, são coisas diferentes: um artefato pode ser aberto num painel lateral efêmero, que nasce de um clique, não persiste e morre ao trocar de conversa (DF3A.1, plano F-3-A). O painel é uma lente, não um destino — vale para ele o mesmo teste do gráfico: **se precisasse de estado próprio que sobrevivesse à conversa, teria virado aba fixa, e aba fixa continua fora.**

Três regras decorrem, e as três existem para o aplicativo não engordar em silêncio:

> **A conversa guarda a pergunta, a proposta e o veredito — nunca o resultado.** Resultado é rederivável a partir do arquivo e pode ser enorme. Dele guarda-se apenas o resumo: contagem de linhas, duração, nomes de coluna e os avisos de sanidade.

> **O anexo é guardado por conteúdo, não por caminho.** O arquivo é copiado para `userData/attachments/<hash>` e a conversa guarda a referência. Ao contrário do resultado, os bytes de um PDF **não** são rederiváveis — o arquivo original pode ter sido movido, renomeado ou apagado —, então guardar o caminho seria guardar uma promessa. Guardar por hash traz dois efeitos de graça: o mesmo arquivo anexado duas vezes ocupa espaço uma vez, e excluir uma conversa precisa conferir se outro anexo ainda aponta para aquele hash.

> **Resultado passa por verificação antes de virar resposta.** Coluna inteiramente nula, zero linhas, conversão que anulou tudo — cada um vira **aviso visível**, nunca uma tabela apresentada como se estivesse certa. SQL válido que executa sem erro e devolve a resposta errada é o modo de falha que o usuário não tem como detectar sozinho.

---

## Projeto: agrupar conversas

**No escopo, ainda não construído.** Um projeto reúne várias conversas sob um contexto comum: um nome, um prompt de sistema próprio, e um conjunto de documentos que vale para todas as conversas dele.

Pelo [primeiro teste](#o-teste-que-separa-pilar-de-produto-novo), isso cai inteiro do lado permitido — prompt de sistema e documento anexado são *contexto consumido*, e conversa é artefato que o aplicativo já sabe persistir. O projeto não inventa um objeto novo; ele **escopa** os que já existem.

O que fica de fora é a **gerência do índice** como superfície: biblioteca de documentos com estado de reindexação, escolha de embedder, painel de índice. Aí o objeto deixa de ser contexto e vira coisa a administrar, com tela própria — o outro lado do mesmo teste.

> ⚠️ **Projeto não implica busca semântica.** As duas nascem juntas em outras ferramentas, e isso faz parecer que uma exige a outra. Enquanto os documentos de um projeto couberem no [teto por documento](#o-teto-do-documento-é-tempo-não-tamanho), mandá-los inteiros é **melhor** que recuperar trechos: o trecho recuperado muda a cada pergunta e descarta o cache de prefixo, enquanto o documento inteiro paga uma vez. A busca semântica entra pelo gatilho que ela já tem — o documento que estoura aquele teto —, e esse gatilho vale igual para conversa avulsa.

**Aprendizado sobre o dado (agrupar, detectar anomalia, imputar) não pertence aqui**, e sim ao pilar de dados: ele opera sobre dataset, não sobre conversa. Estado e ordem das três frentes: [`ROADMAP § 1`](ROADMAP.md#1-a-sequência); o levantamento que decompõe custo e alternativas, em [`reference/projetos-e-rag-por-projeto/README.md`](reference/projetos-e-rag-por-projeto/README.md).

---

## O que a IA vê do seu dado

O modelo precisa saber o bastante para ser útil e o mínimo para ser seguro. São **três níveis**, e o do meio carrega quase todo o valor:

| Nível | O que vai ao modelo | Insight que habilita | Exposição |
|---|---|---|---|
| **1 — esquema** | nomes e tipos de coluna | *"não há coluna de data"* | nenhuma |
| **2 — perfil agregado** | mín/máx/média, % de nulos, cardinalidade, top-N | *"`idade` tem 12% de nulos e máximo 999 — sentinela de ausente"* | quase nenhuma |
| **3 — amostra de linhas** | as primeiras N linhas cruas | *"o CPF aparece com e sem máscara"* | total |

O nível 2 é o `SUMMARIZE` do DuckDB, e é o que produz uma avaliação de qualidade digna do nome. As regras:

- **Top-N só para coluna de baixa cardinalidade.** Os cinco valores mais frequentes de `cidade` são estatística; os cinco mais frequentes de `cpf` são vazamento com outro nome. O limiar é relativo à contagem de linhas, e a decisão mora em `core/`, nunca ao lado de um chamador — ver [`ARMADILHAS.md`](ARMADILHAS.md).
- **O nível 3 é opt-in por anexo, em qualquer provedor.** Local (Ollama, na sua máquina) libera a um clique; nuvem pede o mesmo opt-in, sem bloqueio adicional — quem decide o que sai da máquina, anexo por anexo, é o usuário.
- **Um cartão de dados só**, produzido num lugar e consumido por todos os caminhos — conversa, consulta, passos, busca. Contexto montado por feature é como se produzem duas qualidades de resposta sobre o mesmo arquivo.

### Documento e imagem são nível 3 por construção

Os três níveis funcionam porque dado tabular **pode ser agregado**: existe uma descrição do arquivo que é útil e não expõe valor nenhum. Documento e imagem não têm esse meio-termo — não existe "perfil agregado" de um `.md`, e ou o modelo vê os pixels ou não vê.

Logo, **todo anexo de documento ou imagem herda a regra do nível 3**: opt-in explícito, em qualquer provedor — local ou nuvem, sem distinção. Nenhum mecanismo novo — a mesma porta.

---

## A administração do modelo é parte do produto

Um aplicativo que apenas encaminha texto a um modelo deixa quatro decisões para o acaso: qual modelo responde, quanto de contexto ele reserva, o que ele é capaz de receber, e o que sai da máquina. Aqui as quatro são do produto, e visíveis.

> **O aplicativo nunca deixa o modelo decidir em silêncio o que descartar.** Ele mede antes, recusa antes, e mostra o custo.

Numa máquina cujo limite é a RAM, isso não é refinamento: um `num_ctx` que não comporta o prompt não produz erro — o provedor descarta o começo da conversa e responde normalmente, sobre um contexto que perdeu metade. Medir e recusar é o que separa um resultado errado de um resultado errado **e invisível**.

| Decisão | O que o aplicativo faz |
|---|---|
| **Qual modelo responde** | escolhido por mensagem, entre os instalados na máquina e os de nuvem que o usuário habilitou. Provedor de nuvem só existe depois que uma chave é gravada |
| **Quanto de contexto** | a janela é escolhida por conversa e **trava no primeiro envio**, junto do modelo. Antes disso deriva livremente do que a máquina comporta |
| **O que o modelo pode receber** | anexo só vai a modelo que declare a capacidade correspondente — ver o gate, abaixo |
| **Quanto já foi gasto** | o medidor da conversa se calibra pela contagem real que cada resposta devolve, e o envio é recusado quando não cabe |
| **O que sai da máquina** | os [três níveis](#o-que-a-ia-vê-do-seu-dado), opt-in por anexo, em qualquer provedor |

**A janela trava porque encolher em silêncio é o modo de falha pior.** Uma reserva feita com a máquina ociosa pode não caber quando ela não estiver mais — e nesse caso a conversa recusa em vez de reduzir por conta própria. O mesmo vale ao trocar de modelo: um histórico que cabia no teto de um não cabe no de outro.

**Um modelo residente é recurso da máquina, não detalhe de implementação.** Ele ocupa RAM na ordem de gigabytes, e dois residentes ao mesmo tempo é troca de disco, não lentidão. Ao trocar de modelo, o aplicativo descarrega o anterior antes de chamar o novo; o estado fica visível, com o que está carregado e por quanto tempo ainda.

Como cada número é calculado — cache KV por token, margem, faixas de janela, contagem de tokens — é da skill [`ai`](../.claude/skills/ai/SKILL.md); o custo de cada modelo, de [`reference/models/`](reference/models/README.md).

### O gate de capacidade é correção, não cortesia

Um anexo só é enviado a um modelo que declare a capacidade correspondente — `vision`, no caso de imagem. Quando o modelo selecionado não declara, o aplicativo **recusa o envio**: não manda sem a imagem, não avisa depois.

O motivo não é elegância de interface. Sem receber a imagem, o modelo responde assim mesmo — descreve um gráfico inteiro, com números plausíveis e nenhuma hesitação, sobre um arquivo que nunca viu. É a mesma classe da [falha silenciosa do NL→SQL](HISTORY.md): num caminho gerado por modelo, o perigo não é a exceção, é o sucesso. Anexo que falha em silêncio não produz erro — produz resposta convincente sobre um arquivo inexistente.

De onde vem cada capacidade, e por que a fonte intuitiva é a errada: skill [`ai`](../.claude/skills/ai/SKILL.md).

### Raciocínio é do produto, não do provedor

Quando o modelo expõe o próprio raciocínio, ele aparece **separado da resposta final**, alternável por turno, e persiste com a mensagem. É capacidade de modelo como `vision`: quem não a tem responde sem ela, sem que nada quebre.

---

## Ferramentas do chat

Duas capacidades trazem para dentro da conversa algo que estava fora dela — busca web e documentação —, propostas em [`reference/web-fetch-mcp-thinking/README.md`](reference/web-fetch-mcp-thinking/README.md). Cada uma é pilar próprio pelo [primeiro teste](#o-teste-que-separa-pilar-de-produto-novo): vive inteira dentro da conversa, sem estado que sobreviva a ela. Raciocínio visível **não** é ferramenta — é capacidade do modelo, e tem [seção própria](#raciocínio-é-do-produto-não-do-provedor).

| | Faz | Não faz |
|---|---|---|
| **Busca web** | uma URL vira contexto da resposta: o app busca e extrai o texto principal | Não indexa, não vira dataset — não passa pelo DuckDB — e não vira arquivo de saída, mesma regra do documento anexado |
| **Documentação (MCP)** | um servidor remoto nomeado — **Context7** — para consulta de biblioteca/framework | Não é suporte a MCP em geral; ligar outro servidor é decisão nova, não implícita nesta |

**Como a ferramenta é acionada é decisão do plano que a construir, não premissa deste documento.** São três caminhos possíveis, com fronteiras de privacidade diferentes: o modelo pedir, por *tool calling* (exige `tools`); o usuário fornecer o endereço (não exige capacidade nenhuma); ou o provedor de nuvem resolver por conta própria. Nenhum é o caminho canônico — e o precedente que desautoriza presumir um deles é o raciocínio visível, que está entregue e **não** chegou por *tool calling* em provedor nenhum.

⚠️ **A capacidade exigida limita quais modelos servem à conversa.** *Tool calling* pede `tools`; anexo de imagem pede `vision`. Quando o modelo escolhido não junta as duas, usar a ferramenta e anexar imagem são caminhos exclusivos naquela conversa — trocar de modelo resolve, ao custo do descarregamento. Quais modelos juntam o quê: [`reference/models/`](reference/models/README.md).

### A URL escolhida pelo modelo não é a URL clicada pelo usuário

Toda saída à rede passa por um **ponto único** de validação, nunca por um segundo caminho — e esse ponto precisa distinguir quem escolheu o endereço. Para um link que o usuário clica, conferir o esquema (`http:`/`https:`) basta. Para **uma URL que o modelo produziu, é preciso recusar também *loopback* e faixas privadas**: sem isso, texto gerado alcança serviço que só existe dentro da máquina — coisa que abrir link no navegador do sistema nunca pôde fazer.

Sequência e planos: [`ROADMAP § 1`](ROADMAP.md#1-a-sequência).

---

## Catálogo de operações

Em três camadas, por ordem de implementação. A camada 1 é o que faz o app ser útil; as outras entram por demanda. É também o **alvo de validação** da proposta de passos: o que o modelo devolve é conferido contra este catálogo, não contra uma expectativa de texto.

### Camada 1 — o essencial

| Grupo | Operações |
|---|---|
| **Estrutura** | selecionar colunas · remover colunas · renomear · reordenar |
| **Linhas** | filtrar por condição · ordenar · limitar · deduplicar |
| **Tipos** | inferir · converter texto→número · converter texto→data (com formato) · definir separador decimal |
| **Texto** | aparar espaços · maiúsculas/minúsculas · substituir · normalizar espaços internos |
| **Ausentes** | preencher com constante · remover linhas com ausente · contar ausentes por coluna |
| **Escotilha** | passo de SQL cru |

### Camada 2 — o que aparece logo em seguida

| Grupo | Operações |
|---|---|
| **Estrutura** | dividir coluna por separador · concatenar colunas · coluna derivada por expressão |
| **Texto** | remover acentos · extrair por expressão regular · preencher à esquerda (zeros de CPF, CEP) |
| **Ausentes** | preencher com média/mediana · preencher com o valor anterior |
| **Numérico** | arredondar · normalizar (min-max, z-score) · discretizar em faixas |
| **Agregação** | agrupar e agregar |

### Camada 3 — depende de haver demanda

Juntar dois datasets (*join*) · empilhar (*union*) · pivotar e despivotar · detectar *outliers* · validar contra regras (coluna obrigatória, faixa, formato).

> ⚠️ Esta lista é **catálogo, não cronograma**. A regra do projeto continua sendo uma variável por vez: cada operação nasce com seu teste de nível 1 e seu passo na interface. Vinte operações medíocres valem menos que cinco em que se confia.

---

## Formatos

### Dado tabular — entrada **e** saída

Todos os quatro são os dois. Três deles são quase de graça; um não é.

| Formato | Leitura | Escrita | Observação |
|---|---|---|---|
| **CSV / TSV / delimitados** | nativa no DuckDB | nativa | O caso base e o mais bagunçado do mundo real |
| ⌛ **Parquet** | nativa | nativa | Colunar, tipado, comprimido — a saída natural do app. O motor lê e escreve; falta o formato no seletor de arquivo |
| **JSON / NDJSON** | nativa | nativa | NDJSON é direto; JSON aninhado é **recusado**, com o nome da coluna (18-E, D18E.4) — o motor relacional exige linha/coluna, então não há achatamento automático |
| **Excel (`.xlsx`)** | extensão `excel` do DuckDB, ou biblioteca à parte | idem | **Assimétrico — ver abaixo** |

### Documento — entrada apenas

A coluna "Escrita" não está vazia por adiamento: documento **nunca** é saída, pela regra da seção [Duas classes de arquivo](#duas-classes-de-arquivo-e-a-linha-entre-elas).

| Formato | Leitura | Escrita | Observação |
|---|---|---|---|
| **`.txt`, `.md`** | direta | — | detecção de encoding como no CSV; cp1252 é comum no Windows brasileiro |
| ⌛ **código-fonte** (`.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, `.c`/`.cpp`, `.rb`, `.php`, `.sql`, `.sh`, `.css`, `.html`, `.yaml`, `.toml`, entre outras — texto puro) | direta, mesmo extrator de `.txt` | — | extensão compilada/binária (`.class`, `.pyc`, `.o`, ...) fica fora; o modelo identifica a linguagem pelo próprio conteúdo, sem tag exigida. O extrator já serve; falta o seletor aceitar as extensões |
| ⌛ **`.json`, `.ndjson`, `.jsonl` como código/config** (`package.json`, `tsconfig.json`, *fixture* de API, log estruturado) | direta, mesmo extrator de `.txt` | — | entra junto do código-fonte, pelo mesmo seletor. JSON neste papel **costuma vir aninhado, com frequência em vários níveis em sequência** — e isso não é problema aqui: o pilar documento nunca interpreta estrutura, só entrega texto cru ao modelo. É o oposto do JSON como *dataset* (tabela acima): lá o aninhamento é recusado (18-E, D18E.4) porque o motor relacional exige linha/coluna; aqui não existe motor nenhum, então não existe restrição. A escolha de caminho é o botão de anexo que o usuário clica (dataset vs. documento), não uma sondagem de conteúdo |
| **`.pdf` com camada de texto** | `unpdf` | — | zero dependências, sem módulo nativo |
| **`.pdf` escaneado** | **recusado** | — | sem texto selecionável — ver [Fora do escopo](#fora-do-escopo) |
| **`.png`, `.jpeg`** | direta ao modelo | — | exige modelo que declare `vision` |
| **`.svg`** | rasterizado para PNG | — | o `nativeImage` do Electron **não** decodifica SVG; o Chromium sim |
| **`.webp`** | convertido para PNG | — | o Ollama rejeita o container VP8X, que é o que o Chromium produz |

**Documento também nasce colado, sem arquivo em disco.** Um modal simples — linhas numeradas, indentação preservada, sem realce de sintaxe obrigatório — deixa colar um trecho (mais comumente código) e anexá-lo como o mesmo `MessagePart` de documento. É uma segunda origem, não um mecanismo novo: mesma regra de nível 3, mesmo "nunca vira arquivo de saída". Identificar a linguagem para realce é opcional e não bloqueia o envio — o modelo lê o conteúdo cru e infere a linguagem como um humano faria; falta de destaque visual é custo de interface, não de compreensão. Escolher o modelo continua manual, como hoje — colar código não troca de modelo sozinho.

⚠️ **Código tende a ser mais denso em tokens que prosa** — indentação e símbolos repetidos custam tokens que os `~3,7 caracteres/token` do português (medidos abaixo) não medem. O teto de ~8k tokens por documento vale para prosa; para código, medir separadamente quando o mecanismo de anexo colado ganhar plano — não presumir igual.

> **Tudo que não é PNG ou JPEG é normalizado para PNG num ponto só, antes de sair do aplicativo.** SVG rasterizado, WebP convertido, e a decisão de qual caminho tomar mora em `core/`. Espalhar essa conversão pelos chamadores repetiria a falha já registrada em [`HISTORY.md`](HISTORY.md) para a lista branca de esquemas: **validação que mora junto de um chamador vira bypass no segundo**.

### CSV é onde mora a sujeira

Delimitado é o formato mais simples e o que mais dá trabalho, porque não tem esquema. O app precisa lidar com:

separador ambíguo (vírgula, ponto e vírgula, tabulação) · encoding que não é UTF-8 (cp1252 é o padrão do Excel brasileiro) · BOM no início do arquivo · cabeçalho que não está na primeira linha · linhas com contagem de campos diferente · aspas mal fechadas · decimal com vírgula.

Cada um desses é uma decisão de interface, não só de parsing: o usuário precisa **ver** o que foi detectado e poder corrigir. É por isso que a fase 06 do plano de fundação existe — [`open-dataset`](plan/implemented/06-primeira-feature.md) já ataca detecção de separador e cabeçalho.

### Excel tem teto próprio

Registrado aqui porque vai surpreender quem esperar simetria com os outros três.

`.xlsx` é XML dentro de um zip: não é possível ler uma faixa sem descomprimir e parsear o conjunto. Regra prática: **5 a 10× o tamanho do arquivo em memória**. Um `.xlsx` de 100 MB pede cerca de 1 GB.

Somado ao limite do próprio formato — 1.048.576 linhas por planilha — o Excel tem um teto muito abaixo dos outros três, e ele é do formato, não do app.

E traz um mundo próprio de decisões que os outros não têm: múltiplas planilhas (qual abrir?), células mescladas, tipo por célula em vez de por coluna, fórmulas (valor ou expressão?), datas como número serial, e a diferença entre o que está armazenado e o que está formatado na tela.

**"Data como número serial" é o caso particular de uma regra mais ampla: célula é tipada pela formatação, não pelo valor.** Uma coluna de números inteiros sem formatação de "inteiro" no Excel de origem (o comum: a formatação padrão "Geral") lê como `DOUBLE`, não `BIGINT` — o motor não tem como saber que `1`, `2`, `3` deveriam ser inteiros só olhando o valor. Não é defeito do app: `DOUBLE` já é o tipo que qualquer CSV com coluna decimal produz, e o resto do caminho (perfil, pré-visualização, consulta) não distingue a origem. É dado de entrada ambíguo, mesma classe da data sem formatação — ver [`plan/implemented/18-F-excel.md`](plan/implemented/18-F-excel.md) § passo 5.

**Decisão:** Excel entra no escopo, e entra por último entre os quatro. Ao chegar, começa pelo caminho simples — uma planilha, primeira linha como cabeçalho, valores calculados — com o resto explicitamente adiado.

---

## Escala

| | |
|---|---|
| **Alvo de projeto** | ~2 GB por arquivo |
| **Acima disso** | deve funcionar mais devagar, nunca quebrar |
| **Excel** | teto próprio, muito menor (ver acima) |

O gargalo não é o DuckDB, que faz *out-of-core* nativamente e derrama para disco. É o **lado JavaScript**: o heap do V8 fica na casa de 2 a 4 GB, e é ali que se bate primeiro.

Daí a regra que vale sempre, independentemente do tamanho do arquivo:

> **Nenhuma etapa materializa o resultado completo em JavaScript.** Toda pré-visualização é página ou amostra; toda exportação é feita pelo DuckDB direto para o arquivo de saída, sem passar pelo processo do Node.

Adotada desde o início, ela custa zero e o teto passa a ser o disco. Retrofitada depois, é reescrever todo caminho de dados. É também a resposta para o custo da pré-visualização na conversa: ela é sempre uma página, tenha o arquivo 15 linhas ou 2 GB.

**Configuração decorrente:** o teto de memória do motor é fixado explicitamente — não o padrão de 80% da RAM, que brigaria com o Chromium do próprio app —, e o derramamento tem pasta própria em `userData`. O valor se remede contra a máquina, nunca se copia de um documento para outro: skill [`data`](../.claude/skills/data/SKILL.md).

### O teto do documento é tempo, não tamanho

Dado tabular tem teto de bytes; documento tem teto de **segundos de prefill**, e ele é muito mais baixo. Contra modelo local numa CPU sem aceleração:

| | |
|---|---|
| prefill de texto | **25–29 tokens/s** |
| português | **3,7 caracteres por token** (pior que o ~4,0 do inglês) |
| uma imagem | **+270 tokens e ~80 s**, quaisquer que sejam as dimensões |
| turnos seguintes, mesmo anexo | **~3 s** — o prefixo fica em cache |

Três consequências de produto, e a primeira dá a forma da interface:

**Anexar é um job, não uma escolha de arquivo.** O custo é pago uma vez, é grande, e por isso precisa de progresso e cancelamento — a mesma forma do `dataset:scan` da [fase 06](plan/implemented/06-primeira-feature.md), com a mesma infraestrutura.

**Reduzir a imagem não economiza tempo.** O Gemma 3 redimensiona tudo para 896×896 antes do encoder de visão; 280×161 custou o mesmo que 800×460. Reduzir economiza disco e RAM, nunca segundos.

**O teto prático de um documento é ~8k tokens, cerca de 30 kB de português.** Acima disso o prefill passa de cinco minutos e não é tolerável nem uma vez — e é aí que RAG deixa de ser otimização e vira a única opção. Abaixo disso, RAG **perde**: os trechos recuperados mudam a cada pergunta, o que descarta o cache de prefixo e paga tokens novos para sempre, enquanto o documento inteiro paga uma vez. Gatilho em [`ROADMAP § 2`](ROADMAP.md).

---

## Escrita e segurança do dado

O app **pode** sobrescrever o arquivo de origem, mediante confirmação explícita. A exportação para arquivo novo é o caminho padrão; sobrescrever é uma escolha consciente do usuário.

Isso não é gratuito, e as três consequências ficam registradas agora:

**Escrita atômica, sempre.** Grava em arquivo temporário no mesmo volume e só então renomeia sobre o original. ⚠️ **No Windows o rename não é atômico** e falha quando o destino está travado — inclusive por trava passageira do antivírus ou do indexador. A garantia que **sobra** é a que importa: o destino fica intacto quando algo falha no meio. Exige repetição e limpeza do temporário ([`E-1-D`](plan/implemented/E-1-D-o-caminho-de-saida.md) § DE1D.2). Escrita direta que falha na metade — falta de espaço, queda de energia, cancelamento — destrói o dado de entrada, e não há desfazer.

**Arquivo aberto em outro programa.** No Windows, um `.xlsx` aberto no Excel tem bloqueio exclusivo, e o rename falha com `WinError 32`. É o mesmo tipo de armadilha que o mill.tools já documenta para o `.temp` do yt-dlp. Precisa de erro claro — "feche o arquivo no Excel" — e não de uma falha genérica.

**Confirmação que mostra o que muda.** Antes de sobrescrever: quantas linhas entram e saem, e quais colunas desaparecem. Uma confirmação de "tem certeza?" sem números não informa nada.

**SQL gerado por modelo roda com o motor restringido, não com o texto inspecionado.** O DuckDB é configurado com `allowed_directories`, `enable_external_access = false`, `autoinstall_known_extensions = false` e `lock_configuration = true` antes de qualquer consulta gerada. A garantia é do motor; uma expressão regular tentando adivinhar intenção em SQL não é defesa. **A ordem entre esses `SET` não é livre** — `allowed_directories` e `temp_directory` têm que ser setados antes de `enable_external_access = false`, ou o próprio DuckDB rejeita mudá-los depois; `lock_configuration` continua por último. Verificado ao vivo no plano 18-A, detalhe em [`HISTORY.md`](HISTORY.md).

---

## Exportação da resposta como arquivo

Diferente do documento **anexado** — que só entra como contexto e nunca produz saída (ver [Duas classes de arquivo](#duas-classes-de-arquivo-e-a-linha-entre-elas)) —, a **resposta do modelo**, sob pedido explícito do usuário, pode virar um arquivo novo. São objetos diferentes: um é o material que o usuário trouxe para dentro da conversa; o outro é o que a conversa produziu. Confundi-los é o erro que esta seção existe para prevenir.

**Por que isto é pilar, não produto novo.** O teste da seção acima já admite *"dado tratado e exportado"* como artefato que sobrevive fora da conversa sem precisar de estado próprio — mesma categoria de um `.parquet` exportado pelo verbo *tratar*. Um `.docx` salvo no disco do usuário não pede tela de gerência dentro do app.

**Por que o veto antigo não alcança isto.** A recusa a "exportar documento" (revisão anterior) tinha um motivo específico, registrado no [`ROADMAP § 2`](ROADMAP.md): *"a trava não é o modelo, é escrita em caminho arbitrário escolhida por ele"*. Aqui **duas** decisões são exclusivas do usuário, nunca do modelo: o **caminho**, sempre via `dialog.showSaveDialog`, e o **formato** (`.txt`/`.md`/`.pdf`/`.docx`), escolhido no momento em que o usuário pede a exportação — nunca uma sugestão do modelo que se concretiza sozinha. O modelo produz o conteúdo da resposta; exportar, e em qual formato, é ação do usuário, do mesmo jeito que executar uma proposta de consulta já é. O motivo registrado já está satisfeito por construção, então não é uma exceção ao veto: é fora do alcance dele.

| Formato | Como se gera | Observação |
|---|---|---|
| `.md` | texto que o modelo já produziu, salvo direto | sem biblioteca — não é motor, é `writeFile` |
| `.txt` | o texto sem a marcação | **não** é `replace` de símbolo, nem serialização de volta ao markdown: sai do **mesmo mapeamento que o `.docx`**, o que mantém os dois formatos consistentes por construção e impede que código exportado saia escapado (E-1-E) |
| `.pdf` | **`webContents.printToPDF`**, sem dependência | ⚠️ `pdf-lib` foi **descartado no E-1-F** exatamente pelo motivo que esta linha registrava: desenha texto em coordenadas, **sem paginação automática de prosa longa** — e resposta de modelo é isso. O Chromium que já está no app pagina de graça |
| `.docx` | `docx` (dolanmiu) | API declarativa por parágrafo, Node puro, sem módulo nativo |
| a extensão da linguagem (`.py`, `.sql`, …) | bytes escritos como estão | **Só para bloco de código** (trilha E-2). Os quatro formatos acima passam por um mapeamento que lê o texto como markdown — e markdown junta linhas consecutivas e trata quatro espaços como bloco aninhado, o que **destrói código**. Por isso um trecho de código não escolhe formato: sai verbatim, com a extensão que a linguagem pede ou `.txt` quando a cerca não a nomeou |

⌛ `.pptx` está no escopo e vem **depois do gráfico**, que é quem produz a imagem que um deck precisa carregar; layout em slide pede ainda um esquema de deck e uma decisão própria sobre catálogo de template. `.odp` e `.ppt` ficam fora do escopo, registrado abaixo.

**O objeto exportado pode ser a resposta inteira ou um bloco dela.** Desde a trilha E-2, um bloco de código da resposta vira rascunho pelo botão no cabeçalho do próprio bloco. Isso **não** alarga o veto de [exportar o documento anexado](#o-que-o-app-não-faz): o que sai continua sendo saída do modelo, nunca o que entrou como contexto — e as duas decisões exclusivas do usuário (caminho e formato) seguem intactas.

**Herda, não reinventa.** As regras de [Escrita e segurança do dado](#escrita-e-segurança-do-dado) que fazem sentido aqui se aplicam sem mudança: escrita atômica (arquivo temporário + rename) e o erro claro de arquivo aberto em outro programa (`WinError 32`). **Não herda** a confirmação de "o que muda" — não há versão anterior para comparar; é sempre arquivo novo, nunca sobrescrita.

---

## Fora do escopo

Registrado explicitamente para não ser confundido com "ainda não":

- **Painel e BI** — vários gráficos, layout salvo, atualização automática, filtros cruzados, relatório exportável. **Um** gráfico como artefato de uma mensagem está dentro (ver abaixo); o resto é outra ferramenta.
- **Edição célula a célula** — decisão de modelo, justificada acima.
- **Banco de dados remoto** — Postgres, MySQL, APIs. O app é local e trabalha sobre arquivos.
- **Execução agendada / ETL sem interface** — receitas são reaplicáveis pela interface, não por linha de comando ou agendador.
- **Colaboração e multiusuário** — aplicativo de uma pessoa, uma máquina.
- **Versionamento de dados** — sem histórico de versões do dataset.
- **PDF escaneado e OCR** — PDF sem camada de texto é recusado, com o motivo dito na tela ("este PDF não tem texto selecionável"). Rasterizar e passar por visão custaria ~80 s **por página** e traria um módulo nativo (`@napi-rs/canvas`) para dentro do projeto. Recusar é mais honesto que entregar um anexo vazio, que cai direto na falha silenciosa descrita acima.
- **Ler `.docx`, `.pptx` e o resto do escritório como anexo** — cada um é um parser e um mundo de casos próprios, como o Excel já demonstra na seção de formatos. (Gerar `.docx` **como saída** da resposta do modelo é outra pergunta, sem parsing nenhum envolvido — ver [Exportação da resposta como arquivo](#exportação-da-resposta-como-arquivo).)
- **Exportar em `.xml`** — esteve na tabela de formatos desde a 4ª revisão e saiu em 27/08/2026, por decisão do dono do escopo: *"era mais um capricho do que algo usável"*. Nunca houve um uso real. Saída que **não** custava biblioteca nenhuma, mas custava uma decisão de esquema que ninguém precisava tomar — exportar o texto que o modelo escreveu, ou serializar a conversa num envelope? Recusar as duas é mais barato que escolher uma. `.txt` ficou no lugar dele na tabela acima.
- **Gerar `.odp` e `.ppt`** — `.odp` não tem biblioteca JS madura para gerar (verificado). `.ppt` é formato binário anterior a 2007; como o `.doc`, não vale a pena gerar nativo. Converter via LibreOffice foi avaliado e descartado: as bibliotecas existentes (`libreoffice-convert` e afins) são só invólucros que chamam o binário `soffice` — exigem LibreOffice **instalado no sistema do usuário**, o que contraria a ferramenta local autocontida.
- **Editar, anotar ou exportar o documento anexado — inclusive código colado ou anexado** — decorre do [teste que separa pilar de produto novo](#o-teste-que-separa-pilar-de-produto-novo): o documento que entra como contexto não sai como arquivo. Isto é diferente de exportar a **resposta do modelo** como arquivo novo, que tem seção própria acima — o objeto que sai não é o que entrou. **Criar ou reescrever arquivo de código é a mesma pergunta que o documento anexado, com um agravante:** o caminho de saída seria escolhido pelo modelo, não pelo usuário num diálogo de salvar — decisão de segurança própria, gatilho em [`ROADMAP § 2`](ROADMAP.md).
- **Índice vetorial de imagens** — busca por semelhança visual não é pergunta que este aplicativo tenha. O que serve é buscar pela **descrição** que o modelo de visão já produziu no anexo, e isso é texto, indexado pelo embedder que já existe. Ver [`HISTORY.md`](HISTORY.md) para o que foi medido.

### Onde passa a linha do gráfico

| Dentro | Fora |
|---|---|
| Um gráfico derivado de um resultado **que já está na conversa** | Painel com vários gráficos |
| Artefato de mensagem, recolhível como os outros | Layout salvo, atualização automática |
| Rederivável — persiste a referência, não os pontos | Filtros interativos cruzados, relatório |

**O teste que mantém a fronteira honesta:** se o gráfico precisar de estado próprio que sobreviva à conversa, ele virou painel — e painel está fora. É uma regra que o código consegue obedecer, ao contrário de "não exagerar", e é o caso concreto de onde saiu o [primeiro teste](#o-teste-que-separa-pilar-de-produto-novo).

⌛ **O gráfico está no escopo e ainda não construído** — e é ele que destrava a apresentação como formato de saída: um deck sem imagem de gráfico seria texto em caixas. Por isso `.pptx` não é recusado, é **posterior**; ver [exportação](#exportação-da-resposta-como-arquivo) e a ordem em [`ROADMAP § 1`](ROADMAP.md#1-a-sequência).

---

## Consequências arquiteturais

### A conversa é o primeiro dado próprio do aplicativo

Todo o resto é derivado de arquivo do usuário; a conversa não é. Mora em `app.getPath('userData')` e o formato precisa suportar migração desde a primeira versão — a lista de tipos de artefato vai crescer, e a de tipos de passo também. Uma receita salva é uma lista de passos salva: divide o mesmo armazenamento, sem mecanismo novo.

### Cria um pacote novo em `core/`

`src/core/pipeline/` — os tipos de passo e o compilador de passos para SQL. É lógica pura, testável sem banco: dada uma lista de passos e um esquema, produz uma string de SQL. É o coração do verbo *tratar*, o alvo de validação da proposta do modelo, e o lugar mais bem coberto de testes de nível 1 que o projeto vai ter.

### A fronteira de privacidade deixa de ser regra e vira código

A frase "o modelo recebe o esquema, nunca as linhas" era disciplina lembrada. Com os três níveis acima ela vira caminho de código em `core/`, com teste de nível 1 que falha se um valor-sentinela do arquivo de teste aparecer no payload dos níveis 1 e 2.

### O extrator é o único lugar que sabe de `.pdf`, `.svg` e `.webp`

Um anexo não é um arquivo: é uma **leitura materializada**. O que varia por tipo é só o extrator; o resto do caminho é um só, e o extrator roda **uma vez**, no momento do anexo, com o resultado persistido junto da mensagem.

```
arquivo → extrator por tipo → MessagePart tipada → userData/attachments/<hash>
                  ↑
     o único lugar que conhece .pdf, .svg, .webp
```

Nunca se relê o PDF a cada turno. É o mesmo princípio do cache de prefixo do Ollama e a mesma forma do "um cartão de dados só": paga-se caro uma vez, e o resultado é dado de primeira classe daí em diante.

---

## Ordem de construção

A sequência do que falta, com dependências e estado de cada etapa, é do [`ROADMAP § 1`](ROADMAP.md#1-a-sequência) — dono único, para não haver duas ordens divergindo em silêncio.

---

**Índice:** [README](../README.md) · [Planos](plan/active/README.md) · [Caderno de estudos](study/README.md)
