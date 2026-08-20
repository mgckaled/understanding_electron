# Modelos — referência técnica

**Data:** 20/08/2026. **Motivo:** mapa da pasta — qual dos dois arquivos (ou do futuro terceiro) responde a pergunta antes de abrir os dois.

Ficha técnica por modelo do Ollama: peso, cache KV por faixa de contexto, capacidades e papel no app. Nasceu do candidato já previsto em [`docs/reference/README.md`](../README.md) — "qual modelo do Ollama para qual papel, com custo de RAM medido nesta máquina" — desmembrado em dois arquivos porque a pergunta "o que está em uso e é elegível" e a pergunta "o que já foi pesquisado e não entra" têm meia-vida diferente: o primeiro muda quando a frota muda, o segundo raramente precisa ser revisto.

| Documento | O que responde |
|---|---|
| [`ollama-qualified.md`](ollama-qualified.md) | Frota atual (peso/KV/total por contexto, capacidades, papel) e elegíveis (analisados, sem bloqueio, sem papel ainda) |
| [`ollama-disqualified.md`](ollama-disqualified.md) | Inviáveis (bloqueados por um fato que pode mudar) e descartados (decisão já fechada) |
| `cloud-optin.md` *(ainda não existe)* | Ficha técnica dos modelos de nuvem, quando a fatia 3 da [camada de IA](../../plan/active/09-camada-de-ia.md) (D15.9) tirar o opt-in do papel |

---

## Convenção

Cada modelo mora em **um** dos quatro estados — em uso, elegível, inviável, descartado — e nunca em dois arquivos ao mesmo tempo. Um modelo que muda de estado (elegível → em uso, por exemplo) migra de seção, não ganha uma segunda entrada.

**Proveniência importa mais que precisão aparente.** Todo número aqui é marcado como medido (RAM residente antes/depois, ou `prompt_eval_count`), calculado (fórmula aplicada a um `/api/show` real, sem carregar o modelo) ou visto no site (scraping do `ollama.com`, preliminar até confirmado). A armadilha que motiva a distinção já está medida no projeto: `/api/tags` omite `vision` e o `ollama.com` já se contradisse, na mesma sessão, sobre as badges do `qwen3:1.7b` — texto de terceiro não é fonte, é ponto de partida para medir.

**"Em uso" não vive aqui.** A frota instalada tem dono em [`CLAUDE.md`](../../../CLAUDE.md#ambiente-de-desenvolvimento) — versionado lá porque decide escolhas do aplicativo e é o arquivo lido toda sessão. `ollama-qualified.md` traz a **tabela funda** por trás de cada linha daquela frota (peso/KV por contexto), não substitui a lista operacional; um aponta para o outro.

---

## Quando citar este diretório

- Ao escolher modelo para uma feature nova — checar `ollama-qualified.md` antes de instalar algo, `ollama-disqualified.md` antes de pesquisar um nome que já pode ter passado por aqui.
- Ao instalar ou remover um modelo da máquina de desenvolvimento — a frota de `ollama-qualified.md` precisa acompanhar, na mesma sessão (regra de auto-conservação do [`CLAUDE.md`](../../../CLAUDE.md)).
- Ao medir RAM/contexto de qualquer modelo Ollama — reaproveitar a fórmula da metodologia em [`ollama-qualified.md`](ollama-qualified.md#metodologia) em vez de rederivar.
