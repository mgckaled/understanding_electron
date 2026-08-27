# F-3-D — O dataset no painel: abas, paginação reservada e a consulta como ferramenta

> Quarto plano do painel de artefato, depois do [F-3-A](F-3-A-painel-de-artefato.md) (a região, documento e imagem), do [F-3-B](F-3-B-como-se-chega-ao-painel.md) (clipe, seletor, atalho) e do [F-3-C](F-3-C-o-painel-como-objeto-de-desktop.md) (transição, janela estreita, arrasto). Este traz o **dataset** — o único artefato com mais de uma vista, e por isso o primeiro que precisa de abas.

**Origem:** o F-3-A reservou o dataset para cá desde o primeiro corte, e a **DF3A.3** desenhou o corpo do painel podendo ser assíncrono _contra este caso_, não contra os fáceis. A conversa que precedeu este plano decidiu três coisas: o `tablist` como forma, a paginação **reaberta** (o `ROADMAP` a dava por encerrada) e a saída do botão de copiar.

**Entrega:** `ArtifactRef` ganha o terceiro membro; o corpo do painel vira um `tablist` de três abas (**Dados** · **Perfil** · **Consulta**); a tabela ganha rodapé de paginação com os números reais; `DatasetCard` encolhe para cartão. Nenhum canal IPC novo — o plano inteiro vive em `renderer/`.

---

## O corte do F-3, atualizado

| | Entrega | Estado |
|---|---|---|
| **F-3-A** | A região, o estado, documento e imagem | ✅ 26/08/2026 |
| **F-3-B** | Como se chega ao painel: clipe, seletor, atalho | ✅ 26/08/2026 |
| **F-3-C** | O painel como objeto de desktop | ✅ 26/08/2026 |
| **F-3-D** (este) | Dataset entra no painel | — |
| **F-3-E** | Copiar imagem pelo canal `image:bytes` | — |
| **F-3-F** | A aba **Passos**: o pipeline como estado, e o refino da proposta | — |

**Por que nasce um sexto plano.** A aba Passos parece um item a mais num array, e não é: ela exige que "o pipeline aplicado a este dataset" **exista como estado**, e hoje não existe — `dataset:transform` é dispara-e-esquece, o resultado mora num `useState` dentro do cartão e morre ao recarregar. Decidir onde esse estado vive é arquitetura, não layout. Detalhe na DF3D.9.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| O clipe e o seletor precisam aprender a contar dataset | **Não mudam.** `artifactsOf` filtra o que `toArtifactRef` devolve como `null`; devolver o `ref` faz os dois passarem a contar sozinhos. É literalmente o que a DF3B.7 prometeu — _"nenhuma linha do clipe muda"_ |
| O seletor também não muda | ⚠️ **Muda uma coisa:** ele escolhe o ícone com `kind === 'image' ? Image : FileText`, em **dois** lugares (gatilho e linha da lista). Um dataset caindo no `else` viraria "documento" no olho do usuário |
| Trocar o tamanho da página exige canal novo | **Não.** `buildFinalSql` já embrulha toda consulta em `SELECT * FROM (…) LIMIT n`, e o `LIMIT 50` da pré-visualização é texto do **renderer** (`useDatasetPreview`). O teto de 201 do handler (D18B.4) continua acima de tudo |
| Paginar é só somar `OFFSET` ao mesmo SQL | **Não verificado, e fora deste plano.** O total já vem de graça (`part.rowCount`), mas o canal devolve Arrow sem sinal de posição. Quem escrever a paginação mede isso, não este plano |
| O corpo do painel aguenta conteúdo que carrega e falha | **Sim, por desenho.** DF3A.3, a única concessão a consumidor futuro do F-3-A. Este é o consumidor |
| `Tabs` vira o oitavo primitivo | **Não.** A régua do design system exige **dois** chamadores, e `Panel`/`Toolbar` já foram apagados no DS-8 por nascerem com um |
| Mexer em `DatasetTable` só afeta o painel | ⚠️ **Não.** Ele tem **três** chamadores desde o plano 19 (`DatasetPreview`, `DatasetQueryPanel`, `StepProposalCard`) — foi a régua dos três que o extraiu. Alinhamento novo aparece também na bolha |
| Fechar o painel preserva o SQL digitado | **Não.** O painel faz `return null` quando `current` é nulo: React desmonta, estado local morre. Vale para o texto do SQL e para a aba selecionada |

