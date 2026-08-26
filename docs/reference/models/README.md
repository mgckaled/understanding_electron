# Modelos — referência técnica

**Data:** 20/08/2026 · atualizado 20/08/2026 (`cloud-optin.md`, `ollama-models-gpu-analysis.md`, `cloud-optin-free-tier-analysis.md`). **Motivo:** mapa da pasta — qual dos cinco arquivos responde a pergunta antes de abrir mais de um.

Ficha técnica por modelo, local e de nuvem. Nasceu do candidato já previsto em [`docs/reference/README.md`](../README.md) — "qual modelo do Ollama para qual papel, com custo de RAM medido nesta máquina" — desmembrado em `ollama-qualified.md`/`ollama-disqualified.md` porque a pergunta "o que está em uso e é elegível" e a pergunta "o que já foi pesquisado e não entra" têm meia-vida diferente: o primeiro muda quando a frota muda, o segundo raramente precisa ser revisto. `cloud-optin.md` juntou-se aos dois depois, cobrindo os candidatos de nuvem previstos desde o D15.9 do [plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) — mesmo assunto (qual modelo para qual papel), grandeza de custo diferente (tokens e US$, não RAM).

| Documento | O que responde |
|---|---|
| [`ollama-qualified.md`](ollama-qualified.md) | Frota atual (peso/KV/total por contexto, capacidades, papel) e elegíveis (analisados, sem bloqueio, sem papel ainda) |
| [`ollama-disqualified.md`](ollama-disqualified.md) | Inviáveis (bloqueados por um fato que pode mudar) e descartados (decisão já fechada) |
| [`cloud-optin.md`](cloud-optin.md) | Ficha técnica de sete candidatos de nuvem — três integrados desde N-1-B/N-1-C (`gemini-3.5-flash-lite`, `gemini-3.7-flash`, `glm-4.7-flash`) e quatro elegíveis via provedor terceirizado (Kimi K2 e Qwen3 32B via Groq, DeepSeek-V3.2 via SambaNova, GPT-OSS-120B via Cerebras), ainda fora do app — trilha N-2, sem arquivo |
| [`ollama-models-gpu-analysis.md`](ollama-models-gpu-analysis.md) | Teste medido de `num_gpu` (MX150, 2 GB VRAM) contra `gemma3:1b` — GPU ganha no prefill, perde 3-4× na geração já a partir de 8k de cache ocupado (não só em contexto extremo), sem estouro de VRAM. Recomendação: não construir suporte a GPU agora |
| [`cloud-optin-free-tier-analysis.md`](cloud-optin-free-tier-analysis.md) | Panorama de free tier na indústria — grandes/médias ocidentais e chinesas, API de fabricante e provedor terceirizado. Cobre a lógica financeira-sustentável de cada categoria, quem treina com seu prompt, e o risco de segurança de confiar em duas partes (hospedeiro + fabricante do modelo). Conhecimento registrado, não é ficha técnica — essa é `cloud-optin.md` |

---

## Convenção

Cada modelo Ollama mora em **um** dos quatro estados — em uso, elegível, inviável, descartado — e nunca em dois arquivos ao mesmo tempo. Um modelo que muda de estado (elegível → em uso, por exemplo) migra de seção, não ganha uma segunda entrada. Os candidatos de nuvem em `cloud-optin.md` **não** seguem essa taxonomia — não há "frota" de nuvem para testar domínio contra, então a categoria que rege cada um é o status de integração (pesquisado / integrado), não elegibilidade.

**Proveniência importa mais que precisão aparente.** Todo número aqui é marcado como medido (RAM residente antes/depois, ou `prompt_eval_count`), calculado (fórmula aplicada a um `/api/show` real, sem carregar o modelo) ou visto no site (scraping do `ollama.com`, preliminar até confirmado). A armadilha que motiva a distinção já está medida no projeto: `/api/tags` omite `vision` e o `ollama.com` já se contradisse, na mesma sessão, sobre as badges do `qwen3:1.7b` — texto de terceiro não é fonte, é ponto de partida para medir.

**"Em uso" passou a viver aqui em ago/2026.** O dono era o [`CLAUDE.md`](../../../CLAUDE.md), *porque* ele é lido toda sessão. Foi essa mesma razão que se inverteu: a tabela custava ~2k tokens em **toda** sessão, inclusive nas que não tocam IA — e a informação que decide escolha é meia dúzia de linhas, não oito com KV/token e proveniência. O `CLAUDE.md` ficou com a máquina (CPU/RAM/GPU, que não tem outro dono) e com os dois avisos operacionais; a frota inteira está abaixo.

---

## Frota instalada

**13 entradas** no `/api/tags` em 18/08/2026, das quais 5 são variantes `-custom` por Modelfile, com os mesmos pesos e teto das originais. As 8 distintas:

