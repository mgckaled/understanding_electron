# Aceleração por GPU (MX150) para modelos Ollama — análise e teste

**Data:** 20/08/2026. **Motivo:** a máquina de desenvolvimento tem uma GPU (NVIDIA MX150, 2 GB VRAM) com CUDA já configurado — herança do mill.tools, que a usa para o Whisper — mas o crivo hoje presume CPU-only em toda a documentação (`CLAUDE.md § Ambiente de desenvolvimento`). Cogitou-se usar a GPU só para modelos cuja pegada de memória cabe folgada nos 2 GB, com `keep_alive` curto como salvaguarda. Este documento é o teste dessa ideia, ao vivo, nesta máquina.

Companheiro: [`ollama-qualified.md`](ollama-qualified.md) (a tabela de peso/KV que definiu qual modelo testar). Mapa da pasta: [`README.md`](README.md).

**Resultado em uma frase:** GPU ganha no prefill em qualquer escala testada, mas perde — de forma severa, reprodutível, e **já plenamente instalada a partir de 8k** — na geração, e a causa não é falta de VRAM. **Recomendação: não vale a pena construir isto agora**, nem para o único modelo cuja pegada cabe na placa.

---

## Por que só o `gemma3:1b`

Da frota inteira, é o **único** modelo cuja pegada de memória cabe com folga nos 2 GB de VRAM da MX150 em qualquer contexto: 1,09–1,12 GiB, do menor ao teto declarado de 32.768 (tabela completa em [`ollama-qualified.md`](ollama-qualified.md#gemma31b)). O default (`gemma3:4b`) já passa de 2 GB a partir de ~8k de contexto — fora de cogitação para GPU total nesta placa.

## Por que a pergunta não é só "cabe na VRAM"

O mill.tools (projeto irmão, mesma máquina) reserva a MX150 **inteira** para o Whisper via CUDA — não por escolha arbitrária, mas porque documenta um BSOD (`WIN32K_POWER_WATCHDOG_TIMEOUT`) medido ao disputar a GPU entre Whisper e um LLM ao mesmo tempo. Ligar GPU no crivo reabriria exatamente essa disputa entre dois aplicativos independentes que o usuário pode ter abertos ao mesmo tempo. Este teste rodou com a GPU 100% livre (só VS Code e o processo do Claude Code abertos) — a questão da contenção com o mill.tools **não foi testada aqui** e continua em aberto se a ideia avançar.

---

## Protocolo

Sem tocar em código do app: chamadas diretas ao `/api/generate` do Ollama (`localhost:11434`), forçando `num_gpu: 999` (offload total) ou `num_gpu: 0` (CPU pura) via `options`, com `keep_alive` explícito e descarregado (`keep_alive: 0`) entre cada medida — mesma disciplina de "um modelo residente por vez" já em uso neste projeto para sondar o Ollama. Os campos de tempo vêm da própria resposta da API (`prompt_eval_count`/`_duration`, `eval_count`/`_duration`, em nanossegundos) — não é relógio de parede externo.

⚠️ **O Gerenciador de Tarefas do Windows não é a ferramenta certa para acompanhar isto ao vivo.** Os quatro gráficos padrão da aba GPU mostram os motores "3D"/"Copy"/"Video Decode"/"Video Encode" — nenhum deles é o motor de **compute/CUDA** (`Compute_0`) onde o Ollama roda. É preciso trocar manualmente um dos gráficos para "Cuda"/`Compute_0` para ver o número real; sem isso, o Gerenciador de Tarefas pode mostrar <30% com a GPU genuinamente saturada. `nvidia-smi --query-gpu=utilization.gpu` (usado neste documento) agrega todos os motores e não sofre desse problema.

**O `PROCESSOR` do `ollama ps` foi confirmado durante a execução, não só antes/depois.** Numa terceira rodada a ~23k, `ollama ps` foi amostrado a cada 10s em paralelo à chamada de geração — 22 amostras, **todas "100% GPU"**, do início ao fim (ver tabela de Resultados). Isso descarta a hipótese de offload parcial (Ollama dividindo camadas entre CPU e GPU por a placa não caber o modelo inteiro a 32k) — o que seria uma explicação completamente diferente do achado, e uma que só apareceria olhando o processo em andamento.

Três cenários — e o primeiro **não é comparável aos outros dois** no eixo que importa, ver aviso abaixo:

- **4k de contexto, prompt curto** — só 23 tokens de entrada, geração livre (o modelo parou sozinho, sem teto de `num_predict`). O `num_ctx` reservado era 4.096, mas o cache real ficou quase vazio durante a geração.
- **8k de contexto, prompt largo** — prompt de preenchimento real (~30.905 caracteres de texto em português repetidos, mais uma pergunta final) atingindo **7.241 tokens**, com `num_predict: 300` limitando a geração.
- **~23k de contexto, prompt largo** — mesma técnica, prompt maior, **23.241 tokens**, também com `num_predict: 300`.

⚠️ **A rodada de 4k testa uma coisa diferente das outras duas, e isso importa para a leitura do resultado.** Ela varia o *teto reservado* (`num_ctx`) com um cache quase vazio; as rodadas de 8k e ~23k variam o *cache de fato ocupado* no momento da geração. Se a causa da queda for o tamanho do cache já preenchido (a hipótese mais intuitiva, discutida e não confirmada abaixo), o eixo que separa "rápido" de "lento" não é exatamente "`num_ctx` grande", é "muito conteúdo já no cache quando a geração começa" — os dois normalmente andam juntos numa conversa real, mas não são a mesma variável.

---

## Resultados

| Contexto | Modo | Prefill | Geração | Observação |
|---|---|---|---|---|
| 4k, prompt curto (23 tokens) | GPU | 78,68 tok/s | 25,08 tok/s | `ollama ps`: 100% GPU · VRAM residente 965 MiB · `SIZE` 877 MB |
| 4k, prompt curto (23 tokens) | CPU | 62,44 tok/s | 22,10 tok/s | `ollama ps`: 100% CPU |
| 8k, prompt largo (7.241 tokens) | GPU | 191,7 tok/s | **3,35 tok/s** | `ollama ps`: 100% GPU · `SIZE` 881 MB · 23 amostras de `nvidia-smi`/`ollama ps` a cada 5s, todas 100% GPU, VRAM 978-990 MiB |
| 8k, prompt largo (7.241 tokens) | CPU — **n=1** | 38,75 tok/s | 13,22 tok/s | atingiu o teto de 261/300 (perto do cap) |
| ~23k, prompt largo (23.241 tokens) | GPU — rodada 1 | 75,02 tok/s | 3,10 tok/s | parou em 169/300 tokens (EOS natural) |
| ~23k, prompt largo (23.241 tokens) | GPU — rodada 2 | 91,34 tok/s | 3,84 tok/s | parou em 204/300 tokens (EOS natural); rodada com amostragem de VRAM em paralelo |
| ~23k, prompt largo (23.241 tokens) | GPU — rodada 3 | 159,6 tok/s | 3,20 tok/s | parou em 177/300 tokens (EOS natural); rodada com `ollama ps` amostrado a cada 10s — **22/22 amostras em 100% GPU** · `SIZE` 906 MB |
| ~23k, prompt largo (23.241 tokens) | CPU — **n=1** | 44,25 tok/s | 12,88 tok/s | atingiu o teto de 300/300 tokens (não parou por EOS) |

**A 4k com prompt curto, GPU ganha nos dois eixos** — prefill ~26% mais rápido, geração ~13,5% mais rápida. Diferença real, mas modesta — e, como o aviso acima explica, esta rodada tem o cache quase vazio; não é o mesmo tipo de carga das duas seguintes.

**O achado principal: entre 8k e ~23k de cache ocupado — o intervalo onde os dois pontos são comparáveis de verdade — a geração já está estável nos dois caminhos, e a GPU perde por ~4× nos dois extremos desse intervalo.** GPU: 3,35 tok/s a 8k contra 3,10-3,84 tok/s a ~23k (praticamente parado). CPU: 13,22 tok/s a 8k contra 12,88 tok/s a ~23k (também praticamente parado). A relação GPU/CPU não se move nesse intervalo: **3,95× mais lenta a 8k, 3,4× a 4,2× mais lenta a ~23k** — a mesma ordem de grandeza nos dois pontos medidos.

**Onde a penalidade começa a aparecer não foi medido.** O único ponto mais baixo disponível — a rodada de 4k — muda duas coisas ao mesmo tempo (cache quase vazio *e* teto de contexto menor), então não dá para atribuir a diferença entre "25,08 tok/s ali" e "3,35 tok/s em 8k" especificamente ao tamanho do cache sem também poder ser, em parte, sobre o `num_ctx` reservado ser diferente. O que os dois pontos comparáveis (8k e ~23k) mostram com segurança é que **a penalidade já está com o tamanho final antes mesmo de 8k de cache ocupado** — não é preciso chegar a dezenas de milhares de tokens para o problema aparecer por inteiro.

Prefill continua favorecendo GPU em todas as rodadas. A 8k, 191,7 tok/s é mais rápido que qualquer uma das três rodadas de ~23k (75,0 / 91,3 / 159,6 tok/s) — isso **não é estranho**, prefill é compute-bound e o custo de atenção cresce mais que linear com o tamanho da sequência, então uma sequência 3× menor prefillar mais rápido é o esperado. O que **é** estranho, e fica sem explicação medida, é o espalhamento de mais de 2× **entre as três rodadas de ~23k**, que processam exatamente a mesma entrada. Por isso o número de prefill deste documento é lido como direção (GPU sempre à frente), não como valor preciso.

## VRAM durante a rodada — descartando a hipótese óbvia

A explicação mais imediata para "GPU lenta a contexto grande" seria estouro de VRAM — o Windows, via WDDM, pode trocar memória de GPU com RAM do sistema via PCIe quando a placa satura, o que é catastroficamente lento. **Medido, não é isso.** Amostrado `nvidia-smi` a cada 10s durante toda a segunda rodada de GPU a ~23k (≈5 minutos):

| Métrica | Valor observado |
|---|---|
| VRAM usada | estável em **1.102–1.113 MiB**, do início ao fim |
| Teto da placa | 2.048 MiB — nunca passou de ~54% do teto |
| Utilização da GPU | **99–100%** constante durante prefill e geração, caindo a 0–2% só no instante final |

VRAM nunca chegou perto do teto — isso descarta com confiança a hipótese de estouro/troca com RAM via WDDM. `utilization.gpu` a 99-100% é um sinal mais fraco do que parece: essa métrica só reporta a fração do tempo com **pelo menos um kernel residente**, não o quanto os núcleos da placa estavam de fato ocupados computando — uma sequência de kernels pequenos e frequentes pode manter o contador em 100% com as unidades de execução majoritariamente ociosas entre um lançamento e outro. O que ela prova é mais estreito: **a GPU não estava parada nem esperando em fila** — não que estava computando com eficiência. O número de VRAM residente (1.102–1.113 MiB ≈ 1,08–1,09 GiB) confere de perto com o 1,12 GiB calculado em [`ollama-qualified.md`](ollama-qualified.md#gemma31b) para este modelo no teto de contexto — validação cruzada da fórmula por um método de medição totalmente diferente (VRAM via `nvidia-smi`, não RAM residente via `ollama ps`).

Uma segunda corroboração, de um terceiro instrumento: o próprio `ollama ps` reportou `SIZE` **877 MB a 4.096** (cache quase vazio, 23 tokens reais), **881 MB a 8.192** (7.241 tokens reais — ~315× mais cache que o ponto anterior, para só +4 MB de `SIZE`) e **906 MB a 32.768** (23.241 tokens reais — ~1.010× mais cache que o ponto de partida, para +29 MB de `SIZE` no total). É o mesmo padrão de "só ~1 camada cresce de verdade" que a fórmula da janela deslizante prevê, agora visto por três medidas independentes (VRAM via `nvidia-smi`, SIZE via `ollama ps`, e o cálculo de `ollama-qualified.md`) que concordam entre si — e reforça o próximo ponto: a memória mal se move entre 8k e 23k, e a velocidade de geração também mal se move nesse mesmo intervalo.

## Por que a geração desaba — em aberto, e não pelo motivo mais óbvio

**A CPU também degradou** com o contexto maior — 22,1 → 13,2 (8k) → 12,9 tok/s (~23k) — mas bem menos que a GPU (25,1 → ~3,4 tok/s em ambos 8k e ~23k). Em termos relativos: ~96% da queda total da CPU já aconteceu em 8k (queda de 22,1 para 13,2, contra a queda total até 12,9); na GPU, a mesma leitura dá ~100%. **A forma é a mesma nos dois caminhos — quase toda a degradação já aconteceu no primeiro ponto comparável (8k), e o trecho de 8k a ~23k fica praticamente plano em ambos** — o que muda é só a magnitude (queda de ~42% na CPU contra ~87% na GPU). Isso por si só derruba qualquer explicação que dependa só de "GPU sem tensor core" — a CPU também não tem tensor core, e degradou bem menos.

**A explicação mais intuitiva — "a cada token, a GPU tem que varrer um cache KV de ~23 mil posições" — contradiz o que este mesmo documento usa para validar a VRAM.** O `gemma3:1b` tem janela deslizante (`sliding_window: 512`), e a metodologia de [`ollama-qualified.md`](ollama-qualified.md#metodologia) mede que, para esta família, só **~1 camada lógica** cresce com o `num_ctx` — é exatamente essa contabilidade que faz o VRAM residente medido aqui (1,08–1,09 GiB) bater com o 1,12 GiB calculado no teto de 32.768. Se o modelo de custo por trás dessa fórmula estiver certo, o custo de atenção por token deveria ficar **quase constante** com o contexto, não cair 8× — a fórmula foi calibrada para *memória*, não para *tempo de computação por token*, e pode não valer para a segunda grandeza. **Este documento não resolve essa contradição.** A leitura mais honesta é: a queda de geração na GPU é real, grande e reproduzida três vezes — mas o mecanismo exato não está confirmado, e a primeira hipótese óbvia (custo de atenção crescendo linearmente com o contexto) não se sustenta sem também explicar por que a mesma fórmula prevê pouco crescimento de memória. Profiling de kernel resolveria isso; não foi feito aqui.

---

## Recomendação

**Não vale a pena construir isto agora**, nem restrito ao único modelo cuja pegada cabe na placa. Só com o cache praticamente vazio (a rodada de 4k/23 tokens) o ganho é positivo, e mesmo assim modesto (~13% na geração) — não paga a complexidade de um segundo orçamento de memória (VRAM, ao lado do `os.freemem()` que toda a fase 15 já usa) nem o risco de reabrir a disputa de GPU com o Whisper do mill.tools. **A partir de 8k de cache real ocupado — um tamanho comum, não extremo, para uma conversa com dado anexado — é uma regressão de ~4×, já plenamente instalada e estável até ~23k.** O cenário que motivou a pergunta original ("modelos com teto de contexto folgado para VRAM") é justamente onde a GPU perde pior, e não é preciso chegar perto do teto de contexto pra isso acontecer.

⚠️ **Amostra de um modelo, uma GPU, uma sessão de medição.** Não generalizar para outro hardware, outro modelo ou outra versão do Ollama/driver CUDA sem remedir — o mesmo cuidado que rege toda medição de máquina neste projeto (`CLAUDE.md`: "ao trocar de máquina, refazer a medição").

## Se alguém quiser aprofundar

Não feito aqui, por estar fora do escopo desta rodada:

- **Profiling de kernel** — para achar o mecanismo real por trás da queda de geração na GPU, já que a hipótese mais óbvia (custo de atenção crescendo com o contexto) contradiz a própria fórmula de memória usada para validar a VRAM neste documento.
- **O degrau em si, não mais o intervalo largo** — 8k já mostrou o mesmo patamar de ~23k, então o cruzamento não está entre 8k e 23k, está em algum ponto entre "cache vazio" (4k/23 tokens) e 8k. Testar em, digamos, 1k/2k/4k de cache real ocupado (não teto reservado) apontaria onde o degrau realmente começa.
- **Offload parcial** (`num_gpu` com um número específico de camadas, não *all-or-nothing*) — meio-termo que pode evitar o pior da GPU em decode sem abrir mão do ganho no prefill.
- **Tempo até o primeiro token (TTFT)**, separado do throughput sustentado — numa conversa curta, TTFT pesa mais na percepção do que tok/s de geração em regime.
- **Outro modelo pequeno** (ex. `yi-coder:1.5b`, MHA sem GQA — perfil de cache bem diferente do `gemma3:1b`) — para saber se o padrão medido aqui é geral ou peculiar à janela deslizante do Gemma 3.
