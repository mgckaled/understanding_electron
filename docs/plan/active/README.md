# Planos — backlog vivo

Este diretório (`active/`) é o backlog do [ciclo de vida de plano](../../README.md): um plano nasce aqui, ganha uma linha no diário a cada sessão, e ao concluir **move** para [`../implemented/`](../implemented/) com uma entrada em [`HISTORY.md`](../../HISTORY.md).

> Plano em `implemented/` é registro histórico, não fonte viva. Se o repositório contradisser um plano arquivado, o **repositório ganha**. A fonte viva de cada assunto está na tabela de fonte única do [`README de docs`](../../README.md).

---

## Em execução

| # | Plano | Estado |
|---|---|---|
| [16](16-anexo-mecanismo-e-dataset.md) | Anexo: o mecanismo, e o dataset como primeiro consumidor | escrito e revisado, nenhum passo iniciado. **Ler a skill [`ipc`](../../../.claude/skills/ipc/SKILL.md) antes do passo 2** — é o plano que cria o canal de anexo |

---

## A trilha de design system (DS-N)

Trilha paralela ao arco, com **numeração própria de propósito**. O arco 13–20 é uma sequência em que cada plano destrava o seguinte; a trilha DS é transversal — toca todo componente que existir no momento em que rodar, e não tem lugar natural nessa sequência.

**O prefixo é a decisão, e ela é sobre custo.** Inserir os planos de design system dentro do arco exigiria renumerar o 16, que já está escrito: **28 referências numéricas internas mais 24 siglas `D16.x`**, cada uma pedindo julgamento caso a caso (o arquivo tem `18.399` medido ao lado de `plano 18`). O README já registrava que a renumeração de ago/2026 foi barata *"exatamente porque os arquivos não existiam"* — a condição deixou de valer. Um namespace separado custa zero e não corrompe número medido.

Efeito de segunda ordem, e é o que fechou a escolha: a trilha DS roda **em paralelo** com a ferramenta externa de design, então ter um prefixo próprio torna a origem de cada plano legível sem consultar nada.

### O alvo da trilha, fixado em 12/08/2026

⚠️ **A trilha DS não é uma migração de mecanismo com ajustes no fim. Ela tem um destino visual, e ele é imperativo:** ao fim do DS-3 a interface precisa estar o mais próximo possível de [`reference/handoff-ds-ago2026/alvo-chat.png`](../../reference/handoff-ds-ago2026/alvo-chat.png), com os demais estados em [`alvo/`](../../reference/handoff-ds-ago2026/alvo/). **O que precisar adaptar, adapta** — componente, disposição de elemento, escala de tipo.

**O design system é um envelope, e é isso que torna a ideia simples.** A trilha DS **não constrói feature nenhuma**. Ela deixa a linguagem visual definida, e o alvo tem duas metades: o que **já existe** no app ganha essa linguagem — é o aceite da trilha; o que **ainda não existe** nasce depois, no plano da própria feature, já vestido, porque o DS estará pronto. O cartão de anexo no alvo não é pendência do DS-3: é o retrato de como o [plano 16](16-anexo-mecanismo-e-dataset.md) vai sair.

É por isso que a trilha roda **antes** do arco: quando o 16, o 17 e o 19 chegarem, a pergunta "como isto fica?" já está respondida.

