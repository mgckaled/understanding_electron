# E-1-D — O caminho de saída: o rascunho vira arquivo no disco

> Quarto plano da trilha E, depois do [E-1-A](../implemented/E-1-A-o-rascunho-existe.md), [E-1-B](../implemented/E-1-B-a-regiao-ganha-um-segundo-inquilino.md) e [E-1-C](../implemented/E-1-C-o-rascunho-se-edita.md). O rascunho existe, tem painel e se edita — este é o plano que finalmente **tira arquivo do app**.

**Origem:** o `ROADMAP` sempre chamou E-1 de "motor de exportação", e até aqui nada exportou. Metade do trabalho não é sobre formato nenhum: é o caminho de saída, que **não existe** — o app só sabe ler arquivo.

**Entrega:** o canal `export:save` (38º), o diálogo nativo de salvar, escrita atômica com repetição, o erro de arquivo em uso com mensagem acionável, o saneamento de nome do Windows, e o rodapé completo com **`.md`/`.txt` de ponta a ponta**.

---

## O que foi checado antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| Escrita atômica é temporário + `rename`, como o `ESCOPO` prescreve | ⚠️ **A prescrição é uma suposição POSIX, e o app roda no Windows.** Ali `fs.rename` vira `MoveFileEx`, que **honra os modos de compartilhamento** e falha com `EPERM`/`EACCES`/`EBUSY` quando o destino está travado — inclusive por lock **transitório** do Defender ou do indexador. A garantia que sobra ainda vale (o destino fica intacto), mas **exige repetição e mapeamento**, não é de graça |
| Arquivo em uso já teria mensagem própria | ⚠️ **Tem a mensagem errada.** O Windows devolve `EPERM` para rename travado, e `mapFsError` já mapeia `EPERM` → `permission` → *"Sem permissão para acessar este arquivo."* O `ESCOPO` pede o oposto: *"feche o arquivo no Excel"*. **O Windows confunde trava com permissão, e o mapeamento chuta errado** |
| O temporário pode ir para `os.tmpdir()` | **Não.** Renomear entre volumes falha com `EXDEV` — o temporário nasce **ao lado do destino** |
| O diálogo lembra a última pasta usada | ⚠️ **Não mais.** O Electron passou a fixar **Downloads** como diretório inicial, e o SO deixou de restaurar a última pasta. Para recuperar, guarda-se e passa-se `defaultPath`. ⚠️ **Os três `showOpenDialog` que já existem sofrem disso hoje** — fora deste plano, registrado |
| O título do rascunho serve como nome de arquivo | ⚠️ **Não serve cru.** Ele vem de texto livre do modelo, e o Windows recusa 9 caracteres (`< > : " / \ \| ? *`), os de controle 1–31, **nomes reservados** (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) **inclusive com extensão**, e ponto ou espaço no fim |
| Vários filtros no diálogo dão escolha ao usuário | **Dariam duas escolhas para a mesma coisa.** O formato já foi escolhido no rodapé; o Electron usa o **primeiro** filtro como padrão e há problemas conhecidos de extensão com `defaultPath` + vários filtros. **Um** filtro contorna por construção |
| `.txt` é o mesmo texto do `.md` | **Não, por decisão do dono do escopo:** *"no `.txt` a sintaxe de highlight não é necessária e incluir perde o sentido de ser `.txt`"*. Precisa de `strip-markdown`, que **preserva parágrafos** — `mdast-util-to-string` achataria tudo num bloco |
| A confirmação precisa de um Toast | **Precisa de dois sinais, e quase nada disso é primitivo** — ver DE1D.7 |

---

## Decisões

### DE1D.1 — Um canal só, do diálogo à gravação

`export:save({ text, format, suggestedName })` → `Result<{ path } | null>`; `null` é cancelamento, no molde do `pickDataset`.

Separar em "escolher caminho" e "escrever" abriria uma janela em que o caminho envelhece entre as duas chamadas. E **retorna `Result` de verdade**, ao contrário de todo o bloco `draft:*`: aqui há falhas que a interface precisa distinguir e desenhar — arquivo em uso, sem permissão, disco cheio.

O `format` decide o emissor **dentro** do handler, então E-1-E e E-1-F acrescentam formatos **sem canal novo**.

### DE1D.2 — A escrita atômica ganha repetição, porque no Windows ela não é atômica

`core/export/write.ts`, puro o bastante para nível 1 contra um diretório temporário real:

1. Grava em `<destino>.<aleatório>.tmp`, **no mesmo diretório** — `EXDEV` mata a travessia de volume
2. `rename` sobre o destino
3. Se falhar com `EPERM`/`EACCES`/`EBUSY`, **repete três vezes com espera crescente** (≈50/150/400 ms)
4. Se ainda falhar, **apaga o temporário** e devolve o erro

A repetição existe para a trava **transitória** (Defender, indexador), que é o caso que o `graceful-fs` inteiro existe para tratar. Para a trava **persistente** ela não resolve nada — e é por isso que o passo 4 importa.

⚠️ **O que a escrita atômica garante aqui não é o que o `ESCOPO` imagina.** Ela não torna o rename indivisível; torna o **destino intacto** quando algo falha no meio. Numa reexportação sobre um arquivo que já existe, é exatamente a garantia que se quer.

### DE1D.3 — `file-in-use` é um `kind` novo, e a razão é o Windows, não a novidade da falha

Um `kind` a mais no `AppError` força uma entrada em `messages.ts` por `pnpm typecheck` — cerimônia que se paga aqui porque **sem ela o app mente**: `EPERM` já é `permission`, e o usuário leria "sem permissão" para um arquivo que só está aberto no Word.

```
file-in-use → "Este arquivo está aberto em outro programa. Feche-o e tente de novo."
```

⚠️ **A distinção mora em `core/export/write.ts`, não em `mapFsError`.** Só ali se sabe que o `EPERM` veio de um **rename sobre destino existente** — em qualquer outro lugar `EPERM` continua sendo permissão de verdade, e generalizar isso quebraria os leitores de anexo.

### DE1D.4 — O nome sugerido é saneado em `core/`, e o teste é a tabela do Windows

`core/export/fileName.ts`, puro: troca os 9 proibidos e os de controle, corta ponto e espaço finais, **desvia dos nomes reservados** (com e sem extensão), corta o comprimento, e cai num rótulo padrão se sobrar vazio.

Fica em `core/` e não junto do handler porque E-1-E e E-1-F vão sugerir nome também — uma cópia ao lado de um dos três divergiria em silêncio, que é o mesmo argumento da DE1A.4 para o `draftTitle`.

### DE1D.5 — A última pasta é lembrada, e mora onde configuração de máquina já mora

`appSettingsSchema` ganha `lastExportDir` opcional. É propriedade **desta máquina** (D13.4), a tabela é chave-valor, e **não custa migração**.

O handler lê antes de abrir o diálogo e grava depois de escrever — o renderer não sabe que isso existe.

### DE1D.6 — `.txt` é markdown despido, e o remark chega aqui

`core/export/toPlainText.ts` com `remark` + `strip-markdown` — **duas** entradas, porque o `remark` já traz `unified`, `remark-parse` e `remark-stringify`.

`strip-markdown` foi escolhido contra `mdast-util-to-string` por uma diferença que decide: ele **preserva parágrafos**; o outro achata o documento inteiro numa linha.

**Efeito colateral bom:** o `remark-parse` que o E-1-E precisaria para o `.docx` chega neste plano. O **E-1-E fica com uma dependência só** (`docx`) em vez de três.

`.md` não tem emissor: é o próprio texto.

### DE1D.7 — A confirmação é uma linha `role="status"` no rodapé; o Toast vira **F-5**

O que o usuário precisa saber é **dois sinais**: deu certo, e onde foi parar. Disso, quase nada é primitivo — `role="status"` é uma linha de ARIA, e o caminho é texto com reticências e `title`.

O primitivo seria a camada superior, o posicionamento flutuante, a fila, o dispensar e o temporizador da WCAG 2.2.1. **Nada disso este plano sabe responder**, porque tem um caso só, e o mais fácil de todos: sucesso, uma linha, sem urgência.

Decidir fila e política de erro com um chamador seria chutar — a mesma armadilha que a DE1B.4 recusou para o `Tabs`. O **F-5** nasce com dois chamadores de verdade e **absorve** esta linha em vez de duplicá-la.

### DE1D.9 — O bundle do `main` ganha uma checagem, porque nenhum teste o alcança

Achado **ao vivo, pelo usuário**, depois de o plano estar escrito e os três passos verdes: o app morria ao carregar com *"Expected usable value but received an empty preset"*.

O bundle do `main` é CJS com dependências externalizadas, e rollup emite `require("pacote")` usando o resultado **direto** como export padrão. Para um pacote **ESM-only**, o `require(esm)` do Node 24 devolve o *namespace* — `{ __esModule, default }` —, então o `strip-markdown` chegou como objeto em vez de função.

