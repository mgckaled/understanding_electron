# E-1-B — A região ganha um segundo inquilino: o painel de rascunho

> Segundo plano da trilha E, depois do [E-1-A](E-1-A-o-rascunho-existe.md). O rascunho já existe no banco, é criado pelo quarto ícone do turno e é contado no cabeçalho — mas não tem onde ser visto.

**Origem:** o usuário fixou a restrição na primeira rodada de esboço: *"os dois painéis podem sobreviver ao mesmo tempo desde que não ocupem o mesmo espaço em tela"*. A aritmética confirma a intuição — dois painéis no piso (352px cada), mais a sidebar (264px) e o piso da conversa (416px), somam **1384px**: cabe em 1920 e não cabe em 1366.

**Entrega:** o painel de rascunho, em prévia, alcançável pelo contador, pelo `Ctrl+D` e pela linha do turno; o seletor de rascunhos no cabeçalho dele; o rodapé com excluir; e a casca do painel extraída para `shared/ui/`, com o painel de artefato passando a usá-la sem mudar de comportamento.

---

## O que foi checado contra o código real antes de virar plano

| Afirmação plausível | O que existe de fato |
|---|---|
| Dois painéis são duas features com dois providers | ⚠️ **Seriam duas features com uma regra que nenhuma das duas é dona.** "Só um aberto por vez" morando em dois lugares é o padrão que o [`CLAUDE.md`](../../../CLAUDE.md#segurança) já condena — validação junto de um dos dois vira bypass no segundo. Com **um** alvo, a exclusão é estrutural (DE1B.1) |
| `Esc` dentro do diálogo de confirmação fecha só o diálogo | ⚠️ **Não. E o defeito já está em produção.** `cancel` e `close` do `<dialog>` não borbulham, mas o **`keydown` borbulha** — e o `<aside>` do painel escuta `Esc` (`ArtifactPanel.tsx`). Hoje, apagar uma proposta pelo teclado no `ArtifactSteps` fecha **o painel junto**. Precedente idêntico e conserto: [Gutenberg #76861](https://github.com/WordPress/gutenberg/pull/76861) |
| `Tabs` sobe para `shared/ui/` neste plano | ⚠️ **Não sobe.** O corte anunciado dizia que sim, e estava errado: neste plano o painel de rascunho é **prévia**, sem abas. O segundo chamador nasce no E-1-C, com a aba `Editar` — e a régua da skill `design-system` é o segundo chamador, não a previsão dele (DE1B.4) |
| Mover a casca do painel é refatoração interna | ⚠️ **Toca documento.** `ARMADILHAS.md` linha 282 tem link relativo para `features/artifact/ArtifactResizer.tsx`, e a skill `design-system` nomeia `ArtifactPanel` como o quarto componente em CSS Modules. Deriva do tipo (a): `grep` antes de commitar, não depois |
| O contador do rascunho já é um botão | **Não.** No E-1-A ele é indicador — não havia painel para abrir, e controle cinza promete o que não existe. Vira botão aqui |
| A largura do painel é uma só | **É uma só hoje**, e o E-1-A não mexeu nisso. Passa a ser uma por inquilino (DE1B.3) |
| `ArtifactResizer` sabe o que é um artefato | **Não sabe.** Recebe `panelId`, `width`, `apply`, `commit`, `close` — já é genérico, só está guardado no lugar errado |

---

## Decisões

### DE1B.1 — Um alvo aberto, duas seleções: a exclusão é estrutural

A região passa a ter dono próprio, em `features/panel/`:

```ts
type PanelKind = 'artifact' | 'draft'

showing: PanelKind | null   // quem está na tela — null é fechado
```

Cada feature continua dona da **própria seleção** — `ArtifactProvider` guarda qual artefato, `DraftProvider` guarda qual rascunho — e pede a região quando quer aparecer. Só um `showing` existe, então dois painéis desenhados ao mesmo tempo é um estado **inexpressável**, não uma regra a lembrar.

⚠️ **O que isto NÃO é:** não é fundir as duas features num provider só. Elas guardam coisas diferentes e mudam por motivos diferentes; o que compartilham é a faixa do grid, e é só ela que ganha dono.

**A quarta faixa no `AppShell` fica de fora, com gatilho registrado.** Desenhar os dois lado a lado é um modo responsivo — ponto de quebra, dois resizers, o que acontece ao redimensionar a janela com os dois abertos, quem recebe foco. Se na prática alternar virar incômodo numa tela larga, o segundo trilho passa a ser justificado por necessidade medida.

### DE1B.2 — A casca sai para `shared/ui/SidePanel/`; o corpo fica onde está

O que se move é comportamento sem domínio, e já está escrito: o `<aside>`, o fade do `@starting-style`, a montagem do resizer, o foco que entra ao abrir e o `Esc` que fecha só com foco dentro. `ArtifactResizer` e `artifactWidth.ts` viajam junto, renomeados (`PanelResizer`, `panelWidth.ts`).

O que **não** se move: `ArtifactPicker`, `ArtifactBody`, `artifactsOf`, `copyArtifact`, `ArtifactDataset`, `ArtifactSteps`, `Tabs`. `features/artifact/` continua existindo com o nome que tem — renomear a pasta seria deriva espalhada por skills e documentos, paga por nada.

`SidePanel` recebe `header` e `children` por slot, e um `label`. Não conhece artefato nem rascunho.

### DE1B.3 — Cada inquilino guarda a própria largura

`width` vira `Record<PanelKind, number>`, e o resizer escreve na do inquilino visível.

Uma largura compartilhada evitaria o salto ao trocar, mas trocaria conteúdo inteiro mantendo uma medida escolhida para o outro: tabela quer largo, prosa não. O salto aqui **diz** que a coisa é outra, em vez de ser ruído.

### DE1B.4 — `Tabs` não sobe neste plano

O corte anunciado ao usuário colocava a promoção aqui. Está corrigido: sem a aba `Editar` — que é do E-1-C — o `Tabs` continua com **um** chamador, e promovê-lo seria prever o segundo em vez de esperá-lo. É a mesma régua que apagou `Panel` e `Toolbar` no DS-8.

### DE1B.5 — `Ctrl+D` no mesmo ouvinte do `Ctrl+B`

`Ctrl+B` permanece como está — já é memória muscular para anexos, e remapeá-lo seria custo puro. O rascunho ganha `Ctrl+D`; `Ctrl+R` está fora por ser recarregar no Chromium.

⚠️ **Um ouvinte só, nunca dois.** Dois `window.addEventListener('keydown')` disputando `preventDefault` é defeito na certa. O ouvinte sobe para `features/panel/` junto com a região, e continua ignorando as teclas enquanto o foco está num campo de texto.

### DE1B.6 — O `Esc` do `Dialog` para de vazar, e o conserto é no primitivo

O `keydown` de `Esc` borbulha, mesmo com o `<dialog>` na camada superior. Hoje, confirmar exclusão de proposta pelo teclado fecha o painel de artefato junto — defeito real, presente desde o F-3-F, que ninguém viu porque o mouse é o caminho comum.

O conserto é `stopPropagation` no `Dialog`, não uma defesa em cada painel: todo chamador ganha, e o próximo painel não precisa saber que a armadilha existe.

⚠️ **É testável no nível 2 apesar do jsdom não implementar `<dialog>`** — o que se testa é propagação, que é DOM puro: um `keydown` disparado dentro do diálogo não pode alcançar o `onKeyDown` do painel. Escrever esse teste **antes** do conserto, para vê-lo vermelho contra o código de hoje.

### DE1B.7 — Apagar o rascunho aberto cai para o mais recente que sobrou

Três respostas possíveis, e duas mentem:

| | |
|---|---|
| Painel fecha sempre | Apagar o segundo de cinco tira da tela quatro que continuam existindo |
| Painel fica com o rascunho apagado | Mostra o que não existe mais |
| **Cai para o mais recente restante, fecha se não sobrar** | ✅ |

É a mesma regra que o `togglePanel` já aplica ao escolher "o mais recente" quando nada está aberto.

### DE1B.8 — O contador vira botão, e continua nunca somado ao clipe

`DraftCount` passa a abrir e fechar o painel de rascunho, com `aria-pressed` — é alternador, não navegação; o `aria-current` de um cartão afirma outra coisa ("sou o que está na tela"). Some quando não há rascunho, como o clipe já some quando não há anexo.

Com os dois presentes, o cabeçalho mostra **dois números que respondem perguntas diferentes**: anexo veio do usuário, rascunho veio da conversa.

---

## Passos

### Passo 1 — `SidePanel` nasce, e o painel de artefato passa a usá-lo

Refatoração pura: `shared/ui/SidePanel/` com `SidePanel.tsx`, `SidePanel.module.css`, `PanelResizer.tsx` e `panelWidth.ts`. `ArtifactPanel` encolhe para cabeçalho + corpo.

**Teste:** nenhum novo. Os testes de `ArtifactPanel`, `ArtifactResizer` e `artifact.test.tsx` passam sem edição de asserção — é o que prova que a extração não mudou comportamento. Os arquivos de teste do resizer acompanham a mudança de nome.

⚠️ **Conservação, no mesmo commit:** o link de `ARMADILHAS.md` para `ArtifactResizer.tsx` e a linha de CSS Modules da skill `design-system`. O hook do `guard` recusa link relativo quebrado — deixe-o provar.

### Passo 2 — A região ganha dono

`features/panel/panelContext.ts` e `PanelProvider`: `showing`, `closing`, larguras por inquilino, `open`/`toggle`/`close`, e o ouvinte de teclado. `ArtifactProvider` para de guardar `closing`/`width` e passa a pedir a região.

**Teste:** nível 2 — abrir o artefato marca a região como dele; fechar limpa; trocar de conversa fecha sem fade (regra que já existe e não pode se perder na mudança).

### Passo 3 — O painel de rascunho, em prévia

`features/draft/DraftProvider` (qual rascunho) e `DraftPanel` (cabeçalho com o nome, corpo em `MarkdownMessage` sob a densidade de leitura).

**Teste:** nível 2 — abre com o conteúdo do rascunho; com o painel de artefato aberto, abrir o rascunho **substitui**, e nunca existem dois `<aside>`.

### Passo 4 — Como se chega nele

`DraftCount` vira botão; `DraftPicker` no cabeçalho, no molde do `ArtifactPicker` — inclusive a regra de que **um rascunho não é escolha, é título**; `Ctrl+D`.

**Teste:** nível 2 — o contador abre e fecha; o seletor troca sem fechar (o erro que a DF3B.5 já corrigiu uma vez); `Ctrl+D` abre e é ignorado enquanto se digita.

### Passo 5 — Excluir, e o `Esc` que vazava

Rodapé nascendo com um ocupante: `Trash2` fantasma em `text-danger-text`, à esquerda, abrindo o `Dialog` com `Cancelar`/`Excluir`. O `Dialog` ganha `stopPropagation` no `Esc`.

**Teste:** nível 2 — apagar tira o rascunho da lista e cai para o mais recente restante; apagar o último fecha o painel; o quarto ícone daquele turno volta a oferecer "Enviar para rascunho" (o ciclo que o E-1-A deixou sem chamador). Mais o teste de propagação da DE1B.6, escrito **antes** do conserto.

### Passo 6 — Prova ao vivo

1. Abrir o painel de rascunho pelo contador, e o painel de anexos pelo clipe — **um fecha quando o outro abre**, nunca os dois
2. Redimensionar cada um: a largura de cada inquilino sobrevive à troca
3. `Ctrl+D` abre e fecha; `Ctrl+B` continua indo para anexos; nenhum dos dois dispara enquanto se digita no composer
4. Com dois ou mais rascunhos, o seletor troca sem fechar; com um só, é título e não caixa
5. Apagar pelo teclado (`Esc` no diálogo) **não** fecha o painel junto — e o mesmo conferido no painel de artefato, onde o defeito já existia
6. Apagar o rascunho aberto cai para o outro; apagar o último fecha
7. O quarto ícone do turno volta a "Enviar para rascunho" depois da exclusão

---

## Fora deste plano

| Item | Onde vai |
|---|---|
| Editar: textarea não controlada, aba `Editar`, `Tabs` promovido, `draft:update` | **E-1-C** |
| `showSaveDialog`, escrita atômica, `EBUSY`, seletor de formato e `Exportar` no rodapé, `.md`/`.txt` | **E-1-D** |
| `.docx` · `.pdf` | **E-1-E** · **E-1-F** |
| A quarta faixa no grid (dois painéis desenhados juntos) | **gatilho no [`ROADMAP § 2`](../../ROADMAP.md)** — necessidade medida, nunca antecipada (DE1B.1) |
| Renomear `features/artifact/` | **não acontece** — deriva espalhada, paga por nada (DE1B.2) |

⚠️ **Um defeito de hoje é consertado de carona:** o `Esc` que fecha painel e diálogo juntos existe desde o F-3-F. Vale entrada em [`ARMADILHAS.md`](../../ARMADILHAS.md) na conclusão, porque a forma generaliza — **`keydown` borbulha mesmo da camada superior**, e todo container que escuta `Esc` acima de um `<dialog>` tem o mesmo problema.

---

## Diário de execução

✅ **Aceite observado pelo usuário em 27/08/2026.** As **sete** conferências do passo 6, todas certas — inclusive a que motivou o plano (um painel fecha quando o outro abre, nunca os dois) e a do defeito herdado (`Esc` no diálogo não fecha mais o painel junto, nos dois painéis). **Plano concluído** — segue para o **E-1-C**, que dá ao rascunho a aba `Editar`.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| 27/08/2026 | 1-5 | passos 1-5 concluídos; falta a prova ao vivo (passo 6) | **A extração do passo 1 se provou pelo negativo:** 70 testes de painel e resizer passaram sem uma asserção editada. **`release` não estava no plano e o teste o exigiu:** trocar de conversa esvazia a seleção, mas fechar com fade deixa a região marcada como nossa por 200ms, e o próximo `raise` pulava o `onOpen` — a sidebar não abriria espaço. Navegação não é fechamento. **O defeito do `Esc` confirmou-se vermelho contra o código de hoje** antes do conserto, e virou a 89ª entrada de [`ARMADILHAS.md`](../../ARMADILHAS.md). **Duas sabotagens**, uma por decisão: sem o fallback da DE1B.7 só o teste dela cai. **Dois defeitos do próprio teste:** `append` depois do render escreve no banco sem invalidar a consulta, e `findByRole` no singular estoura com dois botões iguais — os dois enganam porque falham como *timeout*, não como asserção. `pnpm build` verde; `--panel-width` com 3 ocorrências no bundle e `--artifact-width` com zero. `check:fast`: 952 testes, 108 arquivos. |
| 27/08/2026 | — | plano escrito, ainda não executado | **A pesquisa achou um defeito em produção antes de o plano existir:** `cancel` e `close` do `<dialog>` não borbulham, mas o `keydown` sim — então `Esc` no diálogo de excluir proposta fecha o painel de artefato junto, desde o F-3-F. Ninguém viu porque o mouse é o caminho comum. **Duas correções do corte anunciado:** `Tabs` não sobe aqui (sem a aba `Editar` continua com um chamador só, e prever o segundo é o que a régua proíbe), e a largura passa a ser uma por inquilino em vez de compartilhada. Conferido no código: `ArtifactResizer` já é genérico e só está guardado no lugar errado; mover a casca toca um link de `ARMADILHAS.md` e uma linha da skill `design-system`. |
