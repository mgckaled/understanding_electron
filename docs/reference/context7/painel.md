# Context7 — o desenho do painel

> Anexo de [`README.md`](README.md). O terceiro inquilino da região da direita, desenhado na passagem de 07/09/2026. **É o material dos cortes 23-D em diante.** Nada aqui foi verificado ao vivo — é alvo, não medição.
>
> ⚠️ **O que o 23-D construiu, e onde os desenhos já divergem da tela (08/09/2026).** Existem hoje: o painel sobre `SidePanel`, o cabeçalho, o gatilho no popover do composer, os dois campos do Estado 1, o aviso de privacidade e a chamada de busca. **Três divergências deliberadas, não pendências esquecidas:** (1) o cabeçalho **não** tem `histórico ▾` nem `[+]` — os dois pressupõem consulta anexada, que só existe do 23-G em diante (D23D.9); (2) o resultado da busca sai como lista crua de `id` e título **dentro** do formulário, e é isso que o Estado 2 substitui — sem o `[ Voltar ]` do desenho, uma segunda tela deixaria o painel sem saída; (3) o gatilho no popover **não** é só um item a mais na lista: o popover troca a lista inteira pelo detalhe do anexo quando há arquivo pendente, então os três itens de arquivo travam e `Documentação` nunca trava (D23D.3).

---

## O painel — o terceiro inquilino (esboço acordado, 07/09/2026)

> **Status.** Desenho acordado na passagem decisão a decisão de 07/09/2026, ainda **sem código e sem sonda de interface** — o que está aqui é o alvo do arco, não algo verificado ao vivo. Ele carrega DM-15, DM-21, DM-23, DM-25, DM-28, DM-29, DM-30, DM-31 e DM-32.

### O que o separa dos dois inquilinos atuais

`artifact` e `draft` **abrem algo que já existe**: o painel é uma janela sobre o que a conversa produziu. Este é o primeiro que **compõe uma ação antes de existir objeto** — escolher biblioteca, desfazer ambiguidade, fixar versão, formular a pergunta — e só então há resultado.

É a razão de fundo de DM-29 nunca ter achado peça de interface: um `Switch` não compõe nada.

| | `artifact` | `draft` | `docs` |
|---|---|---|---|
| Origem do conteúdo | o usuário anexou | a conversa gerou | **veio de fora, sob demanda** |
| Existe antes do painel abrir | sim | sim | **não** |
| Tem fase de formulário | não | não | **sim** |

### As duas vidas de uma consulta

| Vida | O que é | O que se pode fazer |
|---|---|---|
| **Compondo** | ainda não foi para a conversa | tudo — trocar biblioteca, refazer, ajustar |
| **Anexada** | virou parte persistida e já foi ao modelo | só ler |

O congelamento na anexação copia a trava de janela de contexto (D15.13): travar no primeiro envio existe porque mudar depois, em silêncio, é exatamente o que não pode acontecer. Aqui o risco é o mesmo — alterar a seleção depois faria a tela divergir do que o modelo viu.

### O gatilho — sai de Ferramentas, entra em anexos (DM-29)

A linha `mcp` com `<Switch>` desabilitado **deixa de existir**. Capacidade é o que o *modelo* tem (`vision`, `tools`, `thinking`); consultar documentação é ação do usuário que produz um anexo — irmão estrutural de `DocumentPart`: texto de fora entrando como contexto.

```
  [ + ]  ┌──────────────────────────┐
         │  Dados      CSV/XLSX/JSON│
         │  Documento  PDF/MD/DOCX  │
         │  Imagem     PNG/JPG      │
         │  Documentação  Context7  │ ←  novo, abre o painel
         ├──────────────────────────┤
         │  Raciocínio        [ ●─] │
         │  Busca web         [─○ ] │
         │  MCP               [─○ ] │ ←  esta linha some
         └──────────────────────────┘
```

Nenhum provedor precisa declarar `tools` — é DM-0 sendo coerente até a ponta da interface.

### O contador no cabeçalho da conversa — o terceiro, nunca somado

O comentário do `DraftCount` já decide isto: *"an attachment came from the user and a draft came from the conversation, and one number for both would answer neither question."* A consulta é a terceira procedência — **veio de fora da conversa**. Três origens, três perguntas, três números.

