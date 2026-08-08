# 11 — Markdown na resposta do assistente

**Depende de:** [10 — Cor](10-cor-contraste-e-tema-claro.md), [09 — fatia 1](../active/09-camada-de-ia.md) (implementada), [03](03-sandbox-e-seguranca.md), [05](05-design-tokens.md), [06](06-primeira-feature.md) · **Entrega:** a resposta do modelo renderizada como markdown, com link seguro, imagem neutralizada e streaming que não quebra a formatação

> **Por que depois da [10](10-cor-contraste-e-tema-claro.md):** esta fatia é o maior produtor de superfície colorida nova do projeto — bloco de código, código inline, citação, borda de tabela e **link**, que é o primeiro uso real de cor de acento como texto. Escrita antes, a tipografia do passo 3 seria calibrada contra um tema claro em que `--color-surface` é cinza médio e `--color-surface-sunken` é mais **claro** que ele: o bloco de código "afundado" pareceria elevado, e a resposta natural seria trocar o token — uma decisão de design tomada contra um fundo errado, que é mais cara de desfazer do que a linha de CSS que a originou.

> Este plano **não decide nada sobre a camada de IA** — provedores, gate, privacidade e sequência de fatias continuam sendo do [`09-camada-de-ia.md`](../active/09-camada-de-ia.md). Aqui é só a borda de apresentação da fatia 1, que ficou incompleta.

---

## Por que esta fatia existe

O modelo **já responde em markdown**. Não é uma feature a pedir: é o formato nativo de saída de qualquer LLM instruído em português, e o `gemma3:4b` da fatia 1 o usa sem que ninguém peça — listas aninhadas, negrito, numeração e blocos de código cercados.

O que a interface faz com isso hoje é `<p className={styles.content}>{turn.content}</p>` com `white-space: pre-wrap`. O resultado é a resposta crua na tela:

````text
* **Copiar e colar o conteúdo aqui:** Se o arquivo for pequeno…

```csv
ID_Cliente,Nome,Data_Compra,Valor_Compra
```
````

A cerca de código aparece como três crases literais, o `**` aparece como quatro asteriscos, e a hierarquia de uma lista de três níveis — que é a parte útil da resposta — vira parágrafo corrido. **O modelo está comunicando estrutura e a interface a está descartando.**

Não é cosmético por dois motivos concretos:

1. **A fatia 2 (NL→passo) vai emitir SQL.** Um bloco ` ```sql ` sem monoespaçado, sem fundo próprio e sem rolagem horizontal é ilegível na largura de um painel. O problema chega junto com o maior retorno da camada de IA — melhor resolvê-lo antes, com respostas de chat de baixo risco.
2. **A resposta é dado copiável.** A [fase 05](05-design-tokens.md) já reconheceu isso com `user-select: text` no `.content`. Copiar um bloco de código de dentro de um parágrafo corrido, sem fronteira visual, é acertar o começo e o fim no olho.

### O que muda na tela

| O modelo emite | Hoje se vê | Passa a ver |
|---|---|---|
| `**Resumo:**` | `**Resumo:**` | **Resumo:** |
| `* item` aninhado em três níveis | asteriscos em coluna | lista com recuo real |
| `1.` `2.` `3.` | funciona por acidente | lista ordenada |
| ` ```csv … ``` ` | crases e texto na fonte da UI | bloco monoespaçado, com rolagem própria |
| linha de tabela GFM, delimitada por `\|` | os pipes crus | tabela |
| `[texto](https://…)` | texto e URL crus | link que abre no navegador do sistema |

---

## Decisões tomadas

### D11.1 — O componente nasce **dentro** da fatia `ai-chat`, não em `shared/ui/`

Existe uma tensão real aqui, e ela é registrada em vez de resolvida em silêncio.

O argumento para `shared/ui/Markdown/` é bom: markdown é vocabulário de apresentação, não de feature, e o cartão de dados (fatia 4 do plano 09) vai querer o mesmo. O argumento contra é a regra que o próprio projeto já fixou na [D6.1](06-primeira-feature.md): **sobe para `shared/` a partir do terceiro uso; antes disso, é abstração prematura.** Hoje há **um** consumidor.

A regra ganha. `src/renderer/src/features/ai-chat/MarkdownMessage.tsx` e seu `.module.css` ao lado. O custo de mover depois é um `git mv` e dois imports — que é exatamente a resposta que a régua *"quantos arquivos toco depois?"* precisa dar para justificar o adiamento.

**Gatilho de revisão:** o segundo consumidor de markdown fora de `ai-chat` — e ele sobe junto com o `.module.css`, porque a tipografia de bloco é o que estará sendo reusado, não só o componente.

> 🔍 O quinto primitivo de `shared/ui/` não é proibido — `Button`, `Field`, `Panel` e `Toolbar` não são um conjunto fechado. O que decide não é a contagem, é ter mais de um chamador.

### D11.2 — `react-markdown` + `remark-gfm`, e o argumento é segurança, não conveniência

**A saída do modelo é entrada não confiável.** É a primeira vez neste app que texto de origem externa vira DOM. Isso muda o critério de escolha da biblioteca.

`react-markdown` constrói **elementos React** a partir do texto: em nenhum momento existe uma string de HTML, e portanto não existe `dangerouslySetInnerHTML`. HTML cru dentro do markdown é **ignorado por padrão** — habilitá-lo exige adicionar `rehype-raw` de propósito, e ele não entra. Confirmado na documentação do pacote, não presumido.

`remark-gfm` acrescenta tabela, `~~riscado~~`, lista de tarefas e autolink — o dialeto que os modelos de fato emitem. Sem ele, `| a | b |` fica como pipes na tela.

Alternativas descartadas, com o motivo:

| Descartado | Por quê |
|---|---|
| `marked`/`markdown-it` + `DOMPurify` + `dangerouslySetInnerHTML` | Reintroduz a superfície de injeção que o resto da arquitetura passou três fases estreitando. Um sanitizador é uma lista de negação a manter; "não gerar HTML" não é. |
| Parser próprio em `core/` | Tentador pelo "zero dependência nova" que a [fase 06](06-primeira-feature.md) celebrou. Mas ali a lógica era **nossa** (dedução de separador, ~150 linhas, casos conhecidos). Markdown tem código dentro de lista, ênfase aninhada, cerca com til, tabela GFM — e a entrada é gerada por um modelo, ou seja, não é possível restringir o que aparece. Seriam centenas de linhas cujos defeitos se manifestam como texto quebrado na tela do usuário. |
| `streamdown` | Resolve markdown incompleto durante o streaming — o problema real da D11.4. Mas traz Tailwind e um conjunto grande de dependências transitivas, num projeto que [descartou Tailwind por ora](../../HISTORY.md). A parte útil cabe em vinte linhas próprias e testáveis. |
| `rehype-raw` / `rehype-sanitize` | Só fazem sentido para *permitir* HTML. Não queremos permitir. |

**Compatível com a CSP atual** (`default-src 'self'; script-src 'self'`): a biblioteca não injeta script nem folha de estilo. A única incompatibilidade é com imagem remota, tratada na D11.3.

### D11.3 — Link e imagem: as duas armadilhas que já estão armadas e não dão erro

Markdown é o primeiro produtor de URLs arbitrárias neste app. Duas coisas quebram em silêncio se nada for feito:

**Imagem remota.** A CSP é `img-src 'self' data:`. Um `![gráfico](https://exemplo.com/g.png)` na resposta é bloqueado pelo Chromium e deixa um espaço vazio — sem erro no terminal, só no DevTools. Decisão: `urlTransform` devolve `null` para `key === 'src'`, o que remove o atributo e faz o **texto alternativo aparecer** no lugar. Falha visível é melhor que falha muda, e a alternativa (afrouxar a CSP para `img-src https:`) trocaria uma imagem que ninguém pediu por permissão de rede no renderer.

**Link clicado.** A [fase 03](03-sandbox-e-seguranca.md) nega navegação para fora da origem no `will-navigate`. Um `<a href="https://…">` clicado dentro do app não abre nada e não avisa nada. O caminho correto é `preventDefault()` e `window.api.shell.openExternal(href)`.

E aqui há um detalhe que morde: `argsSchema['shell:openExternal']` é `z.object({ url: z.string().url() })`, e payload fora do schema **lança** — [decisão D2.2](02-contrato-ipc.md), deliberada. Um link relativo do markdown (`[doc](/guia)`) viraria exceção no renderer, não `Result`.

A solução já existe no repositório e é a mesma lição que a [armadilha da lista branca](../../HISTORY.md) deixou: **`checkExternalUrl` mora em `src/core/url.ts` justamente porque mais de um chamador precisa da decisão.** O renderer pode importar `core/` (tabela da [fase 01](01-camadas-e-fronteiras.md)), então o componente usa a **mesma função pura** que o main usa para decidir se aquilo é um link:

- `checkExternalUrl(href).ok === true` → renderiza `<a>` que chama `openExternal` no clique;
- caso contrário → renderiza o texto do link, sem `<a>`.

Nenhuma cópia da lista branca, nenhuma URL malformada chegando ao contrato, e o comportamento continua verificado no lugar único que já tem teste.

> ⚠️ O `defaultUrlTransform` do `react-markdown` já barra `javascript:` — mantê-lo na composição do `urlTransform`. Ele é a primeira camada; `checkExternalUrl` é a que decide.

### D11.4 — Durante o streaming o markdown é renderizado, com o texto parcial fechado antes

O texto chega token a token (variante `chunk` de `JobEvent`, fatia 1). No meio de uma resposta, o acumulado tem cerca aberta, `**` sem par e tabela pela metade — e um parser correto interpreta tudo o que vem depois de uma ` ``` ` solitária como código.

Duas saídas, e a fácil é ruim aqui:

**Mostrar texto cru durante o stream e só renderizar no fim** é simples e livre de risco. Mas a fatia 1 mediu **4–6 tokens/s** com `gemma3:4b` e `num_thread=4` — uma resposta como a do exemplo acima leva mais de um minuto. O usuário passaria esse minuto lendo asteriscos, para tudo saltar de forma no último instante. O estado transitório é a maior parte da experiência, não uma fração dela.

**Decisão:** uma função pura `completePartial(text)` fecha o que está aberto antes de entregar ao renderizador — cerca de código sem par, crase inline ímpar, `**` ímpar. É deliberadamente conservadora: fecha o que sabe fechar e deixa o resto passar. Erro dela custa um instante de formatação estranha; erro na direção oposta custa a resposta inteira dentro de um bloco de código.

Fica ao lado do componente, com teste de nível 2 — é a única parte desta fatia com lógica de verdade.

**Custo a medir, não a presumir:** re-parsear e reconciliar a árvore a cada token. A [D6.4](06-primeira-feature.md) já enfrentou o análogo do outro lado da fronteira e resolveu com limite de 10 emissões por segundo. Aqui o passo 6 mede primeiro; se o frame passar de 16 ms, o mesmo remédio se aplica no renderer — e o número medido vai para o diário de qualquer jeito.

### D11.5 — Sem realce de sintaxe nesta fatia

`shiki` e `react-syntax-highlighter` resolvem bem o problema, e nenhum dos dois cabe agora — por um motivo que é do **design system**, não do peso.

**Um tema de realce é um conjunto de cores literais.** `tokens.css` é a fonte única de cor neste projeto, e o [`guard.mjs`](../../../.claude/hooks/guard.mjs) bloqueia `#hex` em qualquer `*.module.css`. Adotar realce exige uma família nova de primitivos (`--syntax-keyword`, `--syntax-string`, …) mapeada em dois temas — decisão de design system inteira, dentro de uma fatia que é sobre outra coisa.

A [fase 10](10-cor-contraste-e-tema-claro.md) já deixou o terreno pronto e chegou à mesma conclusão pelo outro lado: calibrar cores de sintaxe **sem SQL real na tela** é decidir no escuro. Quando a paleta chegar, cada cor nasce com sua linha no registro de pares e o teste de contraste a cobre desde o primeiro commit.

Nesta fatia, bloco de código é: `--font-mono`, fundo `--color-surface-sunken`, borda, `overflow-x: auto` e o nome da linguagem visível quando a cerca o traz. Legível, e honesto sobre não ser colorido.

**Gatilho de revisão:** a fatia 2 (NL→passo) gerando SQL para o usuário revisar. Aí o realce deixa de ser enfeite — ler `SELECT`/`WHERE`/literal em uma cor só é o que torna a revisão pior que a alternativa.

### D11.6 — A mensagem do usuário continua texto cru

Só a resposta do assistente é markdown. O que o usuário digitou aparece exatamente como digitado.

Não é economia de esforço: se alguém colar `**` ou uma linha começando com `#` — coisa provável num app onde se fala de nome de coluna e cabeçalho de CSV —, renderizar transformaria a própria entrada dele, e ele perderia a referência do que enviou. O `.content` atual, com `white-space: pre-wrap`, fica como está.

### D11.7 — O teste muda de forma, e o de segurança é o que paga

Com markdown, o texto deixa de ser um nó só. `**Bold** e texto` vira três nós irmãos, e `getByText('Bold e texto')` — que funcionaria hoje — passa a falhar. O teste da fatia 1 (`findByText('Olá!')`) sobrevive por ser um parágrafo simples; os novos não terão essa sorte.

A técnica: consultar por **papel** (`getByRole('list')`, `getByRole('table')`, `getByRole('link')`) e por conteúdo de elemento específico, não por frase inteira. O teste passa a verificar *que estrutura foi produzida*, que é justamente o que esta fatia entrega.

O caso mais valioso é o de segurança, no mesmo espírito do `security-boundary.spec.ts` da [fase 07](07-e2e-e-empacotamento.md): **uma resposta contendo `<img src=x onerror=…>` ou `<script>` precisa aparecer como texto literal na tela**, não como elemento no DOM. É o teste que pega alguém adicionando `rehype-raw` daqui a seis meses para "fazer funcionar aquele HTML".

---

## Passos

### Passo 1 — Instalar, validar, commitar

```bash
pnpm add react-markdown remark-gfm
```

Antes de escrever qualquer código — **uma variável por vez**:

1. Confira o `peerDependencies` de `node_modules/react-markdown/package.json` contra o React 19 do projeto. Ler o manifesto instalado, nunca um artigo — é o [corolário de método](../../HISTORY.md) que o caderno 02 deixou.
2. `Ctrl+Shift+P → Developer: Reload Window`. Com `node_modules` fora do watcher do VS Code, pacote novo aparece como import não resolvido até isso ([`CLAUDE.md`](../../../CLAUDE.md)).
3. Nenhum dos dois é módulo nativo, então **não** há entrada nova em `allowBuilds`. Confirme que o `pnpm add` não imprimiu aviso de script de build ignorado.
4. `pnpm dev` e `pnpm build` antes de qualquer alteração de código, para separar "a dependência entrou bem" de "o componente está certo".

Anote o tamanho do bundle do renderer antes e depois (a saída do `electron-vite build` já o imprime). É o único número desta fatia que vale registrar sem precisar medir nada à parte.

**Aceite:** `pnpm dev` abre a janela, `pnpm build` limpo, tamanho anotado.
**Commit:** `chore(deps): react-markdown e remark-gfm para a resposta do assistente`

### Passo 2 — `MarkdownMessage`, com as duas regras de segurança

`src/renderer/src/features/ai-chat/MarkdownMessage.tsx`. Alvo: abaixo de 80 linhas.

```tsx
import Markdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { checkExternalUrl } from '@core/url'
import styles from './MarkdownMessage.module.css'
```

Três pontos, e nenhum é opcional:

- **`remarkPlugins={[remarkGfm]}` e nenhum `rehypePlugins`.** A ausência é a decisão (D11.2); um comentário curto no arquivo explica por quê, no mesmo espírito do `webPreferences` explícito da fase 03 — a linha que não existe não aparece em diff, o comentário aparece.
- **`urlTransform`** devolve `null` quando `key === 'src'` (imagem, D11.3) e delega o resto a `defaultUrlTransform`.
- **`components.a`** consulta `checkExternalUrl(href)`: se `ok`, um `<a>` cujo `onClick` faz `preventDefault()` e chama `window.api.shell.openExternal(href)`; se não, só os `children`, sem âncora.

`components.code` distingue bloco de inline pelo `className` (`language-*`, presente só em cerca) — **não existe prop `inline`** na API atual do `react-markdown`, e tutorial antigo ainda a mostra.

**Aceite:** `pnpm typecheck` limpo; o componente não é usado ainda.
**Commit:** `feat(renderer): componente de markdown com link e imagem contidos`

### Passo 3 — A tipografia do bloco

`MarkdownMessage.module.css`. CSS Modules escopa **classes**; seletores de elemento dentro de uma classe escopada funcionam normalmente, então o arquivo é uma classe raiz e seus descendentes:

```css
.markdown p { … }
.markdown pre { … }
```

O que precisa estar lá, e por quê:

| Regra | Motivo |
|---|---|
| `user-select: text` na raiz | `base.css` desliga seleção no `html`; a resposta é dado copiável (fase 05) |
| `overflow-x: auto` em `pre` e `table` | sem isto, uma linha de SQL longa alarga o painel inteiro |
| `:first-child`/`:last-child` sem margem externa | markdown começa com `<p>`, que traria margem para dentro do `Panel` e quebraria o ritmo vertical |
| `h1`–`h3` próximos do tamanho do corpo | LLM usa `#` com generosidade; título de 28 px dentro de um painel de chat grita |
| Recuo de lista em `--space-*` | aninhamento de três níveis é comum nessas respostas |
| `code` inline com fundo e `--radius-sm` | distinguir `nome_da_coluna` do texto ao redor é metade do valor aqui |
| link em `--color-accent-text` | **não** `--color-accent`: aquele é o sólido de fundo, e como texto falha AA nos dois temas — [D10.1](10-cor-contraste-e-tema-claro.md) |
| citação com borda em `--color-border` | o modelo usa `>` para destacar ressalvas |

**Nenhum `#hex` e nenhum `var(--gray-N)`** — só tokens semânticos. O `guard.mjs` roda a cada edição e bloqueia os dois; se algum estado pedir uma cor que não existe, ela nasce em `tokens.css`, não aqui.

**Aceite:** `guard.mjs` silencioso nas edições; inspeção visual com uma resposta real colada à mão no estado.
**Commit:** `feat(renderer): tipografia de markdown com tokens semânticos`

### Passo 4 — Fechar o markdown parcial do streaming

`completePartial.ts` ao lado do componente, puro, com teste escrito **junto**:

| Entrada | Esperado |
|---|---|
| `''` | `''` |
| texto sem marcação | inalterado |
| ` ```csv\nID,Nome ` | ganha ` ``` ` no fim |
| ` ```a\n…\n```\n```b\n… ` (par + aberto) | fecha só o segundo |
| `` `col `` | ganha a crase de fechamento |
| `**Resu` | ganha `**` |
| `**a** e **b` | fecha só o terceiro |
| cerca aberta contendo `**` | não fecha o `**` — está dentro de código |

O último caso é o que separa uma implementação correta de uma que "quase funciona": contar marcadores sem saber se estão dentro de uma cerca produz saída pior que não fazer nada.

Ligue no `AiChatPanel`: o bloco de `streaming` passa a usar `<MarkdownMessage text={completePartial(streaming)} />`; o turno finalizado usa o texto como veio, sem passar por aqui.

**Aceite:** `pnpm test` verde, com os oito casos.
**Commit:** `feat(renderer): fecha markdown parcial durante o streaming`

### Passo 5 — Testes de nível 2 da fatia

Atualize `AiChatPanel.test.tsx` e acrescente os casos que a estrutura agora permite verificar:

| Cenário | Verifica |
|---|---|
| Resposta com `**forte**` e lista | `getByRole('list')` e os itens; nada de asterisco no `textContent` |
| Resposta com ` ```csv ` | existe um `<pre>`; o conteúdo preserva as quebras de linha |
| Resposta com tabela GFM | `getByRole('table')` |
| Resposta com `[x](https://a.b)` clicado | `preventDefault` e `api.shell.openExternal` chamado com a URL |
| Resposta com `[x](/relativo)` | **não** existe `link`; `openExternal` não foi chamado |
| Resposta com `<img src=x onerror=alert(1)>` | aparece como texto; `container.querySelector('img')` é `null` |
| Mensagem do usuário com `**` | continua literal (D11.6) |

O sexto é o que justifica os outros seis. O sétimo é o que impede alguém de "unificar" a renderização das duas pontas por simetria.

Confirme também que o Vitest processa `react-markdown` (ESM puro) no projeto `jsdom` sem configuração extra. Se reclamar de `Cannot use import statement outside a module`, o ajuste é `server.deps.inline` no `vitest.config.ts` — e vale uma linha no diário, porque é o tipo de coisa que se redescobre.

**Aceite:** `pnpm check:fast` verde.
**Commit:** `test(renderer): markdown do assistente, link contido e HTML inerte`

### Passo 6 — Validar ao vivo, com o Ollama de verdade

Nenhum teste automatizado pega o que este passo pega. Com `ollama serve` no ar, envie a pergunta que originou este plano — *"resuma o conteúdo de um CSV e sugira melhorias"* — e observe:

1. **Durante o streaming**, o texto se reorganiza sem "piscar" a cada token, e o bloco ` ```csv ` não engole o restante da resposta enquanto está aberto.
2. **No fim**, listas de três níveis, negrito e o bloco de código estão formatados; o `<pre>` rola na horizontal em vez de alargar o painel.
3. **Frame durante o streaming** — DevTools → Performance, gravar 10 s. Se a mediana passar de 16 ms, aplique o limite de re-render (D11.4) e meça de novo.
4. **Um link real** na resposta abre no navegador do sistema, e o app não navega.
5. Selecionar e copiar um trecho do bloco de código funciona.

Registre no diário o número do item 3 e o tamanho do bundle do passo 1.

**Aceite:** os cinco itens, com os dois números no diário.
**Commit:** `docs: registra a validação ao vivo do markdown do assistente`

---

## Critério de aceite da fase

```bash
pnpm check:fast && pnpm build
```

E a validação manual do passo 6, que é a que importa.

---

## O que fica para depois

- **Realce de sintaxe** — gatilho na D11.5: a fatia 2 gerando SQL. Exige decidir onde a paleta de sintaxe mora em `tokens.css`.
- **Botão de copiar bloco de código** — a razão prática nº 1 de renderizar markdown num assistente, e mesmo assim fora daqui: `navigator.clipboard` depende de contexto seguro, e o app empacotado carrega de `file://`. Ou se confirma ao vivo, ou vira um canal `clipboard:write` no contrato — em ambos os casos é uma variável a mais que esta fatia não precisa. Enquanto isso, `user-select: text` deixa copiar à mão.
- **Markdown fora do chat** (cartão de dados, descrição de receita) — é o gatilho da D11.1 para o componente subir a `shared/ui/`.
- **KaTeX, mermaid, `remark-breaks`** — nada no escopo pede.
- **Virtualização da conversa** — a régua do projeto é ~200 linhas de DOM por vez, e uma conversa longa de markdown chega lá. Só quando houver histórico persistido; hoje a conversa morre com a janela.

---

## O que muda fora deste plano

Ao concluir, além de mover o arquivo para `implemented/` e escrever a entrada em [`HISTORY.md`](../../HISTORY.md):

| Documento dono | O que acrescentar |
|---|---|
| [`ROADMAP § 2`](../../ROADMAP.md) | dois gatilhos: realce de sintaxe (D11.5) e a subida do componente para `shared/ui/` (D11.1) |
| skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) | uma linha sobre onde a tipografia de markdown mora — **só se** o componente subir para `shared/ui/`; enquanto for da fatia, não é vocabulário do design system |
| [`HISTORY.md`](../../HISTORY.md) § Armadilhas | a imagem bloqueada pela CSP e o link mudo do `will-navigate`, **se** forem observados de fato no passo 6 — armadilha se registra medida, não prevista |

Nada muda no [`ESCOPO.md`](../../ESCOPO.md) nem no [`09-camada-de-ia.md`](../active/09-camada-de-ia.md): esta fatia não altera o que o app faz nem como a IA se encaixa nele.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 2026-08-08 | 1–6 + arquivamento | **concluída** | Passos 1–5 implementados; `pnpm check:fast` verde (128 testes) e `pnpm build` limpo. **Bundle** (número do passo 1): renderer JS **573,47 → 951,35 kB**, CSS **11,99 → 15,42 kB**, módulos 52 → 309 — `react-markdown` + `remark-gfm` e o ecossistema `unified`/`micromark`/`mdast`/`hast` somam ~378 kB, custo assumido pela D11.2 (segurança por não gerar HTML). **ESM:** o `react-markdown` (`type: module`) processou sob o Vitest 4 jsdom **sem** `server.deps.inline` — o plano previu que poderia precisar; não precisou, e override desnecessário no Vitest é o tipo de config que ninguém depois ousa remover. Rótulo de linguagem do bloco: renderizado no `pre` **fora** do `<pre>` (lido de `node.children[0].properties.className`) para não entrar na seleção de cópia. Passo 6 **conferido pelo usuário** (capturas de tela): resposta estruturada com títulos, listas aninhadas, negrito e **tabela GFM**; bloco de código monoespaçado com o rótulo de linguagem ("python") no topo. Frame não medido formalmente, mas o streaming rodou fluido — o limitador da D11.4 fica adiado até haver número que o peça. Conclusão nesta sessão: `ROADMAP §2` ganhou 2 gatilhos (realce fundido na linha do `--syntax-*`; subida para `shared/ui/` em linha nova), plano movido para `implemented/`, marco criado. As armadilhas de imagem/CSP e link mudo **não** foram registradas — não foram testadas (nenhuma resposta trouxe imagem remota ou link). |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [10 — Cor: contraste medido e tema claro](10-cor-contraste-e-tema-claro.md) · **Índice:** [README](../active/README.md) · **Camada de IA:** [09 — Camada de IA e ML](../active/09-camada-de-ia.md)
