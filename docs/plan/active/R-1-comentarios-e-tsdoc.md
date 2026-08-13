# R-1 — Aplicação integral da convenção de comentário e TSDoc

**Depende de:** a skill [`comments`](../../../.claude/skills/comments/SKILL.md). **Entrega:** todo o **código de produção** de `src/` no padrão da skill — inundação comprimida, blocos `/* */` narrativos eliminados, doc-comment em forma TSDoc — mais um guard que impede o pior sintoma de voltar.

> Primeiro da **trilha R (refatoração)**, transversal ao arco: não constrói feature, leva um padrão já decidido ao código que o precede. Numeração própria, como a trilha DS.
>
> **Aceite global, verificado e não afirmado: ZERO mudança de comportamento.** Em cada passo, o `git diff` só pode tocar linhas de comentário (a checagem abaixo prova isso), `pnpm check:fast` fica verde e a contagem de testes segue **333**. Se um passo mudou uma linha de código, algo saiu errado.
>
> **A régua que decide se R-1 dá certo: comprimir, não apagar.** A maioria dos comentários é *bucket-1* — armadilha diagnosticada, restrição externa, número medido — e **fica**, encolhida ao teto de ~3 linhas. Só a narrativa de decisão (*bucket-2*) sai, apontando a sigla no [`HISTORY.md`](../../HISTORY.md). **Consequência honesta: a economia de linhas por arquivo é modesta, e um passo que remove muitas linhas é bandeira vermelha, não progresso.**

---

## O caso — por que este plano existe

A skill `comments` nasceu e foi provada em dois arquivos (`useConversationChat.ts`, `conversationsContext.ts`), mas o resto do repositório continua fora do padrão. Medido em **código de produção** (`src/`, fora de `*.test.*`):

- **457 comentários `//`** em 41 arquivos. Piores: `shared/ipc.ts` **87**, `ConversationView.tsx` 45, `MarkdownMessage.tsx` 32, `useConversationChat.ts` 29, `ollama.ts` 25, `conversation/handlers.ts` 25, `core/ai/types.ts` 23.
- **~30 blocos `/* */` narrativos** em `.ts/.tsx` — o "sintoma nº 1" que a skill bane.
- Ensaio de decisão dentro do `.ts`: o `/** */` de **17 linhas** em `ChatReply.promptTokens` (`shared/ipc.ts`) é o exemplar mais claro.

O objetivo é levar esse código de produção inteiro ao teto da skill de uma vez — a limpeza retroativa que a própria skill diz ser "um plano próprio" — e fechar mecanicamente o único sintoma que tem forma verificável, para não reincidir.

---

## O inventário e o que fica de fora

**No escopo:** todo `.ts/.tsx` de produção em `src/` — `shared/`, `core/`, `main/`, `preload/`, `renderer/`.

**Fora do escopo, cada um com o motivo (para ninguém tratar como trabalho perdido depois):**

| Fora | Por quê |
|---|---|
| `*.test.*` (~315 `//` a mais) | comentário de teste é marcador arrange/act/assert; a skill já isenta teste de docstring |
| `*.module.css` | CSS tem só uma forma de comentário; não há doc-comment a padronizar |
| `tokens.css` (20), `tailwind.css` (11) | as explicações da camada de token têm **outro dono**: a skill [`design-system`](../../../.claude/skills/design-system/SKILL.md). Não é "CSS é fora" — é dono diferente |
| `.claude/hooks/*.mjs`, `eslint.config.mjs`, `*.yml` | infraestrutura, não código do app; seus comentários já são bucket-1 e conformes. Toca-se só se editado por outro motivo |

---

## O que já existe e R-1 usa desde a primeira linha

- **A checagem de "só comentário mudou"** — o instrumento de aceite de cada passo:
  ```bash
  git diff -- <arquivos> | grep -E '^[+-]' | grep -vE '^[+-]\s*(//|\*|/\*\*|\*/|/\*)' | grep -vE '^(\+\+\+|---)'
  ```
  Saída **vazia** = nenhuma linha de código mudou. Foi assim que os dois primeiros arquivos foram provados inertes.
- **Os quatro hooks** (`format_fix`, `guard`, `test_related`, e o `Stop` com `check:fast`) rodam a cada edição `.ts/.tsx` — o retorno é imediato, passo a passo.
- **A skill `comments`** na sua forma final: as duas perguntas, a forma TSDoc, o conjunto curado de tags, o que não copiar de biblioteca.

---

## Passo 0 — Nascimento do plano no repositório

Cria este arquivo (no formato de plano do projeto, com diário vazio) e acrescenta a **trilha R** ao [`ROADMAP § 1`](../../ROADMAP.md), como a trilha DS entrou. Nenhuma edição de `src/`.

## Passo 1 — `shared/` (menos `ipc.ts`) + `core/`

As camadas puras e pequenas. `core/ai/types.ts` (23), `models.ts` (14), `chat.ts`, `budget.ts`, `memory.ts`, `messages.ts`; `shared/channels.ts` (6), `meta.ts`. Padrão: comprimir bucket-1 a ≤3 linhas; doc-comment sobrevivente em `/** */` com sumário; `/* */` narrativo vira `//` curto ou sai citando a sigla.

**Aceite:** grep de "só comentário" vazio; `check:fast` verde, 333 testes.

## Passo 2 — `shared/ipc.ts`, sozinho

