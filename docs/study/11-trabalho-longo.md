# 11 — Trabalho longo sem congelar a janela

O [caderno 01](01-o-que-e-electron.md) anunciou o problema central de um aplicativo de dados em Electron: o processo principal executa **uma coisa de cada vez**, e trabalho pesado ali dentro congela tudo. Este documento é sobre resolvê-lo de verdade.

O caso concreto: abrir um arquivo de texto grande, descobrir o separador, contar as linhas e listar as colunas. Simples de enunciar, e ele exercita todos os problemas que qualquer operação longa tem.

---

## Por que "só rodar no main" não serve

Ler um arquivo de 2 GB de uma vez trava o aplicativo inteiro. Não só a operação: a janela para de redesenhar, os menus não abrem, o botão de fechar não responde, e o sistema operacional provavelmente marca o programa como "não está respondendo".

E o detalhe mais cruel: **não há como cancelar**, porque o código que responderia ao clique de cancelar está na fila, atrás do trabalho que você quer interromper.

O renderer também não serve — é um navegador, sem acesso a arquivos.

Existem duas saídas, e a escolha entre elas costuma ser feita errada:

| Se o trabalho é limitado por | Então |
|---|---|
| **entrada e saída** — ler disco, esperar rede | pode ficar no main, se for assíncrono de verdade |
| **processador** — calcular, comprimir, agregar | precisa de outro processo |

A fronteira é **quem bloqueia a linha de execução**, não o que parece pesado. Uma requisição de rede que demora dez segundos não bloqueia nada: ela devolve o controle enquanto espera. Um cálculo de dois segundos bloqueia dois segundos inteiros.

Ler um arquivo grande é o primeiro caso — desde que você o leia do jeito certo.

---

## Ler em pedaços, não de uma vez

A diferença entre travar e não travar está na forma da leitura:

```ts
// trava: o arquivo inteiro vira uma string na memória
const conteudo = await readFile(caminho, 'utf8')

// não trava: pedaços chegam conforme são lidos
for await (const linha of linhas) { /* ... */ }
```

O segundo caso é um **stream**: os dados chegam em pedaços, e entre um pedaço e outro o processo volta a atender o resto — o clique no botão, o redesenho da janela.

O ganho de memória vem junto: em vez de 2 GB de uma vez, alguns kilobytes por vez.

> 🔍 Isso também mostra por que a lógica ficou desenhada para receber uma sequência assíncrona de linhas em vez de abrir o arquivo sozinha. Quem consome não precisa saber de onde as linhas vêm — disco, rede ou um array escrito à mão num teste. É a inversão de dependência do [caderno 07](07-camadas-e-contrato.md) aplicada a dados em vez de funções, e é o que torna a lógica testável sem tocar em disco.

---

## Progresso: o problema é o excesso

Uma operação de dez segundos precisa dizer que está viva. A implementação ingênua avisa a cada linha processada — e num arquivo de dez milhões de linhas, isso são dez milhões de mensagens atravessando a fronteira de processo.

O custo de comunicar passa a superar o custo do trabalho. A interface, que deveria ficar fluida, engasga por excesso de atualização.

A solução é **limitar a frequência**: no máximo uma mensagem a cada intervalo fixo, digamos dez por segundo. O olho humano não distingue mais que isso, e o custo vira irrelevante.

⚠️ **A armadilha embutida nessa solução:** o limitador descarta a última atualização.

Pense no fim da operação. As últimas linhas são processadas dentro do intervalo, a mensagem final é descartada por chegar cedo demais — e a barra de progresso congela em 97%. O trabalho terminou, o resultado apareceu, e a barra ficou parada num número que não é cem.

A correção é emitir o progresso final **fora do limitador**, sempre, quando a operação termina com sucesso. Duas linhas de código que separam uma interface que parece pronta de uma que parece quebrada.

---

## Cancelamento: a parte que quase todo mundo faz pela metade

Cancelar parece simples: um sinalizador que a operação consulta de vez em quando.

O mecanismo padrão para isso é um controlador que emite um sinal, e o laço verifica esse sinal a cada volta. Quando o sinal dispara, o laço para e a operação devolve "cancelado" — que, vale lembrar do [caderno 10](10-interface-de-desktop.md), **não é erro**.

E aqui está a lição mais cara deste caderno.

### Parar o laço não para a leitura

Quando você interrompe um laço que consome um stream, o objeto que fornece as linhas é fechado. Parece o fim da história. Não é.

Esse objeto costuma ser um **invólucro** em volta da fonte real — no caso, o fluxo de leitura do disco. Fechar o invólucro só solta o controle que ele tinha sobre a fonte; **a fonte continua lendo**.

