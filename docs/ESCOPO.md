# Escopo — data-lab

O que o aplicativo faz, o que ele não faz, e as consequências arquiteturais de cada decisão.

> Este documento é a **definição de produto**. O [`CLAUDE.md`](../CLAUDE.md) diz como o código é escrito; o [plano de fundação](plan/active/README.md) diz em que ordem construir; o [caderno de estudos](study/README.md) explica o Electron. Aqui está o que se está construindo, e por quê.

---

## Em uma frase

**Uma bancada local para limpar e transformar arquivos de dados** — abrir CSV, Parquet, Excel ou JSON, montar uma sequência de operações de tratamento, ver o efeito de cada uma, e exportar o resultado.

Não é um visualizador. Não é uma ferramenta de BI. É a etapa que vem **antes** delas: o trabalho de deixar o dado utilizável, que hoje se faz em planilha na mão ou em script Python descartável.

---

## O modelo mental: pipeline de passos

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

**Descartado:** SQL-first (o modelo do módulo Dados do mill.tools). Funciona bem para *perguntar* ao dado, que é o caso de lá. Para *tratar* o dado — iterativo, tentativa e erro, com o resultado de um passo mudando o que se quer no seguinte — a consulta única é o formato errado: desfazer vira edição de texto, e não há como reaplicar "a mesma limpeza" a outro arquivo sem copiar SQL na mão.

**Descartado:** grade editável célula a célula. Exigiria estado mutável do dataset, desfazer por diff, e escrita através da camada de virtualização. É outro produto, muito mais caro, e mal servido por um motor colunar.

---

## Catálogo de operações

Em três camadas, por ordem de implementação. A camada 1 é o que faz o app ser útil; as outras entram por demanda.

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

Adotada desde o início, ela custa zero e o teto passa a ser o disco. Retrofitada depois, é reescrever todo caminho de dados.

**Configuração decorrente:** `memory_limit` do DuckDB fixado explicitamente em ~4 GB — não o padrão de 80% da RAM, que brigaria com o Chromium do próprio app — e `temp_directory` apontando para `app.getPath('userData')`, para que o derramamento tenha onde acontecer.

---

## Escrita e segurança do dado

O app **pode** sobrescrever o arquivo de origem, mediante confirmação explícita. A exportação para arquivo novo é o caminho padrão; sobrescrever é uma escolha consciente do usuário.

Isso não é gratuito, e as três consequências ficam registradas agora:

**Escrita atômica, sempre.** Grava em arquivo temporário no mesmo volume e só então renomeia sobre o original. Escrita direta que falha na metade — falta de espaço, queda de energia, cancelamento — destrói o dado de entrada, e não há desfazer.

**Arquivo aberto em outro programa.** No Windows, um `.xlsx` aberto no Excel tem bloqueio exclusivo, e o rename falha com `WinError 32`. É o mesmo tipo de armadilha que o mill.tools já documenta para o `.temp` do yt-dlp. Precisa de erro claro — "feche o arquivo no Excel" — e não de uma falha genérica.

**Confirmação que mostra o que muda.** Antes de sobrescrever: quantas linhas entram e saem, e quais colunas desaparecem. Uma confirmação de "tem certeza?" sem números não informa nada.

---

## Fora do escopo

Registrado explicitamente para não ser confundido com "ainda não":

- **Visualização e BI** — gráficos, painéis, relatórios. O app entrega dado limpo; visualizar é outra ferramenta.
- **Edição célula a célula** — decisão de modelo, justificada acima.
- **Banco de dados remoto** — Postgres, MySQL, APIs. O app é local e trabalha sobre arquivos.
- **Execução agendada / ETL sem interface** — receitas são reaplicáveis pela interface, não por linha de comando ou agendador.
- **Colaboração e multiusuário** — aplicativo de uma pessoa, uma máquina.
- **Versionamento de dados** — sem histórico de versões do dataset.

Nada disso é impossível de acrescentar depois. Está fora porque cada item multiplicaria o escopo antes de o núcleo existir.

---

## O que este escopo implica no plano

### Não muda nada nas oito fases de fundação

Foi conferido item a item. O contrato IPC, o `Result`, o registro de jobs, os tokens e a pirâmide de testes servem a este escopo sem alteração — que é o resultado esperado de uma fundação que não presume o produto.

A única confirmação relevante: a feature [`open-dataset`](plan/implemented/06-primeira-feature.md) da fase 06 continua sendo a escolha certa, e ganha peso — detectar separador, encoding e cabeçalho não é mais um exercício de validação, é o primeiro passo real do produto.

### Cria um pacote novo em `core/` depois do DuckDB

`src/core/pipeline/` — os tipos de passo e o compilador de passos para SQL. É lógica pura, testável sem banco: dada uma lista de passos e um esquema, produz uma string de SQL. É o coração do produto e o lugar mais bem coberto de testes de nível 1 que o projeto vai ter.

### Cria uma necessidade de persistência que ainda não existe

As receitas precisam ser salvas. É o primeiro dado próprio do aplicativo — tudo até aqui é derivado de arquivo do usuário. Mora em `app.getPath('userData')`, e o formato precisa suportar migração desde a primeira versão, porque a lista de tipos de passo vai crescer.

### Revisa a primeira feature de IA

A [camada de IA](plan/active/09-camada-de-ia.md) previa NL→SQL como maior retorno. Num modelo de pipeline, o alvo certo é **NL→passo**: "tira os duplicados por CPF e preenche cidade vazia" vira dois passos no pipeline, editáveis e inspecionáveis, em vez de SQL opaco.

Mesmo ponto de privacidade, inegociável: **o modelo recebe apenas o esquema — nomes e tipos de coluna — nunca as linhas.**

---

## Ordem de construção

```
fundação (8 fases)  ──►  camada de dados (DuckDB, utilityProcess, Arrow, tabela virtualizada)
                              │
                              ├─► pipeline de passos, camada 1 do catálogo, CSV e Parquet
                              ├─► receitas salvas e reaplicáveis
                              ├─► JSON/NDJSON
                              ├─► Excel
                              ├─► camada 2 do catálogo
                              └─► IA: NL→passo
```

---

**Índice:** [README](../README.md) · [Plano de fundação](plan/active/README.md) · [Caderno de estudos](study/README.md)
