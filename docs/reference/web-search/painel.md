# Busca web — o painel, em esquema

> Anexo de [`README.md`](README.md). **Nada aqui está decidido.** É o desenho posto em plaintext para ser discutido — onde há bifurcação real, as duas formas aparecem lado a lado, com o argumento de cada uma. As perguntas correspondentes estão em [`decisoes.md`](decisoes.md).
>
> A forma herda o painel de documentação do arco 23 ([`context7/painel.md`](../context7/painel.md)), que é o precedente mais próximo: conteúdo que **veio de fora, sob demanda**, e que não existe antes do painel abrir.

---

## 1. O ponto de partida: o que já está na tela hoje

```
  [ + ]  ┌──────────────────────────────┐
         │  ANEXOS                      │
         │  Dados tabulares             │
         │  Documentos                  │
         │  Imagens                     │
         │  Código              (inerte)│
         │  Documentação      Context7  │ ← abre o painel (23-D)
         ├──────────────────────────────┤
         │  FERRAMENTAS                 │
         │  🌐 Busca web        [─○ ]   │ ← existe, permanentemente desligado
         │  💡 Raciocínio visível [ ●─] │
         └──────────────────────────────┘
```

O fonte: `renderer/features/attachment/AttachMenu.tsx`, `TOOLS[0] = { label: 'Busca web', Icon: Globe, kind: 'webSearch' }`. O `Switch` tem `checked: false` fixo, `onChange: () => {}` e `disabled: true`.

⚠️ **O precedente diz que essa linha não sobrevive na forma de interruptor, e o argumento não é de gosto.** O arco 23 tinha uma linha irmã — `MCP`, também com `Switch` inerte — e ela **deixou de existir** (`DM-29`), com esta razão registrada:

> Capacidade é o que o *modelo* tem (`vision`, `tools`, `thinking`); consultar documentação é ação do usuário que produz um anexo. **Um `Switch` não compõe nada.**

Um interruptor promete um **modo**: *ligado, o modelo busca quando precisar*. Isso só existe com *tool calling*, que o app não tem e decidiu não ter (`DM-0`). Sem ele, busca web não é um estado — é um **ato**, com uma pergunta ou uma URL dentro. Não há o que ligar.

**Então a primeira pergunta do painel é anterior ao painel:** a linha `Busca web` vira item de ANEXOS (e abre isto), ou permanece em FERRAMENTAS com outro significado? Ver [`decisoes.md`](decisoes.md).

```
  [ + ]  ┌──────────────────────────────┐        A forma que o precedente sugere
         │  ANEXOS                      │
         │  Dados tabulares             │
         │  Documentos                  │
         │  Imagens                     │
         │  Código              (inerte)│
         │  Documentação      Context7  │
         │  🌐 Web                      │ ← sobe para cá, abre o painel
         ├──────────────────────────────┤
         │  FERRAMENTAS                 │
         │  💡 Raciocínio visível [ ●─] │ ← sobra uma linha só no grupo
         └──────────────────────────────┘
```

⚠️ **Consequência que precisa ser olhada de frente:** o grupo `FERRAMENTAS` fica com **um item**. Um cabeçalho de grupo para uma linha é um cabeçalho que não agrupa nada — ou o raciocínio volta para junto do resto, ou o grupo perde o rótulo, ou se aceita a assimetria. É decisão pequena, mas some do radar se não for escrita agora.

---

## 2. O corpo do painel — a bifurcação principal

O pilar tem duas operações com entradas incompatíveis: **uma pergunta** e **uma URL**. Três formas de acomodá-las.

### Forma A — duas abas dentro de um painel

```
┌──────────────────────────────────────────────────────────────┐
│ 🌐 Web                        [ histórico ▾ ]    [⧉] [×]     │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────┬─────────────┐                                   │
│  │ Buscar  │  Abrir URL  │                                   │
│  └─────────┴─────────────┘                                   │
│                                                              │
│   O que procurar                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ paginação com cursor em TanStack Query                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│   Resultados   [ 1 ][ 3 ][ 5 ][ 10 ]     ~2.100 tok cada     │
│                     ▔▔▔                                      │
│                                                              │
│  ⚠ A pergunta sai desta máquina, inclusive em conversa local │
│                                                              │
│                                       [    Buscar    ]       │
└──────────────────────────────────────────────────────────────┘
```

A aba `Abrir URL` troca o campo e some com o seletor de quantidade:

```
│  ┌─────────┬─────────────┐                                   │
│  │ Buscar  │  Abrir URL  │                                   │
│  └─────────┴─────────────┘                                   │
│                                                              │
│   Endereço                                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ https://tanstack.com/query/latest/docs/…               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ⚠ O endereço sai desta máquina. Não cole URL com token.     │
│                                                              │
│                                       [    Abrir    ]        │
```