---

## Decisões

### DF3D.1 — O corpo do dataset é um `tablist`, e isso substitui dois mecanismos diferentes

Hoje o `DatasetCard` resolve a mesma ideia de duas formas: `Perfil` é um _disclosure_ manual (chevron + `useState`), e `Consultar` é um interruptor de dois estados que **troca** a pré-visualização pelo painel de SQL. Duas gramáticas para "escolher o que ver".

Vira **uma**: `Dados` · `Perfil` · `Consulta`, no padrão Tabs da WAI-ARIA APG (`role="tablist"`, `role="tab"`, `role="tabpanel"`, setas navegam, `aria-selected`), vestido com o visual do alternador segmentado que Configurações já usa.

Ganho colateral que não é decoração: a regra do _post-18-C fix_ — _"a pré-visualização e a consulta nunca renderizam tabela ao mesmo tempo, ou a consulta padrão duplica as linhas acima dela"_ — deixa de ser uma condição a manter e passa a ser propriedade do `tablist`. Uma aba de cada vez é o que ele **é**.

### DF3D.2 — O `tablist` mora em `features/artifact/`, não em `shared/ui/`

Um chamador só. A régua é ter **dois**, e o DS-8 apagou dois primitivos por essa razão exata. Ele sobe para `shared/ui/` quando o segundo aparecer — e a aba Passos do F-3-F **não** conta, porque é uma aba a mais no mesmo `tablist`, não um segundo chamador.

### DF3D.3 — O rodapé de paginação nasce inteiro, com metade funcionando de verdade

O usuário reabriu a paginação: ela **vai** existir, com carregamento eficiente, num plano próprio. Aqui entra o lugar visual dela — e ele não precisa ser falso, porque metade já funciona hoje:

```text
┌───────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ tabela                                    │ │
│ └───────────────────────────────────────────┘ │
│  ◀   1–50 de 8.412 linhas   ▶     50 ▾        │
└───────────────────────────────────────────────┘
```

| Controle | Neste plano |
|---|---|
| `50 ▾` — tamanho de página | **funciona.** Troca o `LIMIT` do SQL da pré-visualização; nenhum canal muda |
| `1–50 de 8.412 linhas` | **verdadeiro.** `part.rowCount` já vem do anexo |
| `◀ ▶` | inertes — falta `OFFSET`, que é o plano da paginação |

⚠️ **O tamanho de página sai de uma lista fechada (25/50/100/200), nunca de entrada livre.** O SQL é montado por interpolação porque `read_csv_auto($1)` recusa parâmetro vinculado — é o mesmo motivo pelo qual o hash é validado por expressão regular antes (D18B.3), e a razão pela qual um número digitado não pode chegar ali. Ver skill [`data`](../../../.claude/skills/data/SKILL.md).

⚠️ **`ROADMAP § 2` precisa mudar no fechamento.** Ele hoje diz _"não entra"_ e _"o teto de 200 linhas é limite conhecido, não bug"_. Passa a **adiada, com o lugar visual reservado**, que é outra afirmação. É conservação tipo (a) — nome que mudou de sentido, não de grafia.

### DF3D.4 — Desabilitado, não ausente — e a DF3A.7 é quem autoriza

A DF3A.7 diz _"ausente, não desabilitado"_ para o botão de copiar da imagem. A justificativa registrada dela é: **"um botão cinza promete uma capacidade que não vai voltar sozinha"**.

Aqui ela **vai** voltar, e está agendada. A razão da regra se inverte, então a regra decide o contrário: as setas ficam presentes e desabilitadas. Não é exceção à DF3A.7 — é a DF3A.7 aplicada a um caso em que a premissa dela é falsa.

### DF3D.5 — Número alinha à direita, com fonte tabular

