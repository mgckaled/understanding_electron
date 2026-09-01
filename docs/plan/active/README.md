# Planos — backlog vivo

Este diretório (`active/`) é o backlog do [ciclo de vida de plano](../../README.md): um plano nasce aqui, ganha uma linha no diário a cada sessão, e ao concluir **move** para [`../implemented/`](../implemented/) com uma entrada em [`HISTORY.md`](../../HISTORY.md).

> Plano em `implemented/` é registro histórico, não fonte viva. Se o repositório contradisser um plano arquivado, o **repositório ganha**. A fonte viva de cada assunto está na tabela de fonte única do [`README de docs`](../../README.md).

---

## Em execução

O 18 (camada de dados) virou sub-planos 18-A a 18-F, ≤7 passos cada (ver [`ROADMAP § 1`](../../ROADMAP.md)). Todos os seis concluíram — [`implemented/18-A`](../implemented/18-A-motor-e-worker.md), [`implemented/18-B`](../implemented/18-B-canal-e-consulta.md), [`implemented/18-C`](../implemented/18-C-pre-visualizacao.md), [`implemented/18-D`](../implemented/18-D-perfil-e-cartao-aninhado.md), [`implemented/18-E`](../implemented/18-E-json-ndjson.md), [`implemented/18-F`](../implemented/18-F-excel.md) — o arco 18 fecha aqui, e o **19** (propor: consulta e passos) é o próximo do arco.

---

## A trilha de design system (DS-N) — encerrada

Oito planos, DS-1 a DS-8 (ago/2026): fundação Tailwind v4, migração da casca e das features, a interface chegando ao alvo, popover nativo e tema manual, ícones e fonte, fundação de desktop em `base.css`, consolidação de `tokens.css` e limpeza dos primitivos.

| Onde está o quê |  |
|---|---|
| os oito marcos, com o que cada um decidiu e descartou | [`HISTORY-archive.md`](../../HISTORY-archive.md) |
| a regra viva que saiu da trilha | skill [`design-system`](../../../.claude/skills/design-system/SKILL.md) e o [`reference.md`](../../../.claude/skills/design-system/reference.md) dela |
| o alvo visual e a tabela de distância | [`reference/handoff-ds-ago2026/`](../../reference/handoff-ds-ago2026/README.md) |
| as decisões por sigla (`DS1.x`–`DS8.x`) | [`DECISOES.md`](../../DECISOES.md) |

**A régua que a trilha deixou, e que continua valendo:** o design system é um **envelope** — veste o que já existe; o que ainda não existe nasce vestido, no plano da própria feature. Ela vive na skill, não aqui.


## O arco conversacional (13–20)

Nasceu da [virada de ago/2026](../../HISTORY.md), que fez do chat a porta de entrada do aplicativo, e ganhou um oitavo plano na [entrada de escopo de documento e imagem](../../HISTORY.md). Oito planos, cada um de uma a três sessões, na ordem em que se destravam.

> ⚠️ **Os arquivos 17–20 ainda não existem, e isso é de propósito.** Um plano é escrito quando é o próximo a ser executado — escrever os seis agora produziria cinco documentos envelhecendo enquanto o primeiro é executado, que é a dívida que a convenção de fonte única existe para evitar. Esta tabela é o contrato do arco; o documento de cada plano nasce na sessão em que ele começa.
>
> A renumeração de ago/2026 (o antigo 17 virou 18, e assim por diante) custou esta tabela e três ponteiros no [`ROADMAP`](../../ROADMAP.md) — barato exatamente porque os arquivos não existiam. É o argumento a favor da regra acima, não uma exceção a ela.

