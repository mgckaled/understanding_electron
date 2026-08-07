# 07 — Camadas e o contrato entre processos

O [caderno 01](01-o-que-e-electron.md) mostrou o esqueleto do IPC: o preload abre uma porta, o renderer chama, o main responde. Funciona, e é assim que quase todo tutorial para.

Este documento é sobre o que acontece quando você tenta construir um aplicativo de verdade em cima daquele esqueleto — e descobre três problemas que ele não resolve.

---

## Os três problemas do IPC ingênuo

Recapitulando a forma mais crua, que é o que o gerador de projetos entrega:

```ts
// no renderer
window.electron.ipcRenderer.invoke('db:query', sql)

// no main
ipcMain.handle('db:query', async (event, sql) => { /* ... */ })
```

### Problema 1 — a string está escrita duas vezes

`'db:query'` aparece nos dois lados, e **nada liga uma à outra**. Um erro de digitação num deles produz uma chamada que nunca chega, sem erro de compilação. O sintoma é a promessa que nunca resolve — o pior tipo de falha, porque não há mensagem para pesquisar.

O mesmo vale para o formato dos dados. O renderer pode mandar um número onde o main espera um texto; ninguém verifica.

### Problema 2 — a superfície é larga demais

Se o preload expõe `invoke(canal, args)` genérico, o renderer pode chamar **qualquer canal registrado**. A ponte deixa de ser uma lista de permissões e vira uma porta aberta com um porteiro que não confere nada.

O ponto inteiro do isolamento é estreitar a superfície. Expor um `invoke` genérico devolve a largura que o mecanismo existia para tirar.

### Problema 3 — a exceção não sobrevive à travessia

Este é o mais sutil, e o que mais surpreende.

Se um handler do main lança um erro, o renderer **não recebe aquele erro**. Recebe um `Error` genérico, com a mensagem prefixada por um texto do próprio Electron. A classe se perde, as propriedades customizadas se perdem, a pilha original se perde.

A causa é o mecanismo de serialização que carrega os dados entre processos — ele sabe copiar dados, não instâncias de classe com comportamento. Um erro rico como `QuerySyntaxError { linha: 12, coluna: 4 }` chega ao React como texto inútil, e a interface não tem como reagir de forma útil — não dá para destacar a linha 12 de um texto.

---

## A resposta: um contrato, dois consumidores

A ideia central é simples de enunciar: **declare os canais uma vez, num lugar que os dois lados leem.**

```ts
// src/shared/ipc.ts
export type IpcContract = {
  'app:info': { args: void; result: AppInfo }
  'dataset:scan': { args: { path: string; jobId: string }; result: Result<DatasetSummary> }
}
```

Isso é um mapa: nome do canal, o que entra, o que sai. A partir dele o main tipa seus handlers e o preload tipa suas chamadas. **Nenhum dos dois escreve o nome do canal por conta própria** — os dois derivam do mesmo tipo.

O efeito prático: renomear um canal, mudar o formato dos argumentos ou o do resultado vira **erro de compilação nos dois lados**. O problema 1 desaparece — não por disciplina, por construção.

> 🔍 Repare onde o contrato mora: em `shared/`, a camada que os três processos conhecem. Não é acidente. Um contrato que more no main é um contrato que o renderer copia; e cópia é a origem de toda divergência.

### A superfície é de domínio, não de transporte

O contrato descreve o *fio*. O que o renderer enxerga é outra coisa:

```ts
window.api.app.info()          // sim
window.api.invoke('app:info')  // não
```

O preload traduz de um para o outro, e é o **único** arquivo que conhece as duas formas. Isso lhe dá uma propriedade valiosa: se a interface exposta e o contrato divergirem, a compilação quebra ali, num arquivo só.

O renderer nunca vê nome de canal. Ele vê funções com nome de domínio — o que também significa que uma falha de segurança no renderer só alcança as operações que existem na lista, não todas as que estão registradas.

---

## Erro é dado, não exceção

Aqui está a decisão mais consequente do desenho, e a que mais muda como se escreve o código.

Como exceção não sobrevive à travessia, operações que atravessam a fronteira **não lançam**. Elas devolvem um valor que descreve o desfecho:

```ts
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

E o erro é uma união de casos possíveis, cada um com os dados que a interface precisa para reagir:

```ts
type AppError =
  | { kind: 'not-found'; path: string }
  | { kind: 'permission'; path: string }
  | { kind: 'cancelled' }
  | { kind: 'timeout'; afterMs: number }
  // ...
