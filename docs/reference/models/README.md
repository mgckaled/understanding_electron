# Modelos — referência técnica

**Data:** 20/08/2026 · atualizado 20/08/2026 (`cloud-optin.md`, `ollama-models-gpu-analysis.md`). **Motivo:** mapa da pasta — qual dos quatro arquivos responde a pergunta antes de abrir mais de um.

Ficha técnica por modelo, local e de nuvem. Nasceu do candidato já previsto em [`docs/reference/README.md`](../README.md) — "qual modelo do Ollama para qual papel, com custo de RAM medido nesta máquina" — desmembrado em `ollama-qualified.md`/`ollama-disqualified.md` porque a pergunta "o que está em uso e é elegível" e a pergunta "o que já foi pesquisado e não entra" têm meia-vida diferente: o primeiro muda quando a frota muda, o segundo raramente precisa ser revisto. `cloud-optin.md` juntou-se aos dois depois, cobrindo os candidatos de nuvem previstos desde o D15.9 do [plano 15](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) — mesmo assunto (qual modelo para qual papel), grandeza de custo diferente (tokens e US$, não RAM).

| Documento | O que responde |
|---|---|
| [`ollama-qualified.md`](ollama-qualified.md) | Frota atual (peso/KV/total por contexto, capacidades, papel) e elegíveis (analisados, sem bloqueio, sem papel ainda) |
| [`ollama-disqualified.md`](ollama-disqualified.md) | Inviáveis (bloqueados por um fato que pode mudar) e descartados (decisão já fechada) |
| [`cloud-optin.md`](cloud-optin.md) | Ficha técnica dos dois candidatos de nuvem (`gemini-2.5-flash`, `glm-4.7-flash`) — contexto, preço, teto de taxa do tier grátis. Nenhum dos dois está integrado; entra em uso quando a fatia 3 da [camada de IA](../../plan/active/09-camada-de-ia.md) (D15.9) sair do papel |
| [`ollama-models-gpu-analysis.md`](ollama-models-gpu-analysis.md) | Teste medido de `num_gpu` (MX150, 2 GB VRAM) contra `gemma3:1b` — GPU ganha no prefill, perde 3-4× na geração já a partir de 8k de cache ocupado (não só em contexto extremo), sem estouro de VRAM. Recomendação: não construir suporte a GPU agora |

---

## Convenção

Cada modelo Ollama mora em **um** dos quatro estados — em uso, elegível, inviável, descartado — e nunca em dois arquivos ao mesmo tempo. Um modelo que muda de estado (elegível → em uso, por exemplo) migra de seção, não ganha uma segunda entrada. Os candidatos de nuvem em `cloud-optin.md` **não** seguem essa taxonomia — não há "frota" de nuvem para testar domínio contra, então a categoria que rege cada um é o status de integração (pesquisado / integrado), não elegibilidade.

**Proveniência importa mais que precisão aparente.** Todo número aqui é marcado como medido (RAM residente antes/depois, ou `prompt_eval_count`), calculado (fórmula aplicada a um `/api/show` real, sem carregar o modelo) ou visto no site (scraping do `ollama.com`, preliminar até confirmado). A armadilha que motiva a distinção já está medida no projeto: `/api/tags` omite `vision` e o `ollama.com` já se contradisse, na mesma sessão, sobre as badges do `qwen3:1.7b` — texto de terceiro não é fonte, é ponto de partida para medir.

**"Em uso" não vive aqui.** A frota instalada tem dono em [`CLAUDE.md`](../../../CLAUDE.md#ambiente-de-desenvolvimento) — versionado lá porque decide escolhas do aplicativo e é o arquivo lido toda sessão. `ollama-qualified.md` traz a **tabela funda** por trás de cada linha daquela frota (peso/KV por contexto), não substitui a lista operacional; um aponta para o outro.

---

## Quando citar este diretório

- Ao escolher modelo para uma feature nova — checar `ollama-qualified.md` antes de instalar algo, `ollama-disqualified.md` antes de pesquisar um nome que já pode ter passado por aqui.
- Ao instalar ou remover um modelo da máquina de desenvolvimento — a frota de `ollama-qualified.md` precisa acompanhar, na mesma sessão (regra de auto-conservação do [`CLAUDE.md`](../../../CLAUDE.md)).
- Ao medir RAM/contexto de qualquer modelo Ollama — reaproveitar a fórmula da metodologia em [`ollama-qualified.md`](ollama-qualified.md#metodologia) em vez de rederivar.
- Ao planejar a fatia 3 do [plano de IA](../../plan/active/09-camada-de-ia.md) (nuvem opt-in) — `cloud-optin.md` já tem contexto, preço e teto de taxa pesquisados; reconferir a data antes de confiar no número.
