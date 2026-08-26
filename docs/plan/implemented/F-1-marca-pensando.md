# F-1 — Marca "pensando": animação do monograma durante a resposta do modelo

> Primeiro da **trilha F (features avulsas, fora do arco)**, transversal como as trilhas DS e R — numeração própria, sem lugar na sequência 13–20. Mas nem DS (envelope; nunca constrói feature) nem R (refatoração; zero mudança de comportamento) cobrem este caso: F-1 **é** feature nova — reage a `isStreaming`, muda o que a tela faz — e **não** pertence ao arco de dados/IA. Um único plano por enquanto; a trilha existe para o próximo item desta forma não precisar inventar um terceiro prefixo.

**Origem:** `docs/plan/active/guia-animation-logo.html`, um guia de implementação gerado pela ferramenta externa "Claude design" (fora deste repositório), pedindo que o monograma de 14 pontos do crivo (o "C" vazado) fique sempre visível entre a thread e o composer, animando enquanto o modelo gera uma resposta.

**Entrega:** `ThinkingMark`/`useThinkingLoop` em `features/conversation/`, ligado a `ConversationView`; dois pontos novos em `tokens.css`/`tailwind.css`; nenhum canal IPC novo.

---

## O guia tinha referências erradas — o que foi conferido e corrigido

O guia foi escrito contra um estado do projeto que não é o atual. Cada afirmação abaixo foi checada contra o código real antes de virar código:

| O guia dizia | O que existe de fato |
|---|---|
| `assets/logo-monogram.svg`, "como hoje" no app | Não existe no renderer. As 14 coordenadas batem, círculo a círculo, com `resources/logo-proposta-monograma-c.svg` — uma folha de proposta de design, nunca importada pelo app. A marca **nunca esteve visível** no crivo antes deste plano; "como hoje" era falso |
| "CSS puro (via CSS Modules, como já é a convenção do projeto)" | Convenção real desde a [DS-1](DS-1-fundacao-tailwind.md) (ago/2026): Tailwind v4, `@theme inline` + `@utility` em [`assets/tailwind.css`](../../../src/renderer/src/assets/tailwind.css). `.module.css` só para o que nenhuma utilidade alcança (`::backdrop`, `@starting-style`) — não é o caso aqui. Ver armadilha no `HISTORY.md` |
| `motion.css` como arquivo próprio | Os tokens de motion (`--duration-*`) sempre viveram dentro de `shared/ui/tokens.css`, seção "Motion" — nunca houve arquivo separado |
| `isStreaming` como valor já exposto por `useConversationChat` | O hook não expõe isso. O sinal real, já computado em `ConversationView.tsx`, é `belongsHere && isLoading` (`state.status === 'loading'` e a resposta em voo pertence a esta conversa) |

O que o guia acertou e serviu como está: local do componente (`features/conversation/`), posição na tela (entre a thread e o composer), a técnica central (um `@keyframes` só, parametrizado por custom property por ponto), e as 14 coordenadas em si.

---

## Decisões

- **F1.1 — Um sorteio por turno, não por ciclo.** O guia pedia resortear `--dx`/`--dy`/`--pulse-scale`/`--dot-delay` a cada `animationiteration`. Como cada ponto tem seu próprio atraso, os 14 momentos de "fim de ciclo" **não coincidem** — resortear ao primeiro disparo mudaria o alvo de pontos ainda em voo, produzindo um salto visível. Sorteando uma vez por turno (ao `isStreaming` virar `true`) o efeito ainda lê como orgânico, porque raio/posição/opacidade já diferem por ponto — e a classe de bug acima nem existe. `mulberry32`/`hashCode` do guia saem: sem resorteio por ciclo, não há necessidade de determinismo por seed, `Math.random()` direto basta.
- **F1.2 — Parada por ponto, nunca por ciclo inteiro.** Mesma raiz: `animationiteration` borbulha dos 14 filhos, e um handler único pararia todos no primeiro disparo, congelando os outros 13 a meio caminho — exatamente o que o próprio guia listava como defeito a evitar. Cada ponto tem seu handler, e só se desativa quando **ele mesmo** dispara. Ver armadilha no `HISTORY.md` para a forma completa do problema, e a segunda armadilha (jsdom) que a verificação deste ponto revelou.
- **F1.3 — Sem `ref` para "parada pedida".** A primeira versão usava um `useRef` mutado dentro de um `if` no corpo do render (padrão "ajustar estado quando uma prop muda", de react.dev) — bloqueado pelo lint `react-hooks/refs` ("Cannot access refs during render"). Como o handler de cada ponto já lê `isStreaming` fresco via `useCallback([isStreaming])`, o `ref` era redundante: a prop **é** a informação.
- **F1.4 — Estado derivado durante o render, não em `useEffect`.** A primeira versão chamava `setVariance`/`setActiveIds` dentro de um `useEffect([isStreaming])` — bloqueado pelo lint novo `react-hooks/set-state-in-effect`. O padrão oficial (react.dev, "Adjusting state when a prop changes": comparar com o valor do render anterior guardado em `useState`, e ajustar no corpo da função) resolve sem efeito nenhum, um render a menos por troca de estado.
- **F1.5 — Custom properties por ponto declaradas em `tokens.css` com default inerte.** A guarda 7 do `guard.mjs` reprova `var(--x)` sem declaração correspondente em `tokens.css`, em qualquer `.module.css` ou em `assets/tailwind.css` — e não distingue token de design de parâmetro de instância. `--thinking-r`/`--thinking-rest-x`/`--thinking-dx`/etc. entram em `tokens.css` com valores sem significado próprio (0, 1, `0px`...), documentados como o contrato de instância do componente, não como token semântico — `ThinkingMark.tsx` sempre sobrescreve todos eles inline, por ponto.
- **F1.6 — Layout: marca à esquerda com "respondendo…" em itálico, não centralizada.** Ajuste pedido ao vivo depois da primeira verificação: o guia original centralizava a marca sozinha, sem rótulo. O texto só aparece com `isStreaming`, à direita da marca, no mesmo `flex`.
- **F1.7 — Trilha nova (F), nem DS nem R.** Ver blockquote no topo do arquivo.

