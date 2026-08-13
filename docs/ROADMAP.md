# Roadmap — crivo

O que ainda falta. Documento **vivo**: item concluído sai daqui e vira entrada em [`HISTORY.md`](HISTORY.md); item que ganha plano próprio sai daqui e vira arquivo em [`plan/active/`](plan/active/).

> **Fonte única de pendência.** O `CLAUDE.md`, os planos e as skills apontam para cá — não mantêm listas paralelas do que falta.

---

## 1. A sequência

O caminho macro, do estado atual até o produto do [`ESCOPO.md`](ESCOPO.md):

```
   fundação — 8 fases                plan/implemented/                concluída (ago/2026)
   cor e markdown                    plan/implemented/10, 11          concluída (ago/2026)
   0  revisão de escopo              ESCOPO.md · HISTORY.md           concluída (ago/2026)
   12 realce de sintaxe              plan/implemented/12-...          concluída (ago/2026)
   13 casca conversacional           plan/implemented/13-...          concluída (ago/2026)
   0  revisão de escopo: documento    ESCOPO.md · HISTORY.md           concluída (ago/2026)
   14 persistência das conversas      plan/implemented/14-...          concluída (ago/2026)
   15 orçamento de contexto e modelo   plan/implemented/15-...          concluída (ago/2026)
   ── trilha DS, transversal ao arco ──────────────────────────────────────────────
   DS-1 fundação Tailwind v4          plan/implemented/DS-1-...        concluída (ago/2026)
▶  DS-2 migração da casca e features   plan/active/DS-2-...             ← estamos aqui (escrito)
   DS-3 ajustes do composer e da casca
   ── trilha R (refatoração), transversal ─────────────────────────────────────────
   R-1 comentários e TSDoc            plan/active/R-1-...              escrito
   ── o arco, retomado depois da DS-3 ─────────────────────────────────────────────
   16 anexo: mecanismo + dataset        plan/active/16-...               escrito, não iniciado
   17 anexo: documento e imagem
   18 camada de dados (DuckDB)       study/05-proximos-passos.md
   19 propor: consulta e passos
   20 gráfico como artefato
   ── depois do arco ──────────────────────────────────────────────────────────────
   receitas salvas · JSON/NDJSON · Excel · catálogo camada 2
   observatório                      ← ver abaixo
   nuvem, RAG e ML                   plan/active/09-camada-de-ia.md   fatias 3, 5 e 6
```