Isso foi medido neste projeto, não suposto: depois da interrupção do laço, o contador de bytes lidos continuava crescendo trezentos milissegundos depois, sem nenhum consumidor do outro lado.

O efeito prático: o usuário clica em cancelar, a interface muda de estado imediatamente, e o disco continua sendo lido. A operação *parece* cancelada. Do ponto de vista do sistema, ela não foi.

**A regra que restou:** destrua a fonte explicitamente, ao lado de fechar o invólucro. E ela generaliza — em qualquer camada de abstração sobre stream, o "fechar" do invólucro raramente propaga para a origem. Vale conferir, e a forma de conferir é medir.

### Onde o identificador nasce

Um detalhe de desenho que parece arbitrário e não é.

O identificador da tarefa é criado **no renderer**, antes de a operação começar, e enviado junto com o pedido. A alternativa natural — o processo principal criar o identificador e devolvê-lo — tem um defeito fatal:

> Se o identificador só chega na resposta, não há o que cancelar **enquanto a operação está em andamento** — que é exatamente a janela de tempo em que cancelar importa.

Quem precisa cancelar precisa do identificador antes, não depois.

### O registro que vaza

Os controladores de cancelamento ficam num registro, indexados por identificador, para que o pedido de cancelamento encontre o certo.

⚠️ Esse registro **precisa ser limpo em toda saída** — sucesso, erro, cancelamento. Se a limpeza acontecer só no caminho feliz, cada operação que falha deixa uma entrada para trás.

O que torna isso perigoso é o padrão de falha: um registro que só cresce não quebra nada visível. O aplicativo funciona, os testes passam, e a memória sobe devagar ao longo de horas de uso. Nenhum teste pega — ninguém escreve um teste que abre quarenta tarefas seguidas e confere o tamanho de uma estrutura interna.

A defesa é estrutural: a limpeza vai no bloco que roda **sempre**, por qualquer via de término.

---

## Eventos do main para o renderer

Progresso viaja no sentido contrário ao normal: o processo principal avisa a interface de algo que ela não pediu naquele instante.

Isso pede um canal de mão única, diferente do padrão pergunta-resposta do [caderno 07](07-camadas-e-contrato.md). Três cuidados que valem registrar:

**Não vaze o objeto de evento para a interface.** O evento que chega carrega uma referência viva ao emissor. Repassá-lo entrega ao renderer uma capacidade que ele não deveria ter. O código que recebe extrai só os dados e passa adiante apenas isso.

**Toda assinatura devolve uma forma de cancelar.** Sem isso, um componente que assina e é removido da tela deixa o ouvinte para trás — o vazamento clássico de interface, que se manifesta como atualização de estado num componente que não existe mais.

**Um evento nem sempre cabe no mesmo contrato.** O canal de eventos não passa pelo mecanismo de pergunta-resposta e não tem esquema de validação de argumentos — forçá-lo para dentro da mesma estrutura só para parecer uniforme quebra a estrutura.

---

## O padrão completo

Juntando tudo, uma operação longa bem-comportada tem seis partes:

1. **Identificador criado por quem vai cancelar**, antes de começar
2. **Leitura em pedaços**, para não bloquear nem estourar a memória
3. **Progresso limitado por frequência**, com emissão final garantida
4. **Verificação do sinal de cancelamento** a cada volta do laço
5. **Destruição explícita da fonte** ao interromper — não confie no invólucro
6. **Limpeza do registro** no caminho que roda sempre

Nenhuma delas é específica de Electron. Mudam os nomes das APIs; a lista continua a mesma em qualquer linguagem que tenha operação longa e interface responsiva.

---

## O que vem a seguir

Este caderno resolve o caso limitado por entrada e saída. O caso limitado por processador — agregações sobre milhões de linhas — precisa da outra saída da tabela lá do início: um processo separado.

Esse é o assunto do [caderno 05](05-proximos-passos.md), que descreve a camada de dados e, com ela, o custo real de atravessar uma fronteira de processo carregando resultado grande.

Uma coisa vale antecipar, porque contraria a intuição que este caderno acabou de construir: **entre processos do sistema operacional, os bytes são copiados**. Não existe transferência de posse de memória — isso só vale dentro de um mesmo processo. A escolha de um formato binário colunar continua certa, mas por outro motivo: evitar alocar milhões de objetos e convertê-los para texto. É cópia rápida de bloco contíguo contra reconstrução item a item.

A diferença continua sendo de ordens de grandeza. Só não é grátis — e a correção dessa suposição, feita aqui depois de escrita, está registrada no [`docs/HISTORY.md`](../HISTORY.md).

---

**Anterior:** [10 — A interface de um app de desktop](10-interface-de-desktop.md) · **Índice:** [README](README.md)
