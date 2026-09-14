# N-3-B — o popover em uma linha

> Segundo corte da trilha N-3, **100% renderer, nenhum canal tocado**. Material de entrada: os seis arquivos de [`docs/reference/ollama-cloud/`](../../reference/ollama-cloud/README.md) lidos na íntegra, o diário do [`N-3-A`](../implemented/N-3-A-a-trava-antes-da-porta.md), as sete skills, e refinamento externo obrigatório (Context7 sobre utilitários de flex/truncamento do Tailwind; busca web sobre `title` em elemento desabilitado e sobre `title` como fonte de nome acessível). Siglas nascem como `DN3B.n`.

## Contexto

A trilha N-3 integra o Ollama Cloud como serviço próprio em cinco cortes. O `N-3-A` fechou os três defeitos de código que precediam a nuvem. Este é o segundo, e entra **antes** do provedor novo pela mesma regra: **consertar antes de acrescentar** — se esperasse, a sessão que adiciona `ollama-cloud` acrescentaria linhas a um popover já sabidamente quebrado.

O pior caso já está na tela hoje, sem nuvem nova nenhuma: `gemini-3.5-flash-lite` carrega nome + contexto + o tripé `15 RPM · 250k TPM · 500 RPD` + três chips num `flex-wrap`, o que quebra em **três** linhas visuais. Sete decisões do recorte (`DNC-23`–`DNC-29`) descrevem o conserto: uma linha por modelo, largura maior, o tripé fora da linha, vocabulário unificado, separador `·`, coluna de chips alinhada, e **um mecanismo de destaque só** — o das linhas de nuvem é hoje **inerte**, porque pinta `hover:bg-surface-raised`, que é a cor do próprio fundo do `Popover`.

Arquivo único tocado: `src/renderer/src/features/conversation/ModelSelector.tsx` (276 linhas, teto 400). `modelFormat.ts` **não muda** — `formatRateLimit` e `formatContext` estão certos; muda **onde** a string é usada.

---

## O que já está pronto e não se reconstrói

- **`formatContext`, `formatRateLimit`, `formatSize`, `capabilityChips`, `CapabilityChip`** — todos corretos e intocados. `DNC-27` diz explicitamente que o `0k` **não** é conserto em `formatContext`, é a composição da linha que decide não mostrar.
- **`fitsInMemory(null) === true`** (`core/ai/budget.ts`) — `não cabe` só aparece com teto numérico abaixo de `MIN_NUM_CTX`. É o que permite a condição de `DN3B.4` sem tocar `core/`.
- **`ceilingOf` já decide por serviço** desde o `N-3-A` (`offeredCeiling`, `DN3A.5`). Este corte **consome** o número; não o recalcula.
- **A pílula-gatilho já usa a forma certa de truncamento** (`min-w-[0px] overflow-hidden text-ellipsis whitespace-nowrap`, linha 121). A linha da lista copia essa disciplina, não inventa outra.
- **O `Popover` não aceita `className` na raiz** — a classe de largura vai no `<div>` interno, como já vai hoje.

---

## Decisões

### DN3B.1 — A linha é um `flex-row` de **três** blocos, e o do meio tem largura fixa

`flex-col` + `flex-wrap` viram uma linha só, nos **dois** grupos:

| Bloco | Classe | Por quê |
|---|---|---|
| nome | `flex-1 min-w-[0px] truncate` | o único que flexiona; trunca com reticências |
| metadados | `flex-none w-[…] text-right` | **largura fixa** — é o que faz os chips começarem no mesmo `x` em toda linha (`DNC-28`, decidido pelo dono nesta sessão) |
| chips | `flex-none` | o defeito recorrente do projeto é ícone+texto quebrando sem `flex-none` |