| # | Entrega | A decisão que o plano carrega |
|---|---|---|
| [~~**13**~~](../implemented/13-casca-do-aplicativo.md) | ✅ **Casca do aplicativo** — concluída em ago/2026. Duas colunas, sidebar em três regiões por slot, conversa em altura cheia, composer fixo, Configurações em modal. Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| [~~**14**~~](../implemented/14-persistencia-das-conversas.md) | ✅ **Persistência das conversas** — concluída em ago/2026. `node:sqlite` em `userData`, escada de migração desde a v1, canais `conversation:*` e `settings:*`, TanStack Query no cache de servidor, parcial interrompido gravado com marcador, e um e2e que fecha e relança o app. Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| [~~**15**~~](../implemented/15-orcamento-de-contexto-e-modelo.md) | ✅ **Orçamento de contexto e modelo por conversa** — concluída em ago/2026. Seletor alimentado pelo catálogo, `num_ctx` por conversa, medidor calibrado pela própria conversa, envio recusado quando não cabe, e o par `(modelo, num_ctx)` travado no primeiro envio. Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| [~~**16**~~](../implemented/16-anexo-mecanismo-e-dataset.md) | ✅ **Anexo: o mecanismo, e o dataset como primeiro consumidor** — concluída em ago/2026. O clipe no composer (reaproveitado da DS-5, só trocando o que abre), `userData/attachments/<hash>` endereçado por conteúdo, `MessagePart` como união discriminada (`text \| dataset`), `dataset:attach` como job com hash e schema num único passe pelo arquivo, `DatasetCard` desenhado na conversa, e a coleta de órfãos on-remove e no boot. `dataset:scan`/`useOpenDataset` da [fase 06](../implemented/06-primeira-feature.md) saem por completo, substituídos. Sete passos, sete commits. Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| [~~**17**~~](../implemented/17-anexo-documento-e-imagem.md) | ✅ **Anexo: documento e imagem** — concluída em ago/2026. Os extratores por tipo (`.txt`/`.md` direto, `.pdf` por `unpdf` com recusa de PDF escaneado na tela, imagem normalizada para PNG — SVG/WebP rasterizados via `BrowserWindow`, D17.7), o gate de `vision` em dois pontos (D17.11), `ai:chat` migrado para `Message[]` com a materialização no main (D17.5), e o protocolo `attachment://`. Os três tipos de anexo coexistem numa mesma conversa; `gc.ts` não precisou de nenhuma alteração. Oito passos, verificado ao vivo (Ollama real, `pnpm build:win`). Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| **18** | **Camada de dados.** DuckDB em `utilityProcess`, Arrow, tabela virtualizada — [`study/05-proximos-passos.md`](../../study/05-proximos-passos.md) é o dono. O cartão raso vira perfil real: tipos, nulos, cardinalidade, `SUMMARIZE`. | Dispara o gatilho do `shamefullyHoist`; o endurecimento (`lock_configuration`) nasce aqui, antes de existir SQL gerado |
| [~~**19**~~](../implemented/19-propor-consulta-e-passos.md) | ✅ **Propor: consulta e passos** — concluída em ago/2026. `core/pipeline/` (tipos e compilador), `format`/`.parse()` alimentados pelo mesmo schema zod (D19.3, confirmado ao vivo contra `gemma3:4b`), canais `dataset:transform` e `ai:propose`, `StepProposalCard` na mensagem do assistente (reduzido a `StepProposalLine` no F-3-F) com verificação pós-execução por `nullPercentage` (D19.6). Sete passos, `pnpm check:fast` verde. Entrada em [`HISTORY.md`](../../HISTORY.md) | — |
| **20** | **Gráfico como artefato.** Um gráfico derivado de um resultado que já está na conversa. | Paleta categórica que funcione nos **dois temas**, com cada cor nascendo com sua linha em `tokens.contrast.test.ts` |

**A ordem não é arbitrária.** 13 não depende de nada; 14 tem no 13 seu consumidor; 16 precisa do composer do 13 e do armazenamento do 14; 17 monta-se inteiro sobre o mecanismo do 16 e sobre o gate de `capabilities` do 15; 19 precisa do perfil do 18 para não repetir a [falha silenciosa](../../HISTORY.md) registrada nas armadilhas; 20 não tem o que plotar antes do 19.

**Duas restrições que atravessam o arco**, decididas cedo porque são caras de retrofitar:

- **`Message` nasce no 13/14 como lista de partes tipadas**, não como `content: string` com anexos pendurados ao lado. `text`, `image`, `document`, `dataset`, `proposal`, `result` — e uma função pura em `core/` traduz a lista para o que cada provedor recebe, no mesmo lugar onde mora a fronteira de privacidade dos três níveis. Uma decisão que serve artefato, anexo de dados **e** visão. Retrofitar isto toca `shared/ipc.ts`, preload, renderer, main e as linhas já gravadas; o **armazenamento**, esse sim, pode começar como JSON numa coluna e virar tabela própria no 19, porque o `PRAGMA user_version` resolve. Ver [`HISTORY.md`](../../HISTORY.md) § *flexibilidade é forma de dado e slot*. **Já cobrada uma vez:** quando documento e imagem entraram no escopo em ago/2026, a estrutura que os recebe estava pronta — nenhum retrofit.
- **A conversa nunca guarda o resultado**, só pergunta, proposta e veredito. Sem isso, o arquivo do SQLite cresce com cada tabela de cada consulta de cada conversa. **O anexo é a exceção, e por um motivo simétrico:** os bytes de um PDF não são rederiváveis (o arquivo original pode ter sido movido ou apagado), então ele é copiado para `userData/attachments/<hash>` e a conversa guarda a referência. Guardar por conteúdo, não por caminho, dá deduplicação de graça e transforma a exclusão de conversa numa pergunta de contagem de referências.

---

## Fora do arco, ainda em `active/`

- **Trilha O (observatório)**: [~~O-1~~](../implemented/O-1-a-casca-do-observatorio.md), [~~O-2~~](../implemented/O-2-ipc-jobs-e-fila-do-worker.md), [~~O-3~~](../implemented/O-3-os-dois-motores-se-descrevem.md), [~~O-4~~](../implemented/O-4-capacidades-o-primeiro-painel-caro.md), [~~O-5~~](../implemented/O-5-uso-de-disco-e-cache-do-chromium.md) e [~~O-6~~](../implemented/O-6-observatoriodb-e-fluxo-de-eventos.md) ✅ já implementados — o O-6, sexto plano, é o primeiro que grava (nasce `observatory.db`). Nenhum plano em `active/` no momento: a trilha é **gatilhada, não sequencial** — cada painel entra quando o que ele observa passa a existir, e por isso O-7/O-8 ainda não têm arquivo. A fundamentação — os seis eixos, o inventário classificado por custo/trabalho/situação, o critério `crivo.db` vs. `observatory.db` — é de [`reference/observatory/`](../../reference/observatory/README.md); a ordem dos oito está no [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência).
- [**09 — camada de IA e ML**](09-camada-de-ia.md). Continua sendo o **dono das decisões D9.1–D9.6**. A fatia 1 (chat local) está implementada; as fatias 2, 3 e 4 foram absorvidas pelo arco (planos 19, N-1 e 16/18) — a fatia 3 (nuvem opt-in e segredos) virou a trilha **N**, trazida para rodar **antes** do 19 (o `ModelPicker` do F-2 já reserva o slot "Locais/Nuvem" desabilitado na UI real, ver [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência)); restam as fatias 5 (RAG) e 6 (ML item a item), depois do arco. A **fatia 5 ganhou escopo** com a entrada de documento: além de cartões e receitas, indexa documento acima de ~8k tokens e a descrição de imagem produzida no anexo — mas só por essa razão, porque abaixo desse teto indexar **perde** para mandar o documento inteiro ([`HISTORY.md`](../../HISTORY.md) § RAG entra por capacidade).

---

## A fundação, encerrada (ago/2026)

Oito fases (00–08): camadas e fronteiras, contrato IPC, sandbox, testes rápidos, design tokens, primeira feature vertical, E2E e empacotamento, automação e registro. Marcos em [`HISTORY-archive.md`](../../HISTORY-archive.md); o mapa de dependência que orientou a ordem está lá também, junto da entrada de nascimento.


## O que ficou adiado

Cada adiamento tem um **evento** que o reabre, não uma data. A lista consolidada é dona de [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão) — não se repete aqui, para não envelhecer em dois lugares. Os de maior alcance neste arco: `shamefullyHoist: false` no plano **18**, TanStack Query no 14 (fechado), `MarkdownMessage` subindo para `shared/ui/` no 16 (fechado), e o `check:fast` a investigar antes de empilhar mais teste.

A sequência completa até o produto do [`ESCOPO.md`](../../ESCOPO.md) está no [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência).
