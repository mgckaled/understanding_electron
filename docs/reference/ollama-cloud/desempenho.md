# Ollama Cloud — desempenho e custo de cota

> Anexo de [`README.md`](README.md). Medido do lado do cliente, desta máquina, em 13/09/2026. São **ordens de grandeza comparáveis**, não benchmark controlado: a latência da rede local entra em todos os números.

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

## 3. Custo de cota — contar requisições engana

Dois pontos medidos no painel da conta, no mesmo dia:

| Momento | Requisições | Cota usada |
|---|---:|---:|
| Após a 1ª rodada (respostas curtas) | 23 | **0,2 %** |
| Após a 2ª rodada (inclui os pesados) | 42 | **1,7 %** |

**19 requisições a mais custaram 1,5 pontos percentuais — 7,5× o que as 23 primeiras custaram juntas.** A unidade é **tempo de GPU**, e a segunda rodada concentrou tudo que é caro: duas chamadas a `nemotron-3-ultra` (~290 s somados), duas com prompt de 32 k tokens, e seis chamadas às ferramentas web.

Distribuição final por linha do painel:

| Linha | Requisições |
|---|---:|
| `gpt-oss:20b` | 15 |
| `gemma4:31b` | 10 |
| `gpt-oss:120b` | 4 |
| **web search** | 4 |
| `nemotron-3-nano:30b` | 3 |
| `nemotron-3-super` | 2 |
| `nemotron-3-ultra` | 2 |
| **web fetch** | 2 |

⚠️ **As ferramentas web aparecem como linhas próprias e consomem a mesma cota** — confirmando o texto do painel de que *capabilities such as web search draw from your included usage*. Não há orçamento separado para elas.

⚠️ **Não extrapole por número de requisições.** A média deste conjunto misto dá ~0,04 %/requisição (≈ 2.500 requisições/mês), mas a primeira rodada dava ~0,009 % (≈ 11.000/mês) — uma diferença de 4× conforme o perfil. O que a cota realmente conta é segundo de GPU: um modelo lento, uma resposta longa ou um raciocínio extenso custam múltiplos de uma pergunta curta a um modelo rápido.

**A leitura útil para dimensionar uso real:** a faixa gratuita é generosa para conversa cotidiana com os modelos rápidos (`gpt-oss:120b`, `nemotron-3-nano:30b`), e se esvazia depressa com `nemotron-3-ultra` — cujo custo por resposta é da ordem de 100× o de uma pergunta curta, pela latência sozinha.
