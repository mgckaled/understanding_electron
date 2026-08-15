# Handoff: ajustes de interface do chat — crivo

## O que este pacote é
Depois de ler o repositório real (`mgckaled/understanding_electron`) e os docs em `docs/`, ficou claro que a casca inteira do chat — sidebar, conversas, thread, composer, seletor de modelo, orçamento de contexto — **já existe e funciona** (fases 13-15 do `ROADMAP.md`), assim como o modal de Configurações (`src/renderer/src/features/settings/Settings.tsx`, `Dialog` nativo + `ThreadsField` + `LoadedModels`). Nada disso é reconstruído aqui.

Este pacote cobre duas frentes, construídas e validadas nesta sessão em cima do protótipo:
1. **Camada Tailwind v4** sobre os tokens existentes — ver `BRIEF-claude-design.md` (anexado pelo usuário) para as restrições completas; resumidas e cruzadas com o repo real em `IMPLEMENTATION_PLAN.md`.
2. **Cinco extensões pontuais de interface**, todas dentro de telas/arquivos que já existem:
   - Botão de pausa no composer (habilitado só durante resposta em andamento).
   - Popover "Ollama (versão)" no rodapé da sidebar, com host:porta em fonte monoespaçada.
   - Threads de CPU como 3 opções fixas (2/4/6) em vez de slider livre.
   - Credencial de nuvem (Gemini + GLM): campo de texto sempre visível, com ícone de olho aberto/fechado para mascarar a chave.
   - Composer com `<textarea>` que cresce até ~3 linhas e rola depois disso; legendas de contexto/RAM removidas do composer e de abaixo de cada resposta; resposta do assistente renderiza Markdown e blocos de código.

**Leia `IMPLEMENTATION_PLAN.md` primeiro** — tem as fases, os arquivos reais a tocar, e duas decisões em aberto que precisam de resposta antes de implementar (alternador de tema manual vs. a decisão já registrada de "só `prefers-color-scheme`"; para onde vai a informação de orçamento de contexto do plano 15 depois de removida do composer).

## Ícones: não existe biblioteca — são glyphs Unicode
O app real não usa SVG nem lib de ícones — só caracteres Unicode (`«`/`»`, `✎`, `×`, `↻`). O protótipo desta pasta usa SVG simples só porque é uma ferramenta de design isolada; ao implementar de fato, seguir o padrão real do app (glyphs) ou o que `IMPLEMENTATION_PLAN.md` decidir para os ícones novos (pausa, olho aberto/fechado) que não têm glyph óbvio equivalente.

## Tokens reais (de `tokens.css`, não placeholder)
| Semântico | Valor (tema escuro) | Uso |
|---|---|---|
| `--color-surface` | `#1e2023` (`--gray-3`) | fundo do `Dialog`, cards |
| `--color-border` | `#2f3136` (`--gray-5`) | bordas |
| `--color-text` / `--color-text-muted` | `#f5f6f7` / `#c4c6cb` | texto principal / apoio |
| `--color-accent` | `#0d5bd9` (`--blue-9`) | preenchimento sólido (botão ativo, envio) |
| `--color-accent-text` | tom claro do azul | texto/borda sobre superfície — nunca o sólido |
| `--color-surface-sunken` | `#0b0c0e` (`--gray-1`) | fundo de inputs |
| `--radius-md` | `6px` | inputs, botões |
| `--radius-full` | `9999px` | trilho de toggle, pill |
| `--font-ui` | `'Segoe UI Variable', 'Segoe UI', system-ui` | todo texto de chrome |
| `--font-mono` | `ui-monospace, 'Cascadia Code', Consolas` | valores técnicos, host:porta, código |
| `--space-3..6` | `6/8/12/16px` | gaps e paddings |

Tema claro redefine só a camada semântica em `@media (prefers-color-scheme: light)` — os primitivos (`--gray-N`, `--blue-N`) não mudam.

## `reference/Chat Local Design System.dc.html`
Prototipo interativo com o estado final das 3 rodadas de ajuste desta sessão — abra num navegador para navegar por Onboarding/Chat/Vazio/Erro/Config no rodapé. Útil como referência de **interação e hierarquia visual**; cores/tipografia exatas vêm da tabela de tokens acima, não do protótipo (ele foi feito sem o `tokens.css` real carregado).

## `design-system/` — extraído do repositório real
Tokens CSS reais (`tokens/colors.css`, `typography.css`, `spacing.css`, `layout.css`, `motion.css`, `base.css`, importados por `styles.css`), os 6 primitivos reais como demo (`components/core/{Button,Field,Panel,Toolbar,Dialog,StateView}`), specimens de fundação (`guidelines/`), a casca de chat completa em click-through (`ui_kits/crivo/`), assets (`logo-monogram.svg`, `app-icon.png`) e `SKILL.md`/`readme.md` com o racional de cada decisão. Use isto como a fonte de valores exatos — cores, espaço, tipografia — em vez da tabela resumida no topo deste `README.md`; a tabela é um atalho, `design-system/tokens/*.css` é a fonte.

**Confirma, com fonte primária, a decisão de tema:** `design-system/readme.md` registra "*Theme follows the OS, with no manual switch*" — mesma decisão do `SKILL.md` do repositório e do `BRIEF-claude-design.md`, reforçando a Decisão em aberto nº 1 do `IMPLEMENTATION_PLAN.md`.

## Arquivos deste pacote
- `IMPLEMENTATION_PLAN.md` — plano fase-a-fase no formato do projeto (`docs/plan/active/`), com as duas decisões em aberto.
- `reference/Chat Local Design System.dc.html` — referência de interação (as 5 extensões desta sessão).
- `design-system/` — tokens, primitivos e casca reais extraídos do repositório (ver acima).
- `screenshots/` — capturas do protótipo (onboarding, chat, vazio, erro, configurações claro/escuro).
