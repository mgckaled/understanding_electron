# Revisão de escopo (5ª) — nível 3 liberado na nuvem

> Sem letra de trilha, como as revisões anteriores (1ª–4ª, ver [`ROADMAP § 1`](../../ROADMAP.md)) — reverte uma frase específica que o [`ESCOPO.md`](../../ESCOPO.md) declara, não abre uma trilha nova. Decidida em sessão antes do arco **19**, para o 19 já nascer sem essa política pendurada — embora o 19 não dependa dela: `propor: consulta e passos` manda só o esquema ao modelo (D9.4 do [plano 09](09-camada-de-ia.md)), nunca chega perto do nível 3.

## A decisão

**O nível 3 (amostra de linhas) deixa de ser bloqueado em modelos de nuvem.** Documento e imagem, que herdam a regra do nível 3 por construção (não têm "perfil agregado" possível), deixam de ser bloqueados junto. Nuvem passa a ter a mesma política de anexo que local: opt-in por anexo, decisão do usuário no momento do envio — não um segundo gate por trás do primeiro.

**Motivo, nas palavras de quem decidiu:** o usuário já atravessa um opt-in de alto atrito para usar nuvem (gerar e colar uma chave de API). Um segundo bloqueio, específico para os anexos que tornam um modelo maior útil, é paternalismo que o próprio app já rejeitou em outro lugar — é o mesmo modelo de responsabilidade que ChatGPT, Claude e Gemini já usam nos seus próprios apps: **o usuário decide caso a caso o que anexa**, porque só ele sabe se aquele arquivo específico é sensível. Isto não é a alegação mais forte de que dado sensível nunca vai aparecer — o próprio ESCOPO.md (linha 146) trata coluna de CPF como caso real, é por isso que o top-N de baixa cardinalidade existe. É a alegação de que **a escolha de anexar é do usuário, arquivo por arquivo**, igual já é para local, e o app não está em posição de julgar melhor que ele.

## O que NÃO muda

**O gate de `vision` (`hasCapability(model, 'vision')`) continua, nos dois pontos onde vive hoje** (D17.11 do plano 17 já registrava dois pontos, confirmado por grep):

- `Composer.tsx:92` — `hasVision`/`visionBlocked`, impede o **envio** se a imagem já está anexada e o modelo não vê
- `AttachButton.tsx:61` — mesma `hasCapability(model, 'vision')`, no ponto de **anexar**

Nenhum dos dois é gate de privacidade — é recusa a um modo de falha silenciosa: o `gemma3:4b`, pedido para descrever uma imagem que nunca recebeu, inventou um gráfico de barras inteiro com números e produtos, sem hesitação (ESCOPO.md:162). Os dois ficam de fora da revisão — **cuidado ao mexer em `handlers.ts`/`Composer.tsx`/`AttachButton.tsx` para não varrer o gate errado junto**, são vizinhos do que está saindo.

## O que muda — checklist exato, já localizado

Confirmado por grep em ago/2026, antes de escrever este plano — a lista é a superfície real, não uma estimativa:

### Código

- [x] `src/core/ai/messages.ts` — `checkLevel3()` apagada inteira; `AppError` saiu do import (ficou sem outro uso)
- [x] `src/main/features/ai/handlers.ts` — import e as duas linhas de chamada removidos, com o comentário que as antecedia
- [x] `src/core/ai/messages.test.ts` — import e o `describe('checkLevel3', ...)` (4 `it`s) removidos
- [x] `src/main/features/ai/handlers.test.ts` — os dois `it` que afirmavam o bloqueio removidos
- [x] `src/renderer/src/features/conversation/ModelSelector.tsx` — comentário reescrito, não referencia mais função apagada
- [x] `src/renderer/src/features/conversation/modelSelection.test.tsx` — mesmo ajuste
- [x] `src/core/ai/models.ts:33` (achado durante a execução, fora da lista original) — doc-comment de `GEMINI_MODELS` citava a "Peça D tension" pelo nome; trimado

### Documentação — cinco lugares que citavam o mesmo fato, cada um mudou

- [x] `docs/ESCOPO.md` linhas 136-142 — conferido: coluna "Exposição" já era "total", sem nota de bloqueio; sobreviveu sem mudança
- [x] `docs/ESCOPO.md` linha 147 — bullet reescrito: nível 3 opt-in em qualquer provedor, sem distinção
- [x] `docs/ESCOPO.md` linhas 150-154 — frase final reescrita, sem "bloqueado na nuvem"
- [x] `CLAUDE.md` § Segurança — bullet reescrito
- [x] `docs/reference/models/cloud-optin.md` linha 83-85 — "Peça D tension" reescrita como dissolvida; nota do tier grátis preservada e **reconfirmada via Context7** contra `ai.google.dev/gemini-api/docs/pricing` (free tier treina, paid tier não)
- [x] `docs/ESCOPO.md` linha 245 — conferido: a frase só carrega a classificação de exposição, não o bloqueio; sobreviveu sem mudança

