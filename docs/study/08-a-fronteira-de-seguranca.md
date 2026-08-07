# 08 — A fronteira de segurança

Segurança em documentação costuma virar lista de boas práticas — cada item verdadeiro, nenhum explicando por que existe. Este documento tenta o contrário: partir de **um modelo de ameaça concreto** e derivar as defesas dele.

O modelo de ameaça deste aplicativo cabe numa frase, e é incomodamente específico:

> É um programa cuja função é **abrir arquivos que o usuário não escreveu**.

CSV baixado de um portal, planilha recebida por e-mail, Parquet de uma fonte de terceiro. O conteúdo é, por definição, não confiável — e o propósito do aplicativo é justamente processá-lo. Você não pode recusar a entrada; ela *é* o produto.

---

## Por que isso é diferente de um site

Um navegador roda código não confiável o tempo todo, com sucesso, há décadas. A diferença é o que está do outro lado.

Numa aba de navegador, o pior caso de uma falha é o dado daquele site. Num aplicativo Electron mal configurado, o pior caso é a máquina inteira — o processo tem acesso ao sistema de arquivos, à rede local e à capacidade de executar outros programas.

O trabalho da fronteira é fazer com que **o pior caso de um aplicativo de desktop se pareça com o pior caso de uma aba**.

---

## As quatro camadas, e o que cada uma faz

Elas não são alternativas. São camadas independentes, e o valor está em serem independentes: quando uma falha, a seguinte ainda está de pé.

### 1. Isolamento de contexto

Separa o mundo JavaScript da página do mundo onde o preload roda. Sem essa separação, código na página pode **alcançar e reescrever** as funções que o preload expôs — inclusive substituí-las por versões maliciosas que a sua própria interface passaria a chamar.

Com a separação, a única passagem é a ponte, e ela copia valores em vez de compartilhar referências.

### 2. Sem integração com Node

O renderer não recebe as APIs de sistema. Sem leitura de arquivo, sem execução de processo, sem rede privilegiada — mesmo que alguém consiga executar JavaScript ali dentro.

### 3. Sandbox

A camada do sistema operacional. O processo de renderização passa a rodar com privilégios reduzidos **no nível do SO**: mesmo que um invasor comprometa o processo por completo, ele não consegue pedir muita coisa ao sistema.

É a diferença entre "o invasor está preso numa sala" e "a sala não tem torneira, tomada nem janela".

### 4. Política de conteúdo

Declara de onde a página pode carregar recursos. Com origem própria apenas, nenhum script externo executa — mesmo que alguém consiga injetar uma tag apontando para outro servidor.

É a camada que age quando as três anteriores já falharam e existe injeção de conteúdo na página.

> 🔍 As três primeiras já são o padrão do Electron moderno. Este projeto as escreve **explicitamente** mesmo assim, por legibilidade: um comentário curto no ponto de aplicação distingue "padrão seguro" de "ninguém pensou nisso" — e qualquer alteração acidental aparece no diff. Escrever o padrão custa três linhas; descobrir que alguém o mudou sem querer custa um incidente.

---

## O preço do sandbox, que é real

Vale ser honesto: o sandbox cobra.

Com ele ligado, o preload perde a capacidade de carregar bibliotecas de terceiro. Sobra um substituto limitado. Na prática, **o preload precisa ser um arquivo único e autossuficiente** — tudo que ele usa é embutido nele durante o build.

Isso tem uma consequência que não é óbvia e que este projeto aprendeu do jeito difícil.

⚠️ O preload pode importar tipos de qualquer lugar — tipo desaparece na compilação. Mas quando ele importa um **valor** de um arquivo que, por sua vez, importa uma biblioteca, essa biblioteca é arrastada junto. O bundler a deixa como uma referência externa que o preload sandboxed não consegue resolver.

O resultado foi uma janela que abriu **vazia, sem nenhum erro no terminal**. A ponte falhou ao carregar, `window.api` ficou indefinido, e a interface inteira morreu em silêncio. Nem a verificação de tipos, nem a análise de código, nem os testes pegam isso — nenhum deles executa o preload dentro do sandbox real. O erro só aparecia no console da própria janela.

A regra que restou: **valor novo que o preload vá consumir nasce num arquivo sem dependência externa.** Nunca reaproveite um arquivo que já importa uma biblioteca só porque o tipo relacionado mora lá.

---

## Navegação: as duas portas que ficam abertas por padrão

Um detalhe que passa despercebido: mesmo com tudo acima configurado, uma página ainda pode tentar **navegar para outro lugar** ou **abrir uma janela nova**. As duas coisas carregam conteúdo externo para dentro do seu aplicativo, com o seu preload disponível.

As duas precisam ser negadas explicitamente. O aplicativo carrega a própria interface e nada mais; qualquer tentativa de sair da origem é interceptada.

E é aqui que este projeto encontrou o defeito mais instrutivo de toda a sua história.

---

## `shell.openExternal` não abre um navegador

