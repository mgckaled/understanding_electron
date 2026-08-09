# Planos — backlog vivo

Este diretório (`active/`) é o backlog do [ciclo de vida de plano](../../README.md): um plano nasce aqui, ganha uma linha no diário a cada sessão, e ao concluir **move** para [`../implemented/`](../implemented/) com uma entrada em [`HISTORY.md`](../../HISTORY.md).

> Plano em `implemented/` é registro histórico, não fonte viva. Se o repositório contradisser um plano arquivado, o **repositório ganha**. A fonte viva de cada assunto está na tabela de fonte única do [`README de docs`](../../README.md).

---

## Em execução

| # | Plano | Estado |
|---|---|---|
| [14](14-persistencia-das-conversas.md) | Persistência das conversas | escrito, nenhum passo iniciado |

---

## O arco conversacional (13–19)

Nasceu da [virada de ago/2026](../../HISTORY.md), que fez do chat a porta de entrada do aplicativo. Sete planos, cada um de uma a três sessões, na ordem em que se destravam.

> ⚠️ **Os arquivos 15–19 ainda não existem, e isso é de propósito.** Um plano é escrito quando é o próximo a ser executado — escrever os cinco agora produziria quatro documentos envelhecendo enquanto o primeiro é executado, que é a dívida que a convenção de fonte única existe para evitar. Esta tabela é o contrato do arco; o documento de cada plano nasce na sessão em que ele começa.

| # | Entrega | A decisão que o plano carrega |
|---|---|---|
| [~~**13**~~](../implemented/13-casca-do-aplicativo.md) | ✅ **Casca do aplicativo** — concluída em ago/2026. Duas colunas, sidebar em três regiões por slot, conversa em altura cheia, composer fixo, Configurações em modal. Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| [**14**](14-persistencia-das-conversas.md) | **Persistência das conversas.** `node:sqlite` em `userData`, esquema com migração desde a v1, canais `conversation:*`, histórico ao abrir, renomear e excluir. A mesma tela do 13, agora sobrevivendo ao fechamento. | ✅ escrito. Resposta interrompida **grava o parcial com marcador** (D14.3); TanStack Query entra para o cache de servidor, com o corpo dos dois hooks como único ponto de troca (D14.4); a escada de migração nasce **exercitada em dois degraus** (D14.2); e o cartão de dados fica para o 16 por não ter escritor, mas com a forma já decidida — dentro de `parts` (D14.9) |
| **15** | **Orçamento de contexto e modelo por conversa.** `num_ctx` exposto, política de truncamento medida, contador visível, lista de modelos por `/api/tags` **guardando as `capabilities`, não só os nomes** — é o que permite ligar anexo de imagem só para modelo com `vision` sem refazer lista e armazenamento depois. | A política de truncamento — janela deslizante invalida o prefixo em cache e força reprocessar o prompt inteiro a cada turno, que na CPU é o custo dominante |
| **16** | **Anexo: esquema e perfil.** Anexar arquivo → o `dataset:scan` da [fase 06](../implemented/06-primeira-feature.md) vira cartão no contexto. Níveis 1 e 2 de exposição. | Onde a regra de privacidade vira teste: um nível 1 sobre o construtor de contexto que falha se um valor-sentinela do arquivo aparecer no payload |
| **17** | **Camada de dados.** DuckDB em `utilityProcess`, Arrow, tabela virtualizada — [`study/05-proximos-passos.md`](../../study/05-proximos-passos.md) é o dono. O cartão raso vira perfil real: tipos, nulos, cardinalidade, `SUMMARIZE`. | Dispara o gatilho do `shamefullyHoist`; o endurecimento (`lock_configuration`) nasce aqui, antes de existir SQL gerado |
| **18** | **Propor: consulta e passos.** `core/pipeline/`, o schema zod alimentando `format` e `.parse()`, a união discriminada `query \| steps`, e a verificação pós-execução. | Onde a lista de passos aparece: dentro da mensagem do assistente, ou numa região própria |
| **19** | **Gráfico como artefato.** Um gráfico derivado de um resultado que já está na conversa. | Paleta categórica que funcione nos **dois temas**, com cada cor nascendo com sua linha em `tokens.contrast.test.ts` |

**A ordem não é arbitrária.** 13 não depende de nada; 14 tem no 13 seu consumidor; 16 precisa do composer do 13 e do armazenamento do 14; 18 precisa do perfil do 17 para não repetir a [falha silenciosa](../../HISTORY.md) registrada nas armadilhas; 19 não tem o que plotar antes do 18.

