# Busca web — as APIs, medidas e publicadas

> Anexo de [`README.md`](README.md). Duas procedências, sempre nomeadas: **(medida)** é sonda própria contra o serviço real, em 13/09/2026 (registro em [`reference/ollama-cloud/capacidades.md`](../ollama-cloud/capacidades.md) § 1); **(publicada)** é documentação oficial, reconferida em 14/09/2026 pelo Context7 e por leitura direta de `docs.ollama.com/capabilities/web-search`.
>
> ⚠️ **A URL da doc mudou de lugar entre a sondagem e este levantamento.** `docs.ollama.com/web-search` responde **404**; o caminho vivo é `docs.ollama.com/capabilities/web-search`. Não copie a URL antiga de documento de terceiro nenhum.

---

## 1. São DUAS operações, não duas rotas da mesma coisa

Esta é a distinção que o arco inteiro pende, e o painel da conta Ollama já a trata como tal: **`web search` e `web fetch` aparecem como linhas próprias**, ao lado dos modelos (medida).

| | `web_search` | `web_fetch` |
|---|---|---|
| **O que entra** | uma **pergunta** em texto livre | uma **URL** exata |
| **Quem escolhe a fonte** | o índice do provedor | a pessoa |
| **O que sai da máquina** | a pergunta, **como escrita** | só o endereço |
| **O que volta** | `results[]` — `title`, `url`, `content` | `title`, `content`, `links[]` |
| **Quantos itens** | `max_results`, 1–10, default 5 | um |
| **Custo medido** | **~2.100 tokens por resultado** | **~1.550 tokens** na página sondada |
| **Botão de custo** | `max_results` | nenhum — a página é do tamanho que é |
| **A definição do `ESCOPO`** | ⚠️ **não é esta** — ver § 2 | **é esta** |

⚠️ **`content` já vem extraído em markdown, nas duas rotas** (medida). Não é HTML bruto: o provedor faz a limpeza que o guia antigo propunha fazer aqui dentro com `@mozilla/readability` + `jsdom`. É o mesmo deslocamento que o `DM-0` fez no arco 23 — a estrutura chega pronta, e o app **seleciona** em vez de truncar.

### O número por resultado, e de onde ele vem

| `max_results` | Resultados | Conteúdo total | ~tokens (a 3,8 ch/tk) |
|---:|---:|---:|---:|
| 3 | 3 | 26.464 chars | ~6.964 |
| 1 | 1 | 7.929 chars | ~2.086 |

O peso escala **linearmente** com `max_results` (medida, n=2). `web_fetch` contra `docs.ollama.com/cloud` devolveu `content` de 5.914 chars (~1.556 tokens).

⚠️ **A razão de 3,8 chars/token é o `DEFAULT_CHARS_PER_TOKEN` do app** (`core/ai/budget.ts`), não uma contagem real — nada tokeniza antes de enviar. O número exato só existe depois, no `prompt_eval_count` da resposta, que é o que `calibrateRatio` usa. Trate os valores desta seção como **ordem de grandeza**, nunca como orçamento fechado.

---

## 2. O `ESCOPO.md` define o pilar como *fetch*, e o interruptor se chama *busca*

A linha viva do [`ESCOPO.md`](../../ESCOPO.md) diz:

> **Busca web** — *uma URL vira contexto da resposta: o app busca e extrai o texto principal.*

Isso descreve **`web_fetch`**, campo a campo. Já o interruptor que existe hoje no menu `+` do composer se chama **`Busca web`**, com ícone `Globe` (`renderer/features/attachment/AttachMenu.tsx`, `TOOLS[0]`, `kind: 'webSearch'`).

**Não é contradição a resolver escolhendo um lado** — são duas metades do mesmo pilar, com fronteiras de privacidade e botões de custo diferentes. O que a divergência prova é que **a palavra "busca" foi usada nos dois sentidos** ao longo do repositório, e continuar assim produz um plano que entrega metade acreditando ter entregue tudo. Está como pergunta em aberto em [`decisoes.md`](decisoes.md).

---

## 3. As duas rotas, campo a campo

### `POST https://ollama.com/api/web_search`

```http
Authorization: Bearer OLLAMA_API_KEY
Content-Type: application/json
```

```json
{ "query": "what is ollama?", "max_results": 3 }
```

```json
{
  "results": [
    { "title": "Ollama", "url": "https://ollama.com/", "content": "Cloud models are now available…" }
  ]
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `query` | sim | string livre |
| `max_results` | não | **default 5, máximo 10** *(publicada)*; respeitado *(medida)* |

⚠️ **A doc publicada traz um exemplo de resposta com `description` no lugar de `content`.** A sonda contra o serviço real devolveu **`content`** nas duas rodadas. **Prevalece o medido** — e é o mesmo tipo de divergência que o arco 23 já pagou com o `openapi.json` do Context7 (fixture vem da resposta real, nunca do schema publicado; skill [`ctx-7`](../../../.claude/skills/ctx-7/SKILL.md)). Quem escrever a fixture **grava contra a API**, e trata um `description` que apareça como campo a mais, nunca como substituto.

### `POST https://ollama.com/api/web_fetch`

```json
{ "url": "https://docs.ollama.com/cloud" }
```

```json
{ "title": "…", "content": "…", "links": ["https://…", "…"] }
```

| Campo | Nota |
|---|---|
| `title` | título da página |
| `content` | markdown já extraído |
| `links` | os links da página, **à parte do conteúdo** |

⚠️ **`links[]` é superfície de decisão, não enfeite.** Ela permite um segundo salto — *"buscar também esta página"* — sem que o modelo precise de `tools`. É também por onde uma página hostil oferece o próximo endereço. Quem decide seguir um link é a **pessoa**, e o guarda de URL ([`seguranca.md`](seguranca.md)) vale igual para um link vindo daí.

