# Escopo — data-lab

O que o aplicativo faz, o que ele não faz, e as consequências arquiteturais de cada decisão.

> Este documento é a **definição de produto**. O [`CLAUDE.md`](../CLAUDE.md) diz como o código é escrito; o [`ROADMAP § 1`](ROADMAP.md#1-a-sequência) diz em que ordem construir; o [caderno de estudos](study/README.md) explica o Electron. Aqui está o que se está construindo, e por quê.

---

## Em uma frase

**Uma bancada de dados local, operada por conversa** — abrir CSV, Parquet, Excel ou JSON, perguntar sobre ele em português, e sair com uma resposta ou com o arquivo tratado.

Não é uma ferramenta de BI. Um gráfico pode aparecer no meio de uma conversa, para você entender um resultado que já está na tela; painel, relatório e atualização automática continuam fora. E não é um chat genérico com um leitor de arquivo pregado ao lado: o motor é o DuckDB, o trabalho é o de sempre — deixar o dado utilizável, que hoje se faz em planilha na mão ou em script Python descartável —, e a conversa é a interface que substitui a bancada de painéis.

---

## Os dois verbos

Toda pergunta dirigida a um arquivo de dados cai em um de dois verbos, e eles pedem respostas de **formatos diferentes**. Confundi-los é a origem da maior parte do que dá errado numa ferramenta assim.

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
| pré-visualização | anexar um arquivo | — |
| cartão de dados | avaliação do arquivo pela IA | indexar para busca |
| proposta de consulta | pergunta que virou SQL | executar |
| proposta de passos | pedido que virou tratamento | executar · salvar como receita |
| resultado | execução de uma proposta | plotar |
| gráfico | um resultado agregado | — |

Isso substitui as abas fixas de uma bancada tradicional: o que seria "aba de pré-visualização" é um bloco preso à mensagem em que o arquivo foi anexado, e some da vista junto com ela.

Duas regras decorrem, e as duas existem para o aplicativo não engordar em silêncio:

> **A conversa guarda a pergunta, a proposta e o veredito — nunca o resultado.** Resultado é rederivável a partir do arquivo e pode ser enorme. Dele guarda-se apenas o resumo: contagem de linhas, duração, nomes de coluna e os avisos de sanidade.

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

Todos os quatro são entrada **e** saída. Três deles são quase de graça; um não é.

| Formato | Leitura | Escrita | Observação |
|---|---|---|---|
| **CSV / TSV / delimitados** | nativa no DuckDB | nativa | O caso base e o mais bagunçado do mundo real |
| **Parquet** | nativa | nativa | Colunar, tipado, comprimido — a saída natural do app |
| **JSON / NDJSON** | nativa | nativa | NDJSON é direto; JSON aninhado exige achatamento |
| **Excel (`.xlsx`)** | extensão `excel` do DuckDB, ou biblioteca à parte | idem | **Assimétrico — ver abaixo** |

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

**Configuração decorrente:** `memory_limit` do DuckDB fixado explicitamente em ~4 GB — não o padrão de 80% da RAM, que brigaria com o Chromium do próprio app — e `temp_directory` apontando para `app.getPath('userData')`, para que o derramamento tenha onde acontecer.

---

## Escrita e segurança do dado

O app **pode** sobrescrever o arquivo de origem, mediante confirmação explícita. A exportação para arquivo novo é o caminho padrão; sobrescrever é uma escolha consciente do usuário.

Isso não é gratuito, e as três consequências ficam registradas agora:

**Escrita atômica, sempre.** Grava em arquivo temporário no mesmo volume e só então renomeia sobre o original. Escrita direta que falha na metade — falta de espaço, queda de energia, cancelamento — destrói o dado de entrada, e não há desfazer.

**Arquivo aberto em outro programa.** No Windows, um `.xlsx` aberto no Excel tem bloqueio exclusivo, e o rename falha com `WinError 32`. É o mesmo tipo de armadilha que o mill.tools já documenta para o `.temp` do yt-dlp. Precisa de erro claro — "feche o arquivo no Excel" — e não de uma falha genérica.

**Confirmação que mostra o que muda.** Antes de sobrescrever: quantas linhas entram e saem, e quais colunas desaparecem. Uma confirmação de "tem certeza?" sem números não informa nada.

**SQL gerado por modelo roda com o motor restringido, não com o texto inspecionado.** O DuckDB é configurado com `allowed_directories`, `enable_external_access = false`, `autoinstall_known_extensions = false` e `lock_configuration = true` antes de qualquer consulta gerada. A garantia é do motor; uma expressão regular tentando adivinhar intenção em SQL não é defesa.

---

## Fora do escopo

Registrado explicitamente para não ser confundido com "ainda não":

- **Painel e BI** — vários gráficos, layout salvo, atualização automática, filtros cruzados, relatório exportável. **Um** gráfico como artefato de uma mensagem está dentro (ver abaixo); o resto é outra ferramenta.
- **Edição célula a célula** — decisão de modelo, justificada acima.
- **Banco de dados remoto** — Postgres, MySQL, APIs. O app é local e trabalha sobre arquivos.
- **Execução agendada / ETL sem interface** — receitas são reaplicáveis pela interface, não por linha de comando ou agendador.
- **Colaboração e multiusuário** — aplicativo de uma pessoa, uma máquina.
- **Versionamento de dados** — sem histórico de versões do dataset.

### Onde passa a linha do gráfico

| Dentro | Fora |
|---|---|
| Um gráfico derivado de um resultado **que já está na conversa** | Painel com vários gráficos |
| Artefato de mensagem, recolhível como os outros | Layout salvo, atualização automática |
| Rederivável — persiste a referência, não os pontos | Filtros interativos cruzados, relatório |

**O teste que mantém a fronteira honesta:** se o gráfico precisar de estado próprio que sobreviva à conversa, ele virou painel — e painel está fora. É uma regra que o código consegue obedecer, ao contrário de "não exagerar".

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

---

## Ordem de construção

```
fundação (8 fases) ──► casca conversacional ──► persistência das conversas
                                                       │
                                                       ├─► orçamento de contexto e modelo
                                                       ├─► anexo: esquema e perfil
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