✅ Cada operação diz o que custa e o que vaza, na própria aba.
✅ `Tabs` já é primitivo de `shared/ui/` — nasceu no F-3-D e subiu no E-1-C.
⚠️ Duas abas para o que muitas vezes é o mesmo gesto: colar um link.

### Forma B — um campo só, que decide pelo conteúdo

```
│   Pergunta ou endereço                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ https://tanstack.com/query/latest/docs/…               │  │
│  └────────────────────────────────────────────────────────┘  │
│   ↳ reconhecido como endereço — a página será aberta         │
│                                                              │
│                                       [   Consultar   ]      │
```

✅ Um gesto só; colar link funciona sem escolher aba antes.
⚠️ **O modo vira inferência**, e inferência erra em silêncio — `localhost:3000` é URL ou termo de busca? A linha `↳ reconhecido como…` existe justamente para tornar o palpite visível, mas ela é um remendo sobre uma ambiguidade criada de propósito.
⚠️ Perde o lugar natural do `max_results`, que só existe num dos modos.

### Forma C — dois itens no menu `+`, um painel por operação

```
         │  🌐 Buscar na web            │
         │  🔗 Abrir endereço           │
```

✅ A ambiguidade morre antes do painel; cada painel é mais simples.
⚠️ Duas linhas de menu para um pilar, num menu que já tem seis.

---

## 3. O resultado, e **a** pergunta de controle

Este é o ponto que o pedido *"eu escolho exatamente o que entra no contexto"* decide, e ele não é sobre o layout — é sobre **qual é a unidade que ganha uma caixa de marcação**.

### Opção 1 — a unidade é o resultado inteiro

```
┌──────────────────────────────────────────────────────────────┐
│ 🌐 paginação com cursor em TanStack Query      [⧉] [×]       │
├──────────────────────────────────────────────────────────────┤
│  3 resultados · 6.964 tok           marcados: 2 · 4.180 tok  │
├──────────────────────────────────────────────────────────────┤
│  [x] ▸ Infinite Queries | TanStack Query          2.086 tok  │
│        tanstack.com/query/latest/docs/…                      │
│                                                              │
│  [x] ▸ Paginated Queries                          2.094 tok  │
│        tanstack.com/query/latest/docs/…                      │
│                                                              │
│  [ ] ▸ Blog: cursor pagination explained          2.784 tok  │
│        medium.com/@alguem/…                                  │
├──────────────────────────────────────────────────────────────┤
│                              [ Anexar à conversa ]           │
└──────────────────────────────────────────────────────────────┘
```

✅ Simples, e a unidade é a que o serviço devolve.
⚠️ **A granularidade é grossa.** Um resultado é ~2.100 tokens indivisíveis — 6,4% de uma janela de 32k, num modelo local, por um item. O usuário escolhe *quais páginas*, nunca *que parte da página*.

### Opção 2 — a unidade é a seção do markdown

O `content` volta em markdown, e markdown tem `##`. Fatiar por heading dá caixas de marcação de tamanho útil:

```
│  ▾ [~] Infinite Queries | TanStack Query          2.086 tok  │
│        tanstack.com/query/latest/docs/…                      │
│        [x] Introdução                               180 tok  │
│        [x] useInfiniteQuery                         640 tok  │
│        [ ] Bi-directional                           410 tok  │
│        [ ] Exemplo completo                         856 tok  │
│                                                              │
│  [ ] ▸ Blog: cursor pagination explained          2.784 tok  │
```

✅ **É o controle fino que o pedido descreve** — e é o mesmo grão do Context7, onde a unidade é o trecho e não a biblioteca.
✅ A caixa do pai vira tri-estado (`[x]` tudo · `[~]` parte · `[ ]` nada), padrão conhecido.
⚠️ **A fatia é do app, não do serviço** — o `crivo` passa a ter um particionador de markdown, que é código próprio a manter. O precedente contrário existe e é forte: a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) registra a recusa a escrever *"um partidor de acento grave de oito linhas"*, porque cria um segundo dono do markdown que envelhece calado.
⚠️ ⚠️ **E há o caso que quebra a premissa: uma página sem nenhum `##`.** Vira uma seção só de 2.086 tokens, e a opção 2 degrada para a opção 1 sem avisar. Precisa de um comportamento declarado, não de sorte.

### Opção 3 — corte por orçamento, não por estrutura

```
│  Trazer  [ ●──────── ]  1.200 de 6.964 tok                   │
│          os primeiros trechos de cada resultado              │
```

