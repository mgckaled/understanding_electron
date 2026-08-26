# Handoff da ferramenta Claude Design — ago/2026

**12/08/2026.** O que voltou da ferramenta externa de design, depois de curado. O que foi **pedido** a ela está em [`../BRIEF-claude-design.md`](../BRIEF-claude-design.md); o que se **decidiu** a partir do que voltou está em [`../../HISTORY.md`](../../HISTORY.md) § *Tailwind v4 entra* e nos planos da [trilha DS](../../plan/active/README.md#a-trilha-de-design-system-ds-n).

> ⚠️ **Status revisto em 12/08/2026, a pedido, e a revisão é o que este documento tem de mais importante.** O que voltou **não é insumo de onde se garimpam ideias — é o alvo visual da trilha DS**, e o aceite dela é chegar o mais perto possível. A curadoria abaixo continua valendo para o que foi descartado (cópia de token, componente em CSS-in-JS, ícone do template); o que muda é o peso do que **sobrou**. Consequência imediata: o que este README mandava embora por "ter outro dono" precisa ser relido item a item — a busca de conversas do alvo é filtro de título no cliente, não a FTS5 do gatilho.

## O que sobrou, e por quê

| Arquivo | Serve a |
|---|---|
| `alvo-chat.png` | **O alvo.** A tela de conversa como precisa ficar ao fim da trilha DS. Tudo abaixo se mede contra ela |
| `alvo/*.png` | **Os seis estados**, resgatados do descarte em 12/08/2026 — ver abaixo |
| `prototipo-interacao.html` | **O único material original do pacote.** Protótipo navegável dos cinco estados — abrir num navegador e usar o rodapé para percorrer Onboarding / Chat / Vazio / Erro / Config. O rodapé é do protótipo, **não** é elemento do app |
| `composer-e-configuracoes.png` | Captura do estado final: botão de pausa e envio no composer, threads em botões, campo de credencial com máscara |

### ⚠️ A curadoria de 12/08/2026 descartou cinco dos seis alvos

Registrado porque é um erro de **método**, e ele se repete sozinho. A curadoria julgou cada arquivo com uma pergunta: *"este é código que manteríamos?"* — e a resposta era não para todos, com razão. Ninguém fez a segunda pergunta: *"este pacote mostra como o app deve ficar?"*. As `screenshots/` foram junto, e com elas a especificação visual de onboarding, estado vazio, estado de erro e do modal no tema claro. Resgatadas em `alvo/`.

**Forma da lição:** ao curar um pacote de terceiro, separe **artefato de implementação** de **artefato de especificação**. O primeiro se julga por "isto entra no repositório?"; o segundo por "isto diz o que construir?" — e um pacote de design é majoritariamente o segundo, ainda que pareça o primeiro por ser feito de `.jsx` e `.css`.

Duas coisas **continuam descartadas com razão**, e ficam nominalmente aqui para não voltarem por reflexo no próximo resgate:

- **`ui_kits/crivo/`** — o README dele diz *"recreation of the real conversational shell"*, e a lista de conteúdo confirma: painel de abrir arquivo, medidor de contexto, seletor de modelo no cabeçalho. Ele recria o app de **hoje**, não o alvo. Descartá-lo estava certo.
- **`guidelines/*.card.html`** — specimens derivados dos tokens (escala de tipo, de espaço, alturas de controle). Deriváveis, e o `tokens.contrast.test.ts` é guardião melhor.

⚠️ **Os nomes dos arquivos em `alvo/` não descrevem o conteúdo com precisão** — `01-onboarding.png` mostra o modal de Configurações no tema claro. Conferir a imagem, não o nome. E as recusas da seção abaixo **valem para as capturas também**: o alternador Claro/Escuro aparece em várias delas.

## O alvo é um envelope, e isso decide o que a trilha DS faz

⚠️ **Leia isto antes da tabela**, porque sem ele a tabela induz ao erro que já foi cometido uma vez: tratar o alvo como lista de features a construir.

O design system **envelopa**. A trilha DS não constrói feature nenhuma — ela deixa a linguagem visual definida. Daí a leitura correta do alvo, que tem duas metades:

| No alvo | Quem faz |
|---|---|
| **O que já existe no app** — sidebar, lista, composer, seletor de modelo, modal | **trilha DS.** Ganha a linguagem do alvo |
| **O que ainda não existe** — cartão de anexo, clipe, e o que vier | **o plano da própria feature.** Nasce depois, já vestido, porque o DS estará pronto |

É por isso que o alvo mostra coisas que a trilha DS não vai entregar: ele é o retrato de como o app fica **depois** que as features seguintes forem construídas sobre este DS. **O critério de aceite da trilha é a metade de cima da tabela.**

Duas consequências que dissolvem falsos impasses:

- O `"ABRIR ARQUIVO / Escolher arquivo"` da sidebar **não é pendência do DS-3**. Existe hoje, logo ganha o envelope; quem o remove é o [plano 16](../../plan/implemented/16-anexo-mecanismo-e-dataset.md), quando o clipe chegar. Não há ordem a decidir entre os dois.
- O cartão de anexo **não é pendência do DS-3**. É o exemplo de como o plano 16 vai sair.

## A distância até o alvo, item a item

Levantada em 12/08/2026 comparando `alvo-chat.png` com a tela real do app construído no mesmo dia. A coluna **Dono** aplica a régua acima.

| # | No alvo | Hoje | Dono |
|---|---|---|---|
| 1 | Cabeçalho da sidebar: título **"Chat local"** + ícone de recolher à direita | só o `«` solto | DS-3 |
| 2 | **"Nova conversa" contornado**, com `+`, largura cheia | preenchido, variante `secondary` | DS-3 |
| 3 | **Campo de busca** de conversas | não existe | **DS-3** (passo 5), como filtro de título no cliente — a lista de títulos já está em memória. **Não** é a FTS5 do [`ROADMAP § 2`](../../ROADMAP.md), que é busca no texto das mensagens e precisa de índice. (Corrigido: a revisão de 12/08 já mandava a busca para o DS-3; esta linha estava desalinhada dela) |
| 4 | Conversas **agrupadas por data** (Hoje / Ontem / Anteriores) | lista plana | DS-3 |
| 5 | Conversa ativa com **barra de acento à esquerda** | fundo elevado | DS-3 |
| 6 | Rodapé: **ponto verde + "Ollama (v0.32.6)" + engrenagem** | versões de Electron/Chromium/Node, e Configurações é botão na nav | DS-3 |
| 7 | Cabeçalho da conversa é **o título dela** | já é o título; `"Assistente local"` é só o fallback sem conversa (`ConversationView.tsx`) | DS-3 — item quase feito; só o texto de fallback a revisar |
| 8 | **Sem toolbar superior.** O seletor de modelo é uma pílula compacta **dentro do composer** | toolbar com modelo, contexto, "até 32k", selos e versão do Ollama | DS-3 — os elementos existem, o que muda é onde se acomodam. Nada do plano 15 deixa de existir |
| 9 | Composer é **um contêiner arredondado** com pílula de modelo + pausa + **envio circular com `↑`** | textarea, medidor e botão "Enviar" retangular | DS-3. O clipe do alvo é do plano 16 |
| 10 | Mensagem do usuário é **bolha à direita**; a do assistente é **texto puro à esquerda** | a conferir na migração | DS-3 |
| 11 | **Cartão de anexo** (`vendas_2024.csv · 1.240 linhas · SQL`) | não existe | **plano 16.** Está no alvo como exemplo do que o DS pronto produz, não como pendência da trilha |
| 12 | Escala de tipo visivelmente maior que os 13px de chrome | 13px | DS-3 — valor de token, não de camada |
| 13 | `"ABRIR ARQUIVO" / "Escolher arquivo"` **não existe** na sidebar | existe, desde a [fase 06](../../plan/implemented/06-primeira-feature.md) | ganha o envelope no DS-3; **sai no plano 16**, quando o clipe o substituir |

**Cores e tipografia não vêm daqui.** O protótipo foi construído sem o `tokens.css` real carregado, e mostra pelo menos um par que reprova AA (o botão "Claro" selecionado). A fonte de valor continua sendo `src/renderer/src/shared/ui/tokens.css`, com `tokens.contrast.test.ts` como guardião.

## O que foi descartado, e por quê

O pacote tinha ~50 arquivos. Sobraram dois.

- **`design-system/tokens/*.css`** — cópia fiel do `tokens.css`, conferida valor por valor. Manter seria criar um segundo lugar com os mesmos valores, que é a dívida que a regra de fonte única existe para evitar: *o segundo lugar envelhece calado*.
- **`design-system/tokens/base.css`** — a mesma cópia, **mais duas regras de link que não existem no repositório**. A segunda pinta `a:hover` com `--color-accent-hover`, um sólido de preenchimento usado como cor de texto: **2,44:1** sobre `--color-surface`, contra o mínimo de 4,5. É a classe de bug que a [fase 10](../../plan/implemented/10-cor-contraste-e-tema-claro.md) mediu e matou, reintroduzida por duas linhas.
- **`design-system/components/core/*`** (24 arquivos) — recriação dos primitivos em CSS-in-JS com `style={{}}` inline, o que o próprio brief proibia. Os reais, em TSX com CSS Modules, são melhores e já existem.
- **`design-system/ui_kits/`** e **`guidelines/`** — recriação da casca que já funciona, e specimens derivados dos tokens. O audit de contraste já é o guardião, e não envelhece.
- **`assets/app-icon.png`** — `cmp` diz **byte a byte idêntico** a `resources/icon.png`: é o ícone do template.
- **`assets/logo-monogram.svg`** — variação do `resources/logo-proposta-monograma-c.svg`, que já está no repositório desde 09/08/2026. Se a revisão for melhor, entra por decisão de marca, não por handoff.
- **`IMPLEMENTATION_PLAN.md`** — absorvido, com correções, nos planos DS-1/2/3.
- **A camada Tailwind** simplesmente **não veio**: nenhum `@theme`, nenhum `@utility`, nenhuma classe utilitária em componente algum. Era o pedido central do brief, e foi escrita aqui.

## ⚠️ Duas coisas no protótipo que foram recusadas

Quem abrir o `prototipo-interacao.html` vai vê-las e não deve implementá-las:

1. **O alternador manual Claro/Escuro** em Configurações. O tema segue o sistema operacional, sem alternador — decisão mantida em ago/2026, e o `@theme inline` faz o tema claro propagar sozinho.
2. **Threads de CPU em três botões (2/4/6)**. Esta máquina tem 8 threads (i5-8265U); a lista tornaria o máximo inalcançável. O controle contínuo fica.

Também aparecem no protótipo, mas **têm outro dono**: credenciais de nuvem (Gemini/GLM) são a fatia 3 do [plano 09](../../plan/active/09-camada-de-ia.md), e o cartão de anexo é o [plano 16](../../plan/implemented/16-anexo-mecanismo-e-dataset.md).

⚠️ **Uma terceira estava nesta lista e saiu, em 12/08/2026.** A busca de conversas foi mandada para o gatilho FTS5 do [`ROADMAP § 2`](../../ROADMAP.md), e isso confundia duas coisas: o gatilho é sobre **busca no texto das mensagens**, que precisa de índice; o alvo mostra um campo que filtra **títulos**, e a lista de títulos já está em memória. É filtro no cliente, entra no DS-3, e não toca o gatilho.