**Duas restrições que atravessam o arco**, decididas cedo porque são caras de retrofitar:

- **`Message` nasce no 13/14 como lista de partes tipadas**, não como `content: string` com anexos pendurados ao lado. `text`, `image`, `dataset`, `proposal`, `result` — e uma função pura em `core/` traduz a lista para o que cada provedor recebe, no mesmo lugar onde mora a fronteira de privacidade dos três níveis. Uma decisão que serve artefato, anexo de dados **e** visão (o `gemma3:4b` instalado já declara `vision`). Retrofitar isto toca `shared/ipc.ts`, preload, renderer, main e as linhas já gravadas; o **armazenamento**, esse sim, pode começar como JSON numa coluna e virar tabela própria no 18, porque o `PRAGMA user_version` resolve. Ver [`HISTORY.md`](../../HISTORY.md) § *flexibilidade é forma de dado e slot*.
- **A conversa nunca guarda o resultado**, só pergunta, proposta e veredito. Sem isso, o arquivo do SQLite cresce com cada tabela de cada consulta de cada conversa. Corolário para anexo sem caminho (imagem colada): o arquivo é copiado para `userData/attachments/<hash>` e a conversa guarda a referência.

---

## Fora do arco, ainda em `active/`

- [**09 — camada de IA e ML**](09-camada-de-ia.md). Continua sendo o **dono das decisões D9.1–D9.6**. A fatia 1 (chat local) está implementada; as fatias 2 e 4 foram absorvidas pelo arco (planos 18 e 16/17); restam as fatias 3 (nuvem opt-in e segredos), 5 (RAG sobre cartões e receitas) e 6 (ML item a item), todas depois do 19.

---

## A fundação, encerrada (ago/2026)

Do scaffold do electron-vite a uma base pronta para o resto. Uma linha por fase; o "por quê" está em [`HISTORY.md`](../../HISTORY.md).

| # | Entrega |
|---|---|
| [00](../implemented/00-visao-geral.md) | Visão geral: o critério "caro de desfazer" e as decisões globais D1–D6 |
| [01](../implemented/01-camadas-e-fronteiras.md) | Seis camadas em `src/`, com a regra de importação verificada por ESLint |
| [02](../implemented/02-contrato-ipc.md) | Contrato IPC tipado, `Result`, preload estreito, registro de handlers |
| [03](../implemented/03-sandbox-e-seguranca.md) | `sandbox: true`, superfície mínima, fronteira de segurança fixada |
| [04](../implemented/04-testes-rapidos.md) | Vitest em dois projetos, níveis 1–3 da pirâmide |
| [05](../implemented/05-design-tokens.md) | `tokens.css`, primitivos, densidade de desktop, `StateView` |
| [06](../implemented/06-primeira-feature.md) | `open-dataset` de ponta a ponta, com progresso e cancelamento |
| [07](../implemented/07-e2e-e-empacotamento.md) | Playwright em dev e contra o instalador |
| [08](../implemented/08-automacao-e-registro.md) | Hooks de verificação, `CLAUDE.md` pós-fundação, três skills |
| [10](../implemented/10-cor-contraste-e-tema-claro.md) | Contraste medido nos dois temas, tema claro mapeado por intenção |
| [11](../implemented/11-markdown-na-resposta-do-assistente.md) | Markdown na resposta do assistente, com HTML cru inerte |
| [12](../implemented/12-realce-de-sintaxe.md) | Realce de sintaxe por classes semânticas, sem estilo inline |

As decisões estruturais viraram as skills [`architecture`](../../../.claude/skills/architecture/SKILL.md), [`design-system`](../../../.claude/skills/design-system/SKILL.md) e [`testing`](../../../.claude/skills/testing/SKILL.md) — carregadas quando o assunto aparece, em vez de ocuparem contexto em toda sessão.

---

## O que ficou adiado

Cada adiamento tem um **evento** que o reabre, não uma data. A lista consolidada é dona de [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão) — não se repete aqui, para não envelhecer em dois lugares. Os de maior alcance neste arco: `shamefullyHoist: false` no plano 17, TanStack Query no 14, `MarkdownMessage` subindo para `shared/ui/` no 16, e o `check:fast` a investigar antes de empilhar mais teste.

A sequência completa até o produto do [`ESCOPO.md`](../../ESCOPO.md) está no [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência).