Convenção universal de tabela de dados, e a mais barata: coluna numérica à direita com `tabular-nums` é o que permite comparar magnitude de relance. Hoje toda célula é `text-left`. O tipo já existe — vem do `type` do `ColumnProfile`.

⚠️ **Isso toca a bolha também.** `DatasetTable` tem três chamadores; `StepProposalCard` herda a mudança sem que este plano o edite. É efeito desejado, mas precisa estar escrito, ou vira surpresa no diff.

### DF3D.6 — `DatasetCard` encolhe, e mantém "Propor passos"

Perde as três tabelas (pré-visualização, consulta, perfil) e ganha **Abrir**, no formato que `DocumentCard` e `ImageCard` já tomaram no F-3-A.

**Mantém "Propor passos"** — não é vista do arquivo, é uma fala dirigida ao modelo, e a resposta dela nasce como **mensagem** (`useStepProposal`), não como conteúdo do painel. Mover para o painel separaria o pedido da resposta.

### DF3D.7 — A aba Consulta ganha o que faz uma ferramenta de SQL parecer ferramenta

Cinco itens, todos de renderer, nenhum passando de ~10 linhas:

1. **`Ctrl+Enter` executa.** É o atalho da DuckDB Local UI, do DBeaver, do DataGrip. O botão fica, com a dica ao lado — o atalho é aceleração, não a única porta.
2. **O tempo da consulta na barra de status** (`312 linhas · 12 colunas · 41 ms`), medido com `performance.now()` em volta do `invoke`. Substitui as frases soltas de hoje, que têm formato próprio em cada componente.
3. **O resultado não pisca ao reexecutar:** a tabela anterior fica no lugar, a 60% de opacidade e sem eventos; o _spinner_ vive só no botão. Zero salto de layout.
4. **Erro não apaga o resultado anterior.** Hoje `setResult(null)` no erro — a pessoa perde exatamente o que estava comparando no momento em que errou o SQL. É defeito, não escolha.
5. **O editor cresce com o conteúdo** em vez de ser caixa fixa de 72px com alça `resize-y`. Duas alças de redimensionamento na mesma superfície (a do painel, do F-3-C, e a do textarea) brigam entre si.

**Realce de sintaxe fica fora.** CodeMirror 6 custa ~250–400 kB mesmo no _setup_ mínimo, e o truque `textarea` + `<pre>` sobreposto quebra em sincronia de cursor e IME. Gatilho registrado: o pilar **Código**, quando existir, é o segundo consumidor que justifica a dependência — critério de dependência da skill [`architecture`](../../../.claude/skills/architecture/SKILL.md).

### DF3D.8 — O SQL digitado e a aba escolhida morrem ao fechar o painel

Decisão explícita, para não virar defeito relatado depois. A largura subiu para o provider no F-3-C porque é preferência de sessão, uma só. O texto do SQL é trabalho em curso **por dataset** — subi-lo significa um mapa por hash, e ninguém pediu isso.

**Paridade com hoje:** recolher o cartão já descarta o SQL digitado. O plano não regride nada; só passa a dizer isso em voz alta.

### DF3D.9 — A aba Passos não entra, e o motivo não é tamanho

O objeto se parte em dois, e é isso que decide:

| | O que é | Onde |
|---|---|---|
| A **proposta** | uma mensagem: tem `messageId`, está persistida, o modelo a escreveu, e uma conversa pode ter várias | **transcrição** |
| O **pipeline aplicado** + resultado | uma propriedade do dataset: quais passos valem sobre este arquivo agora | **aba Passos**, no F-3-F |

A bolha é a decisão; o painel é o dado. Mas o "pipeline aplicado" não existe como estado — criá-lo é decidir onde mora (mensagem? conversa? SQLite?), e é a fronteira que o próprio `artifactContext.ts` já nomeia: _a chart or a result (plano 20) is born from a message, not from a file_.

O `tablist` deste plano já nasce podendo recebê-la, ao custo de zero linha.

### DF3D.10 — Dataset não ganha ⧉; documento mantém o dele

Decisão do usuário, corrigida durante a escrita: a ausência de cópia vale **só para dado tabular**. Documento continua copiando o texto extraído — é o único caminho de saída que ele tem, e copiar para a área de transferência não é escrever arquivo, que é o que o veto do escopo trata.