Isto está escrito porque a leitura oposta é fácil e já aconteceu duas vezes. O [`BRIEF`](../../reference/BRIEF-claude-design.md) pediu só a *camada Tailwind* sobre os tokens e nunca mencionou redesenho, então o que voltou da ferramenta foi tratado como *insumo de onde se garimpam ideias*, e cinco dos seis alvos foram descartados. E depois, ao recuperá-los, o alvo foi lido como *lista de features a construir*, o que produziu impasses que não existiam. A [tabela de distância](../../reference/handoff-ds-ago2026/README.md#a-distância-até-o-alvo-item-a-item) aplica a régua item a item.

**O que isso não muda:** o aceite de *zero mudança visual* do DS-1 e do DS-2. Ele não é timidez, é o que torna uma migração de mecanismo auditável — e já se pagou no passo 1 do DS-1, onde pegou o modal de Configurações renderizando em `rect=0,0`, defeito que nenhum nível de teste deste repositório alcança. **O destino é do DS-3**; o que muda no DS-2 é que ele passa a ser escrito **sabendo** o destino, para não investir em componente que o DS-3 vai desmontar.

| # | Entrega | Aceite que o define |
|---|---|---|
| [~~**DS-1**~~](../implemented/DS-1-fundacao-tailwind.md) | ✅ **Fundação** — concluída em ago/2026. Prova de conceito do `@utility` sob electron-vite, instalação, `@theme inline`, `@utility` dos sólidos, `base.css` como `@layer base`, o ramo `.tsx` do `guard.mjs`, e os seis primitivos de `shared/ui/` migrados | **Zero mudança visual — verificado, 0 pixels** |
| **DS-2** | ← **próximo a executar.** **Migração da casca e das features.** `app/` (2 componentes), `conversation` (5), `settings` (2), `open-dataset` (1) e `Versions`; remoção dos CSS Modules migrados — `MarkdownMessage.module.css` fica, por estilizar HTML gerado sem `className`. Escrito **contra a tabela de distância**: onde o DS-3 vai reestruturar, a migração é mínima | **Zero mudança visual** |
| **DS-3** | **A interface chega ao alvo.** Não são ajustes: cabeçalho e rodapé da sidebar, busca por título, agrupamento por data, barra de acento na conversa ativa, título da conversa como cabeçalho, desmonte da toolbar superior, seletor de modelo como pílula dentro do composer, envio circular e pausa, bolha na mensagem do usuário, escala de tipo. Mais os estados de `alvo/` | **A tela muda, e a mudança é a entrega** — medida contra `alvo-chat.png` |

**Por que três e não um.** Os dois primeiros compartilham o aceite mais forte que existe para migração — *se a tela mudou, algo saiu errado* —, verificável em segundos. O DS-3 tem o aceite oposto. Um plano que contém os dois critérios não consegue fechar um passo: a tela diferente deixa de ser sinal.

**DS-2 e DS-3 não estão escritos**, pela regra do próprio arco: um plano nasce quando é o próximo a executar. A tabela acima é o contrato. O poder de veto que o passo 0 do DS-1 tinha sobre os dois **não foi exercido** — os dois riscos caíram, e a forma da solução se manteve.

**O que o DS-1 deixa pronto para o DS-2**, e vale ler antes de escrevê-lo: a régua da guarda 8 do [`guard.mjs`](../../../.claude/hooks/guard.mjs), que reprova cor literal e primitivo alcançado por utilidade; o padrão dos primitivos com variante (combinações em constante fora do JSX, layout inline) e a armadilha que ele resolve — **duas utilidades do mesmo grupo são resolvidas pela ordem na folha gerada, nunca pela ordem no `className`**, então o que uma variante sobrescreve não pode estar no base; e o instrumento de aceite, que é despejo de `getBoundingClientRect` durante o trabalho e diff de pixel uma vez no fim (DS1.7).

---

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
| [**16**](16-anexo-mecanismo-e-dataset.md) | **Anexo: o mecanismo, e o dataset como primeiro consumidor.** O clipe no composer, `userData/attachments/<hash>`, as variantes de `MessagePart`, e o anexo como **job** com progresso e cancelamento. Sobre isso: o `dataset:scan` da [fase 06](../implemented/06-primeira-feature.md) vira cartão no contexto — **nível 1 mais contagem de linhas**, porque o nível 2 é o `SUMMARIZE` do 18. | ✅ escrito. Onde a regra de privacidade vira teste (D16.4). **Um achado ao escrever corrigiu o plano 15:** o medidor conta caracteres e uma parte que não é texto não tem nenhum, então o orçamento passa a medir **o payload**, não a transcrição (D16.5) — a armadilha que o 15 registrou para o 17 arma um plano antes. Copiar o dataset, e não referenciá-lo por caminho, é o que faz o armazenamento chegar ao 17 exercitado (D16.3) |
| **17** | **Anexo: documento e imagem.** Os extratores por tipo (`.txt`/`.md` direto, `.pdf` por `unpdf`, imagem normalizada para PNG), o gate de `vision`, a recusa de PDF escaneado com motivo na tela. ⚠️ **O `/api/ps` em Configurações saiu daqui e já está entregue** (ago/2026, `ai:loaded` e `ai:unload`) — antecipado porque o incômodo era imediato: os cinco minutos de `keep_alive` do Ollama fazem quase toda a frota marcar "não cabe" enquanto nada roda. Entregue **só a metade manual**; o descarregamento automático ao trocar continua **descartado**, não adiado — o provedor carrega no envio e não na seleção, então trocar de conversa não custa nada até alguém enviar, e despejar ali cobraria ~50 s por um olhar. | Que forma tem a pré-visualização de um documento longo na conversa — e onde o aplicativo diz que anexar vai custar ~80 s antes de custar |
| **18** | **Camada de dados.** DuckDB em `utilityProcess`, Arrow, tabela virtualizada — [`study/05-proximos-passos.md`](../../study/05-proximos-passos.md) é o dono. O cartão raso vira perfil real: tipos, nulos, cardinalidade, `SUMMARIZE`. | Dispara o gatilho do `shamefullyHoist`; o endurecimento (`lock_configuration`) nasce aqui, antes de existir SQL gerado |
| **19** | **Propor: consulta e passos.** `core/pipeline/`, o schema zod alimentando `format` e `.parse()`, a união discriminada `query \| steps`, e a verificação pós-execução. | Onde a lista de passos aparece: dentro da mensagem do assistente, ou numa região própria |
| **20** | **Gráfico como artefato.** Um gráfico derivado de um resultado que já está na conversa. | Paleta categórica que funcione nos **dois temas**, com cada cor nascendo com sua linha em `tokens.contrast.test.ts` |

**A ordem não é arbitrária.** 13 não depende de nada; 14 tem no 13 seu consumidor; 16 precisa do composer do 13 e do armazenamento do 14; 17 monta-se inteiro sobre o mecanismo do 16 e sobre o gate de `capabilities` do 15; 19 precisa do perfil do 18 para não repetir a [falha silenciosa](../../HISTORY.md) registrada nas armadilhas; 20 não tem o que plotar antes do 19.

**Duas restrições que atravessam o arco**, decididas cedo porque são caras de retrofitar:

- **`Message` nasce no 13/14 como lista de partes tipadas**, não como `content: string` com anexos pendurados ao lado. `text`, `image`, `document`, `dataset`, `proposal`, `result` — e uma função pura em `core/` traduz a lista para o que cada provedor recebe, no mesmo lugar onde mora a fronteira de privacidade dos três níveis. Uma decisão que serve artefato, anexo de dados **e** visão. Retrofitar isto toca `shared/ipc.ts`, preload, renderer, main e as linhas já gravadas; o **armazenamento**, esse sim, pode começar como JSON numa coluna e virar tabela própria no 19, porque o `PRAGMA user_version` resolve. Ver [`HISTORY.md`](../../HISTORY.md) § *flexibilidade é forma de dado e slot*. **Já cobrada uma vez:** quando documento e imagem entraram no escopo em ago/2026, a estrutura que os recebe estava pronta — nenhum retrofit.
- **A conversa nunca guarda o resultado**, só pergunta, proposta e veredito. Sem isso, o arquivo do SQLite cresce com cada tabela de cada consulta de cada conversa. **O anexo é a exceção, e por um motivo simétrico:** os bytes de um PDF não são rederiváveis (o arquivo original pode ter sido movido ou apagado), então ele é copiado para `userData/attachments/<hash>` e a conversa guarda a referência. Guardar por conteúdo, não por caminho, dá deduplicação de graça e transforma a exclusão de conversa numa pergunta de contagem de referências.

---

## Fora do arco, ainda em `active/`

- [**09 — camada de IA e ML**](09-camada-de-ia.md). Continua sendo o **dono das decisões D9.1–D9.6**. A fatia 1 (chat local) está implementada; as fatias 2 e 4 foram absorvidas pelo arco (planos 19 e 16/18); restam as fatias 3 (nuvem opt-in e segredos), 5 (RAG) e 6 (ML item a item), todas depois do 20. A **fatia 5 ganhou escopo** com a entrada de documento: além de cartões e receitas, indexa documento acima de ~8k tokens e a descrição de imagem produzida no anexo — mas só por essa razão, porque abaixo desse teto indexar **perde** para mandar o documento inteiro ([`HISTORY.md`](../../HISTORY.md) § RAG entra por capacidade).

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

As decisões estruturais viraram skills — carregadas quando o assunto aparece, em vez de ocuparem contexto em toda sessão: [`architecture`](../../../.claude/skills/architecture/SKILL.md), [`design-system`](../../../.claude/skills/design-system/SKILL.md), [`testing`](../../../.claude/skills/testing/SKILL.md) e, desde ago/2026, [`ipc`](../../../.claude/skills/ipc/SKILL.md), separada da primeira quando o vigésimo canal disparou o gatilho do [`ROADMAP § 2`](../../ROADMAP.md).

---

## O que ficou adiado

Cada adiamento tem um **evento** que o reabre, não uma data. A lista consolidada é dona de [`ROADMAP § 2`](../../ROADMAP.md#2-gatilhos-de-revisão) — não se repete aqui, para não envelhecer em dois lugares. Os de maior alcance neste arco: `shamefullyHoist: false` no plano **18**, TanStack Query no 14, `MarkdownMessage` subindo para `shared/ui/` no 16, e o `check:fast` a investigar antes de empilhar mais teste.

A sequência completa até o produto do [`ESCOPO.md`](../../ESCOPO.md) está no [`ROADMAP § 1`](../../ROADMAP.md#1-a-sequência).