⚠️ **`min-w-[0px]`, nunca `min-w-0`.** O projeto desliga `--spacing-*: initial` e redeclara só os degraus 1–9 (`assets/tailwind.css:13`), então **todo utilitário no degrau `0` não gera CSS nenhum** — confirmado no fonte nesta sessão. Não há lint, typecheck nem teste de nível 2 que avise: o nome empurra os chips para fora e nada reprova. É o gatilho aberto do [`ROADMAP § 2`](../../ROADMAP.md), com dano medido três vezes.

⚠️ **`truncate` e `flex-1`/`flex-none` são utilitários de primeira classe do Tailwind v4** (confirmado na doc oficial pelo Context7: `truncate` = `overflow-hidden` + `text-ellipsis` + `whitespace-nowrap`; `flex-none` impede crescer e encolher). Nenhum depende da escala de espaçamento, então nenhum cai no buraco do degrau `0`.

### DN3B.2 — O `title` da linha de nuvem tem **um dono por estado**, e o nome truncado tem o seu

`DNC-25` manda o tripé para o `title` — **e não previu que a linha de nuvem já usa `title`** para a dica de chave ausente (`cloudHintFor`, linha 217). Duas informações, um atributo. A regra:

```ts
title={ready ? rateLimitTitle : cloudHintFor[model.provider]}
```

A dica vence quando desabilitada, porque é a única **acionável**: "configure uma chave" resolve o estado; "500 RPD" não resolve nada de quem nem consegue clicar.

⚠️ **E o nome truncado ganha `title` próprio, no `<span>` do nome, nos dois grupos** — o alvo de hover interno vence o externo, então cada zona da linha diz do que fala. Busca web desta sessão: **`title` é fonte de *último recurso* de nome acessível e parte das tecnologias assistivas o ignora** — por isso ele nunca é a única fonte do nome aqui: o texto do DOM continua completo (só o CSS corta), e o nome acessível da linha não muda. É também o que mantém de pé os `getByRole(..., { name: /…/ })` dos testes existentes.

⚠️ **Risco medido, e ele é de um caminho que já existe hoje:** `title` em elemento `disabled` só aparece enquanto ninguém aplicar `pointer-events: none` — é a causa documentada de tooltip sumido em elemento desabilitado (busca web). O projeto usa `disabled:cursor-not-allowed`, **nunca** `pointer-events-none`, e assim tem de continuar. **Vai para a verificação ao vivo:** a dica de chave existe desde o `N-1-B` e nunca foi olhada com o olho.

### DN3B.3 — Só `kind: 'rate'` sai da linha; `kind: 'concurrency'` fica

Confirmado pelo dono nesta sessão. A régua não é comprimento, é **estrutura**: `CloudRateLimit` já é união discriminada (`shared/ipc.ts:313`), então a condição é o próprio `kind`, não um juízo sobre quantos caracteres são demais. É também o que `DNC-28` pressupõe ao citar `195k de contexto 1 simultânea` como a frase corrida que o separador `·` conserta — se a concorrência tivesse saído junto, aquele exemplo não existiria.

`formatRateLimit` **não muda**: a mesma função alimenta os dois destinos.

### DN3B.4 — `até <n>k` nos dois grupos, e `não cabe` sozinho

`DNC-26`: o sufixo `de contexto` da linha de nuvem sai; os dois grupos passam a dizer `até <n>k`. Duas gramáticas para o mesmo fato, lado a lado na mesma lista, é o que se conserta.

`DNC-27`: o teto só é renderizado quando **há teto útil** — `ceiling !== null && fitsInMemory(ceiling)`. Hoje um teto minúsculo vira `Math.round(tokens/1024) === 0` e a linha lê `4,4 GB até 0k não cabe`. O veredito já diz tudo.

### DN3B.5 — Um destaque só, e "duas linhas destacadas" vira estado **inexpressável**

