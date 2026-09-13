# Context7 — o painel como ele ficou

Consulta rara, deliberadamente fora do [`SKILL.md`](SKILL.md). **É a interface entregue, não o alvo** — o mock que o arco desenhou antes do código vive no guia consumido, e diverge em vários pontos.

Primitivos, tokens e densidades: skill [`design-system`](../design-system/SKILL.md). Aqui fica o que é específico deste painel.

## Quatro telas, e qual aparece é derivado

O `docs` é o **terceiro inquilino** da região da direita, ao lado de `artifact` e `draft` — e o único que **compõe uma ação antes de existir objeto**: escolher biblioteca, desambiguar, fixar versão, formular a pergunta.

```text
compor ──[Consultar]──► candidatos ──[◉ + Consultar]──► resultado ──[Anexar]──► (transcrição)
                                                                                      │
                                                                releitura ◄───────────┘
```

| Tela | Quando aparece |
|---|---|
| **1 · compor** | o caso base — biblioteca, pergunta, `consulta ampla`, aviso de privacidade, cota e chave |
| **2 · candidatos** | a busca voltou `found` — rádios nativos, `<select>` de versão, `Voltar` |
| **3 · resultado** | a consulta voltou `ready` — abas Trechos/Notas/Regras, seleção, rodapé com custo |
| **4 · releitura** | uma consulta **já anexada** foi reaberta pela linha da transcrição ou pelo contador |

⚠️ **Nenhuma dessas telas é uma variável de fase.** Qual aparece é **derivado** do estado das duas chamadas (D23E.2, D23F.2): `found` é a única saída com lista para desambiguar, `ready` a única com abas para desenhar. Um terceiro valor a sincronizar é o que isto evita.

⚠️ **E a releitura vence a composição** (D23H.5): ela é o que o `⧉` da transcrição e o contador do cabeçalho endereçam. Ela é **componente próprio**, não um modo do resultado — aquele carrega seleção, congelamento e veredito de orçamento, e nenhum dos três existe depois que a escolha congelou.

## As duas vidas de uma consulta, e o congelamento

| Vida | O que se pode fazer |
|---|---|
| **Compondo** | tudo — trocar biblioteca, refazer, marcar e desmarcar |
| **Anexada** | só ler |

`Anexar` congela. O molde é a trava de janela de contexto (D15.13): mudar depois, em silêncio, é exatamente o que não pode acontecer — a tela divergiria do que o modelo viu.

⚠️ **O congelamento é estrutural, não disciplina de tela** (D23C.3): a parte persistida guarda o **enviado inteiro** e o recusado **só como título e custo**. Sem o código no banco, remarcar é *inexpressável*.

## A seleção guarda o que ficou de FORA

`useDocsSelection` mantém o conjunto das chaves **desmarcadas** (D23G.3). Conjunto vazio significa "tudo vai", que é o caso comum; o inverso exigiria semear todas as chaves a cada resposta nova.

`marcar todos` / `desmarcar todos` agem sobre **as chaves que recebem**, e é isso que torna "só a aba Trechos" expressável em vez de disciplina (D23J.8). Eles nascem do caminho amplo: a decisão de não ter marcar-todos (D23G.5) se apoiava em *"o caso medido é de 5 trechos"*, e 25 derruba a premissa — o outro argumento dela (o `indeterminate` do APG, que exige `ref`) nunca se aplicou a dois botões de texto.

## O rodapé é a peça principal

É onde o princípio do fluxo vira coisa visível: **não se modula o que vem, modula-se o que se faz com o que veio.** A etapa da rede não aceita `limit` nem `tokens`; o controle inteiro está entre o que chegou e o que é enviado.

`~588 tok` **não é estimativa por caractere** — a API conta cada trecho. É o **único lugar do app** onde o orçamento é exato antes de enviar.

⚠️ **Há uma conta só** (D23G.1): o `Composer` é dono único do `budgetFor` e devolve o `Budget` pronto ao painel. O rodapé e o medidor do modelo ficam na tela ao mesmo tempo, e dois `budgetFor` seriam livres para divergir. O token do Context7 entra pelo `flatTokens`, nunca somado a `draftChars` (D23G.2) — converter a contagem exata em caracteres jogaria fora a única medida exata do app.

Quatro textos, e o quarto não estava no desenho: `nada consultado` · `N de M · ~X tok · cabe (janela 32.768, 71% livre)` · `… · não cabe na janela de 32.768` · **`nada a anexar`**, para seleção vazia. A janela sai **por extenso**, nunca abreviada, como o `ContextControl` e o `ModelSelector` já escrevem.

## As onze situações, cada uma com o seu texto

Nenhuma delas entra em `shared/ui/messages.ts` (D23I.1), que é dono da tradução de `AppError['kind']` para o app inteiro: um `upstream` do Context7 e um do Ollama são o **mesmo `kind`**, e nove textos de painel ali apagariam a distinção. O mapeamento é função pura no renderer.

