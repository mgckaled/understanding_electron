---
name: comments
description: Convenção de comentário e docstring do crivo — as duas perguntas em ordem (comentar? e, se for docstring, em que forma?), o veto à narrativa de decisão dentro do .ts (que tem dono no HISTORY.md, citada por id) reafirmado sobre a regra de ~3 linhas, e a forma TSDoc para o doc-comment que sobra: /** */ com sumário em terceira pessoa, @param nome - descrição e @returns (com s, sem tipo entre chaves porque o TS já tipa), só tags Core, @remarks/@example desencorajados porque convidam de volta a narrativa banida, {@link} para referência cruzada, e o bloco acima do símbolo em vez de /** */ no meio da assinatura. Cobre também o que NÃO ganha docstring, o veto a blocos /* */ de narrativa, e o idioma inglês na docstring. Use ao escrever ou editar qualquer código, adicionar um comentário, documentar uma função exportada, um handler, um tipo do contrato ou um hook, ou decidir se um símbolo precisa de doc-comment.
---

# Comentário e docstring — crivo

> Dona única da convenção de comentário. A regra de **quando** comentar nasceu em ago/2026 (§ *Três defeitos do plano 15*); a forma **TSDoc** foi adotada depois, quando o fonte acumulou narrativa de decisão dentro do `.ts`. O porquê de cada uma mora no [`HISTORY.md`](../../../docs/HISTORY.md); aqui fica a regra aplicável. O [`CLAUDE.md`](../../../CLAUDE.md) traz só a essência e aponta para cá.

## Duas perguntas, nesta ordem

Ao tocar uma linha de comentário, decida em duas etapas. A primeira já elimina a maior parte do que hoje inunda o fonte; a segunda só se aplica ao que sobrou.

### 1. Comentar? — vale para `//` e para `/** */`

**O comentário diz o que o código não consegue dizer, em até ~3 linhas.** Restrição externa que o próximo leitor violaria sem saber (`capabilities` vem do `/api/show` porque o `/api/tags` omite `vision`), número medido, armadilha diagnosticada — isso fica. **Nome bom vence docstring:** um `selectableModels` bem nomeado não pede comentário.

**O que NÃO entra, porque tem dono e o dono não é o `.ts`:** narrativa do que mudou, alternativa tentada e descartada, razão longa. Isso mora no [`HISTORY.md`](../../../docs/HISTORY.md) (ou no plano), e o fonte **aponta pela sigla da decisão** — `(D15.2)`, não o parágrafo. Um comentário longo dentro do `.ts` é a mesma dívida da regra de fonte única, agravada por envelhecer onde ninguém releva.

⚠️ **Bloco `/* */` de narrativa é o sintoma número um.** O de 14 linhas no topo de `conversationsContext.ts` e os de 6 linhas em `useConversationChat.ts` são exatamente o que sai: cada um é um ensaio de decisão que pertence ao `HISTORY.md`. Substitua pela sigla.

### 2. Se sobrou um doc-comment, qual forma? — TSDoc

O que sobrevive à pergunta 1 e documenta **superfície de API** (função exportada, handler, tipo do contrato, hook) nasce em TSDoc:

```ts
/**
 * Sends the trimmed prompt to the active conversation, streaming the reply.
 *
 * @param model - `null` when no model is installed (D15.2); caller must guard.
 * @param numCtx - Context window this conversation reserves; undefined lets the
 *   provider decide.
 * @returns The finished turn, or a stopped partial when interrupted (D14.3).
 */
```

Regras da forma, cada uma um erro que o parser oficial marca:

- **`/** */`**, nunca `/* */`, para doc-comment. Sumário numa linha, em **terceira pessoa** (`Sends…`, não `Send…`).
- **`@param nome - descrição`** — o hífen é obrigatório. **`@returns`** com o `s` (não `@return`).
- **Sem tipo entre chaves** (`@param {string} name`): o TypeScript já tipa; repetir é ruído que envelhece.
- **Só tags Core.** `@remarks` e `@example` são justamente o convite de volta à narrativa banida na pergunta 1 — **não use**; razão longa vai ao `HISTORY.md`, citada por id. `{@link outra}` para referência cruzada.
- **O bloco vai ACIMA do símbolo**, não `/** */` no meio da assinatura, um por parâmetro — corrija esse padrão ao tocar (`useConversationChat` o tem hoje).

## O que NÃO ganha docstring

Local de função, getter óbvio, componente cujo nome e props já dizem tudo, teste. Docstring em símbolo óbvio é a mesma inundação por outro caractere. Uma linha só (`/** Stable identity, so an empty list does not re-run every downstream memo. */`) é doc-comment TSDoc válido e muitas vezes o certo — sumário sem tag.

## A reconciliação, para não reverter ago/2026

TSDoc é a **gramática** do doc-comment; o veto à narrativa é o **conteúdo**. Os dois não brigam: `@param model - null when no model is installed (D15.2)` diz o **contrato mecânico** e aponta a decisão pela sigla — não reescreve o ensaio da D15.2. Aplicar TSDoc **não** é abrir espaço para `@remarks` de 20 linhas; é dar forma padrão ao pouco que sobra.

## Idioma

Docstring e comentário em **inglês**, sem exceção — é a regra de idioma do projeto (skill [`architecture`](../architecture/SKILL.md)) aplicada ao doc-comment. Português fica no texto visível ao usuário e na documentação.

## Alcance: divide-se ao tocar

Vale **no que você tocar** — arquivo editado sai no padrão. **Não varra a base** atrás de comentário fora de forma; é o mesmo princípio da régua de tamanho. A limpeza retroativa, se um dia valer a pena, é um plano próprio.
