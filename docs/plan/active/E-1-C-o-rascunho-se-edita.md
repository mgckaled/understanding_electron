# E-1-C — O rascunho se edita: a aba `Editar` e a pilha de desfazer que o React quebra

> Terceiro plano da trilha E, depois do [E-1-A](../implemented/E-1-A-o-rascunho-existe.md) e do [E-1-B](../implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md). O rascunho existe, tem painel, seletor e exclusão — falta a capacidade que o usuário nomeou como o diferencial do app.

**Origem:** a frase dele, ao aprovar o desenho: *"faço questão da funcionalidade editar por ser algo extremamente valioso... é isso que diferencia meu app das ferramentas de IA do mercado: eu defino o que é exportado e como é exportado, e não o modelo."* O `ESCOPO` já justifica a exportação dizendo que **duas** decisões são exclusivas do usuário — o caminho e o formato. Editar acrescenta a terceira: **o conteúdo**.

**Entrega:** as abas `Editar`/`Prévia` no painel de rascunho, o canal `draft:update` (37º), e `Tabs` promovido a `shared/ui/` — agora que o segundo chamador chegou.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| Basta uma `<textarea>` controlada por estado, como o composer | ⚠️ **Não.** No Chromium, atribuir `value` por JavaScript **zera a pilha de desfazer nativa** — o usuário desfaz uma letra por vez, ou nada ([React #8514](https://github.com/facebook/react/issues/8514), [#17494](https://github.com/react/react/issues/17494)). Num campo onde se edita prosa por minutos, isso é grave, e **jsdom não pega**: é a mesma classe das cinco armadilhas de ambiente da skill `testing` |
| `Tabs` só precisa mudar de pasta | ⚠️ **Precisa mudar de comportamento também.** Ele renderiza `current.render()` — **um** painel por vez. Desmontar a textarea para espiar a prévia destruiria a pilha de desfazer a cada olhada. Precisa de montagem persistente, e ela tem de ser **opt-in**: o dataset tem quatro abas, uma das quais consulta o motor (DE1C.4) |
| `Tab` dentro do editor deveria indentar, como num editor de código | ⚠️ **Não, e é falha de acessibilidade nomeada.** A WCAG 2.1.2 lista *"editores de texto rico que reaproveitam `Tab` para indentação sem oferecer uma saída"* como armadilha de teclado clássica; a regra é **não cancelar o evento de `Tab`** |
| Um botão de negrito depois seria trivial | **Não seria, e o motivo é o mesmo.** Qualquer inserção programática quebra a pilha de desfazer, exceto `document.execCommand('insertText')` — **depreciado e sem substituto** para este caso. Fora deste plano, registrado com o mecanismo |
| Editar exige o `UPDATE` que mensagem não tem | **Não exige nada novo.** Foi a DE1A.1 que pagou isto adiantado: rascunho é tabela própria, então `UPDATE drafts` é comum. Mensagem continua *append-only*, intacta |
| Gravar precisa de temporizador | **Não precisa, e os caminhos de saída foram verificados um a um** — ver DE1C.6 |

---

## Decisões

### DE1C.1 — A textarea é **não controlada**, e a razão não é estilo

`defaultValue` + `ref`, nunca `value`. O React só escreve no nó do DOM quando recebe a prop `value`; sem ela, deixa o campo em paz e o Chromium mantém a própria pilha de desfazer. `Ctrl+Z`, `Ctrl+Y` e a seleção funcionam como num editor de verdade.

É a única decisão deste plano que o usuário **não pode conferir por inspeção** e que **nenhum teste automatizado deste projeto alcança** — vai para a prova ao vivo, com passo escrito.

### DE1C.2 — Estado sombra: o React **lê** o campo, e nunca escreve de volta

Não controlada não significa invisível. `onChange` guarda o texto num estado que alimenta a prévia, o botão de gravar e (no E-1-D) a exportação — e esse estado **nunca volta como `value`**.

> A armadilha é **atribuir**, não **ler**. Um `onChange` que só observa é seguro; a linha que mata a pilha de desfazer é `value={texto}`.

⚠️ **Regra para quem tocar este arquivo depois:** se `value` aparecer na textarea, a DE1C.1 morreu em silêncio — nenhum teste vai reclamar.

### DE1C.3 — A prévia lê um valor adiado

Guardar cada tecla no estado re-renderiza o painel a cada tecla, e a prévia montada re-parseia o markdown junto. Nesta máquina (i5-8265U) isso aparece.

`useDeferredValue` é a resposta documentada do próprio React para exatamente esta forma — campo prioritário, consumidor caro atrás. A digitação continua na frente; a prévia alcança quando dá.

### DE1C.4 — `Tabs` sobe para `shared/ui/`, com montagem persistente **opt-in**

Chegou o segundo chamador, então a régua da skill `design-system` autoriza a subida — e o DE1B.4 recusou fazer isso um plano antes exatamente por ela.

Mas não sobe igual: ganha uma opção de manter os painéis montados, com o inativo escondido pelo atributo `hidden`. O padrão continua sendo **desmontar**, e o dataset **não** opta — quatro abas montadas ali significa a aba `Consulta` viva o tempo todo, e ela fala com o motor.

Só o rascunho opta, e por um motivo físico: desmontar a textarea apaga a pilha de desfazer.

### DE1C.5 — `Tab` continua saindo do campo

Sem indentação por `Tab`. A WCAG 2.1.2 nomeia esse reaproveitamento como armadilha de teclado, e a saída padrão (um segundo atalho para escapar) é pior que o problema num app de uma pessoa: acrescenta uma convenção a lembrar para resolver algo que markdown não pede — recuo de lista é `- ` no começo da linha, não indentação.

### DE1C.6 — Grava no `blur`, e não existe temporizador

Cada caminho de saída do editor foi conferido:

| Saída | O `blur` chega antes? |
|---|---|
| Trocar para a aba `Prévia` | sim — clique na aba |
| Fechar o painel (✕, contador, seletor) | sim — todos são clique |
| Trocar de conversa | sim — clique na sidebar |
| `Ctrl+D` com o cursor no campo | **não dispara**: o ouvinte do `panel` ignora as teclas enquanto o foco está num campo de texto (DE1B.5) |
| `Esc` com foco dentro | fecha o painel; **grava antes**, no mesmo manipulador |

Um temporizador escrevendo no SQLite enquanto alguém digita é outra classe de problema, e não cobre nada que o `blur` já não cubra.

### DE1C.7 — Editar retitula, e o título continua derivado

`draft:update` recebe `content`, `title` e `updatedAt`; o título sai do mesmo `draftTitle` de `core/` que o E-1-A escreveu — a DE1A.4 já dizia que ele mora ali **porque** este plano ia retitular. Identidade e tempo continuam nascendo no renderer (DE1A.6).

Efeito visível: mudar a primeira linha muda o rótulo no seletor.

### DE1C.8 — Sem indicador de "salvo", com gatilho registrado

Com gravação no `blur`, a janela em que há texto não gravado é mais curta do que o olho nota, e um selo permanente de "salvo" é mobília. Fica de fora.

⚠️ **É a decisão mais provável de se provar errada na prova ao vivo** — se editar der a sensação de que nada foi gravado, o conserto é um sinal discreto, não um botão de gravar.

---

## Passos

### Passo 1 — `Tabs` sobe, com montagem persistente opt-in

`shared/ui/Tabs/`, com a opção de manter os painéis montados e o inativo com `hidden`. `ArtifactDataset` passa a importar do novo lugar **sem** optar.

**Teste:** os testes existentes de `Tabs` acompanham a mudança de lugar sem asserção editada — mesma prova negativa do `SidePanel`. Um teste novo para a opção: com ela ligada, os dois painéis estão no DOM e o inativo é `hidden`; desligada, só o ativo existe.

⚠️ **Conservação:** `grep` por `features/artifact/Tabs` em `docs/` e `.claude/` antes de commitar. A skill `design-system` conta primitivos (**8** hoje) e a DF3D.2 registra o motivo de ele ter ficado fora — a linha passa a dizer que o segundo chamador chegou.

### Passo 2 — O canal `draft:update`

Os seis lugares da skill `ipc`. Sem `Result`, pela régua da DE1A.5. O handler é `UPDATE drafts SET content = ?, title = ?, updated_at = ? WHERE id = ?`.

**Teste:** nível 3 contra `:memory:` — grava e relê; `updated_at` muda e `created_at` não; um `update` para id inexistente não lança.

### Passo 3 — O editor

`DraftEditor`: textarea não controlada, estado sombra, prévia sobre valor adiado. As duas abas no painel, com montagem persistente.

**Teste:** nível 2 — digitar e trocar para `Prévia` mostra o markdown novo; voltar para `Editar` encontra o texto onde estava. ⚠️ **A pilha de desfazer não é testável aqui** — vai para o passo 5, com o motivo escrito no teste para ninguém achar que está coberta.

### Passo 4 — Gravar e retitular

`blur`, troca de aba e `Esc` gravam. O título é derivado na hora e o seletor acompanha.

**Teste:** nível 2 — editar e sair do campo grava; reabrir o painel traz o texto editado; mudar a primeira linha muda o rótulo no seletor. **Provar por sabotagem:** sem a gravação no `blur`, o teste de reabrir tem de cair sozinho.

### Passo 5 — Prova ao vivo

1. Editar um rascunho e apertar **`Ctrl+Z` várias vezes** — desfaz palavra a palavra, não letra a letra, e não para na primeira
2. `Ctrl+Y` refaz
3. `Tab` **sai** do campo, não indenta
4. Alternar `Editar`/`Prévia` várias vezes e desfazer de novo — a pilha sobreviveu à troca
5. Digitar rápido um texto longo: a digitação não engasga com a prévia montada atrás
6. Editar, fechar o painel, reabrir — o texto está lá
7. Mudar a primeira linha e abrir o seletor — o rótulo mudou
8. **A pergunta da DE1C.8:** editar deu a sensação de estar gravado, ou faltou sinal?

---

## Fora deste plano

| Item | Onde vai / por quê |
|---|---|
| `showSaveDialog`, escrita atômica, `EBUSY`, seletor de formato e `Exportar` no rodapé, `.md`/`.txt` | **E-1-D** |
| `.docx` · `.pdf` | **E-1-E** · **E-1-F** |
| Botões de formatação (negrito, lista, título) | **fora, com o mecanismo registrado:** toda inserção programática quebra a pilha de desfazer, exceto `document.execCommand('insertText')` — **depreciado e sem substituto** para este caso. Quem escrever isso um dia precisa saber que a API certa é a obsoleta |
| Indentação por `Tab` | **recusado** (DE1C.5), não adiado |
| Indicador de "salvo" | **gatilho na prova ao vivo** (DE1C.8) |
| Criar rascunho do zero, sem uma resposta de origem | fora da trilha: `sourceMessageId` é `NOT NULL` e o rascunho nasce de uma resposta (DE1A.2). Um rascunho em branco é outro objeto, e provavelmente outra pergunta de escopo |

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | — | plano escrito, ainda não executado | **A pesquisa decidiu quatro coisas.** (1) Textarea controlada perde a pilha de desfazer nativa no Chromium — por isso ela é não controlada, e é a única decisão do plano que nenhum teste deste projeto alcança. (2) `useDeferredValue` é a resposta documentada do React para campo prioritário + consumidor caro, o que dá forma à prévia montada. (3) A WCAG 2.1.2 nomeia `Tab`-para-indentar como armadilha de teclado, então a indentação é **recusada**, não adiada. (4) `execCommand('insertText')` é o único jeito de inserir preservando desfazer, e está depreciado sem substituto — o que mantém botões de formatação fora do plano com o motivo escrito. Conferido no código: `Tabs` renderiza só o painel ativo, então subir para `shared/ui/` exige também uma opção de montagem persistente — e o dataset **não** pode optar, porque uma das quatro abas fala com o motor. |