### Registro

- [x] `docs/ROADMAP.md` — linha 37 nova, logo após R-5, antes do catch-all
- [x] `docs/HISTORY.md` — entrada adicionada
- [x] `docs/DECISOES.md` — linha nova (seção "Revisão de escopo (5ª)"), marcada como supersedendo `DN1B.6` — achado na rodada de fechamento com o `advisor`: deixar só `DN1B.6` faria alguém buscar "nível 3" ali encontrar uma regra que não existe mais no código
- [x] Mover este arquivo para `docs/plan/implemented/` ao fechar

## Verificação

1. [x] `pnpm check:fast` depois de cada fase — quatro rodadas verdes, 729/729 testes (728 + 1 teste novo, ver item 4)
2. [x] Grep de varredura final por `nível 3|nível-3|nivel 3|bloquead`, em `docs/` e `src/` juntos — achou **dois arquivos fora da lista original** que a busca inicial (limitada a 4 pontos) não tinha coberto: `docs/reference/models/cloud-optin-free-tier-analysis.md` (Camada 1 do § Risco de segurança, afirmava o bloqueio como regra atual) e `docs/reference/cloud-optin-implementation-guide.md` (§ Peça D inteira, mais o item 4 do resumo do D15.9) — ambos corrigidos. O resto dos 34 arquivos que a busca trouxe são falsos positivos (outro sentido de "nível 3" em `study/09`, "bloqueado" sem relação em `study/04`/`ollama-disqualified.md`) ou registro histórico em `plan/implemented/`, que não muda por design (repositório ganha de plano arquivado, não o contrário)
3. [x] Verificação ao vivo — feita pelo usuário, não nesta sessão de agente (a regra de nunca ler `.env` impedia rodar isto aqui). Dado tabular e documento: perfeitos nos dois provedores. Imagem: Gemini negava ter recebido qualquer anexo, em qualquer formato — bug real, não falso negativo do usuário. Causa e correção no item 5
4. [x] Rodada de fechamento com o `advisor` (Opus) achou dois furos reais, ambos corrigidos na mesma sessão: (a) `DECISOES.md` sem linha nova, coberto acima; (b) `handlers.test.ts` tinha zero teste do caminho **positivo** — imagem chegando a `chatFn` num serviço de nuvem — porque os dois testes com `parts` de imagem que existiam eram os que `checkLevel3` bloqueava, agora apagados. Teste novo adicionado (`resolves an image part on a cloud service too`), espelhando o equivalente `ollama` já existente
5. [x] Bug real achado pelo usuário no item 3, corrigido na mesma sessão: `toGeminiContents()` em `providers/gemini.ts` nunca lia `ChatMessage.images` — defeito de N-1-C, latente desde então, só observável agora que `checkLevel3` não recusa mais a imagem antes do adaptador ser alcançado. `partsOf()` novo monta `inlineData` com mimeType sniffado dos bytes (ESCOPO.md garante só PNG/JPEG chegam aqui), confirmado via Context7 contra `ai.google.dev/gemini-api/docs/image-understanding`. Dois testes novos em `gemini.test.ts` (PNG e JPEG)

## Diário de execução

| Sessão | Data | O que foi feito |
|---|---|---|
| 1 | 2026-08-25 | Plano executado inteiro numa sessão, quatro commits (código / docs / registro / correções do `advisor`). Context7 usado duas vezes: confirmar a política de dado do tier grátis do Gemini (`ai.google.dev/gemini-api/docs/pricing`) e nada mais — o resto da mudança é lógica interna. Varredura final achou dois arquivos de referência fora do checklist original (`cloud-optin-free-tier-analysis.md`, `cloud-optin-implementation-guide.md`), corrigidos na mesma sessão. `advisor` (Opus) chamado ao fim: achou a lacuna do `DECISOES.md` e a falta de teste do caminho positivo em nuvem — os dois corrigidos antes de fechar. |
| 2 | 2026-08-25 | Verificação ao vivo, feita pelo usuário: dado tabular e documento perfeitos nos dois provedores; imagem no Gemini, quebrada — negava ter recebido qualquer anexo. Causa: `toGeminiContents()` nunca lia `ChatMessage.images`, defeito de N-1-C exposto só agora que `checkLevel3` não bloqueia mais antes do adaptador. Corrigido no mesmo dia (`partsOf()` + sniff de mimeType, Context7 confirmando o formato `inlineData`), quinto commit. |
