# 09 — Testar um app de três processos

A pirâmide de testes que se ensina em todo lugar tem três andares: muitos testes de unidade, alguns de integração, poucos de ponta a ponta. É um bom modelo e ele é **insuficiente** para Electron — porque esconde a pergunta que mais importa aqui:

> Este teste roda em qual dos três processos? E em qual deles o defeito que estou caçando aparece?

Este documento mapeia os cinco andares que um aplicativo Electron realmente tem, o que cada um alcança, e o que só se descobre no último.

---

## Os cinco níveis

| Nível | O que testa | Onde roda | Custo |
|---|---|---|---|
| 1 | lógica pura | Node, sem nada em volta | milissegundos |
| 2 | componentes de interface | navegador simulado | milissegundos |
| 3 | handlers do main | Node, **sem Electron** | milissegundos |
| 4 | aplicativo em desenvolvimento | Electron de verdade | dezenas de segundos |
| 5 | aplicativo **empacotado** | o instalador gerado | minutos |

A separação que decide tudo está entre 3 e 4. Os três primeiros cabem no ciclo de edição — você salva, eles rodam, você continua. Os dois últimos precisam subir o aplicativo, e o custo os tira desse ciclo.

Confundir isso tem uma consequência previsível: se o retorno demora demais, as pessoas param de esperar por ele. Um conjunto de testes que ninguém roda antes de commitar não é rede de proteção, é decoração.

---

## O nível 3 é o que quase ninguém tem

Aqui está a parte específica de Electron que vale levar para outros projetos.

A forma natural de escrever um handler é como função anônima dentro do registro:

```ts
ipcMain.handle('dataset:scan', async (event, args) => {
  /* toda a lógica aqui */
})
```

Aquela lógica **só existe dentro do Electron**. Para testá-la você precisa lançar o aplicativo — nível 4, cem vezes mais lento. Na prática, código escrito assim nasce sem teste e continua sem.

Escrito como função exportada e registrada à parte, o mesmo handler é chamável em Node puro:

```ts
const result = await scanDataset({ path, jobId }, fakeLines, spy)
```

Sem janela, sem processo, sem simulação de Electron. Milissegundos.

**O que torna isso possível é o desenho descrito no [caderno 07](07-camadas-e-contrato.md)** — e vale repetir que a testabilidade não era o objetivo declarado dele. Ela caiu de bônus. É a melhor espécie de decisão arquitetural.

### A armadilha que quase anula o nível 3

⚠️ Não basta o handler receber as dependências por parâmetro. Se o arquivo dele **importa `electron` no topo**, o teste pode quebrar mesmo sem tocar naquele valor.

O motivo é surpreendente: fora do binário real, o pacote `electron` não é o objeto com as APIs. Ele é uma **string** — o caminho do executável. O empacotador de testes processa esse import de qualquer forma, e o resultado é um erro de sintaxe de módulo que aparece de forma **não determinística**: o teste passa sozinho e quebra quando roda junto com outro que também importa `electron`, dependendo do cache.

A regra que restou: **nenhum handler testável importa `electron` por valor** — nem como valor padrão de parâmetro. O parâmetro fica obrigatório, e só o arquivo que registra tudo, que nenhum teste alcança, importa a coisa real.

---

## O nível 2 e o problema da ponte falsa

Testar componentes de interface exige um `window.api` que não existe fora do Electron. A saída óbvia é escrever um objeto falso.

O risco também é óbvio: **o objeto falso envelhece**. O contrato ganha uma operação, o falso não, e o teste continua passando alegremente contra uma versão da API que já não existe. A divergência aparece meses depois, em produção, como "isso não é uma função".

A defesa é derivar o falso do próprio tipo do contrato, declarando que ele deve satisfazê-lo:

```ts
const api = {
  app: { info: vi.fn() },
  shell: { openExternal: vi.fn() }
} satisfies Api
```

O ponto inteiro está nessa última palavra. Quando o contrato ganha um método, **o objeto falso para de compilar** — na verificação de tipos, no mesmo segundo que o resto. A divergência vira erro imediato em vez de surpresa tardia.

> 🔍 É o mesmo princípio do [caderno 06](06-a-montanha-de-configuracao.md): quando um valor precisa existir em dois lugares, faça um derivar do outro. O que não dá para eliminar, dá para amarrar.

---

## Níveis 4 e 5: dirigindo o aplicativo de verdade

Aqui uma ferramenta de automação de navegador lança o Electron e conversa com ele. Duas coisas confundem no começo.

**Primeira: existem dois contextos de execução, e você escolhe em qual roda.** Uma forma de avaliação executa dentro do processo **main** — é assim que se substitui o diálogo nativo de escolher arquivo por um que devolve um caminho fixo, sem precisar de alguém clicando. Outra executa dentro do **renderer**, e é ali que você inspeciona a página.