| # | Situação | Ação |
|---|---|---|
| 1 | campo vazio | nenhuma — `Consultar` desabilitado, a chamada nunca sai |
| 2 | nome sem correspondência (`404`) | volta ao campo, texto preservado |
| 3 | biblioteca achada, pergunta sem resposta (`200` vazio) | `Consultar de novo` |
| 4 | biblioteca em indexação (`202`) | `Tentar de novo` · outro candidato |
| 5 | cota estourada **sem** chave (`429`) | frase que nomeia Configurações |
| 6 | cota estourada **com** chave (`429`) | — |
| 7 | chave recusada (`401`/`403`) | frase que nomeia Configurações |
| 8 | serviço com problema (`5xx`) | `Tentar de novo` |
| 9 | sem alcançar o serviço (`TypeError`) | `Tentar de novo` |
| 10 | biblioteca sumiu entre as duas chamadas | `Voltar` — não há o que consultar |
| 11 | **teto de 30 s atingido** | `Tentar de novo` |

⚠️ **A ação não vira um segundo botão** (D23I.4): o rodapé **já é** a linha de ações — `retry` troca o rótulo do primário e `back` o **remove**. E *"abre Configurações"* virou **frase**, não botão: `Settings` é autocontido em duas instâncias do `App.tsx`, e um comando global seria peça de casca nascendo dentro de um corte de feature.

⚠️ **O componente é `role="status"`, nunca `role="alert"`** — tudo que ele desenha responde a um botão que a pessoa acabou de apertar, e isso **preserva** a asserção de que um *miss* não é falha.

⚠️ **Só o 429 reaproveita `describeUpstreamError`** (D23I.3). As dicas de 401/403 de lá falam de chave de **modelo** e são *provider-agnostic* por desenho; o painel escreve o próprio texto para elas.

## O gatilho, o contador e a linha na transcrição

- **O gatilho é item da lista de anexos**, não interruptor: consultar documentação é ato pontual cujo resultado persiste, não *modo* do envio (DM-15/DM-29). ⚠️ **`Documentação` nunca trava com anexo pendente** (D23D.3), ao contrário dos três de arquivo — consulta não disputa o slot único do composer, e travá-la esconderia o item justamente no caso de anexar dados e perguntar sobre a biblioteca que os lê.
- **O contador do cabeçalho é o terceiro, nunca somado** aos outros dois: três procedências, três perguntas, três números. Ausente quando é zero, e conta **todas** — desligada continua sendo consulta da conversa.
- **A linha na transcrição** é divulgação retrátil no molde do raciocínio, fechada por padrão. O corpo lista **títulos e custo, nunca o código** — o conteúdo é do painel. ⚠️ **Os descartados aparecem como contagem, nunca como lista** (D23J.11): listá-los estava certo a cinco trechos com um fora, e vira dezoito linhas riscadas enterrando sete no caminho amplo.
- **O interruptor está em DOIS lugares** — a linha e o histórico (D23H.1) — e isso não cria sincronia: nenhum dos dois guarda estado, ambos chamam a mesma mutação e leem o mesmo `enabled` persistido.
- ⚠️ **O retrátil e o `⧉` são IRMÃOS, nunca aninhados.** Botão dentro de botão é HTML inválido e o React não avisa.
- **O `+` do cabeçalho do painel não existe** (D23J.1), e é decisão: o item do popover já inicia uma composição e o `histórico` já responde *"onde estou"*.

## Duas densidades, e os dois elementos que a execução acrescentou

DM-28 fixou metadado em **chrome** e conteúdo em **leitura**. A tabela original esqueceu dois, e os dois são markdown de terceiro:

| Elemento | Densidade | Observação |
|---|---|---|
| nome da biblioteca, contagens, abas, rodapé, **título do trecho** | chrome | ⚠️ o título **é markdown** — vai pelo `MarkdownMessage` na forma `inline` |
| **descrição do trecho**, texto das Notas | leitura | ⚠️ também markdown, achado na verificação ao vivo do 23-F |
| o código dos trechos | leitura, monoespaçada | colorido pelo mesmo tokenizer do rascunho (D23F.12) |
| texto das Regras | leitura, **texto puro de propósito** | é o registro do que o serviço tentou injetar |

⚠️ **A tentação a recusar é um partidor de acento grave.** Ele resolve o que se vê e cria um segundo dono do markdown no app.

## Controles nativos, e por quê

`<input type="radio">` para os candidatos (o Chromium implementa o padrão *Radio Group* do APG inteiro — setas movem **e** marcam, com volta) e `<select>` para a versão, **divergindo do DS-4 passo 7** que trocara um `<select>` por popover: lá as linhas são ricas, aqui a opção é **uma string** (D23E.7). `base.css` declara `color-scheme`, então o popup sai no tema do app — confirmado ao vivo.

`<input type="checkbox">` para os trechos e para `consulta ampla`: a APG reserva o *switch* para o que age na hora, e estes são itens de uma lista de opções / escolha pendente de submissão (DF3F.8, D23J.7).

⚠️ **Seleção de linha rica: componha a classe por estado, não por `has-checked:`** — nenhuma variante `has-*` foi construída neste projeto, e só o CSS construído prova que a classe existe.

## O que os testes de nível 2 NÃO provam aqui

- Cor e layout — a **classe** é atribuída normalmente sob jsdom, inclusive as `.tok-*` do destaque de sintaxe; a cor, não.
- Conteúdo de `Popover`: a folha default do jsdom traz `[popover]:not(:popover-open) { display:none }`, então `getByRole` precisa de `{ hidden: true }` — e `getByText` **não aceita** essa opção, o que a torna inerte em silêncio.
- Preservação de estado ao fechar: **`DocsPanel` retorna `null` e nunca desmonta**, então um teste de "sobrevive a fechar" nasce vacuoso.

Detalhe de cada uma: skill [`testing`](../testing/SKILL.md).