| Modelo | Tamanho | Teto treinado | KV/token | `capabilities` | Papel |
|---|---|---|---|---|---|
| `gemma3:4b` | 3,3 GB | 131.072 | ~4,3 KB | `completion`, `vision` | **default** — janela deslizante de 1024, o único com visão |
| `gemma3:1b` | 815 MB | 32.768 | ~1 KB | `completion` | fallback de baixa RAM, fraco em síntese |
| `qwen2.5-coder:3b` | 1,9 GB | 32.768 | 36 KB | `completion`, `tools`, `insert` | **o único que combina especialização em código com folga de RAM** — candidato a default do NL→SQL |
| `phi4-mini` | 2,5 GB | 131.072 | 128 KB | `completion`, **`tools`** | pesos leves e cache caro — a 32k custa quase o mesmo que o `qwen2.5:7b`, que pesa o dobro |
| `qwen3:4b` | 2,5 GB | 262.144 | **152,6 KB** | `completion`, `tools`, `thinking` | instalado 18/08/2026 (`ollama pull`, fora do app) — **o cache mais caro da frota**, e o maior teto treinado; a 32k já soma ~7,6 GB residentes, medido: 3,5 GB reais contra 3,43 GB previstos pela fórmula a 4.096. Único com raciocínio explícito — o app hoje descarta a fase com `think: false` (ver [`ARMADILHAS.md`](../../ARMADILHAS.md)) |
| `qwen2.5:7b` | 4,7 GB | 32.768 | 56 KB | `completion`, **`tools`** | qualidade máxima de uso geral |
| `qwen2.5-coder:7b` | 4,7 GB | 32.768 | 56 KB | `completion`, `tools`, `insert` | teto de qualidade em código; escolha deliberada, não default |
| `nomic-embed-text` | 274 MB | 2.048 | — | `embedding` | 768 dims — o embedder da D9.5 já está instalado |

As `capabilities` acima vêm do `/api/show`: o `/api/tags` também traz o campo e **omite `vision`** ([`ARMADILHAS.md`](../../ARMADILHAS.md)). Carregar o `gemma3:4b` do disco frio custa **~50 s** — o preço real de trocar de modelo.

**Desinstalados em 10/08/2026**, medidos antes e registrados para não serem reinstalados por impulso: `mistral:7b` (dominado — mesmo porte e teto do `qwen2.5:7b`, sem especialização, com o dobro do cache) e `llama3.1:8b` (o teto de 131.072 que o tornava interessante pede 16 GB de cache; sem ele, é um `qwen2.5:7b` mais pesado). Motivos completos na D15.8 do [plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md).

### O teto de contexto é da máquina, e o custo depende da arquitetura de atenção

Não é do Ollama nem do modelo. O `gemma3:4b` declara 131.072; o default de 4k é do Ollama (`< 24 GiB VRAM`). Medido em ago/2026 ao planejar a fase 15: subir `num_ctx` de 4.096 para **32.768 custa 120 MB** (2,91 → 3,03 GB residentes) e não muda o tempo de carga.

**Essa medida vale para o `gemma3:4b` e não se generaliza** — correção de 10/08/2026, feita ao instalar quatro modelos novos. Ele é o único da frota com **janela deslizante** (`sliding_window: 1024`). Medido depois, na mesma sessão: o Ollama conta o crescimento do cache como se **uma única camada, não as ~6 que a proporção 5:1 sugeriria**, escalasse com o `num_ctx` — o `gemma3:4b` mede **~4,3 KB por token**, não os ~24 KB da estimativa por proporção (correção que a tabela acima já usa). Um modelo sem janela cresce em todas as camadas: o `phi4-mini` custa **128 KB por token** contra os ~4,3 KB do `gemma3:4b` — **~30×** — e, no teto de 131.072 que ele próprio declara, pediria **16 GB só de cache**, sete vezes o próprio peso de 2,5 GB. **Tamanho de modelo não prediz custo de contexto**, e nenhuma coluna do `ollama list` deixa isso visível.

Reservar a janela continua barato *comparado a enchê-la* (o prefill segue dominante, e uma janela deslizante custa **30×** por invalidar o cache de prefixo — coincidência de valor com o ×30 acima, não a mesma medida), mas *"`num_ctx` não é um botão de consumo de RAM"* era uma frase sobre uma arquitetura, não sobre todas. A fórmula (derivável do `/api/show`, sem carregar modelo) e o orçamento por modelo estão no [plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md); a tabela de peso/KV por faixa de contexto, em [`ollama-qualified.md`](ollama-qualified.md).

Estes números decidiram o default de `num_thread`, o modelo padrão e a recusa de *tool calling* (ver [`HISTORY.md`](../../HISTORY.md)). **Ao trocar de máquina, refazer a medição antes de reaproveitar qualquer uma dessas decisões.**

---

## Quando citar este diretório

- Ao escolher modelo para uma feature nova — checar `ollama-qualified.md` antes de instalar algo, `ollama-disqualified.md` antes de pesquisar um nome que já pode ter passado por aqui.
- Ao instalar ou remover um modelo da máquina de desenvolvimento — a frota de `ollama-qualified.md` precisa acompanhar, na mesma sessão (regra de auto-conservação do [`CLAUDE.md`](../../../CLAUDE.md)).
- Ao medir RAM/contexto de qualquer modelo Ollama — reaproveitar a fórmula da metodologia em [`ollama-qualified.md`](ollama-qualified.md#metodologia) em vez de rederivar.
- Ao planejar a fatia 3 do [plano de IA](../../plan/active/09-camada-de-ia.md) (nuvem opt-in) — `cloud-optin.md` já tem contexto, preço e teto de taxa pesquisados; reconferir a data antes de confiar no número.
- Ao decidir se algum provedor de nuvem é aceitável para o dado do usuário — `cloud-optin-free-tier-analysis.md` já tem a política de retenção/treino verificada por provedor, antes de reabrir a pesquisa.