⚠️ **A verificação prévia existia e mentiu.** A sonda foi `require('strip-markdown')` seguida de `s.default ?? s`, que imprime `function` **por causa do `?? s`** — exatamente o defeito, mascarado pelo próprio contorno.

Conserto: `externalizeDepsPlugin({ exclude: ['remark', 'strip-markdown'] })` no bloco `main`, embutindo em vez de externalizar. Vale para a família `remark` inteira, que é ESM-only — e paga de novo no E-1-E.

Garantia contra a volta: `scripts/check-main-bundle.mjs` carrega o bundle com `electron` esbulhado, no fim do `pnpm build`. **Provado por sabotagem**: revertendo a exclusão, ele reproduz a mensagem exata que o usuário viu e o build recusa.

### DE1D.8 — O que se exporta é o documento do editor, não o gravado

O rodapé já tem o leitor do documento vivo (é o que a aba `Prévia` usa desde o E-1-C). Exportar lê dali, então **não há corrida** entre a gravação do `blur` e a exportação.

---

## O layout

```
┌──────────────────────────────────────────────────────────────┐
│  📝 Vendas do trimestre                    ▾               ✕ │
├──────────────────────────────────────────────────────────────┤
│  Editar │ Prévia                                             │
├──────────────────────────────────────────────────────────────┤
│                     (editor CodeMirror)                      │
├──────────────────────────────────────────────────────────────┤
│ [.md ▾] [⬇ Exportar]   ✓ …\Documentos\Vendas.md   [🗑 Apagar rascunho] │
└──────────────────────────────────────────────────────────────┘
```

Três acréscimos, todos com padrão já estabelecido:

| | O que é | Padrão que herda |
|---|---|---|
| **Seletor de formato** | popover com 4 formatos, **2 habilitados** | `DraftPicker`; desabilitado-com-motivo é a DS5.7 |
| **`⬇ Exportar`** | primário, ícone + texto | `FileDown` — documento com seta para baixo |
| **`🗑 Apagar rascunho`** | perigo, ícone + texto, ponta oposta | o `Trash2` que já estava ali, agora rotulado |

⚠️ **`FileDown`, e os vizinhos foram descartados por motivo:** `Download` carrega conotação de internet; `FileOutput` tem seta para a direita e leria como "compartilhar", colidindo com o `Share2` já presente no `TurnActions`; e **`Save` seria mentira** — o rascunho já está salvo pelo `blur`, então um disquete prometeria algo que já aconteceu.

---

## Passos

### Passo 1 — `core/export/`: nome, texto plano e escrita

Três módulos puros, todos nível 1: `fileName.ts` (saneamento), `toPlainText.ts` (`remark` + `strip-markdown`) e `write.ts` (temporário ao lado, rename, repetição, limpeza).

**Teste:** a tabela do Windows inteira em `fileName` — proibidos, controle, reservados com e sem extensão, ponto e espaço finais, vazio. `toPlainText` com título, lista, ênfase, link e bloco de código, **provando que parágrafo sobrevive**. `write` contra um diretório temporário real: grava, sobrescreve, e **não deixa temporário para trás quando falha**.

⚠️ **A repetição precisa de teste próprio com `rename` injetado** — falhar duas vezes com `EPERM` e vencer na terceira. Sem injeção, o caso transitório não é reproduzível.

### Passo 2 — O canal `export:save` (38º) e o handler

Os seis lugares da skill `ipc`, **com `Result`** (DE1D.1). `AppError` ganha `file-in-use` e `messages.ts` a entrada correspondente — o `typecheck` cobra.

`main/features/export/handlers.ts`: recebe `showSaveDialog` e o banco por parâmetro, lê `lastExportDir`, monta **um** filtro, escreve, grava a pasta de volta.

**Teste:** nível 3 contra `:memory:` e um diretório temporário — cancelar devolve `ok(null)`; exportar devolve o caminho e grava o arquivo; a pasta é lembrada entre duas exportações; `.txt` sai despido e `.md` não.

### Passo 3 — O rodapé completo

Seletor de formato, `⬇ Exportar`, `🗑 Apagar rascunho` com texto, e a linha `role="status"`.

⚠️ **`DraftPanel` tem 140 linhas** e o rodapé é o próximo a crescer — nasce em arquivo próprio (`DraftFooter.tsx`), não empurrando o painel para o teto.

**Teste:** nível 2 — o seletor mostra quatro e habilita dois; exportar chama o canal com o **documento do editor**, não com o gravado; a linha de status aparece com o caminho; cancelar não mostra nada; o erro de arquivo em uso mostra a mensagem acionável.

