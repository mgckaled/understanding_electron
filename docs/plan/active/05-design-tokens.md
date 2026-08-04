# 05 — Design tokens

**Depende de:** [01](../implemented/01-camadas-e-fronteiras.md) para a estrutura, [04](04-testes-rapidos.md) para o critério de aceite · **Entrega:** `tokens.css`, base de desktop, quatro primitivos, `StateView`

---

## Por que esta fase existe

O renderer hoje é a tela de boas-vindas do template: um logo, dois links e uma lista de versões, estilizados por `base.css` e `main.css` com valores escritos à mão.

Duas coisas justificam mexer nisso antes de existir interface de verdade.

**A primeira é que app de desktop não é site.** As diferenças não são estéticas — são estruturais, e cada uma que se descobre tarde é uma varredura por todos os componentes já escritos:

| | Web | Desktop |
|---|---|---|
| Corpo de texto | 16px | 13–14px |
| Altura de linha de tabela | 44–48px | 28–32px |
| Seleção de texto | ligada em tudo | desligada, exceto onde o dado é copiável |
| Rolagem elástica | esperada | denuncia que é web |
| Duração de animação | 200–300ms | 120–200ms |
| Barra de rolagem | do navegador | estilizada |

Densidade em particular é tudo ou nada. Decidir depois que a linha da tabela é 30px e não 48 significa revisar todo espaçamento, toda altura de controle e toda escala tipográfica junto.

**A segunda é que o app é sobre estados, não sobre telas.** Numa aplicação de análise, quase toda interação tem seis desfechos possíveis: ocioso, carregando, pronto, vazio, cancelado, erro. Se cada componente inventar a própria forma de mostrá-los, o resultado é seis variações do mesmo spinner e três textos diferentes para "arquivo não encontrado".

No projeto Python isso ficou resolvido pelos prefixos de log (`[i]`, `[~]`, `[✓]`, `[!]`) — uma escolha de vocabulário, não de componente. O equivalente estrutural aqui é uma união discriminada e **um** componente que a renderiza.

---

## Decisões tomadas

### D5.1 — Custom properties do CSS, sem Tailwind

Os tokens são variáveis CSS num arquivo global. Componentes usam CSS Modules, que o Vite já suporta sem configuração.

**Descartado nesta rodada:** Tailwind v4. O `@theme` dele resolve bem o problema de fonte única, mas é dependência que afeta o build num projeto que ainda está validando a própria fundação — e o [`CLAUDE.md`](../../../CLAUDE.md) é explícito sobre uma variável por vez.

A decisão é barata de reverter, e vale dizer por quê: como os tokens são custom properties, o Tailwind v4 pode ser adicionado depois **lendo o mesmo arquivo**, sem que nenhum token seja reescrito. O que se perde adiando é conveniência de escrita; não se perde estrutura.

**Descartado sem volta:** biblioteca de componentes (MUI, Chakra, shadcn). Trazem densidade e vocabulário de web, que é justamente a tabela acima invertida.

### D5.2 — Dois níveis de token, e componente só toca o segundo

```
--gray-900: #17181b;          /* primitivo — a cor existe */
--color-surface: var(--gray-900);  /* semântico — a cor significa algo */
```

Componente escreve `var(--color-surface)`. Nunca `var(--gray-900)`, nunca `#17181b`.

O motivo aparece na primeira mudança de tema: trocar o significado é editar a camada semântica em um lugar. Sem ela, é buscar `--gray-900` em quarenta arquivos e decidir, caso a caso, se aquela ocorrência era "fundo de painel" ou "borda escura" — informação que se perdeu no momento em que o primitivo foi usado direto.

### D5.3 — Tema pelo sistema operacional, sem alternador

O tema segue `prefers-color-scheme`. O Chromium já reflete a configuração do sistema, então a variação de tokens vive numa media query e mais nada é necessário.

Um alternador manual exige persistir a escolha, sincronizar `nativeTheme` no main e propagar por IPC. É trabalho real, e nada no app pede isso hoje. Como a estrutura de tokens não muda quando ele chegar, adiar não cobra juros.

### D5.4 — Seleção de texto desligada por padrão

`user-select: none` na raiz, e uma classe `.selectable` para o que é dado copiável — caminho de arquivo, célula de tabela, mensagem de erro.

