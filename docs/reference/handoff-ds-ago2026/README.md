# Handoff da ferramenta Claude Design — ago/2026

**12/08/2026.** O que voltou da ferramenta externa de design, depois de curado. O que foi **pedido** a ela está em [`../BRIEF-claude-design.md`](../BRIEF-claude-design.md); o que se **decidiu** a partir do que voltou está em [`../../HISTORY.md`](../../HISTORY.md) § *Tailwind v4 entra* e nos planos da [trilha DS](../../plan/active/README.md#a-trilha-de-design-system-ds-n).

## O que sobrou, e por quê

| Arquivo | Serve a |
|---|---|
| `prototipo-interacao.html` | **O único material original do pacote.** Protótipo navegável com as cinco extensões de interface propostas — abrir num navegador e usar o rodapé para percorrer Onboarding / Chat / Vazio / Erro / Config. Insumo do **DS-3** |
| `composer-e-configuracoes.png` | Captura do estado final: botão de pausa e envio no composer, threads em botões, campo de credencial com máscara |

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

Também aparecem no protótipo, mas **têm outro dono**: credenciais de nuvem (Gemini/GLM) são a fatia 3 do [plano 09](../../plan/active/09-camada-de-ia.md), e busca de conversas é o gatilho FTS5 do [`ROADMAP § 2`](../../ROADMAP.md).