**Custo de código: zero.** `canCopy` já é `ref.kind === 'document'`; o membro novo cai no `false` sozinho. O arquivo não é tocado, e o cabeçalho do painel de um dataset simplesmente não desenha o botão — que é a DF3A.7 no caso em que a premissa dela é verdadeira (não vai voltar por si; vem por outro botão, noutro lugar).

O substituto para dado tabular é **exportar resultado**, na trilha E — que começa em breve —, e ele não herda a posição do que não existiu: nasce onde fizer sentido para cada superfície, não colado no ✕.

⚠️ **Uma distinção que o `ESCOPO.md` já sustenta, e que vale deixar escrita antes de alguém desenhar o botão:** o escopo veta exportar o **arquivo anexado** (_"um `.pdf` entra e não sai"_), e o motivo declarado é _"a trava não é o modelo, é escrita em caminho arbitrário escolhida por ele"_. Exportar um **resultado** não cai nesse veto: é objeto novo, e caminho e formato são escolha do usuário no `dialog.showSaveDialog` — o mesmo raciocínio que já admitiu exportar a resposta do modelo ([`ESCOPO.md`](../../ESCOPO.md)).

---

## Passos

### 1. O dataset vira artefato (DF3D.10)

`ArtifactRef` ganha `{ kind: 'dataset'; id; part }`; `toArtifactRef` para de devolver `null`; o `ArtifactPicker` ganha o terceiro ícone nos **dois** lugares. `copyArtifact.ts` **não é tocado**.

Nível 2: o clipe conta o CSV, o seletor o lista com ícone próprio, e o cabeçalho de um dataset não desenha o ⧉ enquanto o de um documento continua desenhando. **A suíte de `artifactsOf` é o contrato** — o caso que hoje afirma "dataset devolve null" inverte, e é a prova de que a DF3B.7 se cumpriu.

### 2. O `tablist`, as abas Dados e Perfil, e o rodapé (DF3D.1–DF3D.5)

O `tablist` local, a aba **Dados** servindo o que `DatasetPreview` já serve, a aba **Perfil** sem o _disclosure_ que o cartão tinha, o rodapé com tamanho de página funcional e navegação desabilitada, e o alinhamento numérico em `DatasetTable`.

Nível 2: setas navegam entre abas com volta, `Home`/`End`, `aria-selected` acompanha, só um `tabpanel` no DOM; trocar o tamanho de página refaz a consulta com o `LIMIT` novo; as setas estão presentes **e** desabilitadas.

### 3. A aba Consulta (DF3D.7, DF3D.8)

Os cinco itens. Nível 2 alcança quatro: `Ctrl+Enter` dispara, o erro não limpa a tabela anterior, a barra de status traz linhas e colunas, e o editor cresce. **O que jsdom não julga:** a opacidade durante a reexecução e o "não piscar" — nível 4 e olho.

### 4. O cartão encolhe (DF3D.6)

`DatasetCard` perde as três superfícies e ganha **Abrir**, mantendo "Propor passos". `DatasetProfile` (a versão com _disclosure_) é apagado.

Nível 2: a suíte do cartão passa de "expande a pré-visualização" para "chama `toggle` com o `ref` certo" — a mesma reescrita que `DocumentCard` e `ImageCard` sofreram no F-3-A.

⚠️ **A ordem 3↔4 é o inverso do que este plano escreveu primeiro.** Encolher o cartão antes de a aba Consulta existir deixaria um commit inteiro sem nenhuma superfície capaz de rodar SQL. O painel ganha tudo antes de a bolha perder qualquer coisa.

### 5. Prova ao vivo

`pnpm dev` e o e2e. O que só a tela responde: as abas trocando sem salto de altura; a tabela larga rolando na horizontal **dentro** do painel sem empurrar a página; o rodapé fixo não cobrindo a última linha; a aba Consulta sendo usável nos 352px do piso — e se não for, isso é achado, não defeito a esconder.

---

## Verificação

