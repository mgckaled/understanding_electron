# 23-D — O painel nasce

> Quarto dos **onze** cortes do **arco 23** (documentação por REST), e o **primeiro visível**. Material de entrada: [`reference/context7/`](../../reference/context7/README.md) — em especial [`painel.md`](../../reference/context7/painel.md), que é o anexo deste corte e dos seguintes, lido inteiro antes de escrever este plano. **Nenhum subcorte:** se este plano crescer demais, ele vira dois irmãos no mesmo nível, nunca um `23-D-1`.

## Contexto

Três cortes entregaram a máquina inteira e **nada na tela**: o [23-A](../implemented/23-A-cliente-context7.md) o cliente REST em `core/context7/`, o [23-B](../implemented/23-B-a-fronteira.md) os dois canais e a chave no cofre, o [23-C](../implemented/23-C-a-parte-e-a-persistencia.md) a parte persistida e o desligar. Hoje o app sabe consultar o Context7, guardar o resultado numa mensagem e mandá-lo ao modelo — e não existe um pixel por onde alguém peça isso.

Este corte abre o caminho pela ponta: o **terceiro inquilino** da região da direita, o gatilho no `+` do composer, e o Estado 1 do `painel.md` — dois campos, o aviso de privacidade e o botão que dispara a busca.

**Por que ele é o caminho crítico.** O guia declara `A → B → D`: `E` (candidatos), `F` (resultado), `G` (seleção) e `H` (a conversa) todos pendem do painel existir. Nenhum deles tem onde nascer antes deste.

## Sondagem — o que a leitura e a medição encontraram

Oito achados, dois deles contra o que se supunha.

| # | Achado | Consequência |
|---|---|---|
| 1 | ⚠️ **O popover do `+` troca a lista inteira pelo detalhe do anexo** quando há arquivo pendente (`AttachButton.tsx:153`) | um item de documentação posto na lista herdaria essa condição e ficaria **inalcançável** com um CSV escolhido — e consulta não é anexo (DM-29). É o achado que mais muda o passo 3 |
| 2 | ⚠️ A mesma condição esconde o grupo **Ferramentas**: com anexo pendente, o interruptor de Raciocínio some da tela | mesmo defeito, mesma forma. O conserto do achado 1 o cobre de graça |
| 3 | `useAsyncAction<T>` (`shared/hooks/`) transforma `Result<T>` em `ViewState<T>`, com `cancelled` já separado de `error` | o estado da busca não precisa de hook novo nem de TanStack Query |
| 4 | `PanelProvider` guarda `widths: Record<PanelKind, number>` | o terceiro valor da união é **cobrado pelo `typecheck`**, não esquecível |
| 5 | `Library` existe no `lucide-react` **1.31.0 instalado** (`library.mjs`, ao lado de `library-big` e `library-square`) | DM-32 é construível hoje. Conferido no pacote, não na documentação |
| 6 | Base REST `https://context7.com/api/v2` (`core/context7/client.ts:16`) confere com o guia oficial vigente | a migração `v1` para `v2` que a busca web achou já está do lado certo — nada a corrigir. O domínio `api.context7.com` deixou de resolver |
| 7 | `security-boundary.spec.ts` afirma a **lista exata** de domínios do `Api` | este corte **não cria canal**, então o spec não é tocado — foi exatamente essa lista que o quebrou duas vezes |
| 8 | `AttachButton.tsx` tem **318 linhas** contra um teto de 400, e já orquestra arquivo e ferramentas | a documentação seria a **terceira** responsabilidade; coesão pesa abaixo do teto |

## Decisões

**D23D.1 — `PanelKind` ganha `'docs'`, sem tecla de atalho.** `b` e `d` já são `artifact` e `draft`; o `painel.md` não pede acelerador para este, e escolher uma terceira letra por simetria é régua sem consequência medida. `onShortcut` continua disponível para quando alguém sentir falta.

