# Escopo — crivo

O que o aplicativo faz, o que ele não faz, e as consequências arquiteturais de cada decisão.

> Este documento é a **definição de produto**. O [`CLAUDE.md`](../CLAUDE.md) diz como o código é escrito; o [`ROADMAP § 1`](ROADMAP.md#1-a-sequência) diz em que ordem construir; o [caderno de estudos](study/README.md) explica o Electron. Aqui está o que se está construindo, e por quê.
>
> ⚠️ **O escopo descreve o produto de hoje, não um teto para a arquitetura.** A seção [Fora do escopo](#fora-do-escopo) é firme sobre o que **não se constrói agora** — e continua firme. O que ela não autoriza é estrutura que só saiba abrigar o que está escrito aqui. O critério que separa "não construir" de "não impedir" é dono de [`HISTORY.md`](HISTORY.md) § *flexibilidade é forma de dado e slot*, e o resumo dele é a régua da fase 00: forma de dado que atravessa camadas e costura que custa zero decidem-se agora; feature constrói-se quando existir.
>
> Esse critério já foi cobrado uma vez e pagou. Quando a decisão citada acima foi escrita, "descrição de imagem por VLM" era o exemplo de feature futura que justificava `Message` nascer como **lista de partes tipadas** em vez de `content: string`. Em ago/2026 a leitura de documento e imagem [entrou no escopo](#duas-classes-de-arquivo-e-a-linha-entre-elas) — e a estrutura que a recebe já estava lá, sem retrofit. Registrado porque é o argumento empírico de que a régua funciona, e não uma previsão de sorte.

---

## Em uma frase

**Uma bancada de dados local, operada por conversa** — abrir CSV, Parquet, Excel ou JSON, perguntar sobre ele em português, e sair com uma resposta ou com o arquivo tratado. É o pilar mais maduro do aplicativo, e o que organiza os demais.

Mas não é só isso, e fingir que é enfraquece o que o app já entrega: na mesma conversa entra o documento que explica o dado (`.md` da especificação, PDF do contrato, captura de tela da planilha), o trecho de código para revisar ou entender, a busca na web, a consulta a documentação de biblioteca, e o raciocínio do modelo em voz alta. **O crivo é uma ferramenta local multiuso, operada por conversa** — e dados é o pilar mais forte e mais antigo dos que ela sustenta, não o único.

Não é uma ferramenta de BI. Um gráfico pode aparecer no meio de uma conversa, para você entender um resultado que já está na tela; painel, relatório e atualização automática continuam fora — pelo mesmo teste que decide toda fronteira nova, descrito a seguir.

---

## O teste que separa pilar de produto novo

Um chat multiuso corre um risco que uma bancada de dados sozinha não corre: toda ideia parece caber, porque "está dentro da mesma conversa" é critério fraco demais para recusar coisa nenhuma. A régua que substitui "não é um chat genérico" precisa ser mecânica, não de gosto — é a mesma que já decidia a fronteira do gráfico, generalizada para toda capacidade:

> **Uma capacidade é pilar do crivo enquanto viver dentro da conversa** — como ação executada, contexto consumido, ou um dos artefatos que o app já sabe persistir (mensagem, receita, dado tratado e exportado). **No instante em que ela precisar de estado próprio, gerido fora da conversa** — layout salvo, arquivo reexportado, projeto paralelo com vida própria — **ela virou outro produto.**

É o teste que já respondia "salvar o PDF anotado" e "painel com filtros cruzados": os dois pedem um artefato que sobrevive fora da conversa e uma tela própria para gerenciá-lo. Continua respondendo à mesma pergunta agora que o motivo deixou de ser "isso não é chat" — o motivo é "isso não vive dentro de uma conversa".

---

## Duas classes de arquivo, e a linha entre elas

O aplicativo abre duas coisas muito diferentes, e confundi-las corrompe os dois verbos abaixo — que só valem para dado tabular, nunca para documento.

| | **Dado tabular** | **Documento** |
|---|---|---|
| Formatos | CSV, Parquet, JSON/NDJSON, Excel | `.txt`, `.md`, `.pdf` com texto, código-fonte · `.png`, `.jpeg`, `.svg`, `.webp` |
| Relação | *perguntar* e *tratar* — os dois verbos abaixo | **ler como contexto**, e nada mais |
| Motor | DuckDB | nenhum: vai direto ao modelo |
| Produz | consulta, passos, receita, resultado, gráfico | texto no contexto da conversa |
| Vira arquivo de saída? | sim — é o ponto do aplicativo | **nunca** |
| Exposição ao modelo | três níveis, o terceiro opt-in | sempre integral — ver adiante |

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

> 🔍 **A pergunta que parece de consulta mas é de tratamento.** *"Liste os tipos de produto e sua quantidade"* sobre um arquivo em que `quantidade` mistura `2`, `3` e `"dois"` **não tem resposta em SQL** — antes de agrupar é preciso converter a coluna, e isso é um passo. Uma consulta única não consegue dizer "aliás, esta coluna precisa de limpeza"; ela devolve uma tabela vazia, sem erro nenhum. É o modo de falha mais caro da ferramenta, e o motivo de os dois verbos existirem separados. A anatomia do caso está no [`HISTORY.md`](HISTORY.md) § Armadilhas.

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

Isso substitui as abas fixas de uma bancada tradicional: o que seria "aba de pré-visualização" é um bloco preso à mensagem em que o arquivo foi anexado, e some da vista junto com ela.

Três regras decorrem, e as três existem para o aplicativo não engordar em silêncio:

> **A conversa guarda a pergunta, a proposta e o veredito — nunca o resultado.** Resultado é rederivável a partir do arquivo e pode ser enorme. Dele guarda-se apenas o resumo: contagem de linhas, duração, nomes de coluna e os avisos de sanidade.

> **O anexo é guardado por conteúdo, não por caminho.** O arquivo é copiado para `userData/attachments/<hash>` e a conversa guarda a referência. Ao contrário do resultado, os bytes de um PDF **não** são rederiváveis — o arquivo original pode ter sido movido, renomeado ou apagado —, então guardar o caminho seria guardar uma promessa. Guardar por hash traz dois efeitos de graça: o mesmo arquivo anexado duas vezes ocupa espaço uma vez, e excluir uma conversa precisa conferir se outro anexo ainda aponta para aquele hash.

> **Resultado passa por verificação antes de virar resposta.** Coluna inteiramente nula, zero linhas, conversão que anulou tudo — cada um vira **aviso visível**, nunca uma tabela apresentada como se estivesse certa. SQL válido que executa sem erro e devolve a resposta errada é o modo de falha que o usuário não tem como detectar sozinho.

---

## O que a IA vê do seu dado

O modelo precisa saber o bastante para ser útil e o mínimo para ser seguro. São **três níveis**, e o do meio carrega quase todo o valor:

| Nível | O que vai ao modelo | Insight que habilita | Exposição |
|---|---|---|---|
| **1 — esquema** | nomes e tipos de coluna | *"não há coluna de data"* | nenhuma |
| **2 — perfil agregado** | mín/máx/média, % de nulos, cardinalidade, top-N | *"`idade` tem 12% de nulos e máximo 999 — sentinela de ausente"* | quase nenhuma |
| **3 — amostra de linhas** | as primeiras N linhas cruas | *"o CPF aparece com e sem máscara"* | total |

O nível 2 é o `SUMMARIZE` do DuckDB, e é o que produz uma avaliação de qualidade digna do nome. As regras:

- **Top-N só para coluna de baixa cardinalidade.** Os cinco valores mais frequentes de `cidade` são estatística; os cinco mais frequentes de `cpf` são vazamento com outro nome. O limiar é relativo à contagem de linhas, e a decisão mora em `core/`, nunca ao lado de um chamador — ver [`HISTORY.md`](HISTORY.md) § Armadilhas.
- **O nível 3 é opt-in por anexo, e o padrão depende do provedor.** Local (Ollama, na sua máquina) pode liberá-lo a um clique. Nuvem tem o nível 3 **bloqueado**, com a mesma dica acionável do gate de disponibilidade.
- **Um cartão de dados só.** `core/ai/dataCard.ts` produz um objeto, consumido por todos os caminhos — conversa, consulta, passos, busca. Contexto montado por feature é como se produzem duas qualidades de resposta sobre o mesmo arquivo.

### Documento e imagem são nível 3 por construção

Os três níveis funcionam porque dado tabular **pode ser agregado**: existe uma descrição do arquivo que é útil e não expõe valor nenhum. Documento e imagem não têm esse meio-termo — não existe "perfil agregado" de um `.md`, e ou o modelo vê os pixels ou não vê.

Logo, **todo anexo de documento ou imagem herda a regra do nível 3**: opt-in explícito, liberado no provedor local, **bloqueado na nuvem**, com a mesma dica acionável do gate de disponibilidade. Nenhum mecanismo novo — a mesma porta.

### O gate de capacidade é correção, não cortesia

Anexo de imagem exige modelo que declare `vision` nas `capabilities` — lidas do **`/api/show`**, nunca do `/api/tags`. Se o modelo selecionado não declara, o aplicativo **recusa o envio** — não envia sem a imagem, não avisa depois.

> ⚠️ **A fonte importa, e a errada é a intuitiva.** Medido em ago/2026 no Ollama 0.32.6: o `/api/tags` traz um campo `capabilities`, mas ele **omite `vision`** — o `gemma3:4b` aparece ali como `["completion"]` e no `/api/show` como `["completion","vision"]`. `tools` aparece nos dois, que é o que torna a armadilha convincente. Um gate construído sobre o `/api/tags` recusaria o único modelo com visão desta máquina. O teto de contexto também só existe no `/api/show`. Detalhe e custo em [`plan/implemented/15-orcamento-de-contexto-e-modelo.md`](plan/implemented/15-orcamento-de-contexto-e-modelo.md).

O motivo não é elegância de interface. Medido em ago/2026: dado o prompt *"descreva o conteúdo desta imagem"* **sem imagem nenhuma**, o `gemma3:4b` descreveu um gráfico de barras inteiro, com quatro produtos e quatro números, todos inventados, sem uma palavra de hesitação. É a mesma classe da [falha silenciosa do NL→SQL](HISTORY.md) — num caminho gerado por modelo, o perigo não é a exceção, é o sucesso. Anexo que falha em silêncio não produz erro: produz resposta convincente sobre um arquivo que o modelo nunca viu.

---

## Ferramentas do chat

Três capacidades — busca web, documentação e raciocínio visível — chegam pelo *tool calling* do Ollama, propostas em [`reference/web-fetch_mcp_thinking.md`](reference/web-fetch_mcp_thinking.md). Cada uma é pilar próprio pelo [teste acima](#o-teste-que-separa-pilar-de-produto-novo) — vive inteira dentro da conversa, sem estado que sobreviva a ela.

| | Faz | Não faz |
|---|---|---|
| **Busca web** | O modelo pede uma URL; o app busca e extrai o texto principal como contexto da resposta | Não indexa, não vira dataset — não passa pelo DuckDB — e não vira arquivo de saída, mesma regra do documento anexado |
| **Documentação (MCP)** | Um servidor remoto nomeado — **Context7** — para consulta de biblioteca/framework | Não é suporte a MCP em geral; ligar outro servidor é decisão nova, não implícita nesta |
| **Raciocínio visível** | Alternável por turno; o texto de raciocínio do modelo aparece separado da resposta final, recolhível | Ainda não construído — hoje o app manda `think: false` e descarta a fase de raciocínio (ago/2026, ver `HISTORY.md` § Armadilhas); a frota já tem um modelo que declara a capacidade (`qwen3:4b`, ver [`CLAUDE.md`](../CLAUDE.md)), o que faltava nunca foi o modelo |

⚠️ **Busca web, MCP e raciocínio pedem `tools`; anexo de imagem pede `vision`. Nenhum modelo desta máquina declara os dois** (ver [`CLAUDE.md`](../CLAUDE.md)) — então, hoje, usar estas ferramentas e anexar imagem são caminhos mutuamente exclusivos na mesma conversa. Trocar de modelo no meio dela resolve, ao custo do descarregamento já registrado acima.

A URL que o modelo pede precisa passar pelo mesmo ponto único de validação em `src/core/url.ts` — nunca um segundo caminho até a rede. Hoje esse ponto (`checkExternalUrl`) só confere o esquema (`http:`/`https:`); busca disparada por URL escolhida pelo modelo, e não pelo usuário clicando um link, também precisa recusar *loopback* e faixas privadas, o que abrir no navegador do sistema nunca precisou fazer.

Sequência e planos: [`ROADMAP § 1`](ROADMAP.md#1-a-sequência), planos 21–23.

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
| **Parquet** | nativa | nativa | Colunar, tipado, comprimido — a saída natural do app |
| **JSON / NDJSON** | nativa | nativa | NDJSON é direto; JSON aninhado é **recusado**, com o nome da coluna (18-E, D18E.4) — o motor relacional exige linha/coluna, então não há achatamento automático |
| **Excel (`.xlsx`)** | extensão `excel` do DuckDB, ou biblioteca à parte | idem | **Assimétrico — ver abaixo** |

### Documento — entrada apenas

A coluna "Escrita" não está vazia por adiamento: documento **nunca** é saída, pela regra da seção [Duas classes de arquivo](#duas-classes-de-arquivo-e-a-linha-entre-elas).

| Formato | Leitura | Escrita | Observação |
|---|---|---|---|
| **`.txt`, `.md`** | direta | — | detecção de encoding como no CSV; cp1252 é comum no Windows brasileiro |
| **código-fonte** (`.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, `.c`/`.cpp`, `.rb`, `.php`, `.sql`, `.sh`, `.css`, `.html`, `.yaml`, `.toml`, entre outras — texto puro) | direta, mesmo extrator de `.txt` | — | extensão compilada/binária (`.class`, `.pyc`, `.o`, ...) fica fora; o modelo identifica a linguagem pelo próprio conteúdo, sem tag exigida |
| **`.json`, `.ndjson`, `.jsonl` como código/config** (`package.json`, `tsconfig.json`, *fixture* de API, log estruturado) | direta, mesmo extrator de `.txt` | — | **Ainda não implementado** — `document:pick` hoje só filtra `txt`/`md`/`pdf`; entra junto do pilar Código (sem plano numerado, ver `ROADMAP § 4`). JSON neste papel **costuma vir aninhado, com frequência em vários níveis em sequência** — e isso não é problema aqui: o pilar documento nunca interpreta estrutura, só entrega texto cru ao modelo. É o oposto do JSON como *dataset* (tabela acima): lá o aninhamento é recusado (18-E, D18E.4) porque o motor relacional exige linha/coluna; aqui não existe motor nenhum, então não existe restrição. A escolha de caminho é o botão de anexo que o usuário clica (dataset vs. documento), não uma sondagem de conteúdo |
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

**Configuração decorrente:** `memory_limit` do DuckDB fixado explicitamente — não o padrão de 80% da RAM, que brigaria com o Chromium do próprio app — e `temp_directory` apontando para `userData/duckdb-tmp`, para que o derramamento tenha onde acontecer. O valor de `memory_limit` é remedido contra a RAM livre da máquina no momento da implementação, não copiado de sessão em sessão — no plano 18-A (ago/2026) ficou em `2GB`, abaixo do ~4 GB antes escrito aqui; ver [`plan/implemented/18-A-motor-e-worker.md`](plan/implemented/18-A-motor-e-worker.md) § D18A.4.

### O teto do documento é tempo, não tamanho

Dado tabular tem teto de bytes; documento tem teto de **segundos de prefill**, e ele é muito mais baixo. Medido contra o Ollama real em ago/2026, na máquina registrada em [`CLAUDE.md`](../CLAUDE.md) — CPU sem aceleração, `gemma3:4b`:

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

**Escrita atômica, sempre.** Grava em arquivo temporário no mesmo volume e só então renomeia sobre o original. Escrita direta que falha na metade — falta de espaço, queda de energia, cancelamento — destrói o dado de entrada, e não há desfazer.

**Arquivo aberto em outro programa.** No Windows, um `.xlsx` aberto no Excel tem bloqueio exclusivo, e o rename falha com `WinError 32`. É o mesmo tipo de armadilha que o mill.tools já documenta para o `.temp` do yt-dlp. Precisa de erro claro — "feche o arquivo no Excel" — e não de uma falha genérica.

**Confirmação que mostra o que muda.** Antes de sobrescrever: quantas linhas entram e saem, e quais colunas desaparecem. Uma confirmação de "tem certeza?" sem números não informa nada.

**SQL gerado por modelo roda com o motor restringido, não com o texto inspecionado.** O DuckDB é configurado com `allowed_directories`, `enable_external_access = false`, `autoinstall_known_extensions = false` e `lock_configuration = true` antes de qualquer consulta gerada. A garantia é do motor; uma expressão regular tentando adivinhar intenção em SQL não é defesa. **A ordem entre esses `SET` não é livre** — `allowed_directories` e `temp_directory` têm que ser setados antes de `enable_external_access = false`, ou o próprio DuckDB rejeita mudá-los depois; `lock_configuration` continua por último. Verificado ao vivo no plano 18-A, detalhe em [`HISTORY.md`](HISTORY.md).

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
- **`.docx`, `.pptx` e o resto do escritório** — cada um é um parser e um mundo de casos próprios, como o Excel já demonstra na seção de formatos.
- **Editar, anotar ou exportar documento — inclusive código colado ou anexado** — decorre do [teste que separa pilar de produto novo](#o-teste-que-separa-pilar-de-produto-novo): documento entra como contexto e não sai como arquivo. **Criar ou reescrever arquivo de código é a mesma pergunta, com um agravante:** o caminho de saída seria escolhido pelo modelo, não pelo usuário num diálogo de salvar — decisão de segurança própria, gatilho em [`ROADMAP § 2`](ROADMAP.md).
- **Índice vetorial de imagens** — busca por semelhança visual não é pergunta que este aplicativo tenha. O que serve é buscar pela **descrição** que o modelo de visão já produziu no anexo, e isso é texto, indexado pelo embedder que já existe. Ver [`HISTORY.md`](HISTORY.md) para o que foi medido.

### Onde passa a linha do gráfico

| Dentro | Fora |
|---|---|
| Um gráfico derivado de um resultado **que já está na conversa** | Painel com vários gráficos |
| Artefato de mensagem, recolhível como os outros | Layout salvo, atualização automática |
| Rederivável — persiste a referência, não os pontos | Filtros interativos cruzados, relatório |

**O teste que mantém a fronteira honesta:** se o gráfico precisar de estado próprio que sobreviva à conversa, ele virou painel — e painel está fora. É uma regra que o código consegue obedecer, ao contrário de "não exagerar" — e é o caso concreto que inspirou o [teste que separa pilar de produto novo](#o-teste-que-separa-pilar-de-produto-novo), generalizado para toda capacidade nova, não só gráfico.

---

## O que este escopo implica no plano

### A fundação continua servindo, e a camada de IA sai da fila

Foi conferido item a item na virada. O contrato IPC, o `Result`, o registro de jobs, os tokens e a pirâmide de testes servem a este escopo sem alteração — resultado esperado de uma fundação que não presume o produto. O que mudou de lugar é a **ordem**: a camada de IA deixa de ser a última etapa e passa a ser a interface, então o chat local da [fatia 1](plan/active/09-camada-de-ia.md) vira fundação em vez de adiantamento.

### As conversas são o primeiro dado próprio do aplicativo

Antes eram as receitas. Tudo até aqui é derivado de arquivo do usuário; a conversa não é. Mora em `app.getPath('userData')` e o formato precisa suportar migração desde a primeira versão — a lista de tipos de artefato vai crescer, e a de tipos de passo também. Uma receita salva é uma lista de passos salva: divide o mesmo armazenamento, sem mecanismo novo.

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

### O modelo carregado é recurso da máquina, e o aplicativo o administra

Um modelo residente ocupa RAM na ordem de gigabytes (números por modelo em [`CLAUDE.md`](../CLAUDE.md)), e a [fase 13](plan/implemented/13-casca-do-aplicativo.md) permite trocar de modelo **por mensagem** — então dois residentes é um estado alcançável, e nesta máquina isso é *swap*, não lentidão.

**Regra:** ao trocar de modelo, o aplicativo descarrega o anterior antes de chamar o novo. Custa zero no caso comum, porque trocar de modelo já invalida o cache de prefixo de qualquer forma; o custo real (recarga do disco) só aparece em quem volta ao modelo anterior. O estado fica visível em Configurações, com o que o `/api/ps` reporta — e é o primeiro medidor do observatório do [`ROADMAP § 1`](ROADMAP.md) a se pagar sozinho.

---

## Ordem de construção

```
fundação (8 fases) ──► casca conversacional ──► persistência das conversas
                                                       │
                                                       ├─► orçamento de contexto e modelo
                                                       ├─► anexo: mecanismo + dataset (esquema e perfil)
                                                       ├─► anexo: documento e imagem
                                                       ├─► camada de dados (DuckDB, Arrow, virtualização)
                                                       ├─► propor: consulta e passos
                                                       ├─► gráfico como artefato
                                                       ├─► receitas salvas e reaplicáveis
                                                       ├─► JSON/NDJSON · Excel
                                                       └─► camada 2 do catálogo
```

O detalhe de cada etapa, com dependências e estado, está no [`ROADMAP § 1`](ROADMAP.md#1-a-sequência).

---

**Índice:** [README](../README.md) · [Planos](plan/active/README.md) · [Caderno de estudos](study/README.md)