**A trilha DS entrou em ago/2026 e roda antes do 16**, com numeração própria em vez de inserida no arco — o porquê, e o custo medido de renumerar um plano já escrito, são de [`plan/active/README.md`](plan/active/README.md#a-trilha-de-design-system-ds-n). Executa primeiro por um motivo de custo: cada tela nova encarece a migração, e o 16 traz o clipe, a pré-visualização de anexo e o cartão de dados.

**A trilha R (refatoração) entrou em ago/2026**, também com numeração própria e transversal ao arco: aplica um padrão já decidido ao código que o precede, sem tocar comportamento. O [`R-1`](plan/active/R-1-comentarios-e-tsdoc.md) leva a skill [`comments`](../.claude/skills/comments/SKILL.md) ao `src/` inteiro e fecha, com um guard, o pior sintoma de reincidência.

**O arco ganhou um plano em ago/2026**, com a [entrada de escopo de documento e imagem](HISTORY.md). O 16 passa a construir o **mecanismo** de anexo de forma genérica — o clipe no composer, `userData/attachments/<hash>`, as variantes de `MessagePart` — e o dataset é só o seu primeiro consumidor; o 17 acrescenta os extratores de documento e imagem sobre esse mesmo mecanismo. A ordem importa por um motivo concreto: mecanismo de anexo desenhado sabendo que só existe dataset nasce com forma de dataset, e o 17 o reescreveria.

**Observatório** — ideia portada do mill.tools, sem portar o que ele observa. Um lugar onde o app **se observa**: read-only, local, com um canto que roda avaliação. O que faz valer aqui é a [falha silenciosa](HISTORY.md) do SQL gerado — a verificação pós-execução avisa caso a caso, mas só uma taxa (*"8 de 30 propostas produziram coluna inteiramente nula"*) diz se o cartão de dados e o prompt estão funcionando. Junto dela, o que este projeto já sabe que precisa medir: tokens/s de prefill contra geração por modelo, e o que o SQLite e os anexos ocupam em `userData`. Entra depois do plano 19, que é quem produz o que há para observar — **exceto o primeiro medidor, que se antecipa por necessidade**: o que o `/api/ps` reporta (modelo residente, tamanho, tempo até descarregar) entra em Configurações no plano 17, porque anexo de imagem torna a gerência de modelo carregado um problema de RAM, não de curiosidade.

Cada etapa depende da anterior por razão real, não por ordem arbitrária. As dependências estão nos documentos linkados, e o arco 13–20 tem índice próprio em [`plan/active/README.md`](plan/active/README.md).

**A sequência foi refeita pela [virada de ago/2026](HISTORY.md)**, que tornou o chat a porta de entrada do aplicativo. Duas consequências que não se leem no diagrama:

- **A camada de IA deixou de ser a última etapa e virou a interface.** O [plano 09](plan/active/09-camada-de-ia.md) segue vivo, mas suas fatias foram absorvidas pelo arco: a fatia 2 (NL→passo) é o plano 19, agora com um segundo verbo ao lado; a fatia 4 (cartão de dados) se divide entre os planos 16 e 18. Só as fatias 3 (nuvem), 5 (RAG) e 6 (ML) continuam no fim da fila — a **5 ganhou escopo** com a entrada de documento: além de cartões e receitas, ela indexa documento grande e a descrição de imagem, pelos motivos da [decisão sobre RAG](HISTORY.md). O documento continua sendo o dono das decisões D9.1–D9.6.
- **A ordem antiga colocava a camada de dados antes de tudo; agora ela vem no meio.** Não é adiamento gratuito: os planos 13–17 constroem a casca, a persistência e o anexo, e o anexo já produz um cartão útil com o `dataset:scan` que a [fase 06](plan/implemented/06-primeira-feature.md) entregou. O DuckDB entra para transformar esse cartão raso em perfil real — e chega com consumidor pronto, em vez de esperar por um.

---

## 2. Gatilhos de revisão

Decisões tomadas com um prazo de validade conhecido. Cada uma tem um **evento** que a reabre — não uma data, porque data não observa nada.

| Quando acontecer | Revisitar | Registrado em |
|---|---|---|
| DuckDB instalado e carregando | `shamefullyHoist: false` no `pnpm-workspace.yaml` | [`03-sandbox`](plan/implemented/03-sandbox-e-seguranca.md) |
| ~~Primeira query reexecutada sobre o mesmo dataset~~ · ~~data marcada: plano 14~~ **fechado** — adotado em ago/2026 (`@tanstack/react-query` 5.101.4), e a promessa se cumpriu: três hooks tocados, **zero componentes**. O que a fez se cumprir está no [`HISTORY`](HISTORY.md) § *um hook público sobrevive à troca de fonte* | ~~Adotar TanStack Query para o **cache de servidor**~~ | [`14-persistencia`](plan/implemented/14-persistencia-das-conversas.md) |
| Busca em texto completo sobre todo o histórico (FTS5) — **disponibilidade confirmada** no binário do Electron 42.8.0 (SQLite 3.53.1), então o gatilho é só de "quando", não mais de "se dá" | Tirar o SQLite síncrono do main — até lá, listar e inserir são operações indexadas de microssegundos | [`HISTORY`](HISTORY.md) § Decisão: persistência em `node:sqlite` |
| ~~Máquina com GPU ou RAM que comporte um modelo com `tools` folgado~~ **disparado em ago/2026, por um caminho que ninguém previu** — não foi a máquina que cresceu, foi a frota: o `qwen2.5-coder:3b` declara `tools`, ocupa 1,9 GB e cabe com folga nos ~6 GB livres. O gatilho supunha que "modelo com `tools`" implicava 7B; um 3B especializado desfaz a suposição. **Reavaliar continua valendo**, agora por mérito e não por RAM: a saída estruturada validada da D9.4 funciona com qualquer modelo, e a pergunta passa a ser se *tool calling* entrega algo que ela não entrega | Reavaliar *tool calling* | [`HISTORY`](HISTORY.md) § A virada |
| **Máquina com GPU para inferência** | Os ~80 s de prefill por imagem caem para segundos, e todo o desenho de "anexar é um job com progresso e cancelamento" fica superdimensionado. A recusa a OCR e o teto de ~8k tokens por documento também foram medidos **nesta** CPU — os três se reabrem juntos | [`HISTORY`](HISTORY.md) § o anexo custa ~80 s |
| **Existir modelo local com `vision` e `tools` ao mesmo tempo** | Continua não existindo na máquina, e a frota de ago/2026 **reforçou** a separação em vez de fechá-la: o único com `vision` segue sendo o `gemma3:4b`, enquanto os modelos com `tools` passaram de dois para **quatro** (`qwen2.5:7b`, `phi4-mini`, `qwen2.5-coder:7b`, `qwen2.5-coder:3b`) e **nenhum enxerga**. Enquanto for assim, anexar imagem e usar ferramentas são caminhos mutuamente exclusivos, e o gate de capacidade precisa dizer isso. ⚠️ O `gemini-2.5-flash` da fatia 3 do [plano 09](plan/active/09-camada-de-ia.md) fecharia o gatilho — e é nuvem, onde o [`ESCOPO`](ESCOPO.md) bloqueia imagem por ser nível 3. A tensão está registrada na D15.9 do [`plano 15`](plan/implemented/15-orcamento-de-contexto-e-modelo.md) | [`ESCOPO`](ESCOPO.md) § gate de capacidade |
| **O Ollama passar a aceitar WebP em container VP8X** | Some a conversão para PNG no caminho do WebP. A rasterização de SVG **continua** necessária de qualquer forma — é outro motivo, não o mesmo | [`HISTORY`](HISTORY.md) § três formatos de imagem |
| **Um documento anexado passar de ~8k tokens** | RAG deixa de ser desperdício e vira a única opção — é a fatia 5 do [plano 09](plan/active/09-camada-de-ia.md), não um mecanismo novo. Abaixo desse teto, indexar **perde** para mandar o documento inteiro | [`HISTORY`](HISTORY.md) § RAG entra por capacidade |
| **Um teto de contexto exibido não corresponder à máquina** — ou o anexo tornar a troca de modelo frequente o bastante para o ↻ virar rotina. ⚠️ **A trava da D15.13 puxou este gatilho para mais perto**, por um caminho que ele não previa: a conversa cuja janela travada deixou de caber (`unaffordable`) só volta a funcionar liberando memória, e o ↻ é o **único** jeito de o aplicativo perceber que ela foi liberada | Observar a RAM livre em vez de fotografá-la: hoje ela é lida duas vezes, ao montar a tela e ao clicar ↻, com `staleTime` infinito para o teto não se mexer sob o cursor. O argumento vale para o campo **focado** e não para o resto do tempo, e o custo é uma dica que o app não honra (*"feche aplicativos e recarregue"*). Forma proposta: congelar com o controle focado, reler fora disso | [`16-anexo`](plan/active/16-anexo-mecanismo-e-dataset.md) § F16.1 |
| **A margem de RAM precisar de um terceiro valor** | `RAM_MARGIN_BYTES` vira configuração, ao lado do `num_thread`, na tabela `app_settings` que é chave-valor para isto. É a **única** constante do orçamento que não foi medida — o `1,06` e os `0,33 GiB` saíram do `ollama ps`, os pesos do `/api/tags`, e ela é juízo, já errado duas vezes na mesma direção (D15.10). Duas correções são conserto; três são um parâmetro querendo sair do código. Precisa da consequência ao lado (*"com esta margem, dois dos seis modelos deixam de caber"*), o que é uma tela, não um campo | [`16-anexo`](plan/active/16-anexo-mecanismo-e-dataset.md) § F16.2 |
| Segunda janela do app | Progresso endereçado ao remetente, em vez de transmitido a todas | [`06-primeira-feature`](plan/implemented/06-primeira-feature.md) |
| Sexta fatia em `features/` | `eslint-plugin-boundaries` no lugar do `no-restricted-imports` | [`01-camadas`](plan/implemented/01-camadas-e-fronteiras.md) |
| ~~Vigésimo canal em `shared/ipc.ts`~~ · ~~Skill própria para IPC~~ **disparado e cumprido em ago/2026** — `ai:loaded` e `ai:unload` levaram a conta a exatamente 20, e a skill [`ipc`](../.claude/skills/ipc/SKILL.md) nasceu na mesma sessão. Escrevê-la pagou por si além do gatilho: reunir o assunto num lugar só expôs que o `CLAUDE.md` ainda prometia `ArrayBuffer` **transferível**, três meses depois de o [`HISTORY`](HISTORY.md) registrar que não existe transferência de posse entre processos. **O próximo limiar fica deliberadamente não declarado** — escolher outro número por reflexo repetiria o erro de fixar régua sem consequência medida. O que de fato reabre o desenho é payload binário, no plano 16 | — | [`08-automacao`](plan/implemented/08-automacao-e-registro.md) |
| Design system estável. ⚠️ **A adoção do Tailwind v4 (ago/2026) aproxima este gatilho em vez de afastá-lo:** utilidade compila para CSS estático, e `@theme inline`/`@utility` não emitem `style=""` — o mesmo critério que recusou o `shiki` na fase 12. O que ainda segura o `'unsafe-inline'` é o `<style>` que o Vite injeta em desenvolvimento, não o app empacotado; medir os dois separadamente é o próximo passo | Endurecer a CSP (hoje permite `style-src 'unsafe-inline'`) | [`03-sandbox`](plan/implemented/03-sandbox-e-seguranca.md) |
| ~~`check:fast` passar de 10s~~ **disparado** — 21,5s (ago/2026) e **27s** medido na fase 08, agora que roda a cada resposta no `Stop` hook, bem acima da meta de 15s da skill `testing`. A fase 13 remediu com 24 arquivos e 172 testes: **16 a 23s**, variando com o cache do Vite, e a maior fatia é `environment` (a subida do jsdom por arquivo), não os testes — 9,4s dos ~16s. Isso muda o alvo da investigação: o custo é de ambiente, não de asserção | Medir a duração do ciclo de retorno | [`08-automacao`](plan/implemented/08-automacao-e-registro.md) |
| Um spec de nível 4 precisar verificar **cor** | O Playwright emula `prefers-color-scheme` e o padrão dele é `'light'`, então nenhum e2e de hoje exercita o tema escuro. Use `page.emulateMedia({ colorScheme })` — `nativeTheme.themeSource` não chega ao renderer sob teste | [`HISTORY`](HISTORY.md) § armadilhas |
| Existirem cartões de dados suficientes | RAG sobre cartões e receitas | [`09-camada-de-ia`](plan/active/09-camada-de-ia.md) |
| ~~Fatia 2 do `09` (NL→passo) gerando SQL para revisão~~ **disparado por antecipação e resolvido** — a [fase 12](plan/implemented/12-realce-de-sintaxe.md) andou antes porque a paleta é **importada** e medida, não inventada; o gatilho protegia contra escolher cor por gosto, e o teste de contraste protege melhor | Realce de sintaxe: calibrar `--syntax-*` e ligá-la no bloco de código | [`10-cor`](plan/implemented/10-cor-contraste-e-tema-claro.md) · [`11-markdown`](plan/implemented/11-markdown-na-resposta-do-assistente.md) |
| ~~Segundo consumidor de markdown fora de `features/conversation/`~~ (a fatia chamava-se `ai-chat` quando o gatilho foi escrito) — **data marcada: plano 16**, o cartão de dados é o segundo consumidor, e o **17 traz o terceiro** (documento `.md` anexado renderiza como markdown) | Subir `MarkdownMessage` + a tipografia de bloco para `shared/ui/` (D11.1) | [`11-markdown`](plan/implemented/11-markdown-na-resposta-do-assistente.md) |

---

## 3. Atualizações de versão

Movidas do `CLAUDE.md` por serem pendência, não configuração. As versões **em uso** continuam lá.

### Electron 42 → 43 — bump agendado, não reativo
O Electron 43 já saiu. A política do projeto é manter as 3 majors mais recentes suportadas, então o 42 segue coberto — mas o ciclo é de 8 semanas e é o Chromium embutido que carrega as CVEs. **Precisa ser tarefa agendada.** Ao subir, reconferir o `@types/node` contra `process.versions.node` — e, a partir do plano 14, também a API do `node:sqlite`: ela está em estabilidade **1.2 (release candidate)** desde o Node 24.15.0, o que significa API que ainda pode mudar entre majors do runtime. Verificação de um comando, com o probe registrado na [decisão de persistência](HISTORY.md).

### Vite 7 → 8 — bloqueado por compatibilidade declarada
O Vite 8 (bundler Rolldown, em Rust) é estável desde mar/2026, mas o electron-vite 5.0.0 é da mesma época e não declara suporte. Ficamos no 7 conscientemente. Plano B mapeado: o `vite-plugin-electron` declara suporte a 7 e 8.

### TypeScript 5.9 → 6 — exercício isolado
O TS 6 é release de transição com remoções reais: `moduleResolution: "node"`, `baseUrl`, target ES5, módulos `amd`/`umd`/`systemjs`. Um ponto de quebra já foi **eliminado por antecipação**: a [fase 01](plan/implemented/01-camadas-e-fronteiras.md) remove o `baseUrl` do `tsconfig.web.json`, já que `paths` funciona sem ele desde o TS 4.1. Fazer com `tsc --ts6-migration` gerando o relatório, como tarefa própria — nunca junto de outra mudança.

---

## 4. Pendências pontuais

### Perfil do VS Code
A extensão do Python continua ativa e carregando neste workspace. O `python.analysis.exclude` silencia os avisos do node-gyp, mas não impede o carregamento. Um perfil contendo só ESLint, Prettier e EditorConfig resolveria de verdade. Perfil é configuração de máquina — não viaja no repositório.

### `publish` placeholder no `electron-builder.yml`
Aponta para `https://example.com/auto-updates`, herdado do template. Fica como está até existir distribuição real. Não quebra nada; é ruído que confunde quem ler o arquivo.

### Assinatura de código e notarização
Só faz sentido com distribuição. Registrado para não ser confundido com esquecimento.

### `dist/win-unpacked` travado por um handle do sistema
Durante a auditoria de ago/2026, `electron-builder` passou a falhar com `EBUSY: resource busy or locked` ao substituir `dist/win-unpacked/resources/app.asar`, e `rm -rf` falha no mesmo arquivo. Nenhum processo `node`, `pnpm` ou `crivo` estava em execução — o handle é do sistema, e o suspeito é a proteção em tempo real do Defender (`Get-MpComputerStatus` confirma ativa; conferir as exclusões exige terminal como administrador, que não foi usado). Contorno que funcionou: empacotar noutro destino com `electron-builder --dir -c.directories.output=<dir>`. Reiniciar a máquina libera o handle. **Se voltar a acontecer, reconferir as exclusões do Defender do [`CLAUDE.md`](../CLAUDE.md) — elas não viajam com o repositório e podem ter se perdido.**

---

## 5. Fora de escopo

Não são pendências. Estão em [`ESCOPO.md`](ESCOPO.md) com justificativa: visualização e BI, edição célula a célula, banco de dados remoto, execução agendada sem interface, colaboração multiusuário, versionamento de dados, PDF escaneado e OCR, `.docx`/`.pptx`, edição ou exportação de documento, e índice vetorial de imagens.
