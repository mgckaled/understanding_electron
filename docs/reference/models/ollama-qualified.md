# Modelos Ollama — frota e elegíveis

**Data:** 20/08/2026. **Motivo:** evitar o retrabalho de recalcular peso/cache KV por contexto toda vez que a frota muda — a fórmula e os fatores de correção já existiam, dispersos entre o [`plan 15`](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) (decisão) e o `CLAUDE.md` (resumo operacional); este documento é o único lugar que soma peso + KV + total por faixa de contexto, por modelo, num formato consultável sem reabrir a narrativa da decisão.

Companheiro deste arquivo: [`ollama-disqualified.md`](ollama-disqualified.md) (inviáveis e descartados). Mapa da pasta: [`README.md`](README.md).

---

## Índice

**Frota atual**

1. [`gemma3:4b`](#gemma34b)
2. [`gemma3:1b`](#gemma31b)
3. [`qwen2.5-coder:3b`](#qwen25-coder3b)
4. [`qwen3:4b`](#qwen34b)
5. [`qwen2.5:7b`](#qwen257b)
6. [`qwen2.5-coder:7b`](#qwen25-coder7b)
7. [`nomic-embed-text`](#nomic-embed-text)

**Elegíveis**

8. [`qwen3-vl:2b`](#qwen3-vl2b)
9. [`translategemma:4b`](#translategemma4b)
10. [`granite3.3:2b`](#granite332b)
11. [`yi-coder:1.5b`](#yi-coder15b)
12. [`nomic-embed-text-v2-moe`](#nomic-embed-text-v2-moe)

---

## Metodologia

Peso e cache KV nunca exigem carregar o modelo — `/api/show` devolve os parâmetros de atenção em `model_info` de graça, e o resto é aritmética (medido no plano 15, 10/08/2026, `ollama ps` vazio antes e depois).

```
bytes/token = 2 (K e V) × camadasQueCrescem × head_count_kv × head_dim × 2 (f16) × 1,055 (overhead do runner)
camadasQueCrescem = 1, se a janela deslizante estiver ativa (sliding_window < num_ctx); block_count, senão
base = peso em disco + 0,33 GiB (OVERHEAD_FIXO, D15.2 — confere um terceiro modelo dentro de 4%)
total(num_ctx) = base + bytes/token × num_ctx
```

O fator **1,055** é medido, não teórico: `qwen2.5-coder:3b` sem janela, 4.096 contra 32.768 tokens, deu 38,0 KB/token contra os 36,0 previstos pela contagem de camadas — 5,5% de overhead do runner. A família Gemma 3 (janela deslizante) tem uma correção própria, também medida: o Ollama contabiliza o crescimento do cache como se **uma única camada** escalasse com o `num_ctx`, não as ~6 que a proporção 5:1 (global:local) sugeriria. Isolada e explicada no `gemma3:4b` (4,3 KB/token medidos ÷ 4 KB que uma camada custa = 1,07 camadas); estendida aqui ao `gemma3:1b` e ao `translategemma:4b` por identidade de arquitetura, não por medição direta em cada um — marcado onde se aplica.

Todas as colunas em **GiB** (1024³ bytes), a mesma unidade em que a RAM livre desta máquina é lida — soma direta, sem conversão. Confirmado ao vivo em 20/08/2026 via `/api/show`: os parâmetros de atenção do `gemma3:4b`, `qwen2.5-coder:3b` e `qwen2.5-coder:7b` batem exatamente com os que o plano 15 já tinha registrado, então a fórmula e os fatores foram reaproveitados sem remedir.

**Legenda de proveniência:** ✔ **medido** (RAM residente antes/depois, ou tabela do plano 15 marcada como medida) · **calculado** (fórmula aplicada a um `/api/show` real, sem carregar o modelo) · **calculado, arquitetura equivalente** (mesma fórmula, mas o fator de correção foi validado noutro modelo da mesma família, não neste).

Cenários de RAM livre desta máquina, para cruzar com a coluna Total: **~6 GB** (ambiente de trabalho típico) · **~7,5 GB** (só VS Code) · **~9 GB** (só o app). Detalhe e por que variam 3 GB: [`CLAUDE.md`](../../../CLAUDE.md#ambiente-de-desenvolvimento).

---

## Frota atual

### `gemma3:4b`

Peso 3,11 GiB · teto declarado 131.072 · janela deslizante 1.024 · `completion`, `vision` · **default do app**.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 3,44 | 0,017 | **3,46** | calculado |
| 8k | 3,44 | 0,034 | **3,47** | calculado |
| 16k | 3,44 | 0,067 | **3,51** | calculado |
| 32k | 3,44 | 0,134 | **3,57** | calculado, confere com o plano 15 |
| 64k | 3,44 | 0,269 | **3,71** | calculado |
| 131.072 (teto) | 3,44 | 0,537 | **3,98** | calculado, confere com o plano 15 |

⚠️ **`base = disco + 0,33` é uma constante ajustada, não universal — e neste modelo ela erra para cima.** O plano 15 também mediu RAM residente direto (`ollama ps`, descarregando entre medidas), sem passar pela fórmula: **2,91 / 2,95 / 3,03 GB** a 4.096 / 16.384 / 32.768 — contra os 3,46 / 3,51 / 3,57 GiB calculados acima, uma diferença de ~0,5 GiB que não fecha nem convertendo unidade. `disco` (o que `/api/tags` reporta) e o **residente real** são grandezas diferentes por construção — o próprio `normalizeOllamaRunning` (`src/core/ai/models.ts`) documenta que `/api/ps` mede "pesos mais o cache KV da janela carregada", não o tamanho em disco, "e é por isso que os dois nunca concordam". O `OVERHEAD_FIXO` de 0,33 GiB foi calibrado e confere um terceiro modelo dentro de 4% (`HISTORY.md`) — **três modelos, não a frota inteira**; no `gemma3:4b` ele fica ~0,5 GiB alto. Para orçar RAM o efeito é conservador (superestima, não subestima), mas quem comparar esta tabela contra um `ollama ps` ao vivo vai ver um número menor — esperado, não erro de leitura. Recalibrar `OVERHEAD_FIXO` por família de modelo, e não como constante única, é o que resolveria isto de vez.

**No app:** é o único modelo da frota cujo teto declarado é financiável em RAM mesmo pela leitura mais conservadora (a fórmula) — a janela deslizante o torna barato em qualquer escala, inclusive no teto. O que o mantém fora de contextos grandes não é memória, são os **~87 minutos de prefill a 25 tok/s** em 131.072 tokens nesta CPU sem aceleração — outra grandeza, medida à parte. É o único com `vision`, o que o torna o modelo do anexo de imagem por ausência de concorrente instalado, não por escolha entre pares. Ver também [`translategemma:4b`](#translategemma4b), arquitetura idêntica.

### `gemma3:1b`

Peso 0,76 GiB · teto declarado 32.768 · janela deslizante 512 · `completion` · fallback de baixa RAM.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 1,09 | 0,004 | **1,09** | calculado |
| 8k | 1,09 | 0,008 | **1,10** | calculado |
| 16k | 1,09 | 0,016 | **1,11** | calculado |
| 32.768 (teto) | 1,09 | 0,033 | **1,12** | calculado, arquitetura equivalente |

**No app:** cabe inteiro, no teto declarado, em qualquer um dos três cenários de RAM desta máquina — é o único modelo da frota sem ressalva de contexto. Contrapartida já registrada: é o mais fraco em síntese, e o gatilho de truncamento silencioso (histórico maior que o `num_ctx` some sem aviso do próprio Ollama) foi medido justamente nele.

### `qwen2.5-coder:3b`

Peso 1,80 GiB · teto declarado 32.768 · sem janela deslizante · `completion`, `tools`, `insert` · candidato a default do caminho NL→SQL.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 2,13 | 0,148 | **2,28** | calculado |
| 8k | 2,13 | 0,297 | **2,42** | calculado |
| 16k | 2,13 | 0,594 | **2,72** | calculado |
| 32.768 (teto) | 2,13 | 1,19 | **3,32** | ✔ medido |

**No app:** cabe com folga nos três cenários de RAM (3,32 GiB contra o pior caso de 6 GB), e é o modelo cuja medição direta (38,0 KB/token) calibrou o fator de overhead de 1,055 usado em toda a tabela deste documento. É a especialização em código **e** a folga de RAM juntas, não uma ou outra, que o tornam candidato ao papel NL→SQL — o `qwen2.5-coder:7b` tem a mesma especialização sem a mesma folga.

### `qwen3:4b`

Peso 2,33 GiB · teto declarado 262.144 · sem janela deslizante (atenção plena) · `completion`, `tools`, `thinking` · único com raciocínio nativo — hoje descartado com `think: false`.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4.096 | 2,66 | 0,60 | **3,26** | calculado — confere com o `CLAUDE.md` |
| 8k | 2,66 | 1,19 | **3,85** | calculado |
| 16k | 2,66 | 2,39 | **5,05** | calculado |
| 32k | 2,66 | 4,77 | **7,43** | calculado |
| 64k | 2,66 | 9,54 | **12,20** | calculado |
| 131.072 | 2,66 | 19,08 | **21,74** | calculado — acima da RAM total da máquina |
| 262.144 (teto declarado) | — | — | **~41** | não calculado — nominal, inatingível em qualquer máquina doméstica |

A linha de 4.096 confere com os "3,5 GB reais / 3,43 GB previstos" já publicados no `CLAUDE.md` — **em GB decimal**, não GiB: 3,5×10⁹ bytes ÷ 1024³ = 3,26 GiB, e 2,5 (peso decimal do `CLAUDE.md`) + 0,33 + 0,60 = 3,43. As duas fontes concordam; a primeira redação deste documento tratou "3,5 GB" como GiB por engano e retroajustou a base sem precisar — corrigido. Achado de bônus: é outro caso do mesmo tipo de armadilha de unidade que a Metodologia adverte — números importados de outro documento carregam a unidade **daquele** documento, não a deste.

**No app:** é a família mais cara da frota em cache por token — pior até que o `phi4-mini` que está saindo da frota. O teto de 262.144 é só um número no `/api/tags`: a 32k já custa 7,43 GiB, acima do cenário de RAM "só o app" (9 GB) com pouca margem, e acima dos cenários mais apertados sem ambiguidade. Hoje o app descarta a fase de raciocínio (`think: false`), então o app paga o cache caro de um recurso que não está exposto na conversa — o roadmap #21 (thinking mode) é o que justificaria mantê-lo.

### `qwen2.5:7b`

Peso 4,36 GiB · teto declarado 32.768 · sem janela deslizante · `completion`, `tools` · qualidade máxima de uso geral.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 4,69 | 0,23 | **4,92** | calculado |
| 8k | 4,69 | 0,46 | **5,15** | calculado |
| 16k | 4,69 | 0,92 | **5,61** | calculado |
| 32.768 (teto) | 4,69 | 1,85 | **6,54** | calculado |

**No app:** só cabe nos cenários de RAM "só VS Code" (7,5 GB) e "só o app" (9 GB) — no cenário típico de desenvolvimento (6 GB) fica de fora, junto com o `qwen2.5-coder:7b`. Mesma arquitetura de atenção do par abaixo; a única diferença entre os dois é a capability `insert`.

### `qwen2.5-coder:7b`

Peso 4,36 GiB · teto declarado 32.768 · sem janela deslizante · `completion`, `tools`, `insert` · teto de qualidade em código.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 4,69 | 0,23 | **4,92** | calculado |
| 8k | 4,69 | 0,46 | **5,15** | calculado |
| 16k | 4,69 | 0,92 | **5,61** | calculado |
| 32.768 (teto) | 4,69 | 1,85 | **6,54** | calculado |

**No app:** tabela idêntica ao `qwen2.5:7b` — mesmo `block_count`, `head_count_kv` e `head_dim`. Escolha deliberada de manter os dois instalados apesar do custo igual: um é uso geral, o outro é código; nenhum dos dois é default.

### `nomic-embed-text`

Peso 0,255 GiB · teto declarado 2.048 · `embedding` · embedder da D9.5.

Sem escada de contexto: um embedder faz uma passada só por texto (o vetor de saída, não geração token a token), então não acumula cache KV incremental — `/api/show` não relata `head_count_kv` nem `sliding_window` para ele, e `readAttention()` (`src/core/ai/models.ts`) devolve `null` de propósito. 768 dimensões, `block_count` 12. **No app:** reservado para RAG (D9.5), ainda sem consumidor — entra quando existir corpus que justifique busca vetorial.

---

## Elegíveis

Analisados, sem bloqueio técnico encontrado, sem papel atribuído ainda. Medição preliminar via `/api/show` em 20/08/2026 — modelo puxado só para a leitura, removido em seguida (`ollama rm`) para a frota real não divergir do que este documento descreve.

### `qwen3-vl:2b`

Peso 1,76 GiB · teto declarado 262.144 · sem janela deslizante · `completion`, `vision`, `tools`, `thinking` — o único candidato que reuniria visão **e** `tools`/`thinking` na mesma chamada, capacidade que nenhum modelo instalado tem hoje. Herda o perfil caro da família `qwen3` de texto (28 blocos, 8 cabeças KV, `head_dim` 128, atenção plena — mesma forma do `qwen3:4b`, não a do `gemma3`).

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 2,09 | 0,46 | **2,55** | calculado |
| 8k | 2,09 | 0,92 | **3,01** | calculado |
| 16k | 2,09 | 1,85 | **3,94** | calculado |
| 32k | 2,09 | 3,69 | **5,78** | calculado |
| 64k | 2,09 | 7,39 | **9,48** | calculado |
| 131.072 | 2,09 | 14,77 | **16,86** | calculado — acima da RAM total da máquina |
| 262.144 (teto) | 2,09 | 29,54 | **31,63** | calculado — nominal, inatingível |

**No app:** cabe folgado até ~16k e já aperta a 32k; o teto de 262.144 do `/api/tags` é tão inatingível aqui quanto o do `qwen3:4b`. Elegível como modelo de visão de **contexto moderado** com `tools`/`thinking` de brinde, não como um `gemma3:4b` com teto maior.

### `translategemma:4b`

Peso 3,07 GiB · teto declarado 131.072 · janela deslizante 1.024 · `completion`, `vision` — sem `tools`, sem `thinking`, modelo de propósito único (tradução em 55 idiomas, prompt fixo de par de idiomas, sem chat geral). Arquitetura **idêntica** à do `gemma3:4b` (34 blocos, 4 cabeças KV, `head_dim` 256, mesma janela, mesmo encoder de visão de 27 blocos/1.152 dims) — mesmo backbone Gemma 3 4B, fine-tunado diferente.

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 3,40 | 0,017 | **3,42** | calculado, arquitetura equivalente |
| 8k | 3,40 | 0,034 | **3,43** | calculado, arquitetura equivalente |
| 16k | 3,40 | 0,067 | **3,47** | calculado, arquitetura equivalente |
| 32k | 3,40 | 0,134 | **3,53** | calculado, arquitetura equivalente |
| 64k | 3,40 | 0,269 | **3,67** | calculado, arquitetura equivalente |
| 131.072 (teto) | 3,40 | 0,537 | **3,94** | calculado, arquitetura equivalente |

A correção "1 camada cresce" medida no `gemma3:4b` deveria se transferir por identidade de arquitetura, não por coincidência — daí "arquitetura equivalente" em vez de "calculado" puro; ainda não confirmada por medição direta de RAM residente deste modelo especificamente (é o que falta para virar ✔ medido). **No app:** capacidade **nova**, não substituta — nenhum modelo da frota tem papel de tradução hoje. Passa no teste de pilar do [`ESCOPO.md`](../../ESCOPO.md#o-teste-que-separa-pilar-de-produto-novo) **se** a feature for "traduzir texto na conversa" — traduzir e exportar um arquivo esbarraria na regra de que documento nunca é saída.

### `granite3.3:2b`

Peso 1,44 GiB · teto declarado 131.072 · sem janela deslizante · `completion`, `tools` · IBM Granite 3.3, arquitetura transformer padrão (40 blocos, 8 cabeças KV, `head_dim` 64).

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 1,77 | 0,33 | **2,10** | calculado |
| 8k | 1,77 | 0,66 | **2,43** | calculado |
| 16k | 1,77 | 1,32 | **3,09** | calculado |
| 32k | 1,77 | 2,64 | **4,41** | calculado |
| 64k | 1,77 | 5,27 | **7,04** | calculado |
| 131.072 (teto) | 1,77 | 10,55 | **12,32** | calculado |

**No app:** cabe nos três cenários de RAM até 32k (4,41 GiB, ainda abaixo do cenário típico de 6 GB) — mais caro por token que o `qwen2.5-coder:3b` (84,4 KiB contra 38,0 KB), mas ainda numa faixa confortável até contexto moderado. Não tem especialização em código nem em SQL; o que ele traria que nada na frota tem é `tools` num modelo de propósito geral menor que o `qwen2.5:7b`. Site também citou "thinking" acionado por mensagem de controle dentro do prompt — diferente de uma capability declarada, não aparece em `capabilities` mesmo que funcione; sem testar o controle ao vivo, não dá para confirmar nem negar (situação diferente da contradição direta de badges do `qwen3:1.7b`).

### `yi-coder:1.5b`

Peso 0,81 GiB · teto declarado 131.072 · sem janela deslizante · `completion` (sem `tools`) · 01.AI Yi-Coder, arquitetura `llama` com atenção **MHA, não GQA** (`head_count_kv` 16 = `head_count` 16 — nenhum outro modelo desta frota tem as cabeças KV iguais às de query).

| Contexto | Peso | KV cache | **Total** | Proveniência |
|---|---|---|---|---|
| 4k | 1,14 | 0,79 | **1,93** | calculado |
| 8k | 1,14 | 1,58 | **2,72** | calculado |
| 16k | 1,14 | 3,16 | **4,30** | calculado |
| 32k | 1,14 | 6,33 | **7,47** | calculado |
| 64k | 1,14 | 12,66 | **13,80** | calculado |
| 131.072 (teto) | 1,14 | 25,31 | **26,45** | calculado |

**Achado do template, verificado com `ollama show --modelfile`, não só o site:** ao contrário do `granite-code`/`starcoder2`/`sqlcoder` (FIM cru, sem estrutura de turno), o `yi-coder:1.5b` tem um `TEMPLATE` ChatML completo (`<|im_start|>{{ .Role }}`) — os marcadores `<fim_prefix>`/`<fim_suffix>`/`<fim_middle>` aparecem só como `stop`, não como o template padrão. É o primeiro modelo de código pequeno pesquisado nesta trilha que **não** esbarra no problema de template. **No app:** a MHA sem GQA é o que o torna caro em cache apesar do arquivo minúsculo (0,81 GiB) — 202,6 KiB/token, o mais caro por token de toda a análise até aqui, pior que o `qwen3:4b`. Cabe folgado até 16k (4,30 GiB) e já é ambíguo a 32k (7,47 GiB, no limiar do cenário "só VS Code"); acima disso, inviável em qualquer cenário desta máquina. Elegível como opção **ultraleve de contexto baixo**, não como substituto do `qwen2.5-coder:3b` em tarefas que exigem janela maior.

### `nomic-embed-text-v2-moe`

Peso 0,89 GiB · teto declarado 512 · `embedding` · mistura de especialistas (8 no total, 2 ativos por token — `expert_count`/`expert_used_count` confirmados via `/api/show`), 475M parâmetros totais / ~305M ativos por inferência, 768 dimensões nativas (técnica Matryoshka permite truncar para até 256 sem retreinar, segundo a ficha do modelo — não confirmado por medição própria). Mesma família do `nomic-embed-text` (D9.5), `block_count` 12, sem escada de contexto pelo mesmo motivo do embedder já instalado (passada única, sem cache KV incremental).

**No app:** sem consumidor hoje — RAG ainda não tem corpus que o justifique, mesmo status do `nomic-embed-text` já instalado. A diferença que importaria **quando** RAG existir: o v2-moe declara suporte a ~100 idiomas contra um `nomic-embed-text` v1 pouco documentado em português, o que pesa numa conversa que é majoritariamente em português. Contrapartida real: teto de contexto caiu de 2.048 (v1, já instalado) para **512** — um quarto — então os pedaços de texto indexados teriam que ser bem menores. Elegível pelo mesmo motivo do `deepseek-r1:1.5b`: sem defeito técnico, sem papel ainda.
