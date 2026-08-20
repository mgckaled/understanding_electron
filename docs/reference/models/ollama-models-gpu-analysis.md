# Aceleração por GPU (MX150) para modelos Ollama — análise e teste

**Data:** 20/08/2026. **Motivo:** a máquina de desenvolvimento tem uma GPU (NVIDIA MX150, 2 GB VRAM) com CUDA já configurado — herança do mill.tools, que a usa para o Whisper — mas o crivo hoje presume CPU-only em toda a documentação (`CLAUDE.md § Ambiente de desenvolvimento`). Cogitou-se usar a GPU só para modelos cuja pegada de memória cabe folgada nos 2 GB, com `keep_alive` curto como salvaguarda. Este documento é o teste dessa ideia, ao vivo, nesta máquina.

Companheiro: [`ollama-qualified.md`](ollama-qualified.md) (a tabela de peso/KV que definiu qual modelo testar). Mapa da pasta: [`README.md`](README.md).

**Resultado em uma frase:** GPU ganha no prefill em qualquer escala testada, mas perde — de forma severa e reprodutível — na geração assim que o contexto cresce, e a causa não é falta de VRAM. **Recomendação: não vale a pena construir isto agora**, nem para o único modelo cuja pegada cabe na placa.

---

## Por que só o `gemma3:1b`