Web faz o inverso e está certa: numa página, tudo é conteúdo. Num app, arrastar o mouse sobre um rótulo de botão e vê-lo ficar azul é o detalhe que faz o produto parecer um site dentro de uma janela.

### D5.5 — `ViewState` é vocabulário de interface, não do contrato

O tipo mora em `src/renderer/src/shared/ui/state.ts`, não em `src/shared/`.

A distinção vale a linha: `src/shared/` é o que atravessa a fronteira de processo — o main precisa concordar com ele. `ViewState` é como o renderer decide desenhar; o main não tem opinião. Colocá-lo em `shared/` seria acoplar o processo privilegiado a decisões de tela.

### D5.6 — O texto de erro fica num registro central

Um mapa de `AppError['kind']` para texto em português, num arquivo só. É a aplicação da D4 da [visão geral](00-visao-geral.md): erro é dado em inglês no contrato, e vira texto em português na borda da interface.

O `kind` desconhecido cai num texto genérico em vez de quebrar — a união vai crescer, e nem toda adição vai lembrar de passar por aqui.

---

## Passos

### Passo 1 — O arquivo de tokens

Crie `src/renderer/src/shared/ui/tokens.css`, importado uma vez em `main.tsx`. Quatro blocos.

**Primitivos** — escala neutra fria de 12 degraus, um acento, e três cores de estado (erro, alerta, sucesso). O acento é a única escolha de gosto do arquivo, e é um token: trocar é uma linha.

**Semânticos** — o vocabulário que os componentes usam:

```
--color-bg              fundo da janela
--color-surface         painel, card
--color-surface-raised  menu, popover, tooltip
--color-surface-sunken   área de log, editor
--color-border          borda padrão
--color-border-strong   divisor, foco
--color-text            texto principal
--color-text-muted      texto secundário
--color-text-faint      desabilitado, placeholder
--color-accent  --color-accent-hover  --color-on-accent
--color-danger  --color-warn  --color-ok
```

**Escalas**, calibradas para desktop:

| Escala | Valores |
|---|---|
| Espaço | 2 · 4 · 6 · 8 · 12 · 16 · 24 · 32 · 48 |
| Raio | 4 · 6 · 10 · 9999 |
| Tipo | 11 · 12 · 13 · 14 · 16 · 20 · 28 (corpo = **13**) |
| Altura de controle | 24 (compacto) · 28 (padrão) · 34 (grande) |
| Altura de linha de tabela | 28 |
| Movimento | 120ms · 200ms · 320ms |

**Fontes** — pilha do sistema para a UI (`Segoe UI Variable` primeiro, já que o alvo é Windows) e pilha monoespaçada para caminho e código.

O bloco de tema claro fica sob `@media (prefers-color-scheme: light)`, redefinindo **apenas** a camada semântica.

> ⚠️ Use o valor de `--color-bg` também no `backgroundColor` do `BrowserWindow` ([fase 03](03-sandbox-e-seguranca.md)). São dois mundos que não compartilham CSS, e é o único lugar do projeto onde uma cor aparece duas vezes. Deixe um comentário nos dois apontando para o outro.

**Aceite:** `pnpm dev` abre; alternar o tema do Windows entre claro e escuro muda a janela sem recarregar.
**Commit:** `feat(ds): tokens de cor, espaço, tipo e movimento`

### Passo 2 — A base de desktop

Substitua `base.css` e `main.css` por um `base.css` que estabeleça o comportamento de aplicativo:

- `box-sizing: border-box` universal
- corpo em `--font-size-body` com a pilha de UI, cor e fundo dos tokens
- `user-select: none` na raiz, `.selectable { user-select: text }`
- `overscroll-behavior: none` — sem rolagem elástica
- barra de rolagem estilizada com os tokens
- `:focus-visible` com anel visível de 2px; `:focus` sem anel — navegação por teclado importa mais em desktop do que na web, e o anel só deve aparecer quando o teclado foi usado
- `@media (prefers-reduced-motion: reduce)` zerando as durações

Apague os assets do template que deixaram de ser usados (`wavy-lines.svg`, `electron.svg`, se `App.tsx` não os referenciar mais).

