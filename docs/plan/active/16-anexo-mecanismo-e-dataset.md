# 16 — Anexo: o mecanismo, e o dataset como primeiro consumidor

**Depende de:** [15 — Orçamento de contexto e modelo](15-orcamento-de-contexto-e-modelo.md) · **Entrega:** o clipe no composer, o armazenamento por conteúdo em `userData/attachments/`, as variantes de `MessagePart`, e o **cartão de dados** em `core/` — o primeiro caminho em que o modelo vê alguma coisa de um arquivo do usuário.

> Quarto plano do [arco conversacional](README.md#o-arco-conversacional-1320). **O mecanismo nasce genérico de propósito.** Desenhado sabendo que só existe dataset, ele nasceria com forma de dataset e o 17 o reescreveria — então o dataset entra aqui como *primeiro consumidor* de um mecanismo que já prevê documento e imagem, e não como o assunto do plano.

---

## O caso

O aplicativo é *"uma bancada local de dados operada por conversa"* e **a conversa nunca viu um arquivo.** O `dataset:pick` e o `dataset:scan` existem desde a [fase 06](../implemented/06-primeira-feature.md), com progresso e cancelamento, e produzem um `DatasetSummary` que morre num painel. O chat, ao lado, responde sobre nada.

Quatro coisas faltam, e nenhuma é o parser:

1. **Não há como um arquivo entrar na conversa.** Não existe clipe, não existe parte de mensagem que não seja texto, não existe onde guardar bytes.
2. **Não existe cartão de dados.** O [`ESCOPO.md`](../../ESCOPO.md) fixa três níveis de exposição e um `core/ai/dataCard.ts` como dono único; hoje a regra *"o modelo recebe o esquema, nunca as linhas"* é disciplina lembrada, não caminho de código.
3. **O orçamento do plano 15 mede a coisa errada** — descoberto ao escrever este plano, e é o achado que mais muda o desenho. Ver D16.5.
4. **Apagar uma conversa não sabe o que fazer com os bytes dela.** O `ON DELETE CASCADE` da [D14.1](../implemented/14-persistencia-das-conversas.md) resolve mensagens e **não serve** para anexo: o mesmo arquivo pode estar em duas conversas.

**Fora deste plano:** extratores de documento e imagem, gate de `vision`, `/api/ps` em Configurações (17); DuckDB e o nível 2 de verdade (18); nível 3, amostra de linhas (17, junto com documento, que é nível 3 por construção). Prompt de sistema continua fora, pelo motivo da [D15.2](15-orcamento-de-contexto-e-modelo.md).

---

## O que o 15 deixou pronto — e a conta que ele cobra

O plano anterior fechou com seis itens de herança. Três se cobram aqui:

- **`AiModel.contextLength` e `contextCeiling` existem**, então o custo de um anexo é comparável com um número real antes de ele ser pago.
- **O medidor existe**, e é o que torna visível o custo de um cartão antes do envio.
- **`settings` absorve chave nova sem migração.**

E um item novo, que o 15 não previu: **`MessagePart` só tem a variante `text`, e a coluna `parts` é JSON justamente para as variantes deste plano não custarem migração** — a [migração v1](../implemented/14-persistencia-das-conversas.md) diz isso em comentário. Se um `CREATE TABLE` aparecer no diff, ver a D16.2 antes de aceitá-lo.

### Que modelo escolher quando há anexo — duas correções de intuição

Perguntado na revisão deste plano, e vale escrito porque as duas intuições erradas são as naturais.

**"Menos parâmetros, janela maior"** é verdade na direção e falso como regra. O que decide é o **custo de cache KV por token**, que é arquitetura e varia 30× na frota sem relação com o tamanho — medido com ~5,5 GiB livres:

| Modelo | Pesos | KV/token | Janela usável |
|---|---|---|---|
| `gemma3:4b` | 3,1 GB | **4,2 KB** | **131.072** |
| `qwen2.5-coder:3b` | 1,8 GB | 38,2 KB | 32.768 |
| `gemma3:1b` | 0,8 GB | ~4 KB | 32.768 |
| `phi4-mini` | **2,3 GB** | **135,7 KB** | 18.399 |
| `qwen2.5:7b` · `-coder:7b` | 4,4 GB | 59 KB | 6.006 |

O `phi4-mini` é mais leve que o `gemma3:4b` e tem janela **7× menor**. É por isso que o seletor mostra o teto calculado por modelo: nenhuma coluna do `ollama list` deixa isso visível.

**"Arquivo grande pede janela grande"** vale para documento (17) e **não vale para dataset**, que é o caso deste plano: um CSV de 2 GB e um de 2 MB produzem o mesmo cartão, porque o modelo nunca vê as linhas. É o desenho inteiro dos três níveis expresso em uma frase — **o tamanho do dataset não consome contexto**. E, mesmo onde vale, reservar não é encher: os 131.072 do `gemma3:4b` cabem na RAM e custam ~87 min para preencher, o que é o motivo de o teto prático de documento ser ~8k tokens.

**E escolher antes de anexar deixou de ser conselho: é garantia.** A [D15.13](15-orcamento-de-contexto-e-modelo.md) trava o par `(modelo, num_ctx)` no primeiro envio, o que dá a este plano o que faltava ao passo 0 — **um denominador fixo**. Sem a trava, o orçamento de um cartão seria medido contra uma janela que a próxima troca de modelo pode dividir por vinte, e a conversa que cabia passa a não caber com o anexo já dentro dela. Com a trava, o custo do cartão é orçado uma vez contra um número que não se mexe.

---

## Passo 0 — Uma medida, antes de decidir o formato do cartão

Sem código, no molde do [passo 0 do plano 15](15-orcamento-de-contexto-e-modelo.md#passos). A D16.5 precisa de um número que nenhuma aritmética dá: **quantos tokens custa um cartão de dados**, e como isso escala com o número de colunas.

Montar à mão o texto do cartão para três arquivos reais de larguras diferentes (~5, ~20 e ~40 colunas), mandar cada um pelo `/api/chat` com `num_ctx` folgado e ler o `prompt_eval_count` — o mesmo instrumento que a [D15.4](15-orcamento-de-contexto-e-modelo.md) já usa para calibrar o medidor, e a única contagem exata que existe.

**O que a medida decide:**

- Se um cartão de 40 colunas custar **centenas** de tokens, ele viaja inteiro em todo turno e não há o que projetar.
- Se custar **milhares**, o cartão precisa de forma resumida para os turnos seguintes ao primeiro — e aí a D15.3 (resumir o começo preservando o cache de prefixo) deixa de ser nota de rodapé e vira requisito.

> ⚠️ **O cartão não é pago uma vez, é pago todo turno.** O provedor é sem estado e cada chamada reenvia a conversa inteira, então um cartão de 2.000 tokens numa conversa de 20 turnos custa **40.000 tokens de prefill acumulado** — e disputa, a cada turno, a mesma janela que a conversa. Isto reordena o requisito: *"suficiente para o modelo responder"* é o piso, **enxuto** é o alvo. O multiplicador é o número de turnos, e é ele que faz uma diferença de 500 tokens no formato do cartão valer uma sessão de medição.

**Protocolo do Ollama, como sempre:** um modelo residente por vez, `keep_alive` ≤ 1, `ollama ps` vazio antes e depois.

---

## Decisões a tomar

### D16.1 — O anexo pertence à **mensagem**, não à conversa

A alternativa óbvia é uma gaveta na conversa: *"o dataset atual"*. Ela é descartada por reescrever o passado. Os turnos anteriores ao anexo genuinamente **não** viram o arquivo, e uma gaveta de nível de conversa faria a transcrição mentir sobre o que cada resposta teve diante de si — o mesmo argumento que fez o modelo ser gravado **por mensagem** na [D13.4](../implemented/13-casca-do-aplicativo.md), e pelo mesmo motivo: autoria e contexto se resolvem com dado, não com proibição.

Consequência boa e não óbvia: como o provedor é sem estado e **todo turno reenvia tudo**, o cartão persiste na conversa sem mecanismo nenhum. Não há "anexo ativo" para gerenciar, invalidar ou expirar. O que existe é a transcrição.

### D16.2 — Nenhuma tabela nova, e a coleta é por varredura

O anexo mora em `parts`, que é JSON, então **este plano também não tem `CREATE TABLE`** — pela mesma régua da [D14.1](../implemented/14-persistencia-das-conversas.md): o que a barra lateral lista vira coluna, o resto vira JSON.

Isso decide também a coleta de lixo, e por um caminho que a tabela **pioraria**. Sem tabela, a pergunta *"este blob ainda é referenciado?"* é uma varredura com `json_each` sobre `messages.parts`, e a pergunta simétrica — *"que arquivo em `attachments/` ninguém referencia?"* — é a mesma varredura invertida. Com tabela, um blob escrito em disco cuja mensagem nunca chegou a ser gravada (envio cancelado, falha no meio) ficaria órfão **e sem registro**, invisível para as duas perguntas.

**Verificado em 11/08/2026**, porque a decisão dependia de a consulta existir e não de ela ser plausível — `json_each` está disponível no `node:sqlite` (SQLite 3.53.3 local, 3.53.1 no Electron; a extensão JSON1 é embutida desde a 3.38), e o conjunto de referências sai num `SELECT` só:

```sql
SELECT DISTINCT json_extract(p.value, '$.hash') AS hash
FROM messages, json_each(messages.parts) AS p
WHERE json_extract(p.value, '$.hash') IS NOT NULL
```

**Gatilho declarado para a v2:** o plano 17 vai querer cachear o texto extraído de um PDF para não reextrair a cada turno. Isso é dado sobre o anexo, não dentro da mensagem, e é aí que a escada do `PRAGMA user_version` ganha seu segundo degrau — que, como a [D14.2](../implemented/14-persistencia-das-conversas.md) registra, é o degrau cujo defeito aparece sobre um banco que já tem conversas dentro.

### D16.3 — Copiar, endereçado por conteúdo, inclusive o dataset

`userData/attachments/<sha256>`, sem extensão no nome — o tipo vive na parte da mensagem, não no sistema de arquivos. Deduplicação sai de graça, e o mesmo arquivo anexado em duas conversas ocupa disco uma vez.

**Descartado: referenciar o dataset por caminho.** É tentador — um CSV pode ser grande, e copiá-lo dobra o disco — e está errado por duas razões que se somam. A primeira é o plano 18: o DuckDB vai consultar o arquivo, e um caminho que o usuário moveu quebra a consulta meses depois, longe da causa. A segunda é o motivo de este plano existir na ordem em que está: se o dataset não usasse o armazenamento, o armazenamento chegaria ao 17 **sem nunca ter rodado**, e o mecanismo genérico viraria mecanismo não testado com nome de genérico.

O custo é disco, que é o recurso mais barato aqui e já está na fila para ser medido — o [`ROADMAP § 1`](../../ROADMAP.md) lista *"o que o SQLite e os anexos ocupam em `userData`"* entre os primeiros medidores do observatório.

> Isto **refina** a frase do [índice do arco](README.md): *"os bytes de um PDF não são rederiváveis"*. O argumento estava escrito para documento; vale igual para dataset, por um motivo diferente e mais forte.

### D16.4 — O cartão é um só, mora em `core/`, e a regra de privacidade vira teste

> **O que é um cartão de dados, e o que ele não é.** É a **descrição do arquivo que o modelo lê**: nomes e tipos de coluna, contagem de linhas, e — a partir do 18 — agregados. Não é o conteúdo do arquivo resumido, e **nenhuma linha do arquivo entra nele**.
>
> Não confundir com a **proposta** do plano 19 (a união discriminada `query | steps`), que é o SQL ou a lista de passos que o modelo **escreve**. Um é entrada, o outro é saída; leem-se parecido e vivem em planos diferentes.
>
> **O cartão é produzido por código determinístico, sem o modelo.** Hoje pelo scanner da [fase 06](../implemented/06-primeira-feature.md), no 18 pelo `SUMMARIZE`. Pedir um resumo ao modelo custaria uma ida a 4–6 tok/s, daria resultado diferente a cada vez e — o que decide — exigiria mostrar as linhas cruas para produzir a descrição, furando a fronteira que o cartão existe para manter.

`core/ai/dataCard.ts`, dono único, consumido por conversa, consulta, passos e busca. Contexto montado por feature é como se produzem duas qualidades de resposta sobre o mesmo arquivo — e, pior, duas fronteiras de privacidade, das quais a segunda ninguém revisa.

**O que este plano consegue produzir é nível 1 mais a contagem de linhas**, e isso não é limitação de desenho: o nível 2 é o `SUMMARIZE` do DuckDB, que chega no 18. A **forma** do cartão nasce com lugar para o nível 2; o 18 preenche.

O aceite é um teste de nível 1 que falha se um valor-sentinela do arquivo de teste aparecer no payload. É a frase do [`ESCOPO.md`](../../ESCOPO.md) — *"o modelo recebe o esquema, nunca as linhas"* — deixando de ser disciplina lembrada. E ele é escrito **agora**, com um cartão raso, para que o 18 herde a guarda em vez de precisar lembrar de acrescentá-la junto com o `SUMMARIZE`.

### D16.5 — O medidor passa a medir **o que é enviado**, não a transcrição

**Este é o achado do plano, e ele corrige o 15.**

O medidor da [D15.4](15-orcamento-de-contexto-e-modelo.md) soma `messageText(message).length` sobre a transcrição. Uma parte `dataset` **não tem texto** — o cartão é materializado quando o payload do provedor é montado. Logo, o medidor reportaria **zero** para o anexo, e o portão da D15.5 deixaria passar exatamente o turno mais caro.

O plano 15 registrou essa armadilha como *"o que este plano arma para o 17"*, apontando para a imagem, que custa ~270 tokens sem ter caractere nenhum. **Ela arma um plano antes do previsto**, e por um motivo mais banal: não é preciso ser uma imagem para não ter caracteres, basta não ser texto.

O conserto não é somar um caso especial ao medidor — é apontar o medidor para o lugar certo. Existe **uma** função que traduz a lista de partes no que o provedor recebe (é onde a fronteira dos três níveis mora, D16.4); o orçamento mede a saída dela. Assim, cada variante nova nasce contada, porque foi contada pela função que já precisava saber traduzi-la.

Consequência de contrato: `historyChars` deixa de ser um número que o `ConversationView` calcula e passa a sair do construtor de contexto.

### D16.6 — Anexar é um job, e o job é a leitura

O clipe abre o diálogo, e a partir daí é o mecanismo da [fase 06](../implemented/06-primeira-feature.md): `jobId` cunhado no renderer, progresso por evento, cancelamento. Não há mecanismo novo — há um segundo consumidor do que já existe, que é a primeira vez que aquele desenho é cobrado por outro caminho.

O que custa não é a cópia, é a **leitura**: o hash e a varredura precisam do arquivo inteiro. Um passo, não dois — o `sha256` sai do mesmo fluxo que alimenta o scanner, porque ler 200 MB duas vezes para depois descobrir que o arquivo já estava lá é o tipo de desperdício que só aparece com arquivo grande, isto é, tarde.

O anexo fica **pendente** no composer até o envio, como o rascunho. Cancelar antes de enviar não deixa rastro — e é aqui que a coleta da D16.2 ganha seu primeiro caso real, não hipotético.

### D16.7 — `MarkdownMessage` sobe para `shared/ui/`

O gatilho está no [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão) com data marcada neste plano: o cartão é o **segundo consumidor** de markdown fora da resposta do assistente, e o 17 traz o terceiro (um `.md` anexado renderiza como markdown). Sobe o componente e a tipografia de bloco, conforme a D11.1.

---

## Decisões futuras registradas agora

Duas propostas nascidas da correção da [D15.10](15-orcamento-de-contexto-e-modelo.md), que **não** entram neste plano. Ficam aqui porque é aqui que o anexo torna cada uma mais cara de não ter — e as duas viram linha no [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão), que é o dono de pendência.

### F16.1 — A RAM livre passa a ser observada, não fotografada

Hoje o `app:memory` é lido **duas vezes**: ao montar a tela e ao clicar ↻. O `staleTime` é infinito de propósito — um teto que se move sozinho muda debaixo do cursor enquanto se digita no campo "Contexto".

O argumento é bom para o campo **focado** e fraco para o resto do tempo, e o custo dele é uma dica que o aplicativo não honra: *"feche aplicativos e recarregue"* só vira ação depois de um clique que ninguém adivinha. A forma proposta é **congelar enquanto o controle numérico tem foco, e reler fora disso** — por intervalo lento, por foco de janela, ou pelos dois.

**Por que não agora:** é mudança no ciclo de vida de um dado que a D15.2 acabou de estabilizar, e misturá-la ao anexo faz duas variáveis ao mesmo tempo. **Gatilho:** o primeiro relato de um teto exibido que não corresponde à máquina — ou este plano, se o anexo tornar a troca de modelo frequente o bastante para o ↻ virar rotina.

### F16.2 — A margem de RAM vira configuração, ao lado do `num_thread`

`RAM_MARGIN_BYTES` é a **única** constante do orçamento que não foi medida: o `1,06` de overhead e os `0,33 GiB` fixos saíram do `ollama ps`, os pesos saem do `/api/tags`, e a margem é juízo. A D15.10 já registra que ela errou duas vezes na mesma direção.

Ela é escala de **máquina**, exatamente como o `num_thread` da [D13.4](../implemented/13-casca-do-aplicativo.md) — logo tem lugar pronto: a tabela `app_settings`, que é chave-valor justamente para chave nova não custar migração. Quem opera a máquina sabe melhor que uma constante do repositório quanta folga quer deixar.

**Por que não agora:** um botão que regula um número perigoso precisa mostrar a consequência ao lado — *"com esta margem, dois dos seis modelos deixam de caber"* —, e isso é uma tela, não um campo. **Gatilho:** a margem precisar de um terceiro valor. Duas correções são conserto; três são um parâmetro querendo sair de dentro do código.

---

## Passos

| # | Entrega | Aceite |
|---|---|---|
| **0** | Medida do custo do cartão em três larguras | Números no diário; a D16.5 deixa de depender de estimativa |
| **1** | `core/ai/dataCard.ts` e o construtor de contexto | Nível 1 com valor-sentinela: falha se um dado do arquivo vazar |
| **2** | `userData/attachments/`, hash e o canal de anexo | Nível 3 no handler; segundo anexo do mesmo arquivo não escreve nada |
| **3** | Clipe no composer, anexo pendente, progresso e cancelamento | Nível 2: anexar, ver progresso, cancelar, e não deixar órfão |
| **4** | O cartão desenhado na conversa; `MarkdownMessage` em `shared/ui/` | Nível 2; o gatilho do `ROADMAP` fecha |
| **5** | O orçamento medindo o payload (D16.5) | Nível 2 **visto vermelho antes**: anexo grande com o medidor antigo passa; com o novo, é recusado |
| **6** | Coleta de órfãos ao excluir conversa | Nível 3: blob compartilhado por duas conversas sobrevive à exclusão de uma |

> O passo 5 é o único que **não pode** ser escrito depois do conserto. O medidor antigo reporta zero para um anexo, e um teste escrito já com o medidor novo passaria sem nunca ter provado nada — foi assim que um teste vacuoso entrou e saiu do plano 15 (D15.10). Provocar o defeito primeiro, e registrar no diário que foi visto.

---

## O que este plano deixa registrado para o 17

- **O armazenamento por conteúdo já rodou** com o dataset, então o documento herda um mecanismo exercitado em vez de estreado.
- **O orçamento mede o payload** (D16.5), então a imagem de ~270 tokens e ~80 s é contada **sem caso especial** — a variante nasce contada pela função que a traduz.
- **`hasCapability` tem chamador desde a correção da D15.11** (é ele que responde se um modelo conversa), então o gate de `vision` é o segundo uso de um caminho já vivo.
- **A escada de migração continua num degrau só**, e o gatilho para o segundo está declarado na D16.2: o cache de texto extraído.
- **O nível 3 não existe ainda**, e o 17 o traz por necessidade — documento e imagem são nível 3 por construção, não por escolha.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 11/08/2026 | — | plano escrito | Escrito logo após as correções de uso do plano 15 (D15.10, D15.11), e uma delas mudou o desenho deste: a armadilha que o 15 registrou para o 17 — medidor que conta caracteres contra uma parte que não tem caracteres — **arma um plano antes**, porque basta não ser texto, não é preciso ser imagem. Daí a D16.5, que aponta o orçamento para o payload em vez da transcrição. Duas propostas da sessão anterior entram como decisões futuras com gatilho (F16.1, F16.2) em vez de escopo. |
| 11/08/2026 | — | plano revisado | Revisão de leitura, e ela achou três buracos de exposição mais um número que faltava. **(1)** *"Cartão de dados"* não estava definido em lugar nenhum e colide de leitura com a **proposta** do 19 — um é o que o modelo lê, o outro é o que ele escreve; definição e a distinção agora abrem a D16.4, junto do que estava implícito e não escrito: **o cartão é determinístico, sem o modelo**. **(2)** O passo 0 media o custo do cartão sem dizer que ele é **pago a cada turno** — 2.000 tokens numa conversa de 20 turnos são 40.000 de prefill acumulado, e é esse multiplicador que faz a medição valer uma sessão. **(3)** As duas intuições naturais sobre escolha de modelo são falsas e agora estão numa tabela: menos parâmetros não implica janela maior (o `phi4-mini` é mais leve que o `gemma3:4b` e tem janela 7× menor), e **tamanho de dataset não consome contexto nenhum**, porque o modelo nunca vê as linhas. Verificado no caminho, porque a D16.2 dependia disso e não de plausibilidade: `json_each` existe no `node:sqlite` e o conjunto de referências sai num `SELECT` só. |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.