`DNC-29` manda unificar no mecanismo **local** (estado JS), porque a cor está certa e porque só o estado JS sincroniza com as setas do `role="listbox"`. Mas as linhas de nuvem **não estão no listbox** — as setas nunca chegam nelas —, então dois estados independentes (índice local + hover de nuvem) deixariam mouse e teclado destacando duas linhas ao mesmo tempo. Um estado discriminado torna isso impossível por construção, que é a forma de `features/panel/` da skill [`architecture`](../../../.claude/skills/architecture/SKILL.md):

```ts
type Highlight = { group: 'local'; index: number } | { group: 'cloud'; name: string }
```

`aria-activedescendant` e a tecla `Enter` derivam do ramo `local`; uma seta com o destaque na nuvem volta para o listbox, que é onde o foco sempre esteve.

**A cor é a do mecanismo local** — `border-border-strong bg-surface` —, e a direção está certa: a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) manda **descer** um degrau onde o item já parte de `surface-raised`, que é o fundo do `Popover`. É exatamente por isso que o `hover:bg-surface-raised` das linhas de nuvem é **inerte** hoje: pinta o fundo com a cor do fundo.

⚠️ **O default unificado é `border-transparent`**, não o `border-border` de hoje das locais — `DNC-29` manda unificar sem dizer em qual. Com borda visível em toda linha, o destaque disputa atenção com quatro caixas fixas; com borda transparente reservada, a largura já está paga e só a linha destacada aparece. **É o único item deste corte que muda a aparência de algo que não estava quebrado** — vai para a verificação ao vivo, com reversão de uma palavra se o dono discordar.

### DN3B.6 — `560px` é ponto de partida, e a janela estreita é o juiz

`DNC-24` registra que a largura **já subiu uma vez** (300 → 380 no `N-1-C`) para tratar o mesmo sintoma, e a segunda linha continuou lá. Desta vez a largura acompanha a mudança de eixo em vez de substituí-la.

O popover é ancorado e não tem trava de transbordo hoje. Entra `max-w-[90vw]` junto com `w-[560px]`: custa uma classe, e jsdom não faz layout — nenhum teste de nível 2 reprovaria um popover saindo da janela.

⚠️ **Duas larguras a confirmar ao vivo, não uma:** a do popover e a do bloco de metadados de `DN3B.1`. Nenhuma das duas se prova em teste.

---

## Passos

Três, commitáveis em separado.

### Passo 1 — a linha vira uma só

`ModelSelector.tsx`: `flex-row` nos dois grupos, os três blocos de `DN3B.1`, `·` entre metadados, `até <n>k` nos dois, `não cabe` sem teto, tripé para o `title` com o dono por estado, `title` do nome, `w-[560px] max-w-[90vw]`. `DN3B.1`–`DN3B.4`, `DN3B.6`.

Testes de nível 2 em `modelSelection.test.tsx` — **três existentes codificam o texto de hoje** e mudam junto (`195k de contexto` → `até 195k`, e as duas asserções de `15 RPM`/`20 RPD` passam a ser de `title`).

### Passo 2 — o destaque único

O estado discriminado de `DN3B.5`, o default unificado, e a cor certa nas linhas de nuvem. Teste novo: com o teclado em uma linha local e o mouse numa de nuvem, **exatamente uma** linha carrega a classe de destaque.

### Passo 3 — verificação ao vivo (do dono) e fechamento

Roteiro abaixo. Depois: `HISTORY.md`, `DECISOES.md`, a skill `design-system` se algo aqui decidir primeira linha, `ROADMAP.md`, e o plano para `implemented/`.

---

## Verificação

### Automatizada — cada teste visto **vermelho** antes de verde

Nível 2 (jsdom), em `modelSelection.test.tsx`. ⚠️ **O que o jsdom prova é a classe e o atributo, nunca a cor nem o layout** — truncamento, alinhamento e largura ficam integralmente na verificação ao vivo.