---

## Onde plugou no código real

| Arquivo | O quê |
|---|---|
| `features/conversation/useThinkingLoop.ts` | Novo — as 14 coordenadas, a geração de variância, o hook |
| `features/conversation/ThinkingMark.tsx` | Novo — só o componente (exigido pelo `react-refresh/only-export-components`) |
| `features/conversation/ThinkingMark.test.tsx` | Novo — nível 2: marcação e troca de classe; a parada por ponto é provada chamando `onDotIteration` do hook diretamente (jsdom não entrega `animationiteration` — ver `HISTORY.md`) |
| `shared/ui/tokens.css` | `--duration-thinking-cycle` (seção Motion) + oito `--thinking-*` (contrato de instância, F1.5) |
| `assets/tailwind.css` | `@keyframes dotThinking`, `@utility thinking-dot`, `@utility animate-thinking-dot` — mesmo padrão do `animate-spinner` já existente |
| `features/conversation/ConversationView.tsx` | `<ThinkingMark isStreaming={belongsHere && isLoading} />` entre a thread e o `Composer` |

---

## QA — verificado ao vivo, não só `check:fast`

`check:fast` (typecheck + lint + test, 353 testes) prova estrutura, nunca a animação em si — jsdom não roda o motor de animação do CSS. Verificação real: `pnpm build` + Playwright dirigindo o build empacotado (`_electron.launch`), com o Ollama respondendo de verdade (`qwen2.5-coder:3b`), roteiro descartável (não commitado — mesmo raciocínio da [DS-4 § Fase 8](DS-4-acabamento-final.md), script de verificação não é teste permanente):

- [x] Em repouso, a marca forma o "C" — conferido nos dois temas.
- [x] Ao começar uma resposta, a dispersão já é visível em ~400ms (dois frames sucessivos mostram posições diferentes).
- [x] Ao terminar, a marca **não** volta instantaneamente — precisa de até um ciclo inteiro (2.400ms) mais o atraso do ponto mais lento (até 500ms). Com 300ms de espera a marca ainda estava dispersa (não é bug — é o desenho); com ~3.200ms, pixel-idêntica ao repouso.
- [x] Texto "respondendo…" aparece só durante o streaming, some ao terminar.
- [x] Tema claro e escuro: `--color-accent-text` com contraste correto nos dois (token já tinha linha em `tokens.contrast.test.ts`).

Não verificado ao vivo (fora do escopo deste plano): "Reduzir movimento" do SO — a regra global do `base.css` (`animation-iteration-count: 1`, `animation-duration: 0.01ms`) já cobre isto por construção, porque 0%/100% dos keyframes são idênticos ao repouso; o mecanismo é o mesmo que já protege `Dialog`/`Popover`, e nenhum código novo o toca.

---

## Diário de execução

| Data | Passo(s) | Estado | Observação |
|---|---|---|---|
| ago/2026 | todos | **concluído** | A marca "pensando" do chat. Um guia externo propôs animar o logo e foi a origem da trilha F — mas o guia citava uma convenção **já substituída** ("CSS Modules, como já é a convenção do projeto"), falsa desde a DS-1. |

**O que este plano deixou fora dele:**

| Achado | Dono |
|---|---|
| `animationiteration` borbulha de 14 filhos animados, e o jsdom não entrega o evento | [`ARMADILHAS.md`](../../ARMADILHAS.md) |
| Um guia de ferramenta externa citou convenção já substituída | [`ARMADILHAS.md`](../../ARMADILHAS.md) § Arquivadas |
| Os canais `--thinking-*` são de animação, não tokens de design | skill [`design-system`](../../../.claude/skills/design-system/reference.md) |
| Decisões F1.x | [`DECISOES.md`](../../DECISOES.md) |