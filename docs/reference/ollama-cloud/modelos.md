# Ollama Cloud — dos seis, quais dois

> Anexo de [`README.md`](README.md). Bateria de qualidade rodada em 13/09/2026, **n=1 por célula** salvo onde indicado. Velocidade e cota estão em [`desempenho.md`](desempenho.md); esta página responde outra pergunta — **qual modelo escolher**, que velocidade sozinha não responde.
>
> ✅ **A resposta está em § 5: dois — `gemma4:31b` e `gpt-oss:120b`.** As seções 1–4 são a evidência que levou até lá, e continuam sendo o método a repetir quando o catálogo mudar.

⚠️ **A régua desta página não é "qual é o melhor modelo", é "qual serve a este app".** O crivo responde sobre **o arquivo que o usuário anexou** e sobre **a documentação que ele consultou**. Um modelo que preenche lacunas com o plausível é pior aqui do que um modelo lento, e foi isso que a bateria procurou separar.

---

## 1. As quatro tarefas

Escolhidas porque o app já faz cada uma delas hoje:

| Tarefa | O que mede | Como foi montada |
|---|---|---|
| **Fidelidade à fonte** | o modelo responde a partir do material anexado, ou inventa? | Cartão real do Context7 (~923 tokens), montado com `formatDocsCard` a partir da fixture `context-tanstack-query.json` — **sem gastar cota do Context7** |
| **SQL DuckDB** | o pilar de dados | Esquema de tabela com tipos e percentual de nulos; pedido de agregação com filtro e `LIMIT` |
| **Português** | toda a interface e as respostas são em PT-BR | "Exatamente 2 frases, sem listas, sem markdown" |
| **Tool calling** | o contorno para a ausência de `format` ([`api.md`](api.md) § 4.1) | Ferramenta `registrar_passo` com `enum`, `required` e um campo opcional |

---

## 2. O resultado

| Modelo | Fidelidade | SQL | Português | Ferramenta | Tempo típico |
|---|---|---|---|---|---|
| **`gemma4:31b`** | ✅ | ✅ | ✅ impecável, 48 tk | ✅ consistente | **0,5–0,9 s** |
| `gpt-oss:120b` | ✅ | ✅ | ✅ bom, **332 tk** | ⚠️ **inconsistente** | 0,8–2,9 s |
| `gpt-oss:20b` | ✅ | ✅ | ⚠️ *"o thread"*, **306 tk** | ❌ **HTTP 400** | 2,4–6,5 s |
| `nemotron-3-nano:30b` | ⚠️ **1 erro em 2** | ✅ | ⚠️ fraco | ✅ consistente | **0,6 s** |
| `nemotron-3-super` | ✅ | ✅ | ✅ bom | ✅ consistente | 1,1–3,9 s |
| `nemotron-3-ultra` | ✅ | ✅ | ✅ **o melhor** | ✅ consistente | **74–82 s** |

⚠️ **O SQL não separa ninguém.** Os seis produziram a **mesma** query, caractere por caractere:

```sql
SELECT uf, SUM(preco * quantidade) AS faturamento_total FROM vendas
WHERE preco IS NOT NULL GROUP BY uf ORDER BY faturamento_total DESC LIMIT 5;
```

Uma tarefa em que todos empatam não é critério — registrada para que ninguém a repita esperando que decida algo.

---

## 3. Modelo a modelo

### `gemma4:31b` — o padrão, se houver um

Ganha ou empata em tudo, e ganha **por concisão**: 19 tokens onde o `gpt-oss:120b` gasta 334 para a mesma resposta certa. Português sem um deslize. Ferramenta acionada com o menor `prompt_eval` dos seis (121 contra 354 dos `nemotron`). E é o **único com `vision`**.

### `gpt-oss:120b` — o segundo, com uma ressalva de acionamento

Correto em tudo, e o mais rápido em tok/s brutos (315). Mas **não aciona ferramenta de forma confiável**: acionou quando o pedido vinha acompanhado do esquema da tabela, respondeu em texto quando o pedido era curto. Para conversa, serve; para um caminho que dependa de `tool_calls`, não dá para confiar sem prompt cuidadosamente montado.

### `gpt-oss:20b` — fora, por defeito do serviço

Ver [`capacidades.md`](capacidades.md): **HTTP 400 em toda requisição com `tools`**, com um excesso invariável de "17 tokens". Sem `tools` funciona. Some-se a verbosidade (1.372 tokens de saída para uma pergunta trivial) e não sobra papel para ele — o `120b` é mais rápido, mais barato em cota e mais correto.

### `nemotron-3-nano:30b` — rápido, e descuidado justamente onde dói

O mais rápido depois do `gemma4`, e aciona ferramenta de forma consistente. Mas **errou a tarefa de fidelidade**: perguntado como invalidar queries por prefixo com o cartão do Context7 em contexto, produziu `queryKey: { todos: undefined }` — sintaxe que **não está no cartão** —, enquanto `qwen3.5:2b` rodando **local**, 50× mais lento, acertou. Repetido com outra pergunta sobre o mesmo cartão, acertou (`previousTodos`).

⚠️ **1 erro em 2 não prova um padrão, e é exatamente por isso que ele fica registrado:** o modo de falha é o que este app menos pode ter. Antes de promovê-lo a qualquer papel que envolva material anexado, repita a tarefa com n maior.

No português é o mais fraco dos seis — erro de concordância e conteúdo vago.