Quando você nega a navegação interna, a coisa natural a fazer com o endereço é entregá-lo ao sistema operacional — que abre no navegador padrão do usuário. Assim o link funciona, e o conteúdo externo fica fora do aplicativo. É o padrão que todo template de Electron traz.

O problema está na descrição "abre no navegador padrão". Não é isso que acontece.

> `shell.openExternal` **pede ao sistema operacional que resolva o esquema** do endereço. E o sistema honra **todo handler de protocolo registrado**, não apenas os de navegador.

Um endereço `https://` vai para o navegador. Um `file://` abre o gerenciador de arquivos. E, no Windows, existem dezenas de esquemas registrados por programas instalados que fazem coisas bem menos inocentes — a classe de vulnerabilidade que ficou conhecida como *Follina* explorava exatamente um deles.

Entregar um endereço não verificado a essa função não é "abrir um link". É **invocar um programa local arbitrário com um argumento que veio de fora**.

A defesa é simples: uma lista dos esquemas aceitos, e nada além.

### A parte que ensina de verdade

Este projeto **tinha** essa lista. Ela estava escrita, tinha quatro testes, e funcionava.

E mesmo assim havia duas chamadas diretas à função no processo main — uma no bloqueio de janela nova, outra no bloqueio de navegação — que **não passavam por ela**. Ou seja: a proteção de navegação convertia toda navegação negada numa entrega direta ao sistema operacional.

A lista estava correta e verificada nos caminhos que ninguém percorre. Estava ausente nos dois que uma página alcança.

Vale insistir no que **não** pegou isso:

- A verificação de tipos não pega — chamar a função é perfeitamente válido.
- O teste da lista passava — ele testava a lista, não quem a usa.
- O teste de fronteira ponta a ponta não pega — ele verifica a superfície exposta ao renderer, não o comportamento do main.
- A documentação afirmava o invariante em prosa, o que não verifica nada.

A moral, e ela vale muito além de Electron:

> **Validação que mora junto de um chamador vira bypass no segundo.**

Quando dois lugares precisam tomar a mesma decisão de segurança, ela não pertence a nenhum dos dois. Pertence a uma camada que ambos consomem — no caso deste projeto, uma função pura em `core/`, que os três chamadores agora usam.

---

## Segredos: o renderer escreve e nunca lê

Uma regra fixada **antes** de existir o primeiro segredo, o que é a hora certa de fixá-la.

Quando o aplicativo precisar de credenciais, o contrato terá as operações de gravar, perguntar se está configurado e apagar. **Não terá a de ler.**

O raciocínio: chave que chega ao renderer entra em estado de componente, aparece nas ferramentas de desenvolvimento, e vai parar em relatório de erro automático. O renderer não precisa do valor — ele precisa saber se existe, e precisa que a operação privilegiada aconteça. Quem usa a chave é o main.

⚠️ E o corolário que separa aplicativo empacotado de script: **nunca guarde segredo em arquivo de configuração na raiz do projeto**. Um script que roda do código-fonte pode fazer isso; um aplicativo distribuído que lê um arquivo da raiz está distribuindo a chave junto com o instalador. O lugar certo é o armazenamento de credenciais do sistema operacional, no diretório de dados do usuário.

---

## A ameaça que não é a página: o que vai no instalador

A última fronteira não tem nada a ver com o renderer, e é a que este projeto quase entregou errado.

O empacotador lê **o disco**, não o histórico do repositório. Um arquivo que nunca foi versionado continua existindo na máquina de quem faz o build — e entra no pacote se a lista de inclusão não o excluir.

Foi assim que uma chave de API pessoal acabou dentro de um instalador, junto com documentação interna do projeto. Nenhum comando de verificação de tipos, análise, teste ou build acusa isso, porque **nenhum deles inspeciona o conteúdo do pacote**.

Duas lições:

1. **Inverter a lista.** Enumerar o que entra, não o que fica de fora. Lista de exclusão só cobre o que alguém lembrou e apodrece a cada arquivo novo na raiz; lista de inclusão faz o esquecimento cair para o lado seguro.
2. **Abrir o pacote e conferir.** A verificação é inspecionar o artefato gerado, não ler o padrão e concluir que ele cobre o caso.

---

## O que a fronteira não faz

Para não criar falsa sensação de segurança, vale dizer o que fica de fora:

- **Não protege contra a lógica do próprio aplicativo.** Se uma operação exposta aceita um caminho arbitrário e lê o arquivo, a fronteira não tem opinião — a operação está autorizada.
- **Não substitui validar conteúdo.** Um arquivo malformado ainda pode travar ou consumir toda a memória. Isso é robustez, e é problema de outra camada.
- **Não cobre dependências.** Uma biblioteca comprometida roda com o privilégio de quem a importou. Daí as proteções de instalação que o [caderno 02](02-a-stack-e-o-porque.md) descreve.

A fronteira limita o **alcance** de uma falha. Ela não impede que a falha exista.

---

**Anterior:** [07 — Camadas e o contrato](07-camadas-e-contrato.md) · **Índice:** [README](README.md) · **Próximo:** [09 — Testar um app de três processos](09-testar-tres-processos.md)