---

## 4. Cota: não há header, e isso fecha uma decisão em vez de deixar lacuna

⚠️ **Nenhum header de cota existe nas respostas da Ollama** (medida, `DNC-15`). Os headers trazem `x-request-id`, `x-build-commit`, `x-build-time` e o trace do Google Frontend — **nada de `x-ratelimit-*`**.

E o painel da conta **não é instrumento de medida**: o número é arredondado a uma casa decimal, não é carimbado por requisição, e quatro leituras sucessivas se contradizem — seis requisições de verificação custaram **+0,3 pp**, mais que as **34** do lote anterior. Registro completo em [`ollama-cloud/desempenho.md`](../ollama-cloud/desempenho.md).

**A consequência é direta, e já está decidida do lado do provedor:** não há como espelhar o `docs:quota` aqui. A diferença contra o Context7 é de fato, não de capricho.

| | Context7 | Ollama web |
|---|---|---|
| Saldo em runtime | header da última resposta | **não existe** |
| Contador exibido | `docs:quota` | **nenhum possível** |
| Onde o saldo se vê | painel da conta **e** app | só o painel da conta |

⚠️ **As ferramentas web consomem a mesma cota dos modelos** — o painel diz *capabilities such as web search draw from your included usage*. Não há orçamento à parte. Distribuição medida das 76 requisições da sondagem: **4 em `web search`, 2 em `web fetch`**.

⚠️ **A faixa gratuita não publica número.** A doc diz apenas que exige "a free Ollama account" *(publicada)*; a busca web de 14/09/2026 não achou limite oficial em fonte nenhuma — só relatos de terceiros, mutuamente inconsistentes (janelas de 5 h / 7 dias por nível de modelo, contra o `Resets in 3 weeks` que o painel realmente mostra). **O único número defensável continua sendo o total medido:** 76 requisições de sondagem pesada = **1,9 %** da cota mensal, ordem de grandeza **~4.000 requisições/mês**.

---

## 5. Os outros candidatos, e o que cada um resolve ou não

A pergunta *"quem executa a busca"* está registrada como **em aberto** no [`ESCOPO.md`](../../ESCOPO.md). Estes são os candidatos levantados em 14/09/2026.

| Candidato | Índice próprio? | Custo | O que pesa |
|---|---|---|---|
| **Ollama `web_search`/`web_fetch`** | terceiro | faixa gratuita já assinada | chave **já guardada** (`N-3-C`), markdown já extraído, mesma forma REST do `DM-0` |
| **Brave Search API** | **sim** — o único índice ocidental independente grande desde o fim da Bing Search API (2025) | ⚠️ **o plano gratuito acabou em fev/2026**; hoje ~US$ 5/mil chamadas, US$ 5 de crédito inicial | conteúdo **não** extraído — exigiria o extrator local que o `web_fetch` dispensa |
| **Tavily** | não (agrega) | ~US$ 0,008/crédito; entrada em US$ 100/mês | comprada pela Nebius em fev/2026 — fornecedor em transição |
| **Exa** | busca neural | US$ 7/busca, conteúdo das 10 primeiras incluso | preço por busca fora de escala para uso pessoal |
| **SearXNG** local | não (meta-busca sobre ~70 motores) | **zero** — sem chave, sem cota | 🔍 o único caminho **sem terceiro pago**, e o único que mantém a busca fora da conta de um provedor de IA. ⚠️ Exige infraestrutura própria (Docker/VPS) — é pedir ao usuário do `crivo` que opere um serviço |
| **App busca direto** (`fetch` + extrator) | — | zero | cobre **só `fetch`, nunca `search`**. E traz SSRF, `jsdom`, PDF e encoding para dentro ([`seguranca.md`](seguranca.md)) |

⚠️ **Busca não tem caminho local; extração tem.** Uma página se busca com o `fetch` do Node e se limpa com `@mozilla/readability` (ou `defuddle`, o sucessor do time do Obsidian Web Clipper, com bundle Node e saída já normalizada para markdown). **Busca, não:** ela exige um índice, e índice é sempre de terceiro. Qualquer desenho que trate as duas como o mesmo problema vai errar em uma delas.

⚠️ **O custo de trazer a extração para dentro é duas dependências, não uma.** `@mozilla/readability` **não tem DOM próprio** e exige `jsdom` sob Node — o mesmo `jsdom` que a skill [`testing`](../../../.claude/skills/testing/SKILL.md) registra como incapaz de layout, promovido de ambiente de teste a dependência de produção. É decisão de peso, não detalhe de implementação.

---

## 6. O que NÃO foi verificado

Registrado para não ser lido como esquecimento — cada item custa cota ou uma chave para fechar.

| Pergunta | Por que segue aberta |
|---|---|
| `web_search` devolve `description` **além** de `content`, ou nunca? | a doc publicada e a sonda discordam; fechar exige uma requisição |
| Qual o teto de `content` por resultado | só n=2 medidos; nada indica se há truncamento do lado do provedor |
| `web_fetch` contra PDF, página JS-only ou 404 | **nenhuma** sondada — só uma página de documentação estática |
| `web_fetch` contra endereço privado (`127.0.0.1`, `169.254.169.254`) | ⚠️ **não sondado, e é a pergunta de segurança mais cara do levantamento** — [`seguranca.md`](seguranca.md) |
| Existe rate limit por minuto, distinto da cota mensal | nenhum header o anuncia; o limite publicado de 1 requisição concorrente **não é aplicado** (medida) |
| `max_results: 10` custa ~21 mil tokens? | a linearidade só foi medida entre 1 e 3 |