O contrato, e o arquivo mais delicado (regra dos seis lugares) e mais comentado (87). Tratamento **por símbolo** (ver R1.3): onde um `//` documenta um campo do contrato, vira `/** */` de membro (ganho de IntelliSense na fronteira); onde não, comprime no lugar. O `/** */` de 17 linhas de `promptTokens` encolhe a ~3 mais a sigla `(D15.4)`.

**Aceite:** grep vazio; `check:fast` verde, 333 testes; conferência manual de que o tooltip do editor mostra os doc-comments de membro.

## Passo 3 — `main/` + `preload/`

O lado privilegiado. `main/index.ts` (16), `features/ai/providers/ollama.ts` (25), `features/conversation/handlers.ts` (25), `features/ai/handlers.ts` (13), `db/open.ts` (8), `features/dataset/lines.ts` (8), `rows.ts`, os demais handlers; `preload/index.ts` (2). Handler exportado ganha `/** */` de sumário quando o nome não basta; o resto é compressão.

**Aceite:** grep vazio; `check:fast` verde, 333 testes.

## Passo 4 — `renderer/` chrome: `shared/ui`, `app`, hooks, componentes

`shared/ui/` (`Dialog` 7, `messages` 4, `StateView`, `Field`), `app/` (`Sidebar`, `AppShell`), hooks (`useJobChunks` 5, `useStickToBottom` 5, `useAiModels` 6, `useLoadedModels` 3), `components/Versions`.

**Aceite:** grep vazio; `check:fast` verde, 333 testes.

## Passo 5 — `renderer/features/`: conversation, settings, open-dataset

O maior aglomerado: `ConversationView.tsx` (45, quase todo bucket-1), `MarkdownMessage.tsx` (32), `ModelSelector.tsx` (18), `Composer`, `ConversationList`, mais `settings/` e `open-dataset/`. **Inclui a reconferência de `useConversationChat.ts` e `conversationsContext.ts`** contra a convenção **final** — eles foram limpos antes das tags novas (`@typeParam`/`{@link}`); se algo ali muda, é o caso de calibração; se já estão conformes, o diário registra isso.

**Aceite:** grep vazio; `check:fast` verde, 333 testes.

## Passo 6 — O guard e o fechamento

- **Guard `/* */` no [`guard.mjs`](../../../.claude/hooks/guard.mjs):** reprova (saída 2) bloco `/* */` em `.ts/.tsx` sob `src/`, **permitindo** `/** */` (doc-comment) e diretivas (`/* eslint-... */`). Provocado de propósito uma vez, para confirmar que bloqueia. ⚠️ **Ele fecha só o sintoma mecanicamente definível: os 457 `//` são invisíveis a ele.** A reincidência por `//` continua confiada à skill — o guard não é "problema resolvido", é "um caminho de falha fechado".
- **Grep global antes/depois** no `HISTORY.md`, mostrando a inundação de produção reduzida.
- **Fechamento:** `check:fast` verde, diário preenchido, este arquivo movido para `implemented/`, entrada no `HISTORY.md` (com o descartado: eslint-plugin-tsdoc e a varredura de teste).

**Aceite:** o guard bloqueia um `/* */` narrativo de teste e deixa passar um `/** */`; `check:fast` verde.

---

## Decisões

- **R1.1 — Zero mudança de comportamento é o aceite, verificado.** O grep de "só comentário" mais `check:fast` e a contagem de 333 testes provam a inércia a cada passo. Herdado do modelo da trilha DS ("zero mudança visual").
- **R1.2 — Comprimir, não apagar.** Bucket-1 fica em ≤3 linhas; só bucket-2 sai, citado por sigla. Deleção grande é bandeira vermelha. É a régua que separa R-1 de estragar a base.
- **R1.3 — `ipc.ts`: `//` de campo → `/** */` de membro onde documenta o campo.** É superfície de API na fronteira do contrato, e o doc-comment de membro é o que faz o IntelliSense funcionar; comprime no lugar onde o `//` não documenta um campo.
- **R1.4 — Testes fora do R-1.** Comentário de teste é marcador de estrutura, e a skill isenta teste de docstring. Não há passo de varredura de teste; se um teste for tocado por outro motivo, a pergunta 1 vale ali também.
- **R1.5 — Guard mecânico só para `/* */`; eslint-plugin-tsdoc descartado.** O guard fecha o único sintoma com forma verificável; os `//` seguem com a skill. O `eslint-plugin-tsdoc` valida **sintaxe** de doc-comment, não política, e traz dependência — não paga a régua nesta passada (fica anotado na skill como pendente).
- **R1.6 — `tokens.css`/`tailwind.css` intactos por terem outro dono** (skill `design-system`), não por "CSS é fora".
- **R1.7 — Ordem por camada (DAG de import), um commit por passo.** É o "uma variável por vez" do projeto: edita, valida com `check:fast`, commita, segue.

---

## Diário de execução

| Data | Sessão | O que foi feito | Onde parei |
|---|---|---|---|
| 13/08/2026 | 1 | Passos 0–3: plano + trilha R; `shared`+`core`, `ipc.ts` (por símbolo, R1.3: `//` de campo → `/** */` de membro) e `main`+`preload` no padrão. Blocos `/* */` convertidos, ensaios comprimidos citando a sigla, scaffold do `index.ts` removido. ~−269 linhas de comentário, todo invariante mantido, diff só-comentário vazio a cada passo, 333 testes | Passo 4 (renderer chrome) |