**D23D.2 — a composição mora no provider, nunca persistida.** Precedente direto do `ArtifactProvider`: estado de janela, irmão de "sidebar recolhida" (DF3A.5). É o que faz o *retoma* do `painel.md` funcionar — fechar o painel no meio de uma composição não perde o texto. Trocar de conversa **descarta e libera a região**, ajustado durante o render como o `ArtifactProvider` faz, porque a consulta acompanha a próxima mensagem *daquela* conversa.

**D23D.3 — `Documentação` nunca é travada por anexo pendente; os três de arquivo travam.** É a correção que o achado 1 obriga, e a razão é a mesma de DM-23: uma consulta **não é anexo** e não disputa o slot pendente do composer. Com um CSV escolhido, `Dados tabulares`, `Documentos` e `Imagens` ficam desabilitados (o slot está ocupado) e `Documentação` segue clicável. O grupo `Ferramentas` passa a aparecer nos dois estados pela mesma linha de raciocínio — o achado 2 é o achado 1 com outra roupa.

**D23D.4 — o corpo do popover vira `AttachMenu.tsx`.** Não é o teto que decide (o arquivo fica abaixo dele) — é a coesão: o corpo passa a ter três grupos, lógica de travamento própria, e é a parte que cresce a cada pilar novo. Este é o primeiro corte em que uma **segunda feature** entra ali, e divide-se ao tocar.

**D23D.5 — a linha `mcp` com `Switch` desabilitado deixa de existir.** DM-29 até a ponta da interface: capacidade é o que o *modelo* tem, e consultar documentação é ação do usuário. `TOOLS` fica com dois membros. O `ESCOPO.md` renomeia o pilar no **23-J**, não aqui.

**D23D.6 — `Consultar` nasce ligado, com render provisório.** Este corte chama `docs.search` de verdade e desenha o mínimo — `StateView` e uma lista crua de `id` e título, sem ordenação visível, sem seletor de versão, sem seleção. O 23-E substitui esse corpo pela tela desenhada. Botão sem nada atrás é o que o projeto já recusou em `Código` (F2.8), e é o que faz a verificação ao vivo deste corte provar alguma coisa. O memo de sessão (D23B.10) faz a repetição custar **zero** de cota.

**D23D.7 — o estado da busca é `useAsyncAction<SearchOutcome>`, não TanStack Query.** Chamada paga, disparada por ato explícito, sem nada a revalidar nem a manter fresco — o oposto do caso de cache de servidor que justifica a biblioteca. E `no-libraries` viaja **dentro** do `ready` (D23A.3), então quem desenha o "nenhuma biblioteca" é o corpo do painel, nunca o `emptyMessage` do `StateView`.

**D23D.8 — um ícone para o assunto inteiro, em módulo próprio.** `Library`, reexportado de `features/docs/icon.ts`, com dois consumidores já neste corte (o item do popover e o cabeçalho do painel) e mais dois adiante (contador, linha da conversa). O logotipo da Upstash segue descartado (DM-32). ⚠️ A comparação de silhueta contra `NotebookPen` e `Paperclip` a 16px é do **23-J** — jsdom não vê silhueta.

**D23D.9 — o cabeçalho é ícone, "Documentação" e o fechar.** O `histórico` e o `+` do desenho pressupõem consulta **anexada**, que só existe depois do 23-G; renderizá-los agora seria construir dois controles que abrem o vazio. Ausentes, não desabilitados (DF3B.2).

**D23D.10 — o aviso de privacidade é permanente sob o campo.** DM-22 literal: aviso que se aceita uma vez não está na tela no turno em que o vazamento acontece.

## Passos — um commit cada

### 1 · O plano

Este arquivo.

### 2 · O terceiro inquilino

`PanelKind` ganha `'docs'`; `widths` ganha a entrada. Nasce `features/docs/` com `docsContext.ts`, `DocsProvider.tsx`, `icon.ts` e um `DocsPanel.tsx` de cabeçalho e corpo vazio. `App.tsx` compõe o provider e o painel no slot. Nível 2: abre pelo contexto, fecha pelo botão, libera ao trocar de conversa.

### 3 · O gatilho, e o travamento que não é o de sempre