Da frota inteira, é o **único** modelo cuja pegada de memória cabe com folga nos 2 GB de VRAM da MX150 em qualquer contexto: 1,09–1,12 GiB, do menor ao teto declarado de 32.768 (tabela completa em [`ollama-qualified.md`](ollama-qualified.md#gemma31b)). O default (`gemma3:4b`) já passa de 2 GB a partir de ~8k de contexto — fora de cogitação para GPU total nesta placa.

## Por que a pergunta não é só "cabe na VRAM"

O mill.tools (projeto irmão, mesma máquina) reserva a MX150 **inteira** para o Whisper via CUDA — não por escolha arbitrária, mas porque documenta um BSOD (`WIN32K_POWER_WATCHDOG_TIMEOUT`) medido ao disputar a GPU entre Whisper e um LLM ao mesmo tempo. Ligar GPU no crivo reabriria exatamente essa disputa entre dois aplicativos independentes que o usuário pode ter abertos ao mesmo tempo. Este teste rodou com a GPU 100% livre (só VS Code e o processo do Claude Code abertos) — a questão da contenção com o mill.tools **não foi testada aqui** e continua em aberto se a ideia avançar.

---

## Protocolo

Sem tocar em código do app: chamadas diretas ao `/api/generate` do Ollama (`localhost:11434`), forçando `num_gpu: 999` (offload total) ou `num_gpu: 0` (CPU pura) via `options`, com `keep_alive` explícito e descarregado (`keep_alive: 0`) entre cada medida — mesma disciplina de "um modelo residente por vez" já em uso neste projeto para sondar o Ollama. Os campos de tempo vêm da própria resposta da API (`prompt_eval_count`/`_duration`, `eval_count`/`_duration`, em nanossegundos) — não é relógio de parede externo.

**O `PROCESSOR` do `ollama ps` foi confirmado durante a execução, não só antes/depois.** Numa terceira rodada a ~23k, `ollama ps` foi amostrado a cada 10s em paralelo à chamada de geração — 22 amostras, **todas "100% GPU"**, do início ao fim (ver tabela de Resultados). Isso descarta a hipótese de offload parcial (Ollama dividindo camadas entre CPU e GPU por a placa não caber o modelo inteiro a 32k) — o que seria uma explicação completamente diferente do achado, e uma que só apareceria olhando o processo em andamento.

Dois cenários:

- **4k de contexto** — prompt curto (23 tokens), geração livre (o modelo parou sozinho, sem teto de `num_predict`).
- **~23k de contexto** — prompt de preenchimento (~99.305 caracteres de texto em português repetidos, mais uma pergunta final), com `num_predict: 300` limitando a geração. O tamanho real do prompt veio do próprio `prompt_eval_count` da resposta — **23.241 tokens, idêntico nas três rodadas** que usaram este prompt, então a comparação é sobre exatamente a mesma entrada.

---

## Resultados

| Contexto | Modo | Prefill | Geração | Observação |
|---|---|---|---|---|
| 4k (23 tokens) | GPU | 78,68 tok/s | 25,08 tok/s | `ollama ps`: 100% GPU · VRAM residente 965 MiB |
| 4k (23 tokens) | CPU | 62,44 tok/s | 22,10 tok/s | `ollama ps`: 100% CPU |
| ~23k (23.241 tokens) | GPU — rodada 1 | 75,02 tok/s | 3,10 tok/s | parou em 169/300 tokens (EOS natural) |
| ~23k (23.241 tokens) | GPU — rodada 2 | 91,34 tok/s | 3,84 tok/s | parou em 204/300 tokens (EOS natural); rodada com amostragem de VRAM em paralelo |
| ~23k (23.241 tokens) | GPU — rodada 3 | 159,6 tok/s | 3,20 tok/s | parou em 177/300 tokens (EOS natural); rodada com `ollama ps` amostrado a cada 10s — **22/22 amostras em 100% GPU** |
| ~23k (23.241 tokens) | CPU — **n=1** | 44,25 tok/s | 12,88 tok/s | atingiu o teto de 300/300 tokens (não parou por EOS) |

**A 4k, GPU ganha nos dois eixos** — prefill ~26% mais rápido, geração ~13,5% mais rápida. Diferença real, mas modesta.

**A ~23k, a imagem se inverte na geração.** Prefill continua favorecendo GPU **como leitura direcional, não como número firme** — o valor variou demais entre as três rodadas (75,0 / 91,3 / 159,6 tok/s, um espalhamento de mais de 2× sobre a mesma entrada) para tratar qualquer um deles como preciso; a diferença provavelmente não é cache de disco (isso explicaria `load_duration`, não `prompt_eval_duration`, que é compute-bound sobre 23 mil tokens), mas a causa não foi investigada. O que sustenta é só a direção: em nenhuma das três rodadas a GPU chegou perto de perder para os 44,2 tok/s da CPU. A geração, que é o que domina o tempo de resposta numa conversa real e onde este documento apoia a recomendação, é o eixo estável: **3,10 / 3,84 / 3,20 tok/s nas três rodadas de GPU** (média 3,38, variação pequena) contra **12,88 tok/s numa única rodada de CPU** — uma diferença de 3,4× a 4,2× dependendo de qual das três rodadas de GPU se usa como referência. **A amostra de CPU é n=1**; uma segunda rodada apertaria o número exato, mas dificilmente mudaria a ordem de grandeza — mesmo a rodada de GPU mais rápida (3,84 tok/s) fica a menos de um terço do único número de CPU.

## VRAM durante a rodada — descartando a hipótese óbvia

A explicação mais imediata para "GPU lenta a contexto grande" seria estouro de VRAM — o Windows, via WDDM, pode trocar memória de GPU com RAM do sistema via PCIe quando a placa satura, o que é catastroficamente lento. **Medido, não é isso.** Amostrado `nvidia-smi` a cada 10s durante toda a segunda rodada de GPU a ~23k (≈5 minutos):

| Métrica | Valor observado |
|---|---|
| VRAM usada | estável em **1.102–1.113 MiB**, do início ao fim |
| Teto da placa | 2.048 MiB — nunca passou de ~54% do teto |
| Utilização da GPU | **99–100%** constante durante prefill e geração, caindo a 0–2% só no instante final |

VRAM nunca chegou perto do teto — isso descarta com confiança a hipótese de estouro/troca com RAM via WDDM. `utilization.gpu` a 99-100% é um sinal mais fraco do que parece: essa métrica só reporta a fração do tempo com **pelo menos um kernel residente**, não o quanto os núcleos da placa estavam de fato ocupados computando — uma sequência de kernels pequenos e frequentes pode manter o contador em 100% com as unidades de execução majoritariamente ociosas entre um lançamento e outro. O que ela prova é mais estreito: **a GPU não estava parada nem esperando em fila** — não que estava computando com eficiência. O número de VRAM residente (1.102–1.113 MiB ≈ 1,08–1,09 GiB) confere de perto com o 1,12 GiB calculado em [`ollama-qualified.md`](ollama-qualified.md#gemma31b) para este modelo no teto de contexto — validação cruzada da fórmula por um método de medição totalmente diferente (VRAM via `nvidia-smi`, não RAM residente via `ollama ps`).

Uma segunda corroboração, de um terceiro instrumento: o próprio `ollama ps` reportou `SIZE` **877 MB a 4.096 de contexto** (rodada 1) e **906 MB a 32.768** (rodada 3) — ~29 MB de crescimento sobre um aumento de 8× no contexto. É o mesmo padrão de "só ~1 camada cresce de verdade" que a fórmula da janela deslizante prevê, agora visto por três medidas independentes (VRAM via `nvidia-smi`, SIZE via `ollama ps`, e o cálculo de `ollama-qualified.md`) que concordam entre si.

## Por que a geração desaba — em aberto, e não pelo motivo mais óbvio

**A CPU também degradou** com o contexto maior — 22,1 → 12,9 tok/s, uma queda de 42% — só que muito menos que a GPU (25,1 → ~3,4 tok/s, queda de ~87%). Alguma coisa dependente do tamanho do contexto pesa nos dois caminhos; o que muda é o quanto. Isso por si só derruba qualquer explicação que dependa só de "GPU sem tensor core" — a CPU também não tem tensor core, e degradou bem menos.

**A explicação mais intuitiva — "a cada token, a GPU tem que varrer um cache KV de ~23 mil posições" — contradiz o que este mesmo documento usa para validar a VRAM.** O `gemma3:1b` tem janela deslizante (`sliding_window: 512`), e a metodologia de [`ollama-qualified.md`](ollama-qualified.md#metodologia) mede que, para esta família, só **~1 camada lógica** cresce com o `num_ctx` — é exatamente essa contabilidade que faz o VRAM residente medido aqui (1,08–1,09 GiB) bater com o 1,12 GiB calculado no teto de 32.768. Se o modelo de custo por trás dessa fórmula estiver certo, o custo de atenção por token deveria ficar **quase constante** com o contexto, não cair 8× — a fórmula foi calibrada para *memória*, não para *tempo de computação por token*, e pode não valer para a segunda grandeza. **Este documento não resolve essa contradição.** A leitura mais honesta é: a queda de geração na GPU é real, grande e reproduzida três vezes — mas o mecanismo exato não está confirmado, e a primeira hipótese óbvia (custo de atenção crescendo linearmente com o contexto) não se sustenta sem também explicar por que a mesma fórmula prevê pouco crescimento de memória. Profiling de kernel resolveria isso; não foi feito aqui.

---

## Recomendação

**Não vale a pena construir isto agora**, nem restrito ao único modelo cuja pegada cabe na placa. A contexto curto, onde a maior parte de uma conversa acontece, o ganho é marginal (~13% na geração) — não paga a complexidade de um segundo orçamento de memória (VRAM, ao lado do `os.freemem()` que toda a fase 15 já usa) nem o risco de reabrir a disputa de GPU com o Whisper do mill.tools. A contexto grande — justamente o cenário que motivou a pergunta original ("modelos com teto de contexto folgado para VRAM") — é uma **regressão clara e reproduzida**, não uma vantagem.

⚠️ **Amostra de um modelo, uma GPU, uma sessão de medição.** Não generalizar para outro hardware, outro modelo ou outra versão do Ollama/driver CUDA sem remedir — o mesmo cuidado que rege toda medição de máquina neste projeto (`CLAUDE.md`: "ao trocar de máquina, refazer a medição").

## Se alguém quiser aprofundar

Não feito aqui, por estar fora do escopo desta rodada:

- **Profiling de kernel** — para achar o mecanismo real por trás da queda de geração na GPU, já que a hipótese mais óbvia (custo de atenção crescendo com o contexto) contradiz a própria fórmula de memória usada para validar a VRAM neste documento.
- **Contexto intermediário (8k/16k)** — para achar o ponto de cruzamento onde a CPU passa a vencer na geração, em vez de só os dois extremos testados.
- **Offload parcial** (`num_gpu` com um número específico de camadas, não *all-or-nothing*) — meio-termo que pode evitar o pior da GPU em decode sem abrir mão do ganho no prefill.
- **Tempo até o primeiro token (TTFT)**, separado do throughput sustentado — numa conversa curta, TTFT pesa mais na percepção do que tok/s de geração em regime.
- **Outro modelo pequeno** (ex. `yi-coder:1.5b`, MHA sem GQA — perfil de cache bem diferente do `gemma3:1b`) — para saber se o padrão medido aqui é geral ou peculiar à janela deslizante do Gemma 3.