```
  ┌────────────────────────────────────────────────────────────┐
  │  Análise de vendas 2026                    📎 3   ✎ 1   ▤ 2│
  └────────────────────────────────────────────────────────────┘
       título da conversa                    anexos rascunhos docs
```

Herda o molde inteiro: ausente quando é zero (não desabilitado, DF3B.2), `aria-pressed` por ser alternância, um clique abre a **mais recente** e o `histórico` do painel serve quem tem várias.

⚠️ **O contador conta o que foi anexado; composição em andamento não conta.** Amarrá-lo ao clique no composer criaria uma peça que conta zero.

| Momento | Item do composer | Contador |
|---|---|---|
| Nunca consultou | abre o painel vazio | ausente |
| Compondo, painel fechado | **retoma** a composição, texto preservado | ainda ausente |
| Depois do primeiro `Anexar` | inicia uma nova | `▤ 1`, e vira a via principal |

O "retoma" é o que faz isso não incomodar: o provider segura a composição, então fechar o painel no meio não perde nada.

⚠️ **Ícone: verificar ao vivo.** `NotebookPen` (rascunho) e `BookMarked` têm silhueta parecida a 16px. A proposta é `Library` — três livros empilhados, massa visual distinta de `Paperclip` e `NotebookPen`. Renderizar os três lado a lado no tamanho real antes de fixar; jsdom não pega confusão de silhueta.

### O cabeçalho fixo do painel, e o `+`

```
┌──────────────────────────────────────────────────────────┐
│ ▤ /tanstack/query · v5   [ histórico ▾ ]    [+] [⧉] [×]  │
└──────────────────────────────────────────────────────────┘
```

O `+` inicia uma consulta sem voltar ao composer — é o que transforma o painel de formulário de uma vez só em bancada de trabalho. Com duas restrições:

- **Não abre um segundo painel.** Um inquilino por vez é invariante de construção (DE1B.1): o `+` troca o conteúdo para o estado *compondo*, e o `histórico ▾` é o caminho de volta. Composições paralelas exigiriam um segundo eixo de navegação dentro do painel, e aí o `histórico` deixa de responder sozinho *"onde estou"*.
- **Só existe enquanto o painel mostra uma consulta anexada.** Compondo, você já está numa nova — um `+` ali ou não faz nada, ou descarta em silêncio o que está digitado. Ausente, não desabilitado (DF3B.2).

O `[⧉]` e o `[×]` são os mesmos de `ArtifactPanel`, no grupo `ml-auto`.

### O `histórico ▾` e o desligar (DM-31, decidida em 07/09/2026)

**Consultas acumulam — nenhuma substitui outra —, e cada uma pode ser desligada do contexto sem sair da transcrição.**

O problema que isto resolve: toda parte da conversa é remontada e reenviada ao modelo a cada turno. Duas consultas de ~600 tokens custam ~1.200 em **toda** mensagem seguinte; cinco custam ~3.000, quase 10% de uma janela de 32k, gastos antes de o usuário escrever qualquer coisa.

Substituir automaticamente a consulta anterior da mesma biblioteca foi **descartado**: se a primeira pergunta foi sobre cache e a segunda sobre paginação, a substituição apagaria contexto que o usuário pediu e que o modelo já tinha visto — o mesmo "encolher em silêncio" que a trava de janela existe para impedir (D15.13).

```
  [ histórico ▾ ]
  ┌──────────────────────────────────────────────────┐
  │  nesta conversa                    1.204 tok ativos│
  ├──────────────────────────────────────────────────┤
  │  ▤ /tanstack/query          4 trechos   588 tok [●─]│
  │     invalidar cache depois de mutação             │
  │                                                  │
  │  ▤ /colinhacks/zod          3 trechos   616 tok [●─]│
  │     refinamento condicional em objeto             │
  │                                                  │
  │  ▤ /tanstack/query          5 trechos   742 tok [─○]│
  │     paginação com keepPreviousData      desligada │
  └──────────────────────────────────────────────────┘
```

O que cada peça carrega:

| Peça | Papel |
|---|---|
| Total no topo | soma **só das ativas** — é o custo real por turno |
| Interruptor por linha | tira do reenvio; a consulta continua na transcrição |
| A pergunta como subtítulo | duas consultas da mesma biblioteca só se distinguem por ela |