**Aceite:** arrastar o mouse sobre um rótulo não seleciona; sobre um caminho de arquivo com `.selectable`, seleciona. `Tab` mostra o anel de foco; clique não mostra.
**Commit:** `feat(ds): base de comportamento de aplicativo desktop`

### Passo 3 — Quatro primitivos

Em `src/renderer/src/shared/ui/`, um diretório por componente, com `.module.css` ao lado:

| Componente | Responsabilidade |
|---|---|
| `Button` | variantes `primary` · `secondary` · `ghost` · `danger`; estados `disabled` e `loading`; três alturas |
| `Field` | rótulo + controle + texto de apoio + mensagem de erro, com `htmlFor` e `aria-describedby` ligados |
| `Panel` | superfície com borda e raio; opção de título e barra de ações |
| `Toolbar` | linha horizontal de ações, com espaçamento e alinhamento padronizados |

Regra única e sem exceção: **nenhum valor literal**. Sem `#hex`, sem `px` fora das escalas. Vale colocar isso como comentário no topo do `tokens.css`, porque é a regra que se rompe primeiro e em silêncio.

Reescreva `App.tsx` usando os primitivos, aposentando a tela do template. O `Versions` vira um `Panel`.

**Aceite:** `pnpm check:fast` verde (o teste de `Versions` da [fase 04](04-testes-rapidos.md) continua passando); nenhum literal de cor ou tamanho fora do `tokens.css`.
**Commit:** `feat(ds): primitivos Button, Field, Panel e Toolbar`

### Passo 4 — `ViewState` e o componente que o desenha

Em `src/renderer/src/shared/ui/state.ts`:

```ts
export type ViewState<T> =
  | { status: 'idle' }
  | { status: 'loading'; progress?: JobProgress }
  | { status: 'ready'; data: T }
  | { status: 'empty' }
  | { status: 'cancelled' }
  | { status: 'error'; error: AppError }
```

E `<StateView state={...} render={(data) => ...} />`, que cobre os cinco casos que não são `ready` e delega o `ready` ao `render`.

O caso `loading` mostra barra determinada quando `progress.total` não é nulo, e indeterminada quando é. A distinção existe porque o próprio contrato ([fase 02](02-contrato-ipc.md)) admite total desconhecido — contar linhas de um CSV grande não sabe o total antes de terminar.

Crie `messages.ts` com o mapa de `AppError['kind']` para texto em português, e um teste que percorre **todos** os `kind` da união e confirma que cada um tem texto. Assim, adicionar um `kind` sem mensagem quebra o teste em vez de aparecer como texto genérico em produção.

**Aceite:** teste de cobertura da união verde; os seis estados renderizam sem erro.
**Commit:** `feat(ds): ViewState, StateView e registro de mensagens de erro`

---

## Critério de aceite da fase

```bash
pnpm check:fast
```

E, à mão:

- Tela do template completamente substituída; nenhum asset dela sobrando.
- Alternar o tema do Windows muda o app sem recarregar.
- `grep` por `#` seguido de hexadecimal em `src/renderer/**/*.module.css` não encontra nada fora do `tokens.css`.

---

## O que fica para depois

- **Tailwind v4** — reversível a qualquer momento, lendo os mesmos tokens.
- **Alternador manual de tema** — precisa de `nativeTheme` e persistência.
- **Ícones** — nada precisa de ícone ainda. Quando precisar, um conjunto (Lucide) em vez de SVG solto.
- **Storybook** — mesma justificativa da [fase 04](04-testes-rapidos.md).
- **Janela sem moldura e `-webkit-app-region: drag`** — decisão de produto, não de fundação.

---

## Diário de execução

Uma linha por sessão de trabalho, preenchida **antes de encerrar a sessão**. Responde a "onde eu parei?" — não é o histórico do projeto.

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| — | — | não iniciada | — |

> **Escalonamento.** Se uma observação aqui virar decisão que vale além desta fase — armadilha nova, alternativa descartada, número medido — ela sobe **na mesma sessão** para [`docs/HISTORY.md`](../../HISTORY.md). Observação que fica só aqui morre quando a fase for arquivada.

---

**Anterior:** [04 — Testes rápidos](04-testes-rapidos.md) · **Índice:** [README](README.md) · **Próximo:** [06 — Primeira feature vertical](06-primeira-feature.md)
