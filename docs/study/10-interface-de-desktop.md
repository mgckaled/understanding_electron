# 10 — A interface de um app de desktop

O renderer é uma página web. Todo conhecimento de desenvolvimento web se aplica ali sem tradução — e é justamente por isso que se comete o erro deste caderno:

> Construir a interface **como se fosse um site**.

Ela roda num navegador, mas não é um site. As diferenças são estruturais, aparecem em toda tela, e cada uma descoberta tarde custa uma varredura por todo componente já escrito.

---

## Quatro diferenças que não são estéticas

### Densidade

Sites são desenhados para leitura confortável em telas variadas, com espaçamento generoso. Aplicativos de desktop são desenhados para **trabalho continuado** numa tela grande, com muita informação simultânea.

Alguém que passa seis horas por dia numa ferramenta de dados quer ver mais linhas, não margens elegantes. A régua de espaçamento de um app de desktop é visivelmente mais apertada — e essa decisão precisa ser tomada uma vez, no vocabulário de medidas, não componente a componente.

### Seleção de texto

Numa página web, tudo é selecionável. É o comportamento certo: o conteúdo é o produto.

Num aplicativo, selecionar acidentalmente o rótulo de um botão ao arrastar é ruído — nenhum programa nativo faz isso. A inversão certa é **desligar a seleção por padrão e religá-la onde o texto é dado**: um caminho de arquivo, uma célula de tabela, uma mensagem de erro que a pessoa vai colar num chamado.

⚠️ Repare que isso é uma inversão de padrão, não um ajuste pontual. Feita no começo, é uma regra e três exceções. Feita depois de trinta componentes, é trinta revisões.

### Rolagem e movimento

O efeito elástico ao chegar no fim de uma lista é linguagem de navegador. Numa janela de aplicativo ele denuncia a origem web na hora.

Animação segue o mesmo raciocínio: transições que encantam num site cansam numa ferramenta usada o dia inteiro. Duração curta, e **respeitar a preferência de movimento reduzido** do sistema — que não é acessibilidade decorativa: para parte das pessoas, movimento causa desconforto físico real.

### Foco visível, mas só para quem usa teclado

Um anel de foco em todo clique polui. A ausência dele torna o aplicativo inutilizável por teclado — e ferramenta de trabalho é operada por teclado.

A distinção que os navegadores modernos oferecem resolve: mostrar o anel quando a navegação veio do teclado, não do ponteiro. É uma linha de estilo e evita escolher entre duas coisas ruins.

---

## Tokens: dois níveis, e por que dois

O erro comum ao organizar cores não é deixar de usar variáveis. É usar **um nível só**:

```css
--cinza-2: #16171a;
/* e o componente escreve var(--cinza-2) */
```

Funciona até o dia em que você precisa mudar o fundo dos painéis. Aí você procura por `--cinza-2` e encontra quarenta usos — dos quais uns dez são fundo de painel e o resto é outra coisa que por acaso tem a mesma cor. **A variável guarda o valor, mas perdeu a intenção.**

A saída é separar em dois níveis:

```css
--cinza-2: #16171a;              /* primitivo: a cor existe */
--color-surface: var(--cinza-2); /* semântico: a cor significa algo */
```

E a regra que faz o sistema funcionar: **componente só toca o segundo nível.** Nunca um primitivo, nunca um valor literal.

Agora "mudar o fundo dos painéis" é uma linha. E a busca por intenção passa a ser possível: quem usa `--color-surface` está desenhando superfície, sempre.

> 🔍 O tema claro cai fora de graça desse desenho. Ele redefine **apenas a camada semântica** — os primitivos continuam os mesmos números. Você não reescreve componente nenhum; troca o significado das palavras, e o vocabulário continua igual.

⚠️ Esta é a regra mais fácil de violar sem perceber, porque escrever `#16171a` direto no componente *funciona*. Nada quebra, nada avisa. Por isso ela é verificada automaticamente aqui: uma cor literal em módulo de estilo é rejeitada, e um nome de token que não existe também — porque um nome errado não gera erro, o navegador simplesmente não aplica nada, e o defeito só aparece quando alguém olhar para aquele componente específico.

---

## Tema pelo sistema, sem alternador

Uma decisão que vale pelo que ela **evita**.

Um alternador manual de tema parece trivial e não é: exige guardar a escolha, sincronizá-la com o processo principal para que a janela nasça na cor certa, e propagar a mudança. É trabalho real, com estado que pode dessincronizar.

Seguir a preferência do sistema operacional é uma consulta de estilo, sem estado nenhum. E é o comportamento que o usuário de desktop espera — ele já escolheu, no sistema.