| O que prova | Sabotagem que tem de reprovar |
|---|---|
| a linha de nuvem diz `até 195k`, sem `de contexto` | manter o sufixo → a asserção de texto reprova |
| `1 simultânea` continua **na linha** (GLM) | mandá-la ao `title` junto do tripé → reprova |
| o tripé **não** está no texto e **está** no `title` de uma linha Gemini habilitada | deixá-lo inline → a asserção de ausência reprova |
| linha de nuvem **desabilitada** mantém a dica de chave no `title`, não o tripé | `title` sempre o tripé → a dica some e reprova |
| a linha `não cabe` não contém `até` | renderizar o teto sem condição → `até 0k` aparece |
| com teclado numa linha local e mouse numa de nuvem, **exatamente uma** linha tem a classe de destaque | dois estados independentes → duas linhas, contagem reprova |

⚠️ **Sabotagem estreita, uma por asserção** — anular a tela inteira num teste de duas asserções derruba a primeira e deixa a segunda sem exercício (custou duas sabotagens no 23-F).

⚠️ **Vermelho tem uma forma só:** `Tests N failed` com o **nome** do teste na lista. `Tests no tests` é a suíte não tendo corrido.

⚠️ **Manter o símbolo em uso ao sabotar**, ou o `typecheck` reprova antes do Vitest e o vermelho é do portão errado.

### Ao vivo (`pnpm dev`) — e o roteiro diz **regra**, não número

⚠️ **O diário do `N-3-A` registra que o roteiro anterior errou prometendo números fixos** para grandezas que se movem (a RAM livre caiu 6,05 → 4,96 GiB entre escrever a lista e olhá-la). Aqui nenhum item pede um número: todos pedem uma **forma**.

| # | O que olhar | O que reprova |
|---|---|---|
| 1 | popover aberto, janela larga | qualquer linha ocupando **duas** alturas de texto |
| 2 | a linha `gemini-3.5-flash-lite` (a mais cheia que existe) | o tripé ainda visível na linha; ou os chips fora da borda direita |
| 3 | os chips, varridos de cima a baixo | a coluna começando em `x` diferente entre linhas |
| 4 | hover numa linha de nuvem **habilitada** | nenhuma mudança visível (é o defeito inerte de hoje) |
| 5 | seta do teclado numa linha local + mouse numa de nuvem | **duas** linhas destacadas ao mesmo tempo |
| 6 | hover sobre uma linha de nuvem **desabilitada** (sem chave) | a dica de chave não aparecer — `title` em elemento desabilitado (`DN3B.2`) |
| 7 | hover sobre um nome truncado | o nome completo não aparecer |
| 8 | **janela estreita** (o caso do F-3-C) | o popover saindo da janela, ou o nome deixando de truncar e empurrando os chips |
| 9 | a borda das linhas em repouso (`DN3B.5`) | julgamento do dono: `border-transparent` ficou melhor ou pior que as caixas de hoje |

---

## Riscos nomeados

- **A largura do bloco de metadados é um número novo a manter.** Metadado mais longo que o previsto (um `sizeBytes` de quatro dígitos, um teto de sete) empurra ou trunca em silêncio. Mitigado só pelo item 3 do roteiro ao vivo.
- **`DN3B.5` muda a aparência de algo que não estava quebrado** (o default `border-border` das locais). Reversão de uma palavra, e o item 9 existe para isso.
- **O `title` em elemento desabilitado nunca foi verificado neste app** — a dica de chave existe desde o `N-1-B` e pode já estar invisível hoje. Se estiver, o conserto **não** é deste corte (é dica em elemento desabilitado, um assunto próprio); o corte registra o achado.
- **Três testes existentes mudam de asserção.** Não é enfraquecimento — o texto que eles codificam é exatamente o que `DNC-25`/`DNC-26` mandam trocar —, mas cada um precisa ser visto vermelho pela sabotagem nova, não só passar depois da edição.
- **Nada aqui prova largura, cor ou quebra de linha.** Um corte 100% visual com verificação 100% em jsdom seria verde e errado; a prova real é o roteiro do dono.

---

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
