# Ollama Cloud — desempenho e custo de cota

> Anexo de [`README.md`](README.md). Medido do lado do cliente, desta máquina, em 13/09/2026. São **ordens de grandeza comparáveis**, não benchmark controlado: a latência da rede local entra em todos os números.
> ⛔ **Consumido em 14/09/2026** — leitura histórica. Donos vivos: skill [`ai`](../../../.claude/skills/ai/SKILL.md) (regra) e [`reference/models/cloud-optin.md`](../models/cloud-optin.md) (ficha). Ver [`README.md`](README.md).

---

## 1. Velocidade por modelo

Mesmo prompt para todos (~40 tokens, pedindo um parágrafo de ~80 palavras), `stream: true`, `think: false`.

| Modelo | TTFT | Total | Prompt tk | Saída tk | **tok/s** |
|---|---:|---:|---:|---:|---:|
| `gpt-oss:120b` | 0,43 s | 2,41 s | 85 | 622 | **315,5** |
| `nemotron-3-nano:30b` | 0,41 s | 0,87 s | 40 | 126 | **271,6** |
| `gpt-oss:20b` | 0,81 s | 6,83 s | 85 | 675 | **112,2** |
| `gemma4:31b` | 0,45 s | 2,11 s | 36 | 102 | **61,5** |
| `nemotron-3-super` | 0,82 s | 5,29 s | 40 | 186 | **41,7** |
| `nemotron-3-ultra` | **153,60 s** | 158,74 s | 40 | 172 | 33,5 |

⚠️ A saída de `gpt-oss:20b` e `gpt-oss:120b` inclui raciocínio não pedido — a família ignora `think: false` ([`api.md`](api.md) § 4.2), e é por isso que os dois geraram 622–675 tokens onde os demais geraram 100–190. **Numa cota contada em tempo de GPU, isso é custo direto**, não só verbosidade: ver [`modelos.md`](modelos.md) § 4.

⚠️ **Esta tabela não decide qual modelo usar.** Velocidade e qualidade divergiram: `nemotron-3-nano:30b` é o 2º mais rápido e foi o único a **inventar sintaxe** com documentação em contexto, enquanto `qwen3.5:2b` rodando local, 50× mais lento, acertou. A escolha de modelo tem página própria — [`modelos.md`](modelos.md).

### A régua de comparação

A frota **local** vive em [`reference/models/`](../models/README.md), e a skill [`ai`](../../../.claude/skills/ai/SKILL.md) registra os dois números que importam: mediana de **~38 tok/s** no modelo mais usado (`qwen3.5:2b`) e **~5 tok/s** nos maiores.

`gpt-oss:120b` a **315 tok/s** é ~8× o melhor local e ~60× os maiores — e é um modelo de 116 B, que nesta máquina não roda de forma alguma. Quatro dos seis superam o melhor local; os dois que não superam (`nemotron-3-super`, `nemotron-3-ultra`) são de 120 B e 550 B.

⚠️ **`nemotron-3-ultra` tem ~2 minutos de latência antes do primeiro token, e não é *cold start*.** Segunda chamada, já exercitado: **131,9 s** até o primeiro byte. O `CHAT_TIMEOUT_MS` do app (1.000.000 ms) cobre folgadamente, mas são dois minutos de tela parada sem um token para desenhar — e o app não tem estado de interface para "pedido aceito, nada chegando ainda" além do indicador de resposta. É o único dos seis cujo uso interativo é questionável.

---

## 2. Contexto grande e cache de prompt

Prompt de 126.047 caracteres contra `gemma4:31b`, duas vezes seguidas:

| | Tempo | `prompt_eval_count` | `prompt_eval_cached_count` |
|---|---:|---:|---:|
| 1ª chamada | 1,9 s | 32.228 | 0 |
| 2ª chamada | 0,8 s | 32.228 | **32.224** |

Três achados:

1. **32 k tokens de prefill em 1,9 s.** A skill [`ai`](../../../.claude/skills/ai/SKILL.md) registra que o teto declarado do `gemma3:4b` (131.072) seriam *"~87 minutos de prefill nesta CPU"*. O raciocínio por trás de `DEFAULT_NUM_CTX = 32768` — *"reservar janela é barato, preenchê-la não é"* — **não vale neste provedor**.
2. **Cache de prompt automático**, no campo `prompt_eval_cached_count`, que **não existe no fio local**. O app reenvia a história inteira a cada turno porque o provedor é *stateless*; aqui esse reenvio é quase de graça a partir do segundo turno. ⚠️ **Por quanto tempo o cache sobrevive não foi medido** — as duas chamadas foram consecutivas.
3. **A estimativa por caractere acertou.** Densidade real de **3,91 chars/token** neste texto (repetitivo), contra o `DEFAULT_CHARS_PER_TOKEN = 3.8` do app: erro de ~3 %, na direção conservadora. `calibrateRatio` funcionaria normalmente, já que os contadores exatos chegam.

---

## 3. Custo de cota — o painel não permite atribuir por lote

Três pontos lidos no painel da conta, todos em 13/09/2026:

| Momento | Requisições | Cota usada | Delta do lote |
|---|---:|---:|---|
| Após a 1ª rodada (respostas curtas) | 23 | **0,2 %** | — |
| Após a 2ª rodada (inclui os pesados) | 42 | **1,7 %** | +19 req · **+1,5 pp** |
| **Final (bateria de qualidade + diagnóstico do 400)** | **76** | **1,9 %** | +34 req · **+0,2 pp** |
| **Verificação ao vivo do `N-3-C` e do `N-3-D` (14/09)** | **82** | **2,2 %** | +6 req · **+0,3 pp** |

⚠️ **A quarta leitura (14/09) é a mais eloquente: seis requisições custaram +0,3 pp, mais que as 34 do lote anterior.** ⚠️ **A terceira já desmontava a conclusão que as duas primeiras sugeriam.** Com dois pontos, a leitura óbvia era que requisições pesadas custam ~7,5× as leves. O terceiro lote tinha **34 requisições e quatro chamadas a `nemotron-3-ultra`** — o modelo mais caro dos seis, que no lote anterior aparecia como a explicação do salto — e custou **0,2 pp**, praticamente a taxa do lote mais leve de todos.

Os dois lotes com mais `ultra` estão nos **extremos opostos** da tabela. Nenhuma hipótese de "segundos de GPU" reconcilia isso sozinha.

✅ **A conclusão não é que a cota é barata — é que este painel não é instrumento de medida.** O número é arredondado a uma casa decimal, não é carimbado por requisição e pode não atualizar em tempo real. **Todo modelo de custo construído sobre deltas daqui está construído sobre ruído** (`DNC-16`).

**O único número defensável é o total:** 76 requisições de sondagem deliberadamente pesada — seis chamadas ao `ultra`, dois prompts de 32 k tokens, seis às ferramentas web — consumiram **1,9 %**. Ordem de grandeza: **~4.000 requisições/mês** nesse perfil. Conversa cotidiana com `gemma4:31b` fica folgadamente abaixo.

> 🔍 **Hipótese que reconciliaria o ruído, não verificada.** Fontes de terceiros descrevem a faixa gratuita com **níveis 1 a 4 por peso de modelo** e janelas de 5 h / 7 dias. Um multiplicador por nível explicaria saltos não lineares melhor que tempo de GPU sozinho — mas **conflita com o painel medido**, que diz `1,9% used` e `Resets in 3 weeks`. Prevalece o medido.

Distribuição final por linha do painel (76 no total):

| Linha | Requisições |
|---|---:|
| `gpt-oss:20b` | 20 |
| `gemma4:31b` | 16 |
| `gpt-oss:120b` | 11 |
| `nemotron-3-nano:30b` | 10 |
| `nemotron-3-super` | 7 |
| `nemotron-3-ultra` | 6 |
| **web search** | 4 |
| **web fetch** | 2 |

⚠️ **As ferramentas web aparecem como linhas próprias e consomem a mesma cota** — confirmando o texto do painel de que *capabilities such as web search draw from your included usage*. Não há orçamento separado para elas.

⚠️ **E não há header de cota**, então o app não tem como ler saldo em runtime. Somado à inatribuição acima, é o que fecha `DNC-15`: **o crivo não exibirá indicador de cota para este provedor.** Não é lacuna a preencher depois — é a forma final, e a diferença contra o Context7, onde `docs:quota` lê o header da última resposta (`D23I.10`).