- `pnpm check:fast` depois de cada passo.
- `e2e/dev/artifact-panel.spec.ts` ganha um **quarto caso**: anexa um CSV com `dialog.showOpenDialog` estubado no main, confirma que o clipe passou a contar, abre o painel, troca de aba e executa uma consulta. Invariantes, nunca pixel — a asserção em pixel do F-3-A mediu escala de DPI e falhou.
- Provocação obrigatória, **uma sabotagem por vez**. Os candidatos: devolver `null` de novo no `toArtifactRef` (o clipe tem de parar de contar), quebrar o `aria-selected`, deixar `setResult(null)` no erro.

---

## Fora do escopo deste plano

| | Onde vai |
|---|---|
| A aba **Passos**, o pipeline como estado, `Switch` por passo, o diff `8.412 → 1.240` | `F-3-F` |
| Copiar imagem, canal `image:bytes` | `F-3-E` |
| Paginação funcional — `OFFSET`, carregamento eficiente | plano próprio, agendado pelo usuário |
| Exportar resultado | trilha **E** |
| Realce de sintaxe no SQL | gatilho: o pilar Código |
| Virtualização da tabela | não entra — o teto de 200 linhas ainda é menor que o teto de DOM do `ESCOPO.md` |

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 1-5 | **plano concluído**, movido para `implemented/` | Cinco passos, cinco commits, na mesma sessão em que o plano nasceu. **Duas decisões mudaram na execução:** a ordem dos passos 3 e 4 (encolher o cartão antes de a aba Consulta existir deixaria um commit sem nenhuma superfície capaz de rodar SQL), e a DF3D.10, corrigida pelo usuário durante a escrita — o ⧉ sai só do dado tabular, custo de código zero. **Dois componentes ficaram órfãos e foram apagados** (`DatasetPreview`, `DatasetProfile`), com os ramos de erro e de arquivo vazio reescritos contra `ArtifactDataset` em vez de perdidos. `check:fast`: 898 testes, 102 arquivos; e2e do painel: 4 casos. |
| 27/08/2026 | — | plano escrito, ainda não executado | Escrito depois de um levantamento com Context7 + web pedido pelo usuário. A DuckDB Local UI deu a forma (três regiões viram pilha com abas num painel estreito); o Applied Steps do Power Query deu o modelo do F-3-F. Três decisões do usuário na conversa: o `tablist` (que absorveu o _post-18-C fix_ como propriedade), a **reabertura da paginação** — o `ROADMAP` a dava por encerrada — e a saída do ⧉. Dois achados no código mudaram o recorte: `buildFinalSql` já embrulha em `LIMIT`, então o tamanho de página não precisa de canal; e o `ArtifactPicker` escolhe ícone em dois lugares por um ternário de dois casos. |

**O que este plano deixou fora dele** — escalonado na conclusão, e é onde se consulta hoje:

| Achado | Dono |
|---|---|
| O `sticky` da tabela nunca grudou: `top-0` não gera CSS, terceira ocorrência da mesma armadilha | [`ARMADILHAS.md`](../../ARMADILHAS.md) (entrada do F-3-C, estendida) |
| A varredura de `<prop>-0` no renderer, com o comando e os dois sítios consertados | [`ROADMAP § 2`](../../ROADMAP.md) |
| `Tabs` é o primeiro caso **a favor** da régua do oitavo primitivo — aba nova não é chamador novo | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) |
| Alinhamento numérico em tabela de dados, e de onde sai "esta coluna é numérica" | [`reference.md`](../../../.claude/skills/design-system/reference.md) da skill |
| Decisões DF3D.1–DF3D.10 | [`DECISOES.md`](../../DECISOES.md) |

⚠️ **Pendente de conferência visual, e só o olho responde:** as abas trocando sem salto de altura; a tira e o rodapé ficando parados enquanto as linhas rolam (a fixture de e2e tem 10 linhas e não transborda, então isso não foi provado); a aba Consulta nos 352px do piso do painel; e os dois sítios que a varredura de `<prop>-0` consertou fora deste plano — o ícone de busca da lista de conversas e o botão de revelar chave em `CloudSecrets`, que passaram a receber CSS que antes não recebiam.