Confundir os dois produz erros desconcertantes: procurar `window` no processo que não tem janela, ou procurar APIs de sistema no que não tem acesso a elas.

**Segunda: instâncias paralelas brigam.** Dois aplicativos Electron lançados ao mesmo tempo disputam o mesmo diretório de dados do usuário. A execução precisa ser serializada.

### O teste mais valioso desta faixa

É o que verifica a **fronteira de segurança**: confirmar que o renderer enxerga exatamente a superfície esperada e nada além dela.

Ele é valioso por um motivo específico — é o único que pega uma configuração de segurança revertida por descuido. Alguém que desligue o sandbox para depurar algo e esqueça de religar não quebra nenhuma funcionalidade; o aplicativo continua funcionando perfeitamente. O que muda é só o tamanho do estrago de uma falha futura, e isso não tem sintoma visível.

Defesa que não tem sintoma quando some é exatamente a que precisa de teste automatizado.

---

## O nível 5 existe por uma classe de defeito própria

A pergunta razoável é: se o nível 4 já sobe o aplicativo, o que o 5 acrescenta?

Acrescenta tudo que muda **entre rodar do código-fonte e rodar do instalador**:

- caminho relativo que passa a estar dentro de um arquivo compactado
- biblioteca nativa que não carrega de dentro desse arquivo
- recurso que a lista de inclusão do empacotador deixou de fora
- arquivo que **entrou** no pacote e não deveria

Nenhum desses aparece em desenvolvimento. Todos aparecem para o usuário.

⚠️ **E aqui vem a regra mais importante do caderno inteiro.**

> **Prove o teste antes de confiar nele.**

Um teste de fumaça é uma verificação frágil por natureza: ele confirma que o aplicativo abriu e que a interface apareceu. É fácil escrever um que **passa incondicionalmente** — que verificaria o mesmo se metade do aplicativo estivesse faltando.

O procedimento que este projeto adotou: **sabote de propósito**. Remova a ponte da lista do que é empacotado, reempacote, rode. O teste **precisa** falhar. Depois reverta e confirme que volta a passar.

Sem esse ciclo, você tem um teste verde e nenhuma informação. E teste verde sem informação é pior que teste ausente — porque no primeiro caso você confia.

Foi exatamente essa inspeção que revelou, neste projeto, que arquivos internos e uma chave pessoal estavam sendo empacotados no instalador.

---

## Cobertura: onde perseguir número e onde não

Talvez a seção mais contra-intuitiva.

| Camada | Meta |
|---|---|
| lógica pura, contrato | alta, e imposta automaticamente |
| main, renderer | **nenhuma** |

Perseguir cobertura no renderer produz **teste de amarração**: verifica que existe uma classe CSS, quebra a cada mudança de layout, não pega defeito nenhum. Ele custa manutenção e paga em falsa confiança.

Perseguir cobertura no main produz **teste de simulação**: você acaba simulando o Electron inteiro e testando a sua simulação — que sempre concorda com você, inclusive quando você está errado.

A saída, quando algo no main ou no renderer parece merecer teste: **extraia dali a lógica pura e teste ela**. Não baixe a régua; mova o código para onde o teste é honesto.

> 🔍 Dentro da faixa com meta, nem tudo é igual. Um arquivo que só declara uma constante não tem comportamento — um teste de igualdade ali é aceitável e barato, e não é o mesmo problema do teste de amarração, porque não quebra a cada mudança não relacionada. Já um esquema de validação de verdade tem comportamento: ele aceita e rejeita. Esse merece teste que o exercite, não um que apenas faça a linha ser executada.

---

## Um número que vale vigiar

O comando que reúne verificação de tipos, análise e testes rápidos é o portão do ciclo de edição. Ele tem um orçamento de tempo, e o orçamento é curto de propósito.

Quando ele passa do limite, a resposta certa não é aumentar o limite — é investigar. Um portão lento é um portão contornado, e um portão contornado não protege nada.

⚠️ O mesmo vale para portão **vermelho por um motivo conhecido**. Este projeto conviveu um tempo com uma falha de análise conhecida e tolerada, e o efeito foi previsível: verificar "está tudo verde" passou a ser feito à mão, arquivo por arquivo. Portão que se sabe quebrado para de ser lido — e a partir daí ele deixa de pegar as falhas *novas* também.

---

**Anterior:** [08 — A fronteira de segurança](08-a-fronteira-de-seguranca.md) · **Índice:** [README](README.md) · **Próximo:** [10 — A interface de um app de desktop](10-interface-de-desktop.md)