```

O ganho não é estético. **A interface passa a poder decidir.** "Arquivo não encontrado" merece um botão de escolher outro; "sem permissão" merece uma instrução diferente; "cancelado" não é erro nenhum e não deve pintar nada de vermelho. Com um `Error` genérico, os três viram a mesma mensagem cinza.

### Quando ainda vale lançar

A regra tem um limite deliberado, e ele é tão importante quanto a regra:

| Situação | Convenção |
|---|---|
| Arquivo não existe · usuário cancelou · caminho sem permissão | **`Result`** — é dado de domínio, a interface precisa reagir |
| Argumento fora do formato declarado · defeito no handler | **exceção** — é bug de programação, deve doer |

A distinção é *quem errou*. Se o mundo errou — o arquivo sumiu, o usuário desistiu — isso é informação, e informação viaja como dado. Se **o programa** errou, o comportamento certo é falhar ruidosamente durante o desenvolvimento.

⚠️ Existe um exagero tentador aqui: embrulhar tudo em `Result`, inclusive o que não tem como falhar. Não faça. Um canal que sempre dá certo devolvendo `Result` ensina a equipe a ignorar o `ok` — e a partir daí o `ok` dos canais que *realmente* podem falhar também passa despercebido.

---

## Validação: nos argumentos, nunca na saída

O contrato garante os tipos em **tempo de compilação**. Mas o renderer é o lado não confiável da fronteira: em tempo de execução, o que chega ao main é o que chegou, e tipo não existe mais.

Por isso todo canal valida os argumentos que recebe, contra um esquema declarado junto do contrato. Payload fora do formato lança — é o caso "o programa errou" da tabela acima.

**O caminho inverso não é validado**, e a assimetria é proposital. O main é código próprio, rodando com privilégio. Validar a própria saída é desconfiar de si mesmo, cobrando latência em todo resultado — inclusive nos grandes, que são justamente os que menos podem pagar.

> 🔍 Os tipos e o esquema de validação não são escritos em paralelo — os tipos são **derivados** do esquema. Escrever os dois à mão criaria mais um par capaz de divergir, exatamente o padrão que o [caderno 06](06-a-montanha-de-configuracao.md) descreve.

---

## O efeito colateral que mais paga

Este é o ponto que eu destacaria se pudesse destacar só um do caderno inteiro.

Compare duas formas de escrever a mesma coisa:

```ts
// forma A — o handler é uma função anônima dentro do registro
ipcMain.handle('dataset:scan', async (event, args) => {
  /* toda a lógica aqui dentro */
})

// forma B — o handler é uma função exportada, registrada à parte
export async function scanDataset(args, readLines, emitProgress) { /* ... */ }
```

Na forma A, aquela lógica **só é alcançável subindo o Electron inteiro**. Testá-la exige lançar o aplicativo, abrir uma janela e disparar a mensagem — algo que custa segundos, não milissegundos. Na prática, código escrito assim costuma ficar sem teste nenhum.

Na forma B, `scanDataset` é uma função comum. Um teste a chama diretamente, em Node puro, passando o que quiser nos parâmetros. Milissegundos.

**E isso não era o objetivo.** O contrato tipado foi construído para resolver os três problemas do início. A testabilidade caiu de bônus, porque um registro genérico que liga canal a função *obriga* o handler a ser uma função nomeada. É a melhor espécie de decisão de arquitetura: a que resolve um problema e desbloqueia outro que você nem estava atacando.

Vale lembrar disso quando aparecer a tentação de escrever "só este aqui" como função anônima.

### O detalhe que faz a forma B funcionar

Repare nos parâmetros extras de `scanDataset`: quem lê as linhas e quem emite o progresso **chegam de fora**. O handler não os importa; ele os recebe.

Isso tem nome — **inversão de dependência** — e aqui ela aparece na forma mais simples possível: um parâmetro de função. Sem contêiner, sem framework, sem anotação. O único lugar que conhece as implementações reais é o arquivo que registra tudo, e nenhum teste passa por ele.

⚠️ **E existe uma armadilha específica do Electron aqui.** Não basta o handler *receber* a dependência por parâmetro se o arquivo dele ainda **importa `electron` no topo** — nem mesmo como valor padrão do parâmetro. Fora do binário real, o pacote `electron` não é o objeto que você espera: ele é uma *string* com o caminho do executável. Um teste que nunca toca aquele valor pode quebrar mesmo assim, de forma não determinística, dependendo de qual outro teste rodou antes. A regra que restou: **nenhum handler testável importa `electron` por valor.** O caso completo está no [diário de bordo](04-diario-de-bordo.md).

---

## Por que seis camadas

Com o contrato entendido, a divisão de pastas para de parecer arbitrária. Ela responde a uma pergunta por camada:

| Camada | A pergunta |
|---|---|
| `shared/` | o que os três processos precisam **concordar**? |
| `core/` | o que é lógica que não sabe onde está rodando? |
| `main/` | o que só o processo privilegiado pode fazer? |
| `preload/` | o que exatamente o renderer tem permissão de pedir? |
| `renderer/` | como isso aparece na tela? |
| `workers/` | o que não pode rodar no main sem travar a janela? |

A tabela de quais camadas podem importar quais está no [caderno 03](03-anatomia-do-projeto.md). O que vale repetir aqui é *por que ela é verificada por máquina*: a importação errada mais comum em Electron — o renderer importando `electron` — **passa na verificação de tipos**. O pacote está instalado, os tipos resolvem, tudo parece certo. A falha só aparece em execução, dentro do navegador, com uma mensagem que não menciona nem Electron nem a linha culpada.

Uma regra que o compilador não pega e que produz erro tardio e obscuro é exatamente a que merece virar configuração do analisador.

---

## O que isso custa, honestamente

Tudo acima cobra um preço, e vale dizer qual:

- **Um canal novo toca dois arquivos** antes de você escrever qualquer lógica: a declaração no contrato e o registro.
- **Erro como dado é mais verboso** que exceção. Cada chamada precisa perguntar se deu certo.
- **A superfície de domínio precisa ser mantida** — cada operação nova aparece no preload.

A troca é a mesma que se faz ao adotar um sistema de tipos: mais cerimônia agora, menos investigação depois. A diferença é que aqui o "depois" é particularmente caro — uma promessa que nunca resolve e um erro sem identidade estão entre as coisas mais difíceis de diagnosticar num aplicativo de desktop, justamente porque não deixam rastro.

---

**Anterior:** [06 — A montanha de configuração](06-a-montanha-de-configuracao.md) · **Índice:** [README](README.md) · **Próximo:** [08 — A fronteira de segurança](08-a-fronteira-de-seguranca.md)