### Passo 4 — Prova ao vivo

1. Exportar `.md` — o diálogo abre com o nome do rascunho já preenchido
2. Exportar de novo — **abre na pasta da vez anterior**, não em Downloads
3. `.txt` sai **sem** `#`, `**` e `-`, com os parágrafos separados
4. Um rascunho cujo título tenha `:` ou `/` — o nome sugerido sai limpo
5. Exportar por cima de um arquivo **aberto no Word** — mensagem "feche o arquivo", **não** "sem permissão"
6. Cancelar o diálogo não deixa nada na tela nem no disco
7. A linha de status mostra o caminho e some sozinha
8. Editar sem sair do campo e exportar direto — sai o texto **editado**

---

## Fora deste plano

| Item | Onde vai / por quê |
|---|---|
| `.docx` · `.pdf` | **E-1-E** · **E-1-F** — o seletor já os mostra desabilitados |
| **Toast** | **F-5**, registrado no `ROADMAP` com o esboço e as três perguntas que só dois chamadores respondem (DE1D.7) |
| Revelar o arquivo no explorador (`shell.showItemInFolder`) | fora — canal novo, e a linha de status já responde "onde" |
| A última pasta dos **três** `showOpenDialog` que já existem | fora — outro domínio; registrado no `ROADMAP` como achado |
| Confirmação de "o que muda" ao sobrescrever | **não se aplica** — o `ESCOPO` já diz que exportação é sempre arquivo novo, e o diálogo do Windows já confirma a substituição |

---

## Diário de execução

✅ **Aceite observado pelo usuário em 27/08/2026.** As oito conferências do passo 4, todas certas — inclusive as duas que motivaram decisões: `.txt` sai despido com parágrafos separados, e exportar por cima de um arquivo aberto no Word diz *"aberto em outro programa"* e não *"sem permissão"*. **Plano concluído** — segue para o **E-1-E** (`.docx`), que herda o `remark` já embutido e fica com uma dependência só.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 1-3 + DE1D.9 | três passos verdes; **um defeito de runtime achado pelo usuário e consertado** | O app não carregava: pacote ESM-only chega ao bundle CJS do main como `{ default }`. **Minha verificação prévia existia e mentiu** — a sonda tinha `s.default ?? s`, que mascara exatamente o defeito. Conserto no bundler (embutir em vez de externalizar), 91ª armadilha, e uma checagem do artefato ligada ao `pnpm build` que reproduz a mensagem exata quando sabotada. |
| 27/08/2026 | 1-3 | passos 1-3, antes do defeito acima | **Uma verificação antes de escrever poupou um defeito de runtime:** o `remark` é ESM-only e o bundle do main é CJS com dependências externalizadas — funciona porque o Node 24 do Electron 42 traz `require(esm)` ligado por padrão. Testado no terminal, não suposto; teria falhado no Node 20. **O teste achou uma corrida que o plano não previu:** o nome sugerido vinha de `current.title`, o título **gravado**, que continua o de antes da edição até o blur completar — passou a ser derivado do documento vivo, então texto e nome saem da mesma fonte. **Sabotagem:** sem a distinção `file-in-use`, só o teste dela cai. **Duas armadilhas de escrita de arquivo pelo heredoc**, ambas pegas pelo lint: a classe de caracteres proibidos saiu incluindo espaço e hífen, e as barras invertidas dos caminhos do Windows viraram escape inválido. `check:fast`: 997 testes, 110 arquivos. |
| 27/08/2026 | — | plano escrito, ainda não executado | **A pesquisa contradisse o próprio `ESCOPO`:** "escrita atômica = temporário + rename" é suposição POSIX, e no Windows `rename` vira `MoveFileEx`, que honra modos de compartilhamento e falha com `EPERM`/`EACCES`/`EBUSY` — daí a repetição e a limpeza do temporário. **E achou uma mensagem errada esperando para acontecer:** o Windows devolve `EPERM` para rename travado, que `mapFsError` já traduz como "sem permissão", quando o certo é "feche o arquivo em outro programa". **Três decisões do usuário moldaram o corte:** `.txt` despido (o que traz o `remark` para cá e barateia o E-1-E para uma dependência só), a ordem dos botões no rodapé com ícone + texto, e adiar o Toast — que ele mesmo propôs virar trilha, e que virou **F-5** depois de eu argumentar que um primitivo desenhado dentro de um plano de feature sai moldado por um chamador só. |
