# Modelos Ollama — inviáveis e descartados

**Data:** 20/08/2026. **Motivo:** registrar, num lugar só, os modelos já pesquisados que **não** entram na frota — para não repetir a pesquisa quando o mesmo nome aparecer de novo. Cada entrada nomeia o que bloqueia, porque isso decide se vale reabrir: um fato de máquina ou de produto que pode mudar (**inviável**) é diferente de uma comparação já medida e fechada (**descartado**). Números de tamanho/contexto vêm de scraping do `ollama.com` em 20/08/2026 salvo indicação contrária — **preliminares**, não confirmados por `/api/show` nesta máquina, exceto onde citado.

Companheiro deste arquivo: [`ollama-qualified.md`](ollama-qualified.md) (frota atual e elegíveis). Mapa da pasta: [`README.md`](README.md).

---

## Índice

**Inviáveis**
1. [`sqlcoder:7b`](#sqlcoder7b)
2. [`starcoder2:3b` / `starcoder2:7b`](#starcoder23b--starcoder27b)
3. [`dolphin3`](#dolphin3)
4. [`minicpm-v`](#minicpm-v)
5. [`deepseek-r1:1.5b`](#deepseek-r115b)
6. [`qwen3:1.7b`](#qwen317b)
7. [`qwen3-vl:4b`](#qwen3-vl4b)
8. [`granite-code:3b`](#granite-code3b)
9. [`granite4`](#granite4)
10. [`glm4:9b`](#glm49b)
11. [`granite3.2-vision:2b`](#granite32-vision2b)

**Descartados**
12. [`phi4-mini`](#phi4-mini)
13. [`glm-ocr`](#glm-ocr)
14. [`bakllava:7b`](#bakllava7b)
15. [`codegemma:2b`](#codegemma2b)
16. [`openchat:7b`](#openchat7b)
17. [`granite3.3:8b`](#granite338b)

---

## Inviáveis

Bloqueados por um fato específico — de máquina ou de produto — que pode mudar. Cada entrada nomeia a condição que reabriria a análise.

### `sqlcoder:7b`

7,24B parâmetros, 4,1 GB (visto no site, não confirmado por `/api/show`), base StarCoder fine-tunado para SQL. **Dois bloqueios independentes.** O model card cita **"at least 16GB of RAM"** — recomendação do modelo, não uma declaração do Ollama, decimal, e provavelmente pensada para os pesos não quantizados, não para o build Q4_0 de 4,1 GB. Mesmo lida com essa ressalva, ainda é mais que qualquer cenário de RAM livre desta máquina — suficiente para descartar sozinha. E, ainda que coubesse: é StarCoder-based, mesmo problema do item seguinte — formato de prompt schema+pergunta, sem template de turnos, incompatível com o único caminho (`/api/chat`) por onde o app fala com todo modelo. **Reabre com:** troca de máquina para uma com bem mais RAM livre **e** o app ganhar um caminho de completion fora do `/api/chat` — as duas condições, não uma.

### `starcoder2:3b` / `starcoder2:7b`

3,03B/7,17B parâmetros, 1,7/4,0 GiB, contexto 16.384. Modelos **base**, não instruct — o `TEMPLATE` do Modelfile é `<fim_prefix>`/`<fim_suffix>` cru, sem estrutura de turno usuário/assistente (a variante instruct só existe no 15B, fora de qualquer orçamento desta máquina). O app fala com todo modelo via `/api/chat`, que aplica esse template — não erra, produz saída sem sentido, porque o Ollama renderiza o FIM ignorando os turnos da conversa. **Reabre com:** o app ganhar um caminho de completion cru para fill-in-the-middle, decisão de arquitetura própria e hoje não cogitada.

### `dolphin3`

Fine-tune de Llama 3.1 8B, 4,9 GiB, contexto declarado 128k. É a mesma base do `llama3.1:8b` já medido e desinstalado (D15.8: teto de 131.072 pede ~20,6 GiB de cache KV, inatingível nesta máquina de 16 GiB totais). O custo de cache é função da arquitetura — contagem de camadas, cabeças, dimensão — não do fine-tune; o `dolphin3` deveria reproduzir o mesmo perfil caro. Badge `tools`/function-calling que a descrição do modelo sugere não apareceu na página consultada — mais um caso para checar via `/api/show`, não confiar na descrição de marketing, se a medição algum dia acontecer. **Reabre com:** troca de máquina com RAM suficiente para o teto que o justificaria — do contrário, é o `qwen2.5:7b` mais pesado, no mesmo padrão que já descartou o `mistral:7b`.

### `minicpm-v`

8B, SigLip-400M + Qwen2-7B, 5,5 GiB — única tag disponível na família, sem variante menor para respirar. Atenção plena (sem janela deslizante), CPU sem aceleração. Sozinho já consome a maior parte de qualquer orçamento de RAM desta lista antes de somar cache KV ou overhead do SO; contra o `gemma3:4b` (3,11 GiB, janela deslizante, ~50s de carga fria já medidos), espere carregamento e inferência sensivelmente mais lentos, sem confirmação de que a qualidade de OCR/imagem compensa. **Reabre com:** mais RAM livre nesta máquina, ou GPU — ou uma tag menor que a família hoje não oferece.

### `deepseek-r1:1.5b`

1,78B, 1,1 GiB, destilado do Qwen 2.5 com dados de raciocínio. É o candidato mais barato desta lista, e não tem problema técnico — o bloqueio é que **não existe consumidor no app hoje**: o chat descarta a fase de raciocínio (`think: false`, fixo), e o `roadmap #21` (thinking mode) que exporia isso ainda não foi implementado. Thinking é parâmetro de request, não depende de `tools` — então mesmo que a badge `tools` do site (contraditória com o que a comunidade relata para a família R1) não se confirme via `/api/show`, o papel pretendido continua de pé. **Reabre com:** o roadmap #21 sair do papel — nesse momento, é o candidato mais leve para a função, mais barato que os 2,5 GiB do `qwen3:4b` só para raciocínio.

### `qwen3:1.7b`

2,03B, 1,4 GiB, mesma família do `qwen3:4b` já instalado. Bloqueio é a ausência do número que decide: o `qwen3:4b` mede 152,6 KB/token, o pior da frota — se o `1.7b` herdar o mesmo perfil arquitetural (plausível, mesma família, atenção plena), não bate o `gemma3:1b` (~1 KB/token calculado) como fallback de baixa RAM; seria um modelo médio vestido de modelo pequeno. Nunca medido nesta sessão — deliberado, fora do escopo pedido nesta rodada. **Reabre com:** um `/api/show` (pull de 1,4 GiB, sem carregar) — mesmo caminho usado para confirmar `qwen3-vl:2b` e `translategemma:4b` em [`ollama-qualified.md`](ollama-qualified.md#elegíveis).

### `qwen3-vl:4b`

3,3 GiB, mesma família `qwen3-vl` do candidato elegível `qwen3-vl:2b`. Não tem defeito próprio identificado, mas não foi medido: o `2b` já preenche o papel de "visão com `tools`/`thinking`" nesta lista com menos peso, e herdaria o mesmo perfil caro de KV da família (calculado no `2b`: 118 KiB/token, atenção plena). Sem um segundo papel que o `2b` não cubra, medir o `4b` agora seria trabalho sem consumidor. **Reabre com:** o `2b` se mostrar insuficiente em qualidade de visão no uso real — aí sim vale medir o `4b` como upgrade dentro da mesma família.

### `granite-code:3b`

3,48B, 2,0 GiB (visto no site), contexto 128k declarado. Mesmo bloqueio do `starcoder2`/`sqlcoder`: `TEMPLATE` de FIM cru (`<fim_prefix>`/`<fim_suffix>`/`<fim_middle>`), sem estrutura de turno — modelo de completion, não de chat. O app só fala `/api/chat`. **Reabre com:** o mesmo gatilho dos outros dois — um caminho de completion fora do `/api/chat`, hoje não cogitado.

### `granite4`

Medido ao vivo em 20/08/2026 (`granite4:3b` e `granite4:3b-h`, pull → `/api/show` → `ollama rm`) — e o bloqueio não é custo, é que **a fórmula deste documento não consegue precificar o modelo**. Os dois `model_info` trazem `granite.attention.head_count_kv: null` (literalmente `null`, não ausente) e um bloco `ssm.*` completo (`conv_kernel`, `state_size`, `inner_size`, `time_step_rank`) — **as duas tags são híbridas Mamba-2/atenção**, inclusive a `3b` "padrão" que a página do `ollama.com` listava como "Standard Transformer Variant" (a categorização do site está errada). A tag `-h` declara teto de **1.048.576** tokens (1M) contra 131.072 da tag sem sufixo — diferença grande demais pra ser só nome. Sem `head_count_kv`, o `readAttention()` do nosso próprio código (`src/core/ai/models.ts`) devolve `null` para as duas tags — o mesmo caminho que o app usa para um embedder. **Consequência real, não só documental:** se este modelo entrasse na frota hoje, o medidor de orçamento de contexto (D15.2) simplesmente não pediria nada dele — nenhum aviso de RAM, nenhuma barra de custo, porque o bloco `attention` chega vazio. Não é um modelo caro nem barato aqui; é um modelo que nossa própria ferramentação não sabe medir. **Reabre com:** o Ollama passar a expor `head_count_kv` (ou equivalente) para a arquitetura `granitehybrid`/`granite` com SSM, ou alguém decidir uma fórmula de custo específica para camadas Mamba (estado fixo, não cresce com `num_ctx` — provavelmente **mais barato** que qualquer coisa na frota se a proporção de camadas Mamba for alta, mas isso é hipótese, não medição).

### `glm4:9b`

9,4B, 5,5 GiB (visto no site, não confirmado por `/api/show` — fora do escopo desta rodada). Mais pesado que o `qwen2.5:7b`/`qwen2.5-coder:7b` (4,36 GiB) já instalados, sem badge de `tools` visível na página — o que seria estranho pra uma família GLM-4, mais um caso de suspeitar do site antes de confirmar. Contexto não informado. **Reabre com:** um `/api/show` real — hoje não há dado suficiente pra saber se é inviável por custo ou só por falta de informação.

### `granite3.2-vision:2b`

2,53B (LM) + 442M (projetor CLIP), 2,4 GiB, contexto **16.384** — bem menor que os 262.144 declarados do `qwen3-vl:2b` já elegível (mesmo que este não alcance esse teto na prática, ainda tem mais folga real). `vision` + `tools` confirmados no site. Especializado em entendimento de documento (tabelas, gráficos, infográficos) — mesmo nicho do `glm-ocr`, mas pelo caminho de anexo de **imagem** já suportado, não pelo de OCR de PDF recusado no `ESCOPO.md`. Sem medição que mostre vantagem de custo ou qualidade sobre o `qwen3-vl:2b` já elegível para o mesmo papel. **Reabre com:** o `qwen3-vl:2b` se mostrar fraco especificamente em documento/tabela no uso real — aí compensa medir este como especialista, não como substituto geral.

---

## Descartados

Decisão fechada — medição ou decisão de produto já registrada em outro lugar do projeto. Não reabre por remedir o modelo; reabre pela condição citada, e a condição não é "testar nova versão".

### `phi4-mini`

2,32 GiB, teto declarado 131.072, `completion`, `tools`. Saindo da frota da máquina de desenvolvimento (decisão de ago/2026, remoção manual do dono do projeto — este documento não a executa) — **dominado pelo `gemma3:4b`**: mais pesado, sem `vision`, e o mais caro da frota em cache por token (128 KB/token contra ~4,3 KB do `gemma3:4b`, ~30×). O `sliding_window` de 262.144 que ele declara é **maior que o próprio teto de contexto** — inerte por construção, nunca ativa (armadilha já registrada no plano 15: testar `if (slidingWindow)` sem comparar contra o `num_ctx` classificaria este modelo como barato e erraria por vários GB). No teto que ele próprio declara pediria ~16 GiB só de cache, acima da RAM total desta máquina. Fica registrado pelo mesmo motivo do `mistral:7b`/`llama3.1:8b` (D15.8): a medição não se perde com a desinstalação, e o registro evita reinstalar por impulso. **Reabre com:** um papel que exija `tools` e não precise de `vision` nem de contexto grande — hoje o `qwen2.5:7b`/`qwen2.5-coder:7b` já cobrem `tools` sem a mesma penalidade de cache.

### `glm-ocr`

0,9B, decoder GLM-0,5B + encoder visual CogViT, 2,2 GiB, contexto 128k — o mais leve dos modelos de visão pesquisados, de longe. O caminho que resolveria de verdade — PDF escaneado sem camada de texto — está **fora do escopo por decisão de produto já registrada**, não por falta de modelo adequado: o [`ESCOPO.md`](../../ESCOPO.md#fora-do-escopo) recusa OCR porque rasterizar custaria ~80s/página nesta CPU e traria `@napi-rs/canvas` (módulo nativo) para dentro do projeto antes da hora. O gatilho que reabre isso está registrado em [`ROADMAP § 2`](../../ROADMAP.md) — **máquina com GPU**, e os três itens que ele reabre juntos (OCR, teto de documento, ~80s/página) não incluem "achar um modelo menor". Onde ele poderia servir sem tocar essa decisão: como alternativa a `gemma3:4b`/`qwen3-vl:2b` no anexo de **imagem** já suportado hoje — mas aí compete pelo mesmo papel que os elegíveis já cobrem, sem vantagem de resolver algo novo.

### `bakllava:7b`

7,24B + projetor LLaVA de 312M, 4,7 GiB, backbone Mistral 7B v0.1 (2023) com atenção plena — sem a janela deslizante que torna o `gemma3:4b` barato. Mesma silhueta do `mistral:7b`/`llama3.1:8b`, ambos desinstalados em 10/08/2026 por serem **dominados** (D15.8): maior no disco que o incumbente, sem `tools`, arquitetura de VLM mais antiga que a nativa do Gemma 3. **Descartado** pelo mesmo teste de domínio, não por um bloqueio isolado — reabriria com uma razão de especialização que hoje não existe, o mesmo padrão que já vale para os dois modelos de texto retirados.

### `codegemma:2b`

2,51B, 1,6 GiB, FIM + variante instruct disponível. Mais leve que o `qwen2.5-coder:3b` (1,80 GiB) por só 200 MiB, mas sem badge de `tools` na página e contexto não confirmado — CodeGemma é **pré-Gemma 3**, então a vantagem de janela deslizante que barateia o cache do `gemma3:4b`/`translategemma:4b` **não se estende** a ele (a mesma ressalva já registrada no `CLAUDE.md` sobre essa medida não generalizar). Sem contexto maior, sem `tools`, sem custo de KV comprovadamente menor — **dominado** pelo `qwen2.5-coder:3b` já instalado, sem um eixo em que vença.

### `openchat:7b`

7,24B, 4,1 GiB, Q4_0 — os números batem quase exatamente com o `mistral:7b` original (OpenChat 3.5 é fine-tune do Mistral 7B v0.1, mesma classe de parâmetro e peso). Sem `tools`, sem especialização documentada, mesmo porte do `qwen2.5:7b` já instalado. **Descartado** pelo mesmo teste de domínio do `mistral:7b`/`llama3.1:8b` (D15.8) — não foi medido individualmente porque a ficha já é a mesma de um modelo que passou pelo teste e perdeu.

### `granite3.3:8b`

Medido ao vivo em 20/08/2026: 4,60 GiB, 40 blocos, 8 cabeças KV, `head_dim` 128, sem janela deslizante, teto 131.072, `completion`/`tools` (o site também citava "thinking" acionado por mensagem de controle dentro do prompt — não aparece em `capabilities` mesmo que funcione, então não dá para confirmar nem negar sem testar ao vivo).

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 4,93 | 0,66 | **5,59** | calculado |
| 8k | 4,93 | 1,32 | **6,25** | calculado |
| 16k | 4,93 | 2,64 | **7,57** | calculado |
| 32k | 4,93 | 5,27 | **10,20** | calculado |
| 64k | 4,93 | 10,55 | **15,48** | calculado |
| 131.072 (teto) | 4,93 | 21,10 | **26,03** | calculado |

168,8 KiB/token — mais caro que o `qwen3:4b` (152,6) e o pior da frota inteira medida até aqui. **Dominado pelo `qwen2.5:7b`/`qwen2.5-coder:7b` já instalados** em dois eixos ao mesmo tempo: mais pesado no disco (4,60 GiB contra 4,36) e muito mais caro em cache (a 32k já custa 10,20 GiB, acima do cenário de RAM "só o app" de 9 GB — o par já instalado custa 6,54 GiB no próprio teto de 32.768) — sem uma vantagem de capacidade que compense (mesmo `tools`, sem `vision`). **Descartado** pelo teste de domínio, com número medido em vez de estimado — o caso mais claro desta rodada.