Aqui o `Switch` **é** a peça certa, e não contradiz DM-15/DM-29: desligar uma consulta é **modo** de algo que já existe, não o acionamento de uma ação. Foi por não ser modo que o gatilho deixou de ser interruptor.

**Uma consulta desligada muda de aparência na conversa**, senão o desligamento é invisível onde mais importa:

```
   ▤  Consultei /tanstack/query — 5 trechos, ~742 tok       ›
      fora do contexto
```

O que isto custa em código, e nada além: um booleano na parte persistida, um filtro em `partForProvider` (onde a conversa é montada para o provedor) e o interruptor. O contador do cabeçalho segue contando **todas** — desligada continua sendo uma consulta da conversa.

⚠️ **O total do `histórico` e o medidor do composer precisam concordar.** São dois números na tela ao mesmo tempo, e o do composer sai do `budgetFor`. Se o filtro do reenvio ficar em um lugar e a soma em outro, eles divergem — a soma deve derivar do mesmo conjunto que `partForProvider` devolve, nunca de uma segunda contagem escrita à mão.

### Três abas, porque a API devolve três formas diferentes

Não é organização estética — misturá-las apagaria distinções que importam.

| Aba | Origem | Por que separada |
|---|---|---|
| **Trechos** | `codeSnippets[]` | tem `codeId` → link para o GitHub. Único com procedência verificável |
| **Notas** | `infoSnippets[]` | ⚠️ **a premissa caiu na sonda do 23-A:** `pageId` é URL completa, então nota também linka. A aba continua separada porque a forma é outra — prosa, não código — e porque vem **vazia na maioria** das respostas, precisando de estado vazio próprio |
| **Regras** | `rules[]` | superfície de injeção (achado 3). Sai da sombra por desenho, com `⚠`, e só aparece quando existe |

`Tabs` aqui **não** usa `keepMounted`: são listas, sobrevivem a desmontar. O caso do `keepMounted` é o CodeMirror do rascunho, cuja história de desfazer morre com a `EditorView`.

### O rodapé é a peça principal

É onde o princípio do fluxo — *não se modula o que vem, modula-se o que se faz com o que veio* — vira coisa visível. A etapa 5 não aceita `limit` nem `tokens`; o controle inteiro está entre o que chegou e o que é enviado.

E `~588 tok` **não é estimativa por caractere**: a API devolve contagem por trecho. É o único lugar do app onde o orçamento é exato antes de enviar — em todo o resto, `charsPerToken` é chute calibrado depois. Exibir com essa confiança é honesto.

O veredito de caber vem do mesmo `budgetFor` do composer, e `Anexar` desabilita quando `fits` é falso, pelo motivo de sempre: o Ollama descarta o começo do prompt em silêncio, então recusar antes é a única defesa.

### Os estados

O corpo **não é um `ViewState` só — são dois em série**, e dizer isso agora evita descobrir na implementação:

```
   idle ──[Consultar]──► loading(busca) ──► candidatos ──[◉]──►
        loading(contexto) ──► ready(trechos) ──[Anexar]──► anexada
                    │
                    └──► empty | error(upstream 429 / unavailable)
```

`empty` tem **dois textos diferentes**, porque o conserto do usuário é oposto: *"nenhuma biblioteca com esse nome"* (busca) e *"a biblioteca existe, mas nada respondeu à pergunta"* (contexto).

`error` já tem tudo pronto: `describeUpstreamError` trata 401/403/429 com dica específica, e 429 é literalmente o modo de falha da cota gratuita.

### Estado 1 — compondo, nada consultado

```
┌──────────────────────────────────────────────────────────┐
│ ▤ Documentação            [ histórico ▾ ]        [⧉] [×] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Biblioteca                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ tanstack query                                  🔍 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Pergunta                                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ como invalidar o cache depois de uma mutação       │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│  Acompanha a próxima mensagem — não substitui ela.       │
│  ⚠ A pergunta é enviada ao Context7, mesmo em conversa   │
│    local.                                                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ nada consultado                        [   Consultar   ] │
└──────────────────────────────────────────────────────────┘
```

⚠️ **A busca não dispara ao digitar.** Cada tecla seria uma chamada paga contra uma cota de 1.000/mês — o botão é o compromisso explícito.

### Estado 2 — desambiguação (DM-30, decidida em 07/09/2026)

Desenho refeito **com a resposta real** de `query=tanstack query`, já ordenada do lado do app por `benchmarkScore` decrescente:

```
├──────────────────────────────────────────────────────────┤
│  Cinco bibliotecas batem com "tanstack query".            │
│                                                          │
│  ◉  /tanstack/query                          2.526 trechos│
│     TanStack Query · main · 45.043 ★     benchmark 89,5  │
│                                                          │
│  ○  /tanstack/query                          3.241 trechos│
│     TanStack Query · main · 45.043 ★     benchmark 89,0  │
│                                                          │
│  ○  /websites/tanstack_query_v4                828 trechos│
│     TanStack Query                        benchmark 86,7 │
│                                                          │
│  ○  /websites/tanstack_query_framework_react   881 trechos│
│     TanStack Query React                  benchmark 86,2 │
│                                                          │
│  ○  /websites/tanstack_query                 2.246 trechos│
│     TanStack Query                        benchmark 78,8 │
│                                                          │
│  Versão   [ padrão da biblioteca  ▾ ]   5 indexadas      │
├──────────────────────────────────────────────────────────┤
│ nada consultado      [ Voltar ]        [   Consultar   ] │
└──────────────────────────────────────────────────────────┘
```

Três coisas nesse desenho vêm direto da sonda e **não são hipótese**:

- **As duas primeiras linhas têm o mesmo `id`.** É a resposta real, não erro de transcrição — e é o motivo de a identidade da seleção não poder ser o `id`.
- **A tela sempre aparece.** Nunca voltou 1 candidato; o mínimo observado foi 3 (`unpdf`), o normal é 5. Um atalho para "só um resultado" seria código que nunca roda.
- **Não existe "mais recente".** `versions[]` mistura `v5.90.3` com `v5_84_1` e traz `__branch__*` — o rótulo é `padrão da biblioteca`, e escolher versão é ato explícito sobre a lista crua, com os `__branch__*` filtrados.

⚠️ **A ordem que aparece é a do app, nunca a da API** — a da API varia entre chamadas idênticas. Ordenação: `benchmarkScore` decrescente, desempate por `id`, para que a mesma busca desenhe sempre a mesma tela.

⚠️ **`stars: -1` não se exibe.** É sentinela de "não se aplica" em todo `/websites/*`, não uma contagem — daí as três últimas linhas do desenho não terem estrela.

### Estado 3 — resultado

```
┌──────────────────────────────────────────────────────────┐
│ ▤ /tanstack/query · v5    [ histórico ▾ ]   [+] [⧉] [×]  │
├──────────────────────────────────────────────────────────┤
│  ┌ Trechos (7) ┬ Notas (2) ┬ Regras (1) ⚠ ┐              │
│  └─────────────┴───────────┴──────────────┘              │
│                                                          │
│  [✓] invalidateQueries após mutação           182 tok  ↗ │
│      queryClient.invalidateQueries({ queryKey: [...] })  │
│      …                                                   │
│                                                          │
│  [✓] onSuccess vs onSettled                    96 tok  ↗ │
│  [ ] setQueryData para atualização otimista   241 tok  ↗ │
│  [✓] useMutation — assinatura completa        310 tok  ↗ │
│  [ ] Migrando da v4: mudanças em invalidate   198 tok  ↗ │
│  [ ] staleTime e a interação com refetch      145 tok  ↗ │
│  [ ] Exemplo end-to-end com Suspense          402 tok  ↗ │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 4 de 7 · ~588 tok · cabe (janela 32k, 71% livre)         │
│                    [ Consultar de novo ]     [  Anexar ] │
└──────────────────────────────────────────────────────────┘
```

### A linha na conversa — divulgação retrátil, molde do raciocínio (DM-23, decidida em 07/09/2026)

**Tipo próprio de parte, e na tela uma divulgação retrátil**, no molde de `ReasoningDisclosure` — não o cartão de anexo. Fechada por padrão em mensagem histórica, para não disputar espaço com a conversa.

Fechada:

```
   ▤  Context7 · /tanstack/query        4 trechos · 588 tok  ⌄   ⧉
```

Aberta:

```
   ▤  Context7 · /tanstack/query        4 trechos · 588 tok  ⌃   ⧉
      ─────────────────────────────────────────────────────────
      "invalidar cache depois de mutação"
        · invalidateQueries após mutação                 182 tok
        · onSuccess vs onSettled                          96 tok
        · useMutation — assinatura completa              310 tok
        · staleTime e a interação com refetch             — não enviado
```