O que torna o adiamento seguro é que **a estrutura de tokens não muda quando o alternador chegar**. Adiar não cobra juros depois. É um bom exemplo do critério que ordena todo este projeto: *se eu adiar isto, quantos arquivos vou tocar quando finalmente fizer?*

⚠️ Existe um valor que precisa existir em dois lugares mesmo assim: a cor de fundo da janela é declarada no estilo **e** na criação da janela pelo processo principal, porque a janela nasce antes de existir CSS. Se divergirem, aparece um flash da cor errada ao abrir — que some quando você vai investigar. É um dos pares descritos no [caderno 06](06-a-montanha-de-configuracao.md), e a defesa aqui é comentário cruzado nos dois arquivos.

---

## O estado de uma operação é um dado, não três booleanos

Esta é a ideia com maior alcance do caderno, e ela vale para qualquer interface, em qualquer tecnologia.

A forma intuitiva de representar uma operação em andamento é com marcadores independentes:

```ts
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
const [data, setData] = useState(null)
```

O problema é que isso descreve **oito combinações**, e a maioria não faz sentido. Carregando com erro? Com dado e erro ao mesmo tempo? Nada impede — e mais cedo ou mais tarde uma dessas aparece na tela, geralmente como um indicador de carregamento eterno ao lado de uma mensagem de falha.

A alternativa é declarar que a operação está em **exatamente um** estado por vez:

```ts
type ViewState<T> =
  | { status: 'idle' }
  | { status: 'loading'; progress?: JobProgress }
  | { status: 'ready'; data: T }
  | { status: 'empty' }
  | { status: 'cancelled' }
  | { status: 'error'; error: AppError }
```

Combinação impossível deixa de ser possível de escrever. E o compilador passa a cobrar: se você tratar cinco casos e esquecer um, ele avisa.

Repare nos seis estados. Uma operação de análise de dados não tem dois desfechos, tem seis — e três deles costumam ser esquecidos:

- **vazio** não é erro. Arquivo válido, zero linhas. Merece um texto próprio, não uma tabela em branco.
- **cancelado** não é erro. O usuário decidiu. Não deve pintar nada de vermelho nem sugerir que algo deu errado.
- **ocioso** não é carregando. É o estado antes de qualquer coisa acontecer, e ele merece a tela que convida à primeira ação.

> 🔍 Onde esse tipo mora também é uma decisão. Ele fica no renderer, **não** na camada compartilhada entre processos: o processo principal não tem opinião sobre como a tela desenha, e colocá-lo no vocabulário comum acoplaria o processo privilegiado a decisões de interface.

---

## Mensagem de erro: um lugar só

O contrato traz o erro como dado, identificado por um tipo — `not-found`, `permission`, `cancelled`. A interface precisa transformar isso em texto que uma pessoa entenda.

Fazer essa tradução onde o erro aparece espalha o vocabulário: a mesma falha recebe três redações diferentes em três telas. A alternativa é um registro central que mapeia cada tipo de erro para o seu texto.

O ganho real está na forma do mapeamento: por ser um registro **completo** — uma entrada obrigatória por tipo de erro possível —, adicionar um tipo novo ao contrato **quebra a compilação** até que alguém escreva a mensagem dele. A cobertura deixa de depender de lembrança.

⚠️ Vale manter um texto genérico de fallback mesmo assim. Ele não protege contra esquecimento durante o desenvolvimento — a compilação já faz isso. Ele protege contra um caso diferente: um processo principal mais novo que o renderer, mandando um tipo de erro que aquela build não conhece.

---

## Quatro primitivos bastam para começar

Botão, campo, painel e barra de ferramentas. Não uma biblioteca de componentes.

O raciocínio para recusar bibliotecas prontas aqui: elas trazem **densidade e vocabulário de web**, que é exatamente o problema que este caderno abre descrevendo. Você passaria o projeto inteiro lutando contra os padrões delas.

Quatro primitivos escritos à mão custam pouco, e cada um resolve um detalhe que se descobre ao escrever:

- o campo precisa ligar rótulo, controle e mensagem de ajuda por identificadores, para leitor de tela funcionar
- o botão em estado de carregamento deve **esconder** o rótulo preservando a largura, senão a interface pula
- e o indicador de carregamento deve herdar a cor do texto, para não precisar de uma cor extra por variante

Nenhum desses é difícil. Todos são invisíveis até você tropeçar.

---

**Anterior:** [09 — Testar um app de três processos](09-testar-tres-processos.md) · **Índice:** [README](README.md) · **Próximo:** [11 — Trabalho longo sem congelar a janela](11-trabalho-longo.md)