Corpo do popover extraído para `AttachMenu.tsx`; a linha `mcp` sai; o item `Documentação` entra; os três de arquivo passam a desabilitar quando há anexo pendente **em vez de** a lista inteira sumir; `Ferramentas` passa a aparecer nos dois estados. `AttachButton.test.tsx` perde a asserção do `mcp` e ganha as novas.

### 4 · O Estado 1

`DocsCompose.tsx`: campo **Biblioteca**, campo **Pergunta**, a linha *Acompanha a próxima mensagem — não substitui ela.*, o aviso de DM-22, e o rodapé com `nada consultado` e `Consultar` — desabilitado enquanto qualquer um dos dois campos estiver vazio (DM-12 situação 1: a chamada nunca sai).

### 5 · A chamada

`useDocsSearch.ts` sobre `useAsyncAction<SearchOutcome>`; o corpo do painel passa a despachar por `state.status` e, no `ready`, por `data.status` (`found` contra `no-libraries`). Render provisório, marcado no comentário como do 23-E.

### 6 · Verificação ao vivo e fechamento

A verificação ao vivo é do dono do projeto — este passo entrega o roteiro do que olhar, não a execução. Depois: diário, `HISTORY.md`, `DECISOES.md`, errata devolvida ao guia.

## Arquivos

| Arquivo | O quê |
|---|---|
| `src/renderer/src/features/panel/panelContext.ts` e `PanelProvider.tsx` | o terceiro valor e a largura própria |
| `src/renderer/src/features/docs/` | **novo** — `docsContext.ts`, `DocsProvider.tsx`, `DocsPanel.tsx`, `DocsCompose.tsx`, `useDocsSearch.ts`, `icon.ts` |
| `src/renderer/src/features/attachment/AttachButton.tsx` mais `AttachMenu.tsx` | passo 3 |
| `src/renderer/src/App.tsx` | composição do provider e do painel |
| `features/docs/docs.test.tsx` e `features/attachment/AttachButton.test.tsx` | nível 2 |

Reúso, não construção: `SidePanel`, `Popover`, `Button`, `Field`, `StateView`, `useAsyncAction`, `usePanel`, `ICON_SIZE` e `ICON_STROKE`.

## Verificação

**`pnpm check:fast`** ao fim de cada passo; contagem remedida no diário, nunca copiada do 23-C.

**Ao vivo, no passo 6** — o painel é a primeira coisa visível do arco, e jsdom não aplica CSS: largura, resizer, foco ao abrir, densidade e o `Esc` só se provam com a janela na tela.

**Os três vermelhos a provar** (teste que passa com o defeito presente não provou nada):

1. devolver `Documentação` à condição `attachment === null` — o teste que a acha com anexo pendente fica vermelho;
2. desabilitar `Consultar` só pela pergunta vazia — o teste da biblioteca vazia fica vermelho;
3. tirar o `release()` da troca de conversa — o painel sobrevive com a composição da conversa anterior.

**E2E:** nenhum canal novo, então `security-boundary.spec.ts` **não** é tocado. As quatro falhas ambientais herdadas do 23-C seguem com o 23-K.

## Fora do escopo

Lista de candidatos desenhada, ordenação visível, seletor de versão (23-E) · as três abas e o resultado (23-F) · caixas por trecho, total ao vivo, `Anexar` (23-G) · linha na conversa, contador no cabeçalho, `histórico`, `+` (23-H) · os textos dos dez erros (23-I) · livro-razão e minúcias (23-K) · `ESCOPO.md`, silhueta dos ícones, guia antigo consumido (23-J).

## Diário de execução

| Data | O que mudou | Observações |
|---|---|---|
| 08/09/2026 | Plano escrito a partir do guia do arco 23; D23D.1–D23D.10 fixadas | Duas forquilhas resolvidas pelo dono: `Consultar` nasce ligado com render provisório, e o popover deixa de esconder a lista — `Documentação` fica alcançável com anexo pendente, com os três de arquivo travados. **Dois achados contra o suposto:** o popover troca a lista inteira pelo detalhe do anexo (o item novo nasceria inalcançável), e a mesma condição esconde o interruptor de Raciocínio. Base REST e o ícone `Library` conferidos contra fonte externa — nada a corrigir |