Desligada do contexto (DM-31):

```
   ▤  Context7 · /tanstack/query        5 trechos · 742 tok  ⌄   ⧉
      fora do contexto
```

O que o desenho fixa:

| Decisão | Razão |
|---|---|
| Mesmo ícone `Library` do composer, do contador e do painel | um ícone para o assunto inteiro; o olho liga os quatro lugares sem pensar |
| Fechada por padrão | mensagem histórica não se abre sozinha, igual ao raciocínio |
| O corpo lista **títulos e custo**, nunca o código dos trechos | o conteúdo é do painel; a linha responde *"o que foi enviado e quanto custou"* |
| Trecho não enviado aparece riscado/`— não enviado` | é o registro da escolha do bloco 1; sem ele, a seleção some da transcrição |
| A palavra "Context7" no rótulo | a procedência que DM-32 mandou ficar no texto |

⚠️ **São dois controles, e não podem ser aninhados.** `ReasoningDisclosure` usa um `<button>` para o cabeçalho inteiro; aqui é preciso um segundo para abrir o painel (`⧉`). Botão dentro de botão é HTML inválido e o React nem avisa — os dois são **irmãos** num contêiner flex, com o `⧉` fora do alvo de clique do retrátil.

O resto vem de graça do molde: `aria-expanded`/`aria-controls`, `h-[0px]` em vez de `h-0` (o `--spacing-*` só existe de 1 a 9), e `[height:calc-size(auto,size)]` para animar até o conteúdo.


### DM-32 — DECIDIDA: ícone de livros empilhados, nunca o logotipo

**O logotipo da Upstash está descartado** (07/09/2026). O mesmo ícone serve os três lugares: o botão no popover do composer, o contador do cabeçalho e o cabeçalho do painel.

O motivo jurídico e o de design apontam para o mesmo lado:

- O Context7 é da **Upstash**. Há Termos de Serviço e um *Context7 Addendum* próprio, mas **nenhuma página de _brand guidelines_ ou _press kit_ publicada** — nada autoriza, nada proíbe, e em marca o padrão é "precisa de autorização", não o contrário. O repositório é **MIT**, e licença de código nunca concedeu direito sobre nome ou logotipo (Apache 2.0 § 6 chega a dizê-lo explicitamente). O crivo é distribuído por instalador, não uso privado.
- **E o argumento de design system seria decisivo mesmo com licença liberada:** o logotipo é um _lockup_ de fundo preto sólido com raio próprio. Não tem tema claro, não responde a `prefers-color-scheme`, seria a única cor do app fora de `tokens.css` — e o `guard` **não a veria**, por ser arquivo e não `#hex` em CSS ou `className`. Seria o único ponto imune às duas verificações de cor, bem no cabeçalho.

**Procedência fica no texto:** a palavra "Context7" como texto no cabeçalho do painel e no rodapé da consulta. Uso nominativo credita a fonte, herda os tokens e funciona nos dois temas.

### A seleção — resolvida em 07/09/2026

**O rodapé com `4 de 7` e caixas de marcação contradiz DM-16 e DM-25**, que fecharam "não construir seleção" e "painel em leitura apenas" apoiadas na medição de 4–5 trechos e ≤1.244 tokens: sem volume, não há o que selecionar.

**Decidido pela seleção completa**, com DM-16 e DM-25 revogadas e o corte 23-C de volta. O argumento que venceu é de premissa, não de tamanho: o crivo existe para gerenciar e controlar o que vai ao modelo, e abrir mão disso porque *hoje* a resposta é pequena seria decidir por uma medição que nada garante que se mantenha — o `openapi.json` não promete teto nenhum.

⚠️ **O `7` do desenho continua sendo número inventado.** Nenhuma sonda passou de 5. Ao montar as fixtures do 23-A, capture uma resposta real de biblioteca grande antes de dimensionar a rolagem da lista.

### O que mais o esboço presume

- **DM-30** → o usuário digita e o usuário desambigua; `trustScore` informa e não decide.
- ~~**DM-31**~~ — decidida, ver § próprio.
- **Forma do dado** → a parte persiste o que foi **anexado**, não a resposta bruta. Guardar tudo e filtrar na leitura permitiria remarcar depois — mas contradiz o congelamento, e um dia divergiria do que o modelo viu.

---