⚠️ Registrada para ser **descartada explicitamente**: é truncamento com outro nome, e o `DM-0` escolheu REST sobre MCP exatamente porque *"pelo MCP se trunca; pela REST se seleciona"*. Um controle assim desfaz o argumento que fundou a forma do arco anterior.

---

## 4. Os `links[]` — o segundo salto

Só `web_fetch` os devolve. Duas leituras:

```
│  ─────────────────────────────────────────────────────────   │
│  Links desta página                            18 encontrados│
│  ▸ tanstack.com/query/latest/docs/guides/queries             │
│  ▸ tanstack.com/query/latest/docs/guides/mutations      [ ↻ ]│
│                                        abrir também ↑        │
```

✅ Permite encadear sem *tool calling*, com a pessoa no comando de cada salto.
⚠️ **É por onde uma página hostil oferece o próximo endereço.** O guarda de URL vale igual aqui, e o ato continua sendo humano.
⚠️ Pode ser simplesmente **não exibido** no primeiro momento — `links[]` é um campo que existe, não uma feature obrigatória.

---

## 5. Depois de anexar — as duas vidas, e o custo por turno

Herdadas inteiras do Context7, e o motivo é aritmético, não estético.

| Vida | O que se pode fazer |
|---|---|
| **Compondo** | tudo — refazer, remarcar, trocar a pergunta |
| **Anexada** | só ler, e **desligar** |

O congelamento na anexação copia a trava de janela de contexto (`D15.13`): alterar a seleção depois faria a tela divergir do que o modelo viu.

⚠️ **O desligar não é conforto — é o botão de custo mais importante deste pilar.** Toda parte da conversa é remontada e **reenviada a cada turno** (`partForProvider`). Uma busca de 4.180 tokens marcados custa 4.180 em **toda** mensagem seguinte. Duas buscas e um fetch passam de 10 mil tokens gastos antes de a pessoa escrever qualquer coisa — num `DEFAULT_NUM_CTX` de 32.768, com 35% reservados para geração.

```
  [ histórico ▾ ]
  ┌──────────────────────────────────────────────────────────┐
  │  nesta conversa                          5.730 tok ativos│
  ├──────────────────────────────────────────────────────────┤
  │  🌐 paginação com cursor…      2 de 3 result. 4.180 [●─] │
  │  🔗 docs.ollama.com/cloud           1 página  1.550 [●─] │
  │  🌐 duckdb read_xlsx sheet…    1 de 3 result. 2.100 [─○] │
  └──────────────────────────────────────────────────────────┘
```

Desligado sai do reenvio (`partForProvider` devolve `''`) e **fica na transcrição** — o registro do que foi consultado não se perde. É `DM-31` aplicado sem mudança.

---

## 6. O contador do cabeçalho — o quarto, ou não

Hoje são três, e cada um responde uma pergunta de procedência diferente:

```
  ┌────────────────────────────────────────────────────────────┐
  │  Análise de vendas 2026                📎 3   ✎ 1   ▤ 2    │
  └────────────────────────────────────────────────────────────┘
                                        anexos  rascunhos  docs
```

```
  │  Análise de vendas 2026           📎 3   ✎ 1   ▤ 2   🌐 3  │
                                                          ↑ quarto?
```

⚠️ **A régua já existe e é citável:** *"um anexo veio do usuário e um rascunho veio da conversa, e um número para os dois não responderia nenhuma pergunta"*. Consulta a documentação e busca na web têm a **mesma** procedência — vieram de fora, sob demanda. Pela régua, isso argumenta a favor de **somar no mesmo contador**, não de criar um quarto.

⚠️ Contra: são serviços diferentes, com cotas diferentes e uma delas sem saldo legível. E quatro ícones numa faixa que já tem três começa a ser ruído de chrome.

---

## 7. O que este painel tem que o de documentação não tem

| | `docs` (Context7) | `web` |
|---|---|---|
| Entrada | biblioteca + versão + pergunta | pergunta **ou** endereço |
| Ambiguidade de alvo | resolvida por lista de candidatos | ⚠️ **nenhuma lista** — o índice decide sozinho |
| Saldo de cota exibível | sim (`docs:quota`) | ⚠️ **não existe header** |
| Regras de terceiro a exibir | `rules`, exibido e nunca enviado | — |
| Fonte de cada item | a biblioteca | ⚠️ **uma URL por item, e ela importa** |

⚠️ **A URL de cada resultado é conteúdo de primeira classe aqui, não metadado.** Em documentação, saber que o trecho veio de `/tanstack/query` basta. Numa busca, `medium.com/@alguem` e `tanstack.com` têm credibilidade diferente, e essa diferença é justamente o que a pessoa usa para decidir o que marcar. **A URL precisa estar visível na linha da caixa de marcação, não escondida atrás de um retrátil.**