**Papel que o justificaria:** resposta rápida quando não há fonte anexada a respeitar.

### `nemotron-3-super` — dominado, e por isso dispensável

Acerta tudo e escreve bem. Mas é 2–4× mais lento que o `gemma4:31b`, que acerta as mesmas coisas, é mais conciso e tem visão. **Não foi encontrada uma tarefa em que ele ganhe.** Modelo que não ganha em nada não merece uma linha no seletor — a régua de "não inventar ponto de extensão especulativo" da skill [`architecture`](../../../.claude/skills/architecture/SKILL.md) vale também para opção de menu.

### `nemotron-3-ultra` — a melhor resposta, e inviável assim mesmo

Deu a melhor resposta em português dos seis: duas frases exatas, precisas, nomeando os *workers*. E leva **74–82 s** por resposta — medido quatro vezes, sempre igual —, além dos 131–153 s de TTFT no streaming, que **não é *cold start*** ([`desempenho.md`](desempenho.md)). Numa cota contada em tempo de GPU, é o mais caro dos seis por larga margem, para ganhar numa dimensão que outros dois já cumprem bem.

---

## 4. A verbosidade é custo, não estilo

| Tarefa | `gemma4:31b` | `gpt-oss:120b` | `gpt-oss:20b` |
|---|---:|---:|---:|
| Fidelidade (1 frase pedida) | **19** | 334 | 122 |
| SQL (só a query pedida) | **46** | 309 | 228 |
| Português (2 frases pedidas) | **48** | 332 | 306 |
| Pergunta trivial, sem `tools` | — | — | **1.372** |

É o `think: false` ignorado pela família `gpt-oss` ([`api.md`](api.md) § 4.2) aparecendo pelo lado financeiro: **a cota é tempo de GPU**, então gerar 7× mais tokens para a mesma resposta custa 7× mais. O defeito de privacidade e o de custo têm a mesma raiz.

---

## 5. Veredito — dois modelos, quatro rejeições

> ✅ **Decidido no refinamento de 13/09/2026** (`DNC-1`–`DNC-4`, [`decisoes.md`](decisoes.md)). Esta seção **revoga** a recomendação anterior, que punha os três `nemotron` como alternativas.

**Entram dois:**

1. **`gemma4:31b` — o padrão.** Vence ou empata nas quatro tarefas, e vence **por concisão**: 19 tokens onde o `gpt-oss:120b` gasta 334 para a mesma resposta certa. Português sem um deslize, ferramenta consistente, menor `prompt_eval` dos seis, 256 k de contexto, **o único com `vision`**. Numa cota medida em tempo de GPU, concisão é preço (`DNC-2`).
2. **`gpt-oss:120b` — o segundo, e a ressalva mudou de natureza.** Entra pela capacidade bruta: 116 B, 315 tok/s, ~8× o melhor local. A verbosidade **deixou de ser tara permanente** — `think: 'low'` é um botão de custo documentado que esta bateria não usou, porque o app manda booleano e `gpt-oss` só aceita nível ([`api.md`](api.md) § 4.2). A ressalva que **fica** é o acionamento inconsistente de ferramenta, e ela não morde enquanto o app não tiver caminho baseado em ferramenta (`DNC-3`).

**Saem quatro, e não é por empate** — são quatro rejeições distintas, o que importa para quem quiser reabrir uma delas (`DNC-4`):

| Modelo | Por que sai | O que faria voltar |
|---|---|---|
| `gpt-oss:20b` | HTTP 400 em toda requisição com `tools`; dominado pelo `120b` mesmo sem ferramenta | o 400 ser corrigido **e** algum papel que o `120b` não cubra |
| `nemotron-3-nano:30b` | **inventou sintaxe** com o cartão do Context7 em contexto (1 erro em 2), onde o `qwen3.5:2b` local acertou | repetir a tarefa de fidelidade com **n maior** e não reproduzir o erro |
| `nemotron-3-super` | **não vence nada** — dominado pelo `gemma4:31b` em velocidade, concisão e visão | uma tarefa em que ele ganhe, ainda não encontrada |
| `nemotron-3-ultra` | 74–82 s por resposta, 131–153 s de TTFT que não é *cold start*; o app não tem estado de tela para "aceito, nada chegando" | esse estado de tela existir **e** a latência cair |

⚠️ **A régua que decide não é "qual é o melhor modelo".** É a da skill [`architecture`](../../../.claude/skills/architecture/SKILL.md): **opção que não vence nenhuma tarefa é ponto de extensão especulativo**, e isso vale para linha de menu tanto quanto para código. Um seletor com seis entradas empurra ao usuário uma escolha que a medição já sabe responder.

⚠️ **E os `nemotron` tinham um argumento a favor que caiu junto.** Eram três dos quatro modelos que acionam ferramenta de forma confiável — o que os salvaria *se* o contorno de `format` por ferramenta virasse caminho. `DNC-19` fechou esse caminho por ora (gate, não contorno), então a premissa não se cumpre. **Se o gatilho de saída estruturada for disparado um dia, esta linha é a primeira a reler.**

⚠️ **Reconfira antes de tratar qualquer número desta página como fixo.** É n=1 por célula, num dia, contra um serviço que muda. O que vale reter não são os vereditos — é **o método**: as quatro tarefas, e o fato de que fidelidade a material anexado separa modelos que SQL e velocidade não separam.
