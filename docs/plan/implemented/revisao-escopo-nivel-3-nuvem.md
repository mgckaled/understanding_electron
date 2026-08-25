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
- [x] Mover este arquivo para `docs/plan/implemented/` ao fechar

## Verificação

1. [x] `pnpm check:fast` depois de cada fase — três rodadas verdes, 728/728 testes
2. [x] Grep de varredura final por `nível 3|nível-3|nivel 3|bloquead`, em `docs/` e `src/` juntos — achou **dois arquivos fora da lista original** que a busca inicial (limitada a 4 pontos) não tinha coberto: `docs/reference/models/cloud-optin-free-tier-analysis.md` (Camada 1 do § Risco de segurança, afirmava o bloqueio como regra atual) e `docs/reference/cloud-optin-implementation-guide.md` (§ Peça D inteira, mais o item 4 do resumo do D15.9) — ambos corrigidos. O resto dos 34 arquivos que a busca trouxe são falsos positivos (outro sentido de "nível 3" em `study/09`, "bloqueado" sem relação em `study/04`/`ollama-disqualified.md`) ou registro histórico em `plan/implemented/`/`DECISOES.md`, que não muda por design (repositório ganha de plano arquivado, não o contrário)
3. [ ] Verificação ao vivo (anexar CSV real com Gemini/GLM configurado) — **não executada nesta sessão**: exigiria launch do app + chave de API real, e a regra de nunca ler `.env` já impede confirmar se uma está configurada sem perguntar. Os quatro testes de nível 3 removidos cobriam exatamente este caminho antes da remoção (dois em `messages.test.ts`, dois em `handlers.test.ts`), e os 728 testes restantes incluem a confirmação de que o gate de disponibilidade (`unavailable`) continua funcionando sem GLM/Gemini configurado — cobertura automatizada é forte, mas não é a mesma prova. Fica como verificação pendente para quem tiver a chave à mão

## Diário de execução

| Sessão | Data | O que foi feito |
|---|---|---|
| 1 | 2026-08-25 | Plano executado inteiro numa sessão, três commits (código / docs / registro). Context7 usado duas vezes: confirmar a política de dado do tier grátis do Gemini (`ai.google.dev/gemini-api/docs/pricing`) e nada mais — o resto da mudança é lógica interna. Varredura final achou dois arquivos de referência fora do checklist original (`cloud-optin-free-tier-analysis.md`, `cloud-optin-implementation-guide.md`), corrigidos na mesma sessão. Verificação ao vivo não feita — ver item 3 da Verificação. |
